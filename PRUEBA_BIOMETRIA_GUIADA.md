# Perfil facial con movimientos — 0.7.0-alpha1

La tablet registra cinco muestras (frente, lado aleatorio, frente, lado opuesto, frente). Cada posición exige estabilidad; al marcar se solicita frente/lado/frente y se compara la identidad. Se conservan los perfiles anteriores de una muestra, aunque conviene volver a capturarlos.

En Colaboradores → Ver perfil → Capturar rostro, la web solicita autorización, muestra los puntos del rostro y guía cinco posiciones. La captura web queda pendiente hasta que la tablet vinculada descargue las muestras, valide que pertenecen al mismo rostro y genere sus vectores SFace. Una captura rechazada conserva el perfil local anterior. Los indicadores distinguen pendiente, listo, revisar captura y estado aún sin sincronizar.

Las imágenes web viajan por HTTPS y quedan cifradas mediante AES-256-GCM, asociadas a colaborador y revisión. Configurar `FACE_ENCRYPTION_KEY` estable, aleatoria y de al menos 32 caracteres en Render; el Blueprint incluye `generateValue: true`. Conservar esa clave en un respaldo seguro. No cambiarla sin migrar previamente los datos cifrados. La captura se bloquea si falta la clave. Las capturas originales de tablet siguen cifradas localmente; solo se transmite su estado. Eliminar desde web distribuye una revisión de borrado que se aplica al sincronizar; una tablet desconectada todavía conserva su copia hasta conectarse.

No se miden profundidades físicas: es una cámara RGB con perfil de varios ángulos, no Face ID ni una prueba de vida certificada. Los movimientos no garantizan protección contra videos o ataques sofisticados. La precisión real y los límites angulares requieren validación en la Kindle antes del uso operativo.

## Pruebas de aceptación en dispositivo

1. Instalar la actualización sin desinstalar; comprobar PIN y menú.
2. Registrar un colaborador siguiendo las cinco posiciones. Cancelar a mitad y comprobar que se mantiene el perfil anterior.
3. Probar una marcación válida, otra persona, dos rostros, poca luz y cámara tapada; los rechazos no deben generar marcaciones.
4. Capturar desde web con cámara autorizada. Sincronizar tablet, comprobar el indicador listo y marcar desde la tablet.
5. Interrumpir conexión durante descarga y reintentar; verificar que se conserva el perfil previo.
6. Eliminar perfil web, sincronizar y comprobar que no reconoce ese perfil; comprobar también nueva captura posterior.

## Dependencias

- MediaPipe Tasks Vision 0.10.32, distribuido desde el mismo servidor (sin enviar imágenes a Google).
- Modelo oficial Face Landmarker float16 versión 1: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
- SHA-256: `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`.
- Documentación: https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker
- Tablet: modelos YuNet y SFace existentes. No cambia la firma de instalación.

Las pruebas automatizadas cubren cifrado, permisos, secuencia, sincronización, revisiones y borrado; no sustituyen las pruebas con una cámara real.
