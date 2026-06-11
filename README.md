# Ki-Niela

Plataforma web (Next.js + PostgreSQL) para quinielas deportivas **recreativas** — sin dinero real, sin apuestas, sin pagos. Solo competencia por puntos.

> Producción: <https://ki-niela-production.up.railway.app>

## Características

- **Multi-evento / multi-quiniela** — un usuario puede participar en varias quinielas del mismo o de distintos eventos.
- **Importar torneos desde ESPN** — 1 clic desde `/admin/torneos` para crear un torneo completo (equipos, estadios, partidos) de cualquier competición (Champions, Copa Oro, Copa América, Eurocopa, Libertadores, Mundial, Amistosos). Idempotente: re-sincronizar trae fases nuevas sin duplicar.
- **Pronósticos por partido** con autosave (debounce 350 ms, beacon en navegación), bloqueo individual 10 min antes del kickoff.
- **Bot de pronósticos aleatorios** con doble compuerta: el admin lo activa por quiniela y cada participante lo activa para sí mismo. Independiente del status del partido (ventana temporal, no status=BLOQUEADO).
- **Cálculo automático de puntos** (3/1/0 normal, 5/3/0 estrella; en eliminatorias cuenta el marcador a 90' o 120', no penales).
- **Marcadores en vivo** desde ESPN (sin API key) vía cron cada minuto, con override manual por partido. Liga a cualquier torneo importado automáticamente.
- **Posiciones** general / por día / por jornada / por fase. Solo `PARTICIPANT` compite — `QUINIELA_ADMIN` y `SUPER_ADMIN` excluidos del ranking.
- **Aislamiento por quiniela**: cada usuario ve solo las quinielas donde es miembro. Acceso por código de invitación (auto-servicio) o el admin los agrega directamente.
- **SUPER_ADMIN administra cualquier quiniela** (Config, miembros, roles) sin ser miembro. Guardas de "mínimo 1 admin" por quiniela y a nivel global. Gestión de membresías por quiniela desde `/admin/usuarios`.
- **Borrar quiniela** (solo admin) con doble confirmación — borra solo lo de esa quiniela, no afecta Event/Match compartidos por torneo.
- **Banderas/escudos de equipos** — prioriza logos de ESPN para clubes + selecciones; fallback a mapeo FIFA cuando es necesario.
- **Banner parametrizable por evento** — edita logo (URL o imagen adjunta), línea amarilla y subtítulo desde `/admin/torneos`. Las imágenes se guardan como data URL en BD (persisten en Railway). Máximo 800 KB.
- **Mantenimiento de eventos** — desde `/admin/torneos` se puede **archivar** un torneo terminado (lo oculta de todos los combos, reversible) o **borrarlo** por completo (partidos, equipos, estadios y todas sus quinielas) con doble confirmación. Un evento archivado no aparece en ningún menú.
- **Admin: búsqueda por nombre/correo** en `/admin/usuarios` para filtrar usuarios rápidamente. Incluye opción "Sin quiniela" para ver usuarios que no son miembros de ninguna quiniela.
- **Búsqueda de participantes** en cada quiniela (por nombre o correo), con contador de resultados.
- **Emails transaccionales** vía Brevo HTTP API (compatible con Railway, que bloquea SMTP outbound).
- **Mobile-first**, responsive, instalable como PWA.

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 16.2.6 (App Router), React 19.2, Tailwind 4, React Query 5, React Hook Form, Zod 4, Sonner, lucide-react |
| Backend | Next.js API Routes, NextAuth 5 (credentials), Prisma 7.8 |
| Auth/passwords | bcryptjs (cost 12) |
| Email | Brevo HTTP API (preferido) · Nodemailer SMTP (fallback) |
| Live scores | ESPN site.api.espn.com (gratis, sin key) |
| BD | PostgreSQL 12+ |
| Deploy | Railway (Docker, Next standalone) |
| Tests | Vitest + Testing Library |

