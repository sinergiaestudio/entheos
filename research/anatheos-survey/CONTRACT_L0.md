# SURVEY-BASE L0 · CCG-2026-003

Base inmutable: PR #76 bb86f776afc97eed49c692d8dd7a92aec3a2d9c3. Rama hija separada y PR DRAFT; no integración AFE, registro, fase, volumen, máscaras o modelos.

Entrada: contrato preparado CMR-R2 existente, una sola serie/estudio/FoR declarados, frames con IOP/IPP/PixelSpacing, intensidades decodificadas y rescale/signo, índices y hashes de origen. El lector/decoder no se reescribe. L0 exige hasta tres grupos de orientación y posiciones únicas; no acepta repetición temporal/componentes mezclados. Acceso de UI sólo a localizadores, independiente de volume_eligible, que no se altera.

Geometría: píxel (i columna,j fila) → IPP + i*spacing_col*IOP_row + j*spacing_row*IOP_col. Centros fuente intactos. Contorno de la imagen en bordes de píxel (-0.5,-0.5) a (columns-0.5,rows-0.5), texturas NEAREST. Superficies planas de dibujo no son mallas de tejido. SourceIndex es base cero en el array original, no número de instancia. Texturas R8 son ventana de visualización; arrays uint16/escala originales conservados, no cuantificación clínica.

Autoridad espacial LPS mm; pantalla usa rotación propia [L,S,-P] con determinante +1, sólo cámara, sin convertir archivos a RAS. Intersecciones finitas por planos/aristas/semiespacios en LPS: no lpsToPixel, no inversa #10. Se muestran sólo entre cortes seleccionados de la misma serie; no prueban registro anatómico, inmovilidad o fase. Paralelos/coplanares no tienen línea única.

Tres controles de visibilidad/opacidad/selección. Por defecto un corte seleccionado por grupo; todos los planos siguen cargados y pueden mostrarse juntos. Transparencia por orden de centro aproximada, especialmente en planos que se cruzan: no exactitud de composición ni oclusión anatómica. Bordes por color diferencian grupos sin colorear tejidos.

Espaciado entre centros calculado desde IPP/normal; hueco nominal = distancia entre centros − semisuma de espesores nominales. Valor negativo indica solapamiento nominal; no rellenar ni extruir tejido. Las marcas naranjas sólo indican intervalos nominales sin soporte continuo; no perfil de corte medido. Espesor ausente se informa desconocido. Sin uniformizar pasos irregulares.

Integración: modo planes de la misma estación, mismo estudio activo y renderer SurfaceRenderer ampliado con quads texturados/líneas; métodos previos de mallas mantienen defaults. Liberar texturas/VAO/buffers/handlers/observer al volver, cerrar, cambiar serie o reimportar; impedir estado residual. Sin persistencia en navegador ni envío externo.

Entrega portable privada: misma estación y datos SURVEY preparados por R2; servidor estático loopback Windows PowerShell, sin Python para el titular, sin instalar o actualizar 0.11.1. Verifica manifest de archivos; sólo GET/HEAD, Host/origen local, no escritura/ejecución/ingesta nueva de ZIP. La importación original completa sigue disponible en la instalación existente. El paquete privado nunca es artefacto público de CI.

QA: fantomas DICOM sintéticos oblicuos/anisótropos con fiduciales no simétricos, bounds de medio píxel, FOV finito, rechazo de mezcla, texturas/rotación/capas/alpha/cierre/reapertura. Caso público MR_small de pydicom sólo como fixture de datos abierto, sin pruebas Leeds. Comparación numérica independiente de ecuación DICOM; Slicer si disponible se informa separado, nunca se simula. Windows CI no implica aceptación física del titular.

Privacidad: código/tests sin DICOM, poses, UID, píxeles, capturas o catálogos clínicos. Datos de paciente únicamente fuera del repo y en Drive owner-only. CSP local y sin cache para archivos preparados. Verificar SHA/recuperación de distribución y evidencia privadas. CINE-01.0 congelado, 11 candidatas sin promover a volumen, R1-R4/#10 abiertos.

## Comprobación independiente predeclarada

Comparar centros y cuatro esquinas de cada plano contra SimpleITK/GDCM, lectura independiente de los originales DICOM. Tolerancia de redondeo de ingeniería: error euclídeo máximo ≤ 0,001 mm, fijada antes de ejecutar la comparación; no expresa precisión clínica. Sin Slicer disponible, registrar SKIP de contraste visual Slicer y conservar la comprobación numérica como alternativa explícita.
