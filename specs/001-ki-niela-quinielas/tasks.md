# Tasks: Ki-Niela — Plataforma de Quinielas Deportivas Recreativas

**Input**: [spec.md](./spec.md), [plan.md](./plan.md)

**Branch**: `001-ki-niela-quinielas`

**Organization**: Las tareas están agrupadas por fase. Las fases 1–2 son prerequisitos bloqueantes. Las fases 3–10 pueden avanzar incrementalmente. Los items marcados con `[P]` pueden ejecutarse en paralelo dentro de la misma fase.

---

## Fase 1 — Setup del Proyecto

**Propósito**: Crear el proyecto Next.js, configurar TypeScript, Tailwind, Prisma y las variables de entorno.

**Criterio de completitud de fase**: `npm run dev` levanta en `localhost:3000`, Prisma Studio abre en `:5555` con la BD conectada, `.env.local` existe y NO está en git.

- [ ] T001 Crear proyecto Next.js con App Router, TypeScript, Tailwind y src/
  - **Comando**: `npx create-next-app@latest app_KI-Niela --typescript --tailwind --app --src-dir --import-alias "@/*"`
  - **Directorio**: `/home/danielp/repo/app_KI-Niela`
  - **Criterio**: `npm run dev` levanta sin errores
  - **Dependencias**: ninguna

- [ ] T002 [P] Instalar dependencias principales
  - **Comando**: `npm install prisma @prisma/client next-auth@beta bcryptjs @types/bcryptjs date-fns date-fns-tz sonner zod`
  - **Archivos afectados**: `package.json`
  - **Criterio**: `npm install` termina sin errores; todas las dependencias en `node_modules`
  - **Dependencias**: T001

- [ ] T003 [P] Instalar y configurar shadcn/ui
  - **Comandos**: `npx shadcn@latest init` y agregar: `button card input label switch tabs badge`
  - **Archivos**: `src/components/ui/`, `components.json`, `tailwind.config.ts`
  - **Criterio**: componentes `Button`, `Card`, `Input`, `Switch`, `Tabs`, `Badge` importables sin error
  - **Dependencias**: T001

- [ ] T004 Crear `.env.local` con variables de entorno
  - **Archivo**: `.env.local` (en la raíz del proyecto)
  - **Contenido**:
    ```
    DATABASE_URL="postgresql://postgres:<PASSWORD_LOCAL>@localhost:5432/bd_kiniela?schema=public"
    NEXTAUTH_SECRET="<openssl rand -base64 32>"
    NEXTAUTH_URL="http://localhost:3000"
    CRON_SECRET="<openssl rand -base64 32>"
    ```
  - **IMPORTANTE**: Reemplazar `<PASSWORD_LOCAL>` con la contraseña real de PostgreSQL local. Nunca hardcodear en código versionado.
  - **Criterio**: archivo existe localmente con las 4 variables; NO aparece en `git status`
  - **Dependencias**: T001

- [ ] T005 Verificar y reforzar `.gitignore`
  - **Archivo**: `.gitignore`
  - **Asegurar que incluye**: `.env.local`, `.env*.local`, `node_modules/`, `.next/`
  - **Verificación**: `git status --short` no muestra `.env.local`
  - **Criterio**: `.env.local` no trackeado por git
  - **Dependencias**: T004

- [ ] T006 Inicializar Prisma
  - **Comando**: `npx prisma init --datasource-provider postgresql`
  - **Archivos**: `prisma/schema.prisma` (con `url = env("DATABASE_URL")`)
  - **Criterio**: `prisma/schema.prisma` generado; `DATABASE_URL` leído desde `.env.local`
  - **Dependencias**: T002, T004

- [ ] T007 Configurar estructura de carpetas base
  - **Directorios a crear**:
    - `src/lib/`
    - `src/hooks/`
    - `src/types/`
    - `src/components/layout/`
    - `src/components/quiniela/`
    - `src/components/common/`
    - `tests/unit/`
    - `tests/e2e/`
  - **Archivos**: `src/lib/prisma.ts` (singleton PrismaClient), `src/types/index.ts`
  - **Criterio**: estructura de carpetas creada; `src/lib/prisma.ts` exporta `prisma` singleton
  - **Dependencias**: T001

**Checkpoint Fase 1**: Proyecto Next.js corriendo, Prisma configurado, `.env.local` presente y no versionado.

---

## Fase 2 — Base de Datos y Modelos Prisma

**Propósito**: Definir el schema completo de Prisma, aplicar migraciones y cargar datos iniciales del Mundial 2026.

**Criterio de completitud de fase**: `npx prisma studio` muestra todas las tablas; seed carga equipos y partidos de grupos FIFA 2026.

- [ ] T008 Definir enums en `prisma/schema.prisma`
  - **Enums**: `GlobalRole`, `UserStatus`, `QuinielaVisibility`, `QuinielaStatus`, `MemberRole`, `MemberStatus`, `MatchPhase`, `MatchStatus`
  - **Archivo**: `prisma/schema.prisma`
  - **Criterio**: `npx prisma validate` pasa sin errores
  - **Dependencias**: T006

- [ ] T009 Definir modelos User, Event, Quiniela, QuinielaMember en `prisma/schema.prisma`
  - **Incluir**: todos los campos del plan §3; unique `(quinielaId, userId)` en `QuinielaMember`
  - **Archivo**: `prisma/schema.prisma`
  - **Criterio**: `npx prisma validate` pasa; relaciones User↔QuinielaMember↔Quiniela correctas
  - **Dependencias**: T008

- [ ] T010 [P] Definir modelos Team, Stadium, Matchday en `prisma/schema.prisma`
  - **Incluir**: relaciones con `Event`; `Team.groupCode` nullable
  - **Archivo**: `prisma/schema.prisma`
  - **Criterio**: `npx prisma validate` pasa
  - **Dependencias**: T008

