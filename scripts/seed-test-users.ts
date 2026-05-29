import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { hashSync } from 'bcryptjs'
import { config } from 'dotenv'
config({ path: '.env.local' })

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const QUINIELA_ID = 'quiniela-mundial-2026'
const PASSWORD = 'test1234'

const TEST_USERS: Array<{ name: string; email: string; memberStatus: 'ACTIVE' | 'PENDING_APPROVAL' | 'INACTIVE' }> = [
  { name: 'Carlos Méndez',   email: 'carlos.test@kiniela.com',   memberStatus: 'ACTIVE' },
  { name: 'Ana Solano',      email: 'ana.test@kiniela.com',      memberStatus: 'ACTIVE' },
  { name: 'Luis Vargas',     email: 'luis.test@kiniela.com',     memberStatus: 'ACTIVE' },
  { name: 'María Jiménez',   email: 'maria.test@kiniela.com',    memberStatus: 'ACTIVE' },
  { name: 'José Ramírez',    email: 'jose.test@kiniela.com',     memberStatus: 'ACTIVE' },
  { name: 'Sofía Castro',    email: 'sofia.test@kiniela.com',    memberStatus: 'PENDING_APPROVAL' },
  { name: 'Pedro Quirós',    email: 'pedro.test@kiniela.com',    memberStatus: 'INACTIVE' },
]

async function main() {
  const hash = hashSync(PASSWORD, 10)

  for (const u of TEST_USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, status: 'ACTIVE', globalRole: 'USER' },
      create: { name: u.name, email: u.email, passwordHash: hash, status: 'ACTIVE', globalRole: 'USER' },
    })
    const member = await prisma.quinielaMember.upsert({
      where: { quinielaId_userId: { quinielaId: QUINIELA_ID, userId: user.id } },
      update: { status: u.memberStatus, ...(u.memberStatus === 'ACTIVE' ? { approvedAt: new Date() } : {}) },
      create: {
        quinielaId: QUINIELA_ID,
        userId: user.id,
        role: 'PARTICIPANT',
        status: u.memberStatus,
        autoPredictionsEnabled: true,
        ...(u.memberStatus === 'ACTIVE' ? { approvedAt: new Date() } : {}),
      },
    })
    console.log(`${u.name.padEnd(20)} ${u.email.padEnd(35)} ${member.status}`)
  }

  console.log(`\nAll test users password: ${PASSWORD}`)
}
main().catch(console.error).finally(() => prisma.$disconnect())
