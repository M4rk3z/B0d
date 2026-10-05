# Estado del proyecto

Actualizado: 2026-09-29.

## Objetivo vigente

Nueva decisión del usuario: APK exclusivamente como terminal de marcaciones con bloqueo por PIN y permisos al primer inicio; toda la administración pasa a web y PostgreSQL en Render. Ver ARQUITECTURA_WEB_RENDER.md. Migración por bloques para preservar funcionalidad y datos.

## Bloque vigente: base de arquitectura web/Render

Se creó server/ (Node + pg) con web de acceso y alta/consulta de colaboradores, sesiones persistentes protegidas, control de origen, bloqueo tras cinco fallos, migración PostgreSQL transaccional y auditoría de alta. render.yaml configura un despliegue de evaluación web+Postgres privados entre sí; no se ejecutó en Render. Dependencias fijadas y once escenarios de integración aprobados con PGlite (doce tests contando contenedor). No probado contra PostgreSQL remoto ni visualmente en navegador.

La APK alpha4 se conserva intacta: NO se ha conectado a nube, NO se retiró todavía administración local, NO se cambió aún permisos/PIN al nuevo flujo. Pendientes: cuenta/proyecto/repositorio Render, decisión offline, traslado completo de horarios/cálculos/historial/perfiles, sincronización y nueva APK. No presentar el portal de base como administración completa ni subir datos actuales automáticamente. Preguntas enviadas al usuario mediante herramienta asíncrona, sin respuesta al redactar este estado. Uso al comenzar: 74 % cinco horas/35 % semanal; trabajo acotado a cerrar base comprobable, sin consumir reinicios.

## Completado

- Revisada la carpeta inicial: repositorio sin archivos de aplicación.
- Documentados alcance, entregas y criterios de cierre en PLAN_DEL_PROYECTO.md.
- Identificadas las decisiones que afectan arquitectura, cálculos y reconocimiento facial.

## Estado vigente: 0.4.0-alpha4 — pulido visual

Solicitud: engrane menor y centrado, botones centrados, retirar explicaciones (incluido PIN), barra flotante según referencia, sombras y refresco cada cinco minutos sin botón. Implementado en MainActivity: engrane ImageButton 48 dp, textos de botones centrados, tarjetas/botones con elevación, barra blanca redondeada con Inicio central y navegación Personal/Horarios/Inicio/Historial/Salir (Salir reutiliza cierre de sesión existente). Se retiran ayudas introductorias; permanecen mensajes de error, confirmaciones y formatos necesarios.

Intervalo del dashboard 300000 ms con guardas de pantalla/sesión y conservación de desplazamiento. Se elimina Actualizar resumen. Mantiene cierre administrativo por dos minutos de inactividad: el refresco no renueva sesión; para observar el intervalo hay que mantener la sesión activa. Datos actuales se cargan al volver a entrar. APK objetivo alpha4, versionCode 11, SQLite 6 y firma anterior. Cambio visual, sin nuevas pruebas unitarias redundantes; compilación/lint y firma se verifican para entregar. Revisión visual en tablet pendiente. Uso consultado: 60 % cinco horas/33 % semanal; no se consumieron reinicios.

## Histórico: 0.4.0-alpha3 — menús adaptables y dashboard

Solicitud: aprovechar el ancho de cualquier pantalla y remodelar los menús internos según dos bocetos. Home administrativo con estado/avance diario, avisos, extras acumuladas globales y cumplimiento; Personal Operativo en tarjetas, sin nuevas operaciones. Implementado ancho flexible sin límite de 720 dp, contenido desplazable con barra inferior fija Personal/Horarios/Inicio/Historial e iconos, tarjetas adaptables de una a cuatro columnas y tarjeta de alta +. Paleta azul conservada. El registro mantiene perfil facial, horario, activación/desactivación y borrado con sus restricciones existentes.

