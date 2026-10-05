# Nueva arquitectura acordada — migración por fases

Esta decisión sustituye el diseño de administración dentro de la APK. La versión alpha4 sigue siendo la última APK funcional mientras se prepara la migración; no se ha publicado todavía una APK conectada a Render.

## Destino

```text
Tablet Android: cámara + marcaciones + bloqueo local por PIN
                         │ HTTPS / credencial de dispositivo
                         ▼
                   API en Render ◄── HTTPS ── Web administrativa
                         │ conexión privada del servidor
                         ▼
                  PostgreSQL en Render
```

La APK no contiene la contraseña de PostgreSQL ni se conecta directamente al puerto 5432. La web tampoco expone la conexión. La API aplica permisos, validaciones y reglas de negocio. Web y API se proponen en el mismo servicio Render para simplificar sesiones y despliegue.

### APK final

- Solo terminal de marcaciones, reconocimiento facial y controles mínimos de conexión/bloqueo. Sin dashboard, catálogo, horarios ni historial administrativo.
- Se conservan Entrada/Salida y, salvo indicación contraria, Comida/Break solicitados anteriormente.
- PIN local para bloquear/desbloquear el uso, separado de la contraseña web. Se reutiliza el almacenamiento seguro del PIN existente; no se envía a la web.
- Primera apertura: solicitar cámara mediante Android; mostrar estado y reintento si se deniega, sin repetir automáticamente el diálogo en un bucle. Internet es un permiso normal del manifiesto, no genera diálogo. No pedir micrófono, ubicación, galería ni otros permisos sin una función que los necesite.
- Vinculación a la organización/dispositivo mediante código temporal emitido desde la web. Token revocable exclusivo de la tablet, protegido con AndroidKeyStore. Nunca usar credenciales de administrador web para sincronizar.
- Propuesta pendiente de confirmación: caché privada y cola local para seguir marcando sin Internet. PostgreSQL sería la fuente central; SQLite solo soporte local y cola de envío. Eventos UUID idempotentes, confirmación explícita y reintentos sin duplicados. Distinguir pendiente de sincronización de guardado remoto confirmado.

### Web final

- Autenticación administrativa independiente del PIN.
- Personal: altas, estado, eliminación con protecciones, perfiles faciales y asignación de horario.
- Horarios y descansos con las reglas existentes; versiones/vigencias para no recalcular retrospectivamente jornadas cerradas.
- Dashboard, avisos, extras, cumplimiento e historial; estilo corporativo y AllinoneScreen.
- Gestión de vinculación/revocación de tablet. Actualización de catálogos y plantillas en la APK con versión, sin sobrescribir marcaciones locales pendientes.
- Registro facial desde navegador por cámara con permiso, validación y generación de plantilla compatible con el motor de tablet. Aún pendiente implementar y validar; no subir automáticamente los perfiles locales actuales.

## Fase cerrada en este bloque: base web y PostgreSQL

Se añade `server/`: Node.js, controlador pg, migración PostgreSQL inicial, autenticación administrativa con cookie HttpOnly/SameSite, sesión persistida por hash con caducidad, protección de origen, bloqueo tras cinco intentos incorrectos, consultas parametrizadas y auditoría del alta. Web real de acceso y alta/consulta de colaboradores, con estado visible de tablet no vinculada. Sin métricas ficticias ni controles presentados como terminados.

`render.yaml` prepara servicio web y PostgreSQL de evaluación en la misma región y bloquea acceso público a PostgreSQL. Solo es configuración: no se ha creado ningún recurso ni activado facturación. Los planes free del ejemplo son de evaluación; revisar límites y plan definitivo antes del control operativo.

Pruebas: once escenarios de integración en PostgreSQL embebido PGlite, reportados por Node como doce tests incluyendo el contenedor. Cubren migración repetible, acceso anónimo, origen externo, credenciales, cookie, alta, duplicados/auditoría, campos inválidos, logout, bloqueo y exposición de la página pública. No sustituyen una prueba de conexión a PostgreSQL real en Render ni una prueba visual en navegador.

## Orden de los siguientes bloques

1. Conectar el repositorio/proyecto Render elegido y probar API + PostgreSQL reales. Confirmar política sin Internet y conservar respaldo verificable de datos actuales antes de migrar.
2. Trasladar horarios, asignaciones, cálculos e historial manteniendo los casos de REGLAS_HORARIOS.md; migración de UUID/fechas/zonas sin duplicar eventos. El portal actual todavía no incluye esas funciones.
3. Trasladar perfiles faciales, implementar vinculación y sincronización con pruebas de autorización, conflictos, reintentos y revocación. No exponer fotos o plantillas a sesiones/dispositivos no autorizados.
4. Entregar la APK de terminal: permisos iniciales, PIN de bloqueo, retirada del panel interno y conexión a la API. Retirar administración local solo cuando la web permita seguir gestionando el sistema.
5. Probar extremo a extremo en tablet y Render: alta web → sincronización → identificación → marcación → historial/cálculo web, caída de red, reinicio, revocación y restauración.

## Datos necesarios para el despliegue

Pendiente del usuario: cuenta/proyecto Render y repositorio que se conectará, si existen; política de operación sin conexión. No enviar contraseñas o claves en el chat. ADMIN_USER/ADMIN_PASSWORD se configuran en los secretos del servicio; DATABASE_URL se obtiene mediante referencia interna en Blueprint.

Referencias: [Render Postgres](https://render.com/docs/postgresql-creating-connecting), [Blueprints](https://render.com/docs/blueprint-spec), [conexión con pg](https://node-postgres.com/features/connecting).

## Decisión confirmada 2026-10-04 y fase de sincronización
Render ya desplegado y acceso web confirmado por el usuario. URL: https://b0d-control-web.onrender.com. GitHub M4rk3z/B0d, rama main. Fire HD 10 con Fire OS 7.3.3.1 validada por usuario en alpha4.
La operación sin Internet queda aprobada: PostgreSQL central, caché/cola SQLite local. La fase 0.5.0-alpha1 implementa vinculación con credencial larga revocable (no código temporal), subida de colaboradores/marcaciones y catálogo central. Ver PRUEBA_SINCRONIZACION.md para alcance; biometría/horarios aún no migrados. Las notas anteriores de recursos no creados y política offline pendiente quedan superadas por esta actualización.
