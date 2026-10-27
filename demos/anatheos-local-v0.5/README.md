# ANATHEOS 3D · v0.5 · Superficies anatómicas 3D (Etapa B, primer bloque)

**Sólo investigación local · NO diagnóstico · NO desplegado · sin integración Entheos productiva.**

Esta rama contiene una **copia operativa** del visor v0.4 probado y agrega un tercer modo `Superficies 3D` independiente del DICOM. El código original de v0.4 (los 14 archivos originales respaldados en Drive) no se reemplaza en su carpeta ni se borra.

## Qué funciona ya (ingeniería)

- Seleccionar una o más mallas triangulares **STL binario / STL ASCII / OBJ** desde el sistema de archivos; sin conexión a Internet, sin nube ni APIs de pago.
- Dibujar cada estructura en WebGL2, con controles independientes para selección (lista), mostrar/ocultar, color, opacidad, aislamiento y rotación/zoom de cámara.
- Mantener **coordenadas numéricas originales** por vértice (sin desplazamientos ni registro espacial automático). El reencuadre de la cámara afecta sólo la vista.
- Rechazar NaN, geometría degenerada, índices OBJ inválidos y volúmenes excesivos: 450.000 triángulos por malla / 850.000 por escena, 40 MiB por archivo.
- Prohibir mezcla inadvertida entre identificadores de origen en la misma escena: hay que vaciar antes de cambiar el estudio declarado.
- Conservar los controles existentes de DICOM 2D, volumen 3D, edición de máscaras y NRRD. Las superficies nunca se sobreimprimen sobre las imágenes Leeds.

## Archivos oficiales de referencia (SPL Knee Atlas)

Los modelos de la colección del Surgical Planning Laboratory incluyen **femur-95.stl** y **tibia-96.stl** y corresponden a las entradas **95 femur** y **96 tibia** de la tabla de colores. Archivo de volumen `SPLKneeAtlasVolume.nrrd` y máscara `SPLKneeAtlasLabels.nrrd` figuran junto al MRML de la misma colección.

- [Repositorio de datos SPL Knee Atlas](https://github.com/lorensen/SPLKneeAtlas)
- [Modelos STL](https://github.com/lorensen/SPLKneeAtlas/tree/master/Models/STL)
- [Femur-95.stl](https://github.com/lorensen/SPLKneeAtlas/blob/master/Models/STL/femur-95.stl)
- [Tibia-96.stl](https://github.com/lorensen/SPLKneeAtlas/blob/master/Models/STL/tibia-96.stl)
- [Escena MRML](https://github.com/lorensen/SPLKneeAtlas/blob/master/Atlas/SPLKneeAtlas.mrml.in)
- [Atlas original Open Anatomy](https://www.openanatomy.org/atlas-pages/atlas-spl-knee.html)

**Los archivos de imágenes médicas, etiquetas y mallas del atlas NO se redistribuyen dentro de esta rama pública ni se incorporan en la CI.** Se descargan independientemente en el equipo del investigador y se importan con el botón «Importar superficies». El visor utiliza sólo el contenido local aportado por el usuario. El nombre del archivo o la selección de procedencia **no certifican** su origen por sí solos.

## Preflight técnico específico

Consultar [`ATLAS_SPL_PREFLIGHT.md`](ATLAS_SPL_PREFLIGHT.md): inspección real de NRRD LPS 512×512×119, fémur/tibia etiquetados, y etiqueta 3 no asignada.

## Ejecutar en Windows

1. Descargar el ZIP del código de esta rama, extraer sólo la subcarpeta `demos/anatheos-local-v0.5` a una carpeta de trabajo, y ejecutar `INICIAR_ANATHEOS.cmd` (servidor PowerShell de loopback del visor original).
2. Para el visor DICOM original, usar una serie DICOM compatible en un ZIP local o carpeta, como en v0.4. Para objetos, **no es necesario cargar DICOM**.
3. Descargar por separado los STL femur y tibia del mismo atlas mediante los enlaces anteriores, elegir fuente `SPL Knee Atlas` y seleccionar ambos archivos en «Importar superficies». Los controles aparecerán en el panel «Superficies 3D».
4. No asociar estos modelos con Leeds ni con un estudio de un tercero. Las posiciones STL carecen de especificación de unidades y sistema de referencia dentro del formato.

## Reproducir pruebas sin instalar software adicional

Con Node.js 22 o superior:

```sh
node --check app.js
node --check volumetric.js
node --check segmentation.mjs
node --check surface-core.mjs
node --check surface-renderer.mjs
node --check surface-ui.mjs
node --test test_segmentation.mjs test_volume_core.mjs test_surfaces.mjs
```

10 pruebas unitarias/sintéticas en total. Sin binarios médicos en CI. Los tests de render sobre imágenes/mallas anatómicas reales en Windows y la validación de geometría mediante 3D Slicer están **pendientes**; hasta entonces no se declarará Etapa B completada anatómicamente.

## Licencias y procedencia

El **SPL Knee Atlas** fue desarrollado por Jen Richolt, Marianna Jakab y Ron Kikinis, SPL, Brigham and Women's Hospital / Harvard Medical School; licencia [3D Slicer, Parte B](https://www.openanatomy.org/atlas-pages/slicer-license.html). Su licencia exige conservar avisos y párrafos aplicables al distribuir cualquier porción de sus datos o modelos, identificar versiones modificadas y no atribuir aptitud clínica. Los datos descargados del repositorio ajeno conservan su licencia original.

La UI de ANATHEOS no es una modificación de los modelos del SPL; para publicar modelos transformados habrá que incorporar las leyendas obligatorias del texto de la licencia antes de distribuirlos. Ninguna publicación ha sido autorizada.
