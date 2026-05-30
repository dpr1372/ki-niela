import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isMatchLocked } from '@/lib/timezone'

/**
 * Cron job: genera predicciones automáticas (bot) para los participantes que
 * activaron su check de predicciones automáticas.
 *
 * Diseño robusto (no depende del estado transitorio BLOQUEADO):
 *  - El bot NO se ancla al status BLOQUEADO porque otro cron (sync-live-scores)
 *    puede pisar ese estado a EN_JUEGO antes de que este job corra, dejando a
 *    los jugadores sin predicción. En su lugar evaluamos la VENTANA DE BLOQUEO
 *    por quiniela: si ya entró (now ≥ kickoff − lockMinutesBeforeMatch) y el
 *    partido aún no finalizó, el bot rellena a quien tenga el check activo.
 *  - lockMinutesBeforeMatch es por quiniela (config del admin). Cada quiniela
 *    decide cuándo abre su ventana de bot.
 *  - NUNCA toca partidos finalizados/cancelados/postergados ni con resultado
 *    oficial: una vez el partido empezó o terminó, el marcador no se modifica.
 *  - NUNCA sobrescribe una predicción existente (manual o bot).
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Candidatos: partidos que NO han finalizado ni se cancelaron/postergaron, y
  // que aún no tienen resultado oficial confirmado. Incluye PROGRAMADO,
  // BLOQUEADO, EN_JUEGO, MEDIO_TIEMPO, TIEMPO_EXTRA, PENALES — la ventana de
  // bloqueo por quiniela decide cuáles aplican.
  const candidates = await prisma.match.findMany({
    where: {
      status: { notIn: ['FINALIZADO', 'CANCELADO', 'POSTERGADO'] },
      resultConfirmedAt: null,
    },
    select: { id: true, eventId: true, kickoffAtUtc: true },
  })

  let generated = 0

  for (const match of candidates) {
    // Todas las quinielas activas del evento con bot habilitado.
    const quinielas = await prisma.quiniela.findMany({
      where: { eventId: match.eventId, randomPredictionsEnabled: true, status: 'ACTIVE' },
      select: {
        id: true,
        randomMinGoals: true,
        randomMaxGoals: true,
        lockMinutesBeforeMatch: true,
      },
    })

    for (const quiniela of quinielas) {
      // ¿El partido ya entró en la ventana de bloqueo de ESTA quiniela?
      // Antes de la ventana el jugador todavía puede pronosticar a mano, así
      // que el bot no debe adelantarse.
      if (!isMatchLocked(new Date(match.kickoffAtUtc), quiniela.lockMinutesBeforeMatch)) {
        continue
      }

      // Miembros activos con check de bot que aún no tienen predicción.
      const existingPredictions = await prisma.prediction.findMany({
        where: { quinielaId: quiniela.id, matchId: match.id },
        select: { userId: true },
      })
      const alreadyPredicted = new Set(existingPredictions.map((p) => p.userId))

      // Solo PARTICIPANT: los QUINIELA_ADMIN no compiten, así que el bot no les
      // genera predicción aunque tengan el check activo.
      const eligibleMembers = await prisma.quinielaMember.findMany({
        where: {
          quinielaId: quiniela.id,
          status: 'ACTIVE',
          role: 'PARTICIPANT',
          autoPredictionsEnabled: true,
          userId: { notIn: Array.from(alreadyPredicted) },
        },
        select: { userId: true },
      })

      const min = quiniela.randomMinGoals
      const max = quiniela.randomMaxGoals

      for (const member of eligibleMembers) {
        const home = randomInt(min, max)
        const away = randomInt(min, max)
        // create() (no upsert): si por carrera otro proceso ya insertó la
        // predicción, el unique(quinielaId,userId,matchId) la rechaza y la
        // saltamos — nunca pisamos una predicción existente.
        try {
          await prisma.prediction.create({
            data: {
              quinielaId: quiniela.id,
              eventId: match.eventId,
              userId: member.userId,
              matchId: match.id,
              predictedHomeGoals: home,
              predictedAwayGoals: away,
              generatedByBot: true,
              lockedAt: new Date(),
            },
          })
          generated++
        } catch (e) {
          // P2002 = unique violation: otra ejecución ya insertó la predicción.
          // La saltamos en silencio. Cualquier otro error sí lo logueamos.
          if ((e as { code?: string }).code !== 'P2002') {
            console.error('[generate-random-predictions] create failed', e)
          }
        }
      }
    }
  }

  return NextResponse.json({ generated })
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
