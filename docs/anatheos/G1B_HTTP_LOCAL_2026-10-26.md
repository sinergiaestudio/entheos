# ANATHEOS 3D · G1B — Evidencia HTTP local y bloqueo de origen de identidad

**Fecha:** 26/10/2026 · **Issue:** #7 · **Rama:** `anatheos/issue-7-g1b-loopback-http` desde piloto `19c945cf69ff69daa95804639a4aabc9ce9ad7db`. **Clasificación:** laboratorio técnico aislado, no staging real ni certificación de Site.

## 1. Hallazgo de seguridad P0

`app/chatgpt-auth.ts` obtiene la identidad del header `oai-authenticated-user-email` mediante `next/headers`. El booleano `isGlobalAdmin` se determina comparando ese correo con el `APP_OWNER_EMAIL` de entorno. `app/app/anatheos-3d/page.tsx` combina `ANATHEOS_PILOT_ENABLED`, `requireChatGPTUser` y `isAnatheosOwner`.

**Si el borde HTTP de Sites/Workers no elimina y sobrescribe una cabecera arbitraria enviada por el cliente**, un atacante que conozca el correo del titular podría presentar un header falso. Por tanto, la combinación del predicado y del flag es necesaria pero **no demuestra procedencia autenticada**. Se prohíbe usar el flag `true` remotamente hasta verificar el contrato de autenticación y su comportamiento en un entorno aislado real, incluso si las pruebas locales pasan.

No introducir cabeceras de identidad falsas en un Site productivo.

## 2. Defensa técnica añadida en esta rama

- `lib/anatheos/http-boundary.ts`: política pura de rutas y cabeceras. Cuando el flag no sea **exactamente** `"true"`, emite un 404 sin pasar a Vinext para `/app/anatheos-3d`, rutas anidadas y `/api/anatheos` (reservada para API futura). Rechaza variantes de flag, trata segmentos sin capturar rutas no relacionadas y comprende segmentos percent-encoded sencillos.
- `worker/index.ts`: aplica el bloqueo al **inicio** de `worker.fetch` y refuerza `Cache-Control: private, no-store`, `X-Robots-Tag: noindex`, CSP, Referrer y nosniff en toda respuesta de ANATHEOS (incluidos errores y RSC). No altera las rutas normales de Entheos ni añade persistencia o bindings.
- `tests/anatheos-g1b-boundary.test.mjs`: pruebas adversariales directas de Response, segmentos/rutas, flag off y cabeceras (unitarias, **no HTTP real**).

**Esta defensa no certifica el estado ON.** La comprobación de propietario con cabecera suministrada por el request sigue sujeta al riesgo anterior. Tampoco autoriza por sí misma futuros endpoints: el flag OFF los protege, pero el flag ON exige un guard server-side específico y prueba de confianza del origen.

## 3. Prueba HTTP real, loopback y CI

Se creó un runner `scripts/anatheos-g1b-ci.sh` que fuerza `ANATHEOS_PILOT_ENABLED=false`, identidad sintética `owner@example.invalid` y directorio runtime aislado, y arranca el servidor **Vinext + Worker** escuchando exclusivamente `127.0.0.1:4173` en un checkout efímero de GitHub Actions. El proceso se detiene al finalizar. No utiliza cookies reales, DICOM, secretos, cuentas ni servidores externos.

`scripts/anatheos-g1b-http-matrix.mjs` realiza HTTP `fetch` real a nueve variantes controladas, comprobando status 404, no-store, noindex, CSP y nosniff, sin guardar o imprimir cuerpos de respuesta. Las variantes incluyen:

| Escenario | Expectativa del flag OFF |
|---|---|
| HTML anónimo | 404 + cabeceras privadas |
| HTML con header de propietario ficticio | 404 + cabeceras privadas |
| HTML con tercero ficticio | 404 + cabeceras privadas |
| Variación de cabeceras falsificadas | 404 + cabeceras privadas |
| RSC anónimo | 404 + cabeceras privadas |
| RSC con header de propietario ficticio | 404 + cabeceras privadas |
| API futura GET `/api/anatheos/studies` | 404 + cabeceras privadas |
| API futura con header ficticio `/api/anatheos/upload` | 404 + cabeceras privadas |
| Subruta `/app/anatheos-3d/subroute` | 404 + cabeceras privadas |

