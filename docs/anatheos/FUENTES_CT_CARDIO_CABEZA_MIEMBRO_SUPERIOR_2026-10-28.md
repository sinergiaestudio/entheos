# ANATHEOS 3D · Selección de tres tomografías para ampliar pruebas (2026-10-28)

**Estado: fuentes identificadas y contrastadas documentalmente; datos originales todavía NO descargados, checksum y geometría intrínseca de cada caso NO auditados localmente.** Esta nota no habilita su uso clínico ni su redistribución sin revisar las licencias concretas.

## Tres candidatos prioritarios

### A. CARDIACO / TÓRAX — CTA-cardio, 3D Slicer TestingData
- TC angiográfica cardíaca real como volumen NRRD (NO imagen representativa). Permite estudiar estructuras vasculares y anatomía cardíaca dentro de la cobertura real; verificar si captura todo el tórax o solo región cardiaca.
- Archivo `CTA-cardio.nrrd`; muestra histórica ~61.08 MB (Slicer Wiki), tamaño del asset actual por comprobar.
- URL documental y descarga publicada oficialmente:
  `https://github.com/Slicer/SlicerTestingData/releases/download/SHA256/3b0d4eb1a7d8ebb0c5a89cc0504640f76a030b4e869e33ff34c564c3d3b88ad2`
- SHA-256 fuente: `3b0d4eb1a7d8ebb0c5a89cc0504640f76a030b4e869e33ff34c564c3d3b88ad2`.
- Inscripción: muestra pública integrada en 3D Slicer SampleData; se ignoran licencias de Slicer como sustituto de licencia de la imagen subyacente. Atribución/derechos específicos de este dato pendientes de comprobar antes de redistribución.
- Necesidad técnica: parser de volumen NRRD (no solo NRRD de máscaras). **No presentar como compatible hoy sin conversión**.
- Fuentes: `https://github.com/Slicer/Slicer/blob/main/Modules/Scripted/SampleData/SampleData.py`; `https://www.slicer.org/wiki/File:CTA-cardio.nrrd`.

### B. CABEZA — CT-brain, muestra CT-MR Brain de 3D Slicer
- Volumen **TC de cabeza/cerebro**, NRRD, acompañado opcionalmente de estudios MR T1/T2 en la misma familia de muestras. No asumir registro espacial perfecto de todos los volúmenes sin verificaciones de origen.
- URL publicada:
  `https://github.com/Slicer/SlicerTestingData/releases/download/SHA256/6a5b6caccb76576a863beb095e3bfb910c50ca78f4c9bf043aa42f976cfa53d1`
- Nombre que debe conservarse al descargar: `CT-brain.nrrd`; SHA-256:
  `6a5b6caccb76576a863beb095e3bfb910c50ca78f4c9bf043aa42f976cfa53d1`.
- Licencia de imagen subyacente y resolución exacta pendientes; sample reproducible pero requiere importador de volumen NRRD.
- Fuente oficial: `https://github.com/Slicer/Slicer/blob/main/Modules/Scripted/SampleData/SampleData.py`.
- Alternativa con CC BY 4.0 explícita y DICOM original: CPAISD Zenodo `https://zenodo.org/records/10892316`: 112 TC craneales sin contraste, archivo total 5,6 GB; estudios de ACV (no muestra normal), elegir y extraer una serie apropiada con control de privacidad, sin subir a GitHub público.

### C. MIEMBRO SUPERIOR — Codo, 201 CT saludables con máscaras y STL relacionados
- Artículo de 2026 `10.1038/s41597-026-07609-1` y Zenodo `https://doi.org/10.5281/zenodo.20305534` / `https://zenodo.org/records/20305534`.
- 201 CT anonimizadas de codo, pareadas con segmentación húmero distal–cúbito proximal y STL creados y revisados por especialistas, junto con mediciones anatómicas. **Mallas de la MISMA adquisición**, caso ideal para validar CT → máscara → STL de ANATHEOS; no usar STL de un caso distinto.
- Licencia declarada CC BY 4.0, con atribución. Formato de CT bruto, tamaño por caso, resolución, estructura de archivos y descarga directa del registro pendientes de inspeccionar: no inventar.
- Fuentes: `https://datasetcatalog.nlm.nih.gov/dataset?q=0002963501`; `https://orthoarchives.com/en/orthoscience/article/dataset-of-201-healthy-elbow-ct-scans-with-humeroulnar-segmentation-3d-models-oarc-a0009873050`.
- Alternativa más compacta de muñeca/mano: `https://www.embodi3d.com/files/file/66133-wrist_test_02/`, CT NRRD 99,54 MB, licencia atribuida como Free Files CC Attribution; requiere verificar si exige cuenta gratuita y calidad/cobertura reales antes de adoptar.

## Alternativa TORAX DICOM lista para analizar en el cargador actual

- Zenodo `https://zenodo.org/records/18225140` — PCIR torso `PCIR_98890234_20010101_7.zip`; **107 archivos DICOM**, ZIP 24.658.025 bytes aprox. (tabla 24,7 MB), CC0 declarado por el origen y Zenodo.
- Enlace oficial de descarga:
  `https://zenodo.org/records/18225140/files/PCIR_98890234_20010101_7.zip?download=1`.
- MD5 que publica Zenodo: `e25e4a734cb7ffee4b0ccd96e7df358c` (aún NO recalculado). Es la alternativa más inmediata en DICOM original para test de ANATHEOS v0.9; al ser un ejemplo educativo de 107 cortes no asumir mejor resolución ni especificidad cardíaca que CTA-cardio sin evaluar dimensiones y spacing.

## Puerta de aceptación obligatoria por cada uno

1. Descarga individual, sin cuentas/licencias/suscripciones de pago ni nuevos servicios. Verificar términos de uso clínico/no comercial/redistribución caso por caso.
2. SHA-256 real del volumen (o MD5 del PCIR cuando sea único checksum publicado), conteo de cortes, dimensiones `X × Y × Z`, espaciado X/Y y entre cortes, sistema espacial LPS/RAS, orientación, origen, regularidad y tamaño comprimido.
3. Si DICOM: identificar una única serie, validar ImageOrientationPatient/ImagePositionPatient, PixelSpacing, SliceThickness y RescaleSlope/Intercept; no confiar en orden alfabético ni mezclar varias fases de contraste.
4. Si NRRD/NIfTI: convertir/importar como VOLUMEN, no como máscara, con IJK→LPS físico y preservación de los valores HU (si presentes). El importador actual no soporta de forma general estos volúmenes; implementar y validar antes de ofrecerlos como estudios cargables.
5. Cotejar del **mismo caso** original/labelmap/STL y la diferencia geométrica con Slicer; separar explicaciones de hipótesis y segmentaciones reales.
6. Guardar DICOM/NRRD/segmentaciones y capturas anatómicas exclusivamente en carpeta PRIVADA Drive ANATHEOS o en la computadora del titular; GitHub público sólo metadatos de fuentes/descarga y código. No modificar main, piloto o despliegue Entheos.
7. No afirmar que una tomografía supera a Leeds en calidad hasta comprobar espaciamiento (y, para corazón, resolución temporal/si la adquisición está ECG-gated), contraste, ruido y cobertura anatómica.

## Decisión técnica

Tres categorías aprobadas para exploración: **CTA cardio**, **TC cabeza**, **TC codo**. PCIR torso DICOM como plan de prueba inmediato; CPAISD cabeza DICOM y muñeca Embodi3D como alternativas con distinta accesibilidad. Solo se ha realizado investigación de fuentes; ningún volumen está validado ni integrado todavía.
