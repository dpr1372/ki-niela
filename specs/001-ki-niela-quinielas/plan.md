# Implementation Plan: Ki-Niela — Plataforma de Quinielas Deportivas Recreativas

**Branch**: `001-ki-niela-quinielas` | **Date**: 2026-05-25 | **Spec**: [spec.md](./spec.md)

---

## Summary

Ki-Niela es una PWA responsive multi-evento y multi-quiniela para competencia recreativa de puntos, sin apuestas ni dinero. El stack es Next.js 14+ App Router (full-stack), Prisma ORM sobre PostgreSQL local (`bd_kiniela`), autenticación por correo con NextAuth.js, UI mobile-first con Tailwind CSS y shadcn/ui, zona horaria de negocio `America/Costa_Rica`.

---

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20 LTS

**Primary Dependencies**: Next.js 14+ (App Router), Prisma 5+, PostgreSQL 15+, NextAuth.js v5 (Auth.js), Tailwind CSS 3, shadcn/ui, date-fns-tz, react-hot-toast (o Sonner), Zod

**Storage**: PostgreSQL local, base de datos `bd_kiniela`, conexión por `DATABASE_URL` en `.env.local`

**Testing**: Vitest (unitario), Playwright (e2e)

**Target Platform**: Web, PWA Android, PWA iOS

**Project Type**: Full-stack web application / PWA

**Performance Goals**: Autosave ≤800 ms; respuesta de endpoints leaderboard ≤300 ms p95 en datos locales

**Constraints**: Sin apuestas, pagos ni gambling. `.env.local` en `.gitignore`. No hardcodear credenciales. Backend es fuente de verdad para bloqueo y permisos.

**Scale/Scope**: Grupos recreativos (~10–200 participantes por quiniela), primera implementación FIFA 2026

---

## 1. Arquitectura General

```
┌─────────────────────────────────────────────────────┐
│                   Browser / PWA                     │
│  Next.js App Router (Client Components + RSC)       │
│  Tailwind CSS · shadcn/ui · react-hot-toast         │
└────────────────────┬────────────────────────────────┘
                     │ HTTP / Server Actions
┌────────────────────▼────────────────────────────────┐
│              Next.js Server (Route Handlers)        │
│  /api/auth/**       NextAuth.js v5                  │
│  /api/events/**     Event CRUD                      │
│  /api/quinielas/**  Quiniela + Members + Config     │
│  /api/matches/**    Match CRUD + Results            │
│  /api/predictions/**  Upsert + Privacy              │
│  /api/leaderboard/**  Scores + Rankings             │
│  /api/stats/**      Statistics + Matrix             │
│  /api/jobs/**       Cron jobs (lock/bot/recalc)     │
└────────────────────┬────────────────────────────────┘
                     │ Prisma Client
┌────────────────────▼────────────────────────────────┐
│           PostgreSQL local — bd_kiniela             │
└─────────────────────────────────────────────────────┘
```

**Principios clave**:
- App Router: RSC para data-fetching inicial, Client Components solo donde se necesita interactividad (autosave, switches).
- Server Actions para mutations simples; Route Handlers para APIs que consumen fetch desde el cliente (autosave, jobs).
- Prisma como único punto de acceso a BD; nunca SQL raw excepto en queries de leaderboard complejos.
- El backend siempre revalida bloqueo, permisos y estado de membresía; el frontend solo mejora la UX.

---

## 2. Estructura de Carpetas

```
/home/danielp/repo/app_KI-Niela/
├── .env.local                        # DATABASE_URL, NEXTAUTH_SECRET, SMTP_* (no versionar)
├── .gitignore                        # incluye .env.local
├── next.config.ts
├── tailwind.config.ts
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                       # seed FIFA 2026 equipos/estadios/partidos
├── public/
│   ├── manifest.json                 # PWA manifest
│   ├── icons/                        # App icons PWA
│   └── sw.js                         # Service Worker
├── src/
│   ├── app/
│   │   ├── layout.tsx                # Root layout + ToastProvider
│   │   ├── page.tsx                  # Landing/Login redirect
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── forgot-password/page.tsx
│   │   ├── (app)/                    # Rutas autenticadas
│   │   │   ├── layout.tsx            # Navbar + Bottom Nav móvil
│   │   │   ├── quinielas/
│   │   │   │   └── page.tsx          # Mis Quinielas
│   │   │   └── quinielas/[quinielaId]/
│   │   │       ├── layout.tsx        # Context de quiniela activa
│   │   │       ├── page.tsx          # Dashboard de Quiniela
│   │   │       ├── pronosticos/
│   │   │       │   ├── page.tsx      # Pronósticos por Jornada (tabs)
│   │   │       │   └── [matchId]/page.tsx  # Detalle de Partido
│   │   │       ├── posiciones/page.tsx
│   │   │       ├── estadisticas/page.tsx
│   │   │       ├── juegos/page.tsx
│   │   │       ├── configuracion/page.tsx   # Solo admins
│   │   │       └── participantes/page.tsx   # Solo admins
│   │   ├── admin/                    # Solo SUPER_ADMIN
│   │   │   ├── layout.tsx
│   │   │   ├── eventos/page.tsx
│   │   │   ├── equipos/page.tsx
│   │   │   ├── estadios/page.tsx
│   │   │   ├── partidos/page.tsx
│   │   │   └── usuarios/page.tsx
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── events/
│   │       │   ├── route.ts          # GET /api/events, POST /api/events
│   │       │   └── [eventId]/
│   │       │       ├── route.ts      # GET, PATCH /api/events/:id
│   │       │       ├── quinielas/route.ts
│   │       │       └── matches/route.ts
│   │       ├── quinielas/[quinielaId]/
│   │       │   ├── route.ts          # GET, PATCH
│   │       │   ├── config/route.ts
│   │       │   ├── members/
│   │       │   │   ├── route.ts      # GET members, POST request-access
│   │       │   │   ├── [memberId]/
│   │       │   │   │   ├── activate/route.ts
│   │       │   │   │   ├── deactivate/route.ts
│   │       │   │   │   └── role/route.ts
│   │       │   │   └── me/
│   │       │   │       └── auto-predictions/route.ts
│   │       │   ├── predictions/
│   │       │   │   ├── route.ts      # GET all predictions (post-lock)
│   │       │   │   └── upsert/route.ts  # POST autosave
│   │       │   ├── leaderboard/route.ts
│   │       │   └── stats/
│   │       │       ├── route.ts
│   │       │       └── matrix/route.ts
│   │       ├── matches/[matchId]/
│   │       │   ├── route.ts          # GET, PATCH match
│   │       │   └── result/route.ts   # PATCH official result → triggers recalc
│   │       └── jobs/
│   │           ├── lock-matches/route.ts
│   │           ├── generate-random-predictions/route.ts
│   │           └── recalculate-scores/route.ts
│   ├── components/
│   │   ├── ui/                       # shadcn/ui components
│   │   ├── layout/
│   │   │   ├── Navbar.tsx
│   │   │   └── BottomNav.tsx
│   │   ├── quiniela/
│   │   │   ├── QuinielaCard.tsx
│   │   │   ├── MatchCard.tsx
│   │   │   ├── PredictionInput.tsx   # Autosave input con debounce
│   │   │   ├── Leaderboard.tsx
│   │   │   ├── PredictionMatrix.tsx
│   │   │   └── StarBadge.tsx
│   │   └── common/
│   │       ├── AutosaveStatus.tsx
│   │       └── ToastProvider.tsx
│   ├── lib/
│   │   ├── prisma.ts                 # Singleton PrismaClient
│   │   ├── auth.ts                   # NextAuth config
│   │   ├── timezone.ts               # Helpers UTC ↔ America/Costa_Rica
│   │   ├── scoring.ts                # Lógica de puntuación pura (testeable)
│   │   ├── lock.ts                   # Lógica de bloqueo (isMatchLocked)
│   │   └── validations/
│   │       ├── prediction.ts         # Zod schemas
│   │       └── quiniela.ts
│   ├── hooks/
│   │   ├── useAutosave.ts            # debounce + fetch upsert
│   │   └── useQuinielaContext.ts
│   └── types/
│       └── index.ts                  # Tipos derivados de Prisma + custom
├── specs/
│   └── 001-ki-niela-quinielas/
│       ├── spec.md
│       ├── plan.md                   # Este archivo
│       └── checklists/
│           └── requirements.md
└── tests/
    ├── unit/
    │   ├── scoring.test.ts
    │   └── lock.test.ts
    └── e2e/
        ├── auth.spec.ts
        └── predictions.spec.ts
```

