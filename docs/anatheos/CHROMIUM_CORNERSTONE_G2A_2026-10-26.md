# ANATHEOS · G2a-C · Primera decodificación Cornerstone comprobada en Chromium

**Fecha:** 26/10/2026 · **Issue:** #8 · **Branch:** `anatheos/issue-8b-chromium-dicom-decode` sobre PR #30, **NO** sobre piloto ni `main`. PR #31 en borrador. **No diagnóstico; solo DICOM sintéticos.**

## 1. Alcance de la implementación

- `spikes/anatheos-cornerstone/main.js` importa `@cornerstonejs/core` y `@cornerstonejs/dicom-image-loader` versión **5.13.1** en cliente; añade `File` local a `wadouri.fileManager`, invoca `imageLoader.loadAndCacheImage` realmente y obtiene píxeles por `getPixelData()`. Se deshabilitó preescalado dentro del loader para contrastar valores raw de 16 bits con el fixture.
- El informe del navegador registra filas, columnas, seis muestras, transformaciones aplicadas en el test (`raw*slope+intercept`), `imagePlaneModule` (IPP, cosenos, spacing), duración y `performance.memory.usedJSHeapSize` si Chrome lo permite.
- `discard()` invalida la generación activa, elimina referencias de cache y `fileManager`; **la eliminación de una referencia NO garantiza que se haya liberado memoria WASM o heap** ni cancela activamente una decodificación ya iniciada.
- `chromium-verify.mjs` usa **Chromium real headless 141** mediante Playwright, servido exclusivamente desde un **bundle estático Vite ya compilado** en `127.0.0.1`. Se cargan DICOM Part 10 inventados por `makeSyntheticDicom` sin archivos médicos reales; se rechaza cualquier solicitud de red externa.
- `.github/workflows/anatheos-cornerstone-spike.yml` instala gratis paquetes OSS en runner efímero con `--no-save --package-lock=false`, corre build Vite y build Vinext/Worker con ruta temporal, luego instala Chromium y ejecuta las verificaciones. `package.json`, `package-lock.json`, visor P1A y producción no se modifican.

## 2. Pruebas reales efectuadas: diferenciar resultados

