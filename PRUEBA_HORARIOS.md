# Horarios — APK 0.3.0-alpha1

Instalar `entregas/B0d-Asistencia-0.3.0-alpha1.apk` sobre la anterior, sin desinstalar ni borrar datos. Mantiene la firma; versionCode 6, esquema SQLite 3.

## Prueba en tablet

1. Confirmar conservación del PIN, trabajadores y marcaciones anteriores.
2. Entrar a **Administración → Horarios de trabajo → Crear horario**.
3. Dar nombre al horario; activar lunes a viernes y configurar entrada 08:00, salida 17:00 y descansos `13:00-14:00;16:00-16:15`. Debe mostrar 7h 45m efectivas por día al guardar.
4. Dejar la casilla de marcación desmarcada; comprobar que el listado indica descuento automático.
5. Crear otro horario con la casilla marcada. Probar un turno 22:00–06:00 con descanso `02:00-02:30`; debe indicar salida al día siguiente y 7h 30m efectivas.
6. Intentar intervalos superpuestos, fuera del turno o entrada igual a salida: debe rechazarlos. También debe rechazar un turno nocturno que invada el turno del día siguiente.
7. Abrir **Trabajadores → Asignar horario**, elegir horario y fecha de inicio, y confirmar. Si el trabajador ya marcó hoy, usar mañana o una fecha futura.
8. Confirmar que aparece la asignación y su fecha. Asignar otro horario desde una fecha posterior y revisar que ambas asignaciones siguen en el historial.
9. Cerrar/reabrir y entrar con PIN: horarios, modo de descansos y asignaciones deben persistir.
10. Sin acceso administrativo no deben poder crearse ni asignarse horarios. Probar también las marcaciones de entrada/salida existentes.

Los formularios sin guardar se descartan al salir, girar la tablet o caducar la sesión. Cada día admite hasta 8 descansos separados por punto y coma; horas en formato de 24 horas HH:mm. El listado muestra la última asignación programada, que puede ser futura; revisar la fecha.

## Límites explícitos

Esta entrega configura horarios. Todavía no registra inicio/fin de comida o descanso ni calcula horas realmente trabajadas, extras o retardos. La próxima entrega activará esas funciones según REGLAS_HORARIOS.md. No se editan ni eliminan plantillas de horario guardadas; se crea otra para conservar el historial.

## Verificación de desarrollo

- 103 comprobaciones aprobadas: 29 de horarios, 23 PIN, 16 campos de trabajador, 13 secuencia y 22 sobre esquemas SQLite.
- Migración SQL conserva trabajadores y marcaciones; valida referencias, historial de asignaciones, casilla, persistencia y rollback de creación.
- Pruebas Java y SQLite en Python: no sustituyen ejecutar el repositorio Android y su interfaz en una tablet.
- Compilación y lint aprobados: 0 errores y 3 avisos (atributo API 33, actualización Gradle y sugerencia tipográfica en el ejemplo de intervalos; el guion es parte de la sintaxis del campo).
- Firma verificada y coincidente con entregas anteriores. SHA-256 de APK: `1B3C099FDDEC6EB8353744224C4877FA2FE9B801D993A2CC5A0AF09C4AB0E8A4`.
- Actualización real, revisión visual y aceptación en tablet pendientes.