- [ ] T011 Definir modelo Match en `prisma/schema.prisma`
  - **Incluir**: `homeTeamId?`, `awayTeamId?`, `placeholderHomeName?`, `placeholderAwayName?`, `kickoffAtUtc`, `kickoffAtCostaRica`, `status`, campos live/official/penalty, `wentToExtraTime`, `wentToPenalties`, `winnerTeamId?`
  - **Archivo**: `prisma/schema.prisma`
  - **Criterio**: `npx prisma validate` pasa; Team tiene 3 relaciones con Match (home/away/winner)
  - **Dependencias**: T009, T010

- [ ] T012 [P] Definir modelos QuinielaStarMatch, Prediction, Score, AuditLog en `prisma/schema.prisma`
  - **Incluir**: unique `(quinielaId, matchId)` en `QuinielaStarMatch`; unique `(quinielaId, userId, matchId)` en `Prediction` y `Score`; `Score.predictionId @unique`
  - **Archivo**: `prisma/schema.prisma`
  - **Criterio**: `npx prisma validate` pasa con todos los constraints
  - **Dependencias**: T009, T011

- [ ] T013 Crear migración inicial
  - **Comando**: `npx prisma migrate dev --name initial_schema`
  - **Archivos generados**: `prisma/migrations/*/migration.sql`
  - **Criterio**: Todas las tablas creadas en `bd_kiniela`; `npx prisma studio` las muestra
  - **Dependencias**: T012

- [ ] T014 Crear `src/lib/prisma.ts` — singleton PrismaClient
  - **Contenido**: singleton que reutiliza la instancia en dev para evitar hot-reload leaks
  - **Archivo**: `src/lib/prisma.ts`
  - **Criterio**: `import { prisma } from "@/lib/prisma"` funciona desde cualquier route handler
  - **Dependencias**: T007, T013

- [ ] T015 Crear seed FIFA 2026 — equipos y estadios
  - **Archivo**: `prisma/seed.ts`
  - **Contenido**: 48 selecciones participantes con `fifaCode`, `flagUrl` (URL pública), grupos A–L; 16 estadios (México, USA, Canadá) con ciudad y país
  - **Comando**: `npx tsx prisma/seed.ts`
  - **Criterio**: seed carga sin errores; `Team` y `Stadium` visibles en Prisma Studio
  - **Dependencias**: T013

- [ ] T016 Crear seed FIFA 2026 — jornadas y partidos de fase de grupos
  - **Archivo**: `prisma/seed.ts` (continuar)
  - **Contenido**: 48 partidos de grupos con `kickoffAtUtc`, `kickoffAtCostaRica`, estadio, jornada, fase=GROUPS, equipos reales
  - **Criterio**: 48 `Match` en BD con status=PROGRAMADO; fechas en UTC y CR correctas
  - **Dependencias**: T015

- [ ] T017 Crear seed — Quiniela inicial "Ki-Niela Mundial 2026"
  - **Archivo**: `prisma/seed.ts` (continuar)
  - **Contenido**: `Event` "Mundial FIFA 2026", `Quiniela` "Ki-Niela Mundial 2026" con defaults del spec; `QuinielaStarMatch` para la Final con `isStar=true`
  - **Criterio**: Quiniela visible en BD con `randomPredictionsEnabled=true`, `lockMinutesBeforeMatch=10`
  - **Dependencias**: T016

- [ ] T018 Crear `src/lib/timezone.ts` — helpers de zona horaria
  - **Archivo**: `src/lib/timezone.ts`
  - **Exports**: `toCostaRica(date: Date): Date`, `formatCostaRica(date: Date, format: string): string`, `isMatchLocked(kickoffAtUtc: Date, lockMinutes: number): boolean`
  - **Criterio**: tests unitarios en `tests/unit/timezone.test.ts` pasan; conversión UTC→CR correcta
  - **Dependencias**: T002

- [ ] T019 Crear `src/lib/scoring.ts` — lógica pura de puntuación
  - **Archivo**: `src/lib/scoring.ts`
  - **Export**: `calculateScore(predictedHome, predictedAway, officialHome, officialAway, isStar): ScoringResult`
  - **Tests unitarios**: `tests/unit/scoring.test.ts` con los 9 escenarios del spec
  - **Criterio**: 9 escenarios pasan (incluyendo penales en eliminatorias)
  - **Dependencias**: T007

**Checkpoint Fase 2**: BD completa, seed cargado, lógica de puntuación testeada, timezone helpers disponibles.

---

## Fase 3 — Autenticación (US1)

**Propósito**: Registro, login, logout y recuperación de acceso. Es el prerequisito para toda la funcionalidad de usuario.

**Criterio de completitud**: Usuario puede registrarse, iniciar sesión, ver "Mis Quinielas" y cerrar sesión. Las rutas `/quinielas` redirigen a login si no hay sesión.

- [ ] T020 Instalar y configurar NextAuth.js v5 (Auth.js)
  - **Archivo**: `src/lib/auth.ts`
  - **Contenido**: `CredentialsProvider` con `authorize()` que verifica email+bcrypt+status=ACTIVE; callbacks `jwt` y `session` que incluyen `globalRole`
  - **Criterio**: `auth()` retorna sesión válida tras login; token incluye `globalRole`
  - **Dependencias**: T002, T014

- [ ] T021 Crear Route Handler de NextAuth
  - **Archivo**: `src/app/api/auth/[...nextauth]/route.ts`
  - **Contenido**: exporta `{ GET, POST }` desde `handlers` de Auth.js
  - **Criterio**: `GET /api/auth/providers` responde con `credentials`
  - **Dependencias**: T020

- [ ] T022 [P] Crear endpoint de registro
  - **Archivo**: `src/app/api/auth/register/route.ts`
  - **Lógica**: validar con Zod (email, contraseña ≥8 chars, nombre), verificar email único, `bcrypt.hash(password, 12)`, `prisma.user.create`, NO crear QuinielaMember
  - **Criterio**: `POST /api/auth/register` con datos válidos crea User; con email duplicado retorna 400
  - **Dependencias**: T014, T020

