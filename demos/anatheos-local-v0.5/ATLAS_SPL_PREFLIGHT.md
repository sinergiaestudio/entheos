# SPL Knee Atlas — preflight real de etiquetas NRRD (27/10/2026)

**Estado:** se inspeccionó la máscara real, pero NO se ha certificado una visualización de fémur/tibia reales, la escala de los STL, el registro espacial malla↔MRI ni su comparación con 3D Slicer. No se copiaron datos clínicos ni mallas al repositorio.

## Fuentes y atribución

- Atlas original [Open Anatomy SPL Knee Atlas](https://www.openanatomy.org/atlas-pages/atlas-spl-knee.html), Richolt/Jakab/Kikinis, SPL — Brigham and Women's Hospital / Harvard.
- [Repositorio original de etiquetas, MRI, modelos y configuración](https://github.com/lorensen/SPLKneeAtlas), rama `master`.
- [Máscara de etiquetas NRRD](https://github.com/lorensen/SPLKneeAtlas/blob/master/Atlas/SPLKneeAtlasLabels.nrrd), blob SHA `a6e9419b747c9cb2813d5b03e50e008d1a82ef95` (466.136 bytes, GZIP).
- [Escena MRML](https://github.com/lorensen/SPLKneeAtlas/blob/master/Atlas/SPLKneeAtlas.mrml.in), [tabla de etiquetas](https://github.com/lorensen/SPLKneeAtlas/blob/master/Atlas/SPLKneeAtlasColors.ctbl), [MRI NRRD](https://github.com/lorensen/SPLKneeAtlas/blob/master/Atlas/SPLKneeAtlasVolume.nrrd), [fémur STL](https://github.com/lorensen/SPLKneeAtlas/blob/master/Models/STL/femur-95.stl) y [tibia STL](https://github.com/lorensen/SPLKneeAtlas/blob/master/Models/STL/tibia-96.stl).

## Encabezado extraído del mapa real

```text
NRRD0004
type: short
dimension: 3
space: left-posterior-superior
sizes: 512 512 119
space directions: (0.27734019657873127,0,0) (0,-0.27734019657873127,0) (0,0,1)
endian: little
encoding: gzip
space origin: (-70.860420225865852,70.860420225865852,-59)
```

La máscara GZIP se descomprimió íntegramente **en memoria** a 62.390.272 bytes (`512×512×119×2`). La prueba verificó longitud descomprimida, pero no el CRC32 por separado. El espacio declarado es LPS con anisotropía; para pasar puntos de LPS a RAS utilizar `(R,A,S)=(-L,-P,S)` después de validar transformaciones del modelo.

| Etiqueta | Color table | Vóxeles | IJK mínimo / máximo | LPS mínimo / máximo, mm (aprox.) |
|---|---|---:|---|---|
| 95 | femur | 1.838.598 | (104,123,40) / (397,357,117) | (-42.017,-28.150,-19) / (39.244,36.748,58) |
| 96 | tibia | 1.190.880 | (142,113,1) / (433,321,46) | (-31.478,-18.166,-58) / (49.228,39.521,-13) |

**Hallazgo de calidad:** el mapa contiene 49 IDs no nulos diferentes y su tabla sólo 48 nombres. El ID **3** no tiene nombre en la tabla; debe permanecer `sin verificar`, sin etiquetado anatómico inventado.

## Integración v0.5 y evidencia faltante

El importador local soporta los archivos binarios `femur-95.stl` (~16,4 MB; 328.956 triángulos) y `tibia-96.stl` (~13,3 MB; 266.884 triángulos) por tamaño, pero **no se descargaron ni probaron estos modelos reales** dentro de ANATHEOS. El control de pantalla de Chromium fue ejecutado usando sólo dos STL **sintéticos de 2 triángulos**, sin peticiones a servidores externos. El formato STL no codifica unidades ni marco de referencia. Las mallas del SPL no deben mezclarse con Leeds, que es otro estudio.

Antes del checkpoint de aceptación anatómica hace falta traer los STL auténticos a un entorno privado, comprobar su correspondencia físico-espacial con el NRRD y su visualización en ANATHEOS y 3D Slicer; registrar medidas, lateridad y transformaciones.

**Licencia:** [3D Slicer License Part B](https://www.openanatomy.org/atlas-pages/slicer-license.html); para redistribuir datos/derivados, preservar atribuciones y el texto completo aplicable, identificar modificaciones, investigación no diagnóstica.
