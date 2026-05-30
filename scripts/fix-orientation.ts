/**
 * Repara partidos cuyos goles quedaron invertidos respecto a ESPN porque el
 * proveedor reportó el fixture con local/visitante en orden opuesto al nuestro,
 * y el sync (antes del fix) asignó goles por posición sin reconciliar.
 *
 * Para cada Match con externalId y resultado (live u oficial):
 *   1. Consulta ESPN.
 *   2. Compara orientación con teamsMatch(ourHome, fxHome/fxAway).
 *   3. Si está invertido, voltea los goles live / official / penalty.
 *   4. Recalcula Score de TODAS las predicciones del match en TODAS las
 *      quinielas (Mundial, DP-TI, Amistosos…), respetando partido estrella.
 *
 * Idempotente: vuelve a chequear contra ESPN cada vez; si ya está alineado, no
 * toca nada.
 *
 *   # Revisión sin escribir (dry-run, por defecto):
 *   DATABASE_URL=<url> npx tsx scripts/fix-orientation.ts
 *
 *   # Aplicar cambios:
 *   DATABASE_URL=<url> npx tsx scripts/fix-orientation.ts --apply
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { fetchFixtures } from '../src/lib/live-providers'
import { calculateScore } from '../src/lib/scoring'
import { teamsMatch } from '../src/lib/team-matching'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const APPLY = process.argv.includes('--apply')

async function main() {
  console.log(APPLY ? '== MODO APPLY (escribe cambios) ==' : '== DRY-RUN (solo reporta; usa --apply para escribir) ==')

  const matches = await prisma.match.findMany({
    where: {
      externalId: { not: null },
      OR: [
        { liveHomeGoals: { not: null } },
        { officialHomeGoals: { not: null } },
      ],
    },
    select: {
      id: true,
      eventId: true,
      externalId: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      liveHomeGoals: true,
      liveAwayGoals: true,
      officialHomeGoals: true,
      officialAwayGoals: true,
      penaltyHomeGoals: true,
      penaltyAwayGoals: true,
    },
  })

  if (matches.length === 0) {
    console.log('No hay partidos con resultado y externalId.')
    return
  }

  const externalIds = matches.map((m) => m.externalId!).filter(Boolean)
  const fixtures = await fetchFixtures(externalIds)
  const byId = new Map(fixtures.map((f) => [f.externalId, f]))

  let flipped = 0
  let recalculated = 0

  for (const m of matches) {
    const fx = byId.get(m.externalId!)
    if (!fx) {
      console.log(`  · ${m.id}: ESPN no devolvió fixture — skip`)
      continue
    }
    const ourHome = m.homeTeam?.name
    const ourAway = m.awayTeam?.name
    if (!ourHome || !ourAway || !fx.homeName || !fx.awayName) {
      console.log(`  · ${m.id}: nombres incompletos (KN ${ourHome}/${ourAway} · ESPN ${fx.homeName}/${fx.awayName}) — skip`)
      continue
    }

    const same = teamsMatch(ourHome, fx.homeName) && teamsMatch(ourAway, fx.awayName)
    const swapped = teamsMatch(ourHome, fx.awayName) && teamsMatch(ourAway, fx.homeName)

    if (!swapped || same) {
      // Orientación de equipos alineada (o no determinable con confianza) → el
      // sync ya guarda bien; no tocar.
      continue
    }

    // La orientación de EQUIPOS está cruzada (ESPN local = nuestro visitante).
    // Eso es permanente y NO es señal de error por sí solo. Solo corregimos si
    // los GOLES guardados todavía están en orientación ESPN — es decir, si
    // nuestro home tiene los goles que ESPN asignó a su home. Comparamos contra
    // el valor que DEBERÍA tener nuestro home (= goles del away de ESPN).
    const expectedHome = fx.awayGoals // nuestro home == away de ESPN
    const expectedAway = fx.homeGoals
    const curHome = m.officialHomeGoals ?? m.liveHomeGoals
    const curAway = m.officialAwayGoals ?? m.liveAwayGoals
    if (curHome === expectedHome && curAway === expectedAway) {
      // Goles ya alineados a nuestra orientación → idempotente, no tocar.
      continue
    }

    console.log(`  ⚠ ${m.id}: INVERTIDO`)
    console.log(`      ESPN: ${fx.homeName} ${fx.homeGoals}-${fx.awayGoals} ${fx.awayName}`)
    console.log(`      KN actual: ${ourHome} ${m.liveHomeGoals ?? m.officialHomeGoals}-${m.liveAwayGoals ?? m.officialAwayGoals} ${ourAway}`)

    const swap = (h: number | null, a: number | null): [number | null, number | null] => [a, h]
    const [newLiveH, newLiveA] = swap(m.liveHomeGoals, m.liveAwayGoals)
    const [newOffH, newOffA] = swap(m.officialHomeGoals, m.officialAwayGoals)
    const [newPenH, newPenA] = swap(m.penaltyHomeGoals, m.penaltyAwayGoals)

    console.log(`      KN corregido: ${ourHome} ${newLiveH ?? newOffH}-${newLiveA ?? newOffA} ${ourAway}`)

    if (APPLY) {
      await prisma.match.update({
        where: { id: m.id },
        data: {
          liveHomeGoals: newLiveH,
          liveAwayGoals: newLiveA,
          officialHomeGoals: newOffH,
          officialAwayGoals: newOffA,
          penaltyHomeGoals: newPenH,
          penaltyAwayGoals: newPenA,
        },
      })
    }
    flipped++

    // Recalcular scores si hay resultado oficial (los puntos definitivos se
    // basan en el oficial). Usa los goles corregidos.
    const offH = newOffH
    const offA = newOffA
    if (offH !== null && offA !== null) {
      const predictions = await prisma.prediction.findMany({ where: { matchId: m.id } })
      const stars = await prisma.quinielaStarMatch.findMany({
        where: { matchId: m.id, isStar: true },
        select: { quinielaId: true },
      })
      const starQuinielas = new Set(stars.map((s) => s.quinielaId))

      for (const pred of predictions) {
        const isStar = starQuinielas.has(pred.quinielaId)
        const result = calculateScore(
          pred.predictedHomeGoals,
          pred.predictedAwayGoals,
          offH,
          offA,
          isStar,
        )
        if (APPLY) {
          await prisma.score.upsert({
            where: {
              quinielaId_userId_matchId: {
                quinielaId: pred.quinielaId,
                userId: pred.userId,
                matchId: m.id,
              },
            },
            update: {
              points: result.points,
              reason: result.reason,
              isStarMatch: isStar,
              calculatedAt: new Date(),
            },
            create: {
              quinielaId: pred.quinielaId,
              eventId: m.eventId,
              userId: pred.userId,
              matchId: m.id,
              predictionId: pred.id,
              points: result.points,
              reason: result.reason,
              isStarMatch: isStar,
            },
          })
        }
        recalculated++
      }
    }
  }

  console.log('')
  console.log(`Partidos invertidos detectados: ${flipped}`)
  console.log(`Predicciones recalculadas: ${recalculated}`)
  console.log(APPLY ? 'Cambios aplicados.' : 'DRY-RUN: nada se escribió. Re-ejecuta con --apply para aplicar.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
