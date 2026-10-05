# B0d Asistencia

Aplicación Android para una única tablet compartida. Proyecto en construcción por etapas.

**Cambio de arquitectura en curso:** la APK pasará a ser solo terminal de marcaciones/bloqueo por PIN; administración web y PostgreSQL en Render. Ya existe una base web probada en `server/`, pero aún no está desplegada ni vinculada a Android. Ver [plan de migración](ARQUITECTURA_WEB_RENDER.md). Alpha4 sigue siendo la última APK utilizable durante la transición; no se ha retirado su administración local todavía.

## Estado de esta entrega

**APK vigente: `entregas/B0d-Asistencia-0.4.0-alpha4.apk`.** Barra inferior flotante con Inicio central, engrane compacto centrado, botones centrados y sombras suaves. Se retiran textos introductorios del PIN y formularios. Dashboard automático cada cinco minutos, sin botón de actualización; conserva el cierre de sesión por inactividad. Instalar sobre la anterior sin desinstalar. Pendiente revisión visual en tablet.

### Base anterior de alpha3

**Entrega anterior: `entregas/B0d-Asistencia-0.4.0-alpha3.apk`.** Menús internos adaptables al ancho de ventana, dashboard administrativo con avance diario/avisos/extras/cumplimiento, tarjetas de Personal Operativo y navegación inferior fija. Mantiene las operaciones del registro y la paleta actual. Siete escenarios nuevos de cumplimiento aprobados; compilación y lint sin errores (16 avisos, principalmente versiones y recursos anteriores sin uso). Prueba visual y conexión a datos en tablet pendientes según PRUEBA_MENUS.md. Misma firma y esquema SQLite 6. Instalar encima de la anterior.

### Base conservada de alpha2

**Base anterior: `entregas/B0d-Asistencia-0.4.0-alpha2.apk`.** Inicio con cámara grande, Entrada, Salida, iconos Comida/Break y engrane administrativo, sin descripciones ni solicitud de código. Al tocar la acción compara el rostro localmente con los perfiles y registra cuando hay coincidencia suficiente y no ambigua. Conserva los colores corporativos. Ver PRUEBA_KIOSCO_FACIAL.md. Es una alpha: reconocimiento pendiente de validación en tablet y sin prueba de vida.

207 comprobaciones aprobadas (39 de cifrado/encuadre/comparación, 40 SQLite y 128 reglas anteriores), además de prueba de modelos en escritorio. Compilación y lint aprobados: 0 errores y 6 avisos de versiones/atributo. Misma firma verificada; cámara, AndroidKeyStore, JNI y flujo completo pendientes de prueba física en Android 14. Instalar sobre la versión anterior sin desinstalar. Ejecutar `scripts/Test-FaceProfiles.ps1` y los scripts anteriores; SQLite se verifica con el descubrimiento descrito abajo.

### Entregas anteriores conservadas

`entregas/B0d-Asistencia-0.4.0-alpha1.apk`: captura, guardado cifrado y consulta de fotos de referencia. Sus fotos se conservan y se convierten a plantillas al primer uso en alpha2; las que no puedan procesarse requieren nuevo registro.

`entregas/B0d-Asistencia-0.3.0.apk`: descansos, cálculo de tiempo efectivo, ordinarias, extras y retardo. Mi jornada reúne estado, métricas y acciones. Ver PRUEBA_CALCULOS.md, REGLAS_HORARIOS.md y GUIA_UX.md.

Actualización visual disponible: `entregas/B0d-Asistencia-0.2.1.apk`. Paleta azul corporativo, tarjetas y controles redondeados. Mantiene las funciones de 0.2.0. Firma verificada y lint sin errores; revisión visual en tablet pendiente. Instalar sobre la versión anterior sin desinstalar.

APK actual: `entregas/B0d-Asistencia-0.2.0.apk`. Incluye PIN, catálogo de trabajadores, borrado confirmado de trabajadores sin marcaciones, entrada/salida manual por código y consulta administrativa de las últimas 200 marcaciones. Ver PRUEBA_ASISTENCIA.md.

Se conservan 0.1.0, alpha1 y alpha2. El usuario confirmó las primeras pruebas y respondió afirmativamente a alpha2 solicitando borrado. La 0.2.0 requiere prueba de actualización y asistencia en tablet.

## Arquitectura acordada y propuesta

- Confirmado por el usuario: una sola tablet con Android 14 (API 34).
- Base propuesta: Android nativo y SQLite privado dentro de la aplicación; sin servidor necesario para las marcaciones.
- Operación sin internet como criterio inicial de diseño.
- Administración local protegida; reconocimiento facial y panel web en entregas posteriores.
- Respaldo y recuperación deberán implementarse antes de usar datos reales. Desinstalar la app puede eliminar los datos locales.
- Android mínimo del proyecto: 8.0 (API 26). Dispositivo de aceptación: Android 14; compilar con SDK 36 no exige Android 16 en la tablet.

## Compilación

Requisitos: JDK 17, Gradle 8.13, Android SDK Platform 36 y herramientas de compilación compatibles con AGP 8.13.2.

Compatibilidad documentada por Android: https://developer.android.com/build/releases/agp-8-13-0-release-notes

Se prepararon Java, Gradle y SDK dentro de `.tools`, y se generó el Gradle Wrapper. Para repetir la compilación desde PowerShell:

1. En un equipo nuevo, ejecutar `powershell -ExecutionPolicy Bypass -File scripts/Prepare-Android.ps1`. Descarga herramientas y acepta licencias del SDK; requiere acceso a internet.
2. Ejecutar `powershell -ExecutionPolicy Bypass -File scripts/Build-Android.ps1`.
3. Revisar la APK en `app/build/outputs/apk/debug/app-debug.apk` e instalarla en la tablet de pruebas.

Verificación de 0.2.0: 66 comprobaciones (23 PIN, 16 campos, 13 secuencia y 14 SQLite), compilación y lint aprobados (0 errores, 2 avisos). Firma válida e igual a entregas anteriores. Ejecutar scripts/Test-AdminAccess.ps1, scripts/Test-WorkerFields.ps1, scripts/Test-PunchRules.ps1 y `python -m unittest discover -s tests -p "test_*schema.py"`. No se ejecutaron pruebas automatizadas de interfaz Android.

La APK debug será solo para pruebas. La entrega final requiere firma de publicación y conservar la clave para futuras actualizaciones.

## Próximo tramo

Validar los menús de alpha3 según PRUEBA_MENUS.md y conservar las pruebas faciales de PRUEBA_KIOSCO_FACIAL.md, especialmente identidades distintas, rechazo de desconocidos, tiempos y pausas. Ajustar según evidencia antes de uso definitivo; aún falta prueba de vida. Continuar por bloques cerrados y con margen de uso, siguiendo AllinoneScreen. Ver ESTADO.md para pendientes y límites de cálculo conocidos.
