import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Paths that bypass the session-cookie redirect.
// /api/jobs/* is protected by x-cron-secret header (checked inside each route),
// not by an interactive session — so the middleware must not redirect those
// to /login. Same applies to the public health endpoint.
const publicPaths = [
  '/login',
  '/register',
  '/forgot-password',
  '/api/auth',
  '/api/jobs',
  '/api/health',
]

export default auth((req: NextRequest & { auth: unknown }) => {
  const { pathname } = req.nextUrl
  const isPublic = publicPaths.some((p) => pathname.startsWith(p))

  if (!req.auth && !isPublic) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
