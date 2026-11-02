# CCG-2026-004 · SURVEY L1-A/L1-C · contrato v1

Rama hija de #77 / 3c925416f28658a4f49c05c58079f6789ff4c530. Desarrollo autorizado por #6/6565789792 y #77/6565794865. Experimental privado; aceptación física y auditoría AFE pendientes. Sin fusión interorientación, fase común, tejido, malla o AFE.

## Campo espacial y procedencia

Una orientación homogénea de 20 originales a la vez. Reutilizar CMR-R2 y forward L0. No cambiar spatial-reference ni usar inversa #10. La base local ortonormal de la pila conserva origen/direcciones LPS; cámara gira sobre ejes propios de la pila, no etiquetas anatómicas inferidas. Contraste/adquisición estables; IOP diferencia máxima 1e-6 y desplazamiento lateral ≤0,001 mm como límites de redondeo de ingeniería, no registro clínico. Rechazar excedentes sin corregirlos. Espesor nominal positivo obligatorio.

Grid rectilíneo: x/y centros originales, un píxel NO_DATA de halo; z físico NO UNIFORME, subdivisión de cada intervalo con paso ≤menor PixelSpacing, conservando exactamente cada posición original y dos extremos fuera de soporte. Límites 256 niveles/8 M vóxeles. LUT física z→capa mediante búsqueda binaria en GPU, sin uniformizar la separación original. NEAREST de display para evitar mezcla oculta al desactivar estimación. No aumento de resolución anatómica; detalle longitudinal sigue limitado por adquisición. Cada celda representa su muestra central, no un espesor adquirido medido.

Valores Float32 derivados; datos fuente uint16 y rescale originales conservados. R8 sólo display con rango fijo determinista; error máximo de cuantización ≤rango/510 más redondeo. NO_DATA=NaN en campo y máscara 0, jamás intensidad cero. Cero adquirido conserva máscara 1.

Estados del CENTRO de vóxel:
1. ADQUIRIDO: coincide con un centro original (tolerancia numérica 1e-7 mm), lateral original. Representación discreta finita no acredita tejido continuo.
2. SOPORTE NOMINAL: dentro de semi-espesor declarado de al menos un original. Copia del plano nominal más cercano (empate determinista), NO medición del perfil ni anatomía adquirida fuera del plano. Solapamientos no se promedian.
3. ESTIMADO: fuera del soporte nominal pero entre dos centros de la misma pila, interpolación lineal exclusivamente longitudinal con ambos SourceIndex/pesos. Se puede apagar sin cambiar fuentes, grid ni clases restantes.
0. NO_DATA: fuera del soporte/intervalo lateral o longitudinal; NaN, siempre transparente. Desactivar estimado convierte su contribución visible en ausente, no cero. Soporte nominal tiene apagado independiente.

Atlas fuentes por capa, SourceIndex base cero, hash fuente, posición física y pesos. Reproyección en los 20 planos originales debe reproducir exactamente valores reescalados antes de Float32; tolerancia relativa Float32 1e-6; geometría de centros/esquinas ≤0,001 mm; R8 rango/510. Las tolerancias son de software, no clínicas.

## Visualización / nube

Reutilizar VolumeRenderer ray casting, opt-in surveyL1 y defaults anteriores intactos. Volumen con opacidad, umbral de señal, recorte, máscara de procedencia visible y plano original seleccionado ocultable. Etiqueta permanente «volumen exploratorio derivado SURVEY · baja resolución · no diagnóstico». Sin WebGL2, rechazar L1 de forma clara; no usar CPU antigua que desconoce NO_DATA. Fuentes y estados visibles en inspector. Recurso liberado al cerrar/cambiar/volver L0.

Nube de muestras adquiridas determinista, submuestreo lateral con stride declarado; posición LPS, índice de píxel, fuente, valor y clase por punto. Puntos estimados opt-in separados con dos fuentes/pesos. Tres terciles de señal de las muestras adquiridas de ESTA pila, no umbral universal MR, no etiqueta anatómica, probabilidad clínica o segmentación. No malla. Modo nube reutiliza canvas/cámara del renderizador, no otro visor/aplicación.

## L1-B: contrato de NO fusión para AFE

Estado FUSIÓN BLOQUEADA. No registrar, corregir, normalizar contrastes ni fusionar en esta versión. Mismo FoR sólo permite comparar coordenadas declaradas. Falta de gating, movimiento y respuestas MR impide usar coincidencia geométrica como validación anatómica.

Antes de analizar correspondencia, AFE debe auditar: fuentes/componentes/identidad y geometría, resolución efectiva/espesor/contraste; regiones comunes realmente observadas; landmarks verdaderamente homólogos en intersecciones (no centroides de secciones distintas), anotación repetida y revisor competente; incertidumbre de muestreo/posición/movimiento y contraste. Valores desconocidos no son cero. Criterios propuestos de ingeniería para debate, no aplicados al paciente: discrepancia numérica de mapeo ≤0,001 mm; homología y repetibilidad documentadas ≤1 píxel peor muestreado; residual más incertidumbre ≤1 píxel peor muestreado en todos los controles, sin excluir discordantes retrospectivamente; fuera de plano acotado ≤mitad del menor entre espesor y paso; sensibilidad con cotas 0,5×/2× sin promoción del resultado fallido primario. Esas cotas NO prueban inmovilidad cardíaca. Exigir revisión competente de movimiento/gating/cobertura y validación independiente. Sin ello: SOLO CAPAS SEPARADAS/BLOQUEADO.

Prueba falsable sintética: dos orientaciones del mismo fantoma y poses forward deben coincidir en puntos de mundo de construcción conocida; desplazar una adquisición conocida debe FALLAR la cota de discrepancia. No algoritmo registrador, inversa compartida o fusión operativo. Ningún PASS sintético valida correspondencia del paciente. CCG debe ser consultado antes de implementar un nuevo algoritmo/contrato espacial.

## Gates / privacidad / rollback

Sintéticos anisótropos/oblicuos con huecos/ceros, inversión de orden, drift, temporalidad/contraste mixtos, NO_DATA y reproyección; fixture MR público. Pruebas GPU de volumen auténtico (sin planos), rotación/clip/opacidad/estimación/nominal/nube, fuentes, grupos, reapertura y liberación; Linux y Windows con lanzador real. Privado: SURVEY original, capturas a ambas resoluciones y comparación independiente; nunca en GitHub/CI. Rendimiento/memoria declarados con backend; no presentar SwiftShader como GPU física. No Leeds ni cine.

Portable local Windows con el servidor loopback verificado L0, archivos permitidos/hashes/CSP, sin sustitución 0.11.1 ni cambios de datos. Cerrar/borrar carpeta es rollback. Drive owner-only, retorno SHA/CRC/manifiestos. No costes/servicios externos/merge/deploy/producción. Once subpilas continúan sin habilitar.

## Referencias primarias

DICOM Image Plane Module (PS3.3 C.7.6.2): https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_C.7.6.2.html — centros/direcciones/spacing y carácter nominal de SliceThickness. SimpleITK ResampleImageFilter: https://simpleitk.org/doxygen/latest/html/classitk_1_1simple_1_1ResampleImageFilter.html — interpolador y valor fuera del dominio son decisiones explícitas; aquí la clase de soporte no se interpola y NO_DATA lleva máscara propia. Las referencias no validan el método exploratorio ni los umbrales propuestos: AFE mantiene su revisión independiente.