- [ ] T023 [P] Crear middleware de autenticación
  - **Archivo**: `src/middleware.ts`
  - **Lógica**: rutas `/(app)/*` requieren sesión; `/admin/*` requiere `globalRole=SUPER_ADMIN`; redirige a `/login` si no autenticado
  - **Criterio**: acceder a `/quinielas` sin sesión redirige a `/login`; acceder a `/admin` como USER redirige a `/quinielas`
  - **Dependencias**: T020

- [ ] T024 Crear página Landing/Login
  - **Archivo**: `src/app/(auth)/login/page.tsx`
  - **Contenido**: formulario email+contraseña, botón login (llama `signIn`), link a registro, nombre "Ki-Niela", descripción breve
  - **Criterio**: login exitoso redirige a `/quinielas`; login fallido muestra error
  - **Dependencias**: T021, T023

- [ ] T025 [P] Crear página de Registro
  - **Archivo**: `src/app/(auth)/register/page.tsx`
  - **Contenido**: formulario nombre+email+contraseña, llama `POST /api/auth/register`, luego `signIn`
  - **Criterio**: registro exitoso redirige a `/quinielas`; email duplicado muestra error
  - **Dependencias**: T022

- [ ] T026 [P] Crear página de Recuperación de Acceso
  - **Archivo**: `src/app/(auth)/forgot-password/page.tsx`, `src/app/api/auth/forgot-password/route.ts`, `src/app/api/auth/reset-password/route.ts`
  - **Lógica**: generar token JWT firmado (1h), enviar email con link, verificar token al reset
  - **Nota**: requiere SMTP_* configurado en `.env.local`; la pantalla puede quedar como "próximamente" en MVP
  - **Criterio**: formulario existe y no rompe el build; lógica SMTP funcional cuando se configure
  - **Dependencias**: T022

- [ ] T027 Crear layout base de la app con ToastProvider y navbar
  - **Archivos**: `src/app/(app)/layout.tsx`, `src/components/layout/Navbar.tsx`, `src/components/layout/BottomNav.tsx`, `src/components/common/ToastProvider.tsx`
  - **Contenido**: Toaster de `sonner` en root layout; Navbar con logo Ki-Niela + nombre quiniela activa + ícono perfil; BottomNav con: Pronósticos | Posiciones | Juegos | Stats | Config (condicional)
  - **Criterio**: layout visible en móvil y desktop; bottom nav visible en viewport < 640px
  - **Dependencias**: T003, T020

**Checkpoint Fase 3 (US1)**: Registro + login + logout funcionales. Rutas protegidas. ToastProvider activo.

---

## Fase 4 — Roles, Permisos y Estados de Participante (US2)

**Propósito**: Implementar el sistema de roles (global + por quiniela), estados de membresía y el flujo de solicitud/activación.

- [ ] T028 Crear helper `src/lib/quiniela-auth.ts`
  - **Archivo**: `src/lib/quiniela-auth.ts`
  - **Exports**: `requireQuinielaMember(quinielaId, userId, requiredStatus?)`, `requireQuinielaAdmin(quinielaId, userId)`
  - **Lógica**: consulta `QuinielaMember`; lanza errores tipados `NOT_MEMBER`, `MEMBER_STATUS_*`, `NOT_ADMIN`
  - **Criterio**: usado en todos los route handlers de quiniela; tests unitarios pasan para cada caso de error
  - **Dependencias**: T014

- [ ] T029 Crear endpoint `POST /api/quinielas/:quinielaId/members/request-access`
  - **Archivo**: `src/app/api/quinielas/[quinielaId]/members/request-access/route.ts`
  - **Lógica**: verificar que usuario no tiene membresía previa; crear `QuinielaMember { status: PENDING_APPROVAL, role: PARTICIPANT }`; si quiniela INVITE_ONLY verificar `inviteCode`
  - **Criterio**: usuario queda `PENDING_APPROVAL`; segundo intento retorna 409 (ya existe)
  - **Dependencias**: T028

- [ ] T030 [P] Crear endpoint `GET /api/quinielas/:quinielaId/members`
  - **Archivo**: `src/app/api/quinielas/[quinielaId]/members/route.ts`
  - **Lógica**: solo para `QUINIELA_ADMIN`; acepta query param `?status=PENDING_APPROVAL|ACTIVE|INACTIVE`
  - **Criterio**: retorna lista filtrada; no-admin recibe 403
  - **Dependencias**: T028

- [ ] T031 Crear endpoint `PATCH /api/quinielas/:quinielaId/members/:memberId/activate`
  - **Archivo**: `src/app/api/quinielas/[quinielaId]/members/[memberId]/activate/route.ts`
  - **Lógica**: requireQuinielaAdmin; `UPDATE status=ACTIVE, approvedAt=now(), approvedByUserId`; AuditLog
  - **Criterio**: status cambia a ACTIVE; toast "Usuario activado." devuelto en response
  - **Dependencias**: T028

- [ ] T032 [P] Crear endpoint `PATCH /api/quinielas/:quinielaId/members/:memberId/deactivate`
  - **Archivo**: `src/app/api/quinielas/[quinielaId]/members/[memberId]/deactivate/route.ts`
  - **Lógica**: requireQuinielaAdmin; `UPDATE status=INACTIVE, deactivatedAt=now()`; AuditLog
  - **Criterio**: toast "Usuario desactivado." devuelto en response
  - **Dependencias**: T028

- [ ] T033 [P] Crear endpoint `PATCH /api/quinielas/:quinielaId/members/:memberId/role`
  - **Archivo**: `src/app/api/quinielas/[quinielaId]/members/[memberId]/role/route.ts`
  - **Lógica**: requireQuinielaAdmin; validar body `{ role: MemberRole }`; `UPDATE role`
  - **Criterio**: toast "Rol actualizado." devuelto; no-admin recibe 403
  - **Dependencias**: T028

