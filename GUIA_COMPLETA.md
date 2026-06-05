# 🏆 Ki-Niela: Guía Completa para Desarrolladores

**Versión:** 1.5
**Última actualización:** 2026-06-01
**Audiencia:** Programadores de cualquier nivel (junior → senior)

---

## Tabla de Contenidos

1. [Introducción & Concepto](#introducción--concepto)
2. [Stack Técnico](#stack-técnico)
3. [Estructura del Proyecto](#estructura-del-proyecto)
4. [Base de Datos PostgreSQL](#base-de-datos-postgresql)
5. [Autenticación & Seguridad](#autenticación--seguridad)
6. [Frontend: Componentes & Páginas](#frontend-componentes--páginas)
7. [Backend: Endpoints API](#backend-endpoints-api)
8. [Lógica de Negocio](#lógica-de-negocio)
9. [Flujos de Uso](#flujos-de-uso)
10. [Deployment & DevOps](#deployment--devops)

---

## Introducción & Concepto

### ¿Qué es Ki-Niela?

Una plataforma web de **quinielas deportivas recreativas** (sin dinero real, solo competencia por puntos).

**Usuarios predicen marcadores** de partidos en diferentes eventos (Mundial 2026, Amistosos, etc.) y acumulan puntos automáticamente según reglas de puntuación predefinidas.

### Características Principales

✅ **Multi-evento**: Soporta cualquier competición — create en 1 clic desde ESPN (Champions, Copa Oro, Copa América, Eurocopa, Libertadores, Mundial, Amistosos)  
✅ **Multi-quiniela**: Varias quinielas por evento (Familiar, Amigos, Oficina, etc.) con aislamiento total  
✅ **Roles flexibles**: Super Admin, Admin por quiniela, Participantes  
✅ **Importar torneos desde ESPN**: Trae automáticamente equipos, estadios, partidos, fases. Re-sincroniza sin duplicar.  
✅ **Borrar quiniela**: Solo admin, con doble confirmación. No afecta el torneo ni otras quinielas.  
✅ **Pronósticos automáticos**: Bot genera predicciones aleatorias si el usuario lo permite  
✅ **Cálculo automático de puntos**: Sistema automático basado en resultados oficiales  
✅ **Banderas/escudos en vivo**: Logos de equipos (clubes y selecciones) de ESPN en pronósticos, matriz y dashboard  
✅ **Banner personalizable por evento**: Cada torneo puede tener su propio logo, línea amarilla y subtítulo (editable en `/admin/torneos`)  
✅ **Uploader de imágenes**: Adjunta logos de hasta 800 KB (se guardan como data URL en BD, persisten en Railway)  
✅ **Búsqueda en admin**: Filtra usuarios por nombre o correo en `/admin/usuarios`  
✅ **Mantenimiento de eventos**: Archivar (reversible) o borrar (definitivo, con cascada y doble confirmación) torneos completos desde `/admin/torneos`. Los archivados no aparecen en ningún combo  
✅ **Filtros avanzados**: Búsqueda por nombre/correo en la lista de participantes de cada quiniela. Opción "Sin quiniela" en admin para ver usuarios sin membresías  
✅ **Responsive**: Mobile-first, compatible Android/iOS/Web  
✅ **PWA**: Puede instalarse como app en dispositivos  

### Público Objetivo

- ⚽ Amigos que quieren competir en copa mundial
- 👥 Equipos de oficina
- 👨‍👩‍👧‍👦 Grupos familiares
- 🏆 Comunidades deportivas recreativas

---

## Stack Técnico

### Frontend
| Tecnología | Versión | Propósito |
|------------|---------|----------|
| **Next.js** | 16.2.6 | Framework React fullstack |
| **React** | 19.2.4 | UI library |
| **Tailwind CSS** | 4 | Estilos responsivos |
| **React Hook Form** | 7.76.1 | Gestión de formularios |
| **Zod** | 4.4.3 | Validación de datos |
| **React Query** | 5.100.14 | Cache y sincronización con servidor |
| **Lucide React** | 1.16.0 | Iconos SVG |
| **Sonner** | 2.0.7 | Toast notifications |

### Backend
| Tecnología | Versión | Propósito |
|------------|---------|----------|
| **Next.js API Routes** | 16.2.6 | REST endpoints |
| **NextAuth.js** | 5.0.0-beta | Autenticación con email |
| **Prisma ORM** | 7.8.0 | ORM para BD |
| **bcryptjs** | 3.0.3 | Hash de contraseñas |
| **Nodemailer** | 7.0.13 | Envío de emails |
| **date-fns-tz** | 3.2.0 | Manejo de zonas horarias |

### Base de Datos
| Tecnología | Versión | Propósito |
|------------|---------|----------|
| **PostgreSQL** | 12+ | BD relacional principal |
| **Prisma** | 7.8.0 | ORM & migrations |

### Infraestructura
| Servicio | Propósito |
|----------|----------|
| **Railway** | Hosting en producción (Docker, Next standalone) |
| **Brevo HTTP API** | Envío de emails (HTTPS:443, único transport que pasa el bloqueo de SMTP outbound de Railway) |
| **ESPN site.api.espn.com** | Proveedor gratis de marcadores en vivo (sin API key) |
| **cron-job.org** | Disparador de jobs cada minuto (sync, lock, bot, recalc) |
| **Next.js Standalone** | Output mode para Railway |

### Testing & Development
| Herramienta | Versión | Propósito |
|------------|---------|----------|
| **Vitest** | 4.1.7 | Unit testing |
| **Testing Library** | 16.3.2 | Componentes testing |
| **TypeScript** | 5 | Type safety |

---

## Estructura del Proyecto

```
app_KI-Niela/
├── src/
│   ├── app/                              # Next.js App Router
│   │   ├── api/                          # Endpoints REST
│   │   │   ├── auth/                     # Autenticación
│   │   │   │   ├── register/
│   │   │   │   ├── login/
│   │   │   │   └── logout/
│   │   │   ├── me/                       # Perfil del usuario
│   │   │   ├── admin/                    # Panel super admin
│   │   │   │   ├── users/
│   │   │   │   └── quinielas/
│   │   │   ├── events/                   # Gestión de eventos
│   │   │   ├── quinielas/                # Gestión de quinielas
│   │   │   │   ├── [id]/members/         # Participantes
│   │   │   │   └── [id]/predictions/     # Predicciones
│   │   │   ├── matches/                  # Partidos
│   │   │   └── jobs/                     # Tareas programadas
│   │   ├── (auth)/                       # Grupo de rutas sin navbar
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── quinielas/                    # Mis quinielas (user)
│   │   ├── admin/                        # Panel super admin
│   │   ├── perfil/                       # Perfil del usuario
│   │   └── layout.tsx                    # Layout principal
│   ├── components/
│   │   ├── layout/
│   │   │   └── AppShell.tsx              # Navbar + estructura
│   │   ├── ui/                           # Componentes básicos
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── switch.tsx
│   │   │   └── ... (shadcn components)
│   │   ├── CrearQuinielaButton.tsx
│   │   ├── RequestAccessButton.tsx
│   │   └── ... (componentes específicos)
│   ├── lib/
│   │   ├── prisma.ts                     # Conexión Prisma
│   │   ├── auth.ts                       # NextAuth config
│   │   ├── mailer.ts                     # sendMail() con dual transport (Brevo HTTP / SMTP)
│   │   ├── mailer-templates.ts           # Plantillas HTML transaccionales
│   │   ├── scoring.ts                    # Cálculo de puntos (3/1/0 normal, 5/3/0 estrella)
│   │   ├── timezone.ts                   # Manejo de zonas horarias America/Costa_Rica
│   │   ├── lock.ts                       # isMatchLocked(kickoff, lockMinutes)
│   │   ├── flags.ts                      # Mapping FIFA-3 → ISO-2 banderas
│   │   ├── quiniela-auth.ts              # getMemberContext / checkQuinielaAuth
│   │   ├── live-providers/               # Sources de marcadores en vivo
│   │   │   ├── espn.ts                   # Proveedor activo (sin API key)
│   │   │   └── api-football.ts           # Alternativa de pago
│   │   └── utils.ts                      # cn() y otras utilidades
│   ├── hooks/
│   │   ├── useAutosave.ts                # Debounce 350ms + sendBeacon en navigation
│   │   └── useLiveScore.ts               # SSE + polling fallback
│   ├── types/
│   │   └── next-auth.d.ts                # Tipos NextAuth
│   ├── providers/
│   │   └── QueryProvider.tsx             # React Query provider
│   ├── __tests__/                        # Tests unitarios
│   │   ├── scoring.test.ts               # Reglas 3/1/0 + estrella + eliminatorias
│   │   ├── timezone.test.ts              # Conversión UTC ↔ Costa_Rica
│   │   ├── bot-gate.test.ts              # Doble compuerta del bot
│   │   └── espn.test.ts                  # mapStatus + parseEvent
│   └── proxy.ts                          # Middleware /api/jobs y /api/health
├── prisma/
│   ├── schema.prisma                     # Schema BD
│   ├── migrations/                       # Migration history
│   └── seed.ts                           # Script de datos iniciales
├── scripts/
│   └── seed-amistosos.ts                 # Crear quiniela amistosos (idempotente)
├── public/                               # Assets estáticos
├── package.json                          # Dependencias
├── tsconfig.json                         # TypeScript config
├── next.config.ts                        # Next.js config
├── railway.toml                          # Config Railway
├── .env.local                            # Vars de ambiente (gitignore)
└── .env.example                          # Ejemplo de .env

```

---

## Base de Datos PostgreSQL

### Diagrama Relacional

```
User ─────┬─→ Quiniela (createdBy)
          ├─→ QuinielaMember
          ├─→ Prediction
          ├─→ Score
          └─→ AuditLog (actor)

Event ────┬─→ Quiniela
          ├─→ Team
          ├─→ Stadium
          ├─→ Matchday
          └─→ Match
               ├─→ Prediction
               └─→ Score

Quiniela ─┬─→ QuinielaMember
          ├─→ Prediction
          ├─→ Score
          └─→ QuinielaStarMatch

Team ─────┬─→ Match (homeTeam)
          ├─→ Match (awayTeam)
          └─→ Match (winnerTeam)

Match ────┬─→ QuinielaStarMatch
          ├─→ Prediction
          └─→ Score

Prediction ──→ Score
```

### Tablas Principales

#### **User**
Almacena información de usuarios registrados.

```sql
CREATE TABLE User (
  id VARCHAR PRIMARY KEY,                -- UUID unique
  name VARCHAR NOT NULL,                 -- Nombre del usuario
  email VARCHAR UNIQUE NOT NULL,         -- Email único
  passwordHash VARCHAR NOT NULL,         -- Contraseña hasheada con bcryptjs
  globalRole ENUM('SUPER_ADMIN','USER') DEFAULT 'USER',
  status ENUM('ACTIVE','INACTIVE') DEFAULT 'ACTIVE',
  createdAt TIMESTAMP DEFAULT now(),
  updatedAt TIMESTAMP DEFAULT now()
);
```

**Roles globales:**
- `SUPER_ADMIN`: Crea eventos, administra plataforma
- `USER`: Registra, solicita acceso a quinielas

**Estados globales:**
- `ACTIVE`: Usuario puede participar en quinielas
- `INACTIVE`: Usuario bloqueado (no puede entrar ni ver quinielas)

#### **Event**
Define los eventos deportivos (mundial, amistosos, etc.).

```sql
CREATE TABLE Event (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,                 -- Ej. "FIFA World Cup 2026"
  description TEXT,
  sport VARCHAR DEFAULT 'football',      -- Ej. football, basketball, etc.
  startDate TIMESTAMP NOT NULL,          -- Inicio del evento
  endDate TIMESTAMP NOT NULL,            -- Fin del evento
  timezone VARCHAR DEFAULT 'America/Costa_Rica',
  status VARCHAR DEFAULT 'ACTIVE',       -- ACTIVE, CLOSED, ARCHIVED
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

#### **Quiniela**
Una competencia dentro de un evento (puede haber varias por evento).

```sql
CREATE TABLE Quiniela (
  id VARCHAR PRIMARY KEY,
  eventId VARCHAR REFERENCES Event(id),
  name VARCHAR NOT NULL,                 -- Ej. "Ki-Niela Mundial 2026"
  description TEXT,
  visibility ENUM('PUBLIC','PRIVATE','INVITE_ONLY'),
  status ENUM('ACTIVE','CLOSED','ARCHIVED'),
  randomPredictionsEnabled BOOLEAN DEFAULT true,  -- ¿Bot genera predicciones?
  randomMinGoals INT DEFAULT 0,          -- Rango de goles aleatorios
  randomMaxGoals INT DEFAULT 7,
  lockMinutesBeforeMatch INT DEFAULT 10, -- Minutos antes del partido
  timezone VARCHAR DEFAULT 'America/Costa_Rica',
  inviteCode VARCHAR UNIQUE,             -- Código para unirse (ej. "AMISTOSOS2026")
  createdByUserId VARCHAR REFERENCES User(id),
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

#### **QuinielaMember**
Registro de participación: qué usuarios están en qué quinielas.

```sql
CREATE TABLE QuinielaMember (
  id VARCHAR PRIMARY KEY,
  quinielaId VARCHAR REFERENCES Quiniela(id),
  userId VARCHAR REFERENCES User(id),
  role ENUM('QUINIELA_ADMIN','PARTICIPANT'),
  status ENUM('INVITED','PENDING_APPROVAL','ACTIVE','INACTIVE','REJECTED'),
  autoPredictionsEnabled BOOLEAN DEFAULT true,  -- ¿Usuario quiere bot?
  joinedAt TIMESTAMP,
  approvedAt TIMESTAMP,                  -- Cuando admin lo activó
  approvedByUserId VARCHAR REFERENCES User(id),
  deactivatedAt TIMESTAMP,
  deactivatedByUserId VARCHAR REFERENCES User(id),
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP,
  UNIQUE(quinielaId, userId)             -- Un usuario solo una vez por quiniela
);
```

**Estados del miembro:**
- `INVITED`: Invitado, no ha respondido
- `PENDING_APPROVAL`: Solicitó acceso, espera activación del admin
- `ACTIVE`: Activado, puede registrar predicciones
- `INACTIVE`: Desactivado, no puede participar
- `REJECTED`: Rechazado

#### **Team**
Equipos que participan en un evento.

```sql
CREATE TABLE Team (
  id VARCHAR PRIMARY KEY,
  eventId VARCHAR REFERENCES Event(id),
  name VARCHAR NOT NULL,                 -- Ej. "Argentina"
  fifaCode VARCHAR,                      -- Ej. "ARG" (ISO 3-letter)
  flagUrl VARCHAR,                       -- URL de la bandera
  groupCode VARCHAR,                     -- Ej. "A", "B", etc. (grupos)
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

#### **Stadium**
Estadios donde se juegan los partidos.

```sql
CREATE TABLE Stadium (
  id VARCHAR PRIMARY KEY,
  eventId VARCHAR REFERENCES Event(id),
  name VARCHAR NOT NULL,                 -- Ej. "Estadio Azteca"
  city VARCHAR NOT NULL,                 -- Ej. "México"
  country VARCHAR NOT NULL,              -- Ej. "Mexico"
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

#### **Matchday**
Jornadas del evento (Día 1, Octavos, Semis, etc.).

```sql
CREATE TABLE Matchday (
  id VARCHAR PRIMARY KEY,
  eventId VARCHAR REFERENCES Event(id),
  name VARCHAR NOT NULL,                 -- Ej. "Jornada 1", "Octavos"
  number INT,                            -- 1, 2, 3, 16, 8, etc.
  phase ENUM('GROUPS','ROUND_OF_16',... ,'FINAL'),
  startDate TIMESTAMP,
  endDate TIMESTAMP,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

#### **Match**
Partidos individuales.

```sql
CREATE TABLE Match (
  id VARCHAR PRIMARY KEY,
  eventId VARCHAR REFERENCES Event(id),
  homeTeamId VARCHAR REFERENCES Team(id),
  awayTeamId VARCHAR REFERENCES Team(id),
  placeholderHomeName VARCHAR,           -- Si equipo aún desconocido (Ganador Grupo A)
  placeholderAwayName VARCHAR,
  stadiumId VARCHAR REFERENCES Stadium(id),
  matchdayId VARCHAR REFERENCES Matchday(id),
  phase ENUM(...),                       -- GROUPS, ROUND_OF_16, FINAL, etc.
  groupCode VARCHAR,                     -- Grupo (si aplica)
  kickoffAtUtc TIMESTAMP NOT NULL,       -- Hora UTC del partido
  kickoffAtCostaRica TIMESTAMP,          -- Hora Costa Rica
  status ENUM('PROGRAMADO','BLOQUEADO','EN_JUEGO','MEDIO_TIEMPO','TIEMPO_EXTRA','PENALES','FINALIZADO','POSTERGADO','CANCELADO'),
  liveHomeGoals INT,                     -- Goles en vivo
  liveAwayGoals INT,
  officialHomeGoals INT,                 -- Goles oficiales (del resultado final)
  officialAwayGoals INT,
  penaltyHomeGoals INT,                  -- Goles en penales (si aplica)
  penaltyAwayGoals INT,
  winnerTeamId VARCHAR REFERENCES Team(id),
  wentToExtraTime BOOLEAN,               -- ¿Hubo tiempo extra?
  wentToPenalties BOOLEAN,               -- ¿Fue a penales?
  liveUpdatedAt TIMESTAMP,
  resultConfirmedAt TIMESTAMP,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

#### **Prediction**
Predicciones individuales de usuarios (qué marcador predicen).

```sql
CREATE TABLE Prediction (
  id VARCHAR PRIMARY KEY,
  quinielaId VARCHAR REFERENCES Quiniela(id),
  eventId VARCHAR REFERENCES Event(id),
  userId VARCHAR REFERENCES User(id),
  matchId VARCHAR REFERENCES Match(id),
  predictedHomeGoals INT NOT NULL,       -- Goles local predichos (ej. 2)
  predictedAwayGoals INT NOT NULL,       -- Goles visitante predichos (ej. 1)
  generatedByBot BOOLEAN DEFAULT false,  -- ¿Fue generada automáticamente?
  lockedAt TIMESTAMP,                    -- Cuándo fue bloqueada
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP,
  UNIQUE(quinielaId, userId, matchId)    -- Un usuario no puede predecir 2 veces lo mismo
);
```

#### **Score**
Puntos obtenidos por cada predicción (resultado del cálculo).

```sql
CREATE TABLE Score (
  id VARCHAR PRIMARY KEY,
  quinielaId VARCHAR REFERENCES Quiniela(id),
  eventId VARCHAR REFERENCES Event(id),
  userId VARCHAR REFERENCES User(id),
  matchId VARCHAR REFERENCES Match(id),
  predictionId VARCHAR UNIQUE REFERENCES Prediction(id),
  points INT NOT NULL,                   -- Puntos: 0, 1, 3 (general), 0, 3, 5 (estrella)
  reason VARCHAR,                        -- "Marcador exacto", "Ganador correcto", etc.
  isStarMatch BOOLEAN,                   -- ¿Fue partido estrella?
  calculatedAt TIMESTAMP DEFAULT now(),
  UNIQUE(quinielaId, userId, matchId)
);
```

#### **QuinielaStarMatch**
Marca cuáles partidos son "estrella" (puntuación doble) en cada quiniela.

```sql
CREATE TABLE QuinielaStarMatch (
  id VARCHAR PRIMARY KEY,
  quinielaId VARCHAR REFERENCES Quiniela(id),
  matchId VARCHAR REFERENCES Match(id),
  isStar BOOLEAN DEFAULT true,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP,
  UNIQUE(quinielaId, matchId)
);
```

**Nota:** La final SIEMPRE es estrella automáticamente.

#### **AuditLog**
Registro de cambios en el sistema (quién hizo qué y cuándo).

```sql
CREATE TABLE AuditLog (
  id VARCHAR PRIMARY KEY,
  actorUserId VARCHAR REFERENCES User(id),
  action VARCHAR NOT NULL,               -- "QUINIELA_STATUS_CHANGED", "USER_ACTIVATED"
  entityType VARCHAR,                    -- "Quiniela", "User", "Match"
  entityId VARCHAR,                      -- ID de la entidad
  oldValue JSON,                         -- Valor anterior (si aplica)
  newValue JSON,                         -- Valor nuevo
  createdAt TIMESTAMP
);
```

---

## Autenticación & Seguridad

### Flujo de Autenticación

```
1. Usuario entra a /register
2. Completa nombre, email, password
3. POST /api/auth/register
   ├─ Valida datos con Zod
   ├─ Hashea password con bcryptjs (salt rounds: 12)
   ├─ Crea User en BD con status='INACTIVE'
   ├─ Envía 2 emails (bienvenida + notificación admin)
   └─ Responde: "Cuenta creada, pendiente de activación"

4. Admin revisa /admin/usuarios
5. Ve usuario INACTIVE
6. Click "Activar"
7. PATCH /api/admin/users/:id { action: 'activate' }
   ├─ NextAuth session valida
   ├─ Verifica que admin es SUPER_ADMIN
   ├─ Actualiza User.status = 'ACTIVE'
   ├─ Envía email de activación al usuario
   └─ Toast: "Usuario activado"

8. Usuario ahora puede hacer login
9. POST /api/auth/login (NextAuth)
   ├─ Valida email + password
   ├─ Verifica User.status === 'ACTIVE'
   ├─ Si no activo: rechaza login
   ├─ Si activo: crea session & JWT token
   └─ Redirige a /quinielas

10. Usuario logueado
11. Click logout → destruye session
12. Redirige a /login
```

### NextAuth Configuration

**`src/auth.ts`**
```typescript
import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    CredentialsProvider({
      // Email + password provider
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // 1. Valida estructura
        // 2. Busca usuario en BD
        // 3. Verifica contraseña con compareSync(bcryptjs)
        // 4. Retorna usuario si OK, null si no
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      // Agrega datos custom al JWT token
      if (user) token.globalRole = user.globalRole
      return token
    },
    session({ session, token }) {
      // Expone datos custom en session
      session.user.globalRole = token.globalRole
      return session
    },
  },
})
```

### Roles & Autorización

**Roles globales (User.globalRole):**
- `SUPER_ADMIN`: Acceso a `/admin`, puede crear eventos, ver todas las quinielas
- `USER`: Usuario regular, puede crear quinielas y participar

**Roles por quiniela (QuinielaMember.role):**
- `QUINIELA_ADMIN`: Admin de esa quiniela, puede invitar, activar usuarios, cambiar config
- `PARTICIPANT`: Participante normal, solo puede registrar predicciones

**Middleware de autorización:**

```typescript
// Proteger rutas según rol global
if (!session.user.globalRole === 'SUPER_ADMIN') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// Proteger rutas según rol en quiniela
import { checkQuinielaAuth } from '@/lib/quiniela-auth'
const canModify = await checkQuinielaAuth(quinielaId, userId, 'QUINIELA_ADMIN')
if (!canModify) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

---

## Frontend: Componentes & Páginas

### Estructura de Componentes

#### **Layout: AppShell**

Navbar + Sidebar móvil compartido por toda la app.

```
AppShell
├── Header (Navbar)
│   ├── Logo "Ki-Niela"
│   ├── Breadcrumb (si aplica)
│   ├── Avatar + Dropdown (Mi perfil, Logout)
│   └── Hamburger menu (móvil)
├── Main Content
└── Mobile Bottom Nav (solo móvil)
    ├── Mis Quinielas
    ├── Pronósticos
    ├── Posiciones
    └── Menú (⋯)
```

**Archivo:** `src/components/layout/AppShell.tsx`

#### **Páginas de Autenticación**

**`/login`** — Formulario de login
```
┌─────────────────────┐
│   Ki-Niela          │
│  Inicia sesión      │
├─────────────────────┤
│ 📧 Email: _________ │
│ 🔑 Password: ______ │
│ [ Inicia Sesión ]   │
│ ¿Sin cuenta?        │
│ [ Registrate ]      │
└─────────────────────┘
```

**`/register`** — Formulario de registro
```
┌─────────────────────┐
│   Ki-Niela          │
│  Crea tu cuenta     │
├─────────────────────┤
│ 👤 Nombre: ________ │
│ 📧 Email: _________ │
│ 🔑 Password: ______ │
│ 🔑 Confirmar: _____ │
│ [ Registrate ]      │
│ ¿Ya tienes cuenta?  │
│ [ Inicia Sesión ]   │
└─────────────────────┘
```

**Archivo:** `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx`

#### **Páginas de Usuario**

**`/quinielas`** — Mis Quinielas (dashboard principal)

Agrupa quinielas por evento, mostrando:
- Nombre del evento + logo
- Nombre quiniela
- Puntos del usuario
- Posición en ranking
- # de participantes activos
- Estado (ACTIVE, PENDING_APPROVAL, etc.)
- Botones: "Entrar" (si ACTIVE), "Configurar" (si admin)

**Sección adicional:** "Disponibles para unirse" (quinielas públicas que el usuario no ha unido)

**Archivo:** `src/app/quinielas/page.tsx`

**`/quinielas/:id/dashboard`** — Dashboard de una quiniela

Resumen de la quiniela:
- Información del evento
- Pronósticos del usuario en esta quiniela
- Próximos partidos
- Partidos estrella
- Botones rápidos: Pronósticos, Posiciones, Juegos, Estadísticas

**Archivo:** `src/app/quinielas/[id]/dashboard/page.tsx`

**`/quinielas/:id/pronósticos`** — Registrar predicciones

Tabs por jornada/fase. Para cada partido muestra:
- Equipos (banderas + nombres)
- Hora (Costa Rica)
- Inputs: "Goles local" + "Goles visitante"
- Ícono estrella (si aplica)
- Estado: "Guardando...", "Guardado", "Bloqueado"
- **Autosave:** Debounce 350 ms + `onBlur` flush + `sendBeacon` en navegación. Overlay full-screen con balón animado mientras guarda (delay 300 ms para no flashear)

**Archivo:** `src/app/quinielas/[id]/pronosticos/page.tsx`

**`/quinielas/:id/posiciones`** — Tabla de ranking

Tabla ordenada por puntos descendente:
- # Posición
- 👤 Nombre usuario
- 📊 Puntos totales
- 📈 Tendencia (subiendo/bajando)
- 🎯 Aciertos exactos
- Botón: Ver predicciones del usuario

**Archivo:** `src/app/quinielas/[id]/posiciones/page.tsx`

**`/quinielas/:id/matriz`** — Matriz de pronósticos

Tabla grande:
- Filas: Usuarios activos
- Columnas: Partidos (con resultado oficial en header)
- Celdas: Predicción del usuario + puntos obtenidos
- Colores: Verde (exacto), Amarillo (ganador), Gris (sin puntos)
- Ícono 🤖 si fue generada por bot

Scroll horizontal en móvil. Columna de usuario puede fijarse.

**Archivo:** `src/app/quinielas/[id]/matriz/page.tsx`

**`/quinielas/:id/partidos`** — Lista de partidos

Calendario/lista de todos los partidos del evento:
- Equipos
- Hora
- Resultado oficial (si ya jugó)
- Estado del partido
- Filtros: por fecha, fase, estado, estrella

**Archivo:** `src/app/quinielas/[id]/partidos/page.tsx`

**`/quinielas/:id/configuracion`** — Config de quiniela (solo admin)

Panel para administrador:
- Nombre de quiniela
- Visibilidad (PUBLIC, PRIVATE, INVITE_ONLY)
- Código de invitación
- **Pronósticos aleatorios**: Switch ON/OFF + rango de goles + minutos de bloqueo
- **Participantes**: Tabla con filtro (ACTIVE, PENDING, etc.)
- **Partidos estrella**: Marcar/desmarcar partidos como estrella
- **Status**: Cambiar a CLOSED/ARCHIVED

**Archivo:** `src/app/quinielas/[id]/configuracion/page.tsx`

**`/admin/usuarios`** — Panel de administración global

**Sección 1: Usuarios**
Tabla de todos los usuarios registrados:
- Nombre, Email, Rol global (USER/SUPER_ADMIN), Estado (ACTIVE/INACTIVE)
- Filtros: Todos, Pendientes, Activos
- Acciones: Activar, Desactivar, Hacer Admin, Quitar Admin

**Sección 2: Visibilidad de Quinielas**
Lista de quinielas con switch ON/OFF:
- ON = ACTIVE (visible para usuarios)
- OFF = ARCHIVED (solo para super admin)
- Muestra evento, código de invitación, # de miembros

**Archivo:** `src/app/admin/usuarios/page.tsx`

**`/perfil`** — Perfil del usuario

Formularios para cambiar:
- 👤 Nombre
- 📧 Email
- 🔑 Contraseña (requiere contraseña actual para validar)

Con validaciones:
- Nombre: 1-80 caracteres
- Email: válido RFC 5322, no duplicado
- Password actual: debe coincidir (bcryptjs compareSync)
- Contraseña nueva: ≥ 8 caracteres, debe coincidir con confirmación

**Archivo:** `src/app/perfil/page.tsx`

### Componentes Reutilizables (shadcn/ui)

Componentes base importados de `shadcn`:

```typescript
// Inputs
<Input />        // Input text
<Button />       // Botón
<Switch />       // Toggle ON/OFF
<Badge />        // Etiqueta
<Card />         // Contenedor

// Estructura
<Dialog />       // Modal
<Popover />      // Dropdown
<Tooltip />      // Tooltip

// Tables
<Table />        // Tabla
<Tbody, Thead, Tr, Td />

// Forms
<Form />         // React Hook Form wrapper
<FormControl />
<FormLabel />
<FormMessage />
```

---

## Backend: Endpoints API

### Estructura de Endpoints

```
/api/
├── auth/
│   ├── register           POST   Crear usuario
│   ├── login              POST   Login (NextAuth)
│   └── logout             POST   Logout (NextAuth)
├── me                     GET    Perfil del usuario logueado
│                          PATCH  Actualizar perfil (name/email/password)
├── admin/
│   ├── users              GET    Listar todos los usuarios
│   ├── users/:id          PATCH  Activar/desactivar usuario / cambiar rol
│   ├── quinielas          GET    Listar todas las quinielas
│   ├── quinielas/:id      PATCH  Cambiar status (ACTIVE/CLOSED/ARCHIVED)
│   ├── matches/:id/external          PATCH  Vincular/desvincular external ID
│   ├── matches/clear-external        POST   Limpiar TODOS los external IDs
│   ├── matches/:id/force-status      PATCH  Forzar status (testing E2E)
│   ├── external-fixtures  GET    Buscar fixtures en proveedor (ESPN)
│   ├── sync-now           POST   Disparar sync de live scores manualmente
│   └── diag/mailer        GET    Snapshot de config mailer
│                          POST   Enviar email de prueba
├── events                 GET    Listar eventos
│                          POST   Crear evento (super admin)
├── events/:id             GET    Detalle de evento
│                          PATCH  Actualizar evento
├── quinielas              GET    Listar quinielas del usuario
│                          POST   Crear quiniela (super admin)
├── quinielas/:id          GET    Detalle de quiniela
│                          PATCH  Actualizar config
├── quinielas/:id/members  GET    Listar participantes
│                          POST   Agregar participante
├── quinielas/:id/members/request-access
│                          POST   Solicitar acceso con código
├── quinielas/:id/members/:memberId
│                          PATCH  Activar/desactivar participante
├── quinielas/:id/me/auto-predictions
│                          PATCH  Toggle del bot personal del usuario
├── quinielas/:id/predictions
│                          GET    Predicciones del usuario
│                          POST   Crear/actualizar predicción (UPSERT)
├── quinielas/:id/leaderboard
│                          GET    Tabla de posiciones (?scope=general|day|matchday|phase)
├── quinielas/:id/stats    GET    Estadísticas generales
├── quinielas/:id/prediction-matrix
│                          GET    Matriz de pronósticos
├── quinielas/:id/live     GET    SSE de marcadores en vivo
├── quinielas/:id/star-matches
│                          GET    Partidos estrella + PATCH para marcar/desmarcar
├── quinielas/:id/matches  GET    Partidos visibles para el usuario
├── matches                GET    Listar partidos
│                          POST   Crear partido (super admin)
├── matches/:id            GET    Detalle del partido
│                          PATCH  Actualizar resultado oficial
├── matches/:id/live       PATCH  Actualizar marcador en vivo (manual override)
└── jobs/
    ├── sync-live-scores            POST   Sync ESPN → Match (cron)
    ├── lock-matches                POST   Bloquear partidos (cron)
    ├── generate-random-predictions POST   Bot aleatorio (cron)
    └── recalculate-scores          POST   Recalcular puntos (cron)
```

### Ejemplos de Endpoints Principales

#### **POST /api/auth/register**

Crea un nuevo usuario.

```typescript
// Request
{
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "password": "MySecure123!"
}

// Response (201)
{
  "id": "clx...",
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "globalRole": "USER",
  "status": "INACTIVE",
  "createdAt": "2026-05-29T10:00:00Z"
}

// Errores
{
  "error": "Email already in use"  // 409 Conflict
}
{
  "error": "Password must be at least 8 characters"  // 422
}
```

#### **PATCH /api/me**

Actualiza perfil del usuario logueado (nombre, email, contraseña).

```typescript
// Request
{
  "name": "Juan Nuevonombre",
  "email": "juannuevo@example.com",
  "currentPassword": "MySecure123!",
  "newPassword": "NewPassword456!"
}

// Response (200)
{
  "id": "clx...",
  "name": "Juan Nuevonombre",
  "email": "juannuevo@example.com"
}

// Errores
{
  "error": "Current password is incorrect"  // 401
}
{
  "error": "Email already in use"  // 409
}
```

#### **GET /api/quinielas**

Retorna quinielas donde el usuario es miembro + quinielas públicas disponibles.

```typescript
// Response (200)
{
  "memberships": [
    {
      "id": "q-123",
      "quinielaId": "q-123",
      "role": "QUINIELA_ADMIN",
      "status": "ACTIVE",
      "quiniela": {
        "name": "Ki-Niela Mundial 2026",
        "status": "ACTIVE",
        "event": { "id": "e-1", "name": "FIFA World Cup 2026" },
        "_count": { "members": 12 }
      }
    }
  ],
  "browsable": [
    {
      "id": "q-456",
      "name": "Amistosos Internacionales",
      "status": "ACTIVE",
      "event": { "id": "e-2", "name": "Amistosos 2026" },
      "_count": { "members": 5 }
    }
  ]
}
```

#### **POST /api/quinielas/:id/predictions/upsert**

Crea o actualiza una predicción (autosave).

```typescript
// Request
{
  "matchId": "m-123",
  "predictedHomeGoals": 2,
  "predictedAwayGoals": 1
}

// Response (200 o 201)
{
  "id": "pred-789",
  "matchId": "m-123",
  "predictedHomeGoals": 2,
  "predictedAwayGoals": 1,
  "generatedByBot": false,
  "createdAt": "2026-05-29T10:05:00Z",
  "updatedAt": "2026-05-29T10:05:00Z"
}

// Errores
{
  "error": "Match is locked"  // 409
}
{
  "error": "User not active in quiniela"  // 403
}
```

#### **PATCH /api/admin/users/:userId**

Activa/desactiva usuario globalmente.

```typescript
// Request
{
  "action": "activate"  // o "deactivate"
}

// Response (200)
{
  "id": "u-123",
  "name": "Juan Pérez",
  "status": "ACTIVE"
}
```

#### **PATCH /api/admin/quinielas/:quinielaId**

Cambia status de quiniela (ACTIVE, CLOSED, ARCHIVED).

```typescript
// Request
{
  "status": "ARCHIVED"
}

// Response (200)
{
  "id": "q-123",
  "name": "Ki-Niela Vieja",
  "status": "ARCHIVED"
}
```

#### **POST /api/quinielas/:id/members/request-access**

Usuario solicita acceso a una quiniela con código.

```typescript
// Request
{
  "inviteCode": "AMISTOSOS2026"
}

// Response (201)
{
  "id": "qm-123",
  "status": "PENDING_APPROVAL",
  "role": "PARTICIPANT"
}

// Errores
{
  "error": "Invalid invite code"  // 404
}
{
  "error": "Already a member of this quiniela"  // 409
}
```

#### **GET /api/quinielas/:id/leaderboard**

Tabla de posiciones.

```typescript
// Response (200)
[
  {
    "position": 1,
    "userId": "u-1",
    "userName": "Carlos",
    "points": 47,
    "exactMatches": 3,
    "correctWinnersCount": 8
  },
  {
    "position": 2,
    "userId": "u-2",
    "userName": "Sofía",
    "points": 42,
    "exactMatches": 2,
    "correctWinnersCount": 9
  }
]
```

---

## Lógica de Negocio

### Cálculo de Puntos

**Regla general:**
- Marcador exacto: **3 puntos**
- Ganador correcto, marcador incorrecto: **1 punto**
- Empate correcto, marcador incorrecto: **1 punto**
- Sin acierto: **0 puntos**

**Partidos estrella (Final siempre):**
- Marcador exacto: **5 puntos**
- Ganador correcto: **3 puntos**
- Empate correcto: **3 puntos**
- Sin acierto: **0 puntos**

**Ejemplo:**

```
Predicción: Argentina 2 - Brasil 1
Resultado oficial: Argentina 2 - Brasil 1
→ Marcador exacto = 3 puntos (general) o 5 (estrella)

Predicción: Argentina 2 - Brasil 1
Resultado oficial: Argentina 3 - Brasil 1
→ Ganador correcto, marcador incorrecto = 1 punto

Predicción: Argentina 1 - Brasil 1
Resultado oficial: Argentina 2 - Brasil 2
→ Sin acierto (diferente ganador/empate) = 0 puntos
```

**Código:** `src/lib/scoring.ts`

```typescript
export function calculatePoints(
  prediction: { homeGoals: number; awayGoals: number },
  official: { homeGoals: number; awayGoals: number },
  isStarMatch: boolean
): { points: number; reason: string } {
  const isExactMatch = 
    prediction.homeGoals === official.homeGoals && 
    prediction.awayGoals === official.awayGoals

  const predictedWinner = 
    prediction.homeGoals > prediction.awayGoals ? 'home' :
    prediction.homeGoals < prediction.awayGoals ? 'away' : 'draw'
  
  const officialWinner = 
    official.homeGoals > official.awayGoals ? 'home' :
    official.homeGoals < official.awayGoals ? 'away' : 'draw'

  if (isExactMatch) {
    return { points: isStarMatch ? 5 : 3, reason: 'Marcador exacto' }
  }

  if (predictedWinner === officialWinner) {
    return { points: isStarMatch ? 3 : 1, reason: 'Ganador correcto' }
  }

  return { points: 0, reason: 'Sin acierto' }
}
```

### Bloqueo de Partidos

Cada partido se bloquea **10 minutos antes** de su hora de inicio (configurable por quiniela).

**Cálculo:**
```
kickoffAtUtc = 2026-06-01 20:00:00 UTC
kickoffAtCostaRica = 2026-06-01 14:00:00 (UTC-6)
lockMinutesBeforeMatch = 10

lockAtCostaRica = 2026-06-01 13:50:00
lockAtUtc = 2026-06-01 19:50:00
```

**Lógica:** `src/lib/lock.ts`

```typescript
import { isAfter } from 'date-fns'

export function isMatchLocked(
  match: { kickoffAtCostaRica: Date },
  lockMinutes: number = 10
): boolean {
  const now = new Date()
  const lockTime = new Date(
    match.kickoffAtCostaRica.getTime() - lockMinutes * 60000
  )
  return isAfter(now, lockTime)
}
```

**Lo que sucede cuando se bloquea:**
- ✅ Las predicciones existentes no pueden editarse
- ✅ No pueden crearse nuevas predicciones
- ✅ Frontend deshabilita inputs
- ✅ Backend rechaza cambios con 409 Conflict
- ✅ Si está habilitado en quiniela, bot genera predicciones automáticas

### Predicciones Automáticas (Bot — doble compuerta)

El bot genera predicciones aleatorias **solo si se cumplen TODAS estas condiciones**:

| # | Condición | Dónde se controla |
|---|-----------|-------------------|
| 1 | `Quiniela.randomPredictionsEnabled = true` | Configuración de quiniela (admin) |
| 2 | `QuinielaMember.autoPredictionsEnabled = true` | Dashboard del propio user (toggle "Mis predicciones automáticas") |
| 3 | `QuinielaMember.status = 'ACTIVE'` | Activación por admin de quiniela |
| 4 | El user NO es `globalRole=SUPER_ADMIN` | Hard-coded (admins no compiten) |
| 5 | No existe `Prediction` para `(quinielaId,userId,matchId)` | Si predijo manual, no se sobrescribe |
| 6 | El partido llegó a su momento de bloqueo (`kickoff - lockMinutes`) | Cron `lock-matches` |

Esto se conoce internamente como la **doble compuerta**: el admin controla si la
quiniela permite el bot (compuerta 1) y cada participante decide si se le aplica
(compuerta 2). Componente UI: `src/components/MyAutoPredictionsToggle.tsx`.

**Proceso:**
```
1. Job cron ejecuta cada minuto
2. Busca partidos que están a punto de bloquearse (+/- 1 minuto)
3. Para cada quiniela del evento:
   a. Verifica randomPredictionsEnabled = true
   b. Si false → salta
   c. Si true → busca participantes ACTIVE con autoPredictionsEnabled = true
   d. Para cada participante sin predicción:
      - Genera random: min...max goles (ej. 0-7)
      - Crea Prediction con generatedByBot = true
      - Marca lockedAt
      - No bloquea respuesta si falla
4. Recalcula leaderboard
```

**Código:** En job handler, ej. `/api/jobs/generate-random-predictions`

```typescript
async function generateRandomPredictions() {
  const now = new Date()
  
  // Partidos próximos a bloquearse (1 minuto de margen)
  const matches = await prisma.match.findMany({
    where: {
      status: 'PROGRAMADO',
      kickoffAtUtc: {
        gte: new Date(now.getTime() - 1 * 60000),
        lte: new Date(now.getTime() + 1 * 60000),
      },
    },
  })

  for (const match of matches) {
    const quinielas = await prisma.quiniela.findMany({
      where: { eventId: match.eventId, randomPredictionsEnabled: true },
    })

    for (const quiniela of quinielas) {
      const activeMembers = await prisma.quinielaMember.findMany({
        where: {
          quinielaId: quiniela.id,
          status: 'ACTIVE',
          autoPredictionsEnabled: true,
        },
      })

      for (const member of activeMembers) {
        const existing = await prisma.prediction.findUnique({
          where: {
            quinielaId_userId_matchId: {
              quinielaId: quiniela.id,
              userId: member.userId,
              matchId: match.id,
            },
          },
        })

        if (existing) continue // Ya tiene predicción

        // Genera predicción aleatoria
        const homeGoals = Math.floor(
          Math.random() * (quiniela.randomMaxGoals - quiniela.randomMinGoals + 1) +
            quiniela.randomMinGoals
        )
        const awayGoals = Math.floor(
          Math.random() * (quiniela.randomMaxGoals - quiniela.randomMinGoals + 1) +
            quiniela.randomMinGoals
        )

        await prisma.prediction.create({
          data: {
            quinielaId: quiniela.id,
            eventId: match.eventId,
            userId: member.userId,
            matchId: match.id,
            predictedHomeGoals: homeGoals,
            predictedAwayGoals: awayGoals,
            generatedByBot: true,
            lockedAt: new Date(),
          },
        })
      }
    }
  }
}
```

### Recálculo de Puntos

Cuando admin registra resultado oficial de un partido, el sistema **recalcula puntos automáticamente** para todas las predicciones de ese partido en todas las quinielas del evento.

**Proceso:**

```typescript
// 1. Admin llama PATCH /api/matches/:id
// 2. Actualiza Match.officialHomeGoals, Match.officialAwayGoals

// 3. Sistema automáticamente:
const predictions = await prisma.prediction.findMany({
  where: { matchId },
  include: { quiniela: true, user: true }
})

for (const prediction of predictions) {
  const { points, reason } = calculatePoints(
    { homeGoals: prediction.predictedHomeGoals, awayGoals: prediction.predictedAwayGoals },
    { homeGoals: match.officialHomeGoals, awayGoals: match.officialAwayGoals },
    isStarMatch // Consulta QuinielaStarMatch
  )

  // Crea o actualiza Score
  await prisma.score.upsert({
    where: {
      quinielaId_userId_matchId: {
        quinielaId: prediction.quinielaId,
        userId: prediction.userId,
        matchId: match.id,
      },
    },
    create: { /* score data */ },
    update: { points, reason, isStarMatch },
  })
}

// 4. Recalcula leaderboard (suma de scores)
```

---

## Flujos de Uso

### Flujo 1: Usuarios se Registran y Participan

```
User A                              System
  │
  ├─→ Va a /register
  │   ├─→ Completa: Juan Pérez, juan@ex.com, pass123
  │   └─→ Click "Registrate"
  │
  └─→ POST /api/auth/register
      ├─→ Valida Zod
      ├─→ Hashea password bcryptjs
      ├─→ Crea User { status: 'INACTIVE' }
      ├─→ Envía email bienvenida a juan@ex.com
      ├─→ Envía email notificación admin
      └─→ Toast: "Cuenta creada, pendiente de activación"

Admin                               System
  │
  ├─→ Recibe email: "Nuevo registro: Juan"
  │
  ├─→ Va a /admin/usuarios
  │   └─→ Ve Juan en "Pendientes"
  │
  ├─→ Click "Activar"
  │   └─→ PATCH /api/admin/users/juan-id { action: 'activate' }
  │
  └─→ Sistema
      ├─→ Actualiza User.status = 'ACTIVE'
      ├─→ Envía email: "Tu cuenta fue activada"
      └─→ Toast: "Usuario activado"

User A                              System
  │
  ├─→ Recibe email "Tu cuenta fue activada"
  │
  ├─→ Va a /login
  │   ├─→ Email: juan@ex.com
  │   ├─→ Password: pass123
  │   └─→ Click "Inicia sesión"
  │
  └─→ POST /api/auth/login
      ├─→ Busca User por email
      ├─→ Verifica password compareSync
      ├─→ Verifica User.status = 'ACTIVE'
      ├─→ Crea session JWT
      └─→ Redirige a /quinielas

User A                              System
  │
  ├─→ Ve página /quinielas
  │   ├─→ "Mis Quinielas" (vacío)
  │   └─→ "Disponibles": Ve "Ki-Niela Amistosos"
  │
  ├─→ Click "Entrar" en Amistosos
  │   ├─→ Modal pide código
  │   ├─→ Ingresa "AMISTOSOS2026"
  │   └─→ Click "Solicitar"
  │
  └─→ POST /api/quinielas/.../members/request-access
      ├─→ Valida inviteCode
      ├─→ Crea QuinielaMember { status: 'PENDING_APPROVAL' }
      ├─→ Envía email a admins: "Juan solicita acceso"
      └─→ Toast: "Solicitud enviada"

Admin                               System
  │
  ├─→ Recibe email: "Juan solicita acceso a Amistosos"
  │
  ├─→ Va a /quinielas/.../configuracion
  │   └─→ Tab "Participantes", Ve Juan "Pendiente"
  │
  ├─→ Click "Activar"
  │   └─→ PATCH /api/quinielas/.../members/juan-member-id { action: 'activate' }
  │
  └─→ Sistema
      ├─→ Actualiza status = 'ACTIVE'
      ├─→ Envía email: "Aprobado en Amistosos"
      └─→ Toast: "Usuario activado"

User A                              System
  │
  ├─→ Recibe email "Aprobado en Amistosos"
  │
  ├─→ Va a /quinielas
  │   └─→ Ahora ve "Ki-Niela Amistosos" en "Mis Quinielas"
  │
  ├─→ Click "Entrar"
  │   └─→ Redirige a /quinielas/amistosos-id/dashboard
  │
  └─→ Sistema
      ├─→ Muestra dashboard
      ├─→ Botones: Pronósticos, Posiciones, etc.
      └─→ User puede empezar a pronosticar
```

### Flujo 2: Usuario Registra Predicciones

```
User                                System
  │
  ├─→ En /quinielas/amistosos/pronósticos
  │   └─→ Ve jornada 1 con 6 partidos
  │
  ├─→ Partido: Argentina vs Canadá
  │   ├─→ Input goles local: 2
  │   └─→ Input goles visitante: 0
  │
  └─→ Sistema (onChange):
      ├─→ Debounce 350ms
      └─→ POST /api/quinielas/.../predictions/upsert
          ├─→ Valida: usuario ACTIVE, partido no bloqueado
          ├─→ Crea/actualiza Prediction
          ├─→ Retorna predicción guardada
          └─→ Frontend muestra "Guardado ✓"

[Tiempo pasa, 10 minutos antes del partido]

Sistema (Cron job)
  │
  └─→ Ejecuta /api/jobs/lock-matches
      ├─→ Busca partidos próximos a bloquearse
      ├─→ Actualiza Match.status = 'BLOQUEADO'
      ├─→ Si randomPredictionsEnabled:
      │   └─→ Genera predicciones automáticas para bot users
      └─→ Bloquea todas las predicciones de ese partido

User                                Resultado
  │
  └─→ Si intenta cambiar predicción:
      ├─→ Input deshabilitado (frontend)
      ├─→ POST /api/quinielas/.../predictions/upsert
      │   └─→ 409 Conflict: "Partido bloqueado"
      └─→ Toast: "El partido ya está bloqueado"

[Partido se juega]

Admin                               Resultado
  │
  ├─→ Ve resultado oficial: Argentina 3 - Canadá 0
  │
  └─→ Va a /admin/matches
      ├─→ Click Argentina vs Canadá
      └─→ Registra resultado:
          ├─→ Goles local: 3
          ├─→ Goles visitante: 0
          └─→ Click "Guardar"

Sistema                             Resultado
  │
  └─→ PATCH /api/matches/partido-id
      ├─→ Actualiza Match.officialHomeGoals = 3
      ├─→ Busca todas las predicciones: match + user en quinielas
      ├─→ Para cada predicción:
      │   ├─→ Calcula puntos (scoreLib)
      │   ├─→ Si user predijo 2-0: 0 puntos (ganador correcto, marcador no)
      │   ├─→ Si user predijo 3-0: 3 puntos (exacto) o 5 (estrella)
      │   └─→ Crea Score record
      ├─→ Recalcula leaderboard
      └─→ Toast admin: "Resultado registrado, puntos recalculados"

User                                Resultado
  │
  └─→ Ve en /quinielas/amistosos/posiciones:
      ├─→ Posición: #5
      ├─→ Puntos: 8 (de este partido)
      └─→ Tabla actualizada con nuevos puntos
```

### Flujo 3: Admin Configura Bot Predictions

```
Admin                               Resultado
  │
  ├─→ Va a /quinielas/amistosos/configuracion
  │   └─→ Sección "Pronósticos aleatorios"
  │
  ├─→ Switch está ON
  │   └─→ Rango: 0-7 goles, bloqueo 10 min antes
  │
  ├─→ Click para desactivar bot
  │   └─→ PATCH /api/quinielas/amistosos-id { randomPredictionsEnabled: false }
  │
  └─→ Sistema
      ├─→ Actualiza Quiniela.randomPredictionsEnabled = false
      ├─→ Toast: "Pronósticos automáticos deshabilitados"
      └─→ De ahora en adelante: bot NO genera predicciones

[Próximo partido que se bloquea]

Sistema                             Resultado
  │
  └─→ Cron job /api/jobs/generate-random-predictions
      ├─→ Para CADA quiniela del evento:
      │   ├─→ Si randomPredictionsEnabled = false
      │   │   └─→ SALTA (no genera nada)
      │   └─→ Si randomPredictionsEnabled = true
      │       └─→ Genera para users con autoPredictionsEnabled = true
      └─→ En Amistosos: NO genera (deshabilitado)
```

---

## Deployment & DevOps

### Variables de Ambiente

**`.env.local`** (desarrollo local)

```bash
# Database
DATABASE_URL="postgresql://postgres:<TU_PASS_LOCAL>@localhost:5432/bd_kiniela?schema=public"

# NextAuth
NEXTAUTH_URL="http://localhost:3001"
NEXTAUTH_SECRET="<string-largo-random>"

# Cron jobs
CRON_SECRET="<string-largo-random>"

# Email — preferir Brevo HTTP API (HTTPS:443, único transport viable en Railway)
BREVO_API_KEY="xkeysib-..."

# Email — fallback SMTP (no funciona en Railway free/hobby)
# SMTP_HOST="smtp-relay.brevo.com"
# SMTP_PORT="587"
# SMTP_USER="<account>"
# SMTP_PASS="<smtp-key>"

SMTP_FROM='Ki-Niela <noreply@tu-dominio>'
ADMIN_NOTIFY_EMAIL="admin@example.com"
```

**Railway Environment** (producción)

Las mismas variables, pero `DATABASE_URL` apunta al PostgreSQL servido por
Railway (tomar el valor del dashboard) y `NEXTAUTH_URL` al dominio público.

> **Importante:** No commitear nunca credenciales. `.env.local` está en
> `.gitignore`. Si se filtra una credencial (en código, doc o screenshot),
> rotarla inmediatamente desde el dashboard del proveedor.

### Build & Deploy a Railway

**1. Build local:**
```bash
npm run build
```

Esto ejecuta:
```bash
prisma generate && next build
```

**2. Deploy a Railway:**
```bash
git push origin main
```

Railway detecta cambios → redeploy automático

**En railway.toml:**
```toml
[build]
builder = "dockerfile"
buildCommand = "npm run build && cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public"

[start]
cmd = "HOSTNAME=0.0.0.0 node .next/standalone/server.js"
```

**Por qué estos comandos:**
- `buildCommand`: Copia archivos static + public al output standalone (necesario para CSS/JS)
- `HOSTNAME=0.0.0.0`: Bind a todas las IPs (Railway requiere esto)
- `node .next/standalone/server.js`: Ejecuta servidor Next.js de producción

**3. Migraciones de BD en Railway:**

```bash
npm run build:railway
```

Ejecuta:
```bash
prisma generate && prisma migrate deploy && tsx prisma/seed.ts && next build
```

Esto:
1. Genera Prisma Client
2. Aplica migrations pendientes
3. Corre seed (datos iniciales)
4. Compila Next.js

### Ejecutar Localmente

**1. Setup inicial:**
```bash
cd /home/danielp/repo/app_KI-Niela
npm install
npx prisma generate
```

**2. Crear BD local:**
```bash
# Si usas PostgreSQL local
createdb bd_kiniela
```

**3. Migrations local:**
```bash
npx prisma migrate dev --name "init"
```

**4. Seed datos:**
```bash
npx prisma db seed
```

O para amistosos:
```bash
npx tsx scripts/seed-amistosos.ts
```

**5. Start dev server:**
```bash
npm run dev
```

Abre http://localhost:3001

### Testing

**Ejecutar tests:**
```bash
npm test
```

**Watch mode:**
```bash
npm run test:watch
```

**Archivos de test:**
- `src/__tests__/scoring.test.ts` — Tests de cálculo de puntos
- `src/__tests__/timezone.test.ts` — Tests de zonas horarias
- `src/__tests__/bot-gate.test.ts` — Tests del bot

**Ejemplo test:**
```typescript
import { describe, it, expect } from 'vitest'
import { calculatePoints } from '@/lib/scoring'

describe('Scoring', () => {
  it('should award 3 points for exact match', () => {
    const result = calculatePoints(
      { homeGoals: 2, awayGoals: 1 },
      { homeGoals: 2, awayGoals: 1 },
      false
    )
    expect(result.points).toBe(3)
    expect(result.reason).toBe('Marcador exacto')
  })

  it('should award 5 points for exact star match', () => {
    const result = calculatePoints(
      { homeGoals: 1, awayGoals: 0 },
      { homeGoals: 1, awayGoals: 0 },
      true  // Star match
    )
    expect(result.points).toBe(5)
  })
})
```

---

## Troubleshooting Común

### Los emails no se envían

**Checklist:**
1. `GET /api/admin/diag/mailer` debe responder `BREVO_API_KEY_set: true` y `transport: 'brevo-http-api'`.
2. En Brevo → Configuración → Seguridad → IPs autorizadas: el bloqueo para "Claves API" debe estar **desactivado**, o bien `0.0.0.0/0` no funciona como wildcard.
3. Revisa logs de Railway buscando `[mailer:brevo-api]` para ver el `reason` del fallo.
4. `ADMIN_NOTIFY_EMAIL` debe ser email válido y accesible (mira spam la primera vez).

**Test desde la consola del browser** (estando logueado como SUPER_ADMIN):
```js
fetch('/api/admin/diag/mailer', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ to: 'tucorreo@example.com' }),
}).then(r => r.json()).then(console.log)
```

Respuesta esperada: `{ result: { ok: true, messageId: "..." } }` y el correo
llega.

### Predicciones no se guardan

**Checklist:**
1. ¿Usuario está ACTIVE en la quiniela?
2. ¿Partido NO está bloqueado?
3. ¿Los valores son numéricos y ≥ 0?
4. Abre DevTools → Network → check PATCH request response

### Bot no genera predicciones

**Checklist (las dos compuertas):**
1. `Quiniela.randomPredictionsEnabled = true` (admin de quiniela)
2. `QuinielaMember.autoPredictionsEnabled = true` (cada user en su dashboard)
3. `QuinielaMember.status = 'ACTIVE'`
4. El user NO es `globalRole=SUPER_ADMIN` (los admins no compiten)
5. No existe predicción previa para ese partido
6. Cron `/api/jobs/generate-random-predictions` está corriendo

### Posiciones vacío pero el dashboard dice "Posición 1"

Bug ya corregido. Si reaparece: verificar que ambos endpoints (dashboard
server-side y `/api/quinielas/:id/leaderboard`) excluyen `globalRole=SUPER_ADMIN`
y agregan tail de members `ACTIVE` sin scores.

### Auto-vincular partidos en `/admin/partidos` no encuentra match

1. Verificar que ESPN devuelve los nombres esperados en el panel de fixtures.
2. `normalize()` en `src/app/admin/partidos/page.tsx` cubre conectores
   `y`/`e`/`and`/`&` — si aparece otro separador (slash, guión bajo) extender.
3. Países con nombres muy distintos en EN/ES → agregar al alias group de
   `TEAM_ALIASES` en el mismo archivo.

### Live scores no actualizan

1. Cron de `/api/jobs/sync-live-scores` debe correr cada minuto con
   `x-cron-secret`.
2. El partido debe tener `externalId` vinculado y `manualOverride = false`.
3. ESPN puede tardar hasta 60 s en reportar un cambio.
4. Para forzar un sync manual: botón "Test sync" en `/admin/partidos`
   (`POST /api/admin/sync-now`).

### CSS/estilos no aparecen en Railway

**Solución:** Verificar que `buildCommand` incluye copias:
```bash
npm run build && cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public
```

---

## Resumen de Arquitectura

```
┌─────────────────────────────────────────────────────┐
│                 Frontend (React 19)                 │
│  ┌────────────────────────────────────────────────┐ │
│  │  Pages: /quinielas, /perfil, /admin, etc.      │ │
│  │  Components: Forms, Cards, Tables, Dropdowns  │ │
│  │  Hooks: useForm, useQuery, useAutosave        │ │
│  │  State: React Query, NextAuth session         │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
           ↓ HTTP REST ↓
┌─────────────────────────────────────────────────────┐
│      Backend (Next.js 16 API Routes)                │
│  ┌────────────────────────────────────────────────┐ │
│  │ /api/auth:      NextAuth authentication       │ │
│  │ /api/admin:     Super admin endpoints         │ │
│  │ /api/quinielas: Quiniela & predictions CRUD   │ │
│  │ /api/matches:   Match scoring & results       │ │
│  │ /api/jobs:      Cron tasks (lock, bot, calc)  │ │
│  │ Middleware: Auth, Validation, Error handling  │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
           ↓ SQL ↓
┌─────────────────────────────────────────────────────┐
│    PostgreSQL (Prisma ORM)                          │
│  ┌────────────────────────────────────────────────┐ │
│  │ Tables:                                        │ │
│  │ • User, Quiniela, QuinielaMember              │ │
│  │ • Event, Team, Stadium, Matchday, Match      │ │
│  │ • Prediction, Score, QuinielaStarMatch       │ │
│  │ • AuditLog                                    │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## Conclusión

Ki-Niela es una plataforma completa de quinielas deportivas con:

✅ Autenticación segura (bcryptjs + NextAuth)  
✅ Multi-evento / multi-quiniela flexible  
✅ Roles y autorización (super admin, admin quiniela, participante)  
✅ Predicciones automáticas con bot configurable  
✅ Cálculo automático de puntos según reglas  
✅ Responsive mobile-first  
✅ Sistema de emails integrado  
✅ Desplegable en Railway con CI/CD automático  

Para extender la app, modifica:
- **BD:** `prisma/schema.prisma` → `npx prisma migrate dev`
- **API:** Agrega routes en `src/app/api/`
- **Frontend:** Nuevas páginas en `src/app/`
- **Lógica:** Utilities en `src/lib/`

**Happy coding! ⚽**
