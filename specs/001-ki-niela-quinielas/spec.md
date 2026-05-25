# Feature Specification: Ki-Niela — Plataforma de Quinielas Deportivas Recreativas

**Feature Branch**: `001-ki-niela-quinielas`

**Created**: 2026-05-24

**Status**: Draft

---

> **AVISO LEGAL / LEGAL NOTICE**: La aplicación Ki-Niela es una quiniela recreativa de puntos,
> **sin apuestas monetarias, sin dinero real, sin integración de pagos y sin funcionalidades de gambling**.
> El objetivo es competir por puntos entre usuarios. No se almacena, transfiere ni gestiona dinero de ningún tipo.

---

## User Scenarios & Testing

### User Story 1 — Registro, Login y Acceso a Mis Quinielas (Priority: P1)

Un usuario nuevo se registra con correo electrónico, inicia sesión y ve la pantalla "Mis Quinielas" donde aparecen los eventos disponibles y las quinielas en las que participa o puede unirse.

**Why this priority**: Es la puerta de entrada a toda la plataforma. Sin autenticación y pantalla inicial no hay funcionalidad utilizable.

**Independent Test**: Crear un usuario, iniciar sesión, verificar que se muestra "Mis Quinielas" con el estado correcto. Entregable: registro + login funcionales.

**Acceptance Scenarios**:

1. **Given** un visitante no autenticado, **When** abre la app, **Then** ve la pantalla Landing/Login con el nombre "Ki-Niela" y opciones de registro e inicio de sesión.
2. **Given** un formulario de registro completo con correo y contraseña válidos, **When** el usuario lo envía, **Then** se crea la cuenta y se redirige a "Mis Quinielas".
3. **Given** credenciales correctas en el formulario de login, **When** el usuario inicia sesión, **Then** ve "Mis Quinielas" con las quinielas disponibles.
4. **Given** un usuario autenticado, **When** hace logout, **Then** se destruye la sesión y se redirige a Landing/Login.
5. **Given** credenciales incorrectas, **When** intenta hacer login, **Then** ve un mensaje de error y no accede.

---

### User Story 2 — Solicitud de Acceso y Activación por Admin (Priority: P1)

Un usuario registrado solicita unirse a una quiniela. Queda en estado PENDING_APPROVAL. El admin de esa quiniela lo activa. El usuario pasa a ACTIVE y puede registrar predicciones.

**Why this priority**: Define el flujo de participación. Sin activación por admin no hay predicciones válidas.

**Independent Test**: Usuario solicita acceso → queda pendiente, no puede predecir → admin lo activa → puede predecir. Entregable: flujo completo de activación por quiniela.

**Acceptance Scenarios**:

1. **Given** un usuario ACTIVE en la plataforma sin membresía en una quiniela, **When** solicita unirse, **Then** se crea `QuinielaMember` con `status=PENDING_APPROVAL`.
2. **Given** un usuario con `status=PENDING_APPROVAL`, **When** intenta registrar una predicción, **Then** el backend rechaza con toast "Tu usuario aún no está activo en esta quiniela." y el frontend muestra el mensaje "Tu usuario está pendiente de activación por el administrador."
3. **Given** un `QUINIELA_ADMIN` en la pantalla de participantes, **When** activa a un usuario pendiente, **Then** `QuinielaMember.status` cambia a `ACTIVE` y aparece toast "Usuario activado."
4. **Given** un usuario `ACTIVE` en la quiniela A, **When** solicita unirse a la quiniela B del mismo evento, **Then** queda `PENDING_APPROVAL` en B, su estado en A no cambia.
5. **Given** un admin que desactiva a un participante `ACTIVE`, **When** confirma la acción, **Then** `status` cambia a `INACTIVE` y aparece toast "Usuario desactivado."

---

### User Story 3 — Registro de Predicciones con Autosave (Priority: P1)

Un usuario ACTIVE navega a "Pronósticos por Jornada", introduce marcadores partido por partido. El sistema guarda automáticamente sin botón "Guardar".

**Why this priority**: Es el corazón de la app — sin predicciones no hay puntuación.

**Independent Test**: Usuario activo introduce un marcador → debounce 500–800 ms → se guarda → estado visual "Guardado". Entregable: autosave end-to-end.

**Acceptance Scenarios**:

