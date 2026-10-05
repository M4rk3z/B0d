# Prueba en tablet — 0.4.0-alpha1

Instala `entregas/B0d-Asistencia-0.4.0-alpha1.apk` encima de la versión existente. No desinstales: eso borra los datos y la clave de cifrado. Se mantiene el identificador de aplicación y la firma de las entregas anteriores.

APK de pruebas: 42 693 953 bytes. SHA-256: `1D447EBAA27A25CA6408151A52865B76628CEC7123F7D4C11BE73412420BA0CD`. Compilación y lint correctos (0 errores, 5 avisos de versiones/atributo); 181 comprobaciones automatizadas aprobadas. Firma SHA-256: `982abfff61894e0b7d550b126bcd748e52bab79f8bf9dc3e685e261a462d2ebe`.

Esta fase registra una foto de referencia, valida un solo rostro y permite consultar, reemplazar y eliminar esa foto. Aún no crea una plantilla de reconocimiento, identifica personas, compara duplicados ni detecta suplantaciones con fotografías. Las marcaciones siguen funcionando por código.

## Recorrido principal

1. Comprueba que se conservaron el PIN, colaboradores, horarios y marcaciones.
2. Entra con el PIN → Trabajadores → Registrar perfil facial en un colaborador de prueba.
3. Pulsa Capturar rostro y concede permiso de cámara. Por seguridad, la solicitud inicial cierra la sesión; vuelve a entrar con el PIN y abre el perfil. En capturas posteriores no se repite mientras Android conserve el permiso.
4. Comprueba la vista frontal en vertical y horizontal. Si no hay cámara frontal se indica que se usa la trasera.
5. Captura con buena luz y un solo rostro completo, de frente. Debe aparecer la foto recortada para revisión, sin guardarse aún.
6. Pulsa Guardar foto de referencia. Deben aparecer la foto y la fecha en la misma ficha.
7. Cierra la app, vuelve a entrar con PIN y consulta la foto. Reinicia la tablet y repite en modo avión: el detector está incluido en la APK.
8. Reemplaza la foto. Cancelar antes de guardar debe conservar la anterior. Guardar debe mostrar la nueva.
9. Elimina la foto y confirma. El colaborador y sus marcaciones deben permanecer; su ficha debe indicar que no tiene foto.

## Casos adicionales

- Sin rostros o con dos personas visibles: rechazar la captura. Una persona lejana o muy girada puede no ser detectada; estas comprobaciones son ayuda de encuadre, no una garantía de identidad.
- Rostro pequeño, inclinado o cortado: pedir repetir. La nitidez se revisa visualmente antes de guardar; no hay prueba automática de desenfoque ni de vida.
- Denegar permiso: conservar datos y permitir usar el resto de la app. Si Android ya no vuelve a preguntar, habilitar cámara desde Ajustes → Aplicaciones → B0d → Permisos.
- Inicio de Android, bloqueo, rotación o cambio de aplicación durante captura/revisión: cerrar cámara, descartar captura sin guardar y requerir PIN al regresar. La foto anterior debe seguir intacta.
- Inactividad administrativa de dos minutos: volver al inicio y descartar la captura pendiente.
- Guardar y tocar repetidamente: una sola foto por colaborador. Probar dos colaboradores y comprobar que sus fotos no se intercambian.
- Borrar un colaborador de prueba sin marcaciones: también se elimina su foto. Con historial, sigue vigente la protección que impide borrar al colaborador; su foto sí puede eliminarse.
- Registrar una entrada/salida por código y consultar horarios/resumen: comprobar que siguen funcionando.

## Implementación y límites de verificación

CameraX 1.4.2 y ML Kit Face Detection 16.1.7, modelo incluido. No se solicitan permisos de almacenamiento; las capturas se procesan en memoria. La APK excluye permisos de Internet y de estado de red aportados por dependencias. Foto JPEG recortada de hasta 640 píxeles, cifrada AES-256-GCM con clave AndroidKeyStore y UUID del colaborador como datos autenticados. SQLite guarda la foto cifrada y fecha; migración 4 → 5 añade una tabla. Borrar la foto elimina su registro lógico, sin prometer borrado forense del almacenamiento.

Las pruebas automatizadas cubren el sobre de cifrado con proveedor Java, reglas de encuadre y SQL. No sustituyen pruebas de AndroidKeyStore, cámara, permisos, interfaz y detector real en Android 14. No hay emulador configurado en este entorno.

Referencias técnicas: [detección facial oficial](https://developers.google.com/ml-kit/vision/face-detection/android), [captura CameraX](https://developer.android.com/media/camera/camerax/take-photo).

Tras aceptar esta fase: elegir y validar modelo de reconocimiento, generar plantillas compatibles y comprobar coincidencias/falsos positivos antes de conectar entrada/salida. Puede ser necesario recapturar varias vistas. La foto actual por sí sola no habilita esa función.