---

## 3. Modelo Prisma Completo

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum GlobalRole {
  SUPER_ADMIN
  USER
}

enum UserStatus {
  ACTIVE
  INACTIVE
}

enum QuinielaVisibility {
  PUBLIC
  PRIVATE
  INVITE_ONLY
}

enum QuinielaStatus {
  ACTIVE
  CLOSED
  ARCHIVED
}

enum MemberRole {
  QUINIELA_ADMIN
  PARTICIPANT
}

enum MemberStatus {
  INVITED
  PENDING_APPROVAL
  ACTIVE
  INACTIVE
  REJECTED
}

enum MatchPhase {
  GROUPS
  ROUND_OF_16
  QUARTER_FINAL
  SEMI_FINAL
  THIRD_PLACE
  FINAL
}

enum MatchStatus {
  PROGRAMADO
  BLOQUEADO
  EN_JUEGO
  MEDIO_TIEMPO
  TIEMPO_EXTRA
  PENALES
  FINALIZADO
  POSTERGADO
  CANCELADO
}

model User {
  id           String     @id @default(cuid())
  name         String
  email        String     @unique
  passwordHash String
  globalRole   GlobalRole @default(USER)
  status       UserStatus @default(ACTIVE)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  members      QuinielaMember[]
  predictions  Prediction[]
  scores       Score[]
  auditLogs    AuditLog[]
  createdQuinielas Quiniela[] @relation("QuinielaCreator")
}

model Event {
  id          String   @id @default(cuid())
  name        String
  description String?
  sport       String   @default("football")
  startDate   DateTime
  endDate     DateTime
  timezone    String   @default("America/Costa_Rica")
  status      String   @default("ACTIVE")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  quinielas   Quiniela[]
  teams       Team[]
  stadiums    Stadium[]
  matchdays   Matchday[]
  matches     Match[]
}

model Quiniela {
  id                     String             @id @default(cuid())
  eventId                String
  name                   String
  description            String?
  visibility             QuinielaVisibility @default(PUBLIC)
  status                 QuinielaStatus     @default(ACTIVE)
  randomPredictionsEnabled Boolean          @default(true)
  randomMinGoals         Int                @default(0)
  randomMaxGoals         Int                @default(7)
  lockMinutesBeforeMatch Int                @default(10)
  timezone               String             @default("America/Costa_Rica")
  inviteCode             String?            @unique
  createdByUserId        String
  createdAt              DateTime           @default(now())
  updatedAt              DateTime           @updatedAt

  event        Event            @relation(fields: [eventId], references: [id])
  createdBy    User             @relation("QuinielaCreator", fields: [createdByUserId], references: [id])
  members      QuinielaMember[]
  predictions  Prediction[]
  scores       Score[]
  starMatches  QuinielaStarMatch[]
}

model QuinielaMember {
  id                  String       @id @default(cuid())
  quinielaId          String
  userId              String
  role                MemberRole   @default(PARTICIPANT)
  status              MemberStatus @default(PENDING_APPROVAL)
  autoPredictionsEnabled Boolean   @default(true)
  joinedAt            DateTime     @default(now())
  approvedAt          DateTime?
  approvedByUserId    String?
  deactivatedAt       DateTime?
  deactivatedByUserId String?
  createdAt           DateTime     @default(now())
  updatedAt           DateTime     @updatedAt

  quiniela   Quiniela @relation(fields: [quinielaId], references: [id])
  user       User     @relation(fields: [userId], references: [id])

  @@unique([quinielaId, userId])
}

model Team {
  id        String   @id @default(cuid())
  eventId   String
  name      String
  fifaCode  String
  flagUrl   String?
  groupCode String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  event          Event   @relation(fields: [eventId], references: [id])
  homeMatches    Match[] @relation("HomeTeam")
  awayMatches    Match[] @relation("AwayTeam")
  wonMatches     Match[] @relation("WinnerTeam")
}

model Stadium {
  id        String   @id @default(cuid())
  eventId   String
  name      String
  city      String
  country   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  event   Event   @relation(fields: [eventId], references: [id])
  matches Match[]
}