1. **Given** un usuario ACTIVE, **When** escribe un marcador en un partido no bloqueado, **Then** después de 500–800 ms el estado muestra "Guardando..." y luego "Guardado".
2. **Given** un usuario ACTIVE con predicción existente, **When** cambia el marcador, **Then** el sistema hace upsert por `(quinielaId, userId, matchId)` y muestra "Guardado".
3. **Given** un partido ya bloqueado, **When** el usuario intenta guardar un marcador, **Then** el backend rechaza, el frontend muestra "Partido bloqueado" y el toast "El partido ya está bloqueado."
4. **Given** un usuario con `status=INACTIVE`, **When** intenta guardar una predicción, **Then** el backend rechaza con toast "Tu usuario aún no está activo en esta quiniela."
5. **Given** error de red durante el autosave, **When** falla la petición, **Then** el estado visual muestra "Error al guardar" y el usuario puede reintentar.
6. **Given** un partido no bloqueado, **When** otro usuario en la misma quiniela consulta las predicciones de ese partido, **Then** solo ve su propia predicción, no la de otros.

---

### User Story 4 — Bloqueo Individual de Partidos (Priority: P1)

Cada partido se bloquea automáticamente 10 minutos antes de su hora oficial de inicio (zona America/Costa_Rica). Después del bloqueo nadie puede crear, editar ni eliminar predicciones para ese partido.

**Why this priority**: Garantiza la integridad del juego. Es un requisito de negocio no negociable.

**Independent Test**: Configurar un partido con kickoff en T. En T-10 min verificar que el backend rechaza predicciones. Entregable: lógica de bloqueo backend verificable.

**Acceptance Scenarios**:

1. **Given** un partido con `kickoffAtUtc` en T, **When** el momento actual es anterior a T-10 min (CR), **Then** el partido está `ABIERTO` y acepta predicciones.
2. **Given** un partido con `kickoffAtUtc` en T, **When** el momento actual supera T-10 min (CR), **Then** el partido pasa a `BLOQUEADO` y el backend rechaza cualquier upsert de predicción.
3. **Given** una jornada con tres partidos en distintos horarios, **When** el primero se bloquea, **Then** los otros dos siguen aceptando predicciones.
4. **Given** un usuario que estaba editando un marcador cuando el partido se bloqueó, **When** el autosave intenta guardar, **Then** el backend rechaza y el toast muestra "El partido ya está bloqueado."
5. **Given** la pantalla de pronósticos después del bloqueo de un partido, **When** el usuario consulta ese partido, **Then** ve las predicciones de todos los participantes de la quiniela.

---

### User Story 5 — Cálculo Automático de Puntos (Priority: P1)

El admin registra el resultado oficial de un partido. El sistema recalcula automáticamente los puntos de todos los participantes de todas las quinielas que contienen ese partido.

**Why this priority**: Sin puntuación no hay tabla ni competencia.

**Independent Test**: Registrar resultado → verificar tabla general con puntos correctos para todos los participantes. Entregable: cálculo end-to-end con reglas de puntuación completas.

**Acceptance Scenarios**:

1. **Given** un partido con predicciones registradas, **When** el admin guarda el resultado oficial, **Then** el sistema crea/actualiza registros `Score` para cada predicción con el puntaje correcto y el motivo.
2. **Given** predicción 2-1 y resultado oficial 2-1 (partido normal), **When** se calcula, **Then** `Score.points=3` y `Score.reason="Marcador exacto"`.
3. **Given** predicción 2-0 y resultado oficial 3-0 (partido normal), **When** se calcula, **Then** `Score.points=1` y `Score.reason="Ganador correcto"`.
4. **Given** predicción 1-1 y resultado oficial 1-1 (partido normal), **When** se calcula, **Then** `Score.points=3` y `Score.reason="Marcador exacto"`.
5. **Given** predicción 2-0 y resultado oficial 1-1 (partido normal), **When** se calcula, **Then** `Score.points=0` y `Score.reason="Sin acierto"`.
6. **Given** partido estrella, predicción 1-0 y resultado oficial 2-0, **When** se calcula, **Then** `Score.points=3` y `Score.reason="Ganador correcto"` (puntuación estrella).
7. **Given** la Final (siempre estrella), predicción 1-1 y resultado oficial 1-1 a 90', sin tiempo extra, **When** se calcula, **Then** `Score.points=5`.
8. **Given** partido de eliminatoria que va a penales, predicción 1-1, marcador a 120' 1-1, penales 4-2 Argentina, **When** se calcula, **Then** `Score.points=3` (exacto estrella) usando marcador 120', penales ignorados.
9. **Given** partido de eliminatoria, predicción 2-1 Argentina, marcador a 120' 1-1, penales 4-2 Argentina, **When** se calcula, **Then** `Score.points=0` (predicción incorrecta, resultado válido fue empate 1-1).

