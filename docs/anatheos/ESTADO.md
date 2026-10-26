# ANATHEOS 3D — Estado central y tablero de control

**Fecha base:** 2026-10-26
**Versión:** 1.0 (creación de gobierno; no modifica funciones del producto)
**Autoridad:** comprobar HEAD real, PR, GitHub Actions, Issue y evidencia antes de atualizar esta hoja. Ningún dato clínico real.

## Checkpoint POST-MERGE autorizado · 2026-10-26 · Issue #25

PR #26 fusionado con método `merge` exclusivamente a la rama piloto. **HEAD inicial integrado `8c0f29d30670c4e2d21d8673a1050d02b61f5bfd`**, desde la base `aec8222c5fa4b529575fc49a85f401ecf7a41a49` y el PR HEAD `b40218c95c3b328be240f9e9c43f5cd3b1a1307e`. Resultado GitHub `merged=true`. Autorización [#6421827902](https://github.com/sinergiaestudio/entheos/pull/26#issuecomment-6421827902).

- **CI post-merge:** [GitHub Actions #40364071117](https://github.com/sinergiaestudio/entheos/actions/runs/40364071117), job 121716889176 `completed/success`: **60 tests / 60 PASS / 0 FAIL / 0 SKIPPED / 0 CANCELLED**; instalación, lint, TS y build PASS; un warning de lint histórico `no-img-element` fuera de ANATHEOS.
- `main` HEAD `8e7602280d6c4fddc234c1973537839592683798` permanece intacto. No se publicaron cambios ni se activaron Site, servicios pagos, D1/R2 o acceso de terceros.
- El código combinado de G0/G1A/G2b-A/G2a-A está **integrado técnicamente y probado por CI en piloto**, no validado clínicamente. La identidad de header `oai-authenticated-user-email`, aislamiento de datos, geometría Slicer y decodificador OSS definitivo permanecen **P0/P1 abiertos**.
- Issues #7, #8, #9, #20 continúan ABIERTOS; el cierre administrativo de Issue #25 depende de registro y revisión de Dirección. Los apartados históricos posteriores o anteriores que declaran `sin fusionar` describen un checkpoint previo, no contradicen este hito.
- **Este propio commit documental** debe superar su CI separada antes de certificar el HEAD final de la rama piloto. Consultar [acta de integración](INTEGRACION_ISSUE_25_2026-10-26.md).

## Checkpoint G2a-B Cornerstone OSS · 26/10/2026 (PR separado)

- Rama `anatheos/issue-8-cornerstone-oss-spike` desde piloto `19c945cf69ff69daa95804639a4aabc9ce9ad7db`. Se preparó prototipo cliente Vite y workflow independiente para instalar solo en CI efímera los paquetes Cornerstone 5.13.1, auditar licencias declaradas y comprobar bundling WASM/worker. Referencia [CORNERSTONE_SPIKE_G2A_2026-10-26.md](CORNERSTONE_SPIKE_G2A_2026-10-26.md).
- **CI pendiente** para evaluar resultado real de npm/build; aún no hay pruebas de decodificación CT/RM, compressed/multiframe, Slicer, memoria, Vitext Workers remoto ni diagnóstico. No sustituye P1A ni añade dependencias al proyecto estable.
- G1B #7 y protección de ramas #20 continúan bloqueando publicación y cambios de settings; Site y main intactos.

## Panel ejecutivo

| Dimensión | Estado verificable al elaborar este registro | Evidencia |
|---|---|---|
| Entheos productivo | No modificado por commits de ANATHEOS a main | Comparación main vs rama de ANATHEOS |
| Repositorio | Público (GitHub sinergiaestudio/entheos) | Repo metadata |
| Rama de integración | feature/anatheos-3d-owner-pilot | GitHub branch |
| Revisión abierta | PR #5 en draft, apuntado a main solo para control histórico/CI, NO FUSIONAR | https://github.com/sinergiaestudio/entheos/pull/5 |
| Ruta piloto owner-only | Codificada en rama con requireChatGPTUser e isGlobalAdmin | app/app/anatheos-3d/page.tsx |
| Lector DICOM local | Codificado, alcance estrecho monocromático Little Endian Part 10 | lib/anatheos/dicom.ts |
| Exploración básica | Codificada: stack y vistas ortogonales simples únicamente en ejes compatibles | components/anatheos/dicom-browser.tsx |
| Tests sintéticos | Escritos, CI de la revisión inicial completado en GitHub; comprobar HEAD antes de nuevas conclusiones | tests/anatheos-dicom.test.mjs; Actions |
| Renderizado volumétrico 3D | NO implementado | — |
| Segmentación y exportación | NO implementadas | — |
| Comparación con 3D Slicer | NO realizada | — |
| Preview/Site independiente | NO desplegado | — |
| Pruebas de propietario/anónimo/tercero sobre URL remota | NO realizadas | — |
| Acceso para terceros | NO habilitado ni aprobado | D-004, D-006 |
| Licencias/APIs pagas | Ninguna incorporada al prototipo de ANATHEOS en rama | código inicial y política D-002 |
| Gobierno de proyecto | Plan, arquitectura, QA, decisiones, protocolo e issues creados | docs/anatheos |

## Checkpoint de auditoría G0 · 2026-10-26 (propuesta en PR de #6)

- Baseline de `main` antes del trabajo: `8e7602280d6c4fddc234c1973537839592683798`.
- Baseline de integración antes del trabajo: `f66ffaa919b26ab3f4290499009b46812df957ab`, 26 commits por delante y ninguno detrás de `main`.
- Workflow inicial [40333568854](https://github.com/sinergiaestudio/entheos/actions/runs/40333568854): `success` en ese SHA, incluyendo lint, typecheck y `npm test` (build y tests). Los checks del PR de G0 son **pendientes de comprobación independiente**.
- PR #5: abierto y borrador, base `main`, sin merge; **no fusionar**.
- Protección de `main` y piloto: `protected=false`. Issue #20 sigue P0; no modificar settings sin autorización.
- [Acta de auditoría](AUDITORIA_G0_2026-10-26.md): inventario, limitaciones y matriz de dependencias. La rama `anatheos/issue-6-g0-audit` propone prueba estática de enlaces y decisiones; **no** constituye revisión médica ni test de acceso real.
- **G0 permanece EN REVISIÓN hasta CI del HEAD del PR, revisión y aceptación.** No se creó entorno remoto ni se utilizaron estudios reales.

## Checkpoint G1A · 2026-10-26 (rama de Issue #7, **sin fusionar**)

- Rama propuesta: `anatheos/issue-7-owner-gate` desde HEAD piloto `f66ffaa919b26ab3f4290499009b46812df957ab`, sin modificar `main` ni la integración.
- Puerta `ANATHEOS_PILOT_ENABLED` estrictamente igual a `true` y verificación adicional de propietario antes de renderizar ANATHEOS. Por defecto, ruta inaccesible; la habilitación **no se autoriza en producción**.
- Cabeceras de caché/robots declaradas para rutas ANATHEOS; tests sintéticos de propietario/tercero/anónimo y configuración. La efectiva emisión de cabeceras en Vinext/Worker queda **sin prueba HTTP**.
- [Protocolo G1A](LAB_G1_LOCAL.md) documenta aislamiento local, límites, matriz de aceptación, y riesgo de cabeceras de identidad si el borde no las sanea. `APP_OWNER_EMAIL` debe permanecer secreto de entorno, no almacenado en repo.
- **G1 no está terminado:** no se ejecutó login real/otro usuario, no se verificó proxy confiable, D1/R2 staging ni URL remota. No desplegar.
- Checks nuevos de CI/HEAD y PR deben registrarse al final; no deducir estado sólo por commits.

## Checkpoint G2b-A · 2026-10-26 (Issue #9, rama en revisión)

- Se propone un **corpus programático sintético** de nueve casos y generador local de DICOM Part 10, sin datos de pacientes ni binarios en GitHub, generado únicamente en memoria salvo exportación local explícita **fuera** del repositorio.
- [Corpus, goldens y protocolo Slicer](CORPUS_DICOM_SINTETICO.md); hashes SHA-256 reproducibles por `node scripts/anatheos-corpus-manifest.mjs`.
- Se agregan pruebas de casos axial anisotrópico, normal negativa/lateralidad, oblicuo, irregularidad, desplazamiento en plano, mezcla de series, implicit LE y rechazo de JPEG marcado/multiframe.
- **No significa geometría validada:** goldens de test se comparan contra datos inventados; falta importación y contraste Slicer, dataset público desidentificado y pruebas clínicas. 3D volumétrico sigue sin implementar.
- G1B pendiente de autenticar origen de cabeceras confiables; no existe entorno remoto owner-only verificado y no se activa ningún flag del piloto.
- **Pruebas automatizadas verificadas:** commit `357ba8802f8bffb39563b2bb2d7df1d707016f20`, [GitHub Actions #40347354554](https://github.com/sinergiaestudio/entheos/actions/runs/40347354554), **32 PASS / 0 FAIL / 0 SKIPPED** (incluye pruebas de manifest/exportador); lint terminó con **1 advertencia preexistente** en `components/timeline-documents.tsx` y sin errores; typecheck/build PASS. El primer CI de este trabajo [#40346916743](https://github.com/sinergiaestudio/entheos/actions/runs/40346916743) falló por igualdad estricta de floats (29/30), corregido en commit `686e6ccd6809e7e0acb73bce9a8d6c8c85a5149b`. **CI del presente commit documental sujeto a comprobación posterior**. G2b permanece **parcial/en revisión**, sin Slicer.

## Checkpoint G2a-A · 2026-10-26 (Issue #8; rama de trabajo, no integrada)

- Rama `anatheos/issue-8-import-intake`, derivada de `feature/anatheos-3d-owner-pilot` en SHA `f66ffaa919b26ab3f4290499009b46812df957ab`.
- `lib/anatheos/dicom-intake.ts`: preflight Part10 máx. 64 KiB, exclusión temprana de sintaxis no admitidas, presupuesto 600 archivos / 32 MB por archivo / 320 MB total, lectura serializada, cancelación cooperativa, exclusión de geometrías incompatibles y reporte sin etiquetas arbitrarias de DICOM. El lector P1A sigue siendo quien decodifica píxeles, **no fue sustituido**.
- `components/anatheos/dicom-browser.tsx` usa el nuevo contrato y ofrece cancelación de lectura; `tests/anatheos-intake.test.mjs` añade casos adversariales sintéticos y privacidad.
- [Matriz de formatos y spike de decoder OSS](DECODIFICADOR_G2A.md). Cornerstone3D/dicom-image-loader como candidato preferente para spike; ni instalado ni aprobado definitivamente. P-002 continúa propuesta sin adopción.
- No se integraron PR #21/#22/#23, todavía draft, para evitar mezclas de ramas de revisión. Futuras integraciones deberán conciliar README/ESTADO y correr CI de la combinación.
- **CI verificado de código:** [GitHub Actions #40350908859](https://github.com/sinergiaestudio/entheos/actions/runs/40350908859), commit `ff91c47f1c6f3ea1297f483e976d5a61e1632150`, **31/31 PASS, 0 FAIL, 0 SKIPPED**, lint (1 advertencia preexistente fuera de ANATHEOS), typecheck y build PASS. Se registraron dos ejecuciones fallidas iniciales por compatibilidad del ejecutor Node24 con TypeScript, corregidas sin alterar el parser. El presente commit documental debe tener su propio CI comprobado antes de declarar HEAD final exitoso. No hay validación Slicer, datos clínicos ni despliegue; G1B sigue bloqueado por procedencia confiable de identidad.

## Checkpoint de integración propuesta · Issue #25 · 2026-10-26

- Rama temporal `anatheos/issue-25-integration-review`, derivada de piloto auditado **actual** `aec8222c5fa4b529575fc49a85f401ecf7a41a49` que ya contiene la auditoría independiente de Dirección y su vínculo en README.
- Referencias de origen: PR [#21](https://github.com/sinergiaestudio/entheos/pull/21) (G0), [#22](https://github.com/sinergiaestudio/entheos/pull/22) (G1A), [#23](https://github.com/sinergiaestudio/entheos/pull/23) (G2b-A), [#24](https://github.com/sinergiaestudio/entheos/pull/24) (G2a-A); merge commits **solo en esta rama temporal**, con los heads originales como segundos padres, sin fusionar ninguno de los PR originales en piloto.
- Se preservaron los cuatro checkpoints previos y los añadidos G0, G1A, G2b-A y G2a-A. El documento [INTEGRACION_ISSUE_25_2026-10-26.md](INTEGRACION_ISSUE_25_2026-10-26.md) describe reconciliación, límites, regresión cruzada y rollback.
- **Integración combinada: pendiente de CI en HEAD exacto** y revisión de Dirección. No hay despliegue, auditoría HTTP de identidad, Slicer, 3D volumétrico ni datos médicos. No cerrar #6/#7/#8/#9/#25 sin criterios cumplidos.

## Checkpoint de propuesta G1B/#20 · 2026-10-26

- [SEGURIDAD_G1B_Y_RAMAS.md](SEGURIDAD_G1B_Y_RAMAS.md) detalla prueba de procedencia de `oai-authenticated-user-email`, matriz de peticiones HTTP, aislamiento de bindings y reglas gratuitas de protección de ramas. No se ejecutaron pruebas de sesión ni se habilitó staging; solo test de prohibición de destino no loopback en el script auxiliar, **sin prueba HTTP aún**.
- API GitHub consultada: `rulesets` devuelve lista vacía, ambos branches reportan `protected=false`. Endpoint detallado de branch protection devolvió **403 por permisos de integración**: no asumir una auditoría integral de configuración.
- Propuesta sujeta a Dirección; no se cambió GitHub Settings ni se desplegó ningún Site. No autorizar `ANATHEOS_PILOT_ENABLED=true` en un remoto.

## Evidencia CI conjunta y revisión de seguridad · 2026-10-26

- PR de revisión temporal [#26](https://github.com/sinergiaestudio/entheos/pull/26), rama `anatheos/issue-25-integration-review`; CI conjunto [GitHub Actions #40355584304](https://github.com/sinergiaestudio/entheos/actions/runs/40355584304) verificado **COMPLETED/SUCCESS** sobre SHA `79166c8c0234f76f804ba6a083c2ccec1be11a0b`, **60 tests / 60 PASS / 0 FAIL / 0 SKIPPED / 0 CANCELLED**. Instalación, lint (1 warning preexistente por `img` en Entheos), typecheck y build PASS.
- Tests cruzados: G25 owner/flag + corpus axial/oblicuo + rechazos/cancelación; G1B: bloqueo de URLs remotas para herramienta HTTP de loopback y self-test sin red. No equivale a test HTTP real ni autorización de proveedor de identidad.
- Comparación `feature/anatheos-3d-owner-pilot...anatheos/issue-25-integration-review`: **26 archivos, 51 commits por delante / 0 detrás** por preservación de historia de cuatro ramas con commits de dos padres. No se agregó dependencia a `package.json`, no se cambiaron datos productivos.
- Al preparar este informe: `main` `8e7602280d6c4fddc234c1973537839592683798`; piloto `aec8222c5fa4b529575fc49a85f401ecf7a41a49`; ambos intactos y no protegidos, Issue #20. PR #21–#24 y #26 **DRAFT y no fusionados**.
- [Informe de seguridad G1B y protección de ramas](SEGURIDAD_G1B_Y_RAMAS.md) documentado. API GitHub de rulesets vacía, lectura de branch protection con 403; NO se aplicaron reglas.
- **Control de revisión:** la ejecución anterior verifica el código; este nuevo commit de documentación requiere su propia CI sobre HEAD para cerrar formalmente QA. Issues #6, #7, #8, #9, #20, #25 mantienen bloqueos. Sin Slicer, Site, PHI, 3D volumétrico, ni validación clínica.

## Mapa de trabajo (gates)

- **G0 — En curso:** documentación e Issues organizados; pendiente auditar consistencia final y acordar inicio de chat técnico.
- **G1 — Pendiente:** entorno separado y test de autenticación real.
- **G2 — Parcial/prototipo:** parser restringido y pruebas sintéticas; sin corpus DICOM de referencia ni soporte general.
- **G3 — Parcial/prototipo:** ortogonales en ejes alineados; falta resampling físico completo y validación.
- **G4 — Pendiente:** no hay visualización volumétrica 3D.
- **G5 — Pendiente:** no hay segmentación/malla/IA.
- **G6 — Pendiente:** no hay almacenamiento ni conexión longitudinal para este módulo.
- **G7 — Pendiente:** no hay Site piloto desplegado.
- **G8 — No autorizado:** aún no se puede habilitar terceros.

## Issues y dependencias inmediatas

1. #6 y #20 — G0: consolidación final y plan para protección de ramas; fuente de verdad y operación.
2. #7 — G1: aislamiento y owner-only; trabajo temprano en paralelo.
3. #9 — G2b: corpus público/sintético y referencia geométrica.
4. #8 — G2a: loader DICOM robusto; elección documentada tras investigar.
5. #10 — G3a: MPR verdadero, posterior a corpus y loader.

G4 depende de los resultados técnicos; no precipitar renderizados 3D sólo para mostrar una demo.

## Riesgos abiertos (prioridad)

- **R-001 Crítico:** el repositorio es público; jamás usar datos clínicos reales como fixtures.
- **R-002 Crítico:** la ruta owner-only está codificada, pero no auditada bajo entorno desplegado.
- **R-003 Crítico:** el lector P1A es restringido; orientación/paciente y MPR oblicua no validadas.
- **R-004 Alto:** volumen 3D puede exceder recursos del navegador o de Workers; prever fallback y procesamiento local.
- **R-005 Alto:** decisiones en dos chats divergen si no se documentan; obligatoria escritura en ADR y Issues.
- **R-006 Alto:** licencias de paquetes y modelos AI varían; no confundir software OSS y licencia de pesos.
- **R-007 Alto:** verificado que main y rama piloto registran protected=false en GitHub; Issue #20 exige propuesta de protección sin modificar configuración antes de aprobación.

## Plantilla de siguiente actualización

Fecha y hora / observador:
- HEAD observado:
- Issue/PR:
- Cambios (archivos/SHAs):
- CI (URL/run, estado, HEAD):
- Pruebas funcionales (dataset sintético/público, ambiente y resultado):
- Validación geométrica (sí/no, pruebas):
- Seguridad (sí/no/pendiente):
- Despliegue (sí/no, URL verificada o no):
- Decisiones cambiadas (ADR):
- Riesgos/bloqueos:
- Recomendación a dirección:
- Próximos tres issues:

**Advertencia:** indicadores sin evidencia no significan progreso. Actualizar la información después de comprobaciones, no después de promesas.
