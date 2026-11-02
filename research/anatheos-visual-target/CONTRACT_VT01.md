# CCG-2026-005 · VISUAL-TARGET-01 / L1.1

Nueva rama desde PR78 HEAD 1d05135b36aa5336db304b8ee15eac284742bfcf; PR separado DRAFT. Extensión de presentación autorizada por titular y orden #78/6566869072; no algoritmo de reconstrucción o registro nuevo. Reutilizar VolumeRenderer, campo L1, máscaras/fuentes y lanzador local. Conservar L1 anterior accesible para regresión. No modificar survey-field.mjs, spatial-reference.mjs ni inversa #10.

## Implementación y aceptación

1. Presentar volumen central ray casting con planos 3D ocultos por defecto y tres paneles MPR subordinados. Sin planos, el volumen permanece. El campo, no tres láminas, produce la señal. No IA/fotografías/texturas sin fuente.
2. Tres secciones en ejes físicos i/j/k de UNA pila. Ejes corresponden a r/c/n DICOM de la pila, no ejes anatómicos cardinales supuestos. Mostrar normal LPS, dirección/oblicuidad y nombre de equivalencia dominante. MPR siempre DERIVADA. Sólo la vista independiente de fuente usa ORIGINAL DICOM y su SourceIndex/hash; coincidencia de MPR k con un original no convierte el MPR en adquisición nueva.
3. Cursor común [i,j,k] de centros de campo. Sección y crosshair de las tres vistas comparten ese punto LPS forward. z no uniforme usa LUT física/neighbour existente, sin interpolar más ni uniformizar datos. MPR display NEAREST y mm en ambos ejes; no mostrar z irregular como píxeles isotrópicos adquiridos. Marco/plano/intersecciones/alpha conmutables.
4. Recorte por medio espacio en coordenadas métricas locales de campo (misma base ortonormal con mapeo LPS forward). Normal i/j/k o normal oblicua paramétrica, punto conocido del cursor y desplazamiento mm; retirar lado seleccionable. Cara de sección se muestrea analíticamente del MISMO campo/máscara; no tapa sólida inventada, normal tisular, segmentación o malla. Ocultar NO_DATA, estimado/nominal según flags también en cara y MPR.
5. Arrastre del corte: proyección de su normal conocida a la cámara y resolución de un único desplazamiento escalar; no inversa mundo→píxel, lpsToPixel o contrato compartido. Si proyección degenerada, rechazar ese arrastre y pedir deslizador/cámara. Traslación ortogonal selecciona centro de campo más cercano; oblicuo usa offset mm explícito. La resolución sigue siendo del campo L1.
6. Legibilidad: función transferencia de señal, gamma/display, opacidad/umbral y presets de sesión; histograma adquirido de esta pila. No clasificación tisular. Sólo adquirido conserva huecos/NO_DATA; nominal e interpolado con apagado independiente. Sin almacenamiento clínico nuevo en navegador.

## Gates antes de entrega

Fantoma anisótropo/oblicuo y público: forward de cursor/corners/intersecciones; signo de recorte y cara; cambio de sección modifica mismo volumen; origen vs MPR y error Float32/R8 dentro de límites L1. Tolerancia numérica de geometría 0,001 mm, no precisión clínica; ninguna nueva interpolación de intensidad. NO_DATA transparente, cero adquirido distinguible, estimación apagada, no fusión. L1 y renderer GPU previo sin flags nuevos mantienen comportamiento. UI Linux/Windows real loopback: cámara, 3 MPR, corte oblicuo, arrastre/teclado, soporte, comparación fuente y limpieza de recursos/cambio de estudio. Capturas/video público sólo sintéticos o datos abiertos. SURVEY real/evidencia exclusivamente Drive privado; aceptación física titular no simulada.

Nueva UX habilitada sólo por entrada VISUAL-TARGET-01; el L1 anterior mantiene controles/comportamiento. Native/Slicer sólo si disponible; si bloqueado conservar prueba alternativa y declarar. No repetir Leeds. Registrar memoria tipada versus heap/driver, latencia sincronizada versus envío CPU; no alegar FPS de hardware físico a partir de SwiftShader.

## Límites y futuro

Las tres orientaciones SURVEY siguen como fuentes independientes seleccionables, no fusionadas. Preparar slots por fuente/base/procedencia no autoriza registro, normalización de contrastes o fusión. AFE L2 pendiente, CINE-01.0 congelado, once subpilas sin promover; sin segmentación clínica, malla cerrada, AFE-02B, main/piloto/producción/merge/deploy/gastos. Portable Windows separado de 0.11.1, cerrar/borrar carpeta rollback. Drive owner-only; SHA/retorno/CRC/manifiestos, paquetes de evidencia <14 MB para no repetir truncación del conector.
