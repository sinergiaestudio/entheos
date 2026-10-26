# ANATHEOS 3D — Registro de decisiones (ADR ligero)

**Regla:** una decisión se agrega, no se borra. Las propuestas no son aprobaciones.
**Aprobador de cambio de alcance, costo, seguridad y despliegue:** titular del proyecto.

## Decisiones adoptadas

| ID | Decisión | Estado | Fecha | Consecuencia |
|---|---|---|---|---|
| D-001 | Desarrollar plataforma general para pacientes y profesionales, comenzando por piloto individual | Aprobada | 2026-10-26 | Interfaz y permisos extensibles; sin terceros en piloto |
| D-002 | Ninguna aplicación, suscripción, API o licencia externa de pago ni alta de servicios sin autorización adicional | Aprobada | 2026-10-26 | OSS y procesamiento propio; costo operacional separado |
| D-003 | Construir como módulo experimental relacionado con Entheos, preservando producción | Aprobada | 2026-10-26 | Rama y entorno separado; cero merge o despliegue en main |
| D-004 | Acceso exclusivo del titular durante desarrollo y validación | Aprobada | 2026-10-26 | Autorización server-side y pruebas previas a URL remota |
| D-005 | No subir datos médicos reales/secretos al GitHub público | Aprobada | 2026-10-26 | Fixtures sintéticos o públicos desidentificados |
| D-006 | MVP inicial explora imágenes, sin diagnóstico automático ni terapia | Aprobada | 2026-10-26 | Alertas y uso no diagnóstico; marco regulatorio para expansión |
| D-007 | Chats separados: dirección aquí, desarrollo en chat técnico, GitHub como registro de código, decisiones, tareas y evidencia | Aprobada como organización del trabajo | 2026-10-26 | Plan, Issues, PR, ADR y estado centralizados |
| D-008 | Avances quedan guardados y versionados en Git y tratados con comunicación pública sanitizada | Aprobada como política de trabajo | 2026-10-26 | Cada issue/PR precisa estado, SHA, CI, límites |
| D-009 | Mantener una rama de integración experimental y no fusionar a producción por defecto | Aprobada | 2026-10-26 | PR a rama piloto y go/no-go separado para producción |

### D-010 · Consolidación técnica de PR #26 exclusivamente en rama piloto

