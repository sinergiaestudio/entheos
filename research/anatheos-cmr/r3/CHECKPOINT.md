# CMR-R3 · Unificar ANATHEOS y corregir SURVEY (31/10/2026)

## Problemas reales reportados
1. Demasiados ZIP, instalaciones y operaciones manuales para obtener una visualización.
2. SURVEY mezclaba orientaciones.
3. Imágenes en tamaño reducido.
4. Visor cardíaco separado pese a existir ANATHEOS 3D completo.
5. Falta de documentación operativa accesible entre conversaciones de un Proyecto.

## Fuente real recuperada desde archivos del Proyecto
El ZIP DICOM original permanece **privado**. Fue validado en el contenedor del proyecto sin publicar nombre de paciente, UIDs, posiciones clínicas ni píxeles.
- ZIP 110.059.704 bytes, 1.645 miembros, CRC correcto.
- 24 series MR, 1.318 instancias.
- Conversión real CMR-R2: 24/24 series, 1.318/1.318 imágenes, 0 fallos.
- SURVEY RM-001: **tres orientaciones distintas, 20 posiciones cada una**, total 60 imágenes.

## Corrección en desarrollo y evidencia
- Navegación jerárquica: orientación anatómica -> posición/corte -> fotograma/contraste (nunca fusionar orientaciones ni asumir 4D).
- Visualización ajustada al panel de tamaño real de pantalla, con ampliación 100–400 %.
- Prototipo experimental `cmr-native.mjs` / `cmr-native.css` que vive dentro de la página principal y abre una carpeta CMR-R2 preparada usando File API, sin sustituir el motor DICOM preexistente.
- Chromium con SURVEY **real**: 3 orientaciones, 20 posiciones por orientación, canvas 192×192 a tamaño visual 1015×748 en visor QA, zoom 200%, 0 errores JS.
- Chromium en página HTML de ANATHEOS (sin sus demás módulos activos): catálogo de 24 series, orientación SURVEY real, control tamaño y cierre sin alterar el estudio anterior, 0 errores JS.
- Los archivos fuente de la corrección y pruebas están en la carpeta privada [CMR-R3](https://drive.google.com/drive/folders/1uLfhG6KiYRreOU9rU0f1suJ74rOLIHS9); este README no afirma que el prototipo esté instalado o integrado todavía en GitHub.

## Gate de producto obligatorio
**Una sola app, una sola importación ZIP DICOM original, decodificación JPEG2000 local y clasificación automática con selección clara de series.** No entregar más visores paralelos ni pedir varias descargas al usuario.

### Pendiente antes de promover
- Terminar de integrar fuente nativa de R3 al repositorio y allowlist del servidor Windows.
- Regresión completa con UX-N5/N6, T2-C1 y otras funciones; pruebas 2D/cine y rutas.
- Acceptance física en Windows con el paquete final.
- Automatizar DICOM ZIP -> catálogo desde una única acción de la app (el prototipo actual usa carpeta R2 ya preparada).
- 3D/4D pericárdico y segmentación clínica no implementados.

## Control de privacidad
No subir DICOM, NPY, metadatos geométricos clínicos, imágenes, capturas ni identificadores del usuario a GitHub. No modificar main, piloto ni producción.
