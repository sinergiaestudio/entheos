# ANATHEOS 3D — Protocolo operativo GitHub / ChatGPT

**Norma del proyecto:** las conversaciones son interfaces de coordinación; los artefactos versionados de GitHub son autoridad operativa.
**No implica:** mensajes automáticos entre chats ni programación en segundo plano. La sincronización se produce cuando cada chat consulta/escribe GitHub.

## 1. Chats y competencias

### Chat 1: Dirección, auditoría y control global (este chat)
- Define alcance, prioridades, presupuesto cero adicional, arquitectura aceptada y go/no-go por hito.
- Lee el plan, STATUS, decisiones, Issues, PR, checks, cambios de código y prueba efectiva.
- Solicita revisiones, identifica riesgos, mantiene progreso por criterio verificable.
- Registra decisiones aprobadas en REGISTRO_DECISIONES.md y solicita ADR nuevos.
- No considera entregado un hito hasta verificar su evidencia ni permite publicación sin autorización.

### Chat 2: ANATHEOS 3D · Ingeniería y Código
- Primero lee índice, plan, arquitectura, QA, decisiones, estado y Issues asignados; contrasta HEAD/CI.
- Descompone un issue en implementación, tests, docs, compatibilidad, riesgos y PR.
- Codifica en rama feature creada **desde feature/anatheos-3d-owner-pilot** cuando sea posible; PR tiene como base la rama piloto, no main.
- Hace commits pequeños, deja CI verde y solicita revisión en PR.
- Nunca publica, fusiona en main, incorpora terceros o gastos sin decisión aprobada.
- Tras cada hito, escribe comentario de progreso en Issue o PR con SHA, test/resultado, límites y siguiente paso, y actualiza STATUS/ADR donde corresponda.
- Puede proponer alternativas, pero no autoaprobar gastos, seguridad, alcance o despliegue.

### GitHub (punto de encuentro con programador/agente)
- **Issues:** especificación de trabajo, discusiones, aceptación, bloqueos, relaciones.
- **PR:** código propuesto, diff, comentarios inline, análisis de CI, revisión, cierre de trabajo.
- **Docs:** plan, arquitectura, ADR, estado, seguridad y actas de aprobación.
- **Commits:** histórico verificable, sin incluir datos personales.
- **Tags/releases:** sólo luego de hitos aceptados; no declarar releases por haber creado un branch.

Si el desarrollador es una persona distinta, debe colaborar mediante permisos reales en GitHub y responder en Issues/PR; nunca asumir que una mención en ChatGPT le envió algo. El chat de desarrollo podrá consultar esos hilos cuando reciba la instrucción de hacerlo.

## 2. Árbol de ramas y garantías

- **main:** Entheos productivo; sin commits, merges o despliegues automáticos derivados de ANATHEOS.
- **feature/anatheos-3d-owner-pilot:** integración experimental y documentación del producto. No asume privacidad ni despliegue.
- **anatheos/issue-<numero>-<tema>:** rama de trabajo derivada de la rama piloto para una tarea. PR hacia rama piloto con checks y revisión.
- **PR #5:** borrador ya abierto desde rama piloto hacia main para CI histórico. No fusionarlo ni convertirlo en ready-to-merge durante piloto. Preferir PR independientes hacia rama piloto para desarrollo posterior.

Evitar pushes concurrentes sobre un mismo archivo/branch por agentes distintos. Coordinar issue owner, verificar HEAD antes de actualizar y resolver conflictos explícitamente. No forzar push. Guardar originales inmutables; no colocar fixtures clínicos en el repo.

## 3. Estructura documental y fuente de verdad

- docs/anatheos/README.md: índice, links, última guía de inicio.
- docs/anatheos/PLAN_MAESTRO.md: roadmap, requisitos, dependencias y aceptación.
- docs/anatheos/ARQUITECTURA_OBJETIVO.md: componentes, interfaces y opciones abiertas.
- docs/anatheos/CALIDAD_SEGURIDAD_VALIDACION.md: matriz de calidad, seguridad y pruebas.
- docs/anatheos/REGISTRO_DECISIONES.md: decisiones adoptadas y propuestas.
- docs/anatheos/ESTADO.md: estado observable en un SHA, entregas pendientes y riesgos.
- docs/anatheos/PROTOCOLO_GIT_Y_CHATS.md: flujo de trabajo y comunicación.
- docs/anatheos/INICIO_CHAT_DESARROLLO.md: mensaje de handoff y reglas de intervención.
- docs/ANATHEOS_MILESTONES.md: registro histórico previo; mantener, no borrar.
- docs/ANATHEOS_3D_PILOT.md y docs/ANATHEOS_CHATGPT_PROJECT_HANDOFF.md: referencias de arranque; en caso de discrepancia, nueva decisión explícita en REGISTRO_DECISIONES.

