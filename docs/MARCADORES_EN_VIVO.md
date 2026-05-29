# Marcadores en Vivo Automáticos

Ki-Niela sincroniza los marcadores de los partidos automáticamente desde **ESPN**
(API pública gratuita, sin API key) y los empuja en tiempo real a todos los
jugadores conectados, vía Server-Sent Events (con polling como fallback).
Cualquier admin puede tomar control manual de un partido si la API no lo cubre
o se equivoca.

```
                     ┌─────────────────────────────┐
                     │  ESPN site.api.espn.com     │
                     │  fixtures + live goals      │
                     │  (sin auth, sin key)        │
                     └──────────────┬──────────────┘
                                    │ cada 60 s
                                    ▼
   /api/jobs/sync-live-scores  ─── escribe ───►   Match (BD)
                                                       │
                                                       ▼
   Si admin pulsa "Manual" en panel  ──────────►   manualOverride=true
                                                   (la API ya no toca ese partido)
                                                       │
                                                       ▼
                                          SSE / polling /api/.../live
                                                       │
                                                       ▼
                                          Página /quinielas/:id/en-vivo
                                          (todos los jugadores de todas las quinielas
                                          que incluyan ese Match — la vinculación
                                          es por Match, no por Quiniela)
```

## Sin API key, sin tarjeta

ESPN expone su API JSON en `https://site.api.espn.com/apis/site/v2/sports/soccer/...`
públicamente (es la que usa su web). No requiere registro.

> **Caveat:** ESPN no documenta oficialmente esta API como pública para terceros.
> Pueden cambiar URLs sin aviso. Si un día deja de funcionar, basta con volver al
> modo manual y la quiniela sigue operando — el editor inline de marcadores en
> `/admin/partidos` permite escribir resultados a mano.

## 1. Configurar el cron

Necesitas que algo llame `POST /api/jobs/sync-live-scores` cada minuto durante
los partidos.

### Opción A — cron-job.org (gratis, recomendado)

1. <https://console.cron-job.org/jobs> → **Create cronjob**
2. Configuración:
   - **URL:** `https://ki-niela-production.up.railway.app/api/jobs/sync-live-scores`
   - **Schedule:** `* * * * *` (cada minuto)
   - **Method:** `POST`
   - **Headers:**
     ```
     x-cron-secret: <valor de CRON_SECRET en Railway>
     ```
3. Save → Enable.

Configura un segundo cron idéntico para los otros jobs:
- `/api/jobs/lock-matches` — cierra predicciones a `kickoff - lockMinutesBeforeMatch`
- `/api/jobs/generate-random-predictions` — bot aleatorio
- `/api/jobs/recalculate-scores` — recalcula puntos cuando hay resultado oficial

### Opción B — Railway Cron (si tu plan lo incluye)

```bash
* * * * *  curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" \
             https://ki-niela-production.up.railway.app/api/jobs/sync-live-scores
```

### Opción C — GitHub Actions

`.github/workflows/sync-live.yml`:
```yaml
on:
  schedule:
    - cron: '* * * * *'
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS -X POST \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET }}" \
            https://ki-niela-production.up.railway.app/api/jobs/sync-live-scores
```

## 2. Vincular cada partido con su event id de ESPN

### Vía UI — recomendado

1. Login como super admin → **Partidos (Admin)** en el sidebar
2. **Buscador**: pon la fecha (ej. `12/06/2026`) y opcionalmente filtro de torneo
   (`World Cup` para Mundial 2026, `Friendly` para amistosos), dale Buscar
3. Click **"Auto-vincular partidos visibles por nombre"** — los partidos cuyos
   equipos coincidan se vinculan solos. El matching es difuso: cubre
   inglés/español, acentos, conectores `y`/`and`, FIFA codes, etc.
4. Para los que no se mapearon, click **Vincular** en cada fila y pega el ID
   visible en la lista de fixtures encontrados (formato `fifa.world|760416`)
5. Una vez vinculado, en cada fila aparecen dos botones:
   - **Lápiz azul** → editar el external ID
   - **Unlink rojo** → desvincular (con confirmación)
6. El botón **Test sync** dispara un `/api/admin/sync-now` desde el browser
   para ver inmediatamente si la vinculación trae datos
7. **Limpiar IDs** borra TODAS las vinculaciones (útil al cambiar de proveedor)

### Vía curl

```bash
curl -X PATCH \
  -H "Cookie: <tu cookie de sesión>" \
  -H "Content-Type: application/json" \
  -d '{"externalId":"760416","externalProvider":"espn"}' \
  https://ki-niela-production.up.railway.app/api/admin/matches/MATCH_ID/external
```

Para desvincular, NO mandes `externalProvider: null` (Zod lo rechaza). Manda
solo `{ "externalId": null }`:

