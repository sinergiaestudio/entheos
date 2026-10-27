# ANATHEOS 3D · Demo Local v0.2 — volumen 3D REAL de la DESS de Leeds

**27/10/2026 · EXPERIMENTAL / NO DIAGNÓSTICO · NO MERGE.**

Esta rama parte de PR #33 y mantiene intactos `main`, Entheos productivo y la rama piloto. Código distribuido en `ANATHEOS_3D_Demo_Local_v0.2_SOLO_CODIGO_sin_DICOM.zip`, **sin dataset ni capturas de imágenes médicas**. Descomprimir el ZIP para auditar sus archivos `volumetric.js`, `app.js`, `index.html`, `style.css`, launcher Windows y pruebas independientes.

**Código-only, sha256:** `534c7a7e11c6b7e1c53197c4aa9736fdea31bdd584995bbbdba6619ecbe844fe` (**29.409 bytes**).

**Distribución completa Windows**, con DICOM Leeds público (fuera de GitHub): [Drive](https://drive.google.com/file/d/1-WlUY46PoJGQ9P5vxQbs11DjXbs6EBJh/view) o entrega privada. **SHA256 ZIP completo** `430556bb9bf8e768edda2ed1b62c2a4059f40353f6b1dbf789a72fc920b60c18` (28.710.259 bytes). **DESS original** `1c378e89d3a2e7aa57a1049f1fa91b9278529e544369d1071d4c453073ce951d`, intacto.

**Qué funciona:** 144 archivos DESS públicos leídos en modo local, visor 2D original con precisión nativa preservada, renderizado **volumétrico 3D basado en el propio stack DICOM** `384×384×144`, orden y paso de cortes IPP·normal(IOP), extensión aproximada `140.0×140.0×100.1 mm`. Ray casting con rotación/zoom/umbral/opacidad, textura visual R8 (reducción de intensidad a 8 bits, exclusiva de vista 3D). WebGL2 hardware cuando esté disponible y respaldo CPU para navegadores sin WebGL2. No hay malla STL, modelo genérico ni tejidos segmentados.

**Comprobación REAL previamente ejecutada (local, DESS Leeds original):** Chromium de pruebas cargó 144 instancias, volvió a 2D, limpió el volumen, renderizó 3D por CPU; en área central se observaron 87 / 94 niveles de intensidad antes/después de rotar y cambio de media 76.26 / 73.19, 0 peticiones de red externas y 0 errores JS de página. Imagen real obtenida **solo en entrega privada**; no añadida a GitHub. **No probado:** ruta WebGL2 con GPU física Windows, comparación independiente con 3D Slicer ni validación clínica. El código no usa Cornerstone3D en este release; ensayos OSS aparte PR #30–#32.

**Límite geométrico:** los ejes del volumen siguen las direcciones DICOM de columna, fila y normal, con proporciones milimétricas. La orientación LPS/RAS y lateralidad radiológica todavía necesitan el oráculo 3D Slicer; no se anuncian cortes MPR reorientados como válidos.

**Ejecución:** descargar el ZIP completo de Drive, extraerlo, doble clic en `INICIAR_ANATHEOS.cmd`, abrir `http://127.0.0.1:8765`, cargar RM DESS incluida, pulsar **Volumen 3D**. Sin suscripciones, credenciales, D1/R2, publicación Site ni endpoints externos. [Backup código en Drive](https://drive.google.com/file/d/1nrb5iOmgIsgZASG39Scz9tExVCpyvAZF/view). No se fusionó ningún PR ni se modificó producto.
