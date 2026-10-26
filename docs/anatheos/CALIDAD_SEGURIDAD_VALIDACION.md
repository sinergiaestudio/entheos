# ANATHEOS 3D — Plan de calidad, seguridad y validación

**Estado:** plan de pruebas exigible por hito, no certificado médico.
**Principio:** las pruebas automáticas de código prueban comportamiento especificado, no validan por sí mismas fidelidad clínica.

## 1. Niveles de verificación que deben informarse separadamente

1. **Planificado:** hay una especificación y criterios, no código.
2. **Codificado:** existe commit visible; el hecho no asegura ejecución.
3. **Build/CI:** lint, typecheck, tests y build pasan en SHA preciso.
4. **Probado funcionalmente:** pruebas manuales y automáticas con evidencias reproducibles.
5. **Validado geométricamente:** coordenadas, orientación, medidas y cortes contra estándar DICOM y referencia 3D Slicer.
6. **Desplegado:** URL/instancia comprobada, con commit deploy y configuración separada.
7. **Acceso auditado:** anónimo, otro usuario y propietario; fallos cerrados.
8. **Validado clínicamente:** solo después de proceso formal específico; jamás inferir por pasar etapas anteriores.

## 2. Batería DICOM de entrada (datos sintéticos o públicamente desidentificados)

| Grupo | Casos de prueba exigidos | Resultado esperado |
|---|---|---|
| Sintaxis | Explicit/Implicit LE, compresión admitida/no admitida, error deliberado, VR malformado | Decodificación correcta o rechazo explícito |
| Intensidad | 8/16 bits, signed/unsigned, Rescale Slope/Intercept, MONOCHROME1/2, ventana | Valores y niveles reproducibles |
| Frames | Un frame, enhanced multiframe, mezcla incorrecta, UIDs duplicados | Agrupación correcta o diagnóstico de incompatibilidad |
| Geometría | Orden inverso, spacing anisotrópico, orientación oblicua, gantry tilt, desplazamiento en plano, cortes faltantes, posiciones repetidas | Affine correcto o rechazo seguro |
| Orientación | Izquierda/derecha, anterior/posterior, craneal/caudal, cambios LPS/RAS, flips | Sin lateralidad invertida |
| Series | Dos series dentro del mismo estudio, localizer, secuencias diferentes, CT vs MRI | Separación y advertencias |
| Archivos hostiles | Truncados, declarados gigantes, encapsulados, caracteres inesperados, longitud indefinida, alta cantidad de frames | Límites y errores controlados; no freeze/escape |
| Recursos | Estudios grandes, memoria limitada, cancelación, navegación rápida, WebGL no disponible | Fallback o mensaje; liberación de buffers |
| Privacidad | Nombres/información en tags y/o píxeles, logger, telemetría, URLs | PHI no aparece en Git/CI/logs |
| Exportación | Escala, orientación, unidades, transformación, vínculo a original | Archivo derivado consistente y trazable |

## 3. Referencia geométrica y tolerancias

No fijar una tolerancia médica universal sin caso de uso ni resolución de entrada. Para cada dataset:
- documentar spacing, dimensiones, posición, orientación, frame de referencia y tipo de adquisición;
- preparar puntos de referencia en coordenadas de voxel y paciente, incluyendo ambos laterales;
- calcular coordenadas físicas con la transformación oficial DICOM (IOP/IPP/PixelSpacing y posiciones);
- contrastar puntos y distancias contra 3D Slicer y, cuando corresponda, un phantom de geometría conocida;
- usar tolerancia numérica derivada de precisión del cálculo y una tolerancia visual/acústica dependiente del voxel; publicar los valores definidos *antes* de ejecutar pruebas;
- ensayar series oblicuas/no uniformes y prohibir MPR ficticia o visualmente plausible pero físicamente falsa;
- distinguir intensidades del original, interpolación y valores tras remuestreo.

Se rechaza la aceptación por captura bonita o percepción subjetiva de semejanza. Documentar versión de Slicer, dataset/serie, comandos/repro, resultados y discrepancias.