model Matchday {
  id        String   @id @default(cuid())
  eventId   String
  name      String
  number    Int
  phase     MatchPhase
  startDate DateTime?
  endDate   DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  event   Event   @relation(fields: [eventId], references: [id])
  matches Match[]
}

model Match {
  id                   String      @id @default(cuid())
  eventId              String
  homeTeamId           String?
  awayTeamId           String?
  placeholderHomeName  String?     // "Ganador Grupo A"
  placeholderAwayName  String?     // "Segundo Grupo B"
  stadiumId            String?
  matchdayId           String?
  phase                MatchPhase
  groupCode            String?
  kickoffAtUtc         DateTime
  kickoffAtCostaRica   DateTime    // Denormalizado para display
  status               MatchStatus @default(PROGRAMADO)
  liveHomeGoals        Int?
  liveAwayGoals        Int?
  officialHomeGoals    Int?
  officialAwayGoals    Int?
  penaltyHomeGoals     Int?
  penaltyAwayGoals     Int?
  winnerTeamId         String?
  wentToExtraTime      Boolean     @default(false)
  wentToPenalties      Boolean     @default(false)
  liveUpdatedAt        DateTime?
  resultConfirmedAt    DateTime?
  createdAt            DateTime    @default(now())
  updatedAt            DateTime    @updatedAt

  event       Event      @relation(fields: [eventId], references: [id])
  homeTeam    Team?      @relation("HomeTeam", fields: [homeTeamId], references: [id])
  awayTeam    Team?      @relation("AwayTeam", fields: [awayTeamId], references: [id])
  stadium     Stadium?   @relation(fields: [stadiumId], references: [id])
  matchday    Matchday?  @relation(fields: [matchdayId], references: [id])
  winnerTeam  Team?      @relation("WinnerTeam", fields: [winnerTeamId], references: [id])
  predictions Prediction[]
  scores      Score[]
  starMatches QuinielaStarMatch[]
}

model QuinielaStarMatch {
  id         String   @id @default(cuid())
  quinielaId String
  matchId    String
  isStar     Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  quiniela Quiniela @relation(fields: [quinielaId], references: [id])
  match    Match    @relation(fields: [matchId], references: [id])

  @@unique([quinielaId, matchId])
}

model Prediction {
  id                  String    @id @default(cuid())
  quinielaId          String
  eventId             String
  userId              String
  matchId             String
  predictedHomeGoals  Int
  predictedAwayGoals  Int
  generatedByBot      Boolean   @default(false)
  lockedAt            DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  quiniela Quiniela @relation(fields: [quinielaId], references: [id])
  user     User     @relation(fields: [userId], references: [id])
  match    Match    @relation(fields: [matchId], references: [id])
  score    Score?

  @@unique([quinielaId, userId, matchId])
}

model Score {
  id           String   @id @default(cuid())
  quinielaId   String
  eventId      String
  userId       String
  matchId      String
  predictionId String   @unique
  points       Int
  reason       String   // "Marcador exacto" | "Ganador correcto" | "Empate correcto" | "Sin acierto"
  isStarMatch  Boolean  @default(false)
  calculatedAt DateTime @default(now())

  quiniela   Quiniela   @relation(fields: [quinielaId], references: [id])
  user       User       @relation(fields: [userId], references: [id])
  match      Match      @relation(fields: [matchId], references: [id])
  prediction Prediction @relation(fields: [predictionId], references: [id])

  @@unique([quinielaId, userId, matchId])
}

model AuditLog {
  id          String   @id @default(cuid())
  actorUserId String?
  action      String
  entityType  String
  entityId    String
  oldValue    Json?
  newValue    Json?
  createdAt   DateTime @default(now())

  actor User? @relation(fields: [actorUserId], references: [id])
}
```

---

## 4. Relaciones Clave entre Entidades

```
User ──< QuinielaMember >── Quiniela ──< Event
                                   │
                           ┌───────┴──────────┐
                           │                  │
                    QuinielaStarMatch       Prediction ──< Score
                           │                  │
                         Match ──────────────>┘
                           │
                    Matchday / Team / Stadium
```

- **User ↔ Quiniela** siempre a través de `QuinielaMember`. La membresía es la fuente de verdad para permisos.
- **Prediction** tiene unique `(quinielaId, userId, matchId)` — garantiza que dos quinielas del mismo evento tienen predicciones separadas.
- **Score** tiene unique `(quinielaId, userId, matchId)` — alineado con Prediction.
- **QuinielaStarMatch** es por quiniela — el mismo partido puede ser estrella en una quiniela y no en otra.
- `Match.phase = FINAL` siempre crea `QuinielaStarMatch` con `isStar=true` al crear o unirse a una quiniela; el backend rechaza intentos de desmarcarla.

---

## 5. Estrategia de Autenticación

**Librería**: NextAuth.js v5 (Auth.js) con `CredentialsProvider`.

```typescript
// src/lib/auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });
        if (!user || user.status !== "ACTIVE") return null;
        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!valid) return null;
        return { id: user.id, name: user.name, email: user.email, globalRole: user.globalRole };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.globalRole = (user as any).globalRole;
      return token;
    },
    session({ session, token }) {
      session.user.globalRole = token.globalRole as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});
```

**Recuperación de contraseña**: Envío de token por correo (SMTP configurado en `.env.local`). Token JWT de un solo uso con expiración 1h almacenado en tabla `PasswordResetToken` (o usar JWT firmado sin BD).

---

## 6. Estrategia de Autorización por Rol Global

Middleware Next.js + helper de sesión:

```typescript
// src/middleware.ts
import { auth } from "@/lib/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (!req.auth && !pathname.startsWith("/(auth)")) {
    return Response.redirect(new URL("/login", req.url));
  }
  if (pathname.startsWith("/admin") && req.auth?.user?.globalRole !== "SUPER_ADMIN") {
    return Response.redirect(new URL("/quinielas", req.url));
  }
});

export const config = { matcher: ["/((?!api|_next|fonts|icons).*)"] };
```

En Route Handlers, el primer check es siempre:
```typescript
const session = await auth();
if (!session) return new Response("Unauthorized", { status: 401 });
```

---

## 7. Estrategia de Autorización por Rol dentro de Quiniela

Helper centralizado reutilizable:

```typescript
// src/lib/quiniela-auth.ts
import { prisma } from "./prisma";

