# ANATHEOS 3D · v0.5 · Superficies anatómicas 3D + paquete Windows portátil B3

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

**Los archivos de imágenes médicas, etiquetas y mallas NO se distribuyen en esta rama pública ni en el paquete portátil.** Las pruebas CI B2 descargan temporalmente datos públicos del atlas y los eliminan antes de cerrar el ejecutor. En Windows, ejecutar `OBTENER_ATLAS_SPL.cmd` para descargar el atlas original a la carpeta privada `ATLAS_SPL`. Al elegir «SPL Knee Atlas», el visor verifica tamaño, triángulos y SHA-256 de las mallas originales antes de reconocerlas. No se superponen con estudios de Leeds.

## Preflight técnico específico

Consultar [`ATLAS_SPL_PREFLIGHT.md`](ATLAS_SPL_PREFLIGHT.md): inspección real de NRRD LPS 512×512×119, fémur/tibia etiquetados, y etiqueta 3 no asignada.

## Ejecutar en Windows · Paquete portátil B3

1. Descargar y extraer el ZIP **ANATHEOS_3D_v0.5_Windows_Portable_B3.zip** en Documentos, sin sobrescribir la v0.4 estable.
2. Ejecutar `DIAGNOSTICO_ANATHEOS.cmd` y `INICIAR_ANATHEOS.cmd`: el servidor PowerShell 5.1 se limita a localhost (`127.0.0.1:8765..8775`). No depende de nube.
3. Para usar las **mallas SPL reales**, ejecutar primero `OBTENER_ATLAS_SPL.cmd` (requiere Internet solamente para descargar y verificar el atlas público original). Elegir origen «SPL Knee Atlas» e importar los archivos `ATLAS_SPL/femur-95.stl` y `tibia-96.stl`.
4. Para detener o reiniciar usar `DETENER_ANATHEOS.cmd` o `REINICIAR_ANATHEOS.cmd`.
5. Leer `GUIA_WINDOWS_B3.md` y `PROTOCOLO_VALIDACION_SLICER_B3.md` para el control geométrico independiente. El guion de Slicer está preparado, pero **no se probó todavía en un Slicer de escritorio**.

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

12 pruebas Node en CI, además de renders WebGL2 aprobados con mallas sintéticas y con las superficies auténticas del SPL Knee Atlas. La prueba del servidor Windows PowerShell 5.1 también aprobó. La comparación independiente en 3D Slicer y las pruebas manuales del usuario en su propia PC siguen pendientes: no se declara validación diagnóstica.

## Licencias y procedencia

El **SPL Knee Atlas** fue desarrollado por Jen Richolt, Marianna Jakab y Ron Kikinis, SPL, Brigham and Women's Hospital / Harvard Medical School; licencia [3D Slicer, Parte B](https://www.openanatomy.org/atlas-pages/slicer-license.html). Su licencia exige conservar avisos y párrafos aplicables al distribuir cualquier porción de sus datos o modelos, identificar versiones modificadas y no atribuir aptitud clínica. Los datos descargados del repositorio ajeno conservan su licencia original.

La UI de ANATHEOS no es una modificación de los modelos del SPL; para publicar modelos transformados habrá que incorporar las leyendas obligatorias del texto de la licencia antes de distribuirlos. Ninguna publicación ha sido autorizada.
