# ANATHEOS 3D — Auditoría G0 (Issue #6)

**Fecha:** 2026-10-26. **Alcance:** lectura del repositorio público, documentación, Issues #6–#20, PR #5 y GitHub Actions; sin datos clínicos y sin despliegue.

## Baseline comprobada antes de intervenir

| Elemento | Evidencia observada |
|---|---|
| Repositorio | `sinergiaestudio/entheos`, público; rama predeterminada `main` |
| main (antes del trabajo) | `8e7602280d6c4fddc234c1973537839592683798` |
| Integración experimental (antes del trabajo) | `f66ffaa919b26ab3f4290499009b46812df957ab` |
| Comparación | piloto 26 commits adelante de main y 0 detrás, 15 archivos añadidos, ninguno modificado en main por estos commits |
| PR #5 | abierto, **draft=true**, **merged=false**, base `main`, head rama piloto; **NO FUSIONAR** |
| CI inicial | Run [40333568854](https://github.com/sinergiaestudio/entheos/actions/runs/40333568854), `completed/success`, SHA `f66ffaa` |
| Pasos CI | checkout, instalación, lint, typecheck, `npm test` (incluye build y tests) correctamente completados para ese SHA |
| Protección de ramas | **main y piloto reportan `protected=false`**; Issue #20 abierto, no se alteraron settings |
| Documentación | README canónico y los diez documentos de referencia leídos; enlaces locales presentes, Issues #6–#20 recuperados |
| Código | ruta server-side para `requireChatGPTUser` / `isGlobalAdmin`, parser Part 10 local restringido, visor de canvas 2D y pruebas sintéticas |
| Despliegue y validación | no se constató preview aislado, control de acceso remoto, comparación Slicer ni render volumétrico 3D |

**Interpretación:** una ejecución CI exitosa demuestra que terminaron los pasos automatizados en el SHA observado; no prueba calidad clínica, ausencia de PHI, aislamiento de producción, autenticación real, orientación física ni accesibilidad funcional.

## Hallazgos y riesgos de primera prioridad

1. **P0 · Ramas sin protección (Issue #20).** Las dos referencias presentan `protected=false`. Mantener PR #5 en borrador es una barrera de procedimiento, **no una restricción técnica a merges o pushes directos**. Se requiere propuesta y aprobación específicas de reglas sin costo ni impacto no previsto sobre Entheos.
2. **P0 · Autorización solo codificada (Issue #7).** La página controla `isGlobalAdmin`, calculado con cabecera de identidad y `APP_OWNER_EMAIL`. La confianza en la inyección de la cabecera y el comportamiento anónimo/otra cuenta sólo se comprobarán en un staging realmente aislado. No está permitido desplegar para probarlo sin autorización separada.
3. **P0 · Geometría exploratoria (Issues #8–#10).** El lector maneja sólo imágenes monocromáticas uniframe Little Endian sin compresión; no hay soporte de compressed/multiframe ni resampling espacial oblicuo. Las tolerancias geométricas del código son criterios heurísticos de prototipo, no validación contra Slicer. No se ha verificado lateralidad clínica.
4. **P0 · Datos sensibles (Issue #19).** El repositorio es público; prohíbe subir estudios reales, credenciales, PHI y artefactos derivados. No se realizó un escaneo retrospectivo exhaustivo de todos los blobs históricos; ausencia de fuga no certificada.
5. **P1 · Cobertura y pruebas.** Los tests existentes cubren casos sintéticos concretos; faltan corpus físico versionado, casos adversariales y pruebas navegador/WebGL. Requiere gates G2/G3, no atajos.

## Primer bloque técnico seguro G0

- Se introduce `tests/anatheos-governance.test.mjs`, basado sólo en `node:test` y librerías estándar: comprueba referencias documentales locales, cobertura de Issues #6–#20/PR #5 e invariantes textuales de alcance, privacidad y estado. Se ejecuta en el `npm test` existente; **no necesita librerías, servicios ni credenciales nuevos**.
- Estas son **regresiones documentales**. No inspeccionan GitHub en tiempo real ni constituyen controles preventivos de acceso, datos sensibles o branch protection.
- Esta auditoría se conserva como acta inmutable del baseline. `ESTADO.md` conserva el estado evolutivo, que debe actualizarse al aceptar PR.
- Rama de ejecución: `anatheos/issue-6-g0-audit`, creada a partir del SHA piloto `f66ffaa`; PR contra la rama piloto, sin merge.

## Dependencias y orden propuesto

| Orden | Issue | Bloque / puerta de salida |
|---|---|---|
| 1 | #6 G0 | Revisar prueba de gobierno, documentación, CI del nuevo PR y aceptación de dirección |
| Paralelo, **sin cambiar settings** | #20 G0 | Propuesta gratuita de protección de `main`/piloto y rollback, sujeta a aprobación |
| 2 | #7 G1 | Testar autorización fail-closed y configuración local aislada sin D1/R2 productivos; no publicar |
| 3 | #9 G2b | Corpus sintético con geometría conocida, goldens y plan de comparación 3D Slicer |
| 4 | #8 G2a | Spike decodificador DICOM libre, licencia, formato, memoria y falsos positivos |
| 5 | #10 G3a | MPR espacial/oblicuo contra corpus validado; no antes de G2 |

## Próxima verificación

En el PR de #6, registrar HEAD, CI sobre ese HEAD, archivos añadidos/modificados, alcance exacto de pruebas y fallos. Mantener #6 abierto en revisión hasta aceptación y **mantener #20 abierto** hasta decisión de configuración. No desplegar ni cambiar `main`.