export async function requireQuinielaMember(
  quinielaId: string,
  userId: string,
  requiredStatus: "ACTIVE" | null = "ACTIVE"
) {
  const member = await prisma.quinielaMember.findUnique({
    where: { quinielaId_userId: { quinielaId, userId } },
  });
  if (!member) throw new Error("NOT_MEMBER");
  if (requiredStatus && member.status !== requiredStatus) {
    throw new Error(`MEMBER_STATUS_${member.status}`);
  }
  return member;
}

export async function requireQuinielaAdmin(quinielaId: string, userId: string) {
  const member = await requireQuinielaMember(quinielaId, userId, "ACTIVE");
  if (member.role !== "QUINIELA_ADMIN") throw new Error("NOT_ADMIN");
  return member;
}
```

En cada Route Handler de quiniela se llama este helper antes de cualquier mutación. Los errores se mapean a respuestas HTTP con mensajes de toast.

---

## 8. Flujo de Registro y Solicitud de Acceso a Quiniela

```
1. POST /api/auth/register
   - Validar email único, hash contraseña con bcrypt (cost 12)
   - Crear User con globalRole=USER, status=ACTIVE
   - NO crear QuinielaMember

2. Usuario ve pantalla "Mis Quinielas"
   - GET /api/events → lista de eventos con quinielas públicas/disponibles

3. POST /api/quinielas/:quinielaId/members/request-access
   - Validar que user no tenga ya QuinielaMember en esa quiniela
   - Si quiniela tiene inviteCode y el usuario lo proveyó → crear con PENDING_APPROVAL
   - Si quiniela es PUBLIC → crear con PENDING_APPROVAL
   - Si quiniela es INVITE_ONLY y no tiene código → rechazar
   - Crear QuinielaMember { status: PENDING_APPROVAL, role: PARTICIPANT }
   - Notificar al QUINIELA_ADMIN (futuro: email/push; v1: solo DB)

4. Usuario ve mensaje "Tu usuario está pendiente de activación por el administrador."
```

---

## 9. Flujo de Aprobación de Participantes

```
QUINIELA_ADMIN en pantalla "Participantes":

GET /api/quinielas/:quinielaId/members?status=PENDING_APPROVAL
→ Lista de usuarios pendientes

PATCH /api/quinielas/:quinielaId/members/:memberId/activate
→ Validar que caller es QUINIELA_ADMIN con status=ACTIVE
→ UPDATE QuinielaMember SET status=ACTIVE, approvedAt=now(), approvedByUserId=caller
→ Toast "Usuario activado."
→ AuditLog { action: "MEMBER_ACTIVATED", ... }

PATCH /api/quinielas/:quinielaId/members/:memberId/deactivate
→ UPDATE QuinielaMember SET status=INACTIVE, deactivatedAt=now(), deactivatedByUserId=caller
→ Toast "Usuario desactivado."

PATCH /api/quinielas/:quinielaId/members/:memberId/role
→ Validar body { role: "QUINIELA_ADMIN" | "PARTICIPANT" }
→ UPDATE QuinielaMember SET role=newRole
→ Toast "Rol actualizado."
```

---

## 10. Validaciones por Estado de Membresía

En cada Route Handler de predicciones/config personal, después de autenticar session:

```typescript
const member = await prisma.quinielaMember.findUnique({
  where: { quinielaId_userId: { quinielaId, userId: session.user.id } },
});

