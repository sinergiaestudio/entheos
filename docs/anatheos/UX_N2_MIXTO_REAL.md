# ANATHEOS 3D · UX-N2 — navegación 2D / 3D / Mixto

**Estado**: en prueba, rama aislada; referencia UX-001 aprobada. No desplegar/mezclar con Entheos productivo.

- Se implementa **Mixto 2D + 3D** con dos `canvas` del **mismo estudio DICOM** en un único visor; los controles de corte recorren los valores de píxel originales mientras el volumen GPU representa el mismo stack.
- La vista 2D sigue siendo DICOM, la derecha es un render volumétrico de intensidades de ese mismo estudio, NO huesos segmentados ni modelos de atlas. No se usan mallas externas SPL en este modo.
- Cambiar entre `3D` y `Mixto` reutiliza el volumen ya preparado y el mismo renderizador WebGL2, sin descargar ni preparar otra textura.
- `2D` libera el volumen, como antes, para evitar uso innecesario de memoria. Al volver a `Mixto` se prepara de nuevo el volumen.
- Controles independientes: clic/rueda sobre 2D para navegar cortes, arrastre/rueda sobre 3D para mover cámara. Botones de zoom existentes siguen operativos sobre el modo activo.
- En móvil se muestran las dos superficies apiladas, sin truncar el contenido.
- Los controles de opacidad del panel derecho operan el **volumen real**, también en Mixto. Procedencia y limitación no diagnóstica se conservan.
- Tests con DICOM generado **sintéticamente**, sin anatomía ni datos personales. No hay necesidad de publicar ni incorporar a la rama un DICOM original de paciente.

**Fuera de alcance**: sincronización de posición anatómica 2D↔3D mediante plano de corte explícito o picking del volumen (UX-N2 posterior), registro de mallas, segmentación, materiales realistas y validación Slicer. No decir que “Mixto” representa fémur/tibia auténticos de Leeds.

**Rollback**: UX-N1 `80d25abb18e3c0908ded4254af3bc8919dbfd2fd`; jamás fusionar main/owner-pilot ni desplegar sin autorización.