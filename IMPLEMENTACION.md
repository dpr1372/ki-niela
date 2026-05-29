# 📋 Documentación de Implementación Ki-Niela

## Tabla de Contenidos
1. [Visión General](#visión-general)
2. [Quiniela de Amistosos Internacionales](#quiniela-de-amistosos-internacionales)
3. [Sistema de Perfiles de Usuario](#sistema-de-perfiles-de-usuario)
4. [Sistema de Emails Automáticos](#sistema-de-emails-automáticos)
5. [Control de Visibilidad de Quinielas](#control-de-visibilidad-de-quinielas)
6. [Configuración de SMTP en Railway](#configuración-de-smtp-en-railway)
7. [Cómo Probar Localmente](#cómo-probar-localmente)

---

## Visión General

Ki-Niela es una aplicación web de quinielas deportivas recreativas. En este documento documentamos las siguientes implementaciones:

- ✅ Nueva quiniela de "Amistosos Internacionales" (mayo-junio 2026)
- ✅ Sistema de perfil personal donde usuarios pueden cambiar contraseña y email
- ✅ Emails automáticos en registro, activación y solicitudes de acceso
- ✅ Control para admin de habilitar/deshabilitar quinielas
- ✅ Fixes de responsividad para mobile (Android/iOS)

**Stack Técnico:**
- Next.js 16.2.6 (App Router)
- React Hook Form + Zod (validación)
- PostgreSQL + Prisma (base de datos)
- NextAuth (autenticación)
- Resend (servicio de emails)
- Tailwind CSS (estilos)

---

## Quiniela de Amistosos Internacionales

### ¿Qué se hizo?

Se creó un nuevo evento "Amistosos Internacionales" con 37 partidos amistosos internacionales programados para mayo-junio 2026, completamente separado de la Copa del Mundo 2026.

### Archivos Involucrados

**`scripts/seed-amistosos.ts`** - Script de inicialización de datos

Este archivo:
1. Crea un nuevo **Event** llamado "Amistosos Internacionales" con:
   - ID: `event-amistosos-2026`
   - Fecha inicio: 30 mayo 2026
   - Fecha fin: 3 junio 2026
   - Zona horaria: America/Costa_Rica

2. Crea **70 Equipos** (países participantes como ZIM, FIN, ISL, etc.)

3. Crea **5 Matchdays** (jornadas):
   - Sábado 30 mayo: 6 partidos
   - Domingo 31 mayo: 9 partidos
   - Lunes 1 junio: 7 partidos
   - Martes 2 junio: 5 partidos
   - Miércoles 3 junio: 10 partidos

4. Crea **37 Matches** (partidos) con:
   - Equipos local/visitante
   - Estadio
   - Hora de inicio (en UTC convertida desde hora Costa Rica)
   - Fase: GROUPS (todos son amistosos)

5. Crea una **Quiniela**:
   - ID: `quiniela-amistosos-2026`
   - Nombre: "Ki-Niela Amistosos Internacionales"
   - Código de invitación: `AMISTOSOS2026`
   - Admin: `admin@kiniela.com`
   - Mismo config que Mundial 2026 (lock 10 min antes, pronósticos aleatorios habilitados)

### Cómo Usar

**Ejecutar localmente contra tu base de datos local:**
```bash
npx tsx scripts/seed-amistosos.ts
```

**Ejecutar contra Railway (base de producción):**
```bash
DATABASE_URL="postgresql://postgres:ubhbMSXtLoZlEDYgnYJQjHyPcYvSlqEH@zephyr.proxy.rlwy.net:32314/railway" npx tsx scripts/seed-amistosos.ts
```

**Resultado:**
- El script es **idempotente** (se puede correr múltiples veces sin duplicar datos)
- Los datos ya están cargados en Railway
- Los usuarios pueden unirse con código: `AMISTOSOS2026`

### Cambios en Código

**`src/lib/flags.ts`** - Mapping de banderas

Se expandió el mapping de códigos FIFA a ISO 2-letter codes para 25 nuevos países:
- `ALB: 'al'` (Albania)
- `BUL: 'bg'` (Bulgaria)
- `FIN: 'fi'` (Finlandia)
- `GEO: 'ge'` (Georgia)
- ... (y 21 más)

Esto permite que las banderas de países nuevos se muestren correctamente en la UI usando flagcdn.com.

---

## Sistema de Perfiles de Usuario

### ¿Qué se hizo?

Cada usuario ahora tiene acceso a su perfil personal donde puede:
- Cambiar su nombre
- Cambiar su email
- Cambiar su contraseña (con validación de contraseña actual)

### Archivos Involucrados

**`src/app/perfil/page.tsx`** - Página de perfil

Una página Next.js que permite al usuario:

1. **Editar datos personales** (nombre y email):
   - Valida nombre ≥ 1 carácter, ≤ 80
   - Valida email válido
   - Evita duplicados de email

2. **Cambiar contraseña**:
   - Requiere contraseña actual (validación)
   - Nueva contraseña ≥ 8 caracteres
   - Confirmación de contraseña (deben coincidir)

3. **Responsive**: Optimizada para mobile/tablet/desktop
   - Inputs con altura `h-11` para touch
   - Padding inferior `pb-24` para no ocultarse detrás del navbar móvil
   - Teclados contextuales (email, password) en móvil
   - Soporta password managers (autoComplete)

**`src/app/api/me/route.ts`** - API para actualizar perfil

Endpoint `PATCH /api/me` que:

1. **Autenticación**: Solo usuarios logueados
2. **Validación con Zod**:
   - `name`: string 1-80 chars (opcional)
   - `email`: email válido (opcional)
   - `currentPassword`: string requerido si cambias contraseña
   - `newPassword`: string ≥ 8 chars
   - Regla custom: si pones newPassword, currentPassword es obligatorio

3. **Lógica**:
   - Si cambias email → verifica que no esté en uso
   - Si cambias contraseña → valida contraseña actual con `compareSync(bcryptjs)`
   - Hashea nueva contraseña con `hashSync(12)`
   - Actualiza usuario en BD
   - Retorna usuario + mensaje de éxito

**`src/components/layout/AppShell.tsx`** - Dropdown de perfil

El navbar ahora muestra:
- **Desktop**: Avatar + nombre + dropdown menu
  - Click abre dropdown con "Mi perfil" y "Cerrar sesión"
  - Click afuera cierra automáticamente
- **Mobile**: Avatar en hamburger menu
  - "Mi perfil" aparece encima de "Cerrar sesión"

### Cómo Usar

1. Usuario hace **login**
2. Hace click en su **avatar/nombre** en header (desktop) o **hamburger menu** (mobile)
3. Selecciona **"Mi perfil"**
4. Ve página `/perfil` con:
   - Su avatar (iniciales en círculo)
   - Sección "Datos personales": nombre + email
   - Sección "Cambiar contraseña": contraseña actual + nueva + confirmación
5. Guarda cambios → toast de éxito/error

### Validaciones

**Cambio de email:**
```
- Email válido (RFC 5322)
- No duplicado en BD
- Toast: "Perfil actualizado" si todo bien
- Toast: "Ese correo ya está en uso" si existe
```

**Cambio de contraseña:**
```
- Contraseña actual debe coincidir (compareSync)
- Nueva contraseña ≥ 8 caracteres
- Confirmación debe coincidir
- Toast: "Contraseña actualizada" si todo bien
- Toast: "Contraseña actual incorrecta" si no coincide
```

---

## Sistema de Emails Automáticos

### ¿Qué se hizo?

Se implementó un sistema de emails automáticos que notifica a admins y usuarios en 5 momentos clave:

1. ✉️ Usuario se registra → bienvenida + aviso pendiente
2. ✉️ Admin activa usuario globalmente → notificación al usuario
3. ✉️ Admin activa usuario → aviso al admin que se registró nuevo usuario
4. ✉️ Usuario solicita acceso a quiniela → notificación a admins de quiniela
5. ✉️ Admin aprueba usuario en quiniela → aviso al usuario

### Archivos Involucrados

**`src/lib/mailer-templates.ts`** - Plantillas de emails

5 funciones que retornan emails HTML con branding Ki-Niela:

```typescript
// Funciones exportadas:
1. sendNewUserRegisteredToAdmin({ userName, userEmail })
   → Email al admin notificando nuevo registro

2. sendWelcomeToNewUser({ userName, userEmail })
   → Bienvenida al usuario + aviso pendiente de activación

3. sendUserActivatedGlobally({ userName, userEmail })
   → Notificación que el usuario fue activado globalmente

4. sendQuinielaAccessRequestToAdmin({ 
     adminEmail, userName, userEmail, quinielaName, quinielaId 
   })
   → Notificación a admin de quiniela que alguien solicita acceso

5. sendQuinielaAccessApproved({ 
     userName, userEmail, quinielaName, quinielaId 
   })
   → Notificación al usuario que fue aprobado en quiniela
```

**Características de cada email:**
- Logo Ki-Niela en header (72x72px)
- Título personalizado
- Gradient azul-verde (branding)
- Links contextuales a la acción (Activar usuario, Ir a quiniela, etc)
- Footer con crédito
- Fallback text para clientes que no soportan HTML

**`src/app/api/auth/register/route.ts`** - Registro

Modificado para:
1. Crear usuario con `status: 'INACTIVE'` (pendiente activación)
2. Enviar 2 emails en paralelo (no bloquean el registro):
   - Bienvenida al usuario
   - Notificación al admin
3. Responder al usuario: "Cuenta creada. Un administrador debe activarte antes de poder ingresar."

**`src/app/api/admin/users/[userId]/route.ts`** - Activación global

Modificado para:
1. Detectar cuando admin hace `action: 'activate'`
2. Si usuario estaba NO_ACTIVE → enviar email de activación
3. No bloquea respuesta (`.catch()` solo loguea)

**`src/app/api/quinielas/[quinielaId]/members/request-access/route.ts`** - Solicitud de acceso

Modificado para:
1. Crear registro QuinielaMember con `status: 'PENDING_APPROVAL'`
2. Buscar todos los admins de esa quiniela
3. Enviar email a CADA admin notificando la solicitud
4. Incluir link directo a `/quinielas/[id]/participantes`

**`src/app/api/quinielas/[quinielaId]/members/[memberId]/route.ts`** - Aprobación en quiniela

Modificado para:
1. Detectar cuando admin hace `action: 'activate'`
2. Si miembro estaba NO_ACTIVE → enviar email de aprobación
3. Email incluye link a dashboard de quiniela

### Cómo Probar Localmente

**Paso 1:** Configurar variables de ambiente (`.env.local`):
```
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=re_SYtRLKLt_EJrP5uywBy4ZW8VCdrZaEFmY
SMTP_FROM="Ki-Niela" <onboarding@resend.dev>
ADMIN_NOTIFY_EMAIL=tu-correo@gmail.com
```

**Paso 2:** En desarrollo local, si no tienes SMTP configurado:
- Los emails se **loguean a consola** (no se envían realmente)
- Verás líneas como:
  ```
  [mailer:dev] To=usuario@gmail.com Subject=¡Bienvenido a Ki-Niela!
  Hola Usuario, tu cuenta en Ki-Niela fue creada...
  ```

**Paso 3:** En producción (Railway):
- Los emails se envían realmente via Resend
- Usuario recibe correos en su inbox

### En Railway

Las variables ya están configuradas en el dashboard:
```
SMTP_HOST = smtp.resend.com
SMTP_PORT = 587
SMTP_USER = resend  ← (CRÍTICO: estaba vacío antes)
SMTP_PASS = re_SYtRLKLt_EJrP5uywBy4ZW8VCdrZaEFmY
SMTP_FROM = "Ki-Niela" <onboarding@resend.dev>
ADMIN_NOTIFY_EMAIL = daniel.cr031288@gmail.com  ← (NUEVA)
```

**Si los emails no llegan:**
1. Verifica que `SMTP_USER=resend` (no vacío)
2. Verifica que `ADMIN_NOTIFY_EMAIL` apunte a email válido
3. Revisa logs de Railway para errores

### Flujo de Ejemplo

**Usuario "ale" se registra:**
1. Completa form: nombre=Ale, email=ale@example.com, password=pass123
2. POST `/api/auth/register` crea usuario con `status: 'INACTIVE'`
3. Envía email a ale@example.com: "¡Bienvenido a Ki-Niela! Pendiente de activación..."
4. Envía email a admin@kiniela.com: "Se registró: Ale (ale@example.com). Activarlo en /admin/usuarios"
5. Usuario ve toast: "Cuenta creada. Un administrador debe activarte..."

**Admin activa a "ale":**
1. Va a `/admin/usuarios`
2. Ve "Ale" en lista de Pendientes
3. Click botón "Activar"
4. PATCH `/api/admin/users/ale-id` con `action: 'activate'`
5. Ale recibe email: "Tu cuenta Ki-Niela fue activada ✅. Inicia sesión en..."
6. Admin ve toast: "Usuario activado"

**Ale solicita acceso a quiniela con código AMISTOSOS2026:**
1. Ale hace login
2. Va a `/quinielas` → ve "Amistosos Internacionales"
3. Click "Entrar" → modal pide código
4. Ingresa `AMISTOSOS2026`
5. POST `/api/quinielas/.../members/request-access`
6. Admins de quiniela reciben email: "Ale solicitó acceso a Amistosos Internacionales. Ver solicitudes..."
7. Ale ve toast: "Solicitud enviada. Espera aprobación del administrador"

**Admin aprueba a Ale:**
1. Admin va a `/quinielas/.../participantes`
2. Ve "Ale" con estado "Pendiente"
3. Click "Activar"
4. PATCH `/api/quinielas/.../members/ale-member-id` con `action: 'activate'`
5. Ale recibe email: "Aprobado en Amistosos Internacionales ✅. Ir a quiniela..."
6. Admin ve toast: "Usuario activado"

---

## Control de Visibilidad de Quinielas

### ¿Qué se hizo?

Super admin ahora puede habilitar (ACTIVE) o archivar (ARCHIVED) quinielas:
- Quinielas **ACTIVE** → aparecen en "Mis Quinielas" y "Browseable"
- Quinielas **ARCHIVED** → solo visible para super admin

### Archivos Involucrados

**`src/app/api/admin/quinielas/route.ts`** - Listar quinielas

Endpoint `GET /api/admin/quinielas`:
- Solo accesible por SUPER_ADMIN
- Retorna lista de todas las quinielas con:
  - nombre, status, evento
  - count de miembros activos
  - código de invitación

**`src/app/api/admin/quinielas/[quinielaId]/route.ts`** - Cambiar status

Endpoint `PATCH /api/admin/quinielas/[id]`:
- Solo accesible por SUPER_ADMIN
- Body: `{ status: 'ACTIVE' | 'CLOSED' | 'ARCHIVED' }`
- Cambia status de quiniela
- Crea audit log para seguimiento

**`src/app/admin/usuarios/page.tsx`** - Panel admin

Nueva sección "Visibilidad de Quinielas":
- Lista todas las quinielas
- Switch ON/OFF por cada una
- ON = `ACTIVE` (habilitada)
- OFF = `ARCHIVED` (archivada)
- Muestra evento, código de invitación, count de miembros

**`src/app/quinielas/page.tsx`** - Listado de quinielas

Modificado para:
1. Usuarios regulares → no ven quinielas `ARCHIVED`
2. Super admin → ve todas (incluso ARCHIVED)
3. Código:
   ```typescript
   where: {
     // Si no eres super admin, excluye ARCHIVED
     ...(isSuperAdmin ? {} : { quiniela: { status: { not: 'ARCHIVED' } } }),
   }
   ```

### Cómo Usar

**Como super admin:**

1. Ve a `/admin/usuarios`
2. Scroll abajo → sección "Visibilidad de Quinielas"
3. Ve lista de quinielas con switch:
   ```
   [ON]  Ki-Niela Mundial 2026      [Evento: FIFA World Cup 2026]
   [OFF] Ki-Niela Amistosos...      [Evento: Amistosos Internacionales]
   ```
4. Click switch OFF para una quiniela → toggle a ARCHIVED
   - Quiniela desaparece del listado público
   - Usuarios existentes NO la ven en "Mis Quinielas"
   - Usuarios NO pueden solicitar acceso
5. Click switch ON → vuelve a ACTIVE
   - Quiniela reaparece

**Consecuencias de archivar:**
- ❌ No aparece en `/quinielas` para usuarios regulares
- ❌ No aparece en "Mis Quinielas" para usuarios regulares
- ❌ No se puede solicitar acceso con código
- ✅ Solo super admin la sigue viendo
- ✅ Si eras miembro ANTES de archivarla → desaparece de tu lista (si eres usuario regular)

---

## Configuración de SMTP en Railway

### Requisito Crítico

Para que los emails funcionen en producción, **DEBES actualizar Railway con 2 variables:**

1. **SMTP_USER** (estaba vacío, debe ser `resend`)
2. **ADMIN_NOTIFY_EMAIL** (nueva, apunta a tu correo real)

### Pasos

1. **Ve a Railway dashboard**: https://railway.app/dashboard
2. **Selecciona proyecto "Ki-Niela"**
3. **Ve a pestaña "Variables"**
4. **Busca variable `SMTP_USER`**:
   - Valor actual: (vacío)
   - Cambiar a: `resend`
   - Click "Save"
5. **Busca variable `ADMIN_NOTIFY_EMAIL`** (probablemente no existe):
   - Si no existe, click "Add Variable"
   - Nombre: `ADMIN_NOTIFY_EMAIL`
   - Valor: `daniel.cr031288@gmail.com`
   - Click "Add"
6. **Railway redeploya automáticamente** (~2-3 minutos)

### Verificación

Después de redeploy:

1. **Registra nuevo usuario** en https://ki-niela-production.up.railway.app/register
2. **Verifica tu Gmail** (`daniel.cr031288@gmail.com`):
   - Deberías recibir email: "Se registró un nuevo usuario: [nombre]..."
3. **Verifica email del usuario**:
   - Deberías recibir email: "¡Bienvenido a Ki-Niela!..."

Si NO recibes emails:
- Verifica que ambas variables estén en Railway
- Revisa logs de Railway para errores
- Confirma que Resend API key sigue siendo válida

---

## Cómo Probar Localmente

### Setup Inicial

**1. Clonar repo y instalar dependencias:**
```bash
cd /home/danielp/repo/app_KI-Niela
npm install
```

**2. Base de datos local (si usas PostgreSQL local):**
```bash
# Si tienes BD local configurada en .env.local
DATABASE_URL="postgresql://postgres:cisco1372@localhost:5432/bd_kiniela?schema=public"
```

**3. Generar Prisma Client:**
```bash
npx prisma generate
```

### Ejecutar Localmente

**Dev server:**
```bash
npm run dev
```
Abre http://localhost:3001

**Test emails (dev mode):**

En desarrollo, si faltan variables SMTP, los emails se loguean a consola:

```bash
SMTP_HOST=smtp.resend.com \
SMTP_PORT=587 \
SMTP_USER=resend \
SMTP_PASS=re_SYtRLKLt_EJrP5uywBy4ZW8VCdrZaEFmY \
SMTP_FROM="Ki-Niela" <onboarding@resend.dev> \
ADMIN_NOTIFY_EMAIL=tu-correo@gmail.com \
npm run dev
```

Luego:
1. Registra usuario
2. Revisa terminal → ver logs de emails

**Seed amistosos:**
```bash
npx tsx scripts/seed-amistosos.ts
```

**Verificar cambios:**
```bash
git log --oneline -10
```

---

## Commits Relevantes

| Commit | Descripción |
|--------|-------------|
| `cb71b5b` | Agregar quiniela Amistosos + expandir flags |
| `6c10d06` | Perfil de usuario + dropdown en header |
| `5a0bfe1` | Fix responsive para móvil |
| `e494ef7` | Emails automáticos con plantillas |
| `6e85433` | Toggle visibilidad de quinielas |

---

## Troubleshooting

### Los emails no se envían en producción

**Checklist:**
1. ¿Están las variables en Railway?
   - `SMTP_USER=resend` (no vacío)
   - `ADMIN_NOTIFY_EMAIL=tu-correo@gmail.com`
2. ¿Redeploy completó?
   - Revisa Railway: debe estar "Success"
3. ¿Resend API key es válida?
   - Mira en code: `SMTP_PASS=re_...` (debe ser string válido)

### Quiniela Amistosos no aparece

**Checklist:**
1. ¿Corriste seed-amistosos?
   ```bash
   npx tsx scripts/seed-amistosos.ts
   ```
2. ¿La quiniela está en ACTIVE status?
   - Revisa DB: `SELECT * FROM "Quiniela" WHERE name LIKE '%Amistosos%'`
3. ¿Tienes usuario ACTIVE?
   - Para ver quinielas browseable debes estar ACTIVE globalmente

### Perfil no funciona

1. ¿Estás logueado? (ve a /login)
2. ¿Ves avatar en header? (si no, refresh browser)
3. ¿Hiciste click en avatar? (desktop: arriba derecha; mobile: hamburger)
4. ¿Cambios se guardan? Revisa BD después de "Guardar datos"

---

## Resumen Rápido

| Feature | Estado | Ubicación |
|---------|--------|-----------|
| Amistosos 2026 | ✅ Implementado | `scripts/seed-amistosos.ts` |
| Perfil de usuario | ✅ Implementado | `/perfil` |
| Cambio contraseña | ✅ Implementado | `/perfil` → "Cambiar contraseña" |
| Emails automáticos | ✅ Implementado | `src/lib/mailer-templates.ts` |
| Toggle quinielas | ✅ Implementado | `/admin/usuarios` → "Visibilidad de Quinielas" |
| Responsive mobile | ✅ Optimizado | `/perfil` |
| Banderas nuevas | ✅ Expandidas | `src/lib/flags.ts` |

---

## Contacto / Preguntas

Si algo no está claro o no funciona:
1. Revisa este documento
2. Busca commit relevant en git log
3. Lee los comentarios en código
4. Abre issue en GitHub

**Happy coding! ⚽**
