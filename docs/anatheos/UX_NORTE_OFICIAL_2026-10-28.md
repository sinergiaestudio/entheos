# ANATHEOS 3D — NORTE DE DISEÑO OFICIAL
**Referencia aprobada por el titular · 2026-10-28 · Baseline UX-001 · ESTADO: OBJETIVO, NO IMPLEMENTACIÓN**

> DECISIÓN DE PRODUCTO. La captura UX-001 define el destino visual, de interacción y de calidad perceptual del visor ANATHEOS 3D. No reemplazarla silenciosamente por otro estilo ni considerarla un mero boceto opcional. Cualquier cambio material de dirección requiere revisión del titular. Esta decisión persiste a través de las fases B5, B6, B7 y posteriores.

## 1. Evidencia canónica, trazabilidad y custodia

- **Referencia exacta**: `ANATHEOS_3D_UX_NORTE_REFERENCIA_APROBADA_2026-10-28.png`.
- Dimensiones: **1085 × 525 px**, PNG RGBA.
- SHA-256 **`d10c142fe8cbdeed10f25c40c6701c0566f444ec93965a16b97e925f46a5dd10`**.
- Ubicación: carpeta **privada** `02 · Backups de código y documentación` de ANATHEOS en Google Drive.
- Enlace propietario, de acceso restringido: https://drive.google.com/file/d/1-awXrinldFsKbgkVrAhsP_RxZH42JWxp/view
- La captura NO se sube al repositorio público: esta referencia ilustra anatomía, por lo que se mantiene en almacenamiento privado y el repositorio conserva únicamente la especificación y su checksum.
- **Importante**: la captura contiene un render de referencia conceptual, no una prueba de segmentación de Leeds, de identificación de meniscos/cartílago, de precisión diagnóstica ni de registro anatómico. El texto "RM rodilla · 144 cortes" y las capas dibujadas son elementos de la propuesta, no resultados certificados.

## 2. Qué se aprueba: experiencia completa, no solo una paleta

La aspiración es reproducir la **sensación de una estación médica 3D profesional**, con la siguiente composición e intención estética:

### Estructura en tres zonas, visor central dominante
1. **Panel izquierdo / Estudio**: identificación del estudio activo; modalidad, región, serie, número de cortes; estados entendibles como "Serie DESS", "Volumen listo" y "Segmentación" con progreso y procedencia reales. Mostrar sólo lo esencial, con navegación simple.
2. **Centro / Visualización**: escena 3D médica protagonista, amplia, con fondo oscuro azulado, una anatomía central bien recortada, rotación y zoom fluidos. Navegación discreta entre **2D, 3D y Mixto** dentro o inmediatamente debajo del visor. La visualización es el producto, no un rincón entre decenas de controles.
3. **Derecha / Capas**: listado semántico de estructuras con muestra cromática, icono mostrar/ocultar, ajuste de opacidad, aislamiento y selección; la escala visual debe ser limpia, de lectura inmediata, no un editor técnico saturado.

### Estética y jerarquía
- **Modo oscuro sobrio como identidad primaria**: negros cálidos y carbón profundo para el marco; visor azul petróleo/nocturno. Paneles integrados, separados mediante espacio y divisores muy discretos, sin encajonar cada función en tarjetas ruidosas.
- **Tipografía sans serif** contemporánea, legible, con jerarquías cortas: nombre ANATHEOS 3D contundente, encabezados de panel de peso medio/fuerte, metadatos pequeños pero legibles; consistencia de tamaños, espaciado y alineación.
- **Contraste controlado**: texto primario marfil/gris claro; secundarios gris medio accesible; acentos contenidos y funcionales. No utilizar saturación excesiva de botones, badges, iconos o colores de interfaz.
- **Geometría visual**: radios moderados (visor/card) y grandes márgenes negativos. Composición estable, con tres columnas y un centro claramente prioritario.
- **Movimiento discreto**: los gestos 3D y transiciones ayudan a orientarse; animaciones decorativas no deben retrasar carga ni impedir accesibilidad.
- **Calidad de render objetivo**: anatomía convincente, tridimensional, con iluminación, profundidad, transparencia, materialidad y transferencia de color refinadas. El tono dorado/ámbar de la referencia se toma como **preset estético opcional**, jamás como prueba de que se reconstruyeron huesos del estudio real.

### Lo que debe sentirse en el uso
Abrir → detectar/leer estudio → preparar volumen → mostrar imagen y controles relevantes, sin secuencia de scripts, descargas, menús, imports y ejecuciones. Opciones avanzadas y editores manuales aparecen **bajo demanda**, no ocupan la vista por defecto.

## 3. Modelo de vista y capas, con procedencia obligatoria

El ejemplo visual contiene las etiquetas **Imagen RM, Fémur, Tibia, Cartílago y Meniscos**. Son categorías aspiracionales de la experiencia final, NO capas generadas por la versión B5.2.

**Regla vinculante de representación**:
- Toda capa anatómica real debe vincularse a `study_uid/series_uid`, espacio de coordenadas, fuente y versión de segmentación; indicar estado: *original*, *derivada automáticamente*, *corregida manualmente*, *importada/atlas externo*, *no disponible* o *requiere revisión*.
- **No dibujar ni habilitar como anatomía reconocida** Fémur/Tibia/Cartílago/Meniscos si aún no existe una máscara, una segmentación o una malla real y físicamente compatible con el estudio activo.
- Las superficies SPL son de otro espécimen: mantenerlas segregadas del estudio Leeds y etiquetadas como referencia externa. No superponer ni ofrecer comparación espacial sin registro y validación expresa.
- Los controles de opacidad, visibilidad, aislamiento, color y presets deben estar ligados a capas realmente presentes y surtir efecto verificable sobre el render, no ser decorativos.
- No fabricar anatomía para acercarse a la captura. No introducir un render falso en resultados clínicos. En demos, los ejemplos sintéticos deben identificarse explícitamente.
- Preservar fidelidad DICOM en cortes; el volumen 3D es visualización y la segmentación implica un procesamiento adicional que debe explicitarse.

