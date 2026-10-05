# Horarios y cálculo — acuerdos del usuario

## Reglas confirmadas

- Cada trabajador puede tener su propio horario, con días y horas diferentes.
- Comida y descansos no cuentan como tiempo trabajado.
- Casilla por horario **Exigir marcación de comida y descansos**:
  - Desmarcada: descontar automáticamente los intervalos programados que coincidan con tiempo de presencia.
  - Marcada: descontar los intervalos de descanso realmente marcados; las marcaciones faltantes deberán señalarse como incidencia, no inventarse.
- Jornada efectiva prevista = duración del turno programado menos comida y descansos programados.
- Horas extras calculadas = máximo entre cero y tiempo efectivo trabajado menos jornada efectiva prevista. No dependen de rebasar la hora de salida del reloj por sí sola.
- El retardo se informa por separado según la entrada real respecto a la entrada programada. No reduce la meta de horas efectivas de la jornada.

## Ejemplos de aceptación para la próxima entrega

Horario: 08:00–17:00; comida 13:00–14:00; jornada efectiva prevista: 8 horas.

| Marcaciones | Descuento | Trabajo efectivo | Extras | Retardo |
| --- | --- | --- | --- | --- |
| 08:00–17:00 | 1 hora | 8 horas | 0 | 0 |
| 09:00–17:00 | 1 hora | 7 horas | 0 | 1 hora |
| 09:00–18:00 | 1 hora | 8 horas | 0 | 1 hora |
| 09:00–19:00 | 1 hora | 9 horas | 1 hora | 1 hora |

Los ejemplos asumen comida completa dentro de la presencia. En modo automático solo se descuenta la intersección real entre presencia e intervalos previstos, sin duplicar descansos.

## Entrega actual: 0.3.0

Activa los dos modos de descuento, eventos de inicio/fin de comida o descanso, cálculo por jornada de tiempo efectivo, ordinarias, extras y retardo. Agrupa múltiples entradas del mismo día laboral bajo una sola meta. El horario se vincula a cada entrada y no cambia con asignaciones posteriores. Los resúmenes abiertos o con incidencias son provisionales. Ver PRUEBA_CALCULOS.md para casos y límites.

Los horarios son inmutables en esta entrega. Para cambios, crear otro horario y una nueva asignación con fecha de inicio; se conserva el historial. No se admiten asignaciones retroactivas, fechas ya utilizadas ni cambios sobre una jornada iniciada o con marcaciones desde esa fecha.

Turnos nocturnos: una salida menor que la entrada representa el día siguiente. Se rechazan turnos de 24 horas, descansos superpuestos o fuera de turno y solapamientos entre días consecutivos, incluido domingo→lunes.

## Validación pendiente y próximas mejoras

Pendiente validación de actualización, flujo y datos en tablet. No se consideran registros incompletos como jornadas definitivas. Los días sin horario se identifican sin inventar una jornada base. Revisar entradas nocturnas atípicas fuera del intervalo programado, para las que aún no hay selección manual de fecha laboral. Sin tolerancia de retardo configurada ni corrección de incidencias por ahora. Las próximas pantallas deben seguir GUIA_UX.md (AllinoneScreen).
