# ANATHEOS 3D · UX-N3 · Materialidad de intensidades reales (2026-10-28)

**Estado: implementación experimental aislada. Norte visual: UX-001. No diagnóstico ni segmentación automática.**

## Entrega implementada

- **Original**: conserva el render volumétrico de intensidad R8 previo (por defecto, escala de grises), sin cambios de geometría ni datos.
- **Relieve de intensidad**: incorpora sombreado por gradiente local de los valores de intensidad. La iluminación no implica que un borde sea un hueso o una región segmentada.
- **Ámbar · pseudocolor**: transferencia de color cálida y sombreado por gradiente sobre los **mismos vóxeles**; es un preset estético de visualización, no reconocimiento de fémur/tibia. No sustituye las imágenes DICOM originales.
- **Iluminación de relieve 0–100 %**: respuesta visual ajustable. Los controles se muestran en el panel derecho solamente con un volumen activo y también en las herramientas avanzadas; ambos controles están enlazados y afectan el render real.
- La tecnología es WebGL2 + CPU fallback con diferencias finitas de intensidad, sin dependencias pagas. Los dos métodos tienen tonos/iluminación equivalentes de forma aproximada, sin prometer igualdad píxel a píxel entre GPU y CPU.
- La opción de luz se desactiva funcionalmente en el estilo original, que continúa con la misma composición de intensidades. En los otros estilos se limitan los ray steps a 140 en GPU, protegiendo el tiempo de respuesta. Calidad ajustable sigue disponible.
- La segmentación manual y el resto de funciones DICOM/atlas SPL permanecen accesibles. No hay subida de datos, API remota ni procesamiento fuera de la computadora.

## Aceptación y pruebas

1. Unit tests: estilos originales y restricciones de intensidad de luz (sin nombres anatómicos inventados).
2. Test de navegador con **6 cortes DICOM matemáticos sintéticos**, sin pacientes: comparación del buffer de canvas GPU real entre Original/Relieve/Ámbar, efecto real de ajustar iluminación y comprobación de que volver al estilo Original restaura exactamente la imagen anterior.
3. Test de sincronización entre controles de panel derecho y avanzados; se conserva vista 2D, 3D y Mixto.
4. CI de Windows PowerShell y regresiones previas de DICOM, máscaras, mallas y geometría.
5. El paquete Windows completo usa la resonancia **Leeds original** de 144 cortes, referenciada por SHA-256 y distribuida solamente de forma privada, nunca mediante GitHub público.

## Lo que NO representa

- **No es una superficie ósea** ni se ha segmentado fémur/tibia, cartílago o menisco de Leeds; esa etapa corresponde a B6/B7.
- El pseudocolor ámbar no añade evidencia médica. El objetivo de la vista UX-001 exige datos fuente adecuados, segmentación y controles geométricos antes de atribuir nombres de órganos.
- El sombreado por gradiente no valida orientación RAS/LPS, lateridad, calibración de contraste ni diagnóstico; validación independiente con 3D Slicer pendiente.
- No hay efectos de IA ni clasificación tisular en este incremento.

## Registro de cambios y rollback

Branch: anatheos/ux-n3-volume-materials-lighting. Basada en UX-N2 commit e140683b6cde70f84d4ca752d59ace29c726dae6 (PR #47). PR nuevo en estado DRAFT. Prohibido fusionar con main o owner-pilot y prohibido modificar Entheos en producción sin autorización. No contratar aplicaciones ni servicios pagados.
