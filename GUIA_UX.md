# Criterio de producto: AllinoneScreen

Preferencia explícita del usuario: concentrar información y acciones relacionadas en una pantalla, con lenguaje simple y el menor número de pasos útil.

- Mostrar identidad, estado de jornada, horario, resumen y acciones disponibles juntos.
- Tras una marcación, actualizar la misma pantalla con confirmación visible; no enviar a una pantalla de éxito separada.
- Mostrar solo acciones válidas para el estado actual: entrada, descanso, regreso o salida.
- Usar tarjetas legibles para tiempo efectivo, descuentos, ordinarias, extras, retardo y jornada prevista.
- Desplegar detalles secundarios sin navegar fuera del contexto. En administración, el detalle de marcaciones se abre dentro del resumen.
- Mantener confirmación para borrados y asignaciones; no confundir menos pasos con eliminar comprobaciones importantes.
- Conservar protección administrativa y privacidad en la tablet compartida. La consulta de trabajador vuelve al inicio después de un minuto.
- Una pantalla unificada puede desplazarse; no reducir tipografías ni objetivos táctiles para forzar todo a caber a la vez.

Aplicado en 0.3.0 al flujo de jornada y consulta administrativa. Las pantallas de configuración mantienen sus formularios; futuras mejoras deberán seguir esta guía.

En 0.4.0-alpha1, la ficha facial conserva identidad, foto, fecha y acciones juntas. Captura y revisión usan la misma app, con retorno al perfil tras guardar. El permiso inicial vuelve a solicitar PIN; las capturas posteriores no cambian de aplicación.

En 0.4.0-alpha2, el usuario define el inicio como un kiosco: cámara grande, Entrada y Salida, iconos Comida/Break y engrane administrativo, sin descripciones ni código. Se mantiene la paleta corporativa. Solo se muestran avisos transitorios de permiso, procesamiento, error o confirmación; el resultado vuelve al estado de espera en la misma pantalla. Reconocer requiere tocar primero la acción.

En alpha3 se elimina el ancho máximo de 720 dp para aprovechar la ventana. Menús administrativos con barra inferior fija y desplazamiento del contenido; Home reúne progreso, avisos, extras y cumplimiento. Personal Operativo usa tarjetas y columnas según el ancho, manteniendo las acciones existentes. En ventanas estrechas los bloques se apilan para conservar legibilidad.
