# Menús adaptables — 0.4.0-alpha3

Instalar la APK sobre alpha2, sin desinstalar. Mantiene base de datos versión 6, perfiles, modelos, horarios y reglas de marcación. Esta entrega remodela los menús y añade el resumen administrativo solicitado; no añade operaciones al registro de personal.

## Diseño

- Se elimina el límite de ancho de 720 dp del kiosco y pantallas internas. El contenido utiliza el ancho de la ventana, con márgenes e insets del sistema.
- Administración: Personal Operativo con estado, tiempo efectivo y barra diaria; avisos; extras acumuladas; cumplimiento diario global.
- Personal Operativo: tarjetas con avatar, identidad, horario y las acciones existentes. Tarjeta + para el alta. Entre una y cuatro columnas según el espacio disponible.
- Barra inferior fija con Personal, Horarios, Inicio e Historial. La pestaña principal activa se destaca. El contenido largo se desplaza sin ocultar la barra.
- Conserva azul corporativo, fondos claros y acceso por PIN. Rotar sigue cerrando la sesión por la política existente; se puede volver a entrar para revisar la nueva disposición.

## Definiciones del dashboard

El listado diario incluye colaboradores activos. Usa la fecha laboral elegida por el horario, incluyendo el turno nocturno durante su intervalo. Un turno anterior sin cerrar se señala en avisos. La barra muestra tiempo efectivo / objetivo nominal, limitada visualmente al 100 %.

Cumplimiento = suma de horas efectivas limitadas al objetivo individual / suma de objetivos diarios. Incluye objetivos de personas sin entrada (contribuyen cero); excluye días sin horario. Pondera por duración, no por número de personas. No mide puntualidad ni porcentaje de turnos ya terminados. Las horas extras de una persona no compensan faltantes de otra. Sin objetivos se muestra “Sin horarios”.

Extras acumuladas suma todo el historial de todos los colaboradores, incluidos inactivos, con horario conocido. Excluye cálculos de secuencia inválida. Se advierte si hay jornadas provisionales; el acumulado no equivale a una liquidación definitiva.

Avisos: retardo registrado, entrada pendiente después del inicio previsto, descansos faltantes/secuencia inválida y jornadas anteriores abiertas. Se conservan las limitaciones de asignación nocturna descritas en REGLAS_HORARIOS.md y ESTADO.md.

El dashboard se actualiza al entrar, o cada cinco minutos mientras esté abierto. La actualización automática conserva la posición de desplazamiento y no renueva por sí sola la sesión administrativa.

## Prueba en tablet

1. Abrir kiosco y menús en vertical/horizontal: ancho aprovechado, texto legible, controles dentro de la ventana. Revisar también con tamaño de fuente aumentado y teclado abierto en formularios.
2. Engrane → PIN → dashboard. Comparar personas, estados, tiempos y extras contra su historial.
3. Caso de dos empleados de ocho horas: uno trabaja diez y el otro no marca. Cumplimiento 50 %, extras dos horas (si no hay otros registros históricos).
4. Sin horarios: “Sin horarios”, sin porcentajes inventados. Sin colaboradores: estado vacío y tarjeta + disponible.
5. Probar barra inferior y desplazamiento con muchas tarjetas; revisar que siempre pueda accederse al último botón.
6. Desde Personal: alta, perfil facial, asignar horario, estado y borrado confirmado. Conserva la prohibición de borrar colaboradores con historial. No hay nuevas operaciones.
7. Esperar una actualización automática y luego inactividad: datos actualizados y cierre de sesión según la política existente.
8. Confirmar que Entrada/Salida/Comida/Break y reconocimiento de alpha2 siguen funcionando.

Verificación automatizada de esta fase: siete escenarios del cálculo ponderado de cumplimiento, compilación y lint. La conexión del dashboard al repositorio y el diseño en Android requieren esta prueba física; no se ejecutó interfaz en emulador. La compatibilidad con todas las pantallas no se considera demostrada por compilar.

APK SHA-256: `D6371C09D0D0BD7B06C6836D42197701380DFB02DA409BB166EC4FE65BD5DF90`. VersionCode 10; firma igual a las entregas anteriores, verificada con apksigner.


## Ajustes alpha4

Instalar B0d-Asistencia-0.4.0-alpha4.apk sobre la anterior. Comprobar engrane centrado de 48 dp, centrado de botones, barra flotante blanca con Inicio central, sombras y ausencia de explicaciones del PIN. Salir en la barra conserva la acción de cierre existente. No cambia bloqueo por PIN incorrecto.

No debe aparecer Actualizar resumen. Para comprobar el refresco de cinco minutos, mantener la sesión activa mediante interacción: el cierre de seguridad sigue siendo de dos minutos sin actividad. Verificar también que al volver al dashboard se cargan datos actuales y que un temporizador anterior no interrumpe otras pantallas. El refresco por sí solo nunca mantiene abierta la sesión.

Alpha4: compilación y lint aprobados (0 errores, 26 avisos, principalmente recursos sin uso/versiones). Firma igual verificada. SHA-256: D3ABC471C41013A2A539FF31E10E670E677360BA275FA9D2C14FA8C46CED3D3A.
