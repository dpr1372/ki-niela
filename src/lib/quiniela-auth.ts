import { prisma } from '@/lib/prisma'
import type { MemberRole, MemberStatus } from '@prisma/client'

export type MemberContext = {
  id: string
  userId: string
  quinielaId: string
  role: MemberRole
  status: MemberStatus
  autoPredictionsEnabled: boolean
  // Rol global del usuario. Un SUPER_ADMIN administra CUALQUIER quiniela aunque
  // no sea miembro (isMember=false) o sea solo PARTICIPANT.
  globalRole: 'SUPER_ADMIN' | 'USER'
  isMember: boolean
}

export async function getMemberContext(
  quinielaId: string,
  userId: string,
): Promise<MemberContext | null> {
  // Leemos en paralelo la membresía (si existe) y el rol global del usuario.
  const [member, user] = await Promise.all([
    prisma.quinielaMember.findUnique({
      where: { quinielaId_userId: { quinielaId, userId } },
      select: {
        id: true,
        userId: true,
        quinielaId: true,
        role: true,
        status: true,
        autoPredictionsEnabled: true,
      },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { globalRole: true } }),
  ])

  if (!user) return null
  const globalRole = user.globalRole as 'SUPER_ADMIN' | 'USER'

  if (member) {
    return { ...member, globalRole, isMember: true }
  }

  // SUPER_ADMIN sin fila de membresía: contexto sintético para que pueda
  // administrar la quiniela. Usuario normal sin membresía → null (no pertenece).
  if (globalRole === 'SUPER_ADMIN') {
    return {
      id: '',
      userId,
      quinielaId,
      role: 'QUINIELA_ADMIN',
      status: 'ACTIVE',
      autoPredictionsEnabled: false,
      globalRole,
      isMember: false,
    }
  }
  return null
}

export function isAdminOf(member: MemberContext | null): boolean {
  if (!member) return false
  if (member.globalRole === 'SUPER_ADMIN') return true
  return member.role === 'QUINIELA_ADMIN' && member.status === 'ACTIVE'
}

export function isActiveMember(member: MemberContext | null): boolean {
  if (!member) return false
  if (member.globalRole === 'SUPER_ADMIN') return true
  return member.status === 'ACTIVE'
}

// Filter used wherever we list "players" of a quiniela:
// active members whose role is PARTICIPANT. Quiniela admins are excluded
// from leaderboards, live profiles, prediction matrix, member counts, and
// auto-bot generation, even when they are ACTIVE.
export const PLAYER_MEMBER_FILTER = {
  status: 'ACTIVE',
  role: 'PARTICIPANT',
} as const