- **Fecha y aprobador:** 26/10/2026; autorización expresa de Dirección en [resolución #6421827902](https://github.com/sinergiaestudio/entheos/pull/26#issuecomment-6421827902), con ratificación del usuario titular en la conversación de Ingeniería.
- **Contexto:** la combinación temporal de PR #21–#24 superó 60/60 pruebas y la revisión independiente; se autoriza exclusivamente el merge normal a `feature/anatheos-3d-owner-pilot`.
- **Alternativas:** no fusionar; fusionar directamente PR originales; squash/rebase; o fusionar la rama ya reconciliada. Se elige la última con historial completo, sin alterar `main`.
- **Decisión y motivación:** aprobar **solo consolidación técnica experimental**, no publicación ni apertura a terceros. GitHub confirmó `merged=true` para [PR #26](https://github.com/sinergiaestudio/entheos/pull/26), merge commit `8c0f29d30670c4e2d21d8673a1050d02b61f5bfd` con dos padres.
- **Impacto en privacidad, licencias y presupuesto:** ningún dato clínico real, gastos, nuevas APIs, cambios D1/R2 ni cambio de producción. Mantener flag OFF hasta G1B.
- **Pruebas y evidencia:** CI post-merge [GitHub Actions #40364071117](https://github.com/sinergiaestudio/entheos/actions/runs/40364071117), **60/60 PASS**, lint, TS y build PASS, 0 FAIL/SKIPPED.
- **Riesgos residuales:** #7 identidad HTTP/bindings, #8 decoder/RAM, #9/#10 geometría Slicer, #20 protección de ramas; sin aptitud diagnóstica ni volumen 3D.
- **Sustituye a:** no borra P-009; registra resolución positiva **solo para el merge técnico descrito**. P-009 permanece como evidencia de la fase anterior en evaluación.

## Opciones técnicas propuestas, todavía NO aprobadas para adopción definitiva

| ID | Propuesta | Estado | Evidencia requerida |
|---|---|---|---|
| P-001 | Integración OHIF 3.13 vs Cornerstone3D modular vs vtk.js | Evaluación | Spike con tamaño bundle, browsers, tiempo y MPR/3D |
| P-002 | Reemplazar parser propio limitado por loader de referencia | Evaluación | Tests de sintaxis, geometría y estabilidad |
| P-003 | Usar Orthanc/DICOMweb como componente local/institucional | Diferida | Caso real de interoperabilidad y revisión GPL/AGPL |
| P-004 | TotalSegmentator/MONAI para segmentación offline | Diferida | Licencias de código y pesos, CPU/GPU, QA de máscara |
| P-005 | Persistir originales y derivados en almacén aislado Entheos | Diferida | Modelo de datos, autorización, cifrado, costos y restore |
| P-006 | Autorizar Site independiente de propietario único | Pendiente de implementación/validación | Prueba con otra cuenta y anónimo; no tocar producción |
| P-007 | Apertura a pacientes/profesionales | No autorizada | Consentimiento, RBAC, seguridad, licencia y regulación |
| P-008 | Protección de ramas main e integración mediante reglas gratuitas | Propuesta pendiente (#20) | Compatibilidad de protección con GitHub y despliegues existentes, bloqueo de merges involuntarios y rollback; no modificar configuración sin decisión |

### P-002 · Desarrollo de la migración del lector DICOM (propuesta técnica, sin aprobar)

**Fecha:** 2026-10-26. **Issue:** #8. La implementación preparatoria se documenta en [DECODIFICADOR_G2A.md](DECODIFICADOR_G2A.md), sin incorporar librerías todavía.

- **Candidato principal:** `@cornerstonejs/dicom-image-loader` con Cornerstone3D, arquitectura modular y solo entrada `File` local en piloto.
- **Alternativas:** `dicom-parser` para tags sin decodificación visual de píxeles; `dcmjs` para metadatos; parser propio P1A solo fallback hasta cumplir equivalencias verificadas.
- **No aprobado:** añadir paquetes, cargar códecs WASM, habilitar WADO remoto o afirmar compatibilidad multiframe/comprimidos.
- **Condiciones:** comprobar licencia por versión y dependencias, lockfile reproducible, bundle/Worker/Vinext, cancelación/limpieza de cachés, regresión DICOM, pruebas Slicer, cero nuevas suscripciones/servicios y no fuga de PHI.
- **Estado:** *propuesta para evaluación en PR*, no altera la decisión D-002 de costo cero.

### P-009 · Integración temporal verificable de PR #21–#24 (propuesta técnica, sin autorización de merge)

- **Issue:** #25. La rama temporal de revisión y las pruebas conjuntas no implican aprobación de los PR originales, despliegue ni autorización para fusionar en la rama piloto.
- **Propuesta:** incorporar cambios con historial de dos padres, reconciliar auditorías y checkpoint documental, verificar la matriz cruzada owner-only/ingesta/corpus; preservar la auditoría posterior de Dirección.
- **Requiere:** CI en SHA final, revisión independiente, autorización expresa de Dirección antes de integrar en piloto. Sin cambios de branch protection, hosting, PHI ni servicios pagos.
- **Evidencia y rollback:** [Acta de integración Issue #25](INTEGRACION_ISSUE_25_2026-10-26.md); cerrar PR temporal sin alterar rama piloto.
- **Estado:** propuesta, no aprobada; D-001–D-009 permanecen intactas.

### P-010 · Defensa HTTP de Worker para laboratorio G1B (propuesta en PR)

- **Fecha/Issue:** 26/10/2026, #7. No es adopción aprobada para despliegue.
- **Contexto:** `getChatGPTUser()` deriva identidad y rol del header `oai-authenticated-user-email` sin prueba del saneamiento/procedencia en el borde. Aun así el flag G1A se desactiva por defecto.
- **Propuesta/implementación:** refuerzo OFF en `worker/index.ts` mediante `lib/anatheos/http-boundary.ts`, con 404 y no-store/noindex/CSP antes de entrar a Vinext; pruebas HTTP locales reales por GitHub Actions y pruebas unitarias de rutas.
- **Impacto:** sin datos clínicos, cambios remotos, APIs, servicios pagos ni conexión D1/R2 adicionales. Con flag ON el worker no demuestra identidad; sigue prohibida la publicación.
- **Estado:** codificado en rama G1B para revisión, pendiente de CI. Ver [protocolo](G1B_HTTP_LOCAL_2026-10-26.md). La prueba del frontdoor de Sites, el aislamiento de datos y los permisos efectivos requieren evidencia independiente y aprobación futura.
- **Sustituye:** ninguna decisión previa. D-004 acceso exclusivo y D-010 integración piloto continúan vigentes.

## Formato para decisión nueva

### D-0XX — Título
- **Fecha y aprobador:**
- **Contexto:**
- **Alternativas:**
- **Decisión y motivación:**
- **Impacto en privacidad, licencias y presupuesto:**
- **Implementación (Issue/PR/commit):**
- **Pruebas y evidencia:**
- **Riesgos residuales:**
- **Sustituye a:** ninguna / D-xxx.

Si la realidad técnica contradice un supuesto, registrar como hallazgo y proponer rectificación en vez de reescribir retrospectivamente la aprobación.
