# Prueba de sincronización — B0d 0.5.0-alpha1

## Arquitectura
PostgreSQL en Render es la base central. Web y APK acceden a través de la misma API HTTPS. SQLite en la tablet conserva la caché, las marcaciones originales y las confirmaciones remotas; no es otra base central. La contraseña de PostgreSQL no se incorpora a la APK.

## Instalación y vinculación
1. Esperar a que el servicio b0d-control-web despliegue esta revisión y esté Live.
2. Actualizar la APK sobre la instalada, SIN desinstalar ni borrar almacenamiento. Esquema local 6 → 7; no volver a una APK anterior después de actualizar.
3. Entrar como Admin en https://b0d-control-web.onrender.com. Abrir Tablet, indicar Fire HD 10 y generar una clave. Se muestra una sola vez; es una credencial persistente y revocable. No compartirla en chat.
4. En la APK: engrane → PIN → Conexión con la web. Pegar la clave y pulsar Vincular y sincronizar. Si se pierde la clave, revocar esa vinculación y generar otra.
5. Revisar estado de sincronización y pendientes. La primera conexión importa colaboradores existentes y todas las marcaciones locales, manteniendo los perfiles faciales en la tablet.
6. En la web: Colaboradores y Marcaciones. Descargas ofrece CSV de colaboradores y de marcaciones recibidas.

## Pruebas en Fire HD 10
- Confirmar que se conservan colaboradores, perfiles, horarios e historial anteriores al actualizar.
- Marcar entrada/salida y comprobar que aparecen una sola vez en Marcaciones de la web.
- Desactivar Wi-Fi, marcar, cerrar y abrir B0d; el registro debe seguir local. Reactivar Wi-Fi y mantener B0d abierta hasta ver pendientes 0. Confirmar que la web lo recibe una vez.
- Pulsar Sincronizar ahora varias veces: no deben duplicarse eventos.
- Crear un colaborador en web: debe llegar a la tablet. El registro facial se sigue haciendo localmente en esta fase.
- Revocar tablet desde web: nuevos envíos deben rechazarse y los eventos pendientes permanecer locales.
- Si un código ya existe con otro nombre, se detiene la importación y se muestra conflicto. No se fusionan personas automáticamente.

## Alcance y límites explícitos
- Sincronización al abrir y cada 60 segundos con la actividad visible; sin servicio en segundo plano. Cada ciclo envía hasta 200 pendientes. Render puede tardar en despertar; errores dejan la cola intacta.
- Se envían colaboradores, UUID del evento, código/nombre históricos, fecha UTC en milisegundos, zona, entrada/salida/descanso/comida y método. No se transmiten imágenes ni plantillas biométricas.
- Tras vincular, el estado activo/inactivo se administra en la web. Altas locales se importan una vez; después prevalece el catálogo central.
- Horarios, asignaciones, biometría y cálculos de horas siguen locales. Por esa razón la administración de la APK se conserva temporalmente. La web muestra marcaciones, no cálculos de nómina.
- Un dispositivo sin red conserva el estado de colaboradores que conocía en su última sincronización. No puede recibir una revocación hasta reconectarse.
- Desactivar colaboradores solo después de sincronizar su salida. El servidor bloquea desactivaciones con jornada abierta que ya conozca.
- Esta fase sincroniza eventos hacia PostgreSQL; no restaura historial ni biometría hacia una instalación vacía. No desinstalar ni borrar datos.
- APK de prueba, firma debug original. Falta validación de extremo a extremo en la tablet física y Render; las pruebas locales no la sustituyen.

## Verificación automatizada
Pruebas HTTP contra PostgreSQL embebido: autorización, importación repetida, colisión de códigos, eventos idempotentes, datos inválidos, catálogo compartido, acceso User y revocación. Prueba SQLite de migración conservando marcaciones/biometría y recibos persistentes. Compilación APK y Android lint.

## Actualización alpha3: código corto
Sustituye la clave manual del procedimiento anterior: en Tablet pulsa Generar código y escribe los 8 dígitos en la APK alpha3. Vence a los 10 minutos y admite un solo uso; la vinculación permanece después. Si el canje se interrumpe, revoca ese dispositivo y genera otro código. Las vinculaciones existentes siguen funcionando sin cambios.
