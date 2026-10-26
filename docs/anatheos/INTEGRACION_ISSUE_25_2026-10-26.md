# ANATHEOS 3D — Consolidación temporal de ingeniería · Issue #25

**Fecha:** 26/10/2026. **Estado:** rama temporal de revisión, **no integrada a la rama piloto**, no desplegada, no aceptada clínicamente. Esta es evidencia técnica de ingeniería para aprobación separada por Dirección.

## 1. Referencias verificadas y límites

- Repositorio público `sinergiaestudio/entheos`, `main` baseline `8e7602280d6c4fddc234c1973537839592683798`, sin cambios autorizados de ANATHEOS.
- Rama piloto **actual** al iniciar el trabajo: `feature/anatheos-3d-owner-pilot` HEAD `aec8222c5fa4b529575fc49a85f401ecf7a41a49`. Es **dos commits posterior** a la auditoría inicial `f66ffaa919b26ab3f4290499009b46812df957ab`; añadió `AUDITORIA_DIRECCION_2026-10-26.md` y su enlace en `README.md`. Se preservaron ambos cambios.
- Rama **temporal de pruebas** `anatheos/issue-25-integration-review`, creada **desde** `aec8222...`. Sus commits de integración tienen **dos padres**: primero el HEAD temporal previo, luego el commit HEAD original de cada PR. Se conservan ambas historias en la rama temporal **sin fusionar los PR originales en piloto**.
- `main` y piloto mantienen `protected=false` (Issue #20). Este trabajo no modifica reglas de GitHub.

## 2. Orden de staging de aportes PR

| Orden | PR original / issue | HEAD original | Merge commit **solo temporal** | Aporte técnico |
|---|---|---|---|---|
| 1 | #21 / #6 | `aea450f8d7937b03c593a81a77940646b4a447c7` | `f04869bdc82e598bee7b0fbec786f3d4a56a2d63` | Auditoría G0 y regresiones |
| 2 | #22 / #7 | `ea4ee6ac77d297a291ed7f84a9336d809fcb47a3` | `7387dfc12a21ea5c0cd0890ac560eb9486eb1f06` | Owner gate OFF por defecto, headers, pruebas |
| 3 | #23 / #9 | `6523c3df2983e2e22c8bff392cc050d0fc234887` | `582e74fc94625db30e08915afc9e91844c83f2f1` | 9 casos DICOM sintéticos, goldens, hash/manifest |
| 4 | #24 / #8 | `8cab19e55a51fa70790a1d530a60b9495af5284b` | `5872fbd6249f16ac0d43939ae7224dadc66d4fdf` | Intake limitado/cancelable y matrix de loader |

**Método:** estos cuatro merge commits incorporaron las entradas de código, tests, configuración y documentos no compartidos por SHA de blob. Los tres ficheros compartidos `docs/anatheos/README.md`, `ESTADO.md` y `REGISTRO_DECISIONES.md` quedaron inicialmente en la versión piloto y luego se reconciliaron por secciones preservadas, sin elegir arbitrariamente una de las cuatro versiones de rama. Los merge commits conservan la historia de cada PR; el árbol fusionado se construyó explícitamente solo en la rama de revisión, no en las ramas PR. Esta es una operación técnica reproducible, no una aceptación de código original.

## 3. Reconciliación de documentos

- `README.md`: se conserva la auditoría posterior de Dirección y se añaden las referencias completas de G0, laboratorio G1, corpus G2b-A, loader G2a-A e Issue #25.
- `ESTADO.md`: se conserva la fotografía histórica de la rama piloto, y se agregan íntegros los cuatro checkpoints de los PR originales en orden (G0, G1A, G2b-A, G2a-A), más este checkpoint de integración propuesta. Los estados históricos `EN REVISIÓN` siguen siendo históricos; no se reescriben como pruebas del nuevo HEAD.
- `REGISTRO_DECISIONES.md`: sin borrar decisiones D-001–D-009 ni propuestas P-001–P-007, se añaden P-008 (protección de ramas), detalle P-002 (Cornerstone propuesta) y P-009 (esta integración para revisión, no aprobada).
- Nuevos tests `tests/anatheos-integration-25.test.mjs`: smoke conjunto **de código**. Aplica predicados de flag/owner antes del intake, carga corpus axial/oblicuo, comprueba conteos/rechazos y cancelación antes de una segunda lectura; verifica existencia de secciones documentales. **No es prueba real de HTTP ni de la inyección/saneamiento de identidad.**

## 4. Hallazgos de integración y medidas adoptadas

- **Riesgo de solapamiento documental:** resuelto por combinación explícita de secciones y tests que alertan si se pierden checkpoints/ADR.
- **Cancelación y RAM:** en `dicom-intake.ts` / `dicom-browser.tsx` se corrigió lenguaje que afirmaba que el estudio se había descartado de memoria de manera inmediata. `Blob.arrayBuffer()` iniciado puede finalizar internamente tras cancelar. La selección se oculta del visor, pero la liberación de buffers se produce según el runtime y el GC; no hay garantía de cota de memoria residente.
- **Identidad:** `getChatGPTUser()` usa una cabecera `oai-authenticated-user-email` recibida del entorno. La puerta `ANATHEOS_PILOT_ENABLED` + `isAnatheosOwner` necesita un borde confiable que elimine/sobrescriba cabeceras aportadas por cliente. **No comprobado** y por tanto no hay autorización para habilitar remoto. Tampoco se ha comprobado que el Worker no comparta bindings reales de D1/R2 en staging.
- **Dependencias:** no se incorporó ningún decodificador ni otro paquete, no se contrató servicio pago, no se añadieron PHI, DICOM clínicos ni tokens.
- **Geometría:** la cobertura del corpus es sintética y no ha sido contrastada con 3D Slicer ni con un IOD clínico pleno. El lector P1A y el viewer 2D son experimentales; no hay volumen 3D ni uso diagnóstico.

## 5. Criterios y evidencia de aceptación pendientes

- CI de `lint`, `typecheck`, `npm test` (incluye build) **en el SHA final combinado**; registrar run/link/resultados PASS/FAIL/SKIP. No sumar conteos de PR independientes.
- Revisión independiente de PR temporal y comparación con `main` y piloto base, revisión contra suites cruzadas y conflictos.
- Confirmar con Dirección aceptación de la combinación, **antes de cualquier incorporación a piloto**. No fusionar PR #21–#24 ni PR temporal sin aprobación expresa.
- G1B: pruebas HTTP reales de anónimo/tercero/titular, falsificación de cabeceras y aislamiento D1/R2 antes de cualquier habilitación remota.
- Issue #20: propuesta de reglas de protección de ramas; ajustes de Settings solo con aprobación explícita.
- Issues #8/#9/#10: decoder externo, datasets públicos desidentificados y geometría Slicer permanecen pendientes.

## 6. Rollback y exclusiones

El rollback de esta etapa consiste en dejar el PR temporal en DRAFT o cerrarlo y descartar la rama experimental; **no implica rollback de producción**, pues no se alteró `main`, la integración ni el Site. No se abrieron endpoints públicos. Cualquier paso posterior de fusión o despliegue necesita acto separado y revisión aprobatoria de Dirección.

**Informe CI final:** se añadirá a comentarios de [Issue #25](https://github.com/sinergiaestudio/entheos/issues/25) y del PR temporal, y se reflejará en ESTADO sobre commit posterior verificado.
