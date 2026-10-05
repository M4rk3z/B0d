# 0.4.0-alpha2 — inicio y marcaciones faciales

Instala `entregas/B0d-Asistencia-0.4.0-alpha2.apk` sobre la anterior, sin desinstalar. El PIN, horarios, perfiles e historial se conservan. Es una entrega de prueba para Android 14.

APK universal: 220 587 600 bytes (incluye modelos y bibliotecas sin descarga en tablet). SHA-256: `D5E5B9B1ABED38BCD7C12E0DEA8838E7D3CE5F916DBFBF0D203CA1418ACA58FF`. Firma SHA-256: `982abfff61894e0b7d550b126bcd748e52bab79f8bf9dc3e685e261a462d2ebe`. Compilación y lint: 0 errores y 6 avisos; 207 comprobaciones aprobadas más la prueba de modelos de escritorio.

## Uso

- Inicio: B0D, cámara grande, Entrada, Salida, iconos de Comida y Break, y engrane. Conserva azul corporativo y fondos claros. Sin descripciones permanentes ni campo de código.
- Engrane: acceso por PIN a administración y registro de colaboradores/perfiles. En instalación nueva también permite crear el PIN.
- Al tocar una acción se captura el rostro y se compara con los perfiles locales. Una coincidencia suficiente y sin ambigüedad registra la acción; confirma nombre y resultado durante cuatro segundos en la misma pantalla.
- Comida y Break: el mismo botón inicia y termina su respectiva pausa. Durante una comida se vuelve con Comida; durante un break se vuelve con Break. Las pausas manuales existentes sin categoría admiten cualquiera de los dos para regresar.
- El horario debe tener activada la opción de marcar descansos. Con descuento automático no se generan pausas manuales adicionales.
- Se impide repetir una marcación facial en menos de cinco segundos. La secuencia habitual también se valida: no salida sin entrada, no segunda entrada abierta, no salida durante una pausa sin registrar regreso.

## Aceptación en tablet

1. Verificar actualización sin pérdida de datos y nuevo diseño tanto en vertical como horizontal. Comprobar tamaño de botones y que la cámara/controles no queden ocultos.
2. Permitir cámara si Android lo solicita. Después de denegar, comprobar que el engrane sigue funcionando. Si Android deja de preguntar, habilitar el permiso desde Ajustes.
3. Registrar dos colaboradores distintos con su rostro y horario. Reabrir sus perfiles y comprobar lectura. Intentar registrar el mismo rostro en otro colaborador: debe pedir revisar perfiles.
4. Colaborador A: Entrada → Comida → Comida (regreso) → Break → Break (regreso) → Salida. Esperar al menos cinco segundos entre marcaciones de prueba. Verificar nombre y horario en cada resultado e historial.
5. Colaborador B: repetir, verificando que no se intercambien identidades. Probar iluminación y distancia habituales, gafas si se usan y la posición definitiva de la tablet.
6. Probar una persona sin perfil, ningún rostro y dos rostros: no registrar. Probar a los colaboradores varias veces; anotar cualquier rechazo o identidad equivocada. No considerar validada la precisión con una sola prueba.
7. Probar Entrada repetida, Salida sin entrada y regreso con botón equivocado: rechazar sin insertar eventos nuevos. Pulsar rápidamente distintos botones: una sola solicitud.
8. Desactivar un colaborador: no debe poder marcar. Eliminar su perfil facial: no debe reconocerse. Volver a registrarlo si se quiere continuar.
9. Reiniciar tablet y repetir en modo avión. Los modelos están incluidos. El primer uso de fotos guardadas en alpha1 genera sus plantillas; puede tardar más. Si pide nuevo registro, reemplazar la foto desde administración. Una carga de más de veinte segundos pide repetir y no marca con captura antigua.
10. Durante la comparación, bloquear tablet o salir de la app: descartar resultado si aún no se autorizó el guardado. Una operación ya enviada a guardar puede terminar; consultar historial antes de repetir. Al volver se presenta el inicio, sin sesión administrativa ni nombre anterior.
11. Comprobar resúmenes: comida/break descuentan tiempo en modo marcado; extras y retardo conservan las reglas anteriores. Probar también horario de descuento automático.

## Estado técnico y límites

Reconocimiento local SFace con alineación YuNet y OpenCV 4.12.0. ML Kit sigue validando el encuadre en la captura. Comparación coseno mínima 0.55 y diferencia mínima 0.10 frente al segundo perfil. Son umbrales provisionales conservadores, no una garantía estadística. Se comparan también perfiles inactivos para no asignarlos a otra persona; la marcación comprueba después el estado activo.

No hay prueba de vida ni protección validada contra presentación de una fotografía. Esta alpha requiere validación supervisada antes de usar sus resultados como control definitivo. No reconoce de forma garantizada gemelos, condiciones de luz no probadas ni cambios importantes de apariencia. La cámara no realiza reconocimiento continuo: solo al tocar una acción.

SQLite pasa de 5 a 6: añade plantilla cifrada y versión del modelo, permite método facial en punches y registra categoría/score/modelo en facial_punch_details. La migración conserva secuencias, contextos de jornada y fotos. Foto y plantilla se reemplazan juntas; borrar perfil elimina ambas. AES-GCM vincula la plantilla al UUID y modelo. Las capturas de marcación se descartan en memoria, no se guardan en galería. No hay permisos de Internet ni almacenamiento.

Verificación: pruebas Java del cifrado, encuadre, margen de comparación y selección de acción; pruebas SQL de migración con jornadas existentes y referencias; compilación/lint. Prueba de modelos en OpenCV de escritorio con dos imágenes oficiales de muestra y una variación de iluminación: mismo ejemplo 0.991, ejemplo distinto 0.130; imagen vacía rechazada. Esto verifica integración básica, no precisión en población ni ejecución de cámara/JNI/AndroidKeyStore en la tablet. No hay emulador configurado.

Referencias y licencias incluidas en `app/src/main/assets/models/NOTICE.txt`: [SFace oficial](https://github.com/opencv/opencv_zoo/tree/main/models/face_recognition_sface), [YuNet oficial](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet), [API de alineación y comparación](https://docs.opencv.org/4.13.0/javadoc/org/opencv/objdetect/FaceRecognizerSF.html).
