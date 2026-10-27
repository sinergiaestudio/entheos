# ANATHEOS 3D · Checkpoint B2 — atlas SPL genuino (27-10-2026)

**Investigación local no diagnóstica. PR DRAFT. SIN MERGE / SIN DEPLOY / SIN DICOM NI MODELOS EN REPOSITORIO PÚBLICO.**

## Avance tangible
- Primera ejecución automatizada de **mallas anatómicas originales** `Models/STL/femur-95.stl` (328.956 triángulos) y `Models/STL/tibia-96.stl` (266.884 triángulos) en el visor WebGL2 v0.5; sin derivar las superficies del estudio Leeds.
- Prueba: selección/visibilidad, aislamiento, opacidad, color, rotación real de geometría y ausencia de errores JS y solicitudes externas desde el navegador.
- Etiqueta 95 (fémur): **1.838.598 vóxeles**; etiqueta 96 (tibia): **1.190.880 vóxeles** en la máscara del atlas. 49 códigos no nulos, 48 identificados por tabla; el código 3 permanece desconocido.
- Dimensiones: 512×512×119; separaciones 0,2773402×0,2773402×1 mm; origen LPS (-70,8604;70,8604;-59).
- Comparación de cajas físicas máscara LPS versus STL interpretado RAS: máxima diferencia por eje fémur **0,6894 mm** y tibia **0,7009 mm**. Al interpretar los STL como LPS los errores crecen a 8,77 mm y 21,61 mm respectivamente. RAS es la interpretación geométricamente compatible, **no un registro formal validado por Slicer**.

## Hashes SHA-256 medidos sobre archivos auténticos
Fuente inmutable Git `lorensen/SPLKneeAtlas` commit `a033300264aec8625a56512be3865c10cdbcb61b`.
- `SPLKneeAtlasLabels.nrrd`: `3f9e2b8cdf7a969a346445ec570ebb89a2e91ad2f3719e588cf20021a4895d0d`
- `femur-95.stl`: `f14b53539fe5dba8cc3488f172e651f729e35b9b1f49eb7f695586c61d39b277`
- `tibia-96.stl`: `4b74bcbfb8b344e157253471d97ab07426a72162586d7b5011ae57aeb2acc055`

`spl-provenance.mjs` compara hashes SHA-256 al importar modelos declarados como SPL. Un archivo modificado, sintético o de otra persona **no puede identificarse como SPL sólo por su nombre**: debe utilizar «Otro estudio (sin verificar)». Se mantiene la escena separada de Leeds.

## Fuentes, licencia y custodia
- [Atlas oficial Open Anatomy](https://www.openanatomy.org/atlas-pages/atlas-spl-knee.html).
- [Repositorio original, archivos sin modificar](https://github.com/lorensen/SPLKneeAtlas/tree/a033300264aec8625a56512be3865c10cdbcb61b).
- Datos y modelos de Jen Richolt, Marianna Jakab y Ron Kikinis; Surgical Planning Laboratory, Brigham and Women's Hospital, Harvard Medical School. **Licencia 3D Slicer Part B**: https://www.openanatomy.org/atlas-pages/slicer-license.html; no uso clínico.

Los STL y el NRRD únicamente se descargaron **a almacenamiento temporal del runner**, fueron procesados sin cargarse al repositorio ni generar artefactos públicos con esos datos, y se eliminaron en el último paso de CI (también ante fallos). La CI no modifica D1/R2/Entheos ni despliega nada.

## Alcance aún NO completado
- Superposición real MRI + máscaras + mallas validada contra 3D Slicer, con métricas geométricas (Hausdorff/superficie), lateridad y correspondencia espacial específica. Las cajas alineadas **no sustituyen** esa validación.
- Flujo de importación NRRD/segmentación automática de tejidos: no implementado. Sólo superficies STL/OBJ.
- Prueba manual en Windows del titular con GPU y su distribución ejecutable: pendiente.
- El visor WebGL2 usa transparencia no ordenada por profundidad: posibles artefactos cuando objetos se solapan.
- No se aprobó merge a `main`, piloto, ni publicación.

## Próxima aceptación
Validar visualización y escala en Windows y 3D Slicer con mallas SPL oficiales descargadas separadamente. Preparar un ZIP Windows privado de v0.5 con el código de esta rama y scripts de inicio/diagnóstico antes de una nueva prueba del titular. Sin incluir estudios médicos por defecto y sin alterar Entheos productivo.
