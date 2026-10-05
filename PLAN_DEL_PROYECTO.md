# Proyecto B0d — Control de asistencia Android

## Objetivo

Construir una aplicación Android entregable como APK para registrar entradas y salidas de trabajadores, calcular horas según su horario y permitir administración y exportación de información. El diagrama proporcionado es la referencia funcional inicial; las decisiones siguientes son propuestas de implementación.

## Forma de trabajo

- Avanzar por entregas pequeñas, cada una con un resultado comprobable.
- Registrar avances y decisiones en ESTADO.md para retomar sin depender del historial del chat.
- No considerar una entrega completada sin verificar su resultado. Una pantalla de ejemplo no equivale a una función terminada.
- Priorizar una APK con el flujo básico antes de ampliar los servicios web.
- Criterio de UX confirmado: AllinoneScreen. Agrupar información y acciones relacionadas y desplegar detalles dentro de la pantalla; seguir GUIA_UX.md.
- Gestionar las entregas según el uso disponible: dividir la implementación en bloques verificables, consultar el uso antes de bloques sustanciales y reservar margen de cierre. No pedir confirmación adicional para trabajo ya autorizado. Ver la política y bloques de 0.2.0 en ESTADO.md.

## Alcance por etapas

| Etapa | Entrega | Criterio de cierre |
| --- | --- | --- |
| 1. Definición | Alcance, modalidad de uso, arquitectura y reglas iniciales | Modalidad confirmada y decisiones registradas |
| 2. Base Android | Proyecto, navegación, almacenamiento y primera APK de prueba | Instalar y abrir la APK en un dispositivo Android |
| 3. Asistencia | Colaboradores, horarios, entrada y salida mediante identificación manual provisional | Registrar una jornada, evitar duplicados y conservarla al reiniciar |
| 4. Cálculos | Horas trabajadas, incidencias, turnos nocturnos y tiempo fuera del horario | Verificar ejemplos conocidos y distinguir jornadas incompletas |
| 5. Cámara y rostro | Alta facial y verificación del trabajador | Validar en dispositivos reales, gestionar permisos y ofrecer alternativa ante fallos |
| 6. Administración y reportes | Acceso administrativo protegido, calendario, feriados y exportaciones | Verificar permisos y comparar reportes con registros originales |
| 7. Panel web | Administración desde navegador y sincronización según modalidad acordada | Verificar acceso, cambios y consistencia de datos |
| 8. Entrega | APK firmada, versión, instrucciones de instalación y recuperación | Instalación y actualización verificadas sin perder información |

## Primera versión funcional

- Alta y edición de colaboradores; desactivación sin borrar su historial. A petición del usuario se añade borrado confirmado de trabajadores sin marcaciones; los que tienen historial se desactivan.
- Asignación de horarios.
- Registro de entrada y salida con identificador único y fecha/hora.
- Consulta de registros e incidencias de la jornada.
- Acceso administrativo con autenticación y autorización. Ocultar un botón no protege los datos.
- Identificación manual provisional para probar el flujo antes de incorporar reconocimiento facial.

## Criterios de diseño

- Conservar marcaciones originales; registrar quién realiza una corrección, cuándo y por qué.
- Mantener el historial de horarios para que un cambio no altere jornadas anteriores.
- Regla confirmada: extras al superar las horas efectivas programadas; retardo por separado según la entrada real. Casilla por horario para descontar comida/descansos automáticamente o exigir marcaciones. Configuración, marcaciones y cálculo implementados en 0.3.0; aceptación en tablet pendiente. Detalle y límites en REGLAS_HORARIOS.md y PRUEBA_CALCULOS.md.
- Contemplar cruces de medianoche, descansos, marcaciones faltantes y zona horaria del centro de trabajo.
- Tratar las plantillas faciales como datos sensibles: limitar acceso, definir eliminación y evitar guardar fotografías innecesarias.
- La biometría de desbloqueo del teléfono no identifica por sí sola a distintos trabajadores. El reconocimiento facial de colaboradores necesita una integración específica y evaluación contra fotografías o videos.
- La ubicación del almacenamiento, el funcionamiento sin internet y la sincronización dependen de la modalidad de uso.
- Confirmar si se necesita XLS antiguo o si XLSX es aceptable; el diagrama también solicita PDF.

## Decisiones pendientes

1. Modalidad confirmada: una sola tablet compartida. No se requiere sincronización entre dispositivos para la primera versión.
2. Cantidad aproximada de trabajadores y centros de trabajo.
3. Necesidad de registrar asistencia sin internet.
4. Dispositivo confirmado para pruebas: una tablet con Android 14 (API 34).
5. Reglas de descansos, tolerancias, correcciones y aprobación de horas extra.
6. Panel web local en la misma red o accesible por internet.
7. Política de alta, conservación y eliminación de datos faciales.

Resolver estas preguntas cuando afecten a la siguiente entrega; no es necesario contestarlas todas para iniciar.

## Modelo funcional inicial

- Colaborador: identificador, nombre, estado e historial de asignaciones.
- Horario: días aplicables, inicio, fin, descansos y vigencia.
- Marcación: identificador, colaborador, tipo, instante, zona horaria, dispositivo y método de identificación.
- Ajuste: referencia al registro, valor corregido, motivo, administrador y fecha.
- Calendario: centro de trabajo, fechas laborables y feriados.
- Credencial facial: referencia al colaborador, plantilla protegida y versión del motor; diseño definitivo en la etapa de cámara.
- Administrador: credenciales y permisos.

## Tecnología

Base seleccionada: Android nativo en Java, con SQLite local previsto para la persistencia. La primera versión se diseña para operar sin internet en una única tablet. El panel web se resolverá en su propia etapa.

Se creó el módulo Android y una pantalla de bienvenida. Android 8.0 es el mínimo configurado; el dispositivo de aceptación confirmado tiene Android 14. Se prepararon herramientas locales en .tools y se compiló la primera APK 0.1.0 con firma de prueba verificada. El usuario confirmó su instalación y ejecución correcta en la tablet Android 14; etapa 2 completada. El resultado final debe incluir el código fuente y una APK instalable; una web o un prototipo visual por sí solos no cumplen el objetivo.
