# Prueba de acceso administrativo — 0.2.0-alpha1

APK: `entregas/B0d-Asistencia-0.2.0-alpha1.apk`.

## Entrega

Primer bloque de 0.2.0: configuración inicial y acceso administrativo. No incluye trabajadores ni marcaciones. Instalar como actualización sobre 0.1.0, sin desinstalar; se verificó que ambas APK tienen la misma firma de prueba y que esta incrementa el código de versión.

## Prueba en Android 14

1. Abrir la app y pulsar **Configurar administrador**. Esta primera configuración debe hacerla el responsable de la tablet.
2. Escribir un PIN de 6 dígitos y una confirmación diferente: debe indicar que no coinciden.
3. Repetir correctamente el PIN: debe abrir **Administración**.
4. Cerrar sesión: debe volver al inicio y pedir el PIN para entrar otra vez.
5. Cerrar y abrir la app: debe conservar el PIN y no mostrar la configuración inicial.
6. Escribir un PIN incorrecto cinco veces: debe bloquear el acceso durante cinco minutos, incluso si después se introduce el correcto o se reinicia la app.
7. Después de cinco minutos, el PIN correcto debe permitir entrar.
8. Dentro de Administración, salir de la app o girar la tablet: al volver debe pedir acceso otra vez. Dos minutos sin interacción también deben cerrar la sesión.

## Límites de esta entrega

- No existe recuperación ni cambio de PIN todavía. Guardarlo de forma segura.
- El bloqueo por intentos usa la hora del dispositivo; se asume que el usuario no manipula la hora ni borra los datos de la app. No es un sistema de administración del dispositivo ni un modo kiosco.
- Las capturas de la app se bloquean para proteger la información de acceso.
- No hay conexión a internet ni biometría en este bloque.

## Verificación realizada en el equipo de desarrollo

- 23 comprobaciones automáticas de política de credenciales: formato, confirmación, ausencia de PIN por defecto, rechazo de reemplazo, PIN con cero inicial, intentos y bloqueo entre instancias, expiración, reinicio de contador, salt aleatorio y fallo de escritura que no autoriza acceso.
- Los tests usan almacenamiento simulado: no sustituyen una prueba de persistencia real en Android.
- Compilación y Android Lint exitosos: 0 errores, 2 avisos (atributo de navegación solo usado desde Android 13 y actualización de Gradle disponible).
- Firma de ambas APK válida y coincidente. SHA-256 de la nueva APK: `F4F3204B43E8B01FB84B0D23C3591B40D2546C56AC8CB0F41C303765A6DF67FB`.
- El usuario confirmó «prueba pasada con exito» para alpha1. Se registra aceptación en tablet del bloque de acceso administrativo; no se recibieron resultados individuales ni evidencia visual. No hay emulador configurado.
