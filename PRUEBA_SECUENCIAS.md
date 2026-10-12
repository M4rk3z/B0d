# Secuencias de checadas · 0.6.0-alpha1

- Horarios y asignaciones se retiran de la interfaz y de la API pública. Se conservan las tablas históricas para no borrar información ni romper referencias de registros anteriores.
- La jornada se cuenta desde Entrada hasta Salida. Comida y descanso no descuentan tiempo. El Marcaje Regular mantiene el máximo de 8 horas y su salida calculada identificada; Marcaje Total conserva horas reales y extras sobre 8 horas.
- En Secuencias, Admin y User pueden activar comida/descanso y editar las horas transcurridas mínimas y máximas desde la entrada. Valores iniciales: 0–24 horas; rango editable hasta 48 horas, pasos de 15 minutos.
- Las pausas son opcionales. Solo pueden iniciarse dentro de su ventana; debe regresarse de la misma pausa antes de iniciar otra o terminar la jornada. El regreso se admite incluso después del límite o de desactivar la opción.
- La tablet descarga los límites durante su sincronización y conserva la última configuración sin internet. Requiere actualizar a la nueva APK para aplicar estas reglas.
- La casilla de comida/descanso incluye cuatro columnas adicionales en XLS y en la vista previa; PDF incorpora un detalle de las checadas. También controla la inclusión de pausas en el CSV de marcaciones. Nunca cambia los totales.
- Las consultas históricas se recalculan con el criterio nuevo sin descuento de pausas; las checadas originales no se modifican. No se requieren contextos de horario sincronizados.

## Prueba en la tablet

1. Instalar la APK sobre la versión anterior sin desinstalar. Sincronizar.
2. Configurar una pausa con inicio futuro; intentar iniciarla antes: debe rechazarse. La salida de jornada debe seguir permitida.
3. Configurar la pausa desde 0 horas, sincronizar y marcar Entrada → Comida → regreso → Descanso → regreso → Salida.
4. Durante una pausa, rechazar otra Entrada, Salida o regreso del tipo equivocado.
5. Iniciar una pausa y reducir su límite desde la web: permitir el regreso tras sincronizar.
6. Repetir sin internet y sincronizar después; no duplicar checadas.
7. Exportar una jornada con y sin la casilla; verificar totales idénticos, máximo regular de 8 horas y extras reales en Total.

Validación automatizada: 39 pruebas de servidor; pruebas Java de cálculo, límites, secuencias, cruce de medianoche y cambio de hora; compilación y lint Android. La operación física de cámara y sincronización debe comprobarse en la Fire HD 10.
