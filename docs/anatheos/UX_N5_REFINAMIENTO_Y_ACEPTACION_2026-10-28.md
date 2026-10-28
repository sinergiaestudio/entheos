# ANATHEOS 3D · UX-N5 · Refinamiento y aceptación visual (incremento 1)

Fecha: 2026-10-28. Baseline visual obligatorio **UX-001**. Referencia conceptual en Google Drive privado; imagen referencia SHA-256 `d10c142fe8cbdeed10f25c40c6701c0566f444ec93965a16b97e925f46a5dd10`.

## Alcance efectivamente implementado

- `ux-n5.css` aplica acabados de superficie sin agregar controles ni sustituir escenas: fondo petróleo/nocturno, jerarquía tipográfica legible, panel de capas con filas más compactas, muestra cromática circular y controles asociados a **mallas realmente existentes**.
- Se conserva `ux-clean.css` UX-N4 y todas las herramientas originales bajo sus paneles nativos; no se elimina ningún botón ni su listener, y `app.js`, `volumetric.js`, `surface-ui.mjs`, segmentación y STL permanecen sin modificación.
- Estado contextual compacto a la izquierda mediante `ux-n5.mjs`, derivado del contenido **real** de `#volumeStatus`, `#surfaceLayers[data-origin]` y recuentos de máscaras. No aparece antes de que el estudio esté cargado; nunca declara lista una malla cuando solo hay volumen o un atlas SPL de otro espécimen.
- Diseño responsive del modo triple: 3 columnas en pantalla amplia; distribución 2 paneles superiores + 1 inferior de ancho completo en pantallas intermedias (681–1250 px); tres filas apiladas en pantallas pequeñas. No confundir esta disposición con un nuevo registro espacial: solo mismo estudio y cortes referenciados.
- El preset ámbar se mantiene **opcional**: es transferencia de intensidad, no huesos reconocidos; ausencia de malla verificada implica superficie vacía y mensaje explicativo.
- No se incorporan capas simuladas de fémur, tibia, meniscos, cartílago ni otros tejidos no segmentados. El catálogo de tejidos exploratorios de B7.2 sigue sin validación anatómica.

## Aceptación técnica automatizada (no aceptación clínica del titular)

- CI de Windows PowerShell 5.1 debe verificar server allowlist de `ux-n5.css` y `ux-n5.mjs`, además de carga de payload ficticio sin DICOM publicado.
- CI Node conserva 33 tests del motor; Chromium mantiene las pruebas UX-N1…N4, B6/B7 y añade `browser_ux_n5_polish.mjs`.
- Test N5 con DICOM **matemático sintético, no anatómico**, comprueba señales de estado reales, estilo ámbar enlazado con renderer original, 3 columnas a 1440px, distribución 2+1 a 1080px, 3 filas a 390px, procedencia y ausencia de anatomía ficticia.
- Captura real de interfaz sin estudio a resolución 1440x900, sin datos de paciente; no se publica ninguna captura del estudio real.
- Antes de la aceptación final UX-001 son imprescindibles imágenes de **la interfaz con RM original cargada en Windows del titular**, revisión de legibilidad/fluidez, comparación visual con PNG canónico y aprobación del titular.
- Métricas de FPS por dispositivo, orientación 3D Slicer y segmentos de tejidos blandos siguen siendo posteriores; no se infiere exactitud diagnóstica.

## Seguridad y versionado

Rama `anatheos/ux-n5-clinical-workbench-polish` sobre UX-N4 SHA `885478dcfce1ab5c168e37a1ab3ee3757a844fbe`. Draft PR aislado, NO merge a `main` o piloto, NO deploy de Entheos. Software local 100%, sin licencias ni APIs pagas ni datos clínicos en GitHub. Rollback completo a UX-N4. Paquete completo Windows debe conservar los 144 cortes Leeds originales y el estudio `RTKN0668_MR_DESS.zip` SHA-256 `1c378e89d3a2e7aa57a1049f1fa91b9278529e544369d1071d4c453073ce951d`.

## Próximo hito visual pendiente

No marcar UX-N5 como aprobado definitivamente sin aceptación del titular. Realizar evaluación de comportamiento en Windows de 1366×768 y 1920×1080, confirmando que las tres escenas no se deformen, que medidas/segmentaciones conservan origen y que la semilla produce malla únicamente desde el estudio activo.
