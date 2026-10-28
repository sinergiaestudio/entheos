# ANATHEOS 3D · UX-N1 implementación de la referencia UX-001

**Primer incremento visual real en rama aislada.** Referencia oficial: `docs/anatheos/UX_NORTE_OFICIAL_2026-10-28.md`. Captura aprobada UX-001 resguardada en Google Drive privado; el render del ejemplo conceptual no se ha copiado, recreado ni presentado como anatomía del estudio.

## Implementado
- Estación oscura de tres zonas `Estudio | Visor principal | Capas`, fondo negro/azul petróleo, tipografía libre sistema/Segoe UI, separadores discretos, vista central dominante y diseño adaptable.
- Panel derecho de capas **funcionales y presentes**: imagen DICOM original en 2D/volumen; opacidad 3D vinculada a `#volumeOpacity` verdadero; mallas externas sólo cuando se han importado, con controles existentes de visibilidad, color, opacidad e aislamiento.
- Procedencia de datos: se indica cuando una superficie SPL proviene de otro espécimen, sin decir que deriva de la RM Leeds.
- Controles manuales de segmentación DICOM/NRRD y configuraciones avanzadas preservados; no se han eliminado funcionalidades.
- Inicio B5.1, carga Leeds, atlas SPL B5.2 y parsers originales sin cambios lógicos.
- `ux-shell.css` y `ux-n1.mjs` separados para revertir estilo/UX sin tocar la reconstrucción.

## Fuera de alcance UX-N1
- No es una copia píxel a píxel todavía.
- Los modos 2D y volumen 3D siguen existentes; **Mixto funcional queda para UX-N2**, no inventar botones decorativos.
- El render óseo ámbar es objetivo de UX-N3, no actual segmentación clínica. Fémur, tibia, meniscos y cartílago del mismo estudio no existen sin máscaras y registro B6/B7.
- No se afirma validación por 3D Slicer o aptitud diagnóstica.

## Aceptación
- CI de Chrome 1440×900 y móvil 390 px: estructura, fondo, visibilidad de panel contextual, modificación real de opacidad, importación STL sintética etiquetada, regresión del flujo B5 sin DESS, errores JS y salidas externas.
- Windows PowerShell 5.1 verifica servidor local y rutas de CSS y JS UX-N1.
- Documentar diferencia visual con UX-001 y conservar captura sin estudio en privado si se requiere.
- No subir DICOM, STL ni NRRD al repositorio público. El ZIP Windows completo con DESS se arma privadamente y se conserva con SHA.
- No merge en main/piloto, no deploy. Rollback exacto a rama de diseño `anatheos/design-norte-ux-2026-10-28` y al código B5.2 anterior.
