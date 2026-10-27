# ANATHEOS 3D · Decodificación RLE Lossless y frames múltiples en Chromium

**Fecha local:** 26/10/2026 · **Issue:** #8 · **PR:** #32 (DRAFT) · **Base:** rama experimental `anatheos/issue-8b-chromium-dicom-decode` (PR #31). **No fusionado a piloto ni a `main`.**

## 1. Resultado funcional comprobado

[GitHub Actions #40429001197](https://github.com/sinergiaestudio/entheos/actions/runs/40429001197), SHA `06ed4c38325cffdf63b1e2a5b5918c03276371c6`, job `cornerstone-isolated-build`: **COMPLETED/SUCCESS**, incluyendo:
- Instalación OSS efímera de Cornerstone3D/loader 5.13.1 y Playwright/Chromium; sin modificación de dependencias ni lockfile de Entheos.
- Compilación aislada Vite y compilación temporal cliente con Vinext/Cloudflare Worker, **sin deployment**.
- **3/3 pruebas del generador RLE** (Part10, PixelData encapsulado de longitud indefinida, RLE header 64 bytes y Basic Offset Table para dos fragmentos).
- **6/6 casos de carga/decodificación reales en Chromium**, incluidos los tres previos sin comprimir: Explicit VR LE CT axial, Implicit VR LE CT axial (advertencia de parser conservada), Explicit VR LE CT oblicua, RLE Lossless CT synthetic single-frame, RLE Lossless CT frame 1/2 y RLE Lossless CT frame 2/2.
- **Valores exactos verificados:** en frame 1 `[100,101,102,110,111,123]` → reescalado `[-900,-899,-898,-890,-889,-877]` con slope=1/intercept=-1000; frame 2 `[200,201,202,210,211,223]` → `[-800,-799,-798,-790,-789,-777]`. Cada cuadro contiene 3×4 píxeles. La prueba contrasta muestras de píxel crudas **antes del reescalado** y calcula la transformación de intensidad por separado, no infiere HU clínico por la etiqueta CT.
- Los tres nuevos archivos fueron creados **enteramente en memoria** desde datos y UIDs sintéticos; no se descargaron estudios de pacientes ni se usaron servicios DICOMweb. El navegador rechazó tráfico de origen externo; se comprobó retiro de `fileManager` y de la entrada cache cargada por cada cuadro.
- [CI general #40429001245](https://github.com/sinergiaestudio/entheos/actions/runs/40429001245), mismo SHA: `completed/success`, **60/60 PASS, 0 FAIL/SKIPPED/CANCELLED**, instalación, lint/TypeScript/build PASS.

**Límite de evidencia:** decodificación real, pero sobre corpus sintético mínimo; no se ha confirmado conformidad DICOM integral ni equivalencia de imágenes médicas reales.

## 2. Archivos y diseño de la prueba

- `spikes/anatheos-cornerstone/synthetic-rle.mjs`: generador PS3.5 RLE de plano alto/bajo para píxeles 16-bit y elementos DICOM encapsulados; frame header de 64 bytes con dos segmentos PackBits y tabla básica de offsets para seleccionar fragmentos.
- `spikes/anatheos-cornerstone/synthetic-rle.test.mjs`: comprueba estructura del encapsulado y el offset del segundo fragmento; **no certifica un IOD completo ni decodificación por sí solo**.
- `spikes/anatheos-cornerstone/chromium-verify.mjs`: la prueba de navegador reutiliza `makeSyntheticRle` y exige valores de pixel, slope/intercept y selección de `?frame=1/2`, además de mantener los checks previos de LPS/RAS axial y oblicuo.
- `spikes/anatheos-cornerstone/main.js`: selector **solo de la demo de CI**, a partir de nombre sintético terminado en `-frameN.dcm`; remoción de la referencia `dicomfile:` según índice, incluso con query `?frame=N`.
- `.github/workflows/anatheos-cornerstone-spike.yml`: nueva verificación estructural RLE antes del ensayo en Chromium, sin pasos de publicación.

## 3. Matriz de soporte ANATHEOS (estado comprobado)

| Sintaxis / contenido | Observación | Interpretación |
|---|---|---|
| Explicit VR Little Endian CT sintética | **Decodificado en Chromium** | Solo casos inventados, single-frame |
| Implicit VR Little Endian CT sintética | **Decodificado con advertencia** `Invalid vr type ox - using OW` | Distinguir warning de resultado; conformidad IOD sin auditar |
| RLE Lossless (1.2.840.10008.1.2.5), un frame | **Decodificado en Chromium** | Píxeles exactos; no prueba más configuraciones de RLE |
| RLE Lossless, dos frames encapsulados | **Frame 1 y frame 2 decodificados con valores distintos y correctos** | **No** constituye soporte demostrado de Enhanced CT/MR: el fixture mantiene un SOP Class de CT clásico y no incluye grupos funcionales Enhanced per-frame |
| JPEG baseline/lossless, JPEG-LS, JPEG2000, HTJ2K, JPEG XL | **NO PROBADOS** | No inferir compatibilidad de compresión a partir de RLE |
| RM, pixeles signed, Enhanced multiframe IOD | **NO PROBADOS** | Requiere nuevos fixtures conformes y validación independiente |
| Geometría LPS/RAS oblicua | **PASS contra oráculo interno** del PR #31 | **NO** validado contra 3D Slicer ni orientación clínica |
| Cancelación, peak RAM, liberación WASM/GC | **NO PROBADOS** | El código descarta resultados stale y elimina referencias; no acredita interrupción del trabajo en worker |
| Licencias transitivas/binarios WASM | Inventario previo 88 paquetes / 9 WASM | `rechoir` mantiene licencia declarada `UNDECLARED`, faltan avisos/certificación de redistribución |
| Seguridad Sites, G1B con flag ON y D1/R2 aislados | **BLOCKED** | Ningún Site activado |

## 4. Diferencias DICOM importantes y próximos requisitos

1. **Multi-frame comprimido no es sinónimo de Enhanced CT/MR conforme.** Este fixture comprueba exclusivamente que un lector puede extraer dos codestreams RLE encapsulados mediante BOT y decodificar sus valores. En Enhanced CT/MR deben verificarse SOP Class UIDs específicos, Shared y Per-frame Functional Groups, orientación, posición, dimensiones y transformaciones por frame, antes de presentarlo como compatible.
2. La implementación es **experimental y client-only**. Cornerstone **no** reemplazó `lib/anatheos/dicom.ts` ni el visor P1A. No se hicieron merges ni cambios en productos o datos compartidos.
3. Preparar un siguiente fixture RLE con casos de BytesStored/BitsStored/signed, y otro con JPEG-LS/JPEG2000 **solo** si se logra un generador local OSS verificable, sin material médico externo.
4. Medir picos de heap JS + memoria WASM y ejecutar ciclo repetido de carga/limpieza. Corroborar GC solo como tendencia con condiciones controladas, nunca asumir liberación inmediata.
5. Comparar la geometría en 3D Slicer instalado localmente con **datasets sintéticos IOD válidos**, registrar versión y hashes; no declarar equivalencia hasta una comparación independiente PASS.

## 5. Gobierno y decisión pendiente

**PR #32 queda DRAFT con destino al PR #31 (no piloto).** La autorización actual cubre investigación, no adopción definitiva de paquetes, servicios pagos, fusión, activación de flag, despliegue ni procesamiento de estudios reales. [Issue #8](https://github.com/sinergiaestudio/entheos/issues/8) continúa abierto. Dirección puede auditar tanto código como CI y debe aprobar cualquier integración posterior por separado.

**Checkpoint documental:** esta acta se incorporó después del SHA de la primera CI; la ejecución sobre el nuevo HEAD documental se identifica en el comentario final del PR #32 y del Issue #8.
