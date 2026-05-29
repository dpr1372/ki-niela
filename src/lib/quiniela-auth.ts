import { prisma } from '@/lib/prisma'
import type { MemberRole, MemberStatus } from '@prisma/client'

export type MemberContext = {
  id: string
  userId: string
  quinielaId: string
  role: MemberRole
  status: MemberStatus
  autoPredictionsEnabled: boolean
}

export async function getMemberContext(
  quinielaId: string,
  userId: string,
): Promise<MemberContext | null> {
  const member = await prisma.quinielaMember.findUnique({
    where: { quinielaId_userId: { quinielaId, userId } },
    select: {
      id: true,
      userId: true,
      quinielaId: true,
      role: true,
      status: true,
      autoPredictionsEnabled: true,
    },
  })
  return member
}

export function isAdminOf(member: MemberContext | null): boolean {
  return member?.role === 'QUINIELA_ADMIN' && member?.status === 'ACTIVE'
}

export function isActiveMember(member: MemberContext | null): boolean {
  return member?.status === 'ACTIVE'
}

// Filter used wherever we list "players" of a quiniela:
// active members whose role is PARTICIPANT. Quiniela admins are excluded
// from leaderboards, live profiles, prediction matrix, member counts, and
// auto-bot generation, even when they are ACTIVE.
export const PLAYER_MEMBER_FILTER = {
  status: 'ACTIVE',
  role: 'PARTICIPANT',
} as const
