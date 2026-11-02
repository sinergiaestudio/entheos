# Cierre experimental: estudios nuevos y presentación

Orden directa del titular del 02/11/2026, continuidad CCG-2026-005, baseline PR #79 e0e4f516 intacto. Rama hija y PR DRAFT #80. No nueva versión instalada o autorización clínica.

- Cámara del renderer existente orientada al paciente mediante la base DICOM validada, en GPU/CPU/nube. MPR y ORIGINAL con rotaciones propias de presentación, cursor/compás/escala/arrastre coherentes. No espejo ni reordenamiento de fuentes, nuevo campo/interpolación o inversa espacial #10.
- SURVEY inicia con volumen/MPR e inspector plegado. Opciones por menús existentes y clic derecho, máximo un editor; funciones/estados/procedencia conservados.
- Importadores originales conservados. DICOM Part10 monocromo de 16 bits Explicit/Implicit VR LE por ZIP/carpeta; RM clásica JPEG2000 lossless por ZIP. No soporte general de Enhanced/multiframe, RGB, otras transferencias, NIfTI/MHA/NRRD de intensidad, PDF/video o TC comprimida. Región corporal no prueba elegibilidad.
- Portable Windows completo identificado por SHA, datos aislados en LOCALAPPDATA/ANATHEOS-Experimental/study-import-closure. Reutiliza entry/server/decoder, no migra o sustituye la instalación ni proyectos/configuraciones anteriores. Cerrar/borrar portable revierte la prueba. No es instalador ni actualización oficial.

## Pruebas reproducibles

- node demos/anatheos-local-v0.5/test_patient_presentation.mjs: cinco bases incluidas invertida/oblicua, superior, determinante positivo, landmarks asimétricos, rotaciones y cursor, desplazamiento de corte. Reproduce el signo erróneo de cámara anterior.
- python research/anatheos-cmr/r3/test_new_studies.py: cuatro estudios sintéticos por dos resoluciones, ZIP/carpeta, ambos adaptadores, 1–4 vistas/contextual, volumen/MPR de pilas regulares, rechazo 3D temporal, cierre sin residuos.
- python research/anatheos-visual-target/test_vt.py: launcher real, volumen/corte/MPR/oblicuo/fuente/soporte, toolbar/contextual, inspector, ampliar/Escape y recursos; 1366×768 y 1920×1080.
- packaging/windows/build_private.ps1 y test_private.py: ejecutable congelado real, importación local/JPEG2000 en proceso hijo y aislamiento de datos. Chromium QA conserva su entorno original; sólo la aplicación recibe LOCALAPPDATA aislado. El checkout usa el HEAD exacto, evitando confundirlo con el merge sintético de Actions.
- Regresiones station/L0/L1 y geometría/campo/volumen/eligibilidad. Dieciocho workflows históricas excluidas = SKIP, no PASS. No repetir Leeds. Windows automatizado no equivale a aceptación física o médica.

Intentos fallidos se conservan en el registro del PR: selección de carpeta en el driver, estilos que anulaban hidden, dependencias del preparador CT público y caché Chromium al aislar LOCALAPPDATA. No declarar PASS antes del gate final.

Atlas acumulativo: se consultó el inventario/HTML v2 y protocolo de prueba de Drive del 29/10. Fuentes registradas no equivalen a muestras descargadas o compatibles. Nuevas incorporaciones públicas, sus hashes/geometría/licencia/QA y bloqueos se registran en el informe del PR y Plan Maestro, sin sobrescribir anteriores. NIfTI cardíaco requiere adaptador verificado, no se finge DICOM.

Fusión/registro correctivo/AFE-02B, segmentación clínica/superficies cardíacas, once subpilas privadas y cine por fase siguen sujetos a sus gates. No PHI GitHub/CI, producción, main, merges o gastos. Capturas clínicas sólo Drive privado. Slicer y GPU física pendientes de validación independiente.
