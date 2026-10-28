# ANATHEOS 3D · B6.2 · Isosuperficies continuas de máscaras del MISMO estudio

**Fecha: 2026-10-28 · prototipo aislado · no diagnóstico · Norte UX-001.**

## Cambio comprobable respecto de B6.1

B6.1 genera cubos planos por caras externas de cada vóxel. B6.2 introduce **marching tetrahedra** sobre las etiquetas de una máscara realmente asociada al estudio DICOM activo, con interpolación de superficies entre centros de vóxel y opción de suavizado conservador por vecindad de seis direcciones.

El nuevo selector del editor ofrece dos rutas independientes y reversibles:

- **Continua · isosuperficie B6.2** (predeterminada): malla triangulada continua, método original FOSS implementado en JavaScript puro, suavizado configurable de 0 % a 30 % (15 % inicial).
- **Bloques · vóxeles originales B6.1**: resultado anterior, sin suavizado; permite cotejar los límites exactos de las celdas etiquetadas.

Ambas generan STL binario internamente, renderizado con controles de capas reales; NO hace falta descargar otro atlas, aplicación, licencia ni API. Todos los archivos se mantienen en memoria del navegador local.

## Integridad física y límites

1. Validación previa con `inspectVolumeGeometry`: matrices, ImageOrientationPatient, ImagePositionPatient, espaciamiento y regularidad entre cortes.
2. El sistema físico de cada vértice es DICOM **LPS mm**. Solo transforma índices de la cuadrícula mediante ejes y espaciados físicos de ese mismo estudio; no cambia lateralidad ni mezcla con RAS del atlas SPL.
3. El algoritmo recorta a la **caja envolvente de la máscara**, con margen de un centro de vóxel para cerrar las superficies incluso cuando una región toca el límite del volumen.
4. Un máximo de **800.000 celdas de ROI por región**, **450.000 triángulos por malla**, **850.000 por escena** y **40 MiB por STL** evita que un volumen de 512×512×N ocupe memoria descontroladamente. Ante exceso, se **rechaza** con mensaje explícito, no se reduce silenciosamente la resolución.
5. Las normales se orientan desde la parte ocupada hacia el exterior en **coordenadas físicas**, incluyendo orientaciones oblicuas. Las superficies no se calculan desde colores, representaciones artísticas, atlas ajenos ni umbrales sin confirmación del operador.
6. Toda malla porta el estado `same-study-manual`, espacio LPS mm, número de versión de segmentación y método. Se descartan mallas previas si cambia la máscara o el estudio. No hay superposición con atlas SPL de otro espécimen.

## Alcance clínico real, estrictamente limitado

**Una malla continua NO implica una segmentación anatómica verdadera.** Si el operador pintó una esfera, el resultado es una esfera más regular, NO una rótula. Si etiquetó con precisión un hueso y la máscara corresponde físicamente al estudio, la nueva malla aproxima la superficie del segmento marcado, conservando la información disponible.

La suavización mejora visualización, pero puede desplazar límites finos y alterar detalles/topología; solo se emplea para visualización experimental y requiere inspección sobre los cortes de origen. Ninguna interpolación crea resolución adquirida ni corrige una segmentación equivocada. Los meniscos/cartílago/huesos no se reconocen automáticamente. El render ámbar de UX-N3 es transfer function de intensidad, distinto de esta nueva malla.

## Validación reproducible

- Pruebas unitarias de cierre de topología (cada arista compartida dos veces), normales exteriores, coordenadas y espaciado LPS, versión suavizada comparada con original, etiquetas separadas, máscaras inválidas y limitación ROI.
- Test Chromium sobre 6 cortes DICOM matemáticamente **sintéticos**, nunca un paciente: pintar máscara, crear malla continua, comprobar procedencia y control de capas, volver al modo anterior de vóxeles.
- Preservación de toda la suite B6.1 y UX-N3, WebGL2, Windows PowerShell 5.1.
- CI descarga y empaqueta exclusivamente **código sin DICOM ni STL**. Distribución completa Windows con Leeds permanece privada, sin alterar la RM original; revisar ZIP SHA-256.
- Comparación y validación anatómica independiente con **3D Slicer** todavía pendiente; no afirmar validez geométrica para cirugía ni diagnóstico.

## Próximos hitos

- **B6.3**: inspección del STL y NRRD en 3D Slicer, métricas de distancia superficie–labelmap, exportación local con sidecar de sistema de referencia y auditoría de mallas complejas.
- **B7**: segmentación asistida realmente vinculada al estudio (controlada, editable, medible); sin modelos sintéticos ni sustitución por otro espécimen. Para superficies óseas útiles de la RM DESS Leeds se necesitan máscaras de huesos correctamente obtenidas, que hoy **no** tenemos.

Referencias técnicas: DICOM PS3.3 C.7.6.2 (IPPatient/IOP/PixelSpacing) y documentación del módulo Segment Editor/Segmentations de 3D Slicer sobre suavizado y closed surfaces.

## Versionado y restricciones

Rama `anatheos/b6-2-continuous-same-study-isosurfaces`, base exacta del hotfix de visor `9209640b277d3b41b6c3c643bd332d29736e70bf` (PR #50). Nuevo PR **DRAFT** hacia esa rama, nunca a `main` ni piloto. Sin desplegar Entheos. Rollback preciso al hotfix de v0.7. Sin licencias, servicios ni APIs de pago.