AdminDashboard consulta los cálculos existentes sin modificar marcaciones. Cumplimiento diario ponderado = suma min(efectivo, objetivo individual)/suma objetivos de activos; ausentes con horario aportan cero, sin horario quedan fuera. No es puntualidad. Extras acumuladas: historial global, incluidos inactivos, excluyendo secuencias inválidas, con señal de provisionalidad. Avisos de retardo, entrada pendiente, marcaciones a revisar y jornadas anteriores abiertas. Actualiza cada 30 segundos sin renovar sesión y conserva desplazamiento. Las reglas de fechas nocturnas existentes permanecen.

APK `entregas/B0d-Asistencia-0.4.0-alpha3.apk`, versionCode 10, SQLite 6. Siete escenarios nuevos de DashboardProgress aprobados (extra no compensa ausencia, ponderación por horas, sin horario y límites). Compilación y lint correctos: 0 errores/16 avisos (versiones, recursos anteriores sin uso y compatibilidad de drawable). Sin ejecución de interfaz ni integración del repositorio Android en emulador. Validar visualmente vertical/horizontal, fuente ampliada y datos reales según PRUEBA_MENUS.md; no afirmar compatibilidad probada con todos los tamaños. Pruebas y límites faciales de alpha2 siguen vigentes.

Uso consultado durante este bloque: 34 % cinco horas / 29 % semanal; no se consumieron reinicios. Cerrar con APK y prueba física antes de ampliar alcance.

## Histórico: 0.4.0-alpha2 — kiosco y comparación facial

El usuario pidió marcar por rostro sin código y proporcionó un boceto: cámara grande, Entrada/Salida, Comida y Break con iconos, engrane para administración, sin descripciones y con los colores corporativos actuales. Implementado ese inicio en MainActivity, ajustable al espacio de tablet, con estados transitorios y confirmación en la misma pantalla. Engrane mantiene PIN y configuración inicial. La cámara tiene vista previa en espera y captura únicamente después de tocar la acción.

Se incorpora OpenCV Android 4.12.0, YuNet y SFace oficiales incluidos en assets, con hashes y licencias en NOTICE.txt. FaceEngine alinea y genera vectores de 128 dimensiones; FaceProfiles guarda plantillas AES-GCM vinculadas a UUID/modelo, convierte fotos alpha1 al primer uso y rechaza duplicados al registrar. FaceMatchRules exige coseno >=0.55 y margen >=0.10; parámetros de piloto, sin garantía de precisión. También compara inactivos para no confundirlos con activos; WorkersDb valida estado al marcar. Desconocidos, ambigüedad, perfil ilegible o captura obsoleta no producen marcación.

SQLite 6 conserva punches/contextos/perfiles, añade plantilla/modelo y auditoría facial con acción/score/modelo. Método facial distinguido del manual. Comida/Break alternan inicio/regreso, requieren mismo tipo para regreso y respetan marcado de descansos. Conserva cálculo anterior y validación de secuencia; añade intervalo mínimo de cinco segundos entre marcaciones faciales. Cierra cámara al abandonar y descarta resultados fuera de pantalla; una escritura ya autorizada puede terminar.

APK `entregas/B0d-Asistencia-0.4.0-alpha2.apk`, versionCode 9, misma firma verificada y sin permisos de Internet/almacenamiento. Entregas anteriores preservadas. Compilación y lint correctos (0 errores/6 avisos de versiones/atributo). 207 pruebas: 39 perfiles/comparación, 40 SQL, 128 reglas anteriores. Prueba de modelos en escritorio OpenCV 4.12.0: variante del mismo ejemplo 0.991 y otro ejemplo 0.130; imagen vacía rechazada. No equivale a evaluación de precisión ni ejecución Android. CameraX, JNI, AndroidKeyStore, interfaz y operación real aún requieren tablet según PRUEBA_KIOSCO_FACIAL.md. No hay emulador.

