# AFE-01C · Matriz de originales, tolerancias y pendientes

Fecha: 2026-11-01. Este informe **no** acredita ejecución de Slicer ni carga AFE de originales públicos.

## Umbrales fijados antes de pruebas con originales
- Misma fuente DICOM: ZIP SHA-256 esperado y SHA de cada archivo DICOM consumido por ambos motores; identidad de estudio/serie/FrameOfReference/acquisición/fase validada, no por nombres ni índices.
- Slicer obtiene geometría de **su propio importador DICOM y vtkMRMLScalarVolumeNode.GetIJKToRASMatrix/GetRASToIJKMatrix**; nunca se construye su referencia con salida de AFE.
- 27 muestras (esquinas, planos, centros) comparadas en LPS/RAS: error mundo euclídeo máximo 0.01 mm, inverso máximo 0.0001 voxel, norma de espaciado máxima 0.001 mm. Media y p95 obligatorios. Umbrales de ingeniería, no precisión clínica.
- Gauss-Jordan/VTK en sintéticos: máximos admisibles 1e-8 voxel y 1e-8 mm. En caso de desacuerdo no mover umbrales para conseguir PASS.
- Cualquier mezcla temporal, dimensiones distintas, múltiples nodos/series o discontinuidad no justificada: BLOCKED o REJECTED.

## Matriz de resultados, sin confundir antecedentes con esta ejecución

| Caso | Origen y SHA-256 ZIP esperado | Evidencia anterior en ANATHEOS 0.11 | Ejecución AFE-01C en originales | Ejecución real Slicer |
|---|---|---|---|---|
| Leeds MR RTKN0668 DESS | Leeds, DOI https://doi.org/10.5518/1834, CC BY 4.0. SHA 1c378e89d3a2e7aa57a1049f1fa91b9278529e544369d1071d4c453073ce951d | 144 imágenes previamente comprobadas por ANATHEOS, no por AFE-01C | **NO EJECUTADA**: original no disponible extraído | **NO EJECUTADA** |
| LCTSC TC | TCIA, DOI https://doi.org/10.7937/K9/TCIA.2017.3R3FVZ08, distribución DOI 10.5281/zenodo.4747795, CC BY 3.0. SHA 0e02554ffbf80c8c7e8f0868ec527c8ec10f7c4fd5b532c715cb3d6333676e5f | 130 cortes CT y RTSTRUCT mismo caso antes comprobados en ANATHEOS, no por AFE-01C | **NO EJECUTADA**: original no disponible extraído | **NO EJECUTADA** |
| Part10 generado, claramente SYNTHETIC-MR-TEST | Solo bytes sintéticos de laboratorio | No aplica | **PASS**: cuatro DICOM, hash correcto, parser CMR-R1 original, rechazo de alteración SHA y fases mezcladas | **NO EJECUTADA** |
| Gauss-Jordan/VTK independiente | Bases sintéticas, no imágenes humanas | No aplica | **PASS**: 100 matrices/1000 puntos Gauss-Jordan; 15/60 puntos VTK 9.6.2 local | **NO EJECUTADA** |
| JavaScript original | 320 configuraciones y 1600 puntos sintéticos | discrepancia 0.0062 voxel en AFE-01B | **PASS en reproducción de defecto**, máximo 2.2568176657265795 voxeles de desviación proyección original | No aplica |

**Distinción crítica:** SHA y conteos de los dos originales públicos se recuperaron del checkpoint de ANATHEOS 0.11 y la tabla de checksums Leeds, no de una descarga o medición propia en esta sesión. El archivo EXE 0.11 recuperado es un instalador NSIS; no se pudo extraer con las herramientas Linux disponibles (libarchive no reconoce el formato). No se usó el archivo de RM privado del usuario.

## Reproducción del gate bloqueado
1. Recuperar ambos ZIP DICOM originales bajo sus respectivas licencias. No mezclar CT y RTSTRUCT de casos diferentes. Verificar SHA-256 y origen de cada archivo.
2. Desde raíz del repo, con Python 3.11+, usar el script metadata-only que reutiliza el parser CMR-R1 y no decodifica píxeles:

    PYTHONPATH=research/anatheos-afe python research/anatheos-afe/tools/prepare_public_case.py --zip /local/RTKN0668_MR_DESS.zip --expected-sha256 1c378e89d3a2e7aa57a1049f1fa91b9278529e544369d1071d4c453073ce951d --case-id Leeds-RTKN0668-DESS --license CC-BY-4.0 --output /local/afe_leeds.json

   Para CT usar --case-id LCTSC-CT --license CC-BY-3.0 con el hash fijado arriba. El caso con marcadores temporales ausentes queda UNVERIFIED_TEMPORAL, no se asume adquisición estática.
3. Extraer ZIP de forma segura localmente sin modificar bytes/rutas relativas. En Slicer con los originales: establecer AFE_SLICER_INPUT_DIR, AFE_SLICER_AFE_JSON y AFE_SLICER_REPORT; ejecutar Slicer --no-splash --python-script research/anatheos-afe/tools/slicer_compare.py. El script obtiene matrices nativas MRML y compara 27 puntos y sus inversos, sin tomar la salida de AFE como referencia independiente.
4. Conservar versión real Slicer, build, plataforma, hashes, errores máximos/medios/p95 y rechazos. Sin ambas pruebas nativas **AFE-01 no puede cerrarse**.

Scripts: tests/test_independent_affine.py; tests/test_vtk_external.py; tests/skew_sweep_existing.mjs; tools/prepare_public_case.py; tools/slicer_compare.py. Slicer estable 5.12.4 está documentado oficialmente (septiembre 2026) pero no se ejecutó aquí.
