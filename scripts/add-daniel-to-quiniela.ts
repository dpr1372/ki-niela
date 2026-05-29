import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { config } from 'dotenv'
config({ path: '.env.local' })

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'daniel.cr031288@gmail.com' } })
  if (!user) { console.log('user not found'); return }

  const admin = await prisma.user.findUnique({ where: { email: 'admin@kiniela.com' } })

  const member = await prisma.quinielaMember.upsert({
    where: { quinielaId_userId: { quinielaId: 'quiniela-mundial-2026', userId: user.id } },
    update: { status: 'ACTIVE', approvedAt: new Date(), approvedByUserId: admin?.id },
    create: {
      quinielaId: 'quiniela-mundial-2026',
      userId: user.id,
      role: 'PARTICIPANT',
      status: 'ACTIVE',
      autoPredictionsEnabled: true,
      approvedAt: new Date(),
      approvedByUserId: admin?.id,
    },
  })
  console.log('MEMBER:', member)
}
main().finally(() => prisma.$disconnect())