Límites: sin prueba de vida/antispoofing, sin validación de falsos positivos en los colaboradores reales, umbrales provisionales. No usar como control definitivo sin aceptación supervisada. Próximo bloque: prueba física y correcciones según resultados, no ampliar funciones antes de verificar identidades, modo avión, reinicio y pausas. Uso inicial de este turno: 36 % cinco horas/17 % semanal; cierre: 72 %/23 % (28 %/77 % disponibles). No se consumieron reinicios. APK universal 220 587 600 bytes, SHA-256 D5E5B9B1ABED38BCD7C12E0DEA8838E7D3CE5F916DBFBF0D203CA1418ACA58FF.

## Histórico: 0.4.0-alpha1 — perfiles faciales de referencia

El usuario autorizó comenzar lectura, registro y guardado de perfiles para uso posterior en entrada/salida. Implementada captura CameraX integrada en ficha administrativa, detector ML Kit incluido sin descarga en tablet, validación de un rostro completo de tamaño mínimo y pose frontal, revisión antes de guardar, consulta con fecha, reemplazo y eliminación confirmada. Sigue AllinoneScreen dentro del contexto del colaborador. La primera solicitud de permiso cierra sesión y explica volver con PIN; pausas/rotación/inactividad descartan captura sin guardar y liberan cámara. No hay reconocimiento, embeddings, detección de duplicados ni prueba de vida; no presentar esta foto como biometría identificadora lista. La fase siguiente podría necesitar recaptura.

APK `entregas/B0d-Asistencia-0.4.0-alpha1.apk`, versionCode 8, esquema SQLite 5. Preserva versión anterior y firma. Tabla face_profiles vinculada por UUID con borrado en cascada al eliminar trabajador permitido; fotos cifradas AES-256-GCM, AAD por colaborador, clave AndroidKeyStore. JPEG en memoria y almacenamiento privado; sin permisos de Internet/almacenamiento en APK final. Eliminar foto conserva historial y trabajador. Migración añade tabla sin tocar registros existentes.

181 comprobaciones aprobadas: 19 sobre de cifrado/encuadre, 34 SQLite, 23 PIN, 16 campos, 13 secuencia, 29 horarios, 47 cálculos. Compilación y lint exitosos, 0 errores/5 avisos (atributo de API y versiones disponibles). Firma e identificación verificadas con apksigner/aapt. No hay emulador: cámara real, ciclo de vida, permisos, AndroidKeyStore y ML Kit en dispositivo pendientes según PRUEBA_PERFILES_FACIALES.md. Pruebas del cifrado usan proveedor Java, no AndroidKeyStore. Mantener esta distinción.

Uso consultado: inicio 2 % en cinco horas/12 % semanal, revisión de cierre 27 %/16 % (73 %/84 % disponibles en ese momento). No se consumieron reinicios. Cerrar esta fase con APK y prueba en tablet antes de iniciar comparación facial. Próximos pasos: aceptar captura offline/consulta persistente/borrado, elegir modelo y política de coincidencias, generar plantillas y validar errores antes de integrar asistencia. Marcación manual permanece operativa.

## Histórico: 0.3.0 — jornada unificada

APK `entregas/B0d-Asistencia-0.3.0.apk`, versionCode 7, esquema SQLite 4, firma coincidente. Se conserva alpha1 y las entregas anteriores. El usuario aceptó la configuración alpha1 y pidió continuar manteniendo AllinoneScreen. Ver GUIA_UX.md: criterio explícito de diseño para todo el proyecto.

Implementado: marcaciones BREAK_START/BREAK_END, descuento automático por intersección con presencia o descuento real marcado, resúmenes diarios que agrupan entradas, ordinarias/extras contra jornada efectiva nominal y retardo separado. Estados abiertos, descansos faltantes y secuencia/reloj incorrectos se señalan como provisionales. Sin horario no se inventan extras. Pantalla Mi jornada muestra estado, horario, métricas y acciones; guarda y actualiza en la misma pantalla. Historial administrativo tiene resúmenes y detalle desplegable.

