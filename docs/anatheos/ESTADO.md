# ANATHEOS 3D — Estado central y tablero de control

**Fecha base:** 2026-10-26
**Versión:** 1.0 (creación de gobierno; no modifica funciones del producto)
**Autoridad:** comprobar HEAD real, PR, GitHub Actions, Issue y evidencia antes de atualizar esta hoja. Ningún dato clínico real.

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
