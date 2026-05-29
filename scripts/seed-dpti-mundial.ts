/**
 * Crea (idempotente) la quiniela "DP-TI COPA MUNDO 2026" como clon exacto de la
 * quiniela existente "Ki-Niela Mundial 2026" (mismo event-wc2026, misma config,
 * mismos partidos estrella). NO clona miembros ni predicciones.
 *
 *   npx tsx scripts/seed-dpti-mundial.ts
 *
 * Para ejecutarlo contra Railway, exporta DATABASE_URL apuntando a la BD de
 * producción antes de correr.
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const NEW_QUINIELA_ID = 'quiniela-dpti-mundial-2026'
const NEW_NAME = 'DP-TI COPA MUNDO 2026'
const NEW_INVITE_CODE = 'DPTI2026'
const SOURCE_QUINIELA_ID = 'quiniela-mundial-2026'

async function main() {
  console.log(`Cloning ${SOURCE_QUINIELA_ID} → ${NEW_QUINIELA_ID}`)

  const source = await prisma.quiniela.findUnique({
    where: { id: SOURCE_QUINIELA_ID },
    include: { starMatches: true },
  })
  if (!source) {
    throw new Error(
      `Source quiniela ${SOURCE_QUINIELA_ID} not found. Run "npx prisma db seed" first.`,
    )
  }

  const target = await prisma.quiniela.upsert({
    where: { id: NEW_QUINIELA_ID },
    update: {
      name: NEW_NAME,
      description: source.description,
      visibility: source.visibility,
      status: source.status,
      randomPredictionsEnabled: source.randomPredictionsEnabled,
      randomMinGoals: source.randomMinGoals,
      randomMaxGoals: source.randomMaxGoals,
      lockMinutesBeforeMatch: source.lockMinutesBeforeMatch,
      timezone: source.timezone,
    },
    create: {
      id: NEW_QUINIELA_ID,
      eventId: source.eventId,
      name: NEW_NAME,
      description: source.description,
      visibility: source.visibility,
      status: source.status,
      randomPredictionsEnabled: source.randomPredictionsEnabled,
      randomMinGoals: source.randomMinGoals,
      randomMaxGoals: source.randomMaxGoals,
      lockMinutesBeforeMatch: source.lockMinutesBeforeMatch,
      timezone: source.timezone,
      inviteCode: NEW_INVITE_CODE,
      createdByUserId: source.createdByUserId,
    },
  })
  console.log(`  Quiniela: ${target.name} (inviteCode=${target.inviteCode})`)

  // Admin global como QUINIELA_ADMIN inicial — mismo que la quiniela fuente
  await prisma.quinielaMember.upsert({
    where: {
      quinielaId_userId: {
        quinielaId: target.id,
        userId: source.createdByUserId,
      },
    },
    update: { role: 'QUINIELA_ADMIN', status: 'ACTIVE' },
    create: {
      quinielaId: target.id,
      userId: source.createdByUserId,
      role: 'QUINIELA_ADMIN',
      status: 'ACTIVE',
      autoPredictionsEnabled: false,
      joinedAt: new Date(),
      approvedAt: new Date(),
      approvedByUserId: source.createdByUserId,
    },
  })
  console.log(`  Admin asignado: ${source.createdByUserId}`)

  // Replicar partidos estrella
  let stars = 0
  for (const sm of source.starMatches) {
    await prisma.quinielaStarMatch.upsert({
      where: {
        quinielaId_matchId: {
          quinielaId: target.id,
          matchId: sm.matchId,
        },
      },
      update: { isStar: sm.isStar },
      create: {
        quinielaId: target.id,
        matchId: sm.matchId,
        isStar: sm.isStar,
      },
    })
    stars++
  }
  console.log(`  Partidos estrella replicados: ${stars}`)

  console.log('OK.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
