import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { compareSync } from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        })

        if (!user) return null
        if (!compareSync(parsed.data.password, user.passwordHash)) return null

        // SUPER_ADMIN can never be locked out: if somehow INACTIVE, auto-reactivate on login.
        if (user.globalRole === 'SUPER_ADMIN') {
          if (user.status !== 'ACTIVE') {
            await prisma.user.update({ where: { id: user.id }, data: { status: 'ACTIVE' } })
          }
        } else if (user.status !== 'ACTIVE') {
          return null
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          globalRole: user.globalRole,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.globalRole = (user as { globalRole?: string }).globalRole
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.globalRole = token.globalRole as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: { strategy: 'jwt', maxAge: 30 * 60 },
})
