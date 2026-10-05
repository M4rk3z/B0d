# APK 0.2.0 — Asistencia manual y borrado

Instalar `entregas/B0d-Asistencia-0.2.0.apk` como actualización, sin desinstalar ni borrar datos. VersionCode 4; misma firma que las entregas anteriores.

## Prueba en Android 14

1. Comprobar que el PIN y los trabajadores anteriores siguen disponibles.
2. Crear un trabajador de prueba sin marcaciones. Pulsar **Borrar trabajador**, cancelar primero y luego confirmar: debe desaparecer. El código podrá volver a utilizarse.
3. Crear o seleccionar otro trabajador activo. Cerrar sesión de administrador.
4. En el inicio, abrir **Registrar entrada o salida**, escribir su código y verificar el nombre. Pulsar **Confirmar entrada**.
5. Volver a consultar ese código: debe mostrar la entrada y ofrecer únicamente **Confirmar salida**. Guardar la salida.
6. Entrar con PIN y abrir **Registros de asistencia**: deben aparecer ambas marcaciones con fecha, hora y zona horaria.
7. Cerrar y volver a abrir la app: las marcaciones deben conservarse. Repetir una entrada y salida sin internet.
8. Intentar borrar a ese trabajador: debe rechazarlo por tener historial. Desactivarlo después de cerrar su salida: debe permitirlo; su código ya no debe permitir marcar.
9. Con un trabajador que tenga entrada sin salida, intentar desactivar: debe pedir cerrar la salida primero.

## Alcance y límites

- Registro manual provisional por código: no verifica identidad física ni usa reconocimiento facial todavía.
- Previene salida inicial, entradas consecutivas, salidas consecutivas y marcaciones con hora anterior al último registro del trabajador.
- Guarda instantes, zona horaria, identificadores y nombre/código al marcar. No elimina registros anteriores.
- Borrado administrativo confirmado solo para trabajadores sin marcaciones. Conserva un registro técnico de borrado con identificador, código y fecha; no es una función de eliminación total de datos personales. Con marcaciones se usa desactivación.
- Historial administrativo: muestra las últimas 200 marcaciones; todas permanecen almacenadas.
- Usa fecha y hora de la tablet. No hay corrección de marcaciones, recuperación de PIN, horarios, cálculo de horas, exportación ni respaldos aún.
- Si una operación muestra error o se interrumpe, consultar el último registro antes de repetirla.

## Validación realizada

- 66 comprobaciones aprobadas: 23 de PIN, 16 de campos, 13 de secuencia de asistencia y 14 de esquemas SQLite.
- Migración v1 → v2 comprobada sobre los scripts SQL: conserva trabajadores y eventos; añade marcaciones y bitácora de borrado. Instalación limpia usa ambos esquemas.
- Pruebas SQLite en Python y reglas en Java; no se ejecutó la interfaz ni el repositorio Android en emulador. La actualización real en tablet y conservación del PIN quedan pendientes de la prueba anterior.
- Compilación y lint aprobados: 0 errores, 2 avisos (atributo API 33 y versión Gradle disponible).
- Firma verificada e igual a entregas anteriores.
- SHA-256: `DBCE02C310F09CC9D61AA8E584F6260F90481E3731082AE27F2BBEFE68CAF3EC`.