switch (member?.status) {
  case undefined:
  case null:
    return Response.json({ error: "NOT_MEMBER" }, { status: 403 });
  case "PENDING_APPROVAL":
  case "INVITED":
    return Response.json(
      { error: "Tu usuario aún no está activo en esta quiniela." },
      { status: 403 }
    );
  case "INACTIVE":
  case "REJECTED":
    return Response.json(
      { error: "Tu usuario aún no está activo en esta quiniela." },
      { status: 403 }
    );
  case "ACTIVE":
    break; // continuar
}
```

---

## 11. Server Actions y Route Handlers

**Server Actions** (mutations simples con revalidación de caché):
- `activateMember(quinielaId, memberId)` → revalidatePath de participantes
- `toggleRandomPredictions(quinielaId, enabled)` → revalidatePath config
- `updateQuinielaConfig(quinielaId, data)` → revalidatePath config

**Route Handlers** (consumidos por fetch desde cliente para autosave y jobs):
- `POST /api/quinielas/:id/predictions/upsert` — autosave (requiere respuesta rápida sin cache)
- `POST /api/jobs/*` — jobs (invocados por scheduler externo)
- Todos los `GET` de leaderboard/stats con filtros dinámicos

---

## 12. Endpoints API Completos

```
# Eventos
GET    /api/events
POST   /api/events                          [SUPER_ADMIN]
GET    /api/events/:eventId
PATCH  /api/events/:eventId                 [SUPER_ADMIN]

# Quinielas
GET    /api/events/:eventId/quinielas
POST   /api/events/:eventId/quinielas       [USER autenticado]
GET    /api/quinielas/:quinielaId
PATCH  /api/quinielas/:quinielaId           [QUINIELA_ADMIN]
GET    /api/quinielas/:quinielaId/config
PATCH  /api/quinielas/:quinielaId/config    [QUINIELA_ADMIN]

# Miembros
GET    /api/quinielas/:quinielaId/members
POST   /api/quinielas/:quinielaId/members/request-access
PATCH  /api/quinielas/:quinielaId/members/:memberId/activate    [QUINIELA_ADMIN]
PATCH  /api/quinielas/:quinielaId/members/:memberId/deactivate  [QUINIELA_ADMIN]
PATCH  /api/quinielas/:quinielaId/members/:memberId/role        [QUINIELA_ADMIN]
PATCH  /api/quinielas/:quinielaId/members/me/auto-predictions   [propio usuario ACTIVE]

# Partidos
GET    /api/events/:eventId/matches
POST   /api/events/:eventId/matches         [SUPER_ADMIN]
GET    /api/matches/:matchId
PATCH  /api/matches/:matchId                [SUPER_ADMIN]
PATCH  /api/matches/:matchId/result         [SUPER_ADMIN] → triggers recalcScore

# Predicciones
GET    /api/quinielas/:quinielaId/predictions              [ACTIVE member, respeta privacidad]
POST   /api/quinielas/:quinielaId/predictions/upsert       [ACTIVE member, valida bloqueo]
GET    /api/quinielas/:quinielaId/matches/:matchId/predictions [post-lock: todos; pre-lock: solo propio]

# Posiciones
GET    /api/quinielas/:quinielaId/leaderboard
       ?scope=general|matchday&matchdayId=:id|phase&phase=:phase

# Estadísticas
GET    /api/quinielas/:quinielaId/stats
GET    /api/quinielas/:quinielaId/stats/matrix
GET    /api/quinielas/:quinielaId/live-leaderboard

# Partidos estrella
PATCH  /api/quinielas/:quinielaId/matches/:matchId/star    [QUINIELA_ADMIN]

# Jobs (protegidos por CRON_SECRET en header)
POST   /api/jobs/lock-matches
POST   /api/jobs/generate-random-predictions
POST   /api/jobs/recalculate-scores
```

---

## 13. Estrategia de Autosave con Debounce

```typescript
// src/hooks/useAutosave.ts
import { useCallback, useRef } from "react";

export function useAutosave(quinielaId: string, matchId: string) {
  const timerRef = useRef<NodeJS.Timeout>();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error" | "locked">("idle");

  const save = useCallback(
    (home: number, away: number) => {
      clearTimeout(timerRef.current);
      setStatus("saving");
      timerRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/quinielas/${quinielaId}/predictions/upsert`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ matchId, predictedHomeGoals: home, predictedAwayGoals: away }),
          });
          const data = await res.json();
          if (!res.ok) {
            if (data.error?.includes("bloqueado")) {
              setStatus("locked");
              toast.error("El partido ya está bloqueado.");
            } else if (data.error?.includes("activo")) {
              setStatus("error");
              toast.error("Tu usuario aún no está activo en esta quiniela.");
            } else {
              setStatus("error");
              toast.error("No se pudo guardar el marcador.");
            }
          } else {
            setStatus("saved");
          }
        } catch {
          setStatus("error");
          toast.error("No se pudo guardar el marcador.");
        }
      }, 600); // 600ms debounce
    },
    [quinielaId, matchId]
  );

  return { save, status };
}
```

**Backend** (`POST /api/quinielas/:quinielaId/predictions/upsert`):
1. Autenticar sesión.
2. Validar `QuinielaMember.status === ACTIVE`.
3. Validar que el partido existe y no está bloqueado (`isMatchLocked(match, quiniela.lockMinutesBeforeMatch)`).
4. Validar goles no negativos y numéricos (Zod).
5. `prisma.prediction.upsert({ where: { quinielaId_userId_matchId: ... }, ... })`.
6. Retornar `{ ok: true }`.

---

## 14. Estrategia para Toast Globales

**Librería**: `sonner` (integrada bien con Next.js App Router).

```typescript
// src/app/layout.tsx
import { Toaster } from "sonner";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
```

Uso en componentes:
```typescript
import { toast } from "sonner";
toast.success("Usuario activado.");
toast.error("El partido ya está bloqueado.");
toast.info("Tu usuario está pendiente de activación por el administrador.");
```

Los mensajes exactos en español están definidos como constantes en `src/lib/toast-messages.ts` para evitar duplicación y garantizar consistencia.

---

## 15. Estrategia para Bloqueo de Partidos

```typescript
// src/lib/lock.ts
import { toZonedTime } from "date-fns-tz";

const TZ = "America/Costa_Rica";

export function isMatchLocked(
  kickoffAtUtc: Date,
  lockMinutesBeforeMatch: number
): boolean {
  const lockThresholdUtc = new Date(
    kickoffAtUtc.getTime() - lockMinutesBeforeMatch * 60 * 1000
  );
  return new Date() >= lockThresholdUtc;
}

export function getMatchLockTime(kickoffAtUtc: Date, lockMinutes: number): Date {
  return new Date(kickoffAtUtc.getTime() - lockMinutes * 60 * 1000);
}

export function formatInCostaRica(date: Date): string {
  return toZonedTime(date, TZ).toLocaleString("es-CR", { timeZone: TZ });
}
```

**Job `POST /api/jobs/lock-matches`**:
```
1. Buscar partidos con status=PROGRAMADO y kickoffAtUtc <= now() + lockMinutes (configurable por quiniela)
2. UPDATE Match SET status=BLOQUEADO para cada uno
3. Disparar generate-random-predictions para esos partidos
```

Nota: El job puede invocarse cada 1 minuto desde un cron externo (crontab, Vercel Cron, GitHub Actions) o cada vez que el cliente haga polling al abrir la pantalla de pronósticos.

---

## 16. Estrategia para Jobs Automáticos

Los tres jobs son endpoints HTTP con protección por secret en header:

```typescript
// src/app/api/jobs/lock-matches/route.ts
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  // ... lógica de bloqueo
}
```

**`.env.local`** agrega:
```
CRON_SECRET=<random_string_seguro>
```

**Invocación local** (crontab en el servidor):
```bash
*/1 * * * * curl -X POST http://localhost:3000/api/jobs/lock-matches \
  -H "x-cron-secret: $CRON_SECRET"
```

Los tres jobs se pueden invocar en secuencia: `lock-matches` → `generate-random-predictions` → opcionalmente `recalculate-scores` (aunque el recálculo también se activa al guardar resultados oficiales).

---

## 17. Estrategia para Generar Pronósticos Aleatorios

```typescript
// POST /api/jobs/generate-random-predictions
async function generateBotPredictions(matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || match.status !== "BLOQUEADO") return;

  // Obtener todas las quinielas del evento
  const quinielas = await prisma.quiniela.findMany({
    where: { eventId: match.eventId, status: "ACTIVE", randomPredictionsEnabled: true },
  });

  for (const quiniela of quinielas) {
    // Participantes ACTIVE con autoPredictions activo sin predicción para este partido
    const eligibleMembers = await prisma.quinielaMember.findMany({
      where: {
        quinielaId: quiniela.id,
        status: "ACTIVE",
        autoPredictionsEnabled: true,
        user: {
          predictions: {
            none: { quinielaId: quiniela.id, matchId },
          },
        },
      },
    });

    const predictions = eligibleMembers.map((m) => ({
      quinielaId: quiniela.id,
      eventId: match.eventId,
      userId: m.userId,
      matchId,
      predictedHomeGoals: randomInt(quiniela.randomMinGoals, quiniela.randomMaxGoals),
      predictedAwayGoals: randomInt(quiniela.randomMinGoals, quiniela.randomMaxGoals),
      generatedByBot: true,
      lockedAt: new Date(),
    }));

    // createMany con skipDuplicates respeta unique constraint
    await prisma.prediction.createMany({ data: predictions, skipDuplicates: true });
  }
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
```

---

## 18. Doble Compuerta: randomPredictionsEnabled + autoPredictionsEnabled

La lógica es siempre:

```
Bot genera para (quiniela, partido, participante) si y solo si:
  quiniela.randomPredictionsEnabled === true
  AND member.autoPredictionsEnabled === true
  AND member.status === "ACTIVE"
  AND NO existe Prediction { quinielaId, userId, matchId }
  AND match.status === "BLOQUEADO"
