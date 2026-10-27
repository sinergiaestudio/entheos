# ANATHEOS 3D · Demo Local v0.3 · Visor ampliado
**Estado:** rama experimental, PR DRAFT, sin merge/deploy/uso diagnóstico. Deriva de PR #35 (v0.2).

## Contenido de esta rama
- `ANATHEOS_3D_Demo_Local_v0.3_Codigo_Sin_DICOM.zip`: código fuente recuperable **sin imágenes DICOM**, 33.717 bytes; SHA-256 `375433915c315ccf96662c56e9cc4d69f3b9440b2e11f32db177248b07261182`; Git blob `bcc5faf50ad4889ba18668db08781ebdfd7663bf`.
- ZIP incluye app.js, volumetric.js, index.html, style.css, launcher Windows, manifest SHA-256, documentación y test Node de geometría. No hay `.dcm`, `datasets/` ni ZIP DESS en este GitHub.
- La distribución ejecutable **con DESS pública de Leeds** está en Drive **fuera** del repositorio: https://drive.google.com/file/d/1eN0WaLQgJnAs_aVUKc5JIjF3uoE7vBGO/view. SHA-256 `f57be9278389c3bcadbc4facd0baf67bdb12fb6b9848d3ced6bc2050c7355267`, tamaño 28.714.581 bytes. DESS interior SHA-256 `1c378e89d3a2e7aa57a1049f1fa91b9278529e544369d1071d4c453073ce951d`.
- Respaldo secundario de código en Drive: https://drive.google.com/file/d/1pW7guJWEZFJnBIczukH3Pzy48AzWIhSz/view. Respaldos previos conservados.

## Mejoras funcionales respecto de v0.2
- Visor por defecto ~72dvh; modo **Visor amplio**, sin sidebar/metadatos; **pantalla completa** real con botón Salir y Escape.
- Mayor encuadre inicial del volumen (zoom 1.55) y límite GPU aumentado hasta 1360×900, en función de capacidad gráfica.
- Recorte espacial por profundidad del eje de cortes DICOM (z normalizada), implementado en WebGL2 shader **y** CPU raycast; no es segmentación anatómica ni MPR validada.
- Escala de **grises** por defecto; pseudocolor **opcional** para intensidades, sin afirmación de correspondencia con tejidos.
- Panel rápido de profundidad y paleta disponible durante foco/pantalla completa; render de menor resolución mientras se gira (la calidad final se restaura al soltar).
- P1A/cortes 2D originales conservados, sin dependencias/servicios adicionales.

## Evidencia y límites
Prueba ejecutada fuera de CI GitHub, con **144 archivos DESS originales**, en Chromium Linux 144: volumen 384×384×144, fallback CPU, viewport normal 1296×698, amplio 1548×800, fullscreen 1580×970, clipping/paleta alteran píxeles realmente renderizados, rotación, regreso 2D, limpiar; **0 errores JS y 0 solicitudes externas**. `node test_volume_core.mjs`: PASS. No se validó la nueva ruta GPU WebGL2 en este equipo; Dirección debe probarla en Windows. Sin 3D Slicer, segmentación clínica, ni reconstrucción multiplanar validada.

Para ejecutar en Windows: extraer completamente el ZIP de distribución de Drive, ejecutar `INICIAR_ANATHEOS.cmd`, seleccionar la DESS incluida y `Volumen 3D`, usar `Visor amplio`/ `Pantalla completa`. 100 % localhost, sin Entheos productivo.

**Licencia del dataset:** CC BY 4.0, Wijayathunga et al. (2026), University of Leeds, https://archive.researchdata.leeds.ac.uk/1609/ , DOI 10.5518/1834. No incluir material médico en GitHub. Sin merge ni activación remota autorizados.
