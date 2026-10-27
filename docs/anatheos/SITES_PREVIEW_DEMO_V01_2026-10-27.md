# ANATHEOS · Ruta de vista previa Sites v0.1 · Solo rama experimental

**Fecha:** 27/10/2026. **Estado:** implementación en rama para revisión y pruebas automatizadas, **NO publicada**. **PR:** en borrador, base en la rama temporal `anatheos/issue-8d-windows-local-demo-v01`, que contiene código de la demo Windows sin DICOM.

## Ruta y controles

- `/app/anatheos-3d/demo`, definida por `app/app/anatheos-3d/demo/page.tsx`. Servidor rechaza con `notFound()` si `ANATHEOS_PILOT_ENABLED` no es exactamente `true`; después exige identidad autenticada y `isAnatheosOwner`. **Esto NO elimina la vulnerabilidad pendiente de comprobar la procedencia de `oai-authenticated-user-email` en Sites.** **No habilitar el flag ni publicar esta ruta** hasta cerrar los requisitos G1B y aislamiento D1/R2.
- `components/anatheos/site-demo-client.tsx`: importación ZIP o carpeta desde la computadora del usuario y visualización React/canvas 2D. Barra deslizante/rueda para cortes, window/level, brillo, contraste, zoom, desplazamiento, restablecimiento, información técnica DICOM y botón liberar. Solo lectura de píxeles monocromáticos DICOM Part10 sin compresión. Orientación desde IOP e IPP; sin lateralidad radiológica adjudicada ni MPR/3D inventados.
- `lib/anatheos/site-demo-zip.ts`: descomprime ZIP en navegador mediante `fflate` (dependencia **preexistente** en `package.json`), con límites por tamaño y entradas, y soporte del contenedor A de Leeds con `RTKN0668_MR_DESS.zip` interno. Las rutas del ZIP no se materializan en servidor ni disco y se descartan los nombres identificatorios en la UI.
- `tests/anatheos-sites-demo.test.mjs`: casos sintéticos ZIP DESS sin extensión, contenedor A anidado, cancelación, ZIP corrupto y regresión del guard. **No contiene datos médicos reales.**

## Uso previsto tras autorización futura

Cuando esté autorizado un entorno aislado con identidad/recursos verificados, el titular abriría `/app/anatheos-3d/demo`, elegiría en su PC `RTKN0668_MR_DESS.zip` o el paquete A y navegaría los 144 cortes de 384×384. **Ningún archivo DICOM se sube al servidor**: no hay upload API, D1, R2 ni procesamiento de imágenes del lado servidor. El tráfico normal del propio framework para renderizar la página no contiene píxeles.

Los 144 DICOM **no están presentes en este PR**. El ZIP de distribución Windows con DICOM fue respaldado exclusivamente en Drive privado y entregado en conversación. Fuente oficial Leeds: https://archive.researchdata.leeds.ac.uk/1609/ , CC BY 4.0, dataset RTKN0668.

## Compatibilidad y limitaciones

Se reutiliza `lib/anatheos/dicom.ts`, `dicom-intake.ts` y `fflate` del piloto ya existentes, no se sustituye el P1A ni se agregan paquetes. El DESS real tiene TS `1.2.840.10008.1.2.1`, 144 instancias, 384×384, 16 bits asignados/12 almacenados, PixelSpacing 0.36458 mm y separación geométrica 0.7 mm. Estos datos derivan del preflight de la distribución Windows, **no equivalen a una prueba física de la nueva ruta Sites**. La ruta necesita pasar lint, typecheck, build, tests ZIP y luego una **prueba de navegador real en un entorno aislado** antes de declararse lista para uso online.

**No activado:** flag, acceso remoto, D1/R2, infraestructura o nueva suscripción. **No autorizado:** merge, GitHub Settings ni publicación. El Site actual de Entheos no debe cambiarse.

## Decisión de Dirección

Primero revisar el PR y su CI. Luego resolver G1B (cabeceras verificables) y recursos aislados antes de habilitar siquiera una vista remota. Si no se dispone de un Sites de pruebas aislado, mantener la opción Windows local aprobada como vía de prueba privada.
