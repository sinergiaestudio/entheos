# ANATHEOS CMR-R1 · recepción JPEG2000 en rama experimental

Este módulo amplía el preflight de CMR-P0 (PR #67) sin sustituir el parser DICOM existente ni las capas torácicas T2-C1 (PR #66).

## Componentes

- `jpeg2000_lossless.py` decodifica una **instancia MR clásica single-frame**, JPEG 2000 sin pérdidas (`1.2.840.10008.1.2.4.90`), en memoria local mediante Pillow, NumPy y pydicom.
- Conserva muestras `uint16` y dimensiones; no modifica geometría, intensidades, escala, fases ni UID.
- Rechaza otras sintaxis, Enhanced MR y multifotograma; en lugar de degradar silenciosamente la imagen.
- El `synthetic_selftest()` utiliza píxeles fabricados y prueba tanto roundtrip reversible como rechazo de multiframe.

## Fronteras de confianza

Este código no incorpora ni publica archivos DICOM personales. No contiene datos clínicos ni imágenes. Los reportes de inventario, derivados y pruebas con estudios reales deben permanecer localmente o en almacenamiento privado autorizado, nunca en este repositorio. Los píxeles pueden contener texto identificable; decodificación no es anonimización.

Esta implementación **no constituye integración con el visor WebGL2**, ni 3D/4D clínicamente válido. Antes de incorporar el flujo completo hacen falta: preflight por estudio/serie, validación de geometría y escalas, ordenamiento espacial/temporal, control de memoria/cancelación, lectura de GSPS/Raw Data según necesidad, pruebas en Windows y revisión de privacidad.

## Dependencias libres

```bash
python -m pip install "pydicom>=3,<4" "Pillow>=10,<13" "numpy>=1.26,<3"
python research/anatheos-cmr/ingesta/jpeg2000_lossless.py
```

No introduce gastos, servicios de procesamiento ni despliegue. PR experimental; no fusionar con `main` ni desplegar.
