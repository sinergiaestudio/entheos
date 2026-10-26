# ANATHEOS 3D — Plan maestro de desarrollo

**Versión:** 1.0 | **Fecha:** 2026-10-26 | **Estado:** plan de referencia aprobado para organizar la ejecución; no equivale a implementación.
**Responsabilidad:** Dirección de ANATHEOS 3D, con ejecución técnica por desarrollador/agente y control final del titular.
**Alcance:** piloto privado en Entheos y proyección futura a pacientes y profesionales.

## 1. Visión y alcance

ANATHEOS 3D será una plataforma de exploración de imágenes médicas que acepta adquisiciones DICOM compatibles (TC y RM inicialmente), verifica datos de adquisición y geometría, visualiza cortes originales y reconstrucciones multiplanares (MPR) y renderiza volúmenes tridimensionales. Las fases posteriores incluirán segmentación anatómica, mallas 3D, exportación, historia de estudios y colaboración autorizada. El sistema nunca debe presentar como un hallazgo clínico la salida de una reconstrucción meramente gráfica.

### Usuarios y escenarios

- **Titular privado — fase piloto:** abre archivos locales, navega axial/coronal/sagital y volumen 3D, ajusta window/level, verifica calidad y descarta el contenido de la sesión.
- **Profesional — evolución:** revisa imágenes originales junto a reconstrucciones, examina mediciones y segmentaciones con procedencia, edita y acepta/rechaza sugerencias; no existe aún flujo habilitado para terceros.
- **Paciente — evolución:** interfaz explicativa simplificada, acceso a su propio estudio y compartición revocable; nunca confundir información educativa con diagnóstico.
- **Institución — fase posterior y separada:** roles, consentimiento, interoperabilidad y retención, auditoría y requisitos legales/regulatorios específicos.

### Dentro del MVP de uso privado

1. Carga de series locales TC/RM DICOM, agrupación y clasificación de compatibilidad.
2. Verificación de integridad, orientación, spacing, relación entre frames, geometría y procedencia.
3. Visor de cortes originales, navegación MPR geométricamente correcta, control de ventana y presets.
4. Renderizado volumétrico 3D interactivo, corte/clipping y controles de opacidad, sin alterar originales.
5. Manejo transparente de estudios no soportados y medición instrumental donde esté verificada.
6. Uso local o entorno aislado de propietario único, sin exponer estudios por Internet ni suscribir proveedores pagos.
7. Tests automáticos, experimentos con datos públicos desidentificados y comparación con 3D Slicer.

### Fuera del MVP

Detección de enfermedades, propuestas terapéuticas, triaje, informe radiológico automático, diagnóstico sin supervisión, uso para planificación quirúrgica, renderizados "inventados", reconstrucción de anatomía que el estudio no captó, generación de datos inexistentes por IA, comercialización y apertura de cuentas de terceros.

## 2. Invariantes del proyecto

- Costo de licencias y APIs de pago en piloto: **cero**. No activar SaaS, servicios premium ni costos adicionales sin autorización expresa. Hardware, electricidad y alojamiento podrían tener costos; se documentan antes de decidir.
- Entheos productivo, rama main, D1, R2, autenticación e integraciones permanecen intactos hasta decisión explícita.
- GitHub es un repositorio **público**: no guardar archivos DICOM clínicos reales, nombres de pacientes, tokens, contraseñas, respaldos o identificadores sensibles.
- El original de imagen es inmutable; todo derivado documenta software, versión, origen, transformaciones, fecha, parámetros, relación con referencias y revisión.
- La rama de GitHub no es control de acceso: el piloto requiere verificación del propietario del lado del servidor y alojamiento separado probado.
- La aceptación de código y la autorización de una publicación son decisiones independientes.
- Este chat coordina y audita; el chat de desarrollo programa. Ambos sincronizan mediante Issues, PR y documentos versionados de GitHub.

## 3. Fases, hitos, entregables y puertas de salida

### Fase G0 — Gobierno, inventario y baseline (primera)

**Objetivo:** impedir pérdida de contexto y proteger Entheos.
**Trabajo:** inventariar código/funciones existentes y riesgos; crear documentos maestros, decisiones y tablero de Issues; identificar versión base, prueba CI, política de ramas y revisión. Definir roles y protocolo de comunicación con desarrollador.
**Entregables:** este plan, índice, arquitectura, seguridad/QA, decisiones, registro vivo de estado, issues trazables y prompt de implementación.
**Salida:** referencias accesibles, sin confusión entre implementado/probado/desplegado; main indemne; cero PHI o secretos en Git.

### Fase G1 — Fundaciones de seguridad y laboratorio reproducible

