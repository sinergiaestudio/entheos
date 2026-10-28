# ANATHEOS 3D · B7.2 · Estación de tres vistas del MISMO estudio

**Norte UX-001. Estado experimental, sin aptitud diagnóstica.**

## Propuesta aprobada

El usuario solicitó el 28/10/2026 una estación de visualización simultánea que contenga:

1. **Corte 2D original DICOM**: editor de máscaras, dos clics para medir una distancia **plana** (mm calculados con DICOM PixelSpacing), señalización de puntos por corte, navegación de cortes, contraste y visualización de propuestas de segmentación B7.1.
2. **Volumen 3D de intensidades de la misma serie DICOM**: GPU WebGL2/CPU fallback y presets UX-N3, sin inferencias anatómicas.
3. **Mallas tridimensionales únicamente de máscaras del MISMO estudio**: STL interpolado B6.2 o voxel B6.1, vinculado a UID de serie y versión de máscara. Si no existe máscara generada, estado vacío explícito. **Prohibida la visualización del atlas SPL en el tercer panel**; ese atlas sigue disponible exclusivamente en la vista de superficies externas.

Navegación de cortes 2D actualiza automáticamente las tres **leyendas de índice y posición física de corte** de la misma serie; las cámaras 3D conservan controles de rotación/zoom independientes. **No afirmar que el plano geométrico del corte está registrado visualmente en la cámara tridimensional**: una intersección anatómica/cursor 3D–2D, picking coordinado y clipping-plane son siguientes desarrollos sujetos a validación.

El pincel manual en triple modo mantiene visible el volumen de intensidades. Al terminar un trazo se invalidan las mallas obsoletas y se solicita una nueva superficie local. Si la conversión excede los límites geométricos, no se muestra una geometría antigua y se comunica la imposibilidad.

## Tejidos más allá de lo óseo

B7.2 incorpora un catálogo de **hipótesis manuales** por región: óseo, cartílago, menisco, ligamento, tendón, músculo, adiposo, líquido articular, vasos, nervios, otro o sin identificar. **Seleccionar cualquiera no crea una máscara, no detecta tejidos ni certifica una estructura anatómica**.

La versión conserva, por compatibilidad con NRRD, volumen, shaders, máscaras y modelos previos, los **tres canales de segmentación v0.4**: Región 1, 2, 3. El descriptor de tejido es temporal, de interfaz y **no se guarda dentro del NRRD**. Esto debe advertirse antes de usarlo clínicamente. El hito siguiente aumentará el número de etiquetas con versionado de archivo, asignación de colores y auditoría de persistencia.

## Limitaciones técnicas / clínicas declaradas

- El visor 3D de intensidad **sí** deriva del DICOM cargado; no es una malla segmentada.
- Las superficies B6.2 / B7.1 son geometría real del **mapa de etiquetas** del estudio, pero su calidad depende de las máscaras, cuya anatomía no está validada.
- SPL Knee Atlas = otro espécimen; nunca se muestra como si fuera derivación de Leeds.
- Las medidas son **2D en el plano adquirido** según PixelSpacing, no volúmenes/longitudes espaciales 3D ni herramientas diagnósticas validadas.
- El índice y la posición de corte se sincronizan entre leyendas, no las orientaciones de cámara; las mallas se visualizan en su propio sistema físico LPS al compararse.
- Las tres regiones mantienen estados de visibilidad, colores, opacidad e invalidación B6/B7, sin nuevas APIs, pagos ni servicios externos.

## Verificación y operación

- DICOM sintético de seis cortes en CI, sin datos médicos ni imagen anatómica publicada: navegar 2D en triple, 3 paneles simultáneos, distancias mm, semilla/pintado, actualizar malla, procedencia y salvaguarda ante SPL.
- Windows PowerShell 5.1: verificar el grafo ES completo, HTTP 200 de cada módulo y ruta del ZIP incluido, sin subir el estudio a GitHub.
- Paquete Windows completo PRIVADO con Leeds DESS original e integridad SHA; rollback a hotfix B7.1.
- Todos los cambios en **rama experimental y PR DRAFT** basados en `anatheos/b7-1-hotfix-windows-dicom-loader`, nunca en `main` ni piloto. Sin desplegar Entheos, sin instalar software/licencias/API pagas.

## Próximos incrementos

- **B7.3:** n máscaras múltiples más allá de 3 con modelo versionado, NRRD compatible o migración controlada, colores y persistencia de etiquetas/tipos y origen.
- **B7.4:** cursor DICOM físico LPS compartido y planos seccionales reales dibujados en los 3D con coordenadas validadas en 3D Slicer.
- **B8:** segmentación anatómica de tejidos blandos basada en referencias verificadas del propio estudio, edición supervisada, medidas volumétricas y controles de calidad. No inventar anatomía ni afirmar exactitud cuando solo hay similitud de intensidades.

