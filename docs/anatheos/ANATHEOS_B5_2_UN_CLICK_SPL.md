# ANATHEOS 3D B5.2 — Atlas de referencia con un clic

**Estado:** etapa aislada. NO diagnostico; sin merge, despliegue ni estudios en repositorio publico.

## Implementado
- En la vista Superficies 3D aparece **Preparar y ver atlas SPL**.
- Primer clic: el navegador llama exclusivamente a su servidor `127.0.0.1`; solo entonces el servidor descarga los STL originales y la mascara de etiquetas desde `lorensen/SPLKneeAtlas` commit `a033300264aec8625a56512be3865c10cdbcb61b`, a `ATLAS_SPL` privado local. El descargador ya existente verifica tamaño y SHA-256 antes de fijar cada archivo, y rechaza sobrescrituras incompatibles.
- La misma accion importa las dos mallas SPL en WebGL2 y crea las capas independientes por fémur (328.956 triángulos) y tibia (266.884 triángulos). Cada STL vuelve a verificarse mediante Web Crypto SHA-256 en el navegador.
- Clics posteriores abren las copias previamente verificadas; no es necesaria otra descarga.
- Los controles manuales STL/OBJ y la seleccion de origen quedan bajo un desplegable "Mas opciones", conservados sin eliminacion.
- DICOM 2D, volumen GPU y segmentacion manual de Leeds no se alteran. Las mallas SPL son **otro especimen**, nunca una reconstruccion de Leeds.
- El servidor solo escucha en loopback; la API de descarga requiere POST `application/json`, `Origin` idéntico y `Host` exacto. No hay rutas arbitrarias de escritura ni lectura, proxies, URLs suministradas por el usuario, telemetria, login, API pagas ni cloud.

## Pruebas
- Linux Chromium mock negativo: muestra error de disponibilidad, mantiene controles y no importa datos.
- Linux Chromium real: material SPL efimero, mock de localhost, clic unico, archivos autenticos verificados SHA-256 y dos capas WebGL.
- Windows PowerShell 5.1: GET status, CSRF Origin externo denegado y, en prueba final, POST permitido -> descarga genuina en directorio temporal -> GET de STL permitidos y sin diagnostico. El runner elimina originales al finalizar.
- ZIP de codigo sin DICOM, NRRD ni STL. El ZIP completo Windows incorpora por separado la DESS original del archivo privado v0.4, con hash y manifest verificables.

## Limitaciones
- No se baja automaticamente el atlas al iniciar la aplicacion: requiere un clic expreso del usuario, ya que implica conexion saliente y descarga de ~30 MB.
- No se segmenta la resonancia Leeds; B6 abordará las mallas derivadas **de la misma RM** y su registro geométrico.
- La etiqueta SPL no constituye validación clinica, lateralidad o registro en 3D Slicer.
- Windows GPU y funcionamiento en computadora del titular: requiere prueba futura; no afirmar hasta que ocurra.
- Conserva v0.5.1 como rollback y no modifica `main`, piloto ni Entheos.