**Objetivo:** entorno técnico verificable sin tocar la producción.
**Trabajo:** definir preview local y posteriormente Site aislado; autorización exclusiva (APP_OWNER_EMAIL o identidad única fiable), fail-closed en páginas y API; aislamiento de cualquier dato y origen; configuración reproducible y noindex/no-store; revisar bundle/browser constraints; tests adversariales de acceso anónimo y usuario no titular.
**Entregables:** entorno local reproducible, smoke test de autenticación y matriz de configuración sin valores secretos.
**Salida:** controles probados y ausencia de conexiones involuntarias con bases o buckets de producción. **Ninguna URL remota se anuncia como privada sin pruebas reales de acceso.**

### Fase G2 — Ingesta DICOM y geometría fiable

**Objetivo:** importar estudios representativos preservando metadatos espaciales.
**Trabajo:** reemplazar/encapsular lector prototipo con decodificador de referencia libre cuando convenga; soportar formatos comunes progresivamente (incluyendo sintaxis comprimidas y multiframe sólo tras pruebas), agrupar Study/Series/SOP, validar IOP, IPP, PixelSpacing, unidades, errores de orden, inclinación, frames, orientación y consistencia; informar fallos y compatibilidad por serie; carga cancelable y liberación de memoria.
**Entregables:** catálogo local de estudios compatibles, errores inteligibles, fixtures sintéticos y selección versionada de estudios públicos desidentificados, sin subir datasets privados a GitHub.
**Salida:** 100% de casos de prueba críticos pasan; errores de geometría se rechazan explícitamente; controles de memoria y fallos reproducibles.

### Fase G3 — Visor multiplanar clínicamente fiel como visualización

**Objetivo:** stack y MPR con transformaciones físicas consistentes.
**Trabajo:** axial/coronal/sagital verdaderos y oblicuos cuando corresponda, sincronización de crosshair, espaciado real, orientación paciente (LPS/RAS), flip/rotaciones, slab, zoom/pan, ventana y presets, mediciones instrumentales y comparación visual/geométrica con 3D Slicer.
**Entregables:** visor MPR con dataset de referencia, capturas de validación desidentificadas, informe de tolerancias.
**Salida:** sin errores de inversión de lateralidad; coincidencia de puntos y distancias dentro de tolerancias formalmente definidas a partir de la geometría del dataset; sin cambio de escala oculto.

### Fase G4 — Renderizado volumétrico 3D

**Objetivo:** volumen interactivo con calidad y rendimiento previsibles.
**Trabajo:** decidir entre Cornerstone3D, vtk.js y OHIF como integración real (comparativa por compatibilidad, bundle y licencias); GPU/WebGL y fallback CPU si viable; transfer functions, clipping, cámara, reset, opacidad, recorte, escala, caché y presupuesto de memoria.
**Entregables:** render 3D reproducible sobre TC/RM de referencia, controles y métricas de rendimiento por dispositivo.
**Salida:** render físicamente orientado y asociado al original; desempeño documentado; degradación segura en equipos incompatibles.

### Fase G5 — Segmentación y modelos por estructura (piloto avanzado)

**Objetivo:** aislar tejidos/órganos sin presentar errores de IA como hechos clínicos.
**Trabajo:** edición manual y máscaras, algoritmo de superficie configurable (p.ej. marching cubes), geometría de mallas, trazabilidad/medición, exportación GLB/STL; evaluar MONAI/TotalSegmentator sólo si sus modelos/tareas poseen licencias gratuitas aceptables, y calibrar tiempos CPU/GPU localmente.
**Entregables:** máscara y malla verificables, visor de etiquetas, exportación, informe de calidad de segmentación.
**Salida:** máscaras alineadas con el volumen original y revisión manual; no prometer exactitud diagnóstica ni medir patologías automáticamente.

### Fase G6 — Integración con Entheos y longitudinalidad

**Objetivo:** compartir identidad de producto sin contaminar datos.
**Trabajo:** vinculación estudio/serie/reconstrucción; metadatos, eventos y permisos con segregación; persistencia de originales y derivados sólo tras aprobación y arquitectura de datos segura; respaldos, eliminación, versionado, exportación interoperable DICOM SEG y FHIR ImagingStudy si aporta valor.
**Entregables:** flujo de titular único con origen, derivado, sesión, borrado y restore verificados.
**Salida:** pruebas de aislamiento por titular y de recuperación; ninguna regresión de Entheos.

### Fase G7 — Piloto privado desplegado

**Objetivo:** acceso propietario por URL realmente protegido.
**Trabajo:** infraestructura separada sin nuevo pago, habilitar preview fuera de producción, pruebas de no autorizado/owner, cabeceras de cache y scraping, contenido ficticio, observabilidad sin datos clínicos, check de rollback; probar navegador escritorio y móvil.
**Entregables:** URL de pruebas verificada, checklist de control de acceso firmado y resultados de smoke test.
**Salida:** auditoría confirma acceso exclusivo; autorización separada del titular para cualquier publicación y carga real.

### Fase G8 — Evaluación para terceros (puerta separada, no aprobada)