```

Esto se implementa en el job `generate-random-predictions`. El orden importa: si `randomPredictionsEnabled=false` se hace un `continue` inmediato sin iterar miembros. Si `autoPredictionsEnabled=false` se filtra en la query de miembros.

El admin controla `randomPredictionsEnabled`; el participante controla `autoPredictionsEnabled`. Ninguno puede activar el otro.

---

## 19. Estrategia de Cálculo Automático de Puntos

```typescript
// src/lib/scoring.ts — Lógica pura, sin efectos secundarios (testeable)

export type ScoringResult = {
  points: number;
  reason: "Marcador exacto" | "Ganador correcto" | "Empate correcto" | "Sin acierto";
};

export function calculateScore(
  predictedHome: number,
  predictedAway: number,
  officialHome: number,
  officialAway: number,
  isStar: boolean
): ScoringResult {
  const exactMatch = predictedHome === officialHome && predictedAway === officialAway;

  if (exactMatch) {
    return { points: isStar ? 5 : 3, reason: "Marcador exacto" };
  }

  const predictedWinner = getWinner(predictedHome, predictedAway);
  const officialWinner = getWinner(officialHome, officialAway);

  if (predictedWinner === officialWinner) {
    if (officialWinner === "draw") {
      return { points: isStar ? 3 : 1, reason: "Empate correcto" };
    }
    return { points: isStar ? 3 : 1, reason: "Ganador correcto" };
  }

  return { points: 0, reason: "Sin acierto" };
}

function getWinner(home: number, away: number): "home" | "away" | "draw" {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}
```

**Trigger** (`PATCH /api/matches/:matchId/result`):
1. SUPER_ADMIN guarda resultado oficial (`officialHomeGoals`, `officialAwayGoals`, `wentToExtraTime`, `wentToPenalties`, `penaltyHomeGoals`, `penaltyAwayGoals`).
2. `UPDATE Match SET status=FINALIZADO, resultConfirmedAt=now()`.
3. Por cada `Prediction` del partido en todas las quinielas:
   - Obtener `QuinielaStarMatch` para esa quiniela y partido.
   - Llamar `calculateScore(prediction, result, isStar)`.
   - `upsert Score { where: { quinielaId, userId, matchId }, ... }`.
4. Toast "Resultado oficial guardado." y "Puntos recalculados correctamente."

---

## 20. Reglas para Eliminatorias y Penales

```typescript
// En PATCH /api/matches/:matchId/result

function getValidResultForScoring(match: Match): { home: number; away: number } {
  // Si hubo tiempo extra, usar el marcador al final de 120'
  // El marcador oficial (officialHomeGoals, officialAwayGoals) es el de 90' normal
  // o el de 120' si wentToExtraTime=true
  // Los penales nunca cuentan para puntuación
  return {
    home: match.officialHomeGoals!,  // 90' o 120'
    away: match.officialAwayGoals!,
  };
}
```

**Regla crítica**: Si `wentToPenalties=true` y el marcador a 120' es 1-1 (empate):
- El resultado válido para puntuación es `1-1` (empate).
- `winnerTeamId` se establece (quien ganó los penales) para registrar al clasificado, pero NO afecta la puntuación.
- Una predicción `2-1` gana `0 puntos` aunque acertara al equipo clasificado.
- Una predicción `1-1` gana `3 pts` (normal) / `5 pts` (estrella).

---

## 21. Estrategia para Tabla General

```typescript
// GET /api/quinielas/:quinielaId/leaderboard?scope=general

async function getGeneralLeaderboard(quinielaId: string) {
  const scores = await prisma.score.groupBy({
    by: ["userId"],
    where: { quinielaId },
    _sum: { points: true },
    _count: { _all: true },
  });

  // Contar exactos para desempate
  const exactCounts = await prisma.score.groupBy({
    by: ["userId"],
    where: { quinielaId, reason: "Marcador exacto" },
    _count: { _all: true },
  });

  // Solo incluir miembros ACTIVE
  const activeMembers = await prisma.quinielaMember.findMany({
    where: { quinielaId, status: "ACTIVE" },
    include: { user: { select: { id: true, name: true } } },
  });

  return activeMembers
    .map((m) => ({
      userId: m.userId,
      name: m.user.name,
      totalPoints: scores.find((s) => s.userId === m.userId)?._sum.points ?? 0,
      exactCount: exactCounts.find((e) => e.userId === m.userId)?._count._all ?? 0,
    }))
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
      return a.name.localeCompare(b.name); // desempate alfabético
    })
    .map((entry, idx) => ({ ...entry, position: idx + 1 }));
}
```

---

## 22. Estrategia para Tabla por Jornada

Igual que la tabla general pero filtrada por `Match.matchdayId`:

```typescript
// GET /api/quinielas/:quinielaId/leaderboard?scope=matchday&matchdayId=:id
where: { quinielaId, match: { matchdayId: matchdayIdParam } }
```

---

## 23. Estrategia para Tabla por Fase

Filtrada por `Match.phase`:

```typescript
// GET /api/quinielas/:quinielaId/leaderboard?scope=phase&phase=GROUPS
where: { quinielaId, match: { phase: phaseParam } }
```

---

## 24. Estrategia para Matriz de Predicciones

```typescript
// GET /api/quinielas/:quinielaId/stats/matrix