- [ ] T034 Crear pantalla "Participantes" (solo QUINIELA_ADMIN)
  - **Archivo**: `src/app/(app)/quinielas/[quinielaId]/participantes/page.tsx`
  - **Contenido**: lista de miembros filtrable por estado; botones Activar/Desactivar/Cambiar Rol; indicador de `autoPredictionsEnabled`; solicitudes pendientes resaltadas
  - **Criterio**: admin puede activar/desactivar con toast correcto; no-admin ve 403
  - **Dependencias**: T030, T031, T032, T033

- [ ] T035 Validar privación de predicciones en backend por estado
  - **Archivo**: `src/app/api/quinielas/[quinielaId]/predictions/upsert/route.ts` (prerequisito)
  - **Lógica**: en el handler de upsert, verificar `member.status === ACTIVE` antes de procesar; retornar `{ error: "Tu usuario aún no está activo en esta quiniela." }` con status 403
  - **Criterio**: usuario PENDING_APPROVAL recibe 403 al intentar guardar predicción
  - **Dependencias**: T028

**Checkpoint Fase 4 (US2)**: Solicitud de acceso → pendiente → activación por admin → usuario puede predecir. Todos los toasts de activación/desactivación funcionan.

---

## Fase 5 — Multi-evento y Multi-quiniela

**Propósito**: CRUD completo de eventos y quinielas, pantalla "Mis Quinielas", navegación contextualizada.

- [ ] T036 [P] Crear endpoints CRUD de Eventos (SUPER_ADMIN)
  - **Archivos**: `src/app/api/events/route.ts`, `src/app/api/events/[eventId]/route.ts`
  - **Endpoints**: `GET /api/events`, `POST /api/events`, `GET /api/events/:id`, `PATCH /api/events/:id`
  - **Criterio**: SUPER_ADMIN puede crear/editar eventos; USER recibe 403 en POST/PATCH
  - **Dependencias**: T023, T014

- [ ] T037 [P] Crear endpoints CRUD de Quinielas
  - **Archivos**: `src/app/api/events/[eventId]/quinielas/route.ts`, `src/app/api/quinielas/[quinielaId]/route.ts`
  - **Endpoints**: `GET /api/events/:eventId/quinielas`, `POST /api/events/:eventId/quinielas`, `GET /api/quinielas/:id`, `PATCH /api/quinielas/:id`
  - **Lógica POST**: usuario autenticado crea quiniela; se convierte en `QUINIELA_ADMIN` con `status=ACTIVE`; genera `inviteCode` único; crea `QuinielaStarMatch` para la Final con `isStar=true`
  - **Criterio**: quiniela creada; creador es QUINIELA_ADMIN; Final siempre tiene QuinielaStarMatch
  - **Dependencias**: T028, T036

- [ ] T038 Crear pantalla "Mis Quinielas"
  - **Archivo**: `src/app/(app)/quinielas/page.tsx`
  - **Contenido**: tarjetas agrupadas por evento; cada tarjeta muestra: nombre evento, nombre quiniela, estado, # participantes activos, estado del usuario, puntos, posición; botones "Entrar" y "Configurar" (si admin)
  - **Criterio**: usuario ve sus quinielas correctamente agrupadas; tarjeta muestra "Pendiente" si status=PENDING_APPROVAL
  - **Dependencias**: T037, T029

- [ ] T039 Crear pantalla Dashboard de Quiniela
  - **Archivo**: `src/app/(app)/quinielas/[quinielaId]/page.tsx`
  - **Contenido**: nombre evento+quiniela, puntos/posición/estado del usuario, próximos partidos, partidos estrella próximos, accesos rápidos a Pronósticos/Posiciones/Juegos/Stats/Config
  - **Criterio**: dashboard visible para miembros ACTIVE; mensaje pendiente para PENDING_APPROVAL
  - **Dependencias**: T037, T028

- [ ] T040 Crear pantalla Configuración de Quiniela (solo QUINIELA_ADMIN)
  - **Archivo**: `src/app/(app)/quinielas/[quinielaId]/configuracion/page.tsx`
  - **Contenido**: campos editables: nombre, visibilidad, estado, código de invitación, `randomPredictionsEnabled` (switch), `randomMinGoals`, `randomMaxGoals`, `lockMinutesBeforeMatch`; guardado via PATCH
  - **Criterio**: no-admin ve 403; switch muestra toast correcto al cambiar
  - **Dependencias**: T037

- [ ] T041 Crear endpoint configuración de quiniela
  - **Archivo**: `src/app/api/quinielas/[quinielaId]/config/route.ts`
  - **Endpoints**: `GET /api/quinielas/:id/config`, `PATCH /api/quinielas/:id/config`
  - **Lógica PATCH**: requireQuinielaAdmin; Zod validation; `prisma.quiniela.update`; toast según campo modificado
  - **Criterio**: cambiar `randomPredictionsEnabled` retorna toast "Pronósticos aleatorios habilitados/deshabilitados"
  - **Dependencias**: T028

- [ ] T042 Crear endpoint `PATCH /api/quinielas/:quinielaId/members/me/auto-predictions`
  - **Archivo**: `src/app/api/quinielas/[quinielaId]/members/me/auto-predictions/route.ts`
  - **Lógica**: solo el propio usuario (session.user.id); verificar member.status=ACTIVE; `UPDATE autoPredictionsEnabled`
  - **Criterio**: usuario cambia su propio autoPredictions; otro usuario no puede cambiar el ajeno (403)
  - **Dependencias**: T028

**Checkpoint Fase 5**: "Mis Quinielas" funcional; crear/unirse a quiniela; configuración admin operativa.

---

## Fase 6 — Equipos, Estadios, Jornadas y Partidos

**Propósito**: CRUD de entidades del torneo, gestión de fases y placeholders de eliminatorias.

- [ ] T043 [P] Crear endpoints CRUD de Equipos, Estadios y Jornadas (SUPER_ADMIN)
  - **Archivos**: `src/app/api/events/[eventId]/teams/route.ts`, `.../stadiums/route.ts`, `.../matchdays/route.ts`
  - **Criterio**: SUPER_ADMIN puede crear/editar; datos del seed accesibles via API
  - **Dependencias**: T036

