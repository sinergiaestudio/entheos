# ANATHEOS 3D · B5.1 · Inicio automatico y experiencia de estudio unificada

Estado: primera entrega de B5, rama de investigacion separada, sin merge ni despliegue.

## Comportamiento implementado
1. Al abrir la distribucion privada COMPLETA desde Windows, si el servidor localhost contiene `datasets/RTKN0668_MR_DESS.zip`, el navegador hace un `HEAD` local y carga la RM Leeds DESS sin pulsar "Cargar RM incluida". Se reutilizan SIN MODIFICACIONES los parsers de DICOM, ZIP, ordenamiento y vista 2D de v0.5.1.
2. Sin estudio incluido (repositorio de codigo o ZIP ligero), no se inicia una descarga desde Internet: aparece "Abrir mi estudio". El usuario elige su ZIP/carpeta con los selectores del navegador.
3. La barra de estudio identifica el origen (Leeds/DICOM propio), muestra estado y permite abrir otros estudios.
4. El visor queda organizado por contexto: capas STL solo en "Superficies 3D"; herramientas avanzadas y metadatos se despliegan a demanda. En RM 2D y volumen no se exponen controles de otros especimenes.
5. La etiqueta de SPL advierte expresamente que es OTRO especimen, no derivado de la resonancia Leeds. Se conservan los mecanismos SHA-256 del atlas y controles independientes del 3D.
6. Todo el procesamiento y las solicitudes de auto-inicio son a `127.0.0.1`. No hay servicios ni telemetria, y no se expone DESS en GitHub.

## NO implementado
- No descarga atlas SPL desde el navegador; el sistema de archivos no puede abrir archivos externos sin consentimiento. El descargador local heredado es manual y esta aislado.
- No existe segmentacion automatica de huesos/tejidos, ni mallas derivadas de la DESS.
- 3D Slicer y prueba manual de GPU en la PC siguen pendientes.
- No se eliminan funciones anteriores; quedan accesibles en "Controles avanzados".
- No se fusiona main/piloto ni se modifica Entheos productivo.

## Pruebas de aceptacion
CI Linux 12 tests Node y dos navegadores Chromium: sin DESS funciona en modo manual; con HEAD positivo dispara GET automaticamente (un ZIP falso se rechaza sin crashear); sin llamadas externas. CI Windows comprueba el modulo B5 y el rechazo de DESS inexistente. Paquete fuente sin datasets. Una distribucion COMPLETA de ~28 MB debe ensamblarse con la fuente Leeds original en almacenamiento privado y verificarse por SHA-256 antes de su entrega.
