# ANATHEOS 3D · G2a-A — Decodificador, ingestión local y matriz de compatibilidad

**Fecha:** 2026-10-26. **Issue #8.** **Estado:** parte preparatoria implementada y pendiente de revisión; **no se reemplazó el decodificador P1A**, no se habilitó compatibilidad clínica ni una URL de prueba.

## 1. Alcance verificable de este bloque

- La única entrada de DICOM sigue siendo la selección local `FileList` del navegador. No hay endpoints ni DICOMweb activado.
- Se incorpora la frontera `lib/anatheos/dicom-intake.ts` antes del decodificador existente `parseDicom`. La UI usa exclusivamente `importLocalDicom()`, no llama directamente al parser.
- Antes de leer la totalidad del archivo se comprueban límite de cantidad y bytes y una cabecera Part 10 de **hasta 64 KiB**. Si una sintaxis de transferencia se declara no admitida, no se lee el Pixel Data completo.
- Las lecturas se serializan. Una señal de cancelación es verificada antes y después de los `await`, y ante el cambio de selección el resultado anterior se descarta. **No interrumpe físicamente una lectura `Blob.arrayBuffer()` en curso**. Esto no es garantía de un límite de memoria residente; solo existe un presupuesto máximo de archivos seleccionados.
- La interfaz informa **categorías predefinidas** y conteos, sin reflejar nombres de archivos, tags DICOM ni excepciones arbitrarias que pudieran contener PHI.
- Las instancias se agrupan por `[StudyInstanceUID,SeriesInstanceUID]`, se someten a `buildVolume` (la geometría experimental ya existente) y los volúmenes incompatibles quedan excluidos.

## 2. Matriz de sintaxis y fotogramas

| Variación | Parser P1A conectado tras preflight G2a-A | Estado real |
|---|---|---|
| Explicit VR Little Endian, monocromo 8/16 bits, un frame | Aceptación condicionada a geometría y atributos completos | Tests sintéticos; no validación clínica |
| Implicit VR Little Endian, monocromo 8/16 bits, un frame | Aceptación condicionada | No ampliar conclusión a secuencias DICOM generales |
| Big Endian | Rechazo antes de lectura íntegra | No se declara soportado |
| JPEG Baseline/JPEG-LS/JPEG 2000/RLE/HTJ2K | Rechazo por Transfer Syntax | **No hay códecs instalados** |
| Deflated Explicit VR Little Endian | Rechazo | No soportado |
| Enhanced CT/MR multiframe | Rechazo del P1A | No soportado |
| Color YBR/RGB, palette, planar, mosaics complejos | Rechazo del P1A | No soportado |
| Series axiales regulares o series oblicuas | Validación básica por IOP/IPP/spacing; oblicuas solo cortes originales | **Sin MPR física validada** |
| Discontinuidad de spacing, gantry tilt/desplazamiento en plano | Rechazo del `buildVolume` | No se remuestrea ni interpola |
| TC / RM | Transfer Syntax y atributos limitados, sin IOD especializado | **No implica cobertura de adquisición real TC/RM** |

La etiqueta de “aceptado” solo significa que el prototipo puede interpretar sus píxeles de prueba, no que el estudio sea completo, íntegro o válido para diagnóstico.

## 3. Alternativas OSS evaluadas (propuesta técnica, no decisión aprobada)

| Componente | Capacidad relevante | Riesgo de adopción y elección propuesta |
|---|---|---|
| **Cornerstone3D + @cornerstonejs/dicom-image-loader** | Carga de `File` local, multiframe, WADO, decodificadores y workers; MIT para paquete loader | **Candidato principal al spike G2a-B.** Comprobar Vite/Vinext/Workers, CSP, bundle/decodificadores WASM, APIs, licencias transitivas, descarga no intencionada, cache y memoria. No se añadió a `package.json` ni lockfile. |
| **dicom-parser** | Parser DICOM Part 10 en JS, no decodifica ni muestra por sí mismo una imagen | Útil en pruebas de conformidad/metadata; por sí solo no resuelve píxeles comprimidos ni la visualización. |
| **dcmjs** | Lectura/serialización de datos DICOM y utilidades | Evaluar como alternativa para metadatos/enhanced/multiframe; requiere integración separada de decodificación y render. |
| **Parser propio P1A** | Testeado en sintaxis y geometría restringidas | **Solo fallback provisional**, no ampliar indefinidamente; remover cuando exista reemplazo con equivalencia geométrica y regresiones. |

