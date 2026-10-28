# ANATHEOS 3D · Protocolo B3 · 3D Slicer
**Estado: guion automatizado PREPARADO; hasta ejecutarlo en 3D Slicer no hay contraste Slicer validado.**
## Objetivo
Reproducir una revisión independiente de los mismos datos SPL (fémur 95, tibia 96 y máscara NRRD) en un programa científico independiente de ANATHEOS, con orientación RAS/LPS y medidas en milímetros. El resultado es exploratorio, no diagnóstico.
## Procedimiento
1. Descargar e instalar **3D Slicer estable**, gratuito y de código abierto, desde https://download.slicer.org/ (no está incluido en ANATHEOS, no se requiere para abrir el visor web).
2. Ejecutar **OBTENER_ATLAS_SPL.cmd** desde la carpeta extraída; debe contener `ATLAS_SPL/femur-95.stl`, `tibia-96.stl`, `SPLKneeAtlasLabels.nrrd`, todos con hashes SHA-256 originales.
3. Iniciar 3D Slicer de escritorio, preferentemente en escena vacía. Abrir consola Python (menú **View → Python Console**).
4. Ejecutar en la consola, sustituyendo la ruta: `exec(open(r'C:\RUTA\ANATHEOS_3D_v05\validar_spl_en_slicer.py', encoding='utf-8').read())`. También se admite la opción oficial `Slicer.exe --python-script "C:\RUTA\...\validar_spl_en_slicer.py"`.
5. Los modelos se abrirán en la escena 3D original, y la script produce `VALIDACION_SLICER/RESULTADOS_SLICER_B3.json` y, si hay GUI disponible, `VALIDACION_SLICER/SLICER_ATLAS_B3.png`. **Estos archivos se guardan SÓLO en tu PC; no se transmiten a GitHub ni a Entheos.**
6. Revisar con el mismo atlas MRI si se dispone de él; comprobar derecha/izquierda, transformaciones, espaciado, concordancia de bordes entre vóxeles y superficies, y documentar observaciones. Las distancias de vértices a **centros** de vóxeles etiquetados sirven como señal de consistencia, NO constituyen Hausdorff ni Dice.
7. Si los valores resultan anómalos, no corregir ni auto-registrar automáticamente: conservar originales y abrir incidencia.
## Estado de ingeniería
- La rama de CI B2 ya pasó las pruebas sintéticas y con STL reales en Chromium y verificó las cotas geométricas RAS vs LPS con diferencias máximas inferiores a 0,71 mm.
- Este protocolo de uso de Slicer se valida estáticamente en CI por sintaxis; **no se ejecutó la aplicación completa 3D Slicer ni la prueba GUI Windows en el entorno del asistente**.
- No instalar extensiones o servicios de pago.
## Fuentes
Slicer https://www.slicer.org/ | Python scripting https://slicer.readthedocs.io/en/latest/developer_guide/script_repository.html | Datos https://github.com/lorensen/SPLKneeAtlas | Licencia https://www.openanatomy.org/atlas-pages/slicer-license.html