- [ ] T044 Crear endpoints CRUD de Partidos (SUPER_ADMIN)
  - **Archivos**: `src/app/api/events/[eventId]/matches/route.ts`, `src/app/api/matches/[matchId]/route.ts`
  - **Lógica**: asignar `kickoffAtCostaRica` automáticamente al crear/editar usando `toCostaRica(kickoffAtUtc)`; soportar `placeholderHomeName` y `placeholderAwayName` para eliminatorias
  - **Criterio**: partido creado con ambas fechas (UTC y CR); partidos con placeholder no exponen `homeTeamId`
  - **Dependencias**: T018, T043

- [ ] T045 Crear pantalla "Juegos" (lista de partidos por quiniela)
  - **Archivo**: `src/app/(app)/quinielas/[quinielaId]/juegos/page.tsx`
  - **Contenido**: listado con filtros por fase/jornada/fecha/estado; mostrar estado badge de cada partido; fecha/hora en CR
  - **Criterio**: filtros funcionales; horarios en America/Costa_Rica
  - **Dependencias**: T044, T018

- [ ] T046 Crear pantalla Administración Global (SUPER_ADMIN)
  - **Archivos**: `src/app/admin/eventos/page.tsx`, `.../equipos/page.tsx`, `.../estadios/page.tsx`, `.../partidos/page.tsx`, `.../usuarios/page.tsx`
  - **Criterio**: solo SUPER_ADMIN accede; middleware redirige a otros usuarios
  - **Dependencias**: T043, T044, T023

**Checkpoint Fase 6**: Equipos, estadios, jornadas y partidos gestionables desde admin. Seed FIFA 2026 visible via UI.

---

## Fase 7 — Predicciones, Autosave y Bloqueo (US3, US4)

**Propósito**: Vista de pronósticos, inputs de marcador con autosave, bloqueo individual de partidos.

- [ ] T047 Crear `src/lib/lock.ts` — lógica de bloqueo pura
  - **Archivo**: `src/lib/lock.ts`
  - **Exports**: `isMatchLocked(kickoffAtUtc, lockMinutes)`, `getMatchLockTime(kickoffAtUtc, lockMinutes)`
  - **Tests**: `tests/unit/lock.test.ts` con casos: partido 11 min antes (abierto), 10 min exactos (bloqueado), 5 min antes del inicio (bloqueado)
  - **Criterio**: 3 casos de test pasan
  - **Dependencias**: T018

- [ ] T048 Crear endpoint `POST /api/quinielas/:quinielaId/predictions/upsert` (autosave)
  - **Archivo**: `src/app/api/quinielas/[quinielaId]/predictions/upsert/route.ts`
  - **Lógica**: autenticar → verificar member ACTIVE → cargar quiniela (lockMinutesBeforeMatch) → cargar match → `isMatchLocked` → Zod (goles ≥0, enteros) → `prisma.prediction.upsert` → retornar `{ ok: true }`
  - **Errores tipados**: "El partido ya está bloqueado." (423), "Tu usuario aún no está activo en esta quiniela." (403)
  - **Criterio**: upsert correcto para ACTIVE; 403 para PENDING/INACTIVE; 423 para partido bloqueado
  - **Dependencias**: T035, T047, T044

- [ ] T049 Crear hook `src/hooks/useAutosave.ts`
  - **Archivo**: `src/hooks/useAutosave.ts`
  - **Lógica**: debounce 600ms; `fetch` al endpoint upsert; estados: `idle | saving | saved | error | locked`; manejo de errores con toast específico
  - **Criterio**: escribir marcador → 600ms → estado "saving" → "saved"; error de red → "error"; partido bloqueado → "locked"
  - **Dependencias**: T048

- [ ] T050 Crear `src/components/common/AutosaveStatus.tsx`
  - **Archivo**: `src/components/common/AutosaveStatus.tsx`
  - **Contenido**: muestra íconos/texto según estado: "Guardando..." (spinner), "Guardado" (check), "Error al guardar" (x), "Partido bloqueado" (🔒)
  - **Criterio**: 4 estados visualmente distinguibles; accesible (aria-label)
  - **Dependencias**: T049

- [ ] T051 Crear componente `src/components/quiniela/PredictionInput.tsx`
  - **Archivo**: `src/components/quiniela/PredictionInput.tsx`
  - **Props**: `matchId`, `quinielaId`, `isLocked`, `isActive`, `initialHome?`, `initialAway?`
  - **Comportamiento**: si `isLocked=true` muestra el marcador como read-only; si `isActive=false` muestra mensaje pendiente; inputs solo aceptan enteros ≥0; llama `useAutosave` al cambiar
  - **Criterio**: inputs funcionales; lock deshabilita edición; estado autosave visible
  - **Dependencias**: T049, T050

- [ ] T052 Crear componente `src/components/quiniela/MatchCard.tsx`
  - **Archivo**: `src/components/quiniela/MatchCard.tsx`
  - **Contenido**: banderas/logos equipos (o placeholder), fecha/hora CR, estadio, PredictionInput, ícono estrella, badge de estado del partido
  - **Criterio**: renderiza correctamente para partido con equipos reales y con placeholder
  - **Dependencias**: T051

- [ ] T053 Crear pantalla "Pronósticos por Jornada"
  - **Archivo**: `src/app/(app)/quinielas/[quinielaId]/pronosticos/page.tsx`
  - **Contenido**: tabs dinámicos (General, Inauguración, Día N, Jornada N, Octavos, Cuartos, Semifinales, Final); grid de MatchCards por tab
  - **Criterio**: tabs muestran los partidos correctos; autosave funcional; horarios en CR
  - **Dependencias**: T052, T018

