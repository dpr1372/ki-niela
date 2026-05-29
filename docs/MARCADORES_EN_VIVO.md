# 📡 Marcadores en Vivo Automáticos

Ki-Niela sincroniza los marcadores de los partidos automáticamente desde una
API externa de fútbol (**API-Football**), con la opción de que el admin escriba
manualmente el marcador y la API deje de tocar ese partido.

```
                         ┌────────────────────────┐
                         │  API-Football (externa)│
                         │  fixtures live, goals  │
                         └───────────┬────────────┘
                                     │ cada 30s
                                     ▼
   /api/jobs/sync-live-scores  ───── escribe ───►   Match (BD)
                                                        │
                                                        ▼
   Si admin pulsa "Override" en panel  ─────────►   manualOverride=true
                                                    (la API ya no toca ese partido)
                                                        │
                                                        ▼
                                              SSE / polling /api/.../live
                                                        │
                                                        ▼
                                              Página /quinielas/:id/en-vivo
                                              (todos los jugadores la ven)
```

## 1. Conseguir el API key

### Opción A — Direct (recomendado, más barato)
1. Ve a https://www.api-football.com/
2. Crea cuenta y selecciona un plan:
   - **Free**: 100 requests/día (suficiente para 1 partido/día con polling 30s)
   - **Pro $19/mes**: 75,000 requests/día (cómodo para Mundial 2026 entero)
3. Tu key sale en el dashboard: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
4. **Host:** `v3.football.api-sports.io`

### Opción B — Vía RapidAPI
1. Ve a https://rapidapi.com/api-sports/api/api-football
2. Suscríbete a un plan
3. Tu key: `x-rapidapi-key` que sale en "Endpoints"
4. **Host:** `api-football-v1.p.rapidapi.com`

## 2. Configurar variables en Railway

```env
API_FOOTBALL_KEY=tu_api_key_aqui
API_FOOTBALL_HOST=v3.football.api-sports.io     # o api-football-v1.p.rapidapi.com
CRON_SECRET=<genera_uno_random_largo>
```

> Si `API_FOOTBALL_KEY` no está configurado, el job sale `skipped: true` sin error
> y el sistema sigue funcionando con override manual del admin.

## 3. Configurar el cron en Railway

Railway tiene **cron jobs nativos**. Crea uno con:

- **Schedule:** `*/30 * * * * *` (cada 30 segundos)
  - Si tu plan no soporta segundos, usa `* * * * *` (cada minuto)
- **Command:**
  ```bash
  curl -fsS -X POST \
    -H "x-cron-secret: $CRON_SECRET" \
    https://ki-niela-production.up.railway.app/api/jobs/sync-live-scores
  ```

Alternativas si no quieres cron en Railway:
- **Cron-job.org** (gratis, web UI): https://cron-job.org/
- **GitHub Actions** con `schedule: cron: "*/1 * * * *"`
- **Cloudflare Workers Cron Triggers**

## 4. Vincular cada partido con su fixture en API-Football

Una vez por evento (Mundial, Amistosos), tienes que mapear cada `Match` de Ki-Niela
con su `fixture id` correspondiente en API-Football.

### 4.1 Buscar fixtures en la API

```bash
# Por equipo + fecha
curl -H "x-apisports-key: TU_KEY" \
  "https://v3.football.api-sports.io/fixtures?league=1&season=2026"

# Por fecha exacta (todos los amistosos del 31 de mayo de 2026)
curl -H "x-apisports-key: TU_KEY" \
  "https://v3.football.api-sports.io/fixtures?date=2026-05-31"
```

Cada fixture tiene un `id` numérico. Copia ese id.

### 4.2 Vincular el partido

Como super admin, llama:

```bash
curl -X PATCH \
  -H "Cookie: <tu cookie de sesión>" \
  -H "Content-Type: application/json" \
  -d '{"externalId":"1234567"}' \
  https://ki-niela-production.up.railway.app/api/admin/matches/MATCH_ID/external
```

O agrega un input en `/admin/matches` (UI futura) con un campo "Fixture ID".

### 4.3 Forzar override manual en un partido

Si la API se equivoca o no cubre un partido:

```bash
curl -X PATCH ... -d '{"manualOverride":true}'
```

Y luego escribes el marcador manualmente vía
`PATCH /api/matches/:id/live` (ya existente, solo super admin).

> Cuando guardas un marcador manual, **automáticamente** se setea
> `manualOverride=true` y el cron deja de tocar ese partido para siempre.
> Para devolverle control a la API, manda `{"manualOverride":false}` al endpoint admin.

## 5. ¿Cómo se ve para el jugador?

En la página `/quinielas/:id/en-vivo`, cada partido muestra un badge:

- **⚡ AUTO** (verde): el marcador viene de la API en tiempo real
- **👤 MANUAL** (ámbar): el admin escribió el marcador a mano
- (sin badge): aún no ha empezado o no hay datos en vivo

Y en el header global de la página:

- **🟢 EN VIVO**: SSE conectado, recibe push en cuanto cambia algo
- **🔵 Sondeo**: SSE bloqueado, sondea cada 5s
- **⚪ Pausado**: pestaña en background

## 6. Costo estimado mensual (Mundial 2026)

Suponiendo 10 partidos/día durante el Mundial (junio 2026):

| Operación | Frecuencia | Requests/día |
|-----------|------------|--------------|
| Sync live (cron 30s) | mientras hay partidos en vivo (~24h totales por día con varios partidos) | ~2,880 |
| Mapping inicial | 1× por partido (manual) | ~100 total |

**Total aprox:** 90,000 requests/mes en el peor caso → plan **Pro $19/mes** alcanza.

## 7. Privacidad: no afecta a las predicciones

Toda la lógica de "antes del bloqueo solo ves tu predicción" sigue intacta:
- El cron solo escribe `liveHomeGoals/Away` y `status` en `Match`.
- Las predicciones de cada jugador siguen ocultas hasta que el partido pasa
  el umbral de bloqueo (10 min antes de `kickoffAtUtc`).
- Después del bloqueo + durante el juego, todos ven todas las predicciones
  con los puntos provisionales calculados contra el marcador en vivo.
- Al `FINALIZADO`, los puntos pasan a oficiales y el leaderboard se recalcula.

## 8. Apagar el sistema temporalmente

Si quieres dejar de usar la API y volver 100% manual:

1. Borra la variable `API_FOOTBALL_KEY` de Railway, o
2. Para el cron job en Railway

El sistema sigue funcionando completo — solo que ahora todos los marcadores
los escribe el admin a mano, exactamente como antes de esta integración.
