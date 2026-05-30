/**
 * Verificación + recálculo integral de TODOS los partidos finalizados en TODAS
 * las quinielas. Pensado para correr tras un fix de datos o cuando se sospecha
 * que algún score quedó mal.
 *
 * Hace tres cosas:
 *   1. VERIFICA orientación: para cada partido finalizado con externalId,
 *      compara el marcador oficial guardado contra ESPN (reorientado a nuestra
 *      perspectiva home/away). Reporta cualquier discrepancia restante.
 *   2. RECALCULA todos los Score de todas las predicciones de cada partido
 *      finalizado, en todas las quinielas, respetando partido estrella.
 *   3. LIMPIA scores huérfanos (de partidos sin oficial, o de SUPER_ADMIN).
 *
 * Idempotente. Dry-run por defecto.
 *
 *   DATABASE_URL=<url> npx tsx scripts/verify-and-recalc.ts          # reporta
 *   DATABASE_URL=<url> npx tsx scripts/verify-and-recalc.ts --apply  # escribe
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
  console.log(APPLY ? '== APPLY (escribe) ==' : '== DRY-RUN (solo reporta; --apply para escribir) ==\n')

  // Excluir SUPER_ADMIN del scoring (no son competidores).
  const superAdmins = await prisma.user.findMany({
    where: { globalRole: 'SUPER_ADMIN' },
    select: { id: true },
  })
  const superAdminIds = new Set(superAdmins.map((u) => u.id))

  const finalized = await prisma.match.findMany({
    where: { officialHomeGoals: { not: null }, officialAwayGoals: { not: null } },
    select: {
      id: true,
      eventId: true,
      externalId: true,
      officialHomeGoals: true,
      officialAwayGoals: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  })

  console.log(`Partidos finalizados: ${finalized.length}\n`)

  // ── 1. VERIFICACIÓN de orientación contra ESPN ──────────────────────────────
  const withExt = finalized.filter((m) => m.externalId)
  let discrepancias = 0
  if (withExt.length) {
    const fixtures = await fetchFixtures(withExt.map((m) => m.externalId!))
    const byId = new Map(fixtures.map((f) => [f.externalId, f]))
    console.log('── Verificación de marcador vs ESPN ──')
    for (const m of withExt) {
      const fx = byId.get(m.externalId!)
      if (!fx || fx.homeGoals === null || fx.awayGoals === null) {
        console.log(`  · ${m.id}: ESPN sin datos — skip verificación`)
        continue
      }
      const ourHome = m.homeTeam?.name
      const ourAway = m.awayTeam?.name
      // Goles ESPN reorientados a nuestra perspectiva.
      let espnHome = fx.homeGoals
      let espnAway = fx.awayGoals
      if (ourHome && ourAway && fx.homeName && fx.awayName) {
        const swapped = teamsMatch(ourHome, fx.awayName) && teamsMatch(ourAway, fx.homeName)
        const same = teamsMatch(ourHome, fx.homeName) && teamsMatch(ourAway, fx.awayName)
        if (swapped && !same) {
          espnHome = fx.awayGoals
          espnAway = fx.homeGoals
        }
      }
      const ok = m.officialHomeGoals === espnHome && m.officialAwayGoals === espnAway
      const tag = ok ? '✓' : '✗ DISCREPANCIA'
      console.log(`  ${tag} ${m.id}: KN ${ourHome} ${m.officialHomeGoals}-${m.officialAwayGoals} ${ourAway} · ESPN(reorient) ${espnHome}-${espnAway}`)
      if (!ok) discrepancias++
    }
    console.log('')
  }

  // ── 2. RECÁLCULO de scores en todas las quinielas ───────────────────────────
  console.log('── Recálculo de scores ──')
  let recalced = 0
  let changed = 0
  for (const m of finalized) {
    const predictions = await prisma.prediction.findMany({ where: { matchId: m.id } })
    const stars = await prisma.quinielaStarMatch.findMany({
      where: { matchId: m.id, isStar: true },
      select: { quinielaId: true },
    })
    const starQ = new Set(stars.map((s) => s.quinielaId))

    for (const pred of predictions) {
      if (superAdminIds.has(pred.userId)) continue // no compite
      const isStar = starQ.has(pred.quinielaId)
      const result = calculateScore(
        pred.predictedHomeGoals,
        pred.predictedAwayGoals,
        m.officialHomeGoals!,
        m.officialAwayGoals!,
        isStar,
      )
      const existing = await prisma.score.findUnique({
        where: { quinielaId_userId_matchId: { quinielaId: pred.quinielaId, userId: pred.userId, matchId: m.id } },
      })
      if (!existing || existing.points !== result.points || existing.reason !== result.reason || existing.isStarMatch !== isStar) {
        changed++
      }
      if (APPLY) {
        await prisma.score.upsert({
          where: { quinielaId_userId_matchId: { quinielaId: pred.quinielaId, userId: pred.userId, matchId: m.id } },
          update: { points: result.points, reason: result.reason, isStarMatch: isStar, calculatedAt: new Date() },
          create: {
            quinielaId: pred.quinielaId, eventId: m.eventId, userId: pred.userId, matchId: m.id,
            predictionId: pred.id, points: result.points, reason: result.reason, isStarMatch: isStar,
          },
        })
      }
      recalced++
    }
  }
  console.log(`  Scores evaluados: ${recalced} · cambiarían/cambiaron: ${changed}\n`)

  // ── 3. LIMPIEZA de scores huérfanos ─────────────────────────────────────────
  console.log('── Limpieza de scores inválidos ──')
  const finalizedIds = new Set(finalized.map((m) => m.id))
  const allScores = await prisma.score.findMany({ select: { id: true, matchId: true, userId: true } })
  const orphans = allScores.filter((s) => !finalizedIds.has(s.matchId) || superAdminIds.has(s.userId))
  console.log(`  Scores huérfanos (partido sin oficial o de SUPER_ADMIN): ${orphans.length}`)
  if (APPLY && orphans.length) {
    await prisma.score.deleteMany({ where: { id: { in: orphans.map((o) => o.id) } } })
  }

  console.log('')
  console.log('── Resumen ──')
  console.log(`  Discrepancias de marcador vs ESPN: ${discrepancias}`)
  console.log(`  Scores recalculados: ${recalced} (con cambio: ${changed})`)
  console.log(`  Scores huérfanos eliminados: ${APPLY ? orphans.length : 0}${APPLY ? '' : ` (pendiente, ${orphans.length})`}`)
  console.log(APPLY ? '\nCambios aplicados.' : '\nDRY-RUN: nada se escribió.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