---

### User Story 6 — Tabla General y Posiciones (Priority: P2)

Los participantes de una quiniela ven la tabla de posiciones acumulada con puntos totales, posición en el ranking y diferenciación entre puntos oficiales y provisionales.

**Why this priority**: Motivación principal de los participantes; sin posiciones no hay competencia percibida.

**Independent Test**: Con resultados registrados, verificar orden correcto en tabla por puntos. Entregable: endpoint `/api/quinielas/:id/leaderboard` con datos correctos.

**Acceptance Scenarios**:

1. **Given** participantes con distintos puntajes, **When** se consulta el leaderboard general, **Then** aparecen ordenados por `totalPoints` descendente con posición numérica correcta.
2. **Given** dos participantes con el mismo puntaje, **When** se consulta el leaderboard, **Then** se aplican criterios de desempate definidos (más exactos primero, luego orden alfabético).
3. **Given** un partido en juego con marcador provisional, **When** se consulta el leaderboard, **Then** aparece una tabla rotulada "Puntuación en vivo" con puntos provisionales separados.
4. **Given** un participante con `status=PENDING_APPROVAL` o `INACTIVE`, **When** se consulta el leaderboard, **Then** no aparece en la tabla.

---

### User Story 7 — Configuración de Quiniela y Pronósticos Automáticos (Priority: P2)

El QUINIELA_ADMIN configura la quiniela (nombre, visibilidad, rango de goles, minutos de bloqueo, switch de pronósticos aleatorios). El participante activa/desactiva sus propios pronósticos automáticos.

**Why this priority**: Customización esencial para diferentes grupos de usuarios.

**Independent Test**: Admin cambia `randomPredictionsEnabled=false` → bot no genera para nadie. Participante desactiva `autoPredictionsEnabled` → bot no genera para ese usuario aunque la quiniela tenga bots activos. Entregable: doble compuerta verificable.

**Acceptance Scenarios**:

1. **Given** quiniela con `randomPredictionsEnabled=true`, **When** un partido llega al momento de bloqueo y un participante ACTIVE no tiene predicción y tiene `autoPredictionsEnabled=true`, **Then** el bot genera una predicción aleatoria dentro del rango configurado.
2. **Given** quiniela con `randomPredictionsEnabled=false`, **When** un partido llega al bloqueo, **Then** el bot no genera predicciones para ningún participante.
3. **Given** quiniela con `randomPredictionsEnabled=true` y un participante con `autoPredictionsEnabled=false`, **When** un partido llega al bloqueo, **Then** el bot NO genera predicción para ese participante.
4. **Given** participante con `status=PENDING_APPROVAL` o `INACTIVE`, **When** un partido llega al bloqueo, **Then** el bot NO genera predicción para ese participante aunque la quiniela tenga bots activos.
5. **Given** un admin en la pantalla de configuración, **When** desactiva pronósticos aleatorios, **Then** aparece toast "Pronósticos aleatorios deshabilitados."
6. **Given** un participante ACTIVE en su perfil de quiniela, **When** desactiva sus predicciones automáticas, **Then** aparece toast "Predicciones automáticas desactivadas."

---

### User Story 8 — Partidos Estrella y Puntuación Especial (Priority: P2)

El QUINIELA_ADMIN puede marcar partidos como estrella. Los partidos estrella tienen puntuación especial. La Final siempre es estrella en todas las quinielas y no se puede desmarcar.

**Why this priority**: Diferencia la experiencia y añade estrategia al juego.

**Independent Test**: Marcar un partido como estrella → verificar que la puntuación usa los valores especiales. Entregable: ícono estrella visible + puntuación correcta en Score.

**Acceptance Scenarios**:

1. **Given** un admin en la pantalla de configuración, **When** marca un partido como estrella, **Then** aparece ícono estrella en ese partido en todas las vistas.
2. **Given** la Final del torneo, **When** el admin intenta desmarcarla como estrella, **Then** el sistema rechaza la operación.
3. **Given** partido estrella, predicción exacta, **When** se calcula el puntaje, **Then** `Score.points=5`.
4. **Given** partido estrella, ganador correcto (marcador incorrecto), **When** se calcula el puntaje, **Then** `Score.points=3`.

