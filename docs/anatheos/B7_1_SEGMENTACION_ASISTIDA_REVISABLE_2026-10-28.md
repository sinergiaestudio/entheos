# ANATHEOS 3D · B7.1 · Propuesta local de regiones 3D por semilla e intensidad

**Fecha: 2026-10-28 · rama experimental sin merge ni deploy · no diagnóstico.**

## Alcance realmente implementado

- El operador indica **una semilla sobre el corte DICOM activo**, regula la tolerancia absoluta de intensidad (en unidades escaladas del DICOM, no Hounsfield ni etiquetas anatómicas) y el radio máximo en **milímetros físicos**.
- Un algoritmo local de **crecimiento de región conectada en 3D, 6 vecinos**, evalúa exclusivamente los valores DICOM originales tras slope/intercept. Usa la geometría validada del propio estudio, incluyendo espaciado distinto en los tres ejes.
- La **propuesta queda separada de la máscara original** y se muestra superpuesta en **cian** sobre los cortes para su revisión. El usuario puede recorrer varios cortes, modificar parámetros, volver a proponer o descartar sin cambiar la segmentación.
- Solo una aprobación expresa incorpora los vóxeles a la etiqueta manual seleccionada; se conservan las regiones de otras etiquetas. La aceptación puede generar automáticamente la **malla B6.2** continua de la máscara aceptada, en LPS milímetros, que se muestra con controles reales de capa.
- Cuando cambian los parámetros, la máscara o el estudio, una propuesta pendiente se invalida. Las mallas aceptadas dejan de estar válidas si luego se modifica la máscara.
- El algoritmo **no** clasifica fémur/tibia/cartílago/meniscos, no utiliza atlas externo ni interpreta una intensidad como anatomía. No hay aprendizaje profundo ni un modelo automático de segmentación de rodilla.

## Límites y seguridad

- Radio 2–50 mm (interfaz 3–35 mm); tolerancia de 0 a 10000 unidades escaladas DICOM (interfaz 0–500).
- Máximo 1.000.000 de celdas de búsqueda en ROI local por propuesta, 90.000 vóxeles aceptables, 1.000.000 candidatos evaluados; las propuestas excesivas **fallan totalmente**. No hay máscara parcialmente aplicada ni aceptación automática.
- Una propuesta no puede sobrescribir otras etiquetas y se verifica contra la misma forma de cuadrícula antes de aplicar.
- El volumen DICOM original y los metadatos se mantienen intactos. Todo el procesamiento ocurre en el navegador local, sin nuevas licencias, aplicaciones, APIs o servicios pagados.
- Estado de evidencia: proponer una región conectada de similar intensidad es una **herramienta de segmentación asistida**, no un procedimiento que identifique automáticamente estructuras anatómicas. La forma depende críticamente de la semilla, contraste, tolerancia y conectividad; puede capturar otras zonas de intensidad parecida.

## Revisión y aceptación

1. Abrir el estudio DICOM y activar Controles avanzados.
2. Pulsar **Elegir semilla en el corte**, seleccionar sobre un corte y ajustar tolerancia y radio.
3. Pulsar **Preparar propuesta**, inspeccionar la superposición cian sobre **varios cortes**, cambiar parámetros y repetir o descartar si hay extravasación.
4. Pulsar **Aceptar y mostrar 3D** solo después de revisar; la propuesta pasa a máscara manual, se calcula la superficie 3D B6.2 de la misma serie y se mantiene la etiqueta **SIN validar**.
5. Comparar máscara 2D/NRRD y STL en 3D Slicer antes de cualquier afirmación anatómica. Revisar desbordes, conexiones artificiales y orientación física LPS.

## Pruebas de ingeniería

- Unitarias: 6-conectividad, ausencia de islas desconectadas, radio anisótropo en mm, preservación de máscara antes de aceptar, etiquetas ajenas sin sobrescritura, fallo atómico para propuestas incompatibles o grandes.
- Browser con DICOM **sintético**: elegir semilla, crear y descartar propuesta sin modificar máscara, repetir, aceptar de forma explícita y visualizar malla continua LPS de la misma serie sin peticiones externas.
- Suite heredada B6.2 y lector Windows PowerShell 5.1 sin regresión.

## Próxima fase B7.2

Metodología de validación contra segmentaciones de referencia de **la misma RM**, revisión por profesionales y métricas Dice/IoU y distancias de superficie antes de identificar etiquetas fémur/tibia. No inventar resultados anatómicos, sensibilidad ni precisión.

**Rollback:** B6.2 commit `ebd08f8f6e7be358d32387dbdcf3e76a145928ad`, PR #51. Trabajo en `anatheos/b7-1-reviewed-3d-seed-segmentation`, PR nuevo en borrador; prohibidos merge a main/piloto y cambios Entheos producción sin autorización.