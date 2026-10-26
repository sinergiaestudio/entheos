# ANATHEOS 3D · Integración temporal G1B y protección de ramas · 26/10/2026

**Issue de integración técnica:** #7 y #20. **Estado:** solo rama temporal / PR DRAFT / NO MERGE. La referencia piloto inicial es `19c945cf69ff69daa95804639a4aabc9ce9ad7db`; `main` sigue excluida y no debe ser afectada.

## 1. Integración propuesta sin perder historial

- Rama `anatheos/issue-7-20-integration-review` derivada de piloto.
- PR original #27, último HEAD **`557c8ad2fda7e3d8f43086ecb9f9d7fdb3a895a5`**, incorporado solo en rama temporal mediante merge commit de dos padres **`479e7bea134dc0ae996f774cee4d5bcd9d6d323e`**.
- PR original #28, HEAD **`15043046ad693a89f1311547ea2441076d19bf03`**, incorporado solo en rama temporal mediante merge commit de dos padres **`ef82fa9f339d3588e24073b0e68377eacdf49f79`**.
- Los documentos compartidos y workflow CI no se sobreescribieron en esos commits: se conciliaron después, para preservar sin colisiones las aportaciones de ambos PR. Los PR originales permanecen **DRAFT, sin merge**.

## 2. Resolución de conflictos

- `.github/workflows/ci.yml`: conserva `push: branches: [main, feature/anatheos-3d-owner-pilot]`, `pull_request`, instalación, lint, typecheck, build/tests y el paso `G1B local HTTP denied-access matrix (no deploy)`. **No agrega deploy**.
- `docs/anatheos/README.md`: mantiene auditorías, historia G0–G2, cierre del Issue #25, y ahora enlaces G1B e Issue #20.
- `docs/anatheos/ESTADO.md`: conserva checkpoints históricos y anexa los nuevos sin reescribir anteriores.
- `docs/anatheos/REGISTRO_DECISIONES.md`: conserva D-001–D-010 y propuestas P-002/P-008/P-009/P-010; no transforma propuestas en decisiones aprobadas.
- `tests/anatheos-integration-7-20.test.mjs`: regresión del workflow combinado, historia documental y bloqueo de rutas codificadas.

## 3. QA y límites

La CI sobre el **HEAD combinado** deberá ejecutar `npm run lint`, `npm run typecheck`, `npm test` (que compila), y la matriz HTTP real (23 casos) con el flag **OFF** en loopback. **No sumar pruebas de las ramas individuales.** Registro de run y SHA únicamente después de verificar logs.

- **Con flag OFF:** 404/respuesta privada para HTML, RSC, API futura, HEAD, POST, OPTIONS y URLs codificadas.
- **Con flag ON:** procedencia de identidad, control frente a header `oai-authenticated-user-email` falsificado, sesiones reales y aislamiento D1/R2 **siguen BLOCKED** y no se simulan como certificación.
- **No hay reglas de branch protection activadas**; el workflow `push` piloto no demuestra por sí solo enforcement ni que Sites publique sin interrupciones.
- El despliegue productivo de Entheos no está codificado en GitHub Actions y el mecanismo operativo de Sites sigue sin verificarse. Exigir autorización separada para settings y despliegues.
- G2a/B, geometría y Slicer siguen abiertos; ningún producto clínico validado, ni volumetría 3D.

## 4. Estado y reversión

No se cambió `main`, piloto, producción, Site, D1/R2 ni credenciales; el repo sigue público y solo incluye fixtures sintéticos. El rollback de este bloque consiste en no fusionar PR temporal y cerrar/descartar rama; nada fue desplegado. La Dirección debe revisar este PR antes de cualquier fusión a piloto. No se cierran #7 ni #20.

## 5. Primera evidencia CI del HEAD conjunto

- [GitHub Actions #40374336543](https://github.com/sinergiaestudio/entheos/actions/runs/40374336543) del SHA `f37b6c8dfc34fd021a5f2936c4cb404a3f6d9199`, job `verify` #121753162536: **COMPLETED/SUCCESS; 70/70 tests PASS, 0 FAIL, 0 SKIPPED/CANCELLED**. Lint, TypeScript y build completados (1 advertencia preexistente ajena a ANATHEOS).
- Matriz HTTP real en servidor de loopback, flag OFF: **23/23 PASS**, sin fallos ni casos omitidos. Incluye métodos HEAD, POST y OPTIONS, codificación simple/doble, RSC y prefijos API.
- No se ha probado el disparador `push` sobre un nuevo HEAD del piloto, dado que este PR **no está autorizado para merge**. La configuración GitHub sigue sin reglas activadas.
- La confianza de identidad con flag ON, las sesiones reales y segregación D1/R2 continúan **BLOCKED**. No se ha alterado `main`, piloto ni se habilitó un Site.
- Este checkpoint documental, al añadir otro commit, requiere nueva CI sobre el último HEAD antes de que pueda darse por verificado.

## 6. Seguimiento documental## 5. Evidencia posterior

Se añadirá a los comentarios del PR temporal y de los Issues #7/#20 la ejecución CI **del HEAD definitivo**, con contadores PASS/FAIL/SKIPPED de pruebas de código y HTTP separados. No constituye revisión de seguridad remota.
