# ANATHEOS · Demo Local v0.1 (Windows) · RTKN0668 DESS

**Estado:** demo visual experimental, PR de revisión, **sin merge**. Esta carpeta contiene **únicamente el paquete de código fuente sin DICOM**. Las imágenes reales se distribuyen por separado mediante un archivo privado/local en Google Drive y la entrega de la conversación. No publicar DICOM en GitHub.

## Recuperación del código

- Archivo: `ANATHEOS_Demo_Local_v0.1_Codigo_Sin_DICOM.zip` (ZIP de fuentes, 19.243 bytes).
- SHA256 del ZIP de fuentes: `7fbb204aa8b9ef796b6422b75dd447a3870dfdf70900b7f5ea554a2fa126a746`.
- SHA Git blob exacto: `573327caa586b50e295b4760638fe75868312907`.
- Incluye `index.html`, `app.js`, `style.css`, `INICIAR_ANATHEOS.cmd`, `servidor_local.ps1`, `LEEME_WINDOWS.txt`, manifiesto, atribución y preflight numérico.
- Para ejecutar con la RM DESS, extraer en una misma carpeta de Windows y agregar manualmente el ZIP original `datasets/RTKN0668_MR_DESS.zip` **sin alteraciones**; SHA256 `1c378e89d3a2e7aa57a1049f1fa91b9278529e544369d1071d4c453073ce951d`. O usar `Abrir ZIP` desde UI y seleccionar dicho archivo.

## Paquete completo y respaldo externo

- Paquete Windows local **con DESS incluido**, respaldo privado Drive: https://drive.google.com/file/d/15Y5x6-NzhV9mbeExowSI-LymRql3AOg-/view
- Backup separado de código sin DICOM, Drive: https://drive.google.com/file/d/1r_gFK1xR5wmF_nCoXHaaUutTFr6zQQ08/view
- Carpeta de respaldo: https://drive.google.com/drive/folders/1tHdnZVCdJ4aBEhYbzSGSbvftbTlOzMNo
- Fuente dataset: Wijayathunga et al. (2026), University of Leeds, DOI https://doi.org/10.5518/1834, CC BY 4.0, https://archive.researchdata.leeds.ac.uk/1609/.
- **No subir ZIP completo ni DICOM al repo público.** El archivo de código no los contiene.

## Preflight real de RTKN0668_MR_DESS.zip

El archivo DESS se recuperó del paquete A privado de Drive. SHA256 coincidente con el comunicado por Dirección. 144 instancias, una sola serie MR DESS; 384×384 píxeles, MONOCHROME2, TS UID `1.2.840.10008.1.2.1`, 16 bits asignados, 12 almacenados, unsigned. PixelSpacing `0.36458334326744 × 0.36458334326744 mm`, separación de IPP proyectadas ~`0.70000002119 mm`; IOP oblicuo consistente. Hay atributos del grupo paciente `0010` y tags privados: **no exponer valores, ni incorporarlos a logs/manifest/GitHub**.

## Evidencia local del navegador

Probado en Chromium Linux mediante inyección de archivos estáticos en una página local debido a la prohibición de navegación localhost impuesta por el entorno de pruebas. Se seleccionó el **ZIP DESS original completo** mediante File API (sin red), verificando carga de 144 instancias, orden ascendente de proyección espacial LPS, imágenes 384×384, metadatos, recorrido y controles ventana/nivel/brillo/contraste/zoom/reset/clear. Pruebas extendidas compararon 12 muestras de píxel de 3 cortes contra lectura binaria independiente en Python, detectaron ZIP corrupto, cargaron **contenedor A anidado**, sin solicitudes externas ni errores JS. La captura y paquete completo están en entrega privada, **no en GitHub**.

El iniciador PowerShell de Windows 10/11 **no ha sido probado en Windows físico**; el código se diseñó para abrir un servicio HTTP estrictamente en 127.0.0.1, sin dependencia Node ni suscripciones.

## Límites y continuidad

- Demo v0.1 visualiza DICOM monocromático nativo sin compresión usando un **decoder JavaScript local específico**; **no incorpora todavía Cornerstone3D**. Los tests previos de Cornerstone y RLE residen en PR #30–#32 y no deben confundirse con el motor de esta demo.
- No hay MPR anatómico, 3D volumétrico, Slicer externo, validación clínica, codecs JPEG/JPEG-LS/JPEG2000/RLE en esta distribución.
- Navegación por geometría IPP·normal de IOP, pero no afirmar lateralidad/anatomía validada; se retiraron símbolos visuales L/R especulativos.
- Se elimina la referencia de la serie al pulsar Liberar, sin garantizar GC inmediato.
- Revisar y probar el iniciador en Windows antes de cerrar formalmente el hito.

**No se modificaron piloto, `main`, Sites, D1/R2, Settings de GitHub ni costos.**
