# ANATHEOS 3D — UX-N4 · Poda visual y acceso progresivo

**Norte obligatorio:** UX-001, referencia visual aprobada y guardada de forma privada el 28/10/2026. **Rama experimental**, no diagnóstico y no merge/deploy.

## Motivo y decisión

La captura aprobada del usuario prioriza una estación médica oscura, sobria, con visor central protagonista, panel de estudio breve a la izquierda y lista de capas genuinas a la derecha. La versión B7.2 acumuló barras, avisos redundantes, zoom, controles de luz, importaciones, calidad volumétrica y diagnósticos siempre abiertos. Esto resta espacio a los 3 paneles sincronizados y dificulta encontrar tareas frecuentes.

**Principio:** no eliminar funciones, no mover ni alterar sus IDs, sus listeners, el render DICOM, el volumen, la máscara, el generador B6.2, la propuesta B7.1, la extracción SPL ni los mensajes clínicos fundamentales. Solo reubicar controles existentes y agruparlos por frecuencia con `<details>/<summary>` nativos, accesibles desde mouse/teclado. ESC cierra menús.

## UX-N4 implementado

1. Cabecera de 54 px, tres columnas equilibradas (estudio 215–235 px / visor flexible / capas 235–250 px), jerarquía tipográfica y espacios reducidos; lienzo crece a aprox. 78dvh cuando hay espacio.
2. Cinco modos reales visibles en una **barra segmentada compacta**: 2D, Volumen 3D, 2D + 3D, 3 ventanas, Superficies. Permanecen idénticos sus botones/IDs. «Editar» sigue mostrando el editor manual/segmentación avanzada sin alterar lógica. Ampliar y pantalla completa siguen a un clic.
3. «Más herramientas» despliega Ajustar, Zoom +/− y **Liberar memoria**, evitando una acción destructiva siempre junto a los modos. ESC cierra el menú.
4. En el lateral izquierdo, se conserva «Cargar RM de ejemplo · Leeds»; «Importar estudio» despliega el flujo existente de ZIP/carpeta/abrir mi estudio. «Estado y datos técnicos» repliega los avisos pero **se abre solo cuando hay errores**. Fuente/atribución queda a un clic, no se elimina.
5. Panel derecho: la capa RM y las mallas reales continúan visibles; solo «Apariencia 3D» guarda los controles reales de opacidad y estilo/iluminación (IDs originales). «Información y procedencia» guarda explicaciones largas y futuro de anatomía. **La protección que impide presentar SPL como huesos de Leeds permanece.**
6. Bloque volumétrico detallado se muestra solo al abrir «Editar»: el panel derecho sigue permitiendo gestionar opacidad/estilo del mismo volumen. Ninguna opción se elimina de DOM.
7. Diseño responsive, foco visible, native details accesible, sin librerías ni scripts externos. Fallback: si el nuevo módulo de UI falla, la interfaz anterior funciona y permanece visible (la clase CSS nueva solo se activa al inicializarse).

## Validación antes de entrega

- Revisión de 33 tests unitarios del motor B7.2 anterior, preservando DICOM/NRRD/STL, geometría LPS, CPU/GPU y estudio de ejemplo.
- Chromium: verificar ancho de laterales, paneles colapsados, teclado ESC, opciones originales accesibles, editor real, compatibilidad del render original y triple 2D/3D/malla.
- Mantener pruebas previas de UX-N1/N2/N3, B6/B7 y recuperación de geometría. Adaptar **solo las acciones de test** que ahora requieren desplegar «Apariencia 3D» o «Editar»; no eliminar pruebas sustantivas.
- Windows PowerShell 5.1: servidor local debe permitir `ux-clean.css` y `ux-clean.mjs`, verificar HTTP 200 con todas las dependencias y el ZIP DESS empaquetado solo de manera privada.
- Ejemplar B7.2: 144 cortes de Leeds originales sin modificación y SHA256 `1c378e89d3a2e7aa57a1049f1fa91b9278529e544369d1071d4c453073ce951d` para el ZIP del estudio.

## Alcance no resuelto

La poda no implica segmentación automática de fémur, tibia, meniscos o cartílago; todas las capas siguen siendo auténticas máscaras del mismo estudio o el atlas SPL externo en su escena separada. Las hipótesis de tejidos blandos B7.2 no son clasificaciones validadas. No hay registro espacial de planos 2D en los dos 3D, ni reemplazo de diagnóstico. Los controls complejos de segmentación siguen disponibles bajo «Editar».

## Versionado

Rama `anatheos/ux-n4-progressive-disclosure-clean-workbench` derivada de B7.2 hotfix `0971deef9ce2bd23d03e7f0816ddc6f8f6686889`, PR DRAFT, sin merge main/piloto y sin desplegar en Entheos. Rollback literal al hotfix. Sin costo de licencias, suscripciones, aplicaciones externas ni APIs nuevas. Datos reales de pacientes fuera del repositorio público.
