# ANATHEOS 3D · Integración temporal de G1B y protección de ramas

**Fecha:** 26/10/2026 · **Frentes:** #7 y #20 · **Estado:** solo rama de revisión, PR #29 DRAFT, **no fusionado a piloto ni a main**.

## 1. Línea de base e historial exacto

- Rama base `feature/anatheos-3d-owner-pilot` en SHA `19c945cf69ff69daa95804639a4aabc9ce9ad7db`. `main` excluida.
- La primera incorporación temporal del PR #27 usó el HEAD histórico `557c8ad2fda7e3d8f43086ecb9f9d7fdb3a895a5` como segundo padre del commit `479e7bea134dc0ae996f774cee4d5bcd9d6d323e`.
- La primera incorporación temporal del PR #28 usó el HEAD histórico `15043046ad693a89f1311547ea2441076d19bf03` como segundo padre del commit `ef82fa9f339d3588e24073b0e68377eacdf49f79`.
- **Actualización ordenada por Dirección:** se verificó por `compare_commits` que las diferencias a los HEAD finales de ambos PR eran **un único archivo documental modificado por PR**, sin cambios ejecutables. Se incorporaron con nuevos merges de dos padres en la rama temporal:
  - PR **#27**, HEAD final `4589de55811dfefcebd9bd1505e018bc4f2d7919`, solo `G1B_HTTP_LOCAL_2026-10-26.md`; merge temporal `a1f565c2d78c3e8ecc4106c17b3f84f23704400a`.
  - PR **#28**, HEAD final `310a8b5f321483f2e8b3591cd14b2db8cd704409`, solo `PROTECCION_RAMAS_ISSUE_20.md`; merge temporal `947de6d1b5b7b4fd6e9dccae9a350fb1673b0784`.
- **Diferencia importante:** los primeros merges prueban qué versiones del código se integraron; los últimos merges **conservan además la genealogía de los HEAD finales de documentación** de PR #27 y #28. Los PR originales y el PR #29 permanecen DRAFT sin autorización de merge.

## 2. Conflictos reconciliados y preservación

- `.github/workflows/ci.yml` combina `push` a `main` **y** `feature/anatheos-3d-owner-pilot`, `pull_request`, instalación, lint, TypeScript, build/tests y matriz HTTP G1B local. No contiene despliegue.
- `docs/anatheos/README.md` preserva auditorías, integración #25, G0/G1A/G2a/G2b, nuevo G1B y propuesta #20.
- `docs/anatheos/ESTADO.md` conserva checkpoints históricos de PR #27 y #28 y resultados anteriores, sin presentar evidencia antigua como el HEAD de hoy.
- `docs/anatheos/REGISTRO_DECISIONES.md` conserva D-001–D-010 y propuestas P-002, P-008, P-009 y P-010, sin aprobar unilateralmente ninguna.
- Se incorporaron **íntegramente los dos anexos documentales posteriores de Dirección**, conservando el texto sobre los límites de confianza de `oai-authenticated-user-email` y la operativa no auditada de publicación de Sites.

## 3. Regresión combinada y evidencia anterior a correcciones

- [GitHub Actions #40376430663](https://github.com/sinergiaestudio/entheos/actions/runs/40376430663) sobre SHA `3fc9490d067e3607a408f42c068f885dd7d7970f`: **70/70 pruebas automatizadas PASS**, 0 FAIL, 0 SKIPPED, lint/TypeScript/build PASS; HTTP local OFF **23/23 PASS** con HEAD/POST/OPTIONS, rutas simples/doblemente codificadas, RSC, API futura y subrutas.
- **Esa CI es histórica, no prueba el nuevo HEAD del acta.** La CI del HEAD definitivo corregido se registrará en un comentario posterior en PR #29 e Issues #7/#20 tras completarse. No sumar runs de otros PR.

## 4. Riesgos y bloqueos que siguen vigentes

- El bloqueo 404 por defecto se probó localmente con flag OFF. No existen pruebas suficientes de autenticación de propietario/tercero real con flag ON, neutralización de cabeceras falsas por el borde de Sites ni aislamiento efectivo de D1/R2.
- GitHub Settings no tiene rulesets activos y ambas ramas permanecen sin protección efectiva. El trigger futuro de push a piloto no ha sido probado en un push real a esa rama, pues ninguna fusión fue autorizada.
- La publicación de Entheos depende de una operativa externa al único workflow GitHub inspeccionado, que requiere verificación administrativa antes de activar reglas.
- No se han incorporado datos clínicos, secretos, dependencias pagas, servicios remotos, usuarios externos ni cambios de producción. No es software diagnóstico.

## 5. Reversión y controles de Dirección

- La rama temporal es descartable: **cerrar PR #29 sin fusionar** no afecta piloto, main ni producción.
- Revisión de Dirección del SHA final y CI obligatoria antes de cualquier fusión independiente; G1B/#7 y protección #20 **siguen ABIERTOS**, aun si la regresión local concluye satisfactoriamente.
- No hay autorización para desplegar Site, habilitar flag, modificar reglas administrativas, usar imágenes reales o integrar en `main`.

## 6. Seguimiento y prueba del último HEAD

Los enlaces de CI al nuevo HEAD, sumatoria exacta de pruebas y verificación del estado de ramas se anotan directamente en [PR #29](https://github.com/sinergiaestudio/entheos/pull/29), [Issue #7](https://github.com/sinergiaestudio/entheos/issues/7) e [Issue #20](https://github.com/sinergiaestudio/entheos/issues/20). Este encabezado sustituye el anterior título concatenado; la numeración es secuencial y no se perdió ninguna decisión ni evidencia histórica.
