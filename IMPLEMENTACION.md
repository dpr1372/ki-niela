# Ki-Niela — Documentación de Implementación

Changelog narrativo de las features e integraciones del proyecto. Cuenta el **qué**, el **por qué** y el **cómo probar/operar**. Para arquitectura general ver [`GUIA_COMPLETA.md`](GUIA_COMPLETA.md); para integración de marcadores ver [`docs/MARCADORES_EN_VIVO.md`](docs/MARCADORES_EN_VIVO.md).

> **Última revisión:** 2026-05-29

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
11. [Setup local + troubleshooting](#11-setup-local--troubleshooting)

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

## 11. Setup local + troubleshooting

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
3. `QuinielaMember.status === 'ACTIVE'`
4. No hay predicción previa para ese match
5. Cron `/api/jobs/generate-random-predictions` está corriendo

#### Posiciones vacío pero el dashboard dice "Posición 1"
- Versión vieja: ya resuelto en §8. Si reaparece: revisar que ambos endpoints (`/leaderboard` y dashboard) excluyen `globalRole=SUPER_ADMIN` y agregan tail de members activos sin scores.

#### Auto-vincular no encuentra el partido
- Confirmar que ESPN reporta los nombres tal como esperamos: `fixtures` lista local/visitante.
- Agregar al alias group en `TEAM_ALIASES` (`src/app/admin/partidos/page.tsx`) si es un país nuevo.
- Verificar que `normalize()` ya cubre el conector (`y`, `e`, `and`, `&`). Si aparece un nuevo separador (guión bajo, slash) extender el regex.

#### Partido finalizado pero los puntos no se actualizaron
- `POST /api/jobs/recalculate-scores` con `x-cron-secret` y body `{}` recalcula todo. Con `{ "matchId": "..." }` recalcula solo uno.

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
