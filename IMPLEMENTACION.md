# Ki-Niela — Documentación de Implementación

Changelog narrativo de las features e integraciones del proyecto. Cuenta el **qué**, el **por qué** y el **cómo probar/operar**. Para arquitectura general ver [`GUIA_COMPLETA.md`](GUIA_COMPLETA.md); para integración de marcadores ver [`docs/MARCADORES_EN_VIVO.md`](docs/MARCADORES_EN_VIVO.md).

> **Última revisión:** 2026-06-01 (sesión 5) — banner parametrizable + uploader de imagen + filtro usuarios

---

## Tabla de contenidos

1. [Quiniela "Amistosos Internacionales"](#1-quiniela-amistosos-internacionales)
2. [Perfil de usuario](#2-perfil-de-usuario)
3. [Emails transaccionales (Brevo HTTP API)](#3-emails-transaccionales-brevo-http-api)
4. [Visibilidad de quinielas](#4-visibilidad-de-quinielas)
5. [Marcadores en vivo + admin de partidos](#5-marcadores-en-vivo--admin-de-partidos)
6. [Bot de pronósticos: doble compuerta](#6-bot-de-pronósticos-doble-compuerta)
7. [Autosave de marcadores + overlay de guardado](#7-autosave-de-marcadores--overlay-de-guardado)
8. [Posiciones: SUPER_ADMIN excluido del ranking](#8-posiciones-super_admin-excluido-del-ranking)
9. [Auto-vincular partidos: matching difuso de nombres](#9-auto-vincular-partidos-matching-difuso-de-nombres)
10. [Endpoint diagnóstico de mailer](#10-endpoint-diagnóstico-de-mailer)
11. [Quiniela "DP-TI COPA MUNDO 2026" (clon del Mundial)](#11-quiniela-dp-ti-copa-mundo-2026-clon-del-mundial)
12. [Bracket eliminatorio Mundial 2026 con calendario FIFA oficial](#12-bracket-eliminatorio-mundial-2026-con-calendario-fifa-oficial)
13. [Sincronización ESPN: reconciliar orientación home/away](#13-sincronización-espn-reconciliar-orientación-homeaway)
14. [Bot: ventana de bloqueo + QUINIELA_ADMIN excluido de competencia](#14-bot-ventana-de-bloqueo--quiniela_admin-excluido-de-competencia)
15. [Aislamiento de quinielas por usuario + código de invitación](#15-aislamiento-de-quinielas-por-usuario--código-de-invitación)
16. [Admin/usuarios: membresías y filtro por quiniela](#16-adminusuarios-membresías-y-filtro-por-quiniela)
17. [Badge morado del bot: indicador visual](#17-badge-morado-del-bot-indicador-visual)
18. [Importar torneos desde ESPN (1 clic, multi-torneo, idempotente)](#18-importar-torneos-desde-espn-1-clic-multi-torneo-idempotente)
19. [Borrar quiniela con doble confirmación](#19-borrar-quiniela-con-doble-confirmación)
20. [Fix banderas: priorizar logos ESPN sobre helper FIFA](#20-fix-banderas-priorizar-logos-espn-sobre-helper-fifa)
21. [Banner personalizable por evento: logo, línea amarilla, subtítulo](#21-banner-personalizable-por-evento-logo-línea-amarilla-subtítulo)
22. [Uploader de imagen para logo del banner (data URL, máx 800 KB)](#22-uploader-de-imagen-para-logo-del-banner-data-url-máx-800-kb)
23. [Búsqueda por nombre/correo en admin/usuarios](#23-búsqueda-por-nombrecorreo-en-adminusuarios)
24. [Setup local + troubleshooting](#24-setup-local--troubleshooting)
21. [Setup local + troubleshooting](#21-setup-local--troubleshooting)

---

## 1. Quiniela "Amistosos Internacionales"

Evento separado del Mundial 2026, con 37 amistosos del 30 mayo al 3 junio 2026.

**Archivos:**
- `scripts/seed-amistosos.ts` — script idempotente: crea Event, 70 Teams, 5 Matchdays, 37 Matches, 1 Quiniela (`AMISTOSOS2026`).
- `src/lib/flags.ts` — mapping FIFA-3 → ISO-2 expandido para 25+ países nuevos.

**Ejecutar contra BD local:**
```bash
npx tsx scripts/seed-amistosos.ts
```

Contra Railway: usa la `DATABASE_URL` de producción (tomarla del dashboard de Railway, **no** ponerla en commits).

---

## 2. Perfil de usuario

Cada usuario puede cambiar nombre, email y contraseña desde `/perfil`.

**Archivos:**
- `src/app/perfil/page.tsx` — formulario (Hook Form + Zod). Inputs `h-11 text-base`, `pb-24` para no chocar con el bottom nav móvil, `autoComplete` para password managers.
- `src/app/api/me/route.ts` — `PATCH /api/me`. Valida con Zod, hashea con `bcryptjs` cost 12. Si se cambia password, exige `currentPassword` y lo verifica con `compareSync`. Si se cambia email, comprueba que no esté en uso.

**Validaciones:**
- `name`: 1–80 chars
- `email`: válido + único
- `newPassword`: ≥ 8 chars + confirmación
- `currentPassword`: requerido si hay `newPassword`

---

## 3. Emails transaccionales (Brevo HTTP API)

### Por qué Brevo HTTP, no SMTP

Railway **bloquea outbound SMTP** (puertos 25/465/587) en planes free/hobby. Resend funcionaba en sandbox solo para el email del propietario. Brevo SMTP también queda bloqueado por Railway. La solución: **Brevo HTTP API** (`POST https://api.brevo.com/v3/smtp/email`), que va por HTTPS:443 y nunca se bloquea.

### Cómo está implementado

`src/lib/mailer.ts` tiene dos transports:

1. **`sendViaBrevoApi`** — preferido cuando `BREVO_API_KEY` está set. Hace fetch directo al endpoint REST.
2. **`sendViaSmtp`** — fallback con Nodemailer (timeouts explícitos, `requireTLS` cuando port 587). Sirve para entornos que sí permiten SMTP outbound.

`sendMail(msg)` decide automáticamente: si `BREVO_API_KEY` está presente → HTTP API; si no → SMTP. Nunca lanza: devuelve `{ ok: true, messageId }` o `{ ok: false, reason }` y loguea.

**Llamadas siempre fire-and-forget** (`void send(...).catch(log)`) para que la latencia del email no bloquee el response del endpoint que dispara el correo. Ejemplo: en `PATCH /api/admin/users/:id` el toast "Usuario activado" sale antes de que el correo se envíe.

### Plantillas (`src/lib/mailer-templates.ts`)

```
sendNewUserRegisteredToAdmin       — al admin: hay registro nuevo
sendWelcomeToNewUser               — al user: bienvenida + pendiente activación
sendUserActivatedGlobally          — al user: cuenta activada globalmente
sendQuinielaAccessRequestToAdmin   — a los admins de la quiniela: solicitud nueva
sendQuinielaAccessApproved         — al user: aprobado en una quiniela
```

### Variables de entorno

```
# Preferido — HTTP API (HTTPS, funciona en Railway)
BREVO_API_KEY="xkeysib-..."

# Fallback — SMTP (no funciona en Railway free/hobby por el bloqueo de outbound)
SMTP_HOST="smtp-relay.brevo.com"
SMTP_PORT="587"
SMTP_USER="<account>"
SMTP_PASS="<smtp-key>"

# Comunes
SMTP_FROM='Ki-Niela <noreply@tu-dominio>'
ADMIN_NOTIFY_EMAIL="admin@example.com"
```

### Brevo: IPs autorizadas

Brevo trae el bloqueo de IP **activado por defecto** para Claves API. Si Railway cambia de IP entre deploys, los correos rechazan con `"unrecognised IP address X.X.X.X"`. Solución: en Brevo → Configuración → Seguridad → **IPs autorizadas** → desactivar el bloqueo para Claves API. La protección real es el secret de la API key.

---

## 4. Visibilidad de quinielas

SUPER_ADMIN puede archivar/habilitar quinielas con switch desde `/admin/usuarios`.

- `Quiniela.status='ACTIVE'` → visible para todos
- `Quiniela.status='ARCHIVED'` → solo el SUPER_ADMIN la ve

**Archivos:**
- `src/app/api/admin/quinielas/route.ts` — `GET` con todas las quinielas (incluso ARCHIVED).
- `src/app/api/admin/quinielas/[quinielaId]/route.ts` — `PATCH` con `{ status: 'ACTIVE'|'CLOSED'|'ARCHIVED' }`. Crea AuditLog.
- `src/app/admin/usuarios/page.tsx` — sección "Visibilidad de Quinielas" con switch ON/OFF y optimistic update + rollback en error.
- `src/app/quinielas/page.tsx` — el listado público filtra `status !== 'ARCHIVED'` para no-admins.

---

## 5. Marcadores en vivo + admin de partidos

Detalles completos en [`docs/MARCADORES_EN_VIVO.md`](docs/MARCADORES_EN_VIVO.md). Resumen:

- **Provider:** ESPN (`site.api.espn.com`), gratis, sin API key. Antes era Sofascore; se cambió porque la cobertura de amistosos era inestable.
- **Cron** llama `/api/jobs/sync-live-scores` cada minuto con `x-cron-secret`.
- **Vinculación:** UI en `/admin/partidos`. Buscador de fixtures por fecha + filtro de torneo. Dos botones por fila vinculada: editar (lápiz azul) y desvincular (Unlink rojo). Hay también "Auto-vincular partidos visibles por nombre".
- **Editor manual de marcador** inline: número local + número visitante + select de status, escribe a `Match.liveHomeGoals/liveAwayGoals/status` vía `PATCH /api/matches/:id/live`.
- **`manualOverride`** por partido — si está ON, el cron deja de tocarlo.
- **Estados ESPN** se mapean con un encoding `state|detail` para distinguir "halftime" (HT) de "in-progress 41'" (que también contiene "ft" como substring).

### Bug fix de auto-vincular: Bosnia y Herzegovina ↔ Bosnia-Herzegovina

ESPN usa "Bosnia-Herzegovina"; Ki-Niela tiene "Bosnia y Herzegovina". `normalize()` ahora elimina conectores `y`/`e`/`and`/`&` antes de strippar separadores, así ambos colapsan a `bosniaherzegovina`. Cubre también "Trinidad y Tobago", "Antigua y Barbuda", etc.

```ts
// src/app/admin/partidos/page.tsx
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+(?:y|e|and|&)\s+/g, ' ')
    .replace(/[^a-z0-9]/g, '')
}
```

---

## 6. Bot de pronósticos: doble compuerta

Antes el bot solo respondía al switch global de la quiniela. Ahora son **dos compuertas independientes**:

| Compuerta | Donde se configura | Quién la cambia |
|-----------|-------------------|-----------------|
| `Quiniela.randomPredictionsEnabled` | `/admin/usuarios` y configuración de quiniela | QUINIELA_ADMIN o SUPER_ADMIN |
| `QuinielaMember.autoPredictionsEnabled` | Dashboard de la quiniela (toggle "Mis predicciones automáticas") | El propio participante |

El bot genera predicción **solo si TODAS estas se cumplen**: ambas compuertas en `true`, member en `ACTIVE`, no existe predicción previa, partido llegó al lock.

**Archivos:**
- `src/components/MyAutoPredictionsToggle.tsx` — UI del switch personal con warning si la quiniela tiene el bot global apagado.
- `src/app/api/quinielas/[quinielaId]/me/auto-predictions/route.ts` — `PATCH` con `{ enabled: boolean }`.
- `src/app/quinielas/[quinielaId]/dashboard/page.tsx` — incrusta el toggle entre stats y próximos partidos.

---

## 7. Autosave de marcadores + overlay de guardado

### Problema original

Los marcadores se guardaban con `onChange` solo cuando los dos inputs (local/visitante) tenían valor. Al cambiar de menú antes de llenar ambos, **se perdía la predicción**. Y el spinner "Guardando…" se quedaba pegado a veces.

### Solución

`src/hooks/useAutosave.ts`:
- Debounce **350 ms** por matchId.
- `onBlur` dispara `flush(matchId)`: si solo hay un input lleno, trata el otro como `0`.
- En `beforeunload`/cambio de pestaña: usa `navigator.sendBeacon` + `fetch keepalive` para enviar antes de que se cancele.
- `fire` callback estabilizado con refs (deps `[]`) — antes el `useEffect` con `[inFlight]` re-armaba el cleanup en cada render y disparaba `flushAll(true)`.
- `sendBeacon` actualiza `statusMap` a `'saved'` optimistic (porque beacon no devuelve respuesta).

`src/app/quinielas/[quinielaId]/pronosticos/page.tsx`:
- **Overlay full-screen modal** con `BallLoader` (balón animado del proyecto), `backdrop-blur-sm`, mostrado tras 300 ms de pendiente para no flashear en saves rápidos.
- `aria-busy="true"` y `onClick={preventDefault}` bloquean navegación durante el guardado.
- Hooks **antes** de cualquier early return — error de "Rendered more hooks than during the previous render" si se ponen después de `if (isLoading) return ...`.

### Variables visibles al usuario (`src/components/quiniela/AutosaveStatus.tsx`)

- `Guardando…` — request en vuelo
- `Guardado` — última respuesta OK
- `Error al guardar` — toast rojo
- `Partido bloqueado` — input deshabilitado

---

## 8. Posiciones: SUPER_ADMIN excluido del ranking

### Bug original

El dashboard mostraba "Posición 1" para el admin pero `/posiciones` decía "Aún no hay puntos registrados". Dos endpoints calculaban distinto.

### Causas

1. `/api/quinielas/:id/leaderboard` filtraba `role: 'PARTICIPANT'` y excluía a admins.
2. El dashboard hacía `score.groupBy({ where: { quinielaId } })` sin filtrar status/rol.
3. Ningún cálculo excluía SUPER_ADMIN globales (no son competidores).

### Fixes

`src/app/api/quinielas/[quinielaId]/leaderboard/route.ts`:
- Quita el filtro de `role`. Incluye **a todos los miembros `ACTIVE`** (un QUINIELA_ADMIN que juega también suma).
- **Excluye `globalRole=SUPER_ADMIN`** vía `user: { globalRole: { not: 'SUPER_ADMIN' } }`.
- En scope `general`, agrega tail con miembros activos sin scores (con 0 pts) — para que no diga "vacío" cuando hay competidores que aún no han calificado.

`src/app/quinielas/[quinielaId]/dashboard/page.tsx`:
- La tarjeta "Posición" usa el mismo filtro y lógica de tail.

`src/app/api/jobs/recalculate-scores/route.ts`:
- Ignora predicciones de SUPER_ADMIN al calcular Score rows.
- Al inicio de cada run, hace `score.deleteMany({ where: { userId: { in: <super_admins> } } })` para limpiar rows que se hayan creado en versiones previas.

---

## 9. Auto-vincular partidos: matching difuso de nombres

Ya cubierto en §5 con el ejemplo de Bosnia. Más allá de eso, `teamsMatch(a, b)` sigue una secuencia de comparaciones:

1. `normalize` exacto
2. Substring containment (4+ chars) para `'mexico' ⊂ 'mexicofootballteam'`
3. Equivalencia por **TEAM_ALIASES** — grupos de variantes (FIFA, inglés, español, con/sin acentos)
4. Stripping de sufijos comunes (`nationalfootballteam`, `national`, `team`)

Cada nuevo país que dé problemas se agrega como una fila más a `TEAM_ALIASES` en `src/app/admin/partidos/page.tsx`.

---

## 10. Endpoint diagnóstico de mailer

`/api/admin/diag/mailer` (requiere SUPER_ADMIN):

- `GET` → reporta snapshot de config: `transport: brevo-http-api | smtp`, `BREVO_API_KEY_set`, `SMTP_*`, `ADMIN_NOTIFY_EMAIL`, `NEXTAUTH_URL`, `NODE_ENV`. Sin secretos.
- `POST { to: "email@dest" }` → manda un correo de prueba y devuelve `{ to, result, env }`.

Útil para confirmar desde producción que Railway tiene las vars correctas y Brevo no rechaza por IP. Probar desde la consola del browser:

```js
fetch('/api/admin/diag/mailer', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ to: 'tucorreo@example.com' }),
}).then(r => r.json()).then(console.log)
```

---

## 11. Quiniela "DP-TI COPA MUNDO 2026" (clon del Mundial)

Quiniela paralela para el equipo DP-TI sobre el mismo evento del Mundial 2026.

**Script:** `scripts/seed-dpti-mundial.ts` — idempotente, lee la quiniela origen
(`quiniela-mundial-2026`) y crea/actualiza una nueva con misma config, mismos
partidos estrella y el admin global como QUINIELA_ADMIN. **No** clona miembros
ni predicciones (cada quiniela tiene su propia comunidad).

**Identidades:**
- `id`: `quiniela-dpti-mundial-2026`
- `name`: `DP-TI COPA MUNDO 2026`
- `inviteCode`: `DPTI2026`
- `eventId`: `event-wc2026` (mismo Mundial)
- `status`: `ARCHIVED` (oculta para no-admins por ahora; activar via switch en `/admin/usuarios` cuando se quiera lanzar)

**Ejecutar:**
```bash
# Local
set -a && . ./.env.local && set +a
npx tsx scripts/seed-dpti-mundial.ts

# Railway
DATABASE_URL=<railway-url> npx tsx scripts/seed-dpti-mundial.ts
```

**Estado en producción (mayo 2026):** ambas quinielas (`Ki-Niela Mundial 2026` y
`DP-TI COPA MUNDO 2026`) están `ARCHIVED` y comparten 12 partidos estrella
sincronizados.

### Sync de partidos estrella entre quinielas

`scripts/sync-mundial-stars.ts` aplica un set fijo de matchIds como estrella a
ambas quinielas en una pasada (idempotente, hace skip si el match no existe).
Útil para mantener parity cuando se marca un partido como estrella en una y se
quiere reflejar en la otra.

```bash
DATABASE_URL=<url> npx tsx scripts/sync-mundial-stars.ts
```

---

## 12. Bracket eliminatorio Mundial 2026 con calendario FIFA oficial

`scripts/seed-mundial-knockouts.ts` siembra los 30 partidos eliminatorios del
Mundial 2026 con fechas y sedes oficiales según el calendario FIFA, y ajusta el
3er lugar y la final con sus sedes/horarios correctos.

### Estructura del bracket (32 partidos KO totales)

| ID en BD | Fase | Cantidad | Fechas (UTC) |
|---|---|---|---|
| `m-r32-73` … `m-r32-88` | ROUND_OF_32 | 16 | 28 jun – 4 jul 2026 |
| `m-r16-89` … `m-r16-96` | ROUND_OF_16 | 8 | 4 – 7 jul 2026 |
| `m-qf-97` … `m-qf-100` | QUARTER_FINAL | 4 | 9, 10, 11 jul 2026 |
| `m-sf-101`, `m-sf-102` | SEMI_FINAL | 2 | 14, 15 jul 2026 |
| `match-3er-lugar` | THIRD_PLACE | 1 | 18 jul 2026 (Hard Rock) |
| `match-final` | FINAL | 1 | 19 jul 2026 19:00 UTC = 3pm EDT (MetLife) |

> **Numeración:** los IDs `m-r32-73`..`m-sf-102` corresponden al match number
> oficial FIFA (73-104). Los placeholders en `placeholderHomeName` /
> `placeholderAwayName` siguen el mismo formato (`"Ganador 73"`, `"1A"`,
> `"3º (A/B/C/D/F)"`) para que coincidan con la planilla pública del torneo.

### Cómo se sembraron las eliminatorias en producción

```bash
DATABASE_URL=<railway-url> npx tsx scripts/seed-mundial-knockouts.ts
```

El script:
1. Hace `upsert` de los 6 matchdays de eliminatoria (`md-octavos`,
   `md-dieciseis`, `md-cuartos`, `md-semis`, `md-3er`, `md-final`).
2. Hace `upsert` de los 30 partidos KO (R32 + R16 + QF + SF) con stadiumId,
   matchdayId, phase, kickoffAtUtc, kickoffAtCostaRica y placeholders.
3. **Actualiza** `match-3er-lugar` (sede a Hard Rock, fecha 18 jul 21:00 UTC)
   y `match-final` (sede MetLife, **fecha corregida** a 19 jul 19:00 UTC =
   3pm EDT — antes estaba a 22:00 UTC).

### Pendiente diferido: resolver placeholders con equipos reales

Después del **27 jun 2026** (fin de fase de grupos):

1. Reemplazar `placeholder*` por `homeTeamId`/`awayTeamId` reales en cada R32
   conforme se conozcan los 32 clasificados (1° y 2° de cada grupo + 8 mejores
   terceros — el cruce concreto sale del bracket FIFA).
2. Conforme avance el torneo, llenar R16/QF/SF/Final con los ganadores de la
   ronda anterior.
3. Después de cada batch de updates, `POST /api/jobs/recalculate-scores` con
   `x-cron-secret` para refrescar puntos provisionales.

**Bracket de avance oficial:** [Wikipedia 2026 FIFA WC Knockout Stage](https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage).

---

## 13. Sincronización ESPN: reconciliar orientación home/away

### Problema

ESPN puede listar un partido con **local/visitante en orden opuesto** al
calendario de Ki-Niela. Casos reales (30 may 2026, amistosos):

- ESPN `Zimbabwe 1-0 India` ⟷ Ki-Niela tiene `India vs Zimbabwe`
- ESPN `Scotland 4-1 Curacao` ⟷ Ki-Niela tiene `Curazao vs Escocia`

El job `sync-live-scores` asignaba `fixture.homeGoals → liveHomeGoals` **por
posición ciega**, sin verificar que el "home" de ESPN fuera el mismo "home" de
Ki-Niela. Resultado: **marcadores invertidos** (mostraba que ganó India cuando
ganó Zimbabwe) y **puntos calculados al revés** — los que predijeron al ganador
real quedaban en 0 y viceversa.

### Decisión de diseño

La orientación (quién es local) la manda el **calendario de Ki-Niela**, no
ESPN. El sync **adapta** los goles de ESPN a nuestra orientación. **No** se
reordena el calendario, porque eso invertiría las predicciones que los usuarios
ya registraron.

### Solución

`src/lib/team-matching.ts` (nuevo) exporta `teamsMatch` / `normalize` /
`TEAM_ALIASES`. Antes vivían solo en `src/app/admin/partidos/page.tsx`; se
extrajeron para reusarlos en server jobs sin duplicar.

`src/app/api/jobs/sync-live-scores/route.ts`:
- La query trae `homeTeam`/`awayTeam`.
- Si `teamsMatch(ourHome, fxAway) && teamsMatch(ourAway, fxHome)` (orientación
  cruzada) y **no** coincide la orientación directa → voltea
  `home`/`away` goals **y** penales antes de guardar y recalcular.
- Conservador: solo voltea ante un cross-match con confianza; si los nombres no
  resuelven, deja los goles tal cual.

> **Alias de equipos:** si ESPN usa un nombre que `teamsMatch` no mapea, el sync
> no voltea (seguro pero puede no detectar la inversión). Agregar el alias en
> `TEAM_ALIASES`. Ya cubiertos: Switzerland/Suiza, Morocco/Marruecos,
> Scotland/Escocia, Brazil/Brasil, Qatar/Catar.

### Scripts de reparación y verificación

Ambos **idempotentes**, dry-run por defecto, `--apply` para escribir:

```bash
# Repara goles invertidos en partidos ya finalizados + recalcula scores
DATABASE_URL=<url> npx tsx scripts/fix-orientation.ts          # reporta
DATABASE_URL=<url> npx tsx scripts/fix-orientation.ts --apply  # aplica

# Verificación integral: orientación de TODOS los finalizados vs ESPN,
# recálculo de scores en TODAS las quinielas (excluye SUPER_ADMIN) y
# limpieza de scores huérfanos
DATABASE_URL=<url> npx tsx scripts/verify-and-recalc.ts
DATABASE_URL=<url> npx tsx scripts/verify-and-recalc.ts --apply
```

`fix-orientation.ts` compara los **goles guardados** contra ESPN-reorientado (no
solo la orientación de equipos, que es permanente) — por eso re-correrlo no
vuelve a voltear un marcador ya correcto.

### Aplicado en producción (30 may 2026)

- 2 partidos corregidos (Curazao 1-4 Escocia, India 0-1 Zimbabwe).
- 18 predicciones recalculadas, 3 scores huérfanos eliminados.
- Estado final: **0 discrepancias vs ESPN, 0 huérfanos**.
- Los 3 partidos finalizados quedan en `FINALIZADO`, así que el cron no los
  vuelve a tocar.

---

## 14. Bot: ventana de bloqueo + QUINIELA_ADMIN excluido de competencia

### Problema original — race condition del bot

El bot (`/api/jobs/generate-random-predictions`) filtraba candidatos con `status='BLOQUEADO'`. Si `sync-live-scores` corría primero y cambiaba el status a `EN_JUEGO`, el bot ya no encontraba el partido y **ningún participante recibía predicción automática**.

Problema adicional: los `QUINIELA_ADMIN` acumulaban puntos, aparecían en posiciones y el bot les generaba predicciones, cuando la regla de negocio es que **solo `PARTICIPANT` compite**.

### Solución: ventana temporal + filtro de rol

**Bot independiente del status del partido.** El candidato se evalúa por tiempo, no por status:

```ts
// Candidatos: partidos no finalizados, no con resultado confirmado,
// cuyo kickoff ya pasó el umbral de bloqueo (kickoff - lockMinutesBeforeMatch).
const now = new Date()
const candidatos = partidos.filter(p =>
  !['FINALIZADO','CANCELADO','POSTERGADO'].includes(p.status) &&
  !p.resultConfirmedAt &&
  isMatchLocked(p.kickoffAtUtc, quiniela.lockMinutesBeforeMatch)
)
```

`isMatchLocked(kickoffAtUtc, lockMinutes)` — retorna `true` si `Date.now() >= kickoff - lockMinutes * 60_000`.

**Filtro de rol restaurado.** Solo se generan predicciones para miembros con `role: 'PARTICIPANT'` (además de `status: 'ACTIVE'` y `autoPredictionsEnabled: true`).

### QUINIELA_ADMIN excluido de toda la competencia (regla de negocio)

Los administradores de quiniela **no compiten**: no acumulan puntos, no aparecen en posiciones, no reciben predicciones del bot.

**Filtro aplicado en la capa de lectura** (no en la BD — los Scores se conservan):

| Endpoint / UI | Filtro añadido |
|---|---|
| `/api/quinielas/[id]/leaderboard` | `role: 'PARTICIPANT'` |
| `/quinielas/[id]/dashboard` (posición del usuario) | `role: 'PARTICIPANT'` |
| `/api/jobs/generate-random-predictions` | `role: 'PARTICIPANT'` |
| `prediction-matrix`, `en-vivo` | `role: 'PARTICIPANT'` |

**Los Scores de QUINIELA_ADMIN se conservan en BD** — `recalculate-scores`, `sync-live-scores` y `matches/[id]/live` calculan todas las predicciones sin borrar. Solo la lectura los ignora. (Decisión tomada el 30 may 2026: no borrar, solo no contar.)

### Disparador del bot: cronjob externo (cron-job.org)

El bot NO tiene scheduler propio en Railway (ni `railway.toml` cron, ni GitHub Actions). Se dispara desde **cron-job.org**, un servicio externo que llama a `/api/jobs/generate-random-predictions` **cada minuto** con header `x-cron-secret`.

**Otros 2 cronjobs también en cron-job.org:**
- `lock-matches` — bloquea partidos 10 min antes del kickoff.
- `sync-live-scores` — sincroniza marcadores en vivo desde ESPN cada minuto.

Si no hay cronjobs o el bot nunca se ejecuta, revisar primero **cron-job.org** (no el código del job, que es correcto). Sin cronjob, participantes con bot activo quedan "sin predicción" porque el endpoint nunca se llama.

**Archivos clave:**
- `src/app/api/jobs/generate-random-predictions/route.ts` — lógica de ventana + filtro de rol. Requiere header `x-cron-secret` (env `CRON_SECRET`).
- `src/app/api/quinielas/[quinielaId]/leaderboard/route.ts`
- `src/app/quinielas/[quinielaId]/dashboard/page.tsx`
- `src/__tests__/bot-gate.test.ts` — 27 tests que validan la ventana de bloqueo y la exclusión de admin.

---

## 15. Aislamiento de quinielas por usuario + código de invitación

### Problema original

Con más de una quiniela activa, cualquier usuario autenticado veía **todas las quinielas activas** en la sección "Disponibles para unirse" de `/quinielas`. Esto rompía el aislamiento entre grupos (amigos, trabajo, familia) que usan la misma plataforma.

### Solución: visibilidad solo por membresía

`/quinielas` ahora lista **únicamente** las quinielas donde el usuario ya tiene fila `QuinielaMember`. Se eliminó la sección "Disponibles para unirse" y toda la query de `browsableQuinielas`. El acceso por URL directo sigue bloqueado por `getMemberContext` (sin fila → sin acceso; el dashboard redirige a `/quinielas`).

### Formas de unirse a una quiniela nueva

**1. Código de invitación (auto-servicio)**

Cada `Quiniela` tiene un campo `inviteCode String? @unique` generado al crear (`nanoid(8).toUpperCase()`). El participante lo ingresa desde `/quinielas` → botón "Unirme a una quiniela".

`POST /api/quinielas/join` con `{ code: "XXXXXXXX" }`:
- Normaliza el código a mayúsculas (case-insensitive).
- Valida que la quiniela exista y esté `ACTIVE`.
- Une al usuario como `PARTICIPANT ACTIVE` de inmediato (el código es la compuerta, igual que el admin-add directo).
- Bordes: ya `ACTIVE` → 409; `PENDING/INVITED` → promueve a `ACTIVE`; `INACTIVE/REJECTED` → 409 (respeta la decisión del admin, no reactiva solo).
- AuditLog: `action: 'MEMBER_JOINED_BY_CODE'`.

**2. Admin agrega directo** — `POST /api/quinielas/[id]/members` (sin cambios).

### Gestión del código (solo QUINIELA_ADMIN)

Tarjeta en `configuracion/page.tsx` que muestra el `inviteCode` con formato monospace, botón copiar y botón regenerar.

`POST /api/quinielas/[id]/invite-code/regenerate`:
- Requiere `isAdminOf` o `SUPER_ADMIN`.
- Genera nuevo `nanoid(8).toUpperCase()` con retry ante colisión `P2002` (máx 5 intentos).
- El código anterior deja de funcionar **de inmediato**.
- AuditLog: `action: 'INVITE_CODE_REGENERATED'` con old/new value.

### UI del botón "Unirme a una quiniela"

`src/components/JoinByCodeButton.tsx` — diseño pill con gradiente esmeralda, ícono de ticket animado. Al pulsar, abre una tarjeta inline con input monospace grande (placeholder: `EJ. AMISTOSOS2026`), botón flecha y X para cancelar. Animación de entrada `tw-animate-css`.

El **SUPER_ADMIN no ve este botón** — en el hero del listado de quinielas ve solo "Crear quiniela", ya que él crea y ve todas sin necesidad de código.

### Sin migración de BD

`visibility` + `inviteCode` ya existían. Las quinielas creadas con el script de seed ya nacen con código. Las que tengan `inviteCode: null` (legado) muestran "Sin código" en config con botón "Generar código".

**Estado en producción (mayo 2026):**

| Quiniela | Status | inviteCode |
|---|---|---|
| Ki-Niela Amistosos Internacionales | ACTIVE | `AMISTOSOS2026` |
| Ki-Niela Mundial 2026 | ARCHIVED | `MUNDIAL2026` |
| DP-TI COPA MUNDO 2026 | ARCHIVED | `DPTI2026` |

**Archivos:**
- `src/app/api/quinielas/join/route.ts` (nuevo)
- `src/app/api/quinielas/[quinielaId]/invite-code/regenerate/route.ts` (nuevo)
- `src/components/JoinByCodeButton.tsx` (nuevo)
- `src/app/quinielas/page.tsx` — quitado browse público, agregado botón y empty-state contextual.
- `src/app/quinielas/[quinielaId]/configuracion/page.tsx` — tarjeta de código.

---

## 16. Admin/usuarios: membresías y filtro por quiniela

### Necesidad

Con múltiples quinielas en producción, el SUPER_ADMIN necesitaba saber **quién está unido a qué quiniela** y en qué estado, sin tener que abrir cada quiniela individualmente.

### Cambios

**`GET /api/admin/users`** ahora incluye `memberships[]` por cada usuario:

```json
{
  "id": "...",
  "name": "Adrian Ruiz",
  "memberships": [
    {
      "quinielaId": "...",
      "quinielaName": "Ki-Niela Amistosos Internacionales",
      "quinielaStatus": "ACTIVE",
      "memberStatus": "ACTIVE",
      "memberRole": "PARTICIPANT"
    }
  ]
}
```

**Tabla de usuarios en `/admin/usuarios`:**
- Nueva columna **"Quinielas"** con badge de estado del miembro (Activo / Pendiente / Invitado / Inactivo / Rechazado — cada uno con su color), nombre de la quiniela (tachado y gris si archivada), y ★ si el usuario es `QUINIELA_ADMIN` en esa quiniela.
- Si el usuario no tiene membresías: "Ninguna" en cursiva.

**Filtro "Quiniela"** (selector a la derecha de Todos/Pendientes/Activos):
- "Todas las quinielas" (default) — lista todos con sus membresías.
- Seleccionar una quiniela concreta — lista **solo los usuarios de esa quiniela** (activas y archivadas incluidas). La columna resalta esa membresía.
- Se combina con el filtro de estado global (ej. "Activos" + quiniela X = usuarios activos en X).

**Archivos:**
- `src/app/api/admin/users/route.ts` — agrega `quinielaMembers` a la query Prisma, aplanado al shape `memberships[]`.
- `src/app/admin/usuarios/page.tsx` — tipos `Membership`, estado `quinielaFilter`, columna y selector.

---

## 17. Badge morado del bot: indicador visual

### Necesidad

Cuando una predicción es generada por el bot automático, el usuario necesita **identificarla de un vistazo** en las tres vistas principales (pronósticos, en vivo, matriz), para saber que no la ingresó manualmente y entender su origen.

Antes: ícono/texto morado sutil, disperso y difícil de notar.

### Implementación

**Componente reutilizable `BotBadge`** (`src/components/quiniela/BotBadge.tsx`):

- `variant="chip"` (default): pastilla morada con ícono + "Bot", para espacios con espacio.
- `variant="icon"`: solo ícono morado 🤖, para celdas compactas (matriz).

Ambas con `title` y `aria-label` para accesibilidad.

**Aplicaciones:**

| Vista | Dónde aparece |
|-------|--------------|
| **Pronósticos** | Marcador bloqueado con fondo morado claro + ícono candado morado + chip "Bot" en el footer |
| **En vivo** | Ícono morado junto al nombre + chip "Bot" junto al marcador |
| **Matriz** | Ícono morado en la celda del partido (compacto) |

El color **morado persistente** (p.e., `text-purple-500`, `bg-purple-50`) en todas las vistas mantiene consistencia visual.

**Archivos:**
- `src/components/quiniela/BotBadge.tsx` (nuevo)
- `src/app/quinielas/[quinielaId]/pronosticos/page.tsx` — marcador con fondo morado + badge en footer.
- `src/app/quinielas/[quinielaId]/en-vivo/page.tsx` — ícono + chip junto al marcador.
- `src/components/quiniela/PredictionMatrix.tsx` — ícono en celda.

---

## 18. Importar torneos desde ESPN (1 clic, multi-torneo, idempotente)

### Problema original

Crear un nuevo torneo (Copa Libertadores, Champions, Copa Oro, etc.) requería ~350 líneas de script manual: seeding de equipos, estadios, partidos, jornadas. Implicaba:
- Listas de equipos/sedes hardcodeadas.
- Cálculo manual de fases a partir del calendario.
- Re-ejecutar el script si se añadían más partidos (Copa Libertadores fase 2, etc.).
- Mantenimiento: cambios en ESPN requería reescribir el script.

### Solución: botón `/admin/torneos`

Nuevo endpoint y página que permiten al SUPER_ADMIN crear un torneo completo desde ESPN en **1 clic**:

1. **Dropdown de torneos:** 7 competiciones preconfiguradas
   - Copa del Mundo FIFA
   - UEFA Champions League
   - Copa Oro CONCACAF
   - Copa América CONMEBOL
   - Eurocopa (UEFA Euro)
   - Copa Libertadores CONMEBOL
   - Amistosos Internacionales

2. **Pickers de fecha:** "Desde" y "Hasta" (rango de búsqueda en ESPN).

3. **Nombre de quiniela (opcional):** si no se ingresa, default `"Ki-Niela {nombre del torneo}"`.

4. **Botones:**
   - "Crear quiniela desde ESPN" — trae todos los partidos en el rango, crea Event/Team/Stadium/Matchday/Match/Quiniela.
   - "Re-sincronizar partidos" — re-postea el mismo torneo/rango, trae fases nuevas (octavos, cuartos) cuando ESPN las publica. Idempotente: agrega partidos nuevos, actualiza los existentes, nunca duplica ni toca predicciones.

### Archivos

**Backend:**
- `src/lib/tournaments.ts` — catálogo TOURNAMENTS[] + mapeo `season.slug` ESPN → MatchPhase.
- `src/lib/live-providers/espn.ts` — `fetchFixturesForImport()` que devuelve ImportFixture[] con logos, venue, fase.
- `src/lib/import-tournament.ts` — `importTournament({ slug, startDate, endDate, createdByUserId, quinielaName })` idempotente. Upsert por externalId (clave natural). Crea Event, Teams (dedup por normalize), Stadium, Matchday, Match, Quiniela + admin member + final-estrella.
- `src/app/api/admin/tournaments/import/route.ts` — `POST /api/admin/tournaments/import` (gate SUPER_ADMIN).

**Frontend:**
- `src/app/admin/torneos/page.tsx` — UI con dropdowns, pickers, botones, toast con conteos.

**Tests:**
- `src/__tests__/import-tournament.test.ts` — 8 tests: phase mapping, catalog resolution, fixture import, externalId encoding, date ranges, missing competitors.

### Características

- **Idempotencia:** re-importar el mismo torneo+rango actualiza fechas/equipos de partidos existentes (por `externalId @unique`) sin duplicar ni borrar predicciones.
- **Determinismo:** IDs de Event/Team/Stadium/Matchday son slugs estables (`evt-{slug}-{año}`, `tm-{eventId}-{abbr}`), así el mismo torneo siempre genera la misma estructura.
- **Dedup de equipos:** `normalize()` evita crear Brasil y Brazil por separado.
- **Sin placeholders manuales:** solo traes lo que ESPN ya tiene. Las fases futuras (KO) aparecen cuando ESPN las publica, luego re-sincronizás.
- **Ventas en vivo:** `externalProvider: 'espn'`, `externalId: 'slug|eventId'` → el sync en vivo ya funciona sin cambios.

### Botón "Torneos (Admin)" en el nav

`src/components/layout/AppShell.tsx` ahora muestra "Torneos (Admin)" en el sidebar solo para SUPER_ADMIN, con ícono de trofeo.

### Sin migración BD

Todas las columnas ya existían (`externalId`, `externalProvider`, `liveSource`, `flagUrl`).

---

## 19. Borrar quiniela con doble confirmación

### Necesidad

El admin debe poder eliminar una quiniela sin destruir el torneo (si hay 2+ quinielas del mismo evento, la eliminación de una no toca Event/Match compartidos ni quinielas hermanas).

### Solución: `DELETE /api/quinielas/[id]` + UI "Zona de peligro"

**Endpoint:**
- Auth: QUINIELA_ADMIN o SUPER_ADMIN de esa quiniela.
- Body: `{ confirmName: "nombre exacto de la quiniela" }` — obliga a escribir el nombre para confirmar.
- Borrado transaccional: Score → Prediction → StarMatch → Member → Quiniela (orden de dependencias).
- **NO toca** Event/Team/Match/Stadium/Matchday → otras quinielas del mismo torneo quedan intactas.
- AuditLog: `action: 'QUINIELA_DELETED'`.

**UI ("Zona de peligro" en Configuración):**
- Tarjeta roja con ícono de alerta.
- Botón "Borrar esta quiniela" → abre un panel inline con input "Escribir el nombre para confirmar".
- Botón "Confirmar borrado" deshabilitado hasta que el texto coincida exactamente.
- Botón "Cancelar" cierra el panel.
- Al confirmar: spinner, toast "Quiniela eliminada", redirige a `/quinielas`.

**Archivos:**
- `src/app/api/quinielas/[quinielaId]/route.ts` — nuevo `DELETE` export.
- `src/app/quinielas/[quinielaId]/configuracion/page.tsx` — tarjeta "Zona de peligro", mutation DELETE, estado del panel.

### Aislamiento garantizado

El borrado **solo elimina filas de esa quiniela**:
- `QuinielaMember.quinielaId = ?` ✓
- `Prediction.quinielaId = ?` ✓
- `Score.quinielaId = ?` ✓
- `QuinielaStarMatch.quinielaId = ?` ✓
- `Quiniela.id = ?` ✓

NO afecta:
- Event (compartido por otras quinielas del torneo)
- Team/Stadium/Match/Matchday (compartido por otras quinielas del torneo)
- Predicciones / Scores de otras quinielas

### Probado

Verificado en BD local: borrar una quiniela, confirmar que Event/Match/Teams de esa quiniela (pero otro en otra quiniela) quedan intactos.

---

## 20. Fix banderas: priorizar logos ESPN sobre helper FIFA

### Problema original

Cuando una quiniela de Libertadores trae equipos (clubs), sus códigos de 3 letras (FLU, LGA, CABJ, etc.) **no existen** en el mapeo FIFA→ISO. El helper `flagUrl(fifaCode)` devolvía `null` → **sin escudo visible** en pronósticos, dashboard y matriz de puntuación.

Ejemplo: Fluminense tiene `fifaCode: "FLU"`, pero `flagUrl("FLU")` → `null` porque FIFA solo mapea países (ISO-2), no clubes.

### Solución: priorizar `team.flagUrl` (ESPN) sobre helper FIFA

**Patrón:** en las 3 vistas, cambiar de:
```ts
const url = flagUrl(fifaCode)  // solo helper
```

A:
```ts
const url = flagUrl ?? flagUrl(fifaCode)  // prioriza ESPN, cae al helper
```

**Archivos tocados:**

| Archivo | Vista | Cambio |
|---------|-------|--------|
| `src/app/quinielas/[id]/pronosticos/page.tsx` | Pronósticos | TeamSide recibe `flag` prop |
| `src/app/quinielas/[id]/dashboard/page.tsx` | Dashboard | FlagPill recibe `flag` prop |
| `src/components/quiniela/PredictionMatrix.tsx` | Matriz | FlagBadge recibe `flag` prop |
| `src/app/api/quinielas/[id]/prediction-matrix/route.ts` | Matriz API | Devuelve `homeFlag` / `awayFlag` |

**Tipo de dato del select en las APIs:**
- `homeTeam: { select: { name, fifaCode, flagUrl } }`
- `awayTeam: { select: { name, fifaCode, flagUrl } }`

**Critical fix: `next.config.ts`**
El config solo permitía `flagcdn.com`. Agregué `a.espncdn.com` (dominio de logos ESPN) a `images.remotePatterns`:

```ts
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'flagcdn.com' },
    { protocol: 'https', hostname: 'a.espncdn.com' },
  ],
}
```

Sin esto, `<Image>` rechaza URLs de ESPN en runtime → sin escudo en ninguna vista.

### Resultado

Ahora Libertadores (clubes) y Champions League (también clubes) muestran sus escudos reales de ESPN en **todas las vistas** (pronósticos, en vivo, matriz, dashboard). Fallback a FIFA si ESPN no tiene logo.

### Probado

Verificado end-to-end en BD local con Libertadores: imports traen `flagUrl` de ESPN (ej. `https://a.espncdn.com/i/teamlogos/soccer/500/2690.png`), las URLs resuelven HTTP 200, y se renderizan en <Image> sin errores.

---

## 21. Banner personalizable por evento: logo, línea amarilla, subtítulo

### Qué es

Cada evento (Mundial, Libertadores, Champions, etc.) puede tener su propio banner con:
- **Logo** (URL o imagen adjunta)
- **Línea amarilla** ("FIFA World Cup 2026 · MEX · USA · CAN")
- **Subtítulo** ("Compite, predice y celebra...")

El banner aparece en:
- "Mis Quinielas" (toma del primer evento del usuario; fallback a Mundial)
- Dashboard de la quiniela (toma del evento de esa quiniela)

### Campos en BD

3 columnas nuevas en `Event` (nullable):
- `bannerLabel: String?` — línea amarilla (máx 120 chars)
- `bannerSubtitle: String?` — subtítulo (máx 200 chars)
- `bannerLogoUrl: String?` — URL http(s) o data URL de imagen (máx 1.2M chars base64)

### Edición: `/admin/torneos` → "Personalizar banner del torneo"

Un panel dropdown para elegir evento + 3 inputs:
- Texto para `bannerLabel` y `bannerSubtitle`
- Campo "URL del logo" (solo URL) + botón "Adjuntar imagen" (sección 22)

Botón "Guardar banner" → `PATCH /api/admin/events/{eventId}` con los 3 campos.

### Fallback

Si los campos están vacíos o null:
```ts
const label = event.bannerLabel ?? 'FIFA World Cup 2026 · MEX · USA · CAN'
const subtitle = event.bannerSubtitle ?? 'Compite, predice y celebra cada gol del mundial.'
const logoUrl = event.bannerLogoUrl ?? '/wc2026/logo.png'  // WorldCupHero usa este default
```

### Probado

- Crear evento con `bannerLabel` y `bannerSubtitle` → el banner las muestra en "Mis Quinielas" y Dashboard.
- Cambiar los valores → guardar → recargar → cambios reflejan al toque.
- Dejar vacío → cae a los defaults del Mundial.

---

## 22. Uploader de imagen para logo del banner (data URL, máx 800 KB)

### Problema

Railway tiene filesystem efímero: guardar archivos en `public/` es efímero → se pierden en redeploy. Los logos de eventos NO deben perderse.

### Solución: data URL en BD

La imagen se convierte a base64 (data URL) y se guarda en el mismo campo `bannerLogoUrl`:
```
data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...
```

Ventajas:
- Cero infraestructura (sin CDN, sin S3).
- Persiste en BD siempre (incluso tras redeploy de Railway).
- Works offline / sin depender de hosts externos.

### Flujo client-side

En `/admin/torneos` → botón "Adjuntar imagen":
1. File input (`accept="image/png,image/jpeg,image/webp,image/svg+xml"`).
2. FileReader → `readAsDataURL()` → base64.
3. Validaciones:
   - Tipos: PNG, JPG, WEBP, SVG.
   - Tamaño: máximo **800 KB** (campo en BD soporta 1.2M chars base64).
4. Conversión automática → input `bannerLogoUrl` se actualiza.
5. Botón "Guardar banner" envía el data URL al endpoint.

**UI:**
- Vista previa de 56×56 px a la izquierda.
- Botón "Adjuntar imagen" inline.
- Botón "Quitar" para limpiar.
- Texto: "Recomendado: cuadrado 160×160 px (mín. 88×88), PNG o SVG con fondo transparente. Máximo 800 KB."

### Backend

Endpoint `PATCH /api/admin/events/{eventId}` acepta:
```ts
z.string().max(1_200_000).refine(
  (v) => /^https?:\/\//.test(v) || /^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(v),
  { message: 'Debe ser una URL http(s) o una imagen (data URL).' },
)
```

Permite tanto URL externa como data URL.

### Render en WorldCupHero

```tsx
<Image
  src={logo}
  alt="..."
  unoptimized={logo.startsWith('http') || logo.startsWith('data:')}
  ...
/>
```

Con `unoptimized` en data URLs → no pasa por Next.js Image Optimizer (que requeriría resize backend).

### Probado

- Adjuntó PNG 150×150 px, 45 KB → se convierte a data URL, se guarda, se renderiza en banner.
- Editó después a 160×160 px, 60 KB → actualiza sin problemas.
- La imagen persiste tras refrescar la página.

---

## 23. Búsqueda por nombre/correo en admin/usuarios

### Qué es

Input de búsqueda en `/admin/usuarios` que filtra usuarios en tiempo real por:
- **Nombre** (substring case-insensitive)
- **Correo** (substring case-insensitive)

### Implementación

Client-side filter:
```ts
const nameQ = nameFilter.trim().toLowerCase()
const filtered = users?.filter((u) => {
  if (filter === 'PENDING' && u.status !== 'INACTIVE') return false
  if (filter === 'ACTIVE' && u.status !== 'ACTIVE') return false
  if (quinielaFilter !== 'ALL' && !u.memberships.some(m => m.quinielaId === quinielaFilter)) return false
  if (nameQ && !u.name.toLowerCase().includes(nameQ) && !u.email.toLowerCase().includes(nameQ)) return false
  return true
})
```

Funciona en conjunto con los filtros existentes (estado, quiniela).

### UI

Botones de estado (Todos, Pendientes, Activos) + dropdown de quiniela + **input con lupa:**
```tsx
<div className="relative">
  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
  <input
    type="text"
    placeholder="Buscar nombre o correo…"
    value={nameFilter}
    onChange={(e) => setNameFilter(e.target.value)}
    className="pl-8 pr-3 py-1.5 text-sm rounded-lg border..."
  />
</div>
```

### Probado

- Input "juan" → filtra usuarios con "juan" en el nombre (case-insensitive).
- Input "ejemplo@" → filtra por correo.
- Combinado con filtro de estado (Pendientes + "juan") → funciona correctamente.

---

## 24. Setup local + troubleshooting

### Setup

```bash
cd app_KI-Niela
npm install
npx prisma generate
cp .env.example .env.local   # editar con tus credenciales locales
createdb bd_kiniela
npx prisma migrate dev --name init
npx prisma db seed
npm run dev   # http://localhost:3001
```

### Troubleshooting

#### Emails no llegan en producción
1. `GET /api/admin/diag/mailer` → revisar que `BREVO_API_KEY_set: true` y `transport: 'brevo-http-api'`.
2. Brevo Security → IPs autorizadas → desactivar bloqueo para Claves API.
3. Logs de Railway → buscar `[mailer:brevo-api]`.
4. Spam folder.

#### Predicciones no se guardan
1. ¿El user es `ACTIVE` en la quiniela?
2. ¿El partido sigue en `PROGRAMADO` (no `BLOQUEADO`)?
3. DevTools → Network → ver el `POST /api/quinielas/:id/predictions/upsert`.
4. ¿El `useAutosave` recibe `onSave`/`onBlur` estables? Si re-renderiza, los inputs pierden el debounce.

#### Bot no genera predicciones
1. `Quiniela.randomPredictionsEnabled === true`
2. `QuinielaMember.autoPredictionsEnabled === true` para ese user
3. `QuinielaMember.status === 'ACTIVE'` y `role === 'PARTICIPANT'` (QUINIELA_ADMIN no recibe bot por diseño)
4. No hay predicción previa para ese match
5. El partido llegó a su ventana de bloqueo (`Date.now() >= kickoff - lockMinutes * 60_000`)
6. Cron `/api/jobs/generate-random-predictions` está corriendo

> Si el cron de sync-live-scores corrió primero y cambió el status a `EN_JUEGO`, el bot sigue funcionando porque evalúa la ventana temporal, no el status.

#### Un usuario no ve una quiniela (aislamiento)
- Si el usuario no tiene fila `QuinielaMember` en esa quiniela, no la verá. Solución: darle el código de invitación o que el admin lo agregue desde la página de participantes.
- Si tiene el código pero la quiniela está `ARCHIVED` o `CLOSED`, el `POST /api/quinielas/join` rechaza con 400 "La quiniela no está abierta."
- Si tenía membresía `INACTIVE` o `REJECTED`, el código no reactiva solo: un admin debe activarlo manualmente.

#### El botón "Unirme a una quiniela" no aparece
- Si el usuario tiene `globalRole === 'SUPER_ADMIN'`, el botón está oculto por diseño (el admin crea quinielas, no se une por código).

#### El código de invitación ya no funciona
- El admin puede haber regenerado el código. Pedir el nuevo desde Config → Código de invitación.
- Si se ingresa un código de una quiniela archivada: "La quiniela no está abierta."

#### Posiciones vacío pero el dashboard dice "Posición 1"
- Versión vieja: ya resuelto en §8. Si reaparece: revisar que ambos endpoints (`/leaderboard` y dashboard) excluyen `globalRole=SUPER_ADMIN` y agregan tail de members activos sin scores.

#### Auto-vincular no encuentra el partido
- Confirmar que ESPN reporta los nombres tal como esperamos: `fixtures` lista local/visitante.
- Agregar al alias group en `TEAM_ALIASES` (`src/app/admin/partidos/page.tsx`) si es un país nuevo.
- Verificar que `normalize()` ya cubre el conector (`y`, `e`, `and`, `&`). Si aparece un nuevo separador (guión bajo, slash) extender el regex.

#### Partido finalizado pero los puntos no se actualizaron
- `POST /api/jobs/recalculate-scores` con `x-cron-secret` y body `{}` recalcula todo. Con `{ "matchId": "..." }` recalcula solo uno.

#### El marcador / ganador aparece invertido vs ESPN
- ESPN reporta el fixture con local/visitante al revés que el calendario. El sync ya reconcilia orientación (§14), pero para datos previos al fix: `npx tsx scripts/fix-orientation.ts` (dry-run) y luego `--apply`.
- Si el sync **no** detecta la inversión, suele ser porque el nombre de ESPN no mapea: agregar el alias en `TEAM_ALIASES` (`src/lib/team-matching.ts`).
- Verificación integral de todo: `npx tsx scripts/verify-and-recalc.ts`.

---

## Commits relevantes (cronológicos)

| Commit | Tema |
|--------|------|
| `cb71b5b` | Quiniela Amistosos + flags expandidas |
| `6c10d06` | Perfil de usuario + dropdown header |
| `e494ef7` | Plantillas de emails transaccionales |
| `6e85433` | Switch visibilidad de quinielas |
| `f58ed96` | SSE + polling adaptativo para live updates |
| `f722775` | Switch live provider Sofascore → ESPN |
| `b3daf03` | Matching difuso EN/ES/FIFA |
| `a0e560f` | Toggle bot por participante |
| `b4a206f` | Fix mapStatus ESPN para "EN_JUEGO" |
| `ea0cbe1` | Editor inline de marcador manual |
| `18e96ff` | Fix autosave: predicciones perdidas al cambiar de página |
| `0b913a9` | Overlay full-screen al guardar |
| `3e82b1b` | Fix spinner "Guardando…" pegado |
| `238baf0` | Optimistic update en /admin/usuarios |
| `b7e9aeb` | Endpoint diag/mailer |
| `41f06a0` | Mailer Brevo HTTP API |
| `397209f` | Posiciones: incluir admins de quiniela + normalize "y" |
| `e7e3678` | Botón Desvincular siempre visible |
| `7c8706b` | Fix Zod externalProvider:null al desvincular |
| `72722c3` | Excluir SUPER_ADMIN del leaderboard y recalc |
| `6cc78f5` | docs: actualizar README, IMPLEMENTACION, GUIA y MARCADORES_EN_VIVO |
| `0b485c8` | feat(seed): clonar quiniela "DP-TI COPA MUNDO 2026" |
| `dbaa9ac` | feat(seed): script para sincronizar partidos estrella del Mundial 2026 |
| `4bd314e` | feat(seed): bracket eliminatorio Mundial 2026 con calendario FIFA oficial |
| `506e6d2` | fix(pronosticos): inputs de marcador solo aceptan números |
| `18d2d2c` | fix(pronosticos): quitar tope arbitrario de 20 goles |
| `5ceb0e6` | fix(admin/partidos): alias Catar para Qatar (ESPN en/es) |
| `51a86f8` | fix(live-sync): reconciliar orientación home/away contra ESPN |
| `fcae53c` | fix(scripts): idempotencia en fix-orientation + verify-and-recalc integral |
| `fbb3e37` | fix(competidores): filtrar QUINIELA_ADMIN en leaderboard, dashboard, bot, matrix |
| `5da5742` | fix(competidores): conservar Scores de admin, solo NO contarlos en posiciones |
| `f4c8229` | feat(quinielas): aislar por usuario + unirse por código de invitación |
| `aba5952` | style(quinielas): botón "Unirme a una quiniela" más vistoso y amigable |
| `eea1c05` | fix(quinielas): ocultar "Unirme con código" al SUPER_ADMIN |
| `e500a2a` | feat(admin/usuarios): ver quinielas de cada usuario + filtro por quiniela |
| `ab137d1` | fix(pronosticos): cero a la izquierda + scroll cortado en móvil |
| `f380505` | feat(bot): badge morado consistente para predicciones del bot |
| `8b38d18` | feat: importar torneos desde ESPN + borrar quiniela + fix banderas (#1) |