async function getPredictionMatrix(quinielaId: string, userId: string) {
  const now = new Date();

  // Obtener partidos con bloqueo calculado
  const matches = await prisma.match.findMany({
    where: {
      eventId: quiniela.eventId,
      predictions: { some: { quinielaId } },
    },
    include: { homeTeam: true, awayTeam: true, starMatches: { where: { quinielaId } } },
    orderBy: { kickoffAtUtc: "asc" },
  });

  // Solo mostrar predicciones de otros en partidos bloqueados
  const lockedMatchIds = new Set(
    matches
      .filter((m) => isMatchLocked(m.kickoffAtUtc, quiniela.lockMinutesBeforeMatch))
      .map((m) => m.id)
  );

  const predictions = await prisma.prediction.findMany({
    where: {
      quinielaId,
      OR: [
        { userId }, // siempre ver la propia
        { matchId: { in: [...lockedMatchIds] } }, // otros solo en partidos bloqueados
      ],
    },
    include: { score: true },
  });

  return buildMatrix(matches, predictions, activeMembers, lockedMatchIds, userId);
}
```

---

## 25. Estrategia para Privacidad Antes/Después del Bloqueo

La lógica está centralizada en el backend. No se confía en el frontend para esta validación:

```typescript
// Predicciones de otros usuarios:
if (!isMatchLocked(match.kickoffAtUtc, quiniela.lockMinutesBeforeMatch) && prediction.userId !== requestingUserId) {
  return null; // ocultar
}
```

En la vista `Detalle de Partido`:
- Pre-bloqueo: solo se renderiza la predicción propia.
- Post-bloqueo: se renderiza el panel completo de predicciones de todos los miembros.

---

## 26. Estrategia para Integración Futura con Marcadores en Vivo

Se desacopla usando un servicio abstracto:

```typescript
// src/lib/live-scores/provider.ts (interfaz)
export interface LiveScoreProvider {
  getMatchScore(externalMatchId: string): Promise<{ home: number; away: number; status: string } | null>;
}

// src/lib/live-scores/null-provider.ts (v1 — no hace nada)
export class NullLiveScoreProvider implements LiveScoreProvider {
  async getMatchScore() { return null; }
}

// Futura: src/lib/live-scores/api-football-provider.ts
// Futura: src/lib/live-scores/rapid-api-provider.ts
```

El job `sync-live-scores` (futuro) llama al proveedor activo e `UPDATE Match SET liveHomeGoals, liveAwayGoals, status` donde corresponda. El leaderboard "en vivo" se calcula en memoria usando `liveHomeGoals`/`liveAwayGoals` sin persistir en `Score`.

---

## 27. Plan de Pruebas Unitarias

**Archivos**: `tests/unit/`

**Objetivo**: Verificar lógica pura sin I/O.

| Test | Función | Casos |
|------|---------|-------|
| `scoring.test.ts` | `calculateScore` | 9 escenarios del spec (exacto/ganador/empate/sin acierto × normal/estrella × con y sin penales) |
| `lock.test.ts` | `isMatchLocked` | partido 10 min antes = desbloqueado; en el momento exacto = bloqueado; 5 min después = bloqueado |
| `timezone.test.ts` | `formatInCostaRica` | conversión UTC → CR con ejemplos concretos |
| `bot.test.ts` | Doble compuerta bot | todas las combinaciones de `randomPredictionsEnabled` × `autoPredictionsEnabled` × `memberStatus` |

```bash
npx vitest run tests/unit/
```

---

## 28. Plan de Pruebas de Integración

**Objetivo**: Verificar endpoints con BD real (bd_kiniela en test env o bd_kiniela_test).

| Test | Endpoint | Verificaciones |
|------|----------|----------------|
| auth.integration.ts | `POST /api/auth/register` | usuario creado, no miembro de ninguna quiniela |
| predictions.integration.ts | `POST predictions/upsert` | upsert correcto; rechazo si partido bloqueado; rechazo si miembro no ACTIVE |
| scoring.integration.ts | `PATCH /matches/:id/result` | Score creado con puntos correctos para todos los miembros |
| leaderboard.integration.ts | `GET leaderboard` | orden correcto, solo miembros ACTIVE, desempate correcto |
| bot.integration.ts | `POST /api/jobs/generate-random-predictions` | genera para elegibles, no duplica, respeta doble compuerta |

```bash
npx vitest run tests/integration/
```

---

## 29. Plan de Pruebas End-to-End

**Herramienta**: Playwright

**Archivo**: `tests/e2e/`

| Flujo | Acciones | Verificaciones |
|-------|----------|----------------|
| Registro + Login | Registro → login → logout | Redirecciones correctas, toast, sesión destruida |
| Solicitud de acceso | Usuario solicita unirse → ve mensaje pendiente | No puede guardar predicciones |
| Activación | Admin activa usuario | Toast "Usuario activado.", usuario puede predecir |
| Autosave | Escribir marcador → esperar debounce | Estado "Guardado" visible |
| Bloqueo en vivo | Partido pasa a bloqueado → usuario intenta guardar | Toast "El partido ya está bloqueado.", input deshabilitado |
| Puntuación | Admin guarda resultado → revisar tabla | Puntos correctos en leaderboard |

```bash
npx playwright test
```

---

## 30. Recomendación Visual Mobile-First

**Stack UI**: Tailwind CSS 3 + shadcn/ui + Radix UI primitives.

**Layout móvil**:
- Navbar superior fijo: logo Ki-Niela, nombre de quiniela activa, ícono de perfil.
- Bottom nav fijo: Pronósticos | Posiciones | Juegos | Stats | (Configurar si admin).
- Contenido con scroll vertical; padding-bottom para no quedar tapado por el bottom nav.

**Tarjeta de partido**:
```
┌─────────────────────────────────────────┐
│ ⭐ [Bandera] Costa Rica  vs  Brasil [🏴] │
│     Mar 14 Jun · 15:00 CR · Estadio X   │
│  [ 2 ] ─────── : ─────── [ 1 ]          │
│                          💾 Guardado    │
└─────────────────────────────────────────┘
```

**Colores**: Fondo deportivo oscuro (imagen de estadio con overlay). Tarjetas semitransparentes con glass-morphism. Azul/verde para colores de acento. Badge exacto=verde, ganador=azul, empate=amarillo, sin puntos=gris, bot=morado, estrella=naranja.

**Breakpoints**:
- `sm` (≥640px): tarjetas en grid 2 columnas.
- `lg` (≥1024px): layout con sidebar de navegación, tabla amplia.
- Default (<640px): stack vertical, inputs grandes (48px height min para touch).

---

## 31. Plan de Implementación por Fases

### Fase 0 — Setup y Fundamentos (Semana 1)
1. Crear proyecto Next.js en `/home/danielp/repo/app_KI-Niela` (ver comandos §32).
2. Configurar Prisma + `DATABASE_URL` en `.env.local`.
3. Aplicar schema Prisma y verificar conexión.
4. Configurar NextAuth.js v5.
5. Implementar registro, login, logout.
6. Middleware de autenticación.
7. Layout base + Tailwind + shadcn/ui.
8. PWA manifest + service worker básico.

### Fase 1 — Core Multi-quiniela (Semana 2)
1. CRUD de Eventos (SUPER_ADMIN).
2. CRUD de Equipos y Estadios (SUPER_ADMIN).
3. CRUD de Partidos con fases y placeholders (SUPER_ADMIN).
4. Crear y listar Quinielas.
5. Pantalla "Mis Quinielas".
6. Solicitud de acceso + QuinielaMember.
7. Pantalla Participantes (admin activa/desactiva).
8. Toasts de activación.

### Fase 2 — Predicciones y Bloqueo (Semana 3)
1. Pantalla "Pronósticos por Jornada" con tabs.
2. Autosave con debounce.
3. Lógica de bloqueo (`isMatchLocked`).
4. Job `lock-matches`.
5. Privacidad pre/post bloqueo.
6. Partidos estrella + Final siempre estrella.

### Fase 3 — Puntuación y Posiciones (Semana 4)
1. Función `calculateScore` + tests unitarios.
2. `PATCH /api/matches/:id/result` con trigger de recálculo.
3. Pantalla Posiciones (leaderboard general, por jornada, por fase).
4. Tabla provisional "en vivo".

### Fase 4 — Bot y Configuración (Semana 5)
1. Job `generate-random-predictions`.
2. Configuración de quiniela (admin).
3. Switch `autoPredictionsEnabled` (participante).
4. Tests de doble compuerta.

### Fase 5 — Estadísticas y Matriz (Semana 6)
1. Estadísticas generales, por jornada, por fase.
2. Matriz de predicciones con privacidad.
3. Scroll horizontal en móvil con columna fija.
4. Badges de colores.

### Fase 6 — Pulido y QA (Semana 7)
1. Tests e2e con Playwright.
2. Seed completo FIFA 2026 (grupos, estadios, partidos).
3. Administración Global SUPER_ADMIN completa.
4. Auditoría de credenciales (verificar que `.env.local` no está versionado).
5. PWA: offline básico, installable prompt.
6. Revisión de toasts en español (todos los mensajes del spec).

---

## 32. Comandos para Crear el Proyecto

```bash
# 1. Crear proyecto Next.js (desde el directorio padre)
cd /home/danielp/repo
npx create-next-app@latest app_KI-Niela \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-eslint

