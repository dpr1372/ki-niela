# Requirements Checklist: Ki-Niela — Plataforma de Quinielas Deportivas Recreativas

**Purpose**: Verificar que todos los requisitos funcionales del spec estén implementados y funcionando correctamente antes de considerar el feature completo.
**Created**: 2026-05-25
**Feature**: [spec.md](../spec.md)

---

## Autenticación y Usuarios

- [ ] CHK001 Registro con correo electrónico y contraseña funciona correctamente
- [ ] CHK002 Login con credenciales válidas redirige a "Mis Quinielas"
- [ ] CHK003 Login con credenciales inválidas muestra error sin acceso
- [ ] CHK004 Logout destruye la sesión y redirige a Landing/Login
- [ ] CHK005 Recuperación de acceso por correo electrónico funciona
- [ ] CHK006 Actualización de perfil (nombre, correo) funciona
- [ ] CHK007 `DATABASE_URL` configurado en `.env.local`, no hardcodeado en código
- [ ] CHK008 `.env.local` está en `.gitignore` y no aparece en el repositorio

## Roles y Estados de Participante

- [ ] CHK009 Roles globales `SUPER_ADMIN` y `USER` existen y se aplican correctamente
- [ ] CHK010 Roles por quiniela `QUINIELA_ADMIN` y `PARTICIPANT` existen y se aplican correctamente
- [ ] CHK011 Estados de miembro `INVITED`, `PENDING_APPROVAL`, `ACTIVE`, `INACTIVE`, `REJECTED` existen
- [ ] CHK012 El registro de un usuario NO lo activa automáticamente en ninguna quiniela
- [ ] CHK013 Un usuario con `PENDING_APPROVAL` no puede registrar predicciones (backend rechaza)
- [ ] CHK014 Un usuario con `PENDING_APPROVAL` ve el mensaje "Tu usuario está pendiente de activación por el administrador."
- [ ] CHK015 Un usuario con `INACTIVE` no puede registrar predicciones (backend rechaza)
- [ ] CHK016 El `QUINIELA_ADMIN` puede activar participantes → toast "Usuario activado."
- [ ] CHK017 El `QUINIELA_ADMIN` puede desactivar participantes → toast "Usuario desactivado."
- [ ] CHK018 El `QUINIELA_ADMIN` puede cambiar roles dentro de la quiniela
- [ ] CHK019 La activación es por quiniela; un usuario puede tener estados distintos en quinielas distintas
- [ ] CHK020 Usuarios con `PENDING_APPROVAL` o `INACTIVE` no aparecen en la tabla de posiciones

## Multi-evento y Multi-quiniela

- [ ] CHK021 Se pueden crear múltiples eventos deportivos
- [ ] CHK022 Cada evento puede tener múltiples quinielas independientes
- [ ] CHK023 Un usuario puede participar en múltiples quinielas del mismo evento con predicciones distintas
- [ ] CHK024 Los puntos, predicciones y posiciones nunca se mezclan entre quinielas distintas
- [ ] CHK025 "Mis Quinielas" muestra tarjetas agrupadas por evento con todos los campos requeridos
- [ ] CHK026 Flujo login → eventos → quinielas → quiniela seleccionada funciona correctamente

## Predicciones y Autosave

- [ ] CHK027 Solo usuarios `ACTIVE` pueden registrar o editar predicciones
- [ ] CHK028 Autosave funciona con debounce de 500–800 ms sin botón "Guardar" obligatorio
- [ ] CHK029 Upsert de predicciones usa clave única `(quinielaId, userId, matchId)`
- [ ] CHK030 Estado visual "Guardando..." aparece durante el debounce/petición
- [ ] CHK031 Estado visual "Guardado" aparece al confirmar el guardado
- [ ] CHK032 Estado visual "Error al guardar" aparece en caso de fallo
- [ ] CHK033 Estado visual "Partido bloqueado" aparece para partidos no editables
- [ ] CHK034 Antes del bloqueo, cada usuario solo ve su propia predicción
- [ ] CHK035 Después del bloqueo, todos los miembros de la quiniela ven todas las predicciones del partido
- [ ] CHK036 En eliminatorias, predicciones solo disponibles cuando equipos reales están asignados

