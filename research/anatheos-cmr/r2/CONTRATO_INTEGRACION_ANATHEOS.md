# ANATHEOS · Contrato de integración de estudios CMR-R2

**Versión de contrato:** `anatheos-cmr-r2-private-v1`.

## Entradas al módulo de ingesta

- ZIP DICOM original inmutable, con hash SHA-256 privado.
- Catálogo por StudyInstanceUID/SeriesInstanceUID, organizado internamente, sin publicar identificadores.
- Contenido no imagen (DICOMDIR, GSPS, RAW, ejecutables auxiliares) clasificado por separado; NUNCA ejecutar archivos adjuntos.
- Reglas por modalidad/familia: cada serie es un objeto aislado y autónomo.

## Datos normalizados de interoperabilidad

```text
Study (privado)
  series[]:
    id interno: RM-NNN
    estado: preparada | bloqueada
    modo_seguro: cine_provisional | perfusion_temporal | inversion_no_cine |
                 psir_multicontraste_no_cine | localizador_2d | pila_2d_revisar_3d
    bitmap[]: imagen [frames, filas, columnas], uint16 little endian, sin LUT aplicada
    metadatos_frames[]:
      ImagePositionPatient LPS, ImageOrientationPatient LPS, PixelSpacing
      TriggerTime, TemporalPositionIdentifier, ImageType
      RescaleSlope/Intercept, PhotometricInterpretation, hash fuente
```

**Nota técnica:** los valores de señal MR y la aplicación de slope/intercept deben tratarse según la especificación de cada imagen y presentación. La escala no es HU; no inferir densidad tisular por umbral CT.

## Adaptador ya implementado

`anatheos_cmr_bridge.mjs` exporta:

- `validateCatalog(catalog)` para esquema, IDs y modalidades.
- `decodeNpy16(buffer)` para cargar matrices verificando tipo, endian, forma y tamaño.
- `attachDecodedSeries(catalog,id,metadata,npyBuffer)` para exponer imágenes individuales (`getFrame(index)`) con geometría y timing. Se prohíbe declarar volumen 3D/4D a partir de un array de 3 dimensiones sin verificar espacio y tiempo.

Esto **prepara** la conexión al visor original, pero **no altera** `demos/anatheos-local-v0.5/app.js`, `main`, producción ni piloto. El puente es independiente y read-only por contrato (en JavaScript los TypedArray son técnicamente mutables; el consumidor no debe editarlos).

## Interfaz nativa pendiente tras la QA real

1. Crear pantalla de importación de estudios con ZIP/carpeta, progreso, cancelación y estados por serie.
2. Conectar un selector de series compatible con el árbol Study→Series→Plane→Frame, persistiendo la referencia al origen sin exponer PHI.
3. Integrar visualización 2D/cine con el renderizador original y reproducción condicionada por familia.
4. Verificar orientación y tiempo por serie; no fusionar PSIR, cine o perfusión por nombre o índice.
5. Habilitar MPR y volumetría únicamente cuando se demuestre stack espacial regular con un tiempo/contraste fijo.
6. Asegurar streaming/paginación para grandes estudios y cancelación bajo memoria limitada.
7. Pruebas sobre Windows físico, GPU, Slicer y casos multiinstitucionales, con seguimiento de fuentes y consentimiento.

## Gates antes de permitir 3D / 4D

- 3D: contigüidad espacial, un fotograma por posición, una orientación, un contraste y escala coherentes; orden por LPS y controles de espesor/gaps.
- 4D: fases comparables y consistentes en todas las posiciones, ventanas temporales, Series/FrameOfReferenceUID compatibles, sin cortes ausentes o duplicados; prueba cine y validación externa.
- Segmentación pericárdica y eventual hallazgo: sólo con máscaras del mismo estudio y revisión contra imagen original; el residuo no es detector de quistes.

## Preservación de arquitectura

Rama base anterior: T2-C1 y CMR-R1, PR #66 / #67 / #68; PRs en borrador. Nuevo trabajo jamás fusionado automáticamente. Ninguna información médica en repositorio público.