Archivos nuevos: WorkCalculator.java (lógica pura), AttendanceRepository.java (contexto por entrada y agrupación), calculations_v4.sql (migración conservadora a nuevos tipos de evento y shift_contexts), GUIA_UX.md y PRUEBA_CALCULOS.md. WorkersDb/SchedulesRepository preservan protecciones con jornadas en descanso. La migración Java rellena contextos de entradas anteriores usando las asignaciones vigentes; no inventa descansos.

156 comprobaciones aprobadas (47 cálculo/descanso + 29 horarios + 13 secuencia + 16 campos + 23 PIN + 28 SQLite); compilación y lint exitosos (0 errores, 2 avisos). Firma verificada. Scripts/Test-Calculations.ps1 ejecuta nuevas reglas; tests/test_calculations_schema.py prueba esquema/migración. No hay prueba automatizada del repositorio Android ni de interfaz en emulador. Pendiente aceptación en tablet según PRUEBA_CALCULOS.md.

Uso: al iniciar 35 % usado en 5 horas / 5 % semanal; al cerrar la compilación 67 % / 11 % (33 % / 89 % disponibles en esa consulta). Cerrar este bloque con APK y documentos, sin comenzar otra fase grande. Consultar uso de nuevo al retomar. No se consumieron reinicios desde este chat.

Pendientes: prueba de actualización/flujo en tablet; correcciones de incidencias, selección manual de jornada para entradas nocturnas atípicas, respaldo/exportación, recuperación de PIN, reconocimiento facial y demás alcance original. Los casos nocturnos fuera del intervalo anterior se asignan al día actual; no afirmar cobertura de todas las políticas de turnos. Próxima fase se decidirá con resultados y margen, respetando AllinoneScreen y autorización existente.

## Histórico: configuración 0.3.0-alpha1

Entregada la configuración de horarios y asignaciones en `entregas/B0d-Asistencia-0.3.0-alpha1.apk`. VersionCode 6; misma firma; esquema SQLite 3. Prueba en tablet pendiente según PRUEBA_HORARIOS.md. Se conservan todas las APK anteriores.

Reglas confirmadas: casilla por horario para exigir marcaciones de comida/descansos; desmarcada implica descuento automático. Extras solo al superar horas efectivas programadas; retardo separado. Ver REGLAS_HORARIOS.md. En esta entrega el modo solo se guarda, todavía no hay marcaciones de descanso ni cálculo real de horas, extras o retardos.

Implementado: horarios por día de semana, turnos nocturnos, hasta 8 intervalos no pagados por día, jornada efectiva prevista, creación de plantillas inmutables y asignaciones por trabajador con vigencia e historial. Sin edición retroactiva ni reemplazo de fecha de asignación existente.

Archivos clave: ScheduleRules.java, SchedulesRepository.java, schedules_v3.sql; WorkersDb.java migra versiones 1/2 a 3 y elimina asignaciones al borrar un trabajador sin marcaciones; MainActivity.java añade pantallas protegidas. Scripts/Test-Schedules.ps1 y tests/test_schedules_schema.py verifican reglas y esquema; mantener pruebas previas.

Validación: 103 comprobaciones aprobadas, assembleDebug/lintDebug correctos (0 errores, 3 avisos), firma y manifiesto verificados. Tests SQLite ejecutados en Python; no se ejecutó repositorio Android ni interfaz en emulador. Aceptación física pendiente.

Uso consultado en esta entrega: inicio 11 % de 5 horas / 2 % semanal; cierre 30 % / 5 % (70 % / 95 % disponible en esa instantánea). No se solicitó ni consumió un reinicio de cuota desde este chat. No usar las instantáneas antiguas siguientes como estado actual.

Siguiente bloque autorizado: marcaciones de comida/descanso y cálculo de horas ordinarias, extras y retardos según REGLAS_HORARIOS.md. Consultar uso antes de iniciarlo; no pedir otra autorización para este alcance. Mantener la APK actual como entrega de configuración verificable.

