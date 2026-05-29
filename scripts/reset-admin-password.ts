import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { hashSync } from 'bcryptjs'
import { config } from 'dotenv'
config({ path: '.env.local' })

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const passwordHash = hashSync('cisco1372', 10)
  const updated = await prisma.user.update({
    where: { email: 'admin@kiniela.com' },
    data: { passwordHash, status: 'ACTIVE', globalRole: 'SUPER_ADMIN' },
    select: { id: true, email: true, globalRole: true, status: true },
  })
  console.log('Password reset:', updated)
}
main().finally(() => prisma.$disconnect())