| Iteración / fuente | Resultado observado | Límite |
|---|---|---|
| Primera ejecución navegador, [CI #40417857061](https://github.com/sinergiaestudio/entheos/actions/runs/40417857061) | **FAIL:** Vite dev sirvió módulo JPEG turbo sin exportación `default`; el script de la app ni se inicializó. | No fue error de píxeles; se corrigió sirviendo el bundle estático con `vite preview`, no Vite dev |
| [CI #40418651758](https://github.com/sinergiaestudio/entheos/actions/runs/40418651758) SHA `6e3670d89de6366dceb89fc356e65113061abcd1` | **PASS real**: DICOM CT sintético Explicit VR Little Endian, 3×4 píxeles. Muestras `[200,201,202,210,211,223]`; slope `1`, intercept `-1000`; intensidad calculada `[-800,-799,-798,-790,-789,-777]`. Tiempo en ese runner **101,6 ms**, heap JS observado **15.215.344 bytes**, sin solicitudes externas ni errores JavaScript. | Sólo un caso inventado, sin conformance DICOM externa |
| [CI #40419609025](https://github.com/sinergiaestudio/entheos/actions/runs/40419609025) SHA `203f8fefa6ff2398c9a3d0b459304c9b3406bb96` | **Dos decodificaciones logradas**: Explicit LE y también Implicit VR LE (muestras 100–123, slope/intercept exactos). El build completo **terminó en FAIL** porque un `console.error` de dicom-parser (`Invalid vr type ox - using OW`) fue capturado en la prueba del fixture implícito. | No ocultar advertencia; fixture mínimo sintético aún no certificado DICOM IOD, resolver/aceptar explícitamente el diagnóstico en CI posterior |
| Paso de browser/CI más reciente | Pendiente de resultado del HEAD definitivo del PR #31 | No inferir PASS sin leer Actions |

**Primer éxito funcional reproducible:** la imagen realmente pasó por el decodificador y devolvió muestras y metadatos dentro de Chromium. **No** es solo compilación, ni validación clínica, ni convierte al lector P1A en Cornerstone.

## 3. Datos geométricos preliminares (no oráculo independiente)

Para el primer caso axial sintético, la metadata `imagePlaneModule` de Cornerstone recuperó `ImagePositionPatient LPS=[10,20,30]`, `rowCosines=[1,0,0]`, `columnCosines=[0,1,0]`, `rowPixelSpacing=2 mm` y `columnPixelSpacing=3 mm`. Esto demuestra lectura de esos atributos en el fixture, **no prueba que una reconstrucción 3D/MPR respete lateralidad o posicionamiento real**.

Protocolo para 3D Slicer cuando se disponga de la herramienta local y de fixtures IOD íntegros:

1. Exportar la misma serie 100% sintética a DICOM Part 10; registrar SHA256/transfer syntax/UID sintéticos y versión de Slicer.
2. Importar en 3D Slicer sin transformaciones manuales, registrar errores/rechazos de IOD, orientación e `IJKToRAS` del volumen. Un rechazo explícito significa **NO VALIDADO**, no una causa para modificar la referencia.
3. Calcular coordenadas de voxel por PS3.3 desde IPP/IOP/PixelSpacing y orden Z (LPS); convertir a RAS con `[-L,-P,S]`. Verificar centros y ocho esquinas por muestra comparando `IJKToRAS` y convenciones DICOM de filas/columnas.
4. Propuesta previa de tolerancias para geometría sintética válida: 0,01 mm en centros/esquinas, `1e-6` por coseno de orientación; HU de enteros sin compresión deben coincidir exactamente. Dirección debe aceptar tolerancias y protocolo antes de declarar geometría válida.
5. Para oblicuos, invertir normal, inclinación de gantry y gaps irregular: registrar si Slicer rechaza/advierte o crea volumen con correcciones. No omitir esos casos ni inferir equivalencia de fixtures mínimos no conformes.
6. Cualquier 3D volumétrico/segmentación sigue bloqueado hasta estabilizar geometría y memoria.

## 4. Licencias y binarios: inventario técnico

- `spikes/anatheos-cornerstone/transitive-sbom.mjs` recorre **dependencias runtime y peer efectivamente instaladas** desde cuatro paquetes Cornerstone 5.13.1, inventariando versión, licencia declarada, avisos LICENSE/NOTICE y SHA256/tamaño de archivos WASM. Salida JSON en runner CI y artefacto GitHub Actions, sin código clínico.
- [CI #40419609025](https://github.com/sinergiaestudio/entheos/actions/runs/40419609025): **88 paquetes inventariados; 0 dependencias runtime sin resolver; 9 archivos WASM, total 5.597.616 bytes.** Uno tiene licencia **UNDECLARED** en su manifiesto npm (`rechoir`): requiere inspeccionar su archivo licencia/distribución. Es un hallazgo de auditoría, no autorización de adopción.
- Licencia MIT/ISC/BSD declarada de los codecs directos, pero siguen pendientes auditoría jurídica completa de avisos, binarios WASM/fuentes nativas, patentes pertinentes y lockfile fijo para reproducción final.
- **No se contrató ningún servicio pago, ni se agregaron paquetes persistentes al producto**. El tamaño de binarios y advertencias de `fs`/`path` externalizados siguen requiriendo runtime positivo por sintaxis, no solo bundle.

## 5. Matriz funcional todavía pendiente

| Frente | Estado |
|---|---|
| CT inventado Explicit VR Little Endian | **Decodificado en Chromium, muestras/HU correctas** |
| CT inventado Implicit VR Little Endian | Decodificado con valores correctos; **advertencia de parser bajo investigación**, no conformance IOD |
| RM, rescale específico, signed pixels | Pendiente |
| JPEG, JPEG-LS, JPEG2000, HTJ2K, JPEG XL | Pendiente de fixture comprimido sintético conforme y runtime WASM real |
| Multiframe Enhanced CT/MR | Pendiente de IOD conforme y frames múltiples |
| Cancelación de operación in-flight | Generación stale protegida en UI experimental; **no se ha probado cancelación real de worker/WASM** |
| Liberación de recursos | `fileManager.remove` y remoción de cache verificadas como llamadas; **no se verificó memoria nativa liberada** |
| Memoria/performance | Observación puntual JS heap, no perfil de pico, GC ni pruebas repetidas de estrés |
| Slicer geométrico independiente | Protocolo listo, **comparación no ejecutada** |
| Seguridad G1B/proxy/aislamiento D1/R2 | Sigue BLOCKED para Sites, sin relación con este laboratorio local |

## 6. Gobierno y próximas decisiones

PR #31 es **DRAFT cuyo destino es la rama de SPIKE del PR #30**, no la rama piloto ni main. El objetivo inmediato es cerrar la regresión Chromium sin ocultar diagnósticos, después ampliar casos controlados en una rama experimental. La adopción definitiva de Cornerstone en Entheos requerirá otra decisión de Dirección basada en codecs, privacidad, costos, licencias, memoria, validación geométrica y protocolo regulatorio. No subir DICOM de pacientes a repositorio público.