La CI agrega **después de `npm test`** el paso `G1B local HTTP denied-access matrix (no deploy)`. Su resultado exacto debe registrarse en la revisión, no inferirse por existencia del código. La prueba comprueba el HTTP del laboratorio, **no el proxy remoto de ChatGPT Sites**.

## 3 bis. Evidencia de CI y HTTP real sobre HEAD de código

- [GitHub Actions #40369305137](https://github.com/sinergiaestudio/entheos/actions/runs/40369305137), SHA `83345d819edf9dc7107ccf804ddbfdf64fa7a522`, **COMPLETED/SUCCESS**; job `verify` #121735409153: **65 tests / 65 PASS / 0 FAIL / 0 SKIPPED / 0 CANCELLED**. Instalación, lint, typecheck y build PASS. Una advertencia de lint no bloqueante y preexistente en `components/timeline-documents.tsx`.
- Paso `G1B local HTTP denied-access matrix (no deploy)`: **9/9 HTTP PASS, 0 FAIL, 0 SKIPPED**, cada respuesta 404/no-store/noindex/CSP/nosniff, con falso propietario/anónimo/tercero, solicitudes RSC, rutas API futuras y subruta. Solo loopback 127.0.0.1, flag OFF, usuarios ficticios.
- **Cobertura real y límite:** demuestra comportamiento HTTP del Worker en el entorno local CI; **no demuestra autenticación del proveedor remoto**, confianza de las cabeceras con flag ON ni separación D1/R2. No habilitar Site.
- Este propio checkpoint documental se registra por commit posterior: su CI debe comprobarse independientemente antes de informar HEAD final verificado.

## 4. Matriz G1B y resultados válidos

| Caso | Evidencia aceptable ahora | Estado inicial |
|---|---|---|
| Flag OFF + anónimo/falsificación + RSC/API | CI #40369305137: nueve respuestas 404 | **PASS (local)** |
| Respuestas privadas del Worker | CI #40369305137: no-store/noindex/CSP/nosniff | **PASS (local)** |
| Flag ON + usuario legítimo | Sesión con identidad de procedencia certificada | BLOCKED (sin ambiente confiable) |
| Flag ON + tercero real/anónimo | Dos sesiones externas controladas sin PHI | BLOCKED |
| Cabecera proveniente del cliente externo | Prueba de **strip/overwrite en frontdoor** | BLOCKED CRÍTICO |
| Headers efectivos de Site remoto | Pruebas HTTP reales en staging aprobado | BLOCKED |
| Aislamiento de D1/R2 y cuentas | Comparación de IDs de proyecto/bucket/bindings en recursos aislados, sin valores sensibles | BLOCKED |
| No bypass de rutas API cuando ON | Guard server-side por API y tests negativos reales | BLOCKED: aún no hay API |
| Volumen 3D / validación médica | Slicer/datasets de referencia | FUERA DEL ALCANCE G1B |

## 5. Inventario de vínculos de infraestructura (sin secretos)

- `.openai/hosting.json` define **nombres** `DB` (D1) y `BUCKET` (R2).
- `vite.config.ts` configura localmente nombres sintéticos `site-creator-d1` y `site-creator-r2`, con ID de base placeholder. **No demuestra aislamiento en un futuro staging**.
- `worker/index.ts` referencia `DB` como tipo de binding global de Entheos; ANATHEOS no incorpora ninguna lectura/escritura D1/R2 nueva.
- **Antes de desplegar:** obtener por medios administrativos una tabla sanitizada con *identificadores de proyecto y recursos* de staging vs producción, y confirmar diferencia real de cuentas/buckets/D1, sin incluir tokens ni datos clínicos en repositorio público. Sin autorización de infraestructura no se provisiona nada.

## 6. Salida y decisión solicitada

- Integrar en piloto **solo tras revisión del PR** y CI final exitoso; no cerrar #7 por pruebas con flag OFF.
- Si se constata que el borde admite headers no confiables, **mantener G1B BLOCKED** hasta autenticar con mecanismo verificable del proveedor, session/token validado criptográficamente o equivalente diseñado y aprobado; no confiar en un encabezado aislado.
- **No habilitar ANATHEOS remotamente, publicar URL, reutilizar DB/R2 de producción ni pagar proveedores.**
- Próximo experimento condicionado: entorno aislado auténtico con cuentas de prueba, capturas HTTP sanitizadas de flag ON, owner, tercero, RSC y rutas API, previa aprobación de seguridad/publicación cuando corresponda.
