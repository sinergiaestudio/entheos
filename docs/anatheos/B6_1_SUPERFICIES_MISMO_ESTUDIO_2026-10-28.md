# ANATHEOS 3D · B6.1 · Superficies del mismo estudio DICOM

**Estado: experimental. SIN segmentación anatómica automática y NO apto para diagnóstico.**

## Alcance
- La acción Visualizar mis regiones en 3D toma exclusivamente las máscaras manuales de la serie DICOM activa o NRRD previamente cotejada por geometría, y genera una malla cerrada por etiqueta presente.
- La geometría usa dos triángulos por cara expuesta de cada vóxel. Es **cúbica** intencionalmente: no se suaviza ni se hacen predicciones anatómicas.
- Los vértices se calculan con ImagePositionPatient + ImageOrientationPatient × espaciado de píxel y de cortes, en **LPS físico milímetros**. No se intercambian LPS/RAS inadvertidamente.
- Se validan cantidad, orientaciones, desplazamientos, máscara, límites y conteo de triángulos. Límite 450.000 por región, 850.000 escena y 40 MiB por archivo. Sin decimación silenciosa.
- Se conserva el visor WebGL2 y se vinculan colores, visibilidad, aislamiento y opacidad de las regiones reales.
- No mezclar con SPL u otro estudio. Al modificar máscara o cambiar DICOM se descarta cualquier malla derivada obsoleta. Metadatos de procedencia solo en memoria.

## Validación reproducible
- Una única marca en un vóxel de 3×2×4 mm produce 12 triángulos no degenerados, cotas LPS correctas, orientación normal externa y área 52 mm².
- Vóxeles contiguos eliminan caras internas. Etiquetas distintas conservan interfaces separadas. Verificación con IOP rotado/oblicuo.
- Rechazo de estudio incorrecto, etiquetas inválidas, geometría irregular o máscaras de alta complejidad.
- Chromium con seis DICOM totalmente sintéticos verifica entrada manual, superficie WebGL real, procedencia y desactualización ante modificaciones.
- CI Windows verifica el servidor PowerShell local. ZIP de código en GitHub sin ningún estudio, STL, NRRD, DICOM o imágenes anatómicas.

## Fuera de alcance
- No identifica huesos, meniscos, cartílago, tejido ni lesiones; una región pintada no equivale a anatomía reconocida.
- No hay Marching Cubes/suavizado, exportación Slicer, validación clínica ni superposición espacial entre dos sujetos.
- La calidad visual final sigue regida por UX-001 y requiere B6.2/B7 con segmentación sobre el propio estudio.

## Versionado
- Base UX-N3 commit dba9094755007124e6ca940a5aebeef54cbcd6ca, PR #48.
- Rama experimental anatheos/b6-1-same-study-mask-surfaces, PR borrador, sin merge ni despliegue.
- Rollback UX-N3 intacto. Sin licencias, aplicaciones ni APIs pagas. Datos privados siempre locales.
