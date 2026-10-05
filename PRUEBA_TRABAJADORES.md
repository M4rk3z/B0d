# Trabajadores — 0.2.0-alpha2

APK: `entregas/B0d-Asistencia-0.2.0-alpha2.apk`.

## Instalación y prueba

Instalar como actualización sobre alpha1, sin desinstalar ni borrar datos. La firma coincide y el código de versión aumenta a 3. Debe conservar el PIN existente.

1. Entrar con el PIN y abrir **Trabajadores**.
2. Agregar `EMP-001` con un nombre; verificar que aparece activo.
3. Agregar un segundo trabajador con otro código. Se permiten nombres iguales.
4. Intentar agregar `emp-001`: debe rechazarlo como duplicado sin crear otro registro.
5. Intentar guardar código o nombre vacío: debe mostrar validación.
6. Pulsar **Desactivar**, cancelar primero y comprobar que sigue activo. Repetir y confirmar: debe aparecer inactivo, sin desaparecer.
7. Intentar reutilizar su código: debe seguir rechazándolo.
8. Pulsar **Reactivar** y confirmar: debe quedar activo nuevamente.
9. Cerrar la app, abrirla y entrar otra vez: deben conservarse los trabajadores y sus estados.
10. Salir de administración: no debe poder consultarse ni modificarse el catálogo sin volver a introducir el PIN.

También comprobar que al vencer la sesión o salir de la app durante una confirmación, el diálogo se cierre y se requiera acceso nuevamente. Los formularios sin guardar se descartan al salir o girar la tablet.

## Alcance

- Alta, listado y desactivación/reactivación por administrador.
- Código de 1–20 caracteres: letras A–Z, números, guion y guion bajo; inicia con letra o número. Se normaliza a mayúsculas.
- Nombre de hasta 100 caracteres, con acentos permitidos.
- Base local SQLite, identificador interno permanente y bitácora de altas/cambios de estado.
- No hay borrado de trabajadores, edición de nombres, horarios ni marcaciones en esta entrega.
- No hay respaldo/exportación todavía; usar registros de prueba. No desinstalar para actualizar.

## Verificación de desarrollo

- 16 comprobaciones de campos de trabajador y 23 de PIN aprobadas.
- 7 pruebas sobre el esquema SQLite real de la app aprobadas: reapertura y persistencia, unicidad con trabajador inactivo, nombres repetidos, referencia de auditoría, rollback, protección frente a borrado con eventos y estados válidos.
- Las pruebas de SQLite se ejecutaron en Python; no sustituyen la prueba del repositorio Android ni de interfaz en la tablet.
- assembleDebug y lintDebug exitosos: 0 errores, 3 avisos (atributo de navegación desde API 33, versión de Gradle disponible y sugerencia de plural para el contador).
- Firma válida y coincidente con las entregas anteriores. SHA-256 de la APK: `4CB5233DB17144D8EB98DA410FB69C145325B9D4E5ADC291B45DD69ED7921525`.
- Aceptación en tablet de alpha2: pendiente.
