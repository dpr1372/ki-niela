import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { config } from 'dotenv'
config({ path: '.env.local' })

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'admin@kiniela.com' } })
  if (!user) { console.log('user not found'); return }
  await prisma.user.update({ where: { id: user.id }, data: { status: 'ACTIVE' } })
  const updated = await prisma.quinielaMember.updateMany({
    where: { userId: user.id },
    data: { status: 'ACTIVE', approvedAt: new Date(), approvedByUserId: user.id },
  })
  console.log('User ACTIVE; members updated:', updated.count)
}
main().finally(() => prisma.$disconnect())