Referencias verificables:
- https://www.cornerstonejs.org/docs/concepts/cornerstone-core/imageloader/
- https://www.cornerstonejs.org/docs/migration-guides/2x/dicom-image-loader/
- https://www.npmjs.com/package/@cornerstonejs/dicom-image-loader
- https://github.com/cornerstonejs/dicomParser

Las licencias exactas, subdependencias y sus códecs deberán auditarse **por versión fijada** antes de incorporar el motor. “MIT” del loader no prueba automáticamente la licencia compatible de todos los binarios transitivos.

## 4. Contrato para el spike G2a-B

1. Seleccionar versión **fijada** mediante npm y lockfile generado de forma reproducible, sin editar a mano el lockfile. Verificar paquetes transitivos, Web Workers, caché y MIME de WASM en el **build Vinext**.
2. Incorporar **adapter nuevo**, no acoplar `components/anatheos/dicom-browser.tsx` directamente a APIs de importación o WADO. Seleccionar ruta decoder para cada transferencia explícitamente, sin aceptar implícitamente nuevas sintaxis.
3. Corroborar bit depth, signedness, rescale intercept/slope, fotometría y dimensiones con golden tests sobre dataset sintético de PR #23 e imágenes de referencia legalmente reutilizables.
4. Inventariar memoria, cancelación real, liberar `fileManager`, workers, datasets, caché, excepciones y buffers; verificar límites antes de cargas completas.
5. Bloquear cualquier red externa por defecto. En piloto, leer archivos locales exclusivamente; no subir a servidor, cloud, APIs o CDN.
6. Ejecutar regresiones de TC/RM y multiframe: estados **aceptado/rechazado** con evidencia por sintaxis. Ningún “soportado” sin decodificación y test positivos.
7. Presentar tamaño de JS/WASM, capacidad de CPU, WebGL fallback y tiempos sobre PC de prueba, sin prometer producción.

## 5. Pruebas y limitaciones G2a-A

`tests/anatheos-intake.test.mjs` prueba archivos fabricados en memoria: rechazo temprano de JPEG por su UID declarado, archivo truncado, presupuesto antes de leer, progreso, agrupación, geometría incompatible, contenido sensible simulado no repetido en errores y cancelación cooperativa.

- **No se ejecutaron tests con archivos clínicos** ni con terceros. No existe aún la suite integrada del PR #23 en esta rama, pues PR #23 es paralelo y está en draft.
- No se ejecutó 3D Slicer. Sin validación física o clínica.
- El proceso actual utiliza `file.arrayBuffer()`; existe riesgo de consumo importante de RAM por copias y estudios grandes, incluso respetando el presupuesto total de 320 MB. La solución definitiva requiere decodificador con memoria y cachés controlables y pruebas bajo recursos limitados.
- El archivo seleccionado puede tener PHI incluso si la UI no lo expone. No copiar a GitHub, issue, servidor o logs.
- La seguridad owner-only del Issue #7 todavía no supera la prueba de cabecera upstream. **No habilitar ni publicar preview**.
- Retirar el bloque sin alterar producción equivale a cerrar/revertir el PR de trabajo; no hubo migraciones ni cambios D1/R2.

**Resultado exigido para cerrar #8:** motor OSS integrado y probado en el runtime objetivo, formato/sintaxis cubiertos explicitados, datasets independientes, datos de consumo/cancelación y ADR aceptado por dirección. Este bloque G2a-A **no cierra Issue #8**.