## Histórico de entregas anteriores

Entrega visual posterior: `entregas/B0d-Asistencia-0.2.1.apk` (versionCode 5). Diseño básico inspirado en referencia: fondo gris claro, tarjeta blanca centrada con ancho máximo, azul corporativo, controles redondeados y jerarquía tipográfica. Firma verificada; informe lint: 0 errores, 2 avisos. Sin cambios de esquema ni reglas de asistencia. Pendiente revisión visual en tablet. La consulta al iniciar este ajuste mostró 92 % usado en la ventana de 5 horas; no abrir otra fase sustancial sin consultar el margen actualizado. Se conserva 0.2.0.

Los tres bloques de 0.2.0 están implementados y compilados en `entregas/B0d-Asistencia-0.2.0.apk`. Incluye borrado de trabajadores sin marcaciones solicitado por el usuario y asistencia manual. Pendiente aceptación de actualización y funcionamiento en tablet según PRUEBA_ASISTENCIA.md. El usuario respondió afirmativamente a alpha2 y pidió borrado y tercer bloque.

## Decisiones y pregunta pendiente

- El usuario confirmó una sola tablet compartida.
- Base seleccionada: Android nativo en Java y persistencia SQLite local prevista.
- Operación sin internet como criterio inicial; panel web posterior.
- El usuario confirmó Android 14 (API 34). Marca y modelo no bloquean la compilación inicial.

## Próxima entrega

Preferencia explícita del usuario: gestionar el trabajo según el uso disponible para evitar dejar fases a medias. No requiere nueva confirmación para cada bloque ya autorizado.

La versión 0.2.0 se divide en bloques de implementación y verificación:

1. Acceso administrativo: implementado en alpha1 y aceptado por el usuario. PIN de seis dígitos derivado con PBKDF2-SHA256 y salt aleatorio; SharedPreferences privadas, bloqueo de cinco minutos tras cinco fallos, sesión en memoria y cierre por inactividad o al salir. No hay cambio/recuperación de PIN.
2. Colaboradores: implementado. Alta, consulta, desactivación/reactivación y borrado confirmado cuando no existen marcaciones. Se conserva bitácora técnica del borrado. Con historial se permite desactivar, no borrar. No se desactiva con jornada abierta.
3. Asistencia: implementado en 0.2.0. Entrada/salida manual por código, confirmación de nombre, validación transaccional de secuencia y hora, almacenamiento local y consulta administrativa de últimas 200 marcaciones (todas permanecen almacenadas).

Cada bloque debe terminar compilado y con las comprobaciones correspondientes antes de abrir el siguiente. No presentar los bloques intermedios como la versión 0.2.0 terminada.

APK 0.2.0: configuración de PIN administrativo, alta y desactivación de colaboradores, entrada/salida manual y consulta de marcaciones con persistencia SQLite. Evitar entradas o salidas consecutivas y comprobar conservación de datos al reiniciar. El reconocimiento facial sigue reservado para una etapa posterior.

## Gestión del uso

- Consultar el uso de la cuenta antes de cada bloque sustancial y al cerrar una entrega; evitar consultas constantes.
- Última consulta al cerrar 0.2.0: 86 % usado en ventana de 5 horas y 23 % en semanal (14 % y 77 % disponibles). Al iniciar este bloque estaba en 68 % y 20 %. Es una instantánea compartida, no un presupuesto garantizado.
- Se cierra el tercer bloque con APK y verificaciones guardadas. No iniciar otra fase sustancial con este margen. Consultar el uso al retomar; no consumir reinicios de cuota automáticamente.
- Reducir el tamaño del siguiente bloque si el margen baja. Reservar margen para validación, correcciones y documentación; los porcentajes no permiten predecir exactamente el coste de una tarea.
- No iniciar un nuevo bloque sustancial con menos de 25 % restante en cualquiera de las ventanas, como regla interna conservadora, no como límite del producto. Con margen insuficiente, cerrar y guardar el bloque actual.
- Mantener disponible la última APK validada, sin sobrescribirla con una entrega incompleta.
- Registrar archivos cambiados, validaciones, pendientes y siguiente paso al cerrar cada bloque. Si ocurre una interrupción inesperada, describir honestamente lo que quedó incompleto al retomar.
- No garantizar que una fase nunca se interrumpirá: el uso es compartido con otras tareas y pueden surgir fallos imprevistos.