## Bloqueo de Partidos

- [ ] CHK037 Cada partido se bloquea individualmente según `lockMinutesBeforeMatch` antes del kickoff
- [ ] CHK038 El bloqueo se calcula en zona `America/Costa_Rica`; fechas internas en UTC
- [ ] CHK039 Backend rechaza predicciones para partidos bloqueados → toast "El partido ya está bloqueado."
- [ ] CHK040 Frontend deshabilita inputs para partidos bloqueados
- [ ] CHK041 El bloqueo de un partido no afecta a otros partidos de la misma jornada
- [ ] CHK042 Si el partido se bloquea durante el autosave, el backend rechaza y el frontend notifica

## Partidos Estrella

- [ ] CHK043 El `QUINIELA_ADMIN` puede marcar y desmarcar partidos como estrella (excepto la Final)
- [ ] CHK044 La Final siempre es estrella y no se puede desmarcar; el sistema rechaza el intento
- [ ] CHK045 El ícono de estrella aparece correctamente en todas las vistas relevantes
- [ ] CHK046 `QuinielaStarMatch` es por quiniela; mismo partido puede ser estrella en una y no en otra

## Pronósticos Automáticos (Bot)

- [ ] CHK047 Bot genera predicción solo si `randomPredictionsEnabled=true` en la quiniela
- [ ] CHK048 Bot genera predicción solo si `autoPredictionsEnabled=true` en el participante
- [ ] CHK049 Bot genera predicción solo si el participante tiene `status=ACTIVE`
- [ ] CHK050 Bot genera predicción solo si no existe predicción previa para ese `(quinielaId, userId, matchId)`
- [ ] CHK051 Bot genera predicción solo cuando el partido llega al momento de bloqueo
- [ ] CHK052 Las predicciones del bot tienen valores aleatorios entre `randomMinGoals` y `randomMaxGoals`
- [ ] CHK053 Las predicciones del bot tienen `generatedByBot=true` y quedan bloqueadas inmediatamente
- [ ] CHK054 Bot nunca genera predicciones duplicadas (respeta unique constraint)
- [ ] CHK055 Admin activa/desactiva `randomPredictionsEnabled` → toasts correctos
- [ ] CHK056 Participante ACTIVE activa/desactiva `autoPredictionsEnabled` → toasts correctos

## Puntuación

- [ ] CHK057 Partido normal exacto=3 puntos
- [ ] CHK058 Partido normal ganador correcto=1 punto
- [ ] CHK059 Partido normal empate correcto=1 punto
- [ ] CHK060 Partido normal sin acierto=0 puntos
- [ ] CHK061 Partido estrella exacto=5 puntos
- [ ] CHK062 Partido estrella ganador correcto=3 puntos
- [ ] CHK063 Partido estrella empate correcto=3 puntos
- [ ] CHK064 Partido estrella sin acierto=0 puntos
- [ ] CHK065 En eliminatorias, resultado válido es marcador a 90'/120', penales no cuentan
- [ ] CHK066 Escenario: predicción 1-1, resultado 120' 1-1, penales 4-2 → 3 pts (normal) / 5 pts (estrella)
- [ ] CHK067 Escenario: predicción 2-1, resultado 120' 1-1, penales 4-2 → 0 pts
- [ ] CHK068 Al guardar resultado oficial, el sistema recalcula puntos automáticamente
- [ ] CHK069 Cada `Score` incluye `points`, `reason` e `isStarMatch`
- [ ] CHK070 Toast "Resultado oficial guardado." aparece tras guardar resultado
- [ ] CHK071 Toast "Puntos recalculados correctamente." aparece tras recálculo exitoso

## Tabla de Posiciones y Estadísticas

