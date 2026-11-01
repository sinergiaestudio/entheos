# AFE-01D · Matriz de validación nativa 3D Slicer sobre originales públicos

Fecha 2026-11-01. EVIDENCIA EJECUTADA, no solo plan.
Run nativo verificado: https://github.com/sinergiaestudio/entheos/actions/runs/41316484907
Artefacto de resultados (sin originales ni información personal): 13087577789, SHA256 ZIP fc128e36a8d9c3649d0a6d3aa0f4e2a8ada0e372adcf40c2a9c9d68e3426ffb9.
Slicer aplicación oficial 5.12.4, revisión de build 34645, Ubuntu 24.04 con xvfb; descarga oficial Linux amd64 475 MiB y SHA-512 ac76c5061a8fff20d4e59732855f74360930fd4891450085bcbc6a8eb1a1f4ade9a1ca4fc633142661b714dbe8c4604306079f9546e52053faa5e6f99410cf76 comprobado contra download.slicer.org. NO es paquete pip slicer ni VTK aislado.

## Matriz de resultados con originales idénticos
| Caso | RM Leeds RTKN0668 DESS | TC LCTSC TestData |
|---|---|---|
| Licencia | CC BY 4.0; DOI 10.5518/1834 | CC BY 3.0; DOI 10.7937/K9/TCIA.2017.3R3FVZ08; Zenodo 4747795 |
| ZIP bytes | 28685147 | 29183170 |
| SHA256 original verificado en descarga real | 1c378e89d3a2e7aa57a1049f1fa91b9278529e544369d1071d4c453073ce951d | 0e02554ffbf80c8c7e8f0868ec527c8ec10f7c4fd5b532c715cb3d6333676e5f |
| Imágenes DICOM | 144 | 130 |
| Matriz espacial | 384 x 384 x 144 | 512 x 512 x 130 |
| Puntos evaluados tras importación DICOM nativa | 27 | 27 |
| Max distancia mundo mm | 8.769838994876513e-12 | 9.845568954283847e-14 |
| Media distancia mundo mm | 4.091111686840484e-12 | 8.641105243735234e-14 |
| P95 distancia mundo mm | 7.698677259268428e-12 | 9.845568954283847e-14 |
| Max inversa vóxel | 2.4023759876461193e-11 | 1.632702903446565e-13 |
| Max diferencia espaciado mm | 1.2601031329495527e-14 | 4.440892098500626e-16 |
| Gate software | PASS | PASS |

Tolerancias predeclaradas en AFE-01C ANTES de estas ejecuciones: máximo mundo 0.01 mm; máximo inverso 0.0001 voxel; máximo espaciado por eje 0.001 mm. Los 27 puntos son extremos/centro en tres ejes (esquinas e interiores).
Referencia independiente obtenida de importación DICOM nativa 3D Slicer (DICOMUtils.importDicom y loadPatientByUID), matrices del nodo MRML vtkMRMLScalarVolumeNode GetIJKToRASMatrix y GetRASToIJKMatrix. Slicer NO recibe una matriz fabricada por AFE. AFE lee los tags originales de forma separada y calcula affine LPS, con conversión explícita LPS/RAS. No se importó ningún estudio clínico privado.

## Control físico original Leeds
Se recuperó directamente en entorno local aislado el ZIP original privado de Drive, SIN instalar ANATHEOS. Tamaño 28685147, SHA verificado igual al original publicado. Descompresión segura: 144 Part10 reales. Un solo Study/Series/FrameOfReference en todas, 144 SOP únicos, adquisición original coherente (GR, secuencia DESS 3D); PixelSpacing 0.36458334326744 mm, corte real 0.7000000211927595 mm, espesor declarado 0.70000004768372 mm, matriz 384×384×144, orientación oblicua. Error máximo entre posiciones originales IPP de 144 cortes y AFE affine 6.741932057361664e-12 mm. Orden calculado por proyección física IPP, no nombre de archivo ni índices. En fuentes sin marcadores temporales específicos se reporta ACCEPTED_SPATIAL_ONLY y volumen clínicamente elegible FALSE: no se infiere fase ni movimiento.

## Casuística, limitaciones y defectos corregidos
- #41315807729: descarga pública de ambos ZIP con SHA correcto pero CT rechazada por metadata ausente en CMR-R1 restringido: 130 CT con secuencias de longitud indefinida. La ruta de metadatos de CT QA se migró a pydicom==3.0.1 EXISTENTE en ANATHEOS T2-B1, solo en investigación y stop_before_pixels; ningún segundo importador del producto.
- #41315956139: Slicer oficial SHA512 PASS, lanzador falló por libxcb-icccm.so.4 faltante.
- #41316175815: Slicer oficial SHA512 PASS, SlicerApp-real falló por libpulse-mainloop-glib.so.0 faltante.
- #41316337398: diag de biblioteca faltante documentado.
- #41316484907: ambas fuentes descargadas y verificadas, ambos preflight espaciales ejecutados, Slicer 5.12.4 importó ambos DICOM originales, ambas matrices MRML comparadas PASS. No se alteraron umbrales para lograr éxito. Las bibliotecas GTK/XCB/GLib/PulseAudio usadas son gratuitas del runner Ubuntu.
- Material pendiente: atributos temporales ausentes para demostrar equivalencia de fase, validación de movimiento, igualdad de píxeles/intensidades dentro de Slicer, comparación de otras series/escáneres y frente JS (AFE-ADR-0007, issue #10). No utilizar el resultado para diagnóstico ni mezclar segmentaciones de casos distintos.

## Reproducción y gobierno
Fuentes públicas únicas: https://archive.researchdata.leeds.ac.uk/1609/6/RTKN0668_MR_DESS.zip y https://zenodo.org/records/4747795/files/LCTSC_DICOM_TestData.zip?download=1 . Se comprueba tamaño y SHA256 antes de extraer y hashes individuales antes de importación. Sin descargar colección TCIA de 5 GiB ni subir originales a GitHub. Workflow exclusivo experimental: .github/workflows/anatheos-afe01d-real-slicer.yml . Adaptadores y comparación: research/anatheos-afe/tools/prepare_public_case.py y tools/slicer_compare.py. Reportes sanitizados únicamente.
Branch experiment/anatheos-afe-engine, PR #75 permanece DRAFT. PR #74, CMR-R3, visor y producción intactos. Cualquier ascenso a AFE-02 requiere dictamen y autorización posterior de Dirección. Recomendación: aceptar el gate de fidelidad geométrica FÍSICA para estas dos fuentes originales, con límites explícitos y sin atribuir precisión clínica o equivalencia temporal.
