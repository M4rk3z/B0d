# Jornada unificada — APK 0.3.0

Instalar `entregas/B0d-Asistencia-0.3.0.apk` sobre la anterior, sin desinstalar ni borrar datos. Mantiene la firma; versionCode 7, esquema SQLite 4.

## Prueba en Android 14

1. Confirmar que se mantienen PIN, trabajadores, horarios, asignaciones y marcaciones anteriores.
2. Crear un horario de prueba con comida/descansos y la casilla **Exigir marcación** activada. Asignarlo a un trabajador de prueba antes de su primera entrada. Para comprobar tiempos sin esperar una jornada completa se puede definir un turno corto de unos minutos.
3. Buscar su código. En **Mi jornada**, verificar nombre y horario; confirmar entrada. Debe actualizarse la misma pantalla, mostrar estado **En jornada** y permitir descanso o salida.
4. Marcar **Salir a comida o descanso**. Debe mostrar **En comida o descanso** y ofrecer regresar. No debe permitir salir de la jornada antes de registrar el regreso.
5. Regresar y después confirmar salida. La misma pantalla debe mostrar el resumen cerrado y descontar únicamente el descanso marcado.
6. Con otro horario sin la casilla, comprobar que no aparecen botones de descanso y que se descuentan los intervalos programados solo durante la presencia. Pulsar **Actualizar resumen** para renovar los tiempos.
7. Verificar que el tiempo efectivo que supere la jornada prevista aparece en extras. Llegar tarde debe mostrar el retardo por separado, sin reducir la jornada prevista.
8. Entrar otra vez el mismo día y salir: se suma el tiempo a la jornada de ese día, usando una sola meta diaria.
9. En Administración → Registros de asistencia, revisar resúmenes y desplegar las marcaciones en la misma pantalla.
10. Reiniciar la app y comprobar conservación de estados, eventos, tiempos y horario de cada jornada. También probar salida de la app/retorno durante un descanso.

## Incidencias visibles

- Jornada abierta: resumen provisional, nunca se inventa una salida.
- Comida/descansos marcados requeridos pero faltantes: se señala incidencia. Los totales calculados quedan provisionales.
- Sin horario laborable asignado: se conserva tiempo de presencia, pero extras, ordinarias y retardo se muestran como **Sin horario**.
- Secuencia o reloj inconsistentes: advertencia de cálculo no definitivo.
- El resumen es una consulta puntual; el botón **Actualizar** renueva los tiempos. Por privacidad, la pantalla del trabajador vuelve al inicio después de un minuto.

## Reglas técnicas y límites

- Los horarios y su vigencia se fijan al registrar cada entrada. La migración vincula también las entradas anteriores con la configuración vigente correspondiente, sin crear descansos históricos.
- Para entradas después de medianoche dentro del intervalo de un turno nocturno anterior, se usa la fecha de inicio de ese turno. Fuera de ese intervalo se usa el día actual; no hay selector manual de jornada ni corrección administrativa todavía. Verificar especialmente entradas atípicas posteriores al fin de un turno nocturno.
- Los períodos de presencia y descansos del mismo trabajador, horario y fecha laboral se agrupan. Los períodos superpuestos se unen para evitar descuentos repetidos.
- El tiempo trabajado usa duración real entre instantes; la meta diaria conserva los minutos nominales del horario. Se probaron cambios de horario estacional con esa regla.
- En modo marcado, las pausas reales pueden diferir del horario. Se avisa si hay menos descansos registrados que intervalos programados coincidentes con la presencia; no se inventa su duración ni se comprueba que una pausa corresponda exactamente a la comida programada.
- Administración muestra las 30 jornadas más recientes en total y permite desplegar las últimas 200 marcaciones. Todos los eventos siguen almacenados.
- No hay corrección de incidencias, respaldo/exportación, aprobación de extras ni reconocimiento facial todavía. Es una APK de prueba con identificación manual.

## Validación de desarrollo

- 156 comprobaciones aprobadas: 47 cálculos/descansos, 29 horarios, 13 secuencia, 16 campos, 23 PIN y 28 SQLite.
- Incluyen ejemplos acordados de horas extras con retardo, descuento parcial, varias entradas diarias, jornadas abiertas, descansos faltantes, turnos nocturnos y cambios de horario estacional.
- Migración de eventos conserva identificadores, tipos, tiempos y secuencias; admite los nuevos eventos de descanso y mantiene referencias.
- Los tests ejecutan lógica Java y esquemas SQLite con Python. No se ejecutó interfaz, ciclo de vida ni repositorio Android en emulador. La actualización completa y revisión visual en tablet siguen pendientes.
- assembleDebug y lintDebug aprobados: 0 errores y 2 avisos (atributo API 33 y versión Gradle disponible).
- Firma válida y coincidente. SHA-256 APK: `7D00C761939FD9404788E040A92BE9830B77A683E5B0FA9DDCA0A4A1865FEB98`.