cd app_KI-Niela

# 2. Instalar dependencias principales
npm install prisma @prisma/client
npm install next-auth@beta          # Auth.js v5
npm install bcryptjs @types/bcryptjs
npm install date-fns date-fns-tz
npm install sonner                  # Toasts
npm install zod
npm install @radix-ui/react-switch @radix-ui/react-tabs  # shadcn primitives

# 3. Instalar shadcn/ui
npx shadcn@latest init
# Seleccionar: TypeScript, Tailwind CSS, app router, src/components/ui

# Agregar componentes shadcn útiles
npx shadcn@latest add button card input label switch tabs badge toast

# 4. Inicializar Prisma
npx prisma init --datasource-provider postgresql

# 5. Crear .env.local (NO .env) con las credenciales locales
cat > .env.local << 'EOF'
DATABASE_URL="postgresql://postgres:<PASSWORD_LOCAL>@localhost:5432/bd_kiniela?schema=public"
NEXTAUTH_SECRET="<genera_con: openssl rand -base64 32>"
NEXTAUTH_URL="http://localhost:3000"
CRON_SECRET="<genera_con: openssl rand -base64 32>"
# SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS para recuperación de contraseña
EOF

# IMPORTANTE: Reemplazar <PASSWORD_LOCAL> con la clave real de PostgreSQL local
# IMPORTANTE: Generar NEXTAUTH_SECRET y CRON_SECRET únicos

# 6. Verificar que .gitignore incluye .env.local
grep ".env.local" .gitignore || echo ".env.local" >> .gitignore

# 7. Copiar schema.prisma (ver sección 3 de este plan)
# Editar prisma/schema.prisma con el modelo completo

# 8. Verificar .gitignore está correctamente configurado
git status --short  # .env.local NO debe aparecer como tracked
```

---

## 33. Comandos para Validar Conexión con Prisma

```bash
# Asegurarse de estar en el directorio del proyecto
cd /home/danielp/repo/app_KI-Niela

# 1. Introspeccionar la base de datos existente bd_kiniela
#    (genera schema.prisma desde las tablas actuales si ya existen)
npx prisma db pull

# 2. Crear y aplicar migraciones desde el schema.prisma definido
#    (usar cuando el schema es nuevo o tiene cambios)
npx prisma migrate dev --name "initial_schema"

# 3. Abrir Prisma Studio para inspeccionar los datos visualmente
npx prisma studio
# Abre http://localhost:5555

# 4. Generar el cliente Prisma (normalmente automático post-migrate)
npx prisma generate

# 5. Correr el seed inicial (FIFA 2026 data)
npx prisma db seed
# Requiere: "prisma": { "seed": "ts-node prisma/seed.ts" } en package.json
# O usar: npx tsx prisma/seed.ts
```

---

## Notas Importantes

1. **Seguridad de credenciales**: `DATABASE_URL` y todos los secrets van únicamente en `.env.local`. Este archivo está en `.gitignore`. Nunca agregar credenciales a ningún archivo versionado.

2. **Sin gambling**: No existe en este proyecto ningún campo, endpoint, UI o lógica relacionada con apuestas, pagos, créditos o dinero. La puntuación es puramente recreativa.

3. **IP de terceros**: La referencia visual a "Quineliando" es solo de UX (layout, flujo de pantallas). No se copia ningún logo, código, imagen, marca, texto ni asset de esa aplicación. Todos los componentes UI se construyen desde cero con shadcn/ui y Tailwind.

4. **Aislamiento por quiniela**: La clave `quinielaId` aparece en `Prediction`, `Score` y `QuinielaStarMatch`. Toda query de predicciones, scores y posiciones debe incluir `where: { quinielaId }` para garantizar aislamiento total.

5. **Backend como fuente de verdad**: Todas las validaciones de bloqueo, permisos de membresía y cálculo de puntos se ejecutan en el servidor. El frontend solo mejora la UX (deshabilitar inputs, mostrar estados), pero nunca es la última línea de defensa.