## Validación y límites actuales

JDK 17, Gradle 8.13 y Android SDK 36 preparados en .tools. Wrapper generado. assembleDebug y lintDebug exitosos. Firma APK v2 verificada y manifiesto inspeccionado: API mínima 26, objetivo 36. Instalación y ejecución en Android 14 confirmadas por el usuario.

Alpha1: 23 comprobaciones de política de credenciales aprobadas, assembleDebug y lintDebug exitosos (0 errores, 2 avisos: atributo API 33 y versión Gradle). Firma válida e idéntica a 0.1.0. Corregida navegación Atrás para Android moderno, añadidos icono, tema y exclusiones de respaldo. Se conserva la APK 0.1.0.

Cambios principales: AdminAccess.java (política), PreferenceCredentialStore.java (persistencia), MainActivity.java (pantallas/sesión), recursos, manifest, versión y tests/AdminAccessTest.java. Repetir pruebas con scripts/Test-AdminAccess.ps1 y compilación con scripts/Build-Android.ps1. El compilador necesitó ejecución fuera del sandbox por acceso denegado a core-lambda-stubs.jar del SDK.

Alpha2: WorkersDb.java y workers_v1.sql crean attendance.db (versión 1) con workers y worker_events; WorkerFields.java valida datos; MainActivity.java incorpora catálogo, formulario y confirmaciones protegidas. 46 comprobaciones aprobadas (23 PIN + 16 campos + 7 SQLite en Python). Compilación/lint aprobados, firma válida coincidente y versionCode 3. Lint: 0 errores y 3 avisos no bloqueantes. Ver PRUEBA_TRABAJADORES.md.

0.2.0: migración explícita SQLite v1→v2 en WorkersDb.java, esquema attendance_v2.sql, política PunchRules.java y pantallas de marcación/historial/borrado. 66 comprobaciones aprobadas, assembleDebug/lintDebug aprobados (0 errores, 2 avisos), firma válida coincidente y versionCode 4. APK anterior conservada. Ver PRUEBA_ASISTENCIA.md.

Pendiente aceptación de 0.2.0 en tablet. Las pruebas de migración ejecutan los SQL reales en Python, no el repositorio Android; conservación del PIN y actualización real requieren tablet. No hay horarios, cálculo de horas, correcciones, reconocimiento facial, exportación ni recuperación de PIN. Próxima fase: definir horarios, descansos y reglas de cálculo, después de recuperar margen de uso y recoger resultados de la prueba. No pedir autorización repetida para el alcance del proyecto ya aprobado.

Cierre alpha4: APK generada, compilación/lint correctos (0 errores/26 avisos) y firma coincidente verificada. SHA-256 D3ABC471C41013A2A539FF31E10E670E677360BA275FA9D2C14FA8C46CED3D3A. Revisión visual en tablet pendiente.

## Actualización web: cuentas y roles — 2026-10-04
Implementado control Admin/User con migración conservadora a esquema 2. Admin gestiona cuentas y colaboradores; User crea otras cuentas User y descarga CSV de colaboradores. Cuenta inicial de Render conservada como Admin. Pruebas locales aprobadas; verificar despliegue en Render y acceso con ambos roles. La tablet sigue independiente.

## Interfaces web — 2026-10-04
Tres secciones en la misma pantalla: Usuarios (alta y administración según rol), Colaboradores (búsqueda y perfil con nombre/código/estado), Descargas (CSV de colaboradores con filtro activo/inactivo/todos). El perfil consulta datos vigentes al abrir. Se conservan permisos Admin/User. Sin cambios de esquema ni conexión a tablet. Pruebas existentes: 13 aprobadas; sintaxis JS y diff verificados. Pendiente validación visual en navegador y despliegue Render.