- [ ] CHK072 Tabla general muestra posiciones ordenadas por `totalPoints` descendente
- [ ] CHK073 Desempate: mayor cantidad de exactos, luego orden alfabético
- [ ] CHK074 Tabla provisional rotulada "Puntuación en vivo" durante partidos en curso
- [ ] CHK075 Tabla por jornada disponible y filtrable
- [ ] CHK076 Tabla por fase disponible y filtrable
- [ ] CHK077 Estadísticas generales, por jornada, por fase y usuario disponibles con filtros

## Matriz de Predicciones

- [ ] CHK078 Matriz muestra filas=usuarios, columnas=partidos
- [ ] CHK079 Matriz ordenada por puntos descendente
- [ ] CHK080 En móvil, scroll horizontal en la matriz con columna de usuario fija
- [ ] CHK081 Badges/colores para exacto, ganador, empate, sin puntos, bot y estrella
- [ ] CHK082 Pre-bloqueo: predicciones de otros usuarios ocultas en la matriz
- [ ] CHK083 Post-bloqueo: predicciones de todos los usuarios visibles en la matriz

## Configuración de Quiniela

- [ ] CHK084 El `QUINIELA_ADMIN` puede editar nombre, visibilidad, estado, código de invitación
- [ ] CHK085 El `QUINIELA_ADMIN` puede configurar `randomMinGoals`, `randomMaxGoals`, `lockMinutesBeforeMatch`
- [ ] CHK086 La quiniela tiene defaults correctos: `randomPredictionsEnabled=true`, rango 0-7, lock=10 min, tz=America/Costa_Rica
- [ ] CHK087 Configuración de quiniela solo accesible para `QUINIELA_ADMIN` y `SUPER_ADMIN`

## Seguimiento en Vivo

- [ ] CHK088 Estados del partido cubren: `PROGRAMADO`, `BLOQUEADO`, `EN_JUEGO`, `MEDIO_TIEMPO`, `TIEMPO_EXTRA`, `PENALES`, `FINALIZADO`, `POSTERGADO`, `CANCELADO`
- [ ] CHK089 Marcador en vivo muestra "Puntos provisionales" rotulados claramente
- [ ] CHK090 La integración de proveedor en vivo es desacoplada (no afecta lógica core si falla o cambia)

## Jobs Automáticos

- [ ] CHK091 Endpoint `POST /api/jobs/lock-matches` bloquea partidos que llegaron al momento de bloqueo
- [ ] CHK092 Endpoint `POST /api/jobs/generate-random-predictions` genera predicciones bot pendientes
- [ ] CHK093 Endpoint `POST /api/jobs/recalculate-scores` recalcula puntajes cuando se solicita
- [ ] CHK094 Los endpoints de jobs están protegidos (no accesibles públicamente sin autenticación/secret)

## PWA y UI

- [ ] CHK095 App instalable como PWA en Android
- [ ] CHK096 App instalable como PWA en iOS
- [ ] CHK097 UI mobile-first responsive funciona correctamente en viewport ≤375px
- [ ] CHK098 Todos los horarios en frontend muestran en zona `America/Costa_Rica`
- [ ] CHK099 Navbar superior y menú inferior móvil funcionan correctamente
- [ ] CHK100 Toasts no bloqueantes visibles en móvil y desktop con los textos correctos en español

## Restricciones de Negocio

- [ ] CHK101 No existe ningún campo, endpoint, UI o lógica relacionada con apuestas, pagos, dinero real o gambling
- [ ] CHK102 Backend es la fuente de verdad para bloqueo, permisos y puntos (no solo validación frontend)
- [ ] CHK103 No hay credenciales hardcodeadas en ningún archivo versionado

## Notes

- Marcar items completados con `[x]`
- Agregar comentarios o hallazgos inline si se detectan desvíos
- CHK001–CHK013 corresponden al MVP mínimo (P1 stories)
- Items CHK056–CHK103 corresponden a features P2/P3
