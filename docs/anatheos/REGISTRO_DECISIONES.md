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
