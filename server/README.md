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