## Sincronización Fire HD 10 — 2026-10-04
PostgreSQL central confirmado; SQLite solo respaldo/caché/cola offline. Implementada fase 0.5.0-alpha1: API de dispositivos revocables, importación conservadora de colaboradores, UUID idempotentes de marcaciones y catálogo central a tablet. Web agrega Tablet, Marcaciones y CSV. APK apunta a https://b0d-control-web.onrender.com, cifra token con AndroidKeyStore y reintenta al abrir/cada minuto visible. Esquemas PostgreSQL 3 y SQLite 7. No se suben perfiles faciales ni horarios; administración local permanece hasta completar esas migraciones. Guía y límites en PRUEBA_SINCRONIZACION.md. Pendiente prueba real tablet→Render→web.
Validación final: 21 tests Node y 1 prueba SQLite aprobados; APK compilada, lint sin errores (29 advertencias). Firma coincide con alpha4. APK entregas/B0d-Asistencia-0.5.0-alpha1.apk; SHA256 EA9E75F80A8B46EF634AB249A8F0F7DE2EDBF4678229674878F8375CA471C35A. Comprobada estructura HTML; pendiente prueba visual real.

## APK 0.5.0-alpha2 — 2026-10-04
Pantalla inicial reorganizada según referencia: engrane superior, cámara amplia, controles centrados, entrada verde/salida roja e iconos ámbar/amarillo para descanso/comida. Estado cloud en configuración. Cámara se solicita automáticamente en primera apertura sin permiso, sin repetir diálogo tras rechazo. versionCode 13. Compilación y lint aprobados; pendiente comprobación visual y flujo de permisos en Fire HD 10. Actualizar sin desinstalar.

## Vinculación sencilla — 0.5.0-alpha3
La web ahora genera un código de 8 dígitos (agrupado 1234 5678), válido 10 minutos y de un solo uso. La APK canjea el código por una credencial persistente cifrada; no hace falta copiar la clave larga. Cinco canjes por minuto como límite global persistente en esta instalación. Esquema PostgreSQL 4. Vínculos previos se conservan. Si la respuesta de canje se pierde, generar otro código y revocar el vínculo anterior. APK versionCode 14. Pruebas servidor: 22 aprobadas. Pendiente prueba real del código en Kindle.

## Web compacta y dispositivos — 2026-10-04
Listados de usuarios, colaboradores, marcaciones y tablets en flexbox con scroll interno. Filas compactas; marcaciones con desplazamiento horizontal en pantallas estrechas. Tablet reúne formulario/código y listado en columnas adaptables. Admin puede eliminar dispositivos: baja lógica que los oculta y revoca acceso, conservando referencias e historial. Esquema PostgreSQL 5. 23 pruebas aprobadas, sintaxis JS y estructura HTML verificadas; pendiente comprobación visual en navegador. Sin nueva APK.

## Horarios web — 2026-10-04
Catálogo Admin en una pantalla: listado/búsqueda y editor semanal con scroll interno, entrada/salida, comida/descansos estructurados, copiar a días activos, zona horaria, casilla de marcación obligatoria y resumen de horas efectivas. Validador compartido web/servidor admite nocturnos y rechaza descansos solapados/externos, 24h, días repetidos y cruces domingo-lunes. Edición crea versiones inmutables; control de revisión evita sobrescribir ediciones concurrentes. PostgreSQL esquema 6. 27 pruebas aprobadas; sintaxis y HTML comprobados. Pendiente validación visual y despliegue real. Esta entrega no incluye asignaciones ni sincronización de horarios a la APK; no cambia horarios locales ni recalcula asistencia histórica.