Evitar duplicar el texto del plan en muchos documentos: el índice debe enlazar al documento autoritativo.

## 4. Definición de Issue y criterios de cierre

Cada Issue debe incluir:
- identidad y fase, propósito para el usuario;
- contexto del código y prerrequisitos;
- definición de hecho / criterios medibles;
- casos favorables y adversos, dataset de prueba público o sintético;
- seguridad, costo, compatibilidad, licencias;
- entregables, PR, evidencias CI, pruebas de geométricas/visuales cuando aplican;
- bloqueos y decisión necesaria del titular.

Estados operativos declarados en el Issue o tablero: Backlog, Ready, In progress, In review, Blocked, Done (aceptado). Abrir un PR no convierte la tarea en Done.

## 5. Definición de PR

Título: AN3D #<issue> — tarea resumida.
Plantilla del cuerpo:
- **Issue y objetivo:**
- **Cambios de código y documentación:**
- **Archivos relevantes:**
- **Commit HEAD / branch base:**
- **Resultados CI:** link a ejecución y estado, no suposición.
- **Pruebas funcionales/geométricas:** dataset, versión de 3D Slicer, evidencia, tolerancias.
- **Privacidad y seguridad:** cambios en acceso, persistencia y log.
- **Licencias/costos:** solo OSS sin servicios de pago, o bloquear si no.
- **Regresiones conocidas y compatibilidad:**
- **Rollback:**
- **Checklist de aceptación y revisión:**
- **Aprobación solicitada a dirección:** si se requiere.

## 6. Commits y checkpoints

Usar convención: feat(anatheos), fix(anatheos), test(anatheos), docs(anatheos), security(anatheos), perf(anatheos). Cada entrega técnica incluye doc de decisiones si se modifica un contrato, y pruebas cuando añade lógica. Al terminar un bloque, confirmar el SHA de GitHub; si algo sólo está en el chat no fue persistido.

El chat de dirección actualiza ESTADO en hitos significativos y verifica diferencias entre versión anterior y SHA actual. Nunca reemplazar un fracaso por un resumen positivo; registrar FAIL/blocked y plan de resolución.

## 7. Protocolo de decisión

- **Propuesta:** Issue / PR indica alternativa, beneficios, restricciones y riesgos.
- **Decisión:** el titular confirma en el chat de dirección; queda asentada con ID D-xxx.
- **Implementación:** PR enlaza D-xxx.
- **Auditoría:** dirección verifica diff y CI, valida que la decisión realmente esté implementada.
- **Cambios:** si una decisión se sustituye, marcar reemplazo y razón; conservar el historial.

No convertir un silencio en autorización. No interpretar autorización técnica para editar la rama como aprobación de gastos, datos clínicos, publicación o terceros.

## 8. Cadencia recomendada

- Por cada issue de desarrollo: un checkpoint a inicio (scope) y cierre (PR/tests).
- A cada cierre de hito: auditoría de arquitectura, decisiones, riesgos, pruebas, estado y próximos 3 issues.
- Semanal o a demanda: reporte de progreso con hechos verificados y enlaces, sin porcentaje arbitrario.
- Antes de publicar: go/no-go explícito basado en QA, seguridad, privacidad, accesos, costo y rollback.

## 9. Comentarios de coordinación (formato)

**Inicio:** "Tomamos Issue #N, rama derivada de piloto en SHA x, supuestos y pruebas; no se tocará producción."
**Entrega:** "Issue #N; PR #P; HEAD x; CI ejecución y estado; pruebas x/y; escenarios no cubiertos; docs; bloqueo; siguiente paso."
**Revisión:** "Aprobado / cambios requeridos; hallazgos numerados; reproduce; evidencia; decisión".
**Cierre:** "Aceptado contra criterios A..F; riesgos residuales; cambios confirmados en SHA; sin despliegue a menos que se autorice".

Se puede trabajar con un programador mediante comentarios de Issues y PR dentro de GitHub. No son mensajería instantánea garantizada; el desarrollador debe revisar el repositorio o sus notificaciones.
