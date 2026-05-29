import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { config } from 'dotenv'
config({ path: '.env.local' })

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'daniel.cr031288@gmail.com' },
    select: { id: true, name: true, email: true, status: true, globalRole: true },
  })
  if (!user) { console.log('user not found'); return }
  console.log('USER:', user)

  const memberships = await prisma.quinielaMember.findMany({
    where: { userId: user.id },
    include: { quiniela: { select: { id: true, name: true, status: true } } },
  })
  console.log('MEMBERSHIPS:', JSON.stringify(memberships, null, 2))

  const quinielas = await prisma.quiniela.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true },
  })
  console.log('ACTIVE QUINIELAS:', quinielas)
}
main().finally(() => prisma.$disconnect())