---

### User Story 9 — Estadísticas y Matriz de Predicciones (Priority: P3)

Los participantes pueden ver estadísticas por jornada, fase y una matriz de predicciones (filas=usuarios, columnas=partidos) con badges de colores para exacto/ganador/empate/sin puntos/bot/estrella.

**Why this priority**: Enriquece la experiencia pero no bloquea el juego básico.

**Independent Test**: Con varios partidos finalizados, verificar que la matriz muestra correctamente predicciones, puntos y badges. Entregable: endpoint `/api/quinielas/:id/prediction-matrix` con privacidad correcta.

**Acceptance Scenarios**:

1. **Given** partidos finalizados en una quiniela, **When** un participante consulta la matriz, **Then** ve una tabla con filas por usuario y columnas por partido, ordenada por puntos descendente.
2. **Given** un partido aún no bloqueado, **When** cualquier participante consulta la matriz, **Then** solo ve su propia predicción; las de otros aparecen ocultas.
3. **Given** una predicción generada por bot, **When** aparece en la matriz, **Then** muestra un badge/indicador "bot".
4. **Given** pantalla en móvil, **When** la matriz tiene muchas columnas, **Then** hay scroll horizontal y la columna de usuario queda fija.

---

### User Story 10 — Administración Global (SUPER_ADMIN) (Priority: P3)

El SUPER_ADMIN gestiona eventos, equipos, estadios, partidos, usuarios globales y quinielas desde una sección de administración separada.

**Why this priority**: Necesario para el ciclo de vida completo del torneo, pero puede implementarse en una fase posterior al MVP básico.

**Independent Test**: SUPER_ADMIN crea un evento con equipos y partidos → aparece disponible para crear quinielas. Entregable: CRUD de eventos/partidos funcional.

**Acceptance Scenarios**:

1. **Given** un SUPER_ADMIN autenticado, **When** navega a Administración Global, **Then** ve secciones para Eventos, Equipos, Estadios, Partidos, Usuarios y Quinielas.
2. **Given** un evento creado por SUPER_ADMIN, **When** un QUINIELA_ADMIN crea una quiniela, **Then** puede seleccionar ese evento.
3. **Given** un SUPER_ADMIN, **When** registra el resultado oficial de un partido, **Then** el sistema recalcula puntos automáticamente en todas las quinielas que contienen ese partido.

---

### Edge Cases

- ¿Qué sucede si el partido se bloquea mientras el usuario tiene el formulario de predicción abierto con cambios no guardados?
  → El debounce intentará guardar, el backend rechaza con `"El partido ya está bloqueado."`, el frontend muestra el estado "Partido bloqueado" y deshabilita los inputs.
- ¿Qué pasa con una predicción generada por bot si luego el admin cambia `randomPredictionsEnabled=false`?
  → Las predicciones ya generadas no se eliminan. El cambio afecta generaciones futuras.
- ¿Qué ocurre en eliminatorias si los equipos aún no están definidos (placeholders)?
  → Los partidos con placeholder no habilitan predicciones hasta que se asignen equipos reales.
- ¿Qué pasa si un partido de eliminatoria termina empatado a 120' y uno avanza por penales?
  → Para la quiniela, el resultado válido es el marcador a 120' (empate). Los penales no cuentan para puntaje. `wentToPenalties=true` se registra pero `Score` usa el marcador a 120'.
- ¿Puede un usuario estar activo en varias quinielas del mismo evento?
  → Sí. La activación es siempre por `QuinielaMember` (quinielaId + userId). Las predicciones en cada quiniela son independientes.
- ¿Qué pasa si el mismo partido es estrella en una quiniela y no en otra?
  → `QuinielaStarMatch` es por quiniela. La puntuación se calcula por quiniela de forma independiente.

---

## Requirements

### Functional Requirements

**Autenticación y Usuarios**
- **FR-001**: El sistema DEBE permitir registro con correo electrónico y contraseña.
- **FR-002**: El sistema DEBE permitir login, logout y recuperación de acceso por correo.
- **FR-003**: El sistema DEBE permitir actualizar el perfil del usuario (nombre, correo).
- **FR-004**: Las credenciales de base de datos DEBEN gestionarse mediante `DATABASE_URL` en `.env.local`, nunca hardcodeadas ni versionadas.
- **FR-005**: `.env.local` DEBE estar en `.gitignore`.

