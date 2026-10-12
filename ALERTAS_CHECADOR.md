# Avisos del checador — APK 0.7.0-alpha5

Las checadas usan una toma frontal. Los cinco pasos se reservan al registro del rostro. Los sonidos usan el volumen multimedia de Android; no hay casillas para activarlos. El destello es una capa de color que se desvanece una vez sobre la cámara, no la linterna.

## Confirmaciones después de guardar

| Acción | Color |
|---|---|
| Entrada registrada | Verde |
| Salida registrada | Azul |
| Salida a comida registrada | Ámbar |
| Salida a descanso registrada | Morado |
| Regreso de comida registrado | Turquesa |
| Regreso de descanso registrado | Turquesa |

Incluyen el nombre del colaborador, el encabezado «REGISTRO GUARDADO», un sonido y un destello. Los regresos comparten el mismo sonido y color. Los rechazos muestran «NO SE REGISTRÓ» o «REVISA ANTES DE CHECAR», con sonido y destello rojo.

## Bloqueos y alertas de marcación

1. **Entrada duplicada:** ya tienes una entrada; no se guarda otra.
2. **Salida duplicada:** ya tienes una salida; no se guarda otra.
3. **Falta entrada:** primero registra la entrada de la jornada.
4. **Regreso pendiente:** cierra la pausa con Comida o Break antes de salir.
5. **Sin pausa abierta:** no existe una pausa para registrar su regreso (validación interna).
6. **Botón de regreso incorrecto:** usa el mismo botón con el que saliste a Comida o Break.
7. **Marcación reciente:** han pasado menos de cinco segundos; espera y revisa el aviso anterior.
8. **Pausa deshabilitada:** no está habilitada en el perfil; consulta al administrador.
9. **Pausa fuera del límite:** todavía no está disponible o ya superó su límite de horas.
10. **Configuración de pausa no disponible:** no se pudo aplicar la configuración; consulta al administrador.
11. **Colaborador no disponible:** código inexistente o colaborador inactivo.
12. **Hora incorrecta:** la hora de la tablet es anterior al último registro.
13. **Acción incompatible:** la acción no corresponde al último registro.
14. **Guardado sin confirmar:** revisa el último registro con el administrador antes de repetir.

Comida y Break alternan salida y regreso. Una segunda checada válida después de cinco segundos registra el regreso; no se interpreta como otra salida a pausa.

## Cámara y reconocimiento

15. **Permiso de cámara pendiente:** toca para habilitarla; si se deniega, habilítala en los ajustes de Android.
16. **Cámara no disponible:** cierra otras aplicaciones que usen la cámara y reintenta.
17. **Cantidad de rostros incorrecta:** debe verse exactamente un rostro.
18. **Encuadre insuficiente:** acércate, mira de frente y muestra el rostro completo.
19. **No se pudo analizar el rostro:** repite la captura.
20. **Rostro no reconocido con claridad:** no se genera una marcación.
21. **Sin perfiles faciales:** registra previamente los rostros.
22. **Perfil por reparar:** solicita un nuevo registro al administrador.
23. **Reconocimiento vencido:** vuelve a intentar; no se registra usando un resultado tardío.

«Mira a la cámara», «Comprobando rostro» y «Reconociendo» son estados de procesamiento, no errores ni confirmaciones de guardado.

## Avisos adicionales al registrar un rostro

- **Repetir posición:** mejora el encuadre o la iluminación; se conservan las tomas anteriores.
- **Tiempo agotado:** reinicia la captura guiada.
- **Rostro duplicado:** coincide con otro perfil; revisa los colaboradores.
- **Error al guardar el perfil:** la operación no pudo completarse; comprueba su estado antes de repetir.
- **Foto ilegible:** reemplaza o elimina la referencia dañada.
- **Sin foto de referencia:** el colaborador todavía no tiene un rostro registrado.
- **Captura completa:** cinco posiciones validadas; falta pulsar Guardar.
- **Perfil facial guardado:** confirmación de almacenamiento, con sonido.

Validación de esta entrega: compilación, análisis estático y firma de APK. Las pruebas con cámara, audio y uso real corresponden al usuario, según lo solicitado.
