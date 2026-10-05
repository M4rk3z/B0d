# B0D Control web — base 0.1.0

Estado: base probada localmente, no desplegada y sin conexión con la APK. Incluye login/logout y alta/consulta de colaboradores. El resto de la administración y sincronización está pendiente según ../ARQUITECTURA_WEB_RENDER.md. No reemplaza todavía la app existente.

## Desarrollo

Node 22 y pnpm 11.19.0. Instalar con `pnpm install --frozen-lockfile`. Copiar `.env.example` a `.env` (ignorado por Git) y configurar una base PostgreSQL de desarrollo propia, PUBLIC_URL, ADMIN_USER y ADMIN_PASSWORD de al menos doce caracteres. Ejecutar `npm start` o `pnpm start`. No hay credenciales predeterminadas.

`pnpm test` usa PostgreSQL embebido en memoria mediante PGlite. No necesita una cuenta Render. Si no hay pnpm en PATH, este equipo tiene el ejecutable JS en el runtime de Codex, invocable mediante node.

Migración inicial transaccional e idempotente al iniciar, con bloqueo advisory para evitar inicializaciones concurrentes. Sesiones por 30 minutos, cookies Secure si PUBLIC_URL usa HTTPS. La contraseña de entorno se deriva en memoria con scrypt; no se devuelve ni se registra. No hay recuperación/cambio de usuario web implementados todavía. El bloqueo de login es global para esta cuenta administrativa única.

## Render

El archivo `../render.yaml` es una plantilla de evaluación: web Node y Postgres free en Oregon. No se ejecutó ni validó en una cuenta Render. Render proporciona RENDER_EXTERNAL_URL; PUBLIC_URL solo es necesario si se usa otra URL/dominio. Configurar ADMIN_USER y ADMIN_PASSWORD en su formulario de secretos. La conexión Postgres privada se referencia automáticamente; ipAllowList vacío bloquea accesos externos.

El Blueprint requiere un repositorio conectado. Esta carpeta todavía no tiene despliegue ni URL pública. No cargar datos operativos hasta decidir el plan, respaldos y aceptación. El servidor escucha PORT y /healthz consulta la base.

Dependencias fijadas en package.json y pnpm-lock.yaml. Las fotos, plantillas, tokens de tablet y datos SQLite actuales aún no se importan. Los colaboradores que se creen aquí son independientes hasta implementar la migración/vinculación.

## Usuarios web (2026-10-04)
- Admin: gestión de colaboradores y cuentas; creación, cambio de rol, activación/desactivación y cambio de contraseña.
- User: creación de cuentas User y consulta/descarga CSV de colaboradores. Sin edición de colaboradores ni gestión de cuentas existentes.
- La cuenta inicial configurada en Render se importa una sola vez como Admin. Las variables de entorno no sobrescriben cambios posteriores de contraseña.
- Migración de esquema 1 a 2 conserva colaboradores y revoca sesiones anteriores sin cuenta asociada. Se requiere iniciar sesión de nuevo tras esta actualización.
- Cambiar una cuenta revoca sus sesiones. No se permite desactivar o degradar al último Admin activo.
- Descargas de asistencia, horas y reportes PDF/XLSX siguen pendientes de sus respectivas fases.
- Validación local: pruebas HTTP/PostgreSQL embebido y comprobación de sintaxis. Pendiente comprobar interfaz y despliegue real en Render.

## Sincronización de tablet
Esquema 3 añade dispositivos, mapeos de colaboradores y marcaciones UUID inmutables. `/api/device/*` usa Bearer con hash de token persistido; endpoints web mantienen sesión/Origin y Admin para gestionar dispositivos. Migraciones transaccionales y repetibles. No se admiten credenciales de PostgreSQL en el cliente. Ver ../PRUEBA_SINCRONIZACION.md.
