# ANATHEOS 3D · Spike OSS Cornerstone v5.13.1 · Issue #8

**Fecha:** 26/10/2026. **Estado:** prueba técnica de instalación y bundle, separada del producto estable. **No es sustitución del lector P1A ni autorización de uso clínico, remoto o de dependencias definitivas.**

## 1. Origen/versiones y licencias declaradas

- Upstream oficial `cornerstonejs/cornerstone3D`, tag **`v5.13.1`**. En el tag, `packages/dicomImageLoader/package.json` (blob `30c956116b217886c2e3df912b97f56c97215dcc`) declara `@cornerstonejs/dicom-image-loader 5.13.1`, MIT, y dependencias a CharLS, libjpeg-turbo, libjxl, openjpeg y openjph, `dicom-parser` y `comlink`.
- `packages/core/package.json` del mismo tag (blob `856cb16de72f556d50e9bfe600a600f3272d7988`) declara `@cornerstonejs/core 5.13.1`, MIT, usando `@kitware/vtk.js`. El tag upstream es una referencia de código; los paquetes de npm y sus licencias/bundles deben inspeccionarse **tras instalación real**.
- Según [documentación oficial de image loaders](https://www.cornerstonejs.org/docs/concepts/cornerstone-core/imageloader/), la biblioteca puede leer `File` DICOM local, imágenes multiframe y formatos WADO. **ANATHEOS no declara soporte de TC, RM, comprimidos, multiframe ni WADO** sin pruebas de casos por versión, IOD y sintaxis.
- Según [guía oficial de compatibilidad Vite](https://www.cornerstonejs.org/docs/getting-started/vue-angular-react-etc/), los codecs WASM requieren resolver assets y evitar optimización esbuild del loader. Se configura `optimizeDeps.exclude` en el **spike**, sin alterar el `vite.config.ts` del producto. Vite client bundle no equivale a build Vinext/Cloudflare Workers.
- **Pendiente obligatorio:** revisión de licencias transitorias y de cada binario WASM (la licencia npm/MIT de wrapper no garantiza que todo codec interno cumpla uso previsto), listado de avisos y obligaciones distributivas, SBOM, tamaño de bundle y ausencia de tráfico a servidores externos.

## 2. Prototipo aislado implementado

- `spikes/anatheos-cornerstone/index.html`: entrada local visible, no publicada.
- `spikes/anatheos-cornerstone/main.js`: importación explícita de `@cornerstonejs/core` y `@cornerstonejs/dicom-image-loader`, inicialización en navegador, un solo `File` de hasta 32 MiB, registro `wadouri.fileManager.add`, llamada `loadAndCacheImage`, retirada de `cache` y `fileManager`. Es **prueba de API de integración**; no incorpora ninguna dependencia al runtime estable de Entheos ni implementa MPR, diagnósticos ni volumen.
- `spikes/anatheos-cornerstone/vite.config.mjs`: build Vite aislado con assets WASM, no participa del Worker productivo.
- Workflow `.github/workflows/anatheos-cornerstone-spike.yml`: en PR propio y paths del spike, usa npm público y paquetes exactos 5.13.1 **solo en CI efímera** con `--no-save --package-lock=false`; verifica manifiestos/codec y produce bundle cliente, controlando `git diff --exit-code -- package.json package-lock.json`. **No constituye lockfile reproducible definitivo**; no se instala en el producto.
- `audit.mjs` registra licencias declaradas de paquetes directos y codecs, y presencia de artefactos WASM. **No certifica el árbol transitivo completo**. Los resultados reales del workflow quedan a verificar en SHA final.

## 3. Matriz de capacidad: evidencia exigida

| Característica | Plan de prueba | Estado al abrir spike |
|---|---|---|
| Compilación Vite/esm en cliente | Build de spike con paquetes 5.13.1, bundling worker/WASM | **CI pendiente** |
| Compatibilidad Vinext/Workers | Integración futura aislada con `client-only`, `ssr`/RSC sin cargar módulos browser en Worker | **BLOCKED/no probado** |
| TC (single-frame mono 16-bit) | Serie sintética Part10 + ground truth; comparar pixeles y HU/rescale | **No ejecutado** |
| RM (single-frame) | IOD sintético RM que 3D Slicer acepte; revisar spacing/orientación y rescale | **No ejecutado** |
| JPEG / JPEG-LS / JPEG2000 | Test por sintaxis, codec específico, fixture sintético legal y decode/invalid cases | **No ejecutado** |
| Multiframe Enhanced CT/MR | IOD conforme, per-frame functional groups y metadata geometry | **No ejecutado** |
| Orden de cortes y lateralidad | LPS/RAS, normal, `ImageOrientationPatient`, `ImagePositionPatient`, slice spacing y comparación Slicer | **No ejecutado** |
| Cancelación | AbortSignal cooperativo y cancelación/cleanup reales del worker; descartar respuestas tardías | **No ejecutado** |
| Memoria residente | Repetir series y descartar cache/worker; heap/peak y navegador de recursos limitados | **No ejecutado** |
| Privacidad | Prohibir WADO/URL externa; `File` local solo con autorización | Arquitectura preparada, no auditada en navegador |

## 4. Metodología Slicer y aceptación G2/G3

1. Generar `tests/fixtures/anatheos` sin PHI **fuera** del árbol Git para exportar archivos de prueba; registrar hash, matriz `ImageOrientationPatient`, `ImagePositionPatient`, PixelSpacing, SliceThickness/SpacingBetweenSlices y pixel transform.
2. Importar el caso manualmente en 3D Slicer. Registrar versión exacta, mensajes de rechazo/advertencia, representación de volumen, dirección LPS y conversión RAS. No modificar fixtures para forzar su aceptación; si no son IOD válidos, anotar rechazo y crear IOD de prueba adecuado.
3. Comparar posición de voxel central y esquinas, sentido de cada eje, lateralidad, spacing y ubicación de volúmenes. Establecer tolerancias numéricas **antes de medir**.
4. Exigir que el mismo DICOM sintético obtenga equivalentes geométricos en Slicer y Cornerstone. El software seguirá como **no diagnóstico**; validación geométrica sintética no basta para validar uso clínico.
5. No iniciar renderizado volumétrico ni segmentación hasta G2 decoder + G3 MPR con oráculo independiente.

## 5. Costos, límites y decisión

**Cero nuevas suscripciones o servicios pagos.** npm/GitHub OSS en job efímero sin guardar DICOM reales; **no** modifica `package.json`, `package-lock.json`, Site, `main`, piloto, D1/R2 ni reglas GitHub. No se fusionará el PR de spike sin autorización futura. Issue #8 continúa abierto.

**Condición para migración definitiva:** licencia/transitivos aprobados, lockfile generado reproduciblemente, prueba Vinext/Workers de client-only, decodificación CT/MR multiframe/comprimidos según matriz, rendimiento y Slicer. No es autorización actual para instalar en la aplicación.
