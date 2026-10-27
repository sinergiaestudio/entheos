# ANATHEOS 3D · v0.4 (código fuente recuperado)

**Uso local, experimental, no diagnóstico.** Esta carpeta preserva los **14 archivos originales** del ZIP de código fuente v0.4; cada uno mantiene idéntico contenido y nombre. El ZIP privado de 41.989 bytes permanece respaldado en Google Drive, SHA-256:
`16996090570868a7751692eee5ad92d8c1808a3c3eb365752ca8f22a4290887e`.

Origen: [ZIP de fuentes sin DICOM](https://drive.google.com/file/d/15IGMwxoSgq49cJUfZAyBibqnV9637uVz/view); [acta central](https://drive.google.com/file/d/1A1AtrFc8h1vxQjd4kavIoKdmpjYkVduM/view); [PR #37 documental](https://github.com/sinergiaestudio/entheos/pull/37). Se recuperaron fuentes **editables**, no se incorporó el archivo ZIP ni ningún estudio clínico al repositorio.

## Ejecución y pruebas

La carpeta no contiene `datasets/` ni archivos `.dcm`, `.nii`, `.nrrd` o imágenes médicas. En Windows, para cargar la serie desde la distribución privada existente, usar el paquete local de Drive; alternativamente abrir la app local y seleccionar un ZIP DICOM compatible. No está permitido usar el código de esta rama como servicio remoto ni desplegarlo en Entheos.

```bash
cd demos/anatheos-local-v0.4
sed '/^#/d;/^$/d' MANIFEST_SHA256.txt | sha256sum -c -
node --check app.js
node --check volumetric.js
node --check segmentation.mjs
node --test test_segmentation.mjs test_volume_core.mjs
```

El manifest original verifica los 14 archivos recuperados, sin modificar. En Windows, para verificar los hashes se requiere una herramienta SHA-256 equivalente si no está disponible `sha256sum`. Se mantiene el lanzador `INICIAR_ANATHEOS.cmd` y el servidor `servidor_local.ps1` original.

## Límites v0.4

- Máscaras manuales 0..3 con `Uint8Array`, pincel/borrador y crecimiento regional 2D: no existe segmentación automática ni extracción de mallas anatómicas independientes.
- Superposición volumétrica WebGL2/CPU: el render GPU sobre Windows aún requiere comprobación.
- DICOM: parser original restringido a instancias de 16 bits monocromas sin compresión; no es un lector DICOM universal.
- La importación de máscaras NRRD exige coincidencia geométrica exacta. No asociar máscaras de sujetos diferentes.
- Las pruebas de Node son comprobaciones unitarias/sintéticas: no implican validación anatómica, comparativa con 3D Slicer ni aptitud diagnóstica.

## Próxima etapa, sujeta a autorización de Dirección

Usar MRI, mapas de etiquetas y mallas **del mismo estudio** (SPL Knee Atlas, tras validar licencia, orientación, espaciamiento y procedencia) para generar y mostrar **fémur y tibia como superficies independientes**. No aplicar máscaras del atlas al estudio Leeds sin registro espacial validado.

**Aislamiento:** rama experimental descendiente del PR #37; sin cambios a `main`, rama piloto, producción, D1/R2, autenticación o reglas administrativas. El ZIP ejecutable de Windows con Leeds permanece exclusivamente en Drive: https://drive.google.com/file/d/1I901HbG4nRupA8tBM1cFkX2LkGLerCsc/view .