- [ ] T054 Crear endpoint `GET /api/quinielas/:quinielaId/predictions` con privacidad
  - **Archivo**: `src/app/api/quinielas/[quinielaId]/predictions/route.ts`
  - **Lógica**: para cada predicción, si `isMatchLocked(match.kickoffAtUtc, lockMinutes)` → incluir todos los usuarios; si no → solo predicción propia (`userId === session.user.id`)
  - **Criterio**: pre-bloqueo retorna solo predicción propia; post-bloqueo retorna todas
  - **Dependencias**: T047, T048

- [ ] T055 Crear endpoint y pantalla "Detalle de Partido"
  - **Archivos**: `src/app/api/quinielas/[quinielaId]/matches/[matchId]/predictions/route.ts`, `src/app/(app)/quinielas/[quinielaId]/pronosticos/[matchId]/page.tsx`
  - **Contenido**: info del partido, predicción propia, resultado oficial, resultado penal, puntos obtenidos, predicciones de otros (post-bloqueo)
  - **Criterio**: privacidad correcta; puntos obtenidos visibles si el partido está finalizado
  - **Dependencias**: T054

**Checkpoint Fase 7 (US3, US4)**: Autosave funcionando. Bloqueo rechaza predicciones post-lock. Privacidad pre/post bloqueo correcta.

---

## Fase 8 — Jobs Automáticos: Bloqueo y Bot (US7)

**Propósito**: Job de bloqueo de partidos y job de generación de pronósticos automáticos (bot).

- [ ] T056 Crear job `POST /api/jobs/lock-matches`
  - **Archivo**: `src/app/api/jobs/lock-matches/route.ts`
  - **Lógica**: verificar `x-cron-secret`; buscar partidos `status=PROGRAMADO` donde `kickoffAtUtc <= now() + lockMinutes`; `UPDATE status=BLOQUEADO`; retornar IDs de partidos bloqueados
  - **Criterio**: job con secret correcto bloquea partidos en momento correcto; sin secret → 401
  - **Dependencias**: T047, T048

- [ ] T057 Crear job `POST /api/jobs/generate-random-predictions`
  - **Archivo**: `src/app/api/jobs/generate-random-predictions/route.ts`
  - **Lógica**: verificar secret; por cada partido BLOQUEADO → por cada quiniela del evento con `randomPredictionsEnabled=true` → buscar miembros ACTIVE con `autoPredictionsEnabled=true` sin predicción → `prediction.createMany` con goles aleatorios en rango; `skipDuplicates: true`; `generatedByBot=true`; `lockedAt=now()`
  - **Tests unitarios**: `tests/unit/bot.test.ts` con todas las combinaciones de doble compuerta
  - **Criterio**: bot genera solo para elegibles; no duplica; respeta ambas flags; no genera para PENDING/INACTIVE/REJECTED
  - **Dependencias**: T056, T048

- [ ] T058 Crear job `POST /api/jobs/recalculate-scores`
  - **Archivo**: `src/app/api/jobs/recalculate-scores/route.ts`
  - **Lógica**: verificar secret; recalcular todos los `Score` para partidos FINALIZADOS que tengan predicciones sin Score; útil para resincronización
  - **Criterio**: idempotente; no duplica scores ya calculados
  - **Dependencias**: T019, T056

**Checkpoint Fase 8 (US7)**: Jobs de bloqueo y bot funcionando. Doble compuerta verificada con tests.

---

## Fase 9 — Partidos Estrella (US8)

- [ ] T059 Crear endpoint PATCH para marcar/desmarcar partido estrella
  - **Archivo**: `src/app/api/quinielas/[quinielaId]/matches/[matchId]/star/route.ts`
  - **Lógica**: requireQuinielaAdmin; si `match.phase === FINAL` rechazar desmarcar con 400; upsert `QuinielaStarMatch`
  - **Criterio**: Final no se puede desmarcar; otros partidos sí; ícono estrella refleja cambio
  - **Dependencias**: T028, T044

- [ ] T060 Crear componente `src/components/quiniela/StarBadge.tsx`
  - **Archivo**: `src/components/quiniela/StarBadge.tsx`
  - **Contenido**: ícono ⭐ visible en MatchCard, Leaderboard y matriz cuando `isStar=true`
  - **Criterio**: ícono visible; accesible (aria-label "Partido estrella")
  - **Dependencias**: T052

**Checkpoint Fase 9 (US8)**: Partidos estrella marcables desde config admin. Final siempre estrella.

---

## Fase 10 — Puntuación, Posiciones y Resultados Oficiales (US5, US6)

**Propósito**: Registro de resultados, cálculo automático de puntos, leaderboard.

- [ ] T061 Crear endpoint `PATCH /api/matches/:matchId/result`
  - **Archivo**: `src/app/api/matches/[matchId]/result/route.ts`
  - **Lógica**: SUPER_ADMIN; Zod validar: `officialHomeGoals`, `officialAwayGoals`, `wentToExtraTime?`, `wentToPenalties?`, `penaltyHomeGoals?`, `penaltyAwayGoals?`, `winnerTeamId?`; `UPDATE Match SET status=FINALIZADO, resultConfirmedAt=now()`; trigger recálculo de scores
  - **Criterio**: resultado guardado; scores calculados para todos los participantes de todas las quinielas que tienen ese partido
  - **Dependencias**: T019, T059

- [ ] T062 Implementar `recalculateScoresForMatch(matchId)` en `src/lib/scoring.ts`
  - **Archivo**: `src/lib/scoring.ts`
  - **Lógica**: cargar partidos + quinielas + QuinielaStarMatch + predicciones; llamar `calculateScore`; `prisma.score.upsert` para cada (quinielaId, userId, matchId); retornar conteo
  - **Criterio**: scores correctos para los 9 escenarios de test; motivo correcto en `Score.reason`
  - **Dependencias**: T019, T061

