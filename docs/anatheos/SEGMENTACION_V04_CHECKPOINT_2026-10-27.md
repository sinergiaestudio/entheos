# ANATHEOS 3D · Checkpoint v0.4 · Segmentación exploratoria manual

Fecha: 27/10/2026. Estado: **primera versión Windows funcional probada con Leeds en Chromium; código v0.4 respaldado en Drive, NO incorporado todavía a GitHub**. **Este commit es SOLO documental.** Ningún merge, publicación de Sites, acceso de terceros ni carga de DICOM a GitHub.

## Correspondencia con objetivos del proyecto

La individualización de huesos, tejidos musculares, cartílago, vasos, nervios, líquidos y piel pertenece al **objetivo central** de ANATHEOS. Alcanzarlo requiere diferenciar una anotación manual, una propuesta semiautomática por intensidad, una segmentación anatómica producida por un modelo y una validación independiente. Un solo estudio RM DESS de rodilla no acredita visibilidad ni reconocimiento preciso de todos esos tejidos.

## v0.4 entregada para Windows

- [Distribución completa con DESS pública original](https://drive.google.com/file/d/1I901HbG4nRupA8tBM1cFkX2LkGLerCsc/view): archivo `ANATHEOS_3D_Demo_Local_v0.4_Windows_Leeds_Segmentacion.zip`, **28.721.699 bytes**, **SHA-256 `729abd6af2e356f45833ff229da856867bd8c9213a5a51f03579fe5b940ec049`**. El ZIP original RTKN0668 DESS se mantuvo sin cambiar; SHA-256 `1c378e89d3a2e7aa57a1049f1fa91b9278529e544369d1071d4c453073ce951d`.
- [Fuentes auditables sin DICOM](https://drive.google.com/file/d/15IGMwxoSgq49cJUfZAyBibqnV9637uVz/view): `ANATHEOS_3D_Demo_Local_v0.4_Codigo_Sin_DICOM.zip`, **41.989 bytes**, **SHA-256 `16996090570868a7751692eee5ad92d8c1808a3c3eb365752ca8f22a4290887e`**. Es un ZIP con archivos JS/HTML/CSS, launcher Windows, pruebas Node, preflight sanitizado e informe de alcance. **Todavía NO es un blob ni una rama con fuente v0.4 en GitHub**; la transferencia de código de Drive a GitHub fue bloqueada en este entorno. No reportar como integrada.
- Los dos respaldos fueron verificados por metadata en la carpeta privada de respaldo existente `02 · Backups de código y documentación`, sin sobrescribir material anterior.
- Fuente Leeds: https://archive.researchdata.leeds.ac.uk/1609/ ; CC BY 4.0.

## Capacidad real que se probó

- Reconstrucción volumétrica previa v0.3 preservada. Tres regiones manuales no diagnosticadas, rojo/cian/amarillo, con activación individual y editor sobre cortes 2D.
- Herramientas: pincel, borrador, radio, extensión espacial controlada a ±4 cortes y propuesta de relleno conectado **2D** basada en proximidad e intensidad, sin identificación anatómica.
- Máscaras de `uint8` exactamente alineadas a la malla de vóxeles DICOM original, superposición 2D y superposición volumétrica CPU; código de textura WebGL2 aún no validado en Windows.
- Exportación e importación NRRD raw `uint8` con LPS, IOP, IPP y PixelSpacing. El formato permite trabajar hacia validación 3D Slicer **que aún NO se ejecutó**. No declara conformidad DICOM SEG.
- Pruebas unitarias de máscaras y volumen: 5/5 PASS sin fallos. Chromium Linux: serie **real** RTKN0668 DESS completa, 144 imágenes de 384 × 384; marcas de 13.990 vóxeles, export NRRD 21.234.273 bytes, reimportación correcta, relleno asistido, superposición 3D por CPU; deshabilitar etiqueta cambió medición de imagen. **Cero JavaScript page errors, cero solicitudes externas**.
- La captura real y el NRRD temporal de la prueba **NO** se han añadido al repositorio ni al respaldo de código fuente.
- El iniciador PowerShell Windows y la visualización GPU de etiquetas todavía no se comprobaron físicamente para v0.4; requieren revisión por Dirección, aunque v0.3 sí fue probada en su equipo.

## Próximo hito

1. Dirección prueba v0.4 en Windows, especialmente import/export y visibilidad de regiones con WebGL2.
2. Comparación independiente de segmentación LPS/NRRD y geometría con 3D Slicer.
3. Registro reproducible de v0.4 en rama de GitHub **con código, no DICOM** cuando la transferencia esté autorizada y disponible; test CI de esa fuente exacta antes de merge.
4. Más adelante: interoperabilidad con máscaras revisadas por profesionales, secuencias adicionales Leeds para verificar tejido, métricas, segmentación específica por órgano/estructura basada en OSS (ej. Slicer/MONAI), supervisión humana y validación anatómica. Ningún reconocimiento automático de nervios/vasos por simple umbral.

## Límites de seguridad

Se mantienen intactos `main`, el piloto, PR de Sites y el visor P1A. No se cargaron imágenes médicas a GitHub. Este checkpoint documental no se debe interpretar como un PR de implementación funcional del código v0.4.