**Roles y Estados**
- **FR-006**: El sistema DEBE soportar roles globales `SUPER_ADMIN` y `USER`.
- **FR-007**: El sistema DEBE soportar roles por quiniela: `QUINIELA_ADMIN` y `PARTICIPANT`.
- **FR-008**: El sistema DEBE soportar estados de miembro por quiniela: `INVITED`, `PENDING_APPROVAL`, `ACTIVE`, `INACTIVE`, `REJECTED`.
- **FR-009**: El registro de un usuario en la plataforma NO DEBE activarlo automáticamente en ninguna quiniela.
- **FR-010**: El `QUINIELA_ADMIN` DEBE poder activar, desactivar, rechazar y cambiar el rol de participantes en su quiniela.
- **FR-011**: La activación DEBE ser por quiniela. Un usuario puede tener estados distintos en quinielas distintas.

**Multi-evento y Multi-quiniela**
- **FR-012**: El sistema DEBE soportar múltiples eventos deportivos simultáneos.
- **FR-013**: Cada evento PUEDE tener múltiples quinielas independientes.
- **FR-014**: Un usuario PUEDE participar en múltiples quinielas, incluso del mismo evento, con predicciones distintas.
- **FR-015**: El sistema NUNCA debe mezclar puntos, predicciones ni posiciones entre quinielas distintas.
- **FR-016**: La pantalla "Mis Quinielas" DEBE mostrar tarjetas agrupadas por evento con: nombre del evento, nombre de quiniela, estado, # participantes activos, estado del usuario, puntos, posición, botón Entrar y botón Configurar (si admin).

**Predicciones**
- **FR-017**: Solo usuarios con `QuinielaMember.status=ACTIVE` PUEDEN registrar o editar predicciones.
- **FR-018**: El autosave DEBE funcionar con debounce de 500–800 ms sin botón "Guardar" obligatorio.
- **FR-019**: El upsert de predicciones DEBE ser por la clave única `(quinielaId, userId, matchId)`.
- **FR-020**: Los estados visuales de autosave DEBEN ser: "Guardando...", "Guardado", "Error al guardar", "Partido bloqueado".
- **FR-021**: Antes del bloqueo de un partido, cada usuario SOLO ve su propia predicción para ese partido.
- **FR-022**: Después del bloqueo de un partido, todos los miembros de la quiniela ven todas las predicciones de ese partido.
- **FR-023**: En eliminatorias, las predicciones solo están disponibles cuando los equipos reales (no placeholders) estén asignados al partido.

**Bloqueo de partidos**
- **FR-024**: Cada partido DEBE bloquearse individualmente `lockMinutesBeforeMatch` minutos antes de su hora oficial de inicio.
- **FR-025**: El bloqueo DEBE calcularse en zona `America/Costa_Rica`; las fechas internas se almacenan en UTC.
- **FR-026**: Después del bloqueo, el backend DEBE rechazar cualquier intento de crear, editar o eliminar predicciones para ese partido.
- **FR-027**: El frontend DEBE deshabilitar los inputs de predicción para partidos bloqueados.
- **FR-028**: El bloqueo es por partido individual; otros partidos de la misma jornada no se ven afectados.

**Partidos estrella**
- **FR-029**: El `QUINIELA_ADMIN` PUEDE marcar partidos como estrella. La Final SIEMPRE es estrella y no se puede desmarcar.
- **FR-030**: Los partidos estrella DEBEN mostrar ícono de estrella en todas las vistas relevantes.
- **FR-031**: `QuinielaStarMatch` es por quiniela; el mismo partido puede ser estrella en una quiniela y no en otra.