- [ ] T063 Crear endpoint `GET /api/quinielas/:quinielaId/leaderboard`
  - **Archivo**: `src/app/api/quinielas/[quinielaId]/leaderboard/route.ts`
  - **Params**: `?scope=general|matchday&matchdayId=id|phase&phase=GROUPS`
  - **Lógica**: `Score.groupBy userId + SUM points`; solo miembros ACTIVE; desempate exactos → alfabético
  - **Criterio**: orden correcto para los 3 scopes; usuarios no-ACTIVE excluidos
  - **Dependencias**: T062, T028

- [ ] T064 Crear pantalla "Posiciones"
  - **Archivo**: `src/app/(app)/quinielas/[quinielaId]/posiciones/page.tsx`
  - **Contenido**: tabla general con posición, nombre, puntos totales, exactos; tabs Jornada/Fase; indicador "Puntos provisionales" si hay partidos en juego
  - **Criterio**: orden correcto; desempates aplicados; tabs funcionales
  - **Dependencias**: T063

- [ ] T065 Crear pantalla admin para registrar resultados oficiales
  - **Archivo**: `src/app/admin/partidos/[matchId]/resultado/page.tsx`
  - **Contenido**: formulario para registrar marcador 90'/120', wentToExtraTime, wentToPenalties, penaltyGoals, winnerTeamId; botón "Guardar resultado"
  - **Criterio**: al guardar → toast "Resultado oficial guardado." + "Puntos recalculados correctamente."
  - **Dependencias**: T061, T062

**Checkpoint Fase 10 (US5, US6)**: Resultados registrables; puntos calculados automáticamente; leaderboard correcto.

---

## Fase 11 — Estadísticas y Matriz de Predicciones (US9)

- [ ] T066 Crear endpoint `GET /api/quinielas/:quinielaId/stats`
  - **Archivo**: `src/app/api/quinielas/[quinielaId]/stats/route.ts`
  - **Params**: filtros por jornada, fase, usuario, estrella, manual/bot, estado del partido
  - **Criterio**: retorna estadísticas correctas con filtros; privacidad respetada
  - **Dependencias**: T063

- [ ] T067 Crear endpoint `GET /api/quinielas/:quinielaId/stats/matrix`
  - **Archivo**: `src/app/api/quinielas/[quinielaId]/stats/matrix/route.ts`
  - **Lógica**: matriz filas=miembros ACTIVE, columnas=partidos; para cada celda: predicción (si hay), puntos (si partido finalizado), badges (exacto/ganador/empate/sin puntos/bot/estrella); aplicar privacidad pre-lock
  - **Criterio**: pre-bloqueo oculta predicciones ajenas; post-bloqueo las muestra; badges correctos
  - **Dependencias**: T066, T047

- [ ] T068 Crear componente `src/components/quiniela/PredictionMatrix.tsx`
  - **Archivo**: `src/components/quiniela/PredictionMatrix.tsx`
  - **Contenido**: tabla responsive; columna de usuarios fija (CSS `sticky left-0`); scroll horizontal en móvil; badges de color para cada estado; bandera/logo en encabezado de columna; resultado oficial en encabezado
  - **Criterio**: scroll horizontal funcional en viewport < 640px; columna usuario no se desplaza
  - **Dependencias**: T067, T060

- [ ] T069 Crear pantalla "Estadísticas"
  - **Archivo**: `src/app/(app)/quinielas/[quinielaId]/estadisticas/page.tsx`
  - **Contenido**: tabs General/Jornada/Fase/Usuario; PredictionMatrix; filtros; métricas de exactos, ganadores, estrella, bot
  - **Criterio**: filtros funcionales; matriz renderiza correctamente en móvil y desktop
  - **Dependencias**: T068

**Checkpoint Fase 11 (US9)**: Estadísticas y matriz funcionales. Privacidad verificada.

---

## Fase 12 — UI Mobile-First, PWA y Pulido (US9, US10)

- [ ] T070 [P] Crear y configurar PWA manifest
  - **Archivos**: `public/manifest.json`, `src/app/layout.tsx` (link manifest), `public/icons/` (icon-192.png, icon-512.png)
  - **Criterio**: Lighthouse PWA score ≥ 90; "Agregar a pantalla de inicio" funciona en Android Chrome
  - **Dependencias**: T027

- [ ] T071 [P] Configurar Service Worker básico
  - **Archivo**: `public/sw.js` (o usar `next-pwa`)
  - **Lógica**: cache de assets estáticos; estrategia network-first para API
  - **Criterio**: app carga con UI básica sin conexión; muestra "sin conexión" para datos dinámicos
  - **Dependencias**: T070

- [ ] T072 Crear constantes de mensajes toast
  - **Archivo**: `src/lib/toast-messages.ts`
  - **Contenido**: objeto con todos los mensajes en español definidos en el spec (FR-055)
  - **Criterio**: todos los toasts del spec existen como constantes; no hay strings duplicados en código
  - **Dependencias**: T027

- [ ] T073 [P] Refinar UI mobile: estados visuales de partidos
  - **Archivos**: `src/components/quiniela/MatchCard.tsx`, `src/components/quiniela/QuinielaCard.tsx`
  - **Estados visuales**: Abierto (verde), Bloquea pronto (<30 min, amarillo), Bloqueado (naranja), En juego (azul parpadeante), Finalizado (gris), Postergado/Cancelado (rojo)
  - **Criterio**: cada estado tiene color/badge visualmente distinguible; probado en móvil
  - **Dependencias**: T052

- [ ] T074 Implementar integración desacoplada de marcadores en vivo
  - **Archivos**: `src/lib/live-scores/provider.ts` (interfaz), `src/lib/live-scores/null-provider.ts` (v1)
  - **Contenido**: interfaz `LiveScoreProvider`; `NullLiveScoreProvider` que retorna `null`; leaderboard provisional usa `liveHomeGoals/liveAwayGoals` si están presentes
  - **Criterio**: código compila; la interfaz permite agregar proveedor real sin cambiar lógica core
  - **Dependencias**: T063

**Checkpoint Fase 12**: App instalable como PWA. Todos los estados visuales correctos. Toasts con mensajes correctos en español.

