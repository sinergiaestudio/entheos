# ANATHEOS 3D — Registro verificable de hitos

## 2026-10-26 · P1A, lector DICOM experimental (en rama)

**Repositorio:** `sinergiaestudio/entheos`  
**Rama:** `feature/anatheos-3d-owner-pilot`  
**Revisión técnica borrador:** https://github.com/sinergiaestudio/entheos/pull/5  
**Despliegue:** ninguno. No se fusionó a `main`.

### Implementado en código (no probado clínicamente)

- Lectura en memoria del navegador, sin `fetch` ni transferencia de archivos desde este módulo.
- Carga múltiple de DICOM Part 10 con transfer syntax Little Endian explícita o implícita, sin compresión; píxeles monocromáticos de 8/16 bits; un fotograma por archivo.
- Agrupación por StudyInstanceUID y SeriesInstanceUID; validación básica de identificadores, orientación, espaciado, dimensiones, datos de píxel y duplicaciones.
- Rechazo de transferencias comprimidas, series volumétricas incompatibles, espaciado irregular, desplazamientos en plano y formatos fuera del alcance.
- Ordenamiento de cortes por posición geométrica y normal al plano.
- Exploración axial y planos ortogonales simples en series axiales alineadas a ejes del paciente. Series oblicuas sólo permiten vista original.
- Control de ventana/centro e inversión para `MONOCHROME1`.
- Protección del acceso al módulo con identidad autenticada y condición `isGlobalAdmin` del servidor de Entheos. **El despliegue y el control de acceso efectivo están pendientes de pruebas.**
- Límites de entrada 600 archivos / 32 MB individual / 320 MB total. Todos los ejemplos automatizados son sintéticos.

### Archivos de la rama

- `app/app/anatheos-3d/page.tsx`: página owner-only.
- `components/anatheos/dicom-browser.tsx`: selección local y visor.
- `lib/anatheos/dicom.ts`: decodificación experimental acotada, geometría y windowing.
- `tests/anatheos-dicom.test.mjs`: pruebas sintéticas de píxeles, geometría y rechazos.

### Pruebas automáticas

- CI GitHub Actions, ejecución 11, SHA `4af1555a984d042fe35641a604500dbc69907d95`: **PASS** (instalación, lint, TypeScript, compilación y tests; obtenido del estado de workflow).
- Ejecución 12 sobre SHA `4d5820dc3460607949e90e62fe59d9007fbc3b03`: consultar estado antes de declarar PASS.
- Todavía **no** hay ensayo interactivo en navegador ni verificación contra 3D Slicer.

### Restricciones técnicas actuales

1. No maneja JPEG/JPEG2000, RLE, DICOM multiframe, secuencias de longitud indefinida, color, archivos sin preámbulo ni geometrías complejas. Se rechazan explícitamente.
2. La reconstrucción ortogonal es muestreo directo por índice y sólo para series axiales alineadas; no sustituye un resampler clínico. Presentación radiológica y comparación anatómica todavía pendientes de validación.
3. No hay renderizado volumétrico 3D, mallas anatómicas, segmentación ni exportación. No sugerir que existen.
4. Las imágenes permanecen en memoria hasta que se abandona o recarga la página. No hay almacenamiento clínico persistente del módulo.
5. El repositorio es público; no usar DICOM ni datos personales reales como fixtures.
6. No se usó ni contrató ninguna API, licencia o servicio de procesamiento pago.
7. No hay URL de Site piloto desplegada ni verificada: la rama GitHub no es un ambiente aislado por sí sola.

### Próximo hito P1B

- Contrastar con series DICOM abiertas y desidentificadas, con referencia 3D Slicer.
- Evaluar integración con Cornerstone3D + `dicom-image-loader` para transfer syntaxes y geometrías compatibles, cuidando compatibilidad y licencias.
- Resampling verdadero para cortes oblicuos, mejoras de manejo de memoria, errores no bloqueantes y controles de orientación.
- Renderizado volumétrico con tecnología abierta (Cornerstone3D/vtk.js); no improvisar una imagen aparentemente 3D sin fidelidad anatómica.
- Crear entorno de vista previa **independiente** con autenticación owner-only y datos ficticios, sin afectar Entheos productivo.

**Regla de aceptación:** cada paso debe indicar por separado `codificado`, `probado automáticamente`, `probado visualmente`, `desplegado`, `validado geométricamente` y `validado clínicamente`.
