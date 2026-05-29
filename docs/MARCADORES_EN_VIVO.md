# 📡 Marcadores en Vivo Automáticos

Ki-Niela sincroniza los marcadores de los partidos automáticamente desde una
API gratuita (**Sofascore**, sin API key) y los empuja en tiempo real a todos
los jugadores conectados, vía Server-Sent Events. Cualquier admin puede tomar
control manual de un partido si la API no lo cubre o se equivoca.

```
                     ┌─────────────────────────────┐
                     │  Sofascore API (gratis)     │
                     │  fixtures, live goals       │
                     └──────────────┬──────────────┘
                                    │ cada 60s
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
                                          (todos los jugadores la ven —
                                          tanto en Amistosos como Mundial 2026,
                                          porque vincular es por Match, no por Quiniela)
```

## ✨ Lo bueno: NO necesitas API key ni pagar

Sofascore expone su API JSON públicamente (es la que usan su web y app móvil).
**Sin auth, sin registro, sin tarjeta**. Es lo que usa Ki-Niela por defecto.

> ⚠️ **Caveat honesto**: Sofascore no documenta oficialmente esta API como pública.
> Pueden cambiar URLs sin aviso (poco frecuente — sus apps móviles dependen de
> que se mantenga estable). Si un día deja de funcionar, simplemente vuelves al
> modo manual y todo sigue operando. La quiniela no se rompe.

## 1. Configurar el cron en Railway / cron-job.org

Necesitas que algo llame a `/api/jobs/sync-live-scores` cada minuto durante los
partidos.

### Opción A — cron-job.org (gratis, recomendado)

1. https://console.cron-job.org/jobs → **Create cronjob**
2. Configuración:
   - **URL:** `https://ki-niela-production.up.railway.app/api/jobs/sync-live-scores`
   - **Schedule:** Every 1 minute (`* * * * *`)
   - **Request method:** `POST`
   - **Headers:**
     ```
     x-cron-secret: <copia el valor de CRON_SECRET en Railway>
     ```
3. Save → Enable.

### Opción B — Railway Cron (si tu plan lo incluye)

```bash
* * * * *  curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" https://ki-niela-production.up.railway.app/api/jobs/sync-live-scores
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

## 2. Vincular cada partido con su event id de Sofascore

### Vía UI — la forma fácil (recomendada)

1. Login como super admin → click **"Partidos (Admin)"** en el sidebar
2. **Buscador**: pon la fecha (ej. `2026-05-30`) y opcionalmente filtro de torneo
   (`"Friendly"` para amistosos, `"World Cup"` para Mundial 2026), dale Buscar
3. Click **"✓ Auto-vincular partidos visibles por nombre"** — los partidos cuyos
   equipos coincidan se vinculan solos
4. Para los que no se mapearon, pulsa **Vincular** en cada fila y pega el ID
   que viste en la lista de fixtures encontrados
5. El switch **Auto/Manual** decide si el cron sincroniza ese partido o lo dejas
   para escribir el marcador a mano

### Vía curl — alternativa

```bash
curl -X PATCH \
  -H "Cookie: <tu cookie de sesión>" \
  -H "Content-Type: application/json" \
  -d '{"externalId":"12345678","externalProvider":"sofascore"}' \
  https://ki-niela-production.up.railway.app/api/admin/matches/MATCH_ID/external
```

## 3. ¿Cómo lo ven los jugadores?

En `/quinielas/:id/en-vivo`, cada partido muestra:

- **⚡ AUTO** (verde): el marcador viene de la API en tiempo real (ó del último sync ≤ 60s)
- **👤 MANUAL** (ámbar): el admin escribió el marcador a mano y bloqueó la API
- (sin badge): aún no ha empezado o no hay datos en vivo

Y arriba del todo:

- **🟢 EN VIVO**: SSE conectado, recibe push en cuanto cambia algo (~3s después)
- **🔵 Sondeo**: SSE bloqueado por proxy/firewall, sondea cada 5s
- **⚪ Pausado**: pestaña en background, ahorra recursos

## 4. Cobertura confirmada

| Competición | ¿Cubierta? |
|-------------|------------|
| **FIFA World Cup 2026** (id `16`, season `58210`) | ✅ Sí, completa |
| **Copa América** | ✅ Sí |
| **Copa Mundial Femenina** | ✅ Sí |
| **Champions League** | ✅ Sí |
| **Premier League / La Liga / Serie A / Bundesliga / Ligue 1** | ✅ Sí |
| **MLS / Liga MX / Brasileirão** | ✅ Sí |
| **Amistosos internacionales** | ⚠️ Parcial — los partidos importantes sí, pre-temporada de clubes a veces no |

Para los amistosos que NO estén en Sofascore, no pasa nada: la quiniela sigue
funcionando, simplemente alguien tendrá que escribir el marcador a mano (o no
escribirlo, y el sistema queda con ese partido sin puntos calculados hasta que
alguien lo cierre).

## 5. Funciona para TODAS las quinielas

La integración es a nivel de **`Match`**, no de quiniela. Significa que:

- Vinculas el partido **una sola vez** con su `externalId` de Sofascore
- El cron actualiza el `liveHomeGoals/Away` en la BD de ese `Match`
- Cuando finaliza, recalcula scores en **todas las quinielas** que incluyen ese
  partido (Amistosos, Mundial 2026, y cualquier futura)

## 6. Cambiar a API-Football (si algún día lo necesitas)

Si quieres pagar por más estabilidad / soporte oficial, puedes cambiar a
API-Football setando dos env vars en Railway:

```env
LIVE_PROVIDER=api-football
API_FOOTBALL_KEY=tu_key
API_FOOTBALL_HOST=v3.football.api-sports.io
```

Y reinicias. El código del cron es agnóstico, solo cambia la fuente.

## 7. Privacidad de predicciones intacta

El cron solo escribe en columnas del `Match` (goles, status). Las predicciones
de cada jugador siguen ocultas hasta que el partido pasa el umbral de bloqueo
(10 min antes de `kickoffAtUtc`). Después del bloqueo + durante el juego, todos
ven todas las predicciones con los puntos provisionales calculados contra el
marcador en vivo. Al `FINALIZADO`, los puntos pasan a oficiales y el
leaderboard se recalcula automáticamente.

## 8. Apagar el sistema temporalmente

Si quieres dejar de usar la API y volver 100% manual, simplemente para el cron
job (en Railway / cron-job.org). La app sigue funcionando completa — solo que
ahora todos los marcadores los escribe el admin a mano.
