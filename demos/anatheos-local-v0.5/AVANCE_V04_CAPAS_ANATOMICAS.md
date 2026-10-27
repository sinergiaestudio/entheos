# ANATHEOS 3D · Demo Local v0.4 · Primer editor de regiones y máscaras

Fecha: 27 de octubre de 2026. **EXPERIMENTAL. NO DIAGNÓSTICO.**

## Alineación estratégica
La segmentación de estructuras y la activación/desactivación de capas forman parte del recorrido principal ANATHEOS 3D: (1) entrada DICOM, (2) volumen real, (3) editor de regiones, (4) máscaras supervisadas y validación externa, (5) modelos automáticos específicos. **v0.4 NO reconoce automáticamente huesos, cartílagos, meniscos, vasos, nervios, músculo, piel ni líquidos.** Una imagen DESS aislada puede no demostrar esas estructuras con precisión o contraste suficiente. Ninguna etiqueta genérica se presenta como diagnóstico.

## Implementado realmente
- Conserva visor 2D, giro/zoom del volumen 3D, profundidad, seudocolor y visor ampliado de v0.3.
- **Tres capas manuales**, rojo/cian/amarillo, seleccionables y con visibilidad independiente, correspondencia voxel a voxel con la serie espacial DICOM ordenada por IPP·normal de IOP.
- **Pincel 2D**, borrador, radio 1-24 píxeles y extensión explícita opcional de 0 a ±4 cortes. Esa extensión NO es interpolación anatómica ni validación de tejidos; es propagación geométrica controlada del dibujo.
- **Relleno asistido por intensidad 2D**: región conectada al clic, semejanza de intensidad al píxel semilla, tolerancia seleccionable entre 1 y 30 % del ancho de ventana y límite espacial de radio 10-70 píxeles, máx. 20.000 píxeles por aplicación. **No hace diagnóstico ni reconocimiento anatómico.**
- Máscaras superpuestas semitransparentes al corte 2D sin alterar `frame.values`; en 3D se visualizan mediante textura separada R8, con selección de capas en WebGL2 y respaldo CPU. Ninguna estructura 3D sintética o malla artificial.
- **Exportación NRRD** (labelmap, `uint8`, 384×384×144 para DESS): `space: left-posterior-superior`, 3 vectores espaciales derivados de IOP / PixelSpacing / SliceSpacing, origen IPP del primer corte. Permite revisión independiente como mapa de etiquetas en 3D Slicer, pero **NO implica validación en Slicer ni cumplimiento DICOM SEG**. Importación NRRD admite exclusivamente la geometría y cabecera exactas del estudio actual, sin modificar DICOM.
- Desvinculación de máscara y recursos al liberar; liberación real de memoria sujeta al GC del navegador. Sin servidor de imágenes, API adicional, datos clínicos ni costes.

## Evidencia reproducible
- Pruebas unitarias `node --test test_segmentation.mjs test_volume_core.mjs` PASS: geometría, sello de exportación e importación, capas independientes, propagación, borrado, rechazo por incompatibilidad, región conectada 2D y regresión del volumen v0.2.
- **Chromium real con el DESS público original completo**: 144 instancias, 384×384×144, máscara manual de 13.990 vóxeles (7 cortes tras extensión ±3), exportación `.nrrd` 21.234.273 bytes, reimportación y exactitud de conteo; relleno 2D que añadió 1 voxel en el punto probado; vista 3D **CPU** mostró los colores de las máscaras, con cambio en valores de píxel al desactivar capa (`sum=17.161.181` vs `17.123.568`). **0 page errors, 0 solicitudes externas** durante esa ejecución. Capturas `v04_annotation_2d_real.png` y `v04_3d_regions_real.png` permanecen en la entrega privada, no en GitHub público.
- El render de máscara **WebGL2** está implementado mediante textura R8 y `sampler3D` con interpolación nearest, **todavía no probado en GPU de Windows**. Verificar allí rendimiento y correcta superposición. La ruta de respaldo CPU sí está probada.
- No se ha ejecutado 3D Slicer con estas máscaras ni se ha obtenido evaluación anatómica profesional. NRRD conserva coordenadas LPS, pero su convención de ejes y lateralidad debe contrastarse en Slicer con el volumen original.

## Datos, atribución y distribución
- Datos: Universidad de Leeds RTKN0668 DESS, CC BY 4.0, https://archive.researchdata.leeds.ac.uk/1609/ . **ZIP DESS original sin modificar**, SHA-256 `1c378e89d3a2e7aa57a1049f1fa91b9278529e544369d1071d4c453073ce951d`.
- **GitHub público:** exclusivamente fuentes y documentación sin `.dcm`, `.nrrd` ni imágenes del conjunto real. **Distribución Windows:** contiene ZIP DESS original como material de prueba público local, sin publicación remota.
- Ejecutar `INICIAR_ANATHEOS.cmd`; seleccionar **Cargar RM DESS incluida** → marcar **Dibujar sobre cortes 2D** → elegir región y pincel → probar **Volumen 3D** → activar/desactivar casillas. Para revisar externamente, exportar NRRD y abrirlo en 3D Slicer como labelmap. Reimportarlo en ANATHEOS con la misma secuencia cargada.

## Siguientes hitos concretos
1. Confirmar visualización de capas WebGL2 en PC Windows de Dirección y comparar orientación/export NRRD con 3D Slicer.
2. Soportar nuevas secuencias RM Leeds RTKN0668 (T2, MEDIC, VIBE), verificando diferencias de geometría, registro y calidad de tejidos. **No combinar series sin registro comprobado**.
3. Incorporar herramientas supervisadas de edición, interpolación anatómica de regiones entre cortes, deshacer/rehacer y revisión por estructura; estandarizar categorías anatómicas.
4. Evaluar modelos de segmentación específicos para RM de rodilla, con licencias abiertas, pesos y datasets compatibles; medir Dice/HD95 frente a máscaras de referencia de expertos.
5. Vasos, nervios y tejidos blandos finos solo con secuencias adecuadas y validación específica; la DESS aislada no los asegura.

No mezclar la rama local con PR de Sites/Entheos ni modificar `main`, piloto, D1/R2, flag, visibilidad del Site o acceso de terceros.