**Pronósticos automáticos (bot)**
- **FR-032**: La quiniela tiene `randomPredictionsEnabled` (default `true`). El participante tiene `autoPredictionsEnabled`. El bot genera predicción SOLO si AMBAS condiciones son `true`, el participante está `ACTIVE` y no tiene predicción previa para ese partido.
- **FR-033**: El bot genera predicciones con valores aleatorios entre `randomMinGoals` (default 0) y `randomMaxGoals` (default 7).
- **FR-034**: Las predicciones generadas por bot tienen `generatedByBot=true` y quedan bloqueadas inmediatamente.
- **FR-035**: El bot respeta la restricción única `(quinielaId, userId, matchId)` y nunca duplica.
- **FR-036**: El bot NO genera para usuarios con `status != ACTIVE`.
- **FR-037**: El admin PUEDE activar/desactivar `randomPredictionsEnabled` en la configuración de la quiniela.
- **FR-038**: El participante ACTIVE PUEDE activar/desactivar `autoPredictionsEnabled` en su perfil de quiniela.

**Puntuación**
- **FR-039**: Puntuación partido normal: exacto=3, ganador correcto=1, empate correcto=1, sin acierto=0.
- **FR-040**: Puntuación partido estrella: exacto=5, ganador correcto=3, empate correcto=3, sin acierto=0.
- **FR-041**: En eliminatorias, el resultado válido para puntuación es el marcador a 90' o 120' si hubo tiempo extra. Los penales NO cuentan.
- **FR-042**: Si el marcador a 120' es empate, se considera empate para la quiniela aunque alguien avance por penales.
- **FR-043**: Al guardar/actualizar un resultado oficial, el sistema DEBE recalcular automáticamente: puntos por partido, tabla general, tabla por jornada, tabla por fase, estadísticas y logs de cálculo.
- **FR-044**: Cada registro `Score` DEBE incluir: quiniela, evento, usuario, partido, predicción, puntos, motivo y `isStarMatch`.

**Seguimiento en vivo**
- **FR-045**: El marcador en vivo DEBE mostrarse como "Puntuación en vivo" / "Puntos provisionales"; los puntos definitivos solo se asignan con el resultado oficial.
- **FR-046**: La integración con el proveedor de marcadores en tiempo real DEBE ser desacoplada e intercambiable sin afectar la lógica de negocio.
- **FR-047**: Los estados del partido DEBEN ser: `PROGRAMADO`, `BLOQUEADO`, `EN_JUEGO`, `MEDIO_TIEMPO`, `TIEMPO_EXTRA`, `PENALES`, `FINALIZADO`, `POSTERGADO`, `CANCELADO`.

**Vistas**
- **FR-048**: La vista "Pronósticos por Jornada" DEBE tener tabs dinámicos (General, Inauguración, Días, Jornadas, Fases) con inputs de marcador, estado de autosave, ícono estrella y hora en Costa Rica.
- **FR-049**: La vista "Posiciones" DEBE mostrar ranking por puntos con desempates definidos.
- **FR-050**: La vista "Estadísticas" DEBE incluir filtros por jornada, fase, usuario, estrella, manual/bot, finalizados/en juego/pendientes.
- **FR-051**: La "Matriz de predicciones" DEBE: filas=usuarios, columnas=partidos, scroll horizontal en móvil, columna de usuario fija si posible, badges para exacto/ganador/empate/sin puntos/bot/estrella.
- **FR-052**: La app DEBE ser PWA compatible con Android, iOS y web.
- **FR-053**: La UI DEBE ser mobile-first responsive.

**Jobs automáticos**
- **FR-054**: El sistema DEBE tener jobs para: bloqueo de partidos, generación de pronósticos aleatorios y recálculo de puntos, expuestos como endpoints seguros en `/api/jobs/`.

**Toasts**
- **FR-055**: El sistema DEBE mostrar toasts no bloqueantes para: "Usuario activado.", "Usuario desactivado.", "Marcador guardado.", "Marcador actualizado.", "No se pudo guardar el marcador.", "Tu usuario aún no está activo en esta quiniela.", "El partido ya está bloqueado.", "Pronósticos aleatorios habilitados.", "Pronósticos aleatorios deshabilitados.", "Predicciones automáticas activadas.", "Predicciones automáticas desactivadas.", "Resultado oficial guardado.", "Puntos recalculados correctamente.", "Error al recalcular puntos.", "Quiniela creada.", "Invitación enviada.", "Participante agregado.", "Participante eliminado.", "Rol actualizado.", y "Tu usuario está pendiente de activación por el administrador." (informativo, no toast de error).

**Restricciones de negocio (no negociables)**
- **FR-056**: La app NO implementa apuestas monetarias, pagos, dinero real ni funcionalidades de gambling de ningún tipo.
- **FR-057**: El backend es la fuente de verdad para bloqueo, permisos y puntos. Las validaciones frontend son solo UX.