Ver `GUIA_COMPLETA.md` para el detalle de arquitectura y `IMPLEMENTACION.md` para el changelog funcional.

## Setup local

```bash
# 1. Dependencias
npm install

# 2. Variables de entorno: copia .env.example → .env.local y completa
#    DATABASE_URL, NEXTAUTH_SECRET, BREVO_API_KEY (opcional), etc.
cp .env.example .env.local

# 3. Base de datos
createdb bd_kiniela
npx prisma migrate dev
npx prisma db seed

# 4. Dev server
npm run dev   # http://localhost:3001
```

Variables mínimas en `.env.local`:

```
DATABASE_URL="postgresql://postgres:<pass>@localhost:5432/bd_kiniela?schema=public"
NEXTAUTH_URL="http://localhost:3001"
NEXTAUTH_SECRET="<cualquier string largo>"
CRON_SECRET="<cualquier string largo>"
# Email (opcional en local — sin estas vars, sendMail loguea y devuelve ok:false)
BREVO_API_KEY="xkeysib-..."
SMTP_FROM="Ki-Niela <noreply@tu-dominio>"
ADMIN_NOTIFY_EMAIL="tu-correo@example.com"
```

## Comandos útiles

```bash
npm run dev              # dev server
npm run build            # build local (next build + prisma generate)
npm run build:railway    # build con migrate deploy + seed (lo usa Railway)
npm test                 # vitest run
npm run test:watch       # vitest watch

# Datos
npx prisma studio                          # GUI de BD
npx prisma migrate dev --name "<nombre>"   # nueva migración
npx tsx scripts/seed-amistosos.ts          # crear quiniela amistosos
npx tsx scripts/seed-mundial-knockouts.ts  # bracket eliminatorio Mundial 2026 (calendario FIFA)
npx tsx scripts/seed-dpti-mundial.ts       # clonar Mundial → "DP-TI COPA MUNDO 2026"
npx tsx scripts/sync-mundial-stars.ts      # sincronizar partidos estrella entre quinielas Mundial
npx tsx scripts/fix-orientation.ts         # reparar goles invertidos vs ESPN (dry-run; --apply escribe)
npx tsx scripts/verify-and-recalc.ts       # verificar orientación + recalcular scores de todas las quinielas
```

## Deploy

Push a `main` ⇒ Railway redeploya. El job `prisma migrate deploy` corre en build, así que las migraciones se aplican antes del start.

Cron jobs (cron-job.org o Railway cron) deben llamar cada minuto:

- `POST /api/jobs/sync-live-scores` — sincroniza marcadores ESPN
- `POST /api/jobs/lock-matches` — bloquea partidos a `kickoff - lockMinutesBeforeMatch`
- `POST /api/jobs/generate-random-predictions` — bot aleatorio
- `POST /api/jobs/recalculate-scores` — recalcula puntos cuando hay resultado oficial

Header obligatorio: `x-cron-secret: <CRON_SECRET>`.

## Documentación

- [`GUIA_COMPLETA.md`](GUIA_COMPLETA.md) — arquitectura, modelo de datos, endpoints, lógica de negocio, deploy.
- [`IMPLEMENTACION.md`](IMPLEMENTACION.md) — changelog narrativo de features importantes.
- [`docs/MARCADORES_EN_VIVO.md`](docs/MARCADORES_EN_VIVO.md) — integración ESPN, vinculación de partidos, cron.
- [`AGENTS.md`](AGENTS.md) — notas para agentes/IA: leer la doc de Next.js antes de tocar código.

## Reglas de puntuación

| Resultado | General | Estrella / Final |
|-----------|---------|------------------|
| Marcador exacto | 3 | 5 |
| Ganador correcto, marcador no | 1 | 3 |
| Empate correcto, marcador no | 1 | 3 |
| Sin acierto | 0 | 0 |

En eliminatorias cuenta el marcador a 90' (o 120' si hubo extra-time). Penales **no** cuentan.

## Licencia

Privado. Sin licencia pública.