## 4. Sistema de diseño candidato (no son colores exactos extraídos de la imagen)

Los siguientes valores iniciales aproximan el lenguaje visual y deben contrastarse visualmente con la captura al implementar; no alegar equivalencia píxel a píxel.

| Token | Propuesta | Uso |
|---|---|---|
| `--anat-bg` | `#080A0C` | Fondo principal oscuro |
| `--anat-panel` | `#0E1216` | Paneles laterales |
| `--anat-viewport` | `#15232F` | Visor 3D, azul oscuro |
| `--anat-divider` | `#242C31` | Separadores |
| `--anat-text` | `#EBEEF0` | Texto primario |
| `--anat-muted` | `#A6B0B7` | Metadatos |
| `--anat-accent` | `#57A5B2` | Selección/control activo |
| `--anat-bone` | `#CDAF87` | Mallas óseas, sólo cuando existen |
| `--anat-bone-secondary` | `#E8BE83` | Segunda estructura ósea |
| `--anat-cartilage` | `#5EB6B5` | Cartílago confirmado |
| `--anat-meniscus` | `#ADA2D4` | Menisco confirmado |
| `--anat-font` | `system-ui, "Segoe UI", Arial, sans-serif` | Tipografía libre de pagos/fuentes externas |

Los colores de estructura son *convenciones de UI*, nunca etiquetas clínicas inferidas del color de una imagen.

## 5. Funciones objetivo y fases de entrega

1. **UX-N1 — Estructura:** layout oscuro de tres columnas, tipografía, jerarquía, visor central dominante, panel de estudio, capas contextuales, estados vacíos y responsividad. Mantener todas las capacidades actuales accesibles desde controles avanzados. No degradar 2D, volumen DESS ni editor manual.
2. **UX-N2 — Navegación unificada:** conmutador 2D / 3D / Mixto, cámara coherente, zoom, rotación, controles flotantes discretos, carga automática del estudio de ejemplo, abrir estudio propio en una acción.
3. **UX-N3 — Materiales y visualización:** presets de render de volumen DICOM con iluminación y transparencia controlables, rendimiento y seguridad de memoria; distinguir claramente volumen de intensidad y mallas segmentadas. La similitud del render con la captura requiere **datos fuente adecuados**: no fingir fémur/tibia derivados cuando aún no existen.
4. **UX-N4 — Capas anatómicas auténticas:** enlazar máscaras/mallas del **mismo estudio** (B6/B7), procedencia, calidad, estado de revisión, mostrar/ocultar, opacidad por capa y controles de edición.
5. **UX-N5 — Aceptación visual/operativa:** capturas comparativas a resoluciones representativas, inspección con datos genuinos, pruebas de carga y navegación, accesibilidad básica, rendimiento en Windows y firma/aprobación del titular.

**Orden de precedencia:** UX-N1 y UX-N2 pueden avanzar sin esperar reconocimiento anatómico; UX-N3 por presets sustentados en la información real; UX-N4 exige resultados geométricos reales; UX-N5 requiere demostrarlo con evidencia.

## 6. Criterios de aceptación que NO deben omitirse

- [ ] La primera pantalla conserva la composición **Estudio | escena central dominante | Capas**.
- [ ] La estética oscura, tipografías, márgenes, iconografía y contraste guardan fidelidad global con UX-001.
- [ ] **2D / 3D / Mixto** son modos funcionales, no botones decorativos.
- [ ] El render 3D se puede girar, acercar, recortar y cambiar de opacidad sin estados incoherentes.
- [ ] Las capas controlan únicamente objetos presentes y muestran fuente, estado y procedencia.
- [ ] El flujo básico no exige ejecutar comandos ni importar manualmente recursos para visualizar el estudio incluido.
- [ ] La descarga de recursos externos de referencia requiere consentimiento/acción, fuente fijada y SHA-256; los modelos externos no pasan por estructuras del propio paciente.
- [ ] No se usan servicios, licencias ni APIs pagas; la distribución continúa siendo local.
- [ ] No se publica DICOM, STL, NRRD ni capturas médicas en el repositorio público; la captura UX-001 queda en Drive privado.
- [ ] CI de Windows + navegador y verificación de rollback antes de cada entrega.
- [ ] La comparación visual se hace contra **el PNG exacto UX-001** (SHA conocido), y se registran diferencias y decisiones; aprobación final por el titular.

## 7. Restricciones permanentes de ingeniería

- Repositorio `sinergiaestudio/entheos`, ramas separadas, PR **DRAFT** y commits identificables. **Nunca fusionar con `main` ni rama piloto, ni desplegar Entheos sin autorización posterior.**
- Versiones previas conservadas para rollback. No sobreescribir datasets locales ni distribuir datos de pacientes.
- No contratar aplicaciones, licencias, suscripciones, infra o APIs adicionales; consultar cualquier gasto de infraestructura antes.
- No afirmar utilidad diagnóstica, registro anatómico formal o segmentación automática sin haber demostrado cada capacidad.

## 8. Regla de continuidad

Al empezar cada etapa B5/B6/B7, **leer este archivo y consultar UX-001**. En todo checkpoint declarar explícitamente: qué parte de la captura está implementada, qué falta y qué elementos de la visualización dependen de segmentación del propio estudio. No cambiar de norte porque cambie la conversación, los tokens o la persona que retome el trabajo.