## 4. Plan de automatización y evidencias

- GitHub Actions sobre pull requests a la rama piloto: instalación reproducible, lint, TypeScript, test, build, dependencias/SBOM, regresiones DICOM; cada PR debe mostrar link y commit HEAD.
- Unit tests: parsers, geometría, transformaciones, intensidad/ventana, validadores, redondeo, serialización y errores.
- Integration tests: apertura de series, paso de corte a volumen, aislamiento entre series, revocación y abandono de sesión.
- UI/e2e: carga, seleccionar serie, navegar, reset, teclado, no bloqueos, WebGL fallback, mensajes de fallo, acceso no autorizado.
- Seguridad: identidad server-side, rutas derivadas, CORS/CSP/CSRF, headers no-store, archivos fuera de límites, desidentificación y ausencia de PHI en artefactos.
- Visual regression: sólo datos sintéticos, con versiones de entorno, ejes visibles y comparación controlada.
- Performance profiling: conjunto pequeño/mediano/grande con hardware, navegador, GPU/RAM, tiempo de carga, FPS e incidencia de errores.
- Manual exploratory: reproducir en escritorio Windows actual y al menos un navegador alternativo; móvil se valida antes de declarar soporte.

Toda prueba registra PASS/FAIL/BLOCKED/SKIPPED; se prohíbe contar SKIPPED como PASS.

## 5. Puertas de calidad

**Q0 — Gobernanza:** plan, ADR y issue/PR correctamente vinculados.
**Q1 — Código:** CI verde en HEAD preciso, revisión de cambios y dependencias/licencias.
**Q2 — Seguridad:** no PHI ni secretos, rutas cerradas sin autenticación, tamaño/CPU controlado.
**Q3 — Imagen:** geometría/lateralidad/escala verificadas con casos adversos; documentación de compatibilidad.
**Q4 — Experiencia:** el usuario entiende fuente, estado, límites y modelo 3D; no se confunde con interpretación clínica.
**Q5 — Entorno:** staging aislado, rollback documentado, no acceso productivo ni usuarios no autorizados.
**Q6 — Apertura:** autorización formal para terceros más evaluación de privacidad, licencias y regulación.

No cerrar un issue geométrico por CI verde si Q3 está pendiente; mantenerlo como parcialmente implementado.

## 6. Seguridad y datos

**Datos de desarrollo:** sintetizados o estudios públicos revisados por licencia y anonimización efectiva. Evitar identificadores, anotaciones quemadas en píxeles, tags privados sensibles, UID trazables y metadatos reales en un repositorio público.

**Almacenamiento:** no usar D1/R2 productivos para un prototipo ni persistir estudios por defecto; si se autoriza persistencia, cifrado, segregación, TTL/retención, acceso y restauración son requisitos previos.

**Códigos y logs:** ningún console.log de metadatos sensibles, nombres de archivo de paciente ni contenidos; los informes CI sólo revelan contadores y datasets sintéticos.

**Dependencias:** mantener inventario de versión, licencia del software y por separado licencia de pesos de modelos AI; verificar compatibilidad redistribución y disponibilidad offline. No asumir que repositorio open source implica pesos libres para uso comercial.

**Incidentes:** ante fuga probable, acceso no autorizado, orientación invertida o resultado médico engañoso, detener difusión, abrir issue P0 con detalles sanitizados, preservar evidencia técnica sin PHI, corregir y repetir test antes de reabrir.

## 7. Riesgos regulatorios

El piloto es un prototipo exploratorio privado. Cualquier finalidad de diagnóstico, prevención, manejo clínico o planificación puede cambiar el encuadre según ANMAT Disposición 64/2025 y guías vigentes. Antes de abrir a terceros debe existir revisión regulatoria profesional, documentación de finalidad prevista y evaluación formal del producto, además de la protección de datos personales.

Fuente: https://www.argentina.gob.ar/noticias/anmat-actualiza-los-criterios-regulatorios-para-software-como-dispositivo-medico-samd
