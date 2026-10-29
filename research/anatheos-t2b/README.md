# ANATHEOS · T2-B · tejido torácico experimental

Uso **estrictamente de investigación no comercial**. Este código no hace diagnóstico ni identifica quistes. Rama experimental aislada.

## Capas calculadas
- `air_candidate_left`, `air_candidate_right`: aire de baja atenuación dentro del cuerpo, subdividido por eje LPS. **No son máscaras pulmonares verificadas** (incluyen posibles vías aéreas y otros espacios).
- `high_attenuation_candidate`: HU >250; **no es hueso confirmado** (puede incluir contraste, calcificaciones y artefactos).
- `central_soft_tissue_search_region`: tejido blando en franja axial central, **no representa segmentación de corazón, aurículas, vasos o pericardio**.
- `unassigned_body_tissue`: todos los demás vóxeles del cuerpo. **No indica lesión, masa ni quiste**. Un residuo grande es esperable.

## Seguridad científica
La cobertura del estudio puede ser parcial; los umbrales no generalizan a todos los protocolos y la CT con/sin contraste cambia intensidades. No se entrena ninguna red neuronal. Falta comparar contra máscaras expertas del MISMO estudio y revisar topología/orientación con Slicer. Los conteos son indicadores de QA de un particionado, **no métricas de exactitud** (Dice, Hausdorff).

## Ejecución
```bash
python3 -m pip install numpy scipy pydicom
python3 research/anatheos-t2b/thorax_tissue_candidates.py --selftest
python3 research/anatheos-t2b/thorax_tissue_candidates.py
```
El segundo comando descarga el ZIP original de PCIR a memoria temporal, exige su SHA-256 y emite **solo JSON anónimo**, sin publicar las imágenes o máscaras en GitHub. No guardar resultados anatómicos individuales en el repositorio público.

## Gate T2-B
T2-B0: un script reproducible, cinco máscaras exploratorias matemáticamente separadas, particionado completo del cuerpo y recuentos sobre CT-T1.
T2-B1 **pendiente**: revisar forma de máscaras en 3D Slicer y contrastar al menos pulmones contra segmentación experta del mismo caso.
T2-B2 **pendiente**: UI con capas interactivas verificadas en la aplicación. Este script no modifica el visor.