## Calendario y horarios sincronizados — 0.5.0-alpha4
Web: calendario lunes-domingo, día seleccionado naranja pendiente de configurar, verde tras guardar su configuración. Popup explícito AM/PM, comida/descansos, copiar a días seleccionados, guardado global del horario. Colaboradores en tres columnas (dos/una según ancho). Perfil Admin permite asignar la versión vigente desde una fecha posterior al día actual y abrir el editor del horario. Editar catálogo NO cambia asignaciones anteriores automáticamente; volver a asignar la nueva versión con fecha futura.
PostgreSQL esquema 7: asignaciones referencian versión inmutable. API de dispositivo entrega versiones y asignaciones. SQLite esquema 8: catálogos versionados, nombres visibles y recibos de asignación. Si una asignación llega tarde se aplica como mínimo hoy, o mañana si hoy ya tiene marcaciones/jornada abierta; no reescribe shift_contexts. Asignaciones futuras de la misma fecha pueden reemplazarse antes de iniciar jornada. Con tablet vinculada la creación/asignación local se dirige a la web.
APK alpha4 (versionCode 15), actualizar sin desinstalar. Pruebas: 27 Node (incluyen asignación/versiones/snapshot para dispositivo) y migración SQLite con contexto previo conservado; compilación/lint aprobados y firma original. Pendiente revisión visual en navegador y validación física Kindle→Render de esta fase. No se sincroniza biometría ni se calculan todavía horas en la web.

## Pulido web — 2026-10-04
Calendario con tarjetas y jerarquía visual uniforme. Zona horaria de nuevos horarios detectada desde Intl en PC; control eliminado, horarios existentes conservan su zona. Marcaciones con colores semánticos y Descargas integrada mediante panel desplegable. Usuarios cambia contraseña en dialog con confirmación doble; operación no cambia rol/estado. Confirmación de revocar/eliminar en dialog de la app. Eliminar horario lo retira del catálogo y de nuevas asignaciones; conserva versiones y asignaciones históricas para sincronización. PostgreSQL esquema 8. Pruebas servidor y estructura HTML aprobadas; pendiente validación visual desplegada. No requiere nueva APK.

## Marcaje Regular y Total — 0.5.0-alpha5
Confirmado: una fila por colaborador y jornada. Marcaciones → Reportes y descargas permite filtrar fechas (hasta 93 días), ver tabla y descargar XLS binario BIFF8 o PDF horizontal. Regular muestra entrada, salida y horas efectivas; Total divide horas ordinarias y extras según el objetivo efectivo diario, descontando pausas. Horas extra comienzan al superar ese objetivo, incluso llegando tarde. Los turnos nocturnos usan la fecha de inicio. Jornadas incompletas, descansos obligatorios faltantes o contextos pendientes muestran N/D y observaciones; sin horario se informa tiempo efectivo pero no se inventan extras. Descargas disponibles para Admin y User.
PostgreSQL/SQLite esquema 9: la APK envía el contexto histórico inmutable de cada entrada, incluidas las anteriores pendientes, con recibo durable. Hasta actualizar y sincronizar la APK, los reportes no pueden calcular jornadas sin contexto. La base central sigue siendo PostgreSQL; SQLite es respaldo/cola. No se envían perfiles biométricos.
Entrega: entregas/B0d-Asistencia-0.5.0-alpha5.apk, versionCode 16, firma idéntica. SHA256 B99975292F3313A033B1CA2A584AE6EA2CC8FDA4FEA2A3F13481C57C79706E69. Actualizar sin desinstalar, después del despliegue web.
Validación: 38 pruebas Node, 47 comprobaciones Java de cálculo, migración SQLite conservadora; assembleDebug/lintDebug correctos (0 errores, 30 avisos). XLS reabierto y verificado; PDF de muestra renderizado, revisados encabezados, varias páginas, observaciones y pies. Pendiente prueba física Kindle→Render y aceptación del usuario; no afirmar validación real en tablet. Margen consultado al cierre: 11 % de ventana de 5 h, 86 % semanal; no iniciar otra fase sustancial ahora.