**Objetivo:** evaluar pacientes/profesionales e instituciones sin activar usuarios.
**Trabajo:** evaluación de finalidad prevista ante ANMAT/asesoría regulatoria, privacidad y ley de datos, controles consentimientos/roles, contratos, retención, segregación multiinquilino, accesibilidad, interoperabilidad, licencia comercial de cada componente y modelo, costos operativos y validación clínica.
**Salida:** dictamen y decisión de producto explícita. Ninguna exposición de terceros por defecto.

## 4. Orden de trabajo y dependencias

G0 y G1 son transversales. El prototipo ya adelantó parte de G2/G3, pero no permite saltar puertas de seguridad y validación. G4 depende de la geometría G2-G3, G5 de G4 y geometría verificable, G6/G7 de G1 y estabilidad de G2-G4. G8 exige nueva aprobación.

## 5. Indicadores y evidencias

- **Cobertura del backlog:** issues con responsable, dependencias, criticidad, criterios y PR asociado.
- **Salud de código:** lint, typecheck, test y build verdes en HEAD de cada PR; informe explícito de ejecuciones.
- **Fidelidad:** orientación de ejes, correspondencia de voxel-centros/puntos físicos, medidas/distancias y spacing contrastados con DICOM y 3D Slicer, tolerancias dataset-específicas documentadas.
- **Compatibilidad:** proporción de series soportadas de la matriz de prueba y motivos de rechazo; nunca presentar una cifra global sin composición de datasets.
- **Rendimiento:** tiempo hasta primera imagen, tiempo hasta volumen, FPS, memoria máxima, errores de navegador, usando equipos declarados.
- **Seguridad:** 0 incidentes de PHI en repositorio/logs; todos los endpoints privados rechazan identidades no autorizadas; pruebas de aislamiento y acceso registradas.
- **Calidad de experiencia:** tareas de paciente vs profesional, accesibilidad por teclado/lectores y mensajes claros de incompatibilidad.
- **Progreso:** issues aceptados por evidencia sobre total de issues acordados por fase; prohibido inventar porcentajes o confundir cierre administrativo con validación clínica.

## 6. Priorización

P0 — fuga de datos, posible diagnóstico engañoso, errores geométricos/lateralidad, acceso de terceros o cambios productivos.
P1 — incompatibilidad de DICOM prevalente, MPR, rendimiento bloqueante, navegación y accesibilidad esenciales.
P2 — mejoras de interfaz y rendimiento, preconfiguraciones y exportaciones secundarias.
P3 — funciones futuras no comprometidas.

La dirección decide scope, prioridades, aceptación final y publicación. El desarrollador puede implementar y recomendar cambios, pero no alterar restricciones de costos, datos o seguridad.

## 7. Riesgos principales

| Riesgo | Impacto | Mitigación | Bloquea |
|---|---|---|---|
| Repositorio público y PHI | Crítico | Fixtures sintéticos; scanning secretos; no datasets clínicos | Carga pública |
| Error de orientación/escala | Crítico | QA geométrico, 3D Slicer, casos invertidos/oblicuos | Función MPR/3D |
| Aislamiento incompleto Site | Crítico | Preview separada, autenticación server-side, test adversarial | Despliegue |
| Trabajo intensivo en Workers | Alto | Cálculo navegador o local; Workers como orquestador liviano | Motor pesado |
| Licencias OSS/modelos | Alto | SBOM y matriz modelo/tarea/licencia antes de uso | Distribución |
| Consumo RAM de volúmenes | Alto | Límites, streaming, downsampling explícito no clínico, cancelación | Uso amplio |
| Modelo IA parece diagnóstico | Alto | Revisión humana, avisos, evidencia de validación | IA |
| Chats divergen | Alto | Docs/ADR/Issues/PR como autoridad | Cierre de hitos |
| Cambios no versionados | Alto | Commit/PR/CI por entrega; no cambios efímeros | Aceptación |
| Costos inadvertidos | Alto | Cero altas/conexiones de pago; registro de costo por decisión | Contratación |

## 8. Estimación orientativa (no compromiso)

No se comprometen fechas de finalización ni gastos. La duración depende de la compatibilidad DICOM real, disponibilidad de hardware, validación geométrica, seguridad del entorno y capacidad de desarrollo. Las estimaciones se revisarán después del corpus de referencia G2 y el estudio de integración/renderizado G4; prevalecen los hitos con evidencia frente a calendarios especulativos.

## 9. Protocolo de avance y cierre

Cada issue abierto tiene: problema, alcance/no alcance, prerrequisitos, criterios de aceptación, pasos de prueba, riesgos, responsable lógico y PR. Cada PR debe declarar HEAD, ficheros modificados, pruebas reales con links de GitHub Actions, efectos en seguridad/datos/costos y capturas sólo de fixtures no clínicos. El chat de dirección verifica contra esta matriz y registra la aprobación por ADR o comentario, sin asumir que el agente trabajará en segundo plano.

**Fuente canónica:** este plan y documentos enlazados desde docs/anatheos/README.md en la rama de integración. Toda variación sustancial requiere nuevo registro de decisión.