### Key Entities

- **User**: Cuenta de usuario con rol global (`SUPER_ADMIN`/`USER`), estado (`ACTIVE`/`INACTIVE`), correo único.
- **Event**: Evento deportivo (Mundial FIFA 2026, Copa América, etc.) con fechas, deporte, timezone.
- **Quiniela**: Instancia de quiniela ligada a un evento. Tiene configuración propia (`randomPredictionsEnabled`, `lockMinutesBeforeMatch`, `randomMinGoals`, `randomMaxGoals`, `inviteCode`, visibilidad, estado).
- **QuinielaMember**: Membresía de un usuario en una quiniela. Unique por `(quinielaId, userId)`. Tiene `role`, `status` y `autoPredictionsEnabled`.
- **Team**: Equipo del evento con código FIFA, bandera y grupo.
- **Stadium**: Estadio con ciudad y país.
- **Matchday**: Jornada/fase del evento con número y fase.
- **Match**: Partido con equipos (o placeholders), estadio, jornada, fase, horario UTC, estado, resultados en vivo, oficial, penal y flags `wentToExtraTime`, `wentToPenalties`.
- **QuinielaStarMatch**: Indicador de partido estrella por quiniela. Unique `(quinielaId, matchId)`.
- **Prediction**: Predicción de un usuario para un partido en una quiniela. Unique `(quinielaId, userId, matchId)`. Tiene `generatedByBot`, `lockedAt`.
- **Score**: Puntaje calculado por predicción. Unique `(quinielaId, userId, matchId)`. Tiene `points`, `reason`, `isStarMatch`.
- **AuditLog**: Registro de acciones: actor, acción, entidad, valores previo/nuevo.

---

## Success Criteria

- **SC-001**: Un usuario puede registrarse, iniciar sesión y cerrar sesión sin errores.
- **SC-002**: Un admin puede activar un participante y el participante puede inmediatamente registrar predicciones.
- **SC-003**: Las predicciones se guardan automáticamente en ≤800 ms tras el último keystroke sin acción manual del usuario.
- **SC-004**: El backend rechaza 100% de los intentos de guardar predicciones después del momento de bloqueo.
- **SC-005**: El cálculo de puntos produce resultados correctos para los 9 escenarios de puntuación definidos (incluyendo penales en eliminatorias).
- **SC-006**: La tabla general muestra posiciones correctas tras cada actualización de resultado oficial.
- **SC-007**: El bot genera predicciones aleatorias únicamente para participantes que cumplen las 5 condiciones simultáneas.
- **SC-008**: Un usuario puede participar en dos quinielas del mismo evento con predicciones distintas sin interferencia.
- **SC-009**: La app funciona como PWA instalable en Android, iOS y web.
- **SC-010**: Todos los horarios en el frontend se muestran en zona `America/Costa_Rica`.
- **SC-011**: La matriz de predicciones oculta predicciones de otros usuarios para partidos no bloqueados.
- **SC-012**: La Final siempre aparece como partido estrella y no puede desmarcarse.
- **SC-013**: No hay datos monetarios, de pagos ni de gambling en ninguna parte del sistema.

---

## Assumptions

- Los usuarios acceden principalmente desde móvil (Android/iOS); desktop es secundario pero soportado.
- La base de datos PostgreSQL local `bd_kiniela` existe y está operativa en `localhost:5432`.
- El proveedor de marcadores en vivo se integrará en una fase futura; la arquitectura lo soporta pero no se implementa en v1.
- Los datos del Mundial FIFA 2026 (equipos, estadios, partidos de grupos) se cargarán mediante seed inicial; los partidos de eliminatorias se completarán conforme avance el torneo.
- La recuperación de contraseña requiere acceso a servidor SMTP; la configuración SMTP se define en `.env.local`.
- El desempate en tabla cuando dos usuarios tienen los mismos puntos usa: 1) mayor cantidad de marcadores exactos, 2) orden alfabético por nombre.
- Los jobs automáticos (`/api/jobs/`) se invocan mediante un scheduler externo (cron) o webhook; no requieren un daemon en proceso dentro de Next.js para v1.
- La referencia visual "Quineliando" se usa ÚNICAMENTE para inspiración de UX (estructura de layout, colores deportivos). No se copia ningún logo, código, imagen, marca, texto ni asset de terceros.