---

## Fase 13 — Pruebas Completas

- [ ] T075 [P] Tests unitarios: `scoring.test.ts` — 9 escenarios del spec
  - **Archivo**: `tests/unit/scoring.test.ts`
  - **Framework**: Vitest
  - **Casos**: exacto/ganador/empate/sin acierto × normal/estrella + eliminatorias con penales (los 2 ejemplos del spec)
  - **Criterio**: 11+ test cases pasan
  - **Dependencias**: T019

- [ ] T076 [P] Tests unitarios: `lock.test.ts`, `bot.test.ts`, `timezone.test.ts`
  - **Archivos**: `tests/unit/lock.test.ts`, `tests/unit/bot.test.ts`, `tests/unit/timezone.test.ts`
  - **Criterio**: cobertura de casos límite para bloqueo, doble compuerta bot y conversión de timezone
  - **Dependencias**: T047, T057, T018

- [ ] T077 Tests e2e: flujo usuario pendiente → activación → predicción
  - **Archivo**: `tests/e2e/predictions.spec.ts`
  - **Flujo**: registrar usuario → solicitar acceso → ver mensaje pendiente → login como admin → activar → login como usuario → guardar predicción → verificar "Guardado"
  - **Criterio**: test pasa en Playwright contra BD local `bd_kiniela`
  - **Dependencias**: T051, T031

- [ ] T078 [P] Tests e2e: autenticación completa
  - **Archivo**: `tests/e2e/auth.spec.ts`
  - **Casos**: registro, login exitoso, login fallido, logout, rutas protegidas
  - **Criterio**: todos los flujos de auth pasan
  - **Dependencias**: T024, T025

- [ ] T079 [P] Tests e2e: predicciones automáticas personales
  - **Archivo**: `tests/e2e/auto-predictions.spec.ts`
  - **Flujo**: usuario ACTIVE desactiva `autoPredictionsEnabled` → job corre → no genera predicción para ese usuario; otro usuario con enabled=true → sí genera
  - **Criterio**: doble compuerta verificada e2e
  - **Dependencias**: T057, T042

**Checkpoint Fase 13**: Todos los tests pasan. Cobertura de escenarios críticos del spec.

---

## Fase 14 — Deploy Local y Verificación Final

- [ ] T080 Verificar `.env.local` y `.gitignore`
  - **Acción**: `git status` no muestra `.env.local`; `cat .gitignore | grep .env.local` muestra la entrada
  - **Criterio**: 0 archivos sensibles en el repositorio
  - **Dependencias**: T005

- [ ] T081 Ejecutar migraciones y seed en BD local
  - **Comandos**: `npx prisma migrate deploy`, `npx tsx prisma/seed.ts`
  - **Criterio**: 48 partidos de grupos en BD; quiniela seed creada; `npx prisma studio` muestra datos correctos
  - **Dependencias**: T017

- [ ] T082 Verificar `npm run build` y `npm start`
  - **Criterio**: build sin errores de TypeScript ni de Next.js; app corre en producción local
  - **Dependencias**: T069, T074

- [ ] T083 [P] Verificar PWA en dispositivos reales o simuladores
  - **Criterio**: "Agregar a inicio" funciona en Android Chrome y Safari iOS; app instalada abre correctamente
  - **Dependencias**: T071

- [ ] T084 [P] Verificar jobs con crontab local
  - **Comando de prueba**: `curl -X POST http://localhost:3000/api/jobs/lock-matches -H "x-cron-secret: $CRON_SECRET"`
  - **Criterio**: job responde 200; partidos bloqueados si aplica; 401 sin secret
  - **Dependencias**: T056, T057

- [ ] T085 Auditoría final de seguridad
  - **Checklist**:
    - No hay credenciales en código fuente (`grep -r "PASSWORD" src/ --include="*.ts"` no retorna secrets reales)
    - No hay lógica de apuestas/pagos/gambling en ningún archivo
    - Todos los route handlers de quiniela verifican membresía antes de operar
    - Bloqueo de partidos validado en backend (no solo frontend)
  - **Criterio**: 0 hallazgos en checklist
  - **Dependencias**: T080, T082

**Checkpoint Fase 14**: App corriendo en localhost:3000. Seed cargado. PWA instalable. Jobs funcionales. Sin credenciales en código.

---

## Dependencias y Orden de Ejecución

### Orden estricto de fases

```
Fase 1 (Setup) → Fase 2 (BD + Prisma) → Fase 3 (Auth) → Fase 4 (Roles)
     ↓
Fase 5 (Multi-quiniela) → Fase 6 (Partidos) → Fase 7 (Predicciones + Lock)
     ↓
Fase 8 (Jobs Bot) → Fase 9 (Estrella) → Fase 10 (Puntuación) → Fase 11 (Stats)
     ↓
Fase 12 (PWA + UI) → Fase 13 (Tests) → Fase 14 (Deploy)
```

### Tareas que pueden ejecutarse en paralelo por desarrollador

- **Dev A**: T036 (eventos CRUD) y T043 (equipos/estadios) simultáneamente
- **Dev B**: T047 (lock.ts tests) y T057 (bot tests) simultáneamente
- **Dev A + B**: Fase 11 (estadísticas) y Fase 12 (PWA) en paralelo

### Prioridad MVP mínimo (P1 stories)

Para un MVP funcional, el camino crítico es:
`T001→T006→T008→T013→T014→T019→T020→T022→T023→T028→T029→T031→T048→T049→T053→T061→T062→T063`

---

## Notas

- `[P]` = puede ejecutarse en paralelo con otras tareas del mismo grupo
- Cada tarea debe hacer commit al completarse
- Verificar que `.env.local` no está en staging antes de cada commit (`git diff --staged | grep -v .env.local`)
- Si se agrega una nueva variable de entorno, documentarla en `.env.local.example` (sin valores reales)
- La Final del torneo debe tener `QuinielaStarMatch.isStar=true` desde la creación de la quiniela; verificar en seed