```bash
curl -X PATCH ... -d '{"externalId":null}' ...
```

## 3. Edición manual del marcador

Si un partido no está en ESPN o quieres corregir, en `/admin/partidos`:

1. Click el lápiz junto al marcador `— —`
2. Aparecen dos inputs (local/visitante) + select de status
   (`PROGRAMADO`/`BLOQUEADO`/`EN_JUEGO`/`FINALIZADO`)
3. Save → escribe a `Match.liveHomeGoals/liveAwayGoals/status` vía
   `PATCH /api/matches/:id/live`

Si ese partido tenía `externalId` vinculado, considera activar
`manualOverride=true` para que el cron deje de pisar tu valor.

## 4. ¿Cómo lo ven los jugadores?

En `/quinielas/:id/en-vivo`, cada partido muestra:

- **AUTO** (verde): el marcador viene de ESPN en tiempo real (último sync ≤ 60 s)
- **MANUAL** (ámbar): un admin escribió el marcador a mano y bloqueó la API
- (sin badge): aún no ha empezado o no hay datos en vivo

Y arriba del todo:

- **EN VIVO** (verde): SSE conectado, push <3 s después del cambio
- **Sondeo** (azul): SSE bloqueado por proxy/firewall, polling cada 5 s
- **Pausado** (gris): pestaña en background, ahorra recursos

## 5. Mapeo de status ESPN

ESPN reporta status en formato `state|detail` donde `state` es uno de
`pre|in|post` y `detail` es texto libre como `"FT"`, `"HT"`, `"41'"`,
`"Halftime"`, `"Full Time"`.

`src/lib/live-providers/espn.ts` codifica esto como `"in|41'"` para que
`mapStatus()` decodifique correctamente. Importante: las comprobaciones siguen
este orden (un orden distinto rompe casos):

1. `"in" + "halftime"` → `MEDIO_TIEMPO`
2. `"in" + "extra time"` → `TIEMPO_EXTRA`
3. `"in" + "penalt"` → `PENALES`
4. `"in" + cualquier otro detail` → `EN_JUEGO`
5. `"post" + /\bft\b/` → `FINALIZADO`
6. `"post"` cualquiera → `FINALIZADO`
7. `"pre"` → `PROGRAMADO`

Las comprobaciones de in-progress van **antes** de las de FT con regex de
word-boundary (`\bft\b`) — antes el detection naive `"halftime".includes("ft")`
disparaba `FINALIZADO` para partidos en medio tiempo.

## 6. Cobertura confirmada

| Competición | ¿Cubierta? |
|-------------|------------|
| **FIFA World Cup 2026** | ✅ Sí (formato `fifa.world|<eventId>`) |
| **Copa América / Eurocopa** | ✅ Sí |
| **Champions / Europa League** | ✅ Sí |
| **Premier League / La Liga / Serie A / Bundesliga / Ligue 1** | ✅ Sí |
| **MLS / Liga MX / Brasileirão** | ✅ Sí |
| **Amistosos internacionales** | ✅ Sí (filtro `Friendly`) — la mayoría aparecen |
| **Pre-temporada de clubes** | ⚠️ Parcial |

Si un amistoso no aparece, escribe el marcador a mano en `/admin/partidos`. La
quiniela sigue funcionando.

## 7. Funciona para TODAS las quinielas

La integración es a nivel de **`Match`**, no de quiniela:

- Vinculas el partido **una sola vez** con su `externalId` de ESPN
- El cron actualiza `liveHomeGoals/Away` en la BD del `Match`
- Cuando finaliza, recalcula scores en **todas las quinielas** que incluyen ese
  partido (Amistosos, Mundial 2026, y futuras)

## 8. Cambiar a API-Football u otro proveedor (opcional)

El código del cron es agnóstico: la única diferencia entre proveedores está en
`src/lib/live-providers/`. Para cambiar:

```env
LIVE_PROVIDER=api-football
API_FOOTBALL_KEY=tu_key
API_FOOTBALL_HOST=v3.football.api-sports.io
```

Y reinicias.

## 9. Privacidad de predicciones intacta

El cron solo escribe en columnas del `Match` (goles, status). Las predicciones
de cada jugador siguen ocultas hasta que el partido pasa el umbral de bloqueo
(10 min antes de `kickoffAtUtc`). Después del bloqueo + durante el juego, todos
los miembros de la quiniela ven todas las predicciones con los puntos
provisionales calculados contra el marcador en vivo. Al `FINALIZADO`, los puntos
pasan a oficiales y el leaderboard se recalcula automáticamente.

## 10. Apagar el sistema temporalmente

Si quieres dejar de usar la API y volver 100 % manual, simplemente para el cron
job (en cron-job.org / Railway). La app sigue funcionando — solo que ahora
todos los marcadores los escribe el admin a mano desde `/admin/partidos`.
