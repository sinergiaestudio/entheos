# ANATHEOS 3D — Corpus DICOM sintético G2b · Parte A

**Fecha:** 2026-10-26 · **Issue:** #9 · **Estado:** corpus programático de pruebas propuesto; **sin validación geométrica en 3D Slicer ni aptitud clínica**.

## 1. Procedencia y licencia

La fuente única es `tests/fixtures/anatheos/synthetic-series.mjs`. Todos los bytes, píxeles, UID y posiciones son **fabricados algorítmicamente**. No hay datos de personas ni descargas; autoría del proyecto y sin incorporación de datasets de terceros o licencias comerciales. Son archivos mínimos de prueba de la estructura Part 10, **no un conjunto de estudios CT plenamente conformes a un IOD diagnóstico**.

Ningún archivo binario DICOM está versionado. Para obtener hashes SHA-256 públicos/reproducibles y un manifiesto de los archivos generados:

```bash
node scripts/anatheos-corpus-manifest.mjs
```

Para crear temporalmente los DICOM **solo fuera de la carpeta del repositorio** (por ejemplo, para comprobar importación en 3D Slicer), sin subirlos a GitHub:

```bash
node scripts/anatheos-corpus-manifest.mjs --out /tmp/anatheos-phantom
```

El comando escribe `manifest.json` con hashes SHA-256, cantidad de bytes, nombres de archivos, escenario, expectativa y puntos físicos. No consume redes, servicios, APIs ni GPU.

**Atención:** el orden de los nombres de archivo no es el orden geométrico. El normal de la orientación (IOP) y la posición (IPP) determinan el orden correcto.

## 2. Matriz de escenarios codificados

| Escenario | Expectativa del prototipo P1A | Qué prueba |
|---|---|---|
| `axial-anisotropic` | Aceptar | 3 cortes desordenados; PixelSpacing 2×3 mm y separación de cortes 5 mm |
| `reversed-normal` | Aceptar | Orientación con signo negativo en X, normal hacia -Z, ausencia de flip inadvertido |
| `oblique` | Aceptar geometría, **solo plano original** | Orientación 45°, sin fingir MPR axial/coronal/sagital |
| `irregular-gap` | Rechazar volumen | Separaciones 1 y 2 mm, no uniformes |
| `gantry-tilt` | Rechazar volumen | Desplazamiento en plano de 0,5 mm por corte; exige remuestreo posterior |
| `two-series` | Rechazar volumen combinado | No mezclar SeriesInstanceUID distintos |
| `implicit-le` | Aceptar | Transfer Syntax implicit Little Endian sin compresión |
| `jpeg-transfer-syntax-sentinel` | Rechazar decodificación | Cabecera declara JPEG, pero no contiene JPEG válido: *sentinela de rechazo*, no test de JPEG real |
| `multiframe-unsupported` | Rechazar decodificación | NumberOfFrames=2 no soportado, no prueba un Enhanced DICOM válido |

## 3. Goldens de centros de voxel y coordenadas de paciente

Convención: coordenadas **LPS (mm)**, punto de centro de voxel; índices `[columna, fila, corte]`, comenzando en cero. Los valores de referencia se fijaron independientemente de `lib/anatheos/dicom.ts` y **antes** de la ejecución del CI.

| Escenario | Voxel [c,r,k] | LPS esperado [x,y,z] mm | RAS esperado [x,y,z] mm | Tolerancia unit test |
|---|---|---|---|---|
| Axial anisotrópico | [2,1,2] | [16,22,40] | [-16,-22,40] | 1e-8 mm |
| Normal invertida | [1,2,1] | [7,24,25] | [-7,-24,25] | 1e-8 mm |
| Oblicuo | [2,1,2] | [13.82842712476,18.65685424952,25] | [-13.82842712476,-18.65685424952,25] | 1e-6 mm |

Ecuación normativa de referencia (DICOM PS3.3 C.7.6.2.1.1) para índice entero de voxel:

```text
P_LPS(c,r) = IPP + c * PixelSpacing[1] * IOP[0:3]
                 + r * PixelSpacing[0] * IOP[3:6]
```

La tercera dimensión en estos datasets regulares se representa por la IPP de cada corte. **No se interpola ni se supone espaciado homogéneo si el caso se rechaza**. La ecuación aplica a centros de píxel; no equivale a medir órganos o lesiones.

Fuente: https://dicom.nema.org/medical/dicom/2026c/output/chtml/part03/sect_C.7.6.2.html

## 4. Validación independiente requerida — pendiente

**Protocolo 3D Slicer** (no se ejecutó aún):

1. Exportar DICOM a carpeta temporal fuera de Git mediante el generador, anotar versión de Node, versión de Slicer y SHA-256 por instancia del manifiesto.
2. Intentar importar **cada serie por separado** con el módulo DICOM de Slicer. No suponer que un objeto mínimo de test corresponde a una modalidad CT plenamente aceptada por Slicer; anotar `PASS/FAIL/BLOCKED` de importación.
3. Comparar los tres puntos contra las coordenadas físicas esperadas y su conversión LPS→RAS, sin cambios ocultos de origen u orientación.
4. **Tolerancia objetivo predefinida para estas comprobaciones Slicer:** 0,05 mm por componente de coordenada si el importador admite el dataset; criterio instrumental exploratorio, **no tolerancia clínica universal**. Documentar error máximo y hardware/software.
5. Comparar la ordenación, distancia entre cortes y orientación, con particular atención a la normal negativa y al oblicuo. Rechazar si hay lateralidad invertida.
6. Repetir con datasets DICOM externos públicos y efectivamente desidentificados después de revisar licencia y metadatos, fuera de repositorio/CI, cuando G2a esté listo.

**Pendientes imprescindibles para cerrar Issue #9:** verificación Slicer real, reporte de conformidad de fixtures, dos o más datasets abiertos trazables y revisión de compatibilidad por sintaxis. Los tests automáticos prueban que el parser actual da los resultados esperados sobre *estos datos manufacturados*; no validan su correspondencia universal con la realidad clínica ni renderizado volumétrico 3D.

## 5. Seguridad y operación

- Los archivos de prueba no contienen estudios de pacientes ni PHI; no usar correos, nombres o metadatos personales en fixtures.
- Los hashes son huellas de **bytes sintéticos**, no verifican identidad clínica, integridad de un estudio original ni diagnóstico.
- Sin API de procesamiento remoto, sin dependencias nuevas ni almacenamiento de estudios del usuario en Cloudflare.
- El laboratorio G1 y el bloqueo de identidad upstream en Issue #7 siguen vigentes. No habilitar `ANATHEOS_PILOT_ENABLED` ni publicar Site para ejecutar este corpus.
