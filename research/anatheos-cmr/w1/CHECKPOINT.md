# ANATHEOS W1 · ingesta unificada desde ZIP original

Fecha: 31/10/2026 (America/Argentina/Buenos_Aires)  
Rama base auditada: `anatheos/cmr-r3-mainapp-integracion-survey-2026-10-31`  
SHA base: `b2b526e6fb5220920979e9a0a967bf3edcf68e3a`

## Alcance implementado

- Una selección del ZIP DICOM original desde la interfaz CMR de ANATHEOS.
- Transferencia exclusivamente al servicio loopback de la misma computadora.
- Reutilización del inventario, clasificación y decoder JPEG2000 lossless de CMR-R2.
- Trabajo temporal aislado por UUID, progreso genérico sin PHI, cancelación y eliminación al cerrar.
- Catálogo de series y navegación 2D/cine existentes de CMR-R3, sin alterar geometría ni atribuir sincronía 4D.
- Vía de carpeta CMR-R2 preservada únicamente como recuperación y QA.

## Evidencia

- `test_w1_original_zip.py`: PASS sintético de extremo a extremo, ZIP original con JPEG2000 lossless, 2 series/6 imágenes, catálogo, visualización 2D, ignorado seguro de ejecutable auxiliar y limpieza al cerrar.
- Regresión CMR-R3: PASS sintético, SURVEY 3 orientaciones × 20 posiciones, cine elegible, zoom y 0 errores JavaScript.
- Prueba privada autorizada mediante la nueva API loopback: 24/24 series y 1.318/1.318 imágenes preparadas; no se imprimieron ni publicaron identificadores, geometrías o píxeles. Los temporales se eliminaron al finalizar.
- Baseline previo `b2b526…`: 20/20 workflows GitHub Actions en estado `success` verificado antes de crear la rama.

## Límites y estado de aceptación

- Estado: `CODIFICADA`, `TEST SINTÉTICO PASS`, `TEST CON DATOS REALES PASS` para ingesta y catálogo.
- La prueba privada real de esta ejecución verificó el recorrido ZIP → catálogo, no una aceptación visual humana de las 1.318 imágenes.
- `PRUEBA WINDOWS FÍSICA`: pendiente.
- Distribución Windows autónoma con runtime/dependencias: pendiente de W4; este incremento no declara instalación lista para el titular.
- Matriz común W2, comparación 3D Slicer, despliegue y validación clínica: pendientes.
- No se modificaron `main`, el piloto original, producción, permisos ni Sites.

## Rollback

Eliminar/revertir los commits W1 sobre la rama de integración. El SHA base `b2b526…` permanece intacto y la vía de carpeta preparada de CMR-R3 no fue eliminada.
