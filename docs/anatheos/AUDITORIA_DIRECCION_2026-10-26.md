# ANATHEOS 3D — Auditoría de Dirección · 26 de octubre de 2026

**Tipo:** evaluación independiente de los cambios propuestos desde el chat de control global.  
**Alcance revisado:** rama piloto, ramas issue #6–#9, PR #21–#24, CI HEAD, diferencias de código, pruebas, conversaciones/Issues de GitHub y documentación.  
**Importante:** esta auditoría inspeccionó código y resultados de GitHub Actions; no ejecutó un navegador Site, pruebas de identidad reales ni 3D Slicer. No tiene naturaleza clínica.

## Conclusión ejecutiva

**Progreso real, ordenado y documentado, pero todavía no integrable/publicable sin pruebas cruzadas.** Los cuatro PR son DRAFT hacia la rama piloto, están separados de main y cada uno tiene su CI verde. No existe prueba de la combinación, validación geométrica externa ni entorno privado con autenticación verificada.

## Evidencia y estados

| PR | Issue | HEAD auditado | CI Github | Resultado / alcance |
|---|---|---|---|---|
| [#21](https://github.com/sinergiaestudio/entheos/pull/21) | #6 G0 | aea450f8d7937b03c593a81a77940646b4a447c7 | [40341263803](https://github.com/sinergiaestudio/entheos/actions/runs/40341263803) PASS | Acta baseline, cuatro tests documentales; no control de seguridad real |
| [#22](https://github.com/sinergiaestudio/entheos/pull/22) | #7 G1A | ea4ee6ac77d297a291ed7f84a9336d809fcb47a3 | [40344798301](https://github.com/sinergiaestudio/entheos/actions/runs/40344798301) PASS | Flag off, owner gate, tests de predicado y headers declarativos, **sin prueba del borde HTTP** |
| [#23](https://github.com/sinergiaestudio/entheos/pull/23) | #9 G2b-A | 6523c3df2983e2e22c8bff392cc050d0fc234887 | [40347653404](https://github.com/sinergiaestudio/entheos/actions/runs/40347653404) PASS | Nueve casos sintéticos, posiciones LPS coherentes, SHA-256; **sin Slicer/IOR clínico** |
| [#24](https://github.com/sinergiaestudio/entheos/pull/24) | #8 G2a-A | 8cab19e55a51fa70790a1d530a60b9495af5284b | [40351152922](https://github.com/sinergiaestudio/entheos/actions/runs/40351152922) PASS | Frontera de ingreso/validación/cancelación, **decodificador anterior P1A permanece** |

Cada PR pasó lint, TypeScript y build/tests en su HEAD. Se conservaron errores CI históricos y correcciones. No sumar conteos de suites independientes para inferir cobertura integrada. Algunos runs lint reportaron una advertencia preexistente por `<img>` fuera de ANATHEOS.

## Estado del repositorio al revisar

- `main`: `8e7602280d6c4fddc234c1973537839592683798`, sin commits ANATHEOS; GitHub marca `protected=false`.
- Integración `feature/anatheos-3d-owner-pilot`: `f66ffaa919b26ab3f4290499009b46812df957ab` al momento de comparar, 26 commits adelante de main / 0 detrás, cuatro nuevos PR no fusionados. `protected=false`.
- PR #5 continúa borrador contra main: no fusionar ni publicar. GitHub sigue público.
- No se verificó Site ANATHEOS privado, identidad upstream confiable, aislamiento D1/R2, capacidad 3D volumétrica ni compatibilidad DICOM general.

## Hallazgos prioritarios

### P0 — Seguridad de identidad y ambiente
El nuevo helper de propietario valida email y privilegio si la identidad es confiable; **no demuestra procedencia ni saneamiento de `oai-authenticated-user-email`** en el borde. Una cabecera de origen manipulable podría invalidar las garantías de acceso. El flag `ANATHEOS_PILOT_ENABLED` debe permanecer apagado en cualquier entorno remoto hasta ensayos anónimo/otro usuario/owner y verificación HTTP de headers, confianza y segregación de datos. Issue #7.

### P0 — Integración conjunta no probada
PR #21–#24 parten de la misma base y modifican `docs/anatheos/README.md`, `ESTADO.md` y/o `REGISTRO_DECISIONES.md`. Integrar sin consolidar estos documentos puede perder información, y una CI verde por PR no certifica la combinación. Se creó [Issue #25](https://github.com/sinergiaestudio/entheos/issues/25) para rebase/reconciliación, prueba cruzada y validación del SHA combinado, **sin autorizar todavía ningún merge**.

### P0 — Protección de ramas
`main` y piloto no están protegidas por reglas verificadas. Un PR DRAFT es una norma procedimental, no una barrera fuerte contra push directo o cambios de configuración. Issue #20: proponer protección sin pago ni impacto de producción, someter a decisión del titular.

### P0/P1 — Validación geométrica
Los golden LPS en #23 son coherentes con la geometría fabricada; no equivalen a referencia de imágenes clínicas ni a validación externa. Los DICOM sintéticos son mínimos, no todos cumplen un IOD CT completo. Debe probarse importación Slicer, alineación, orientación/LPS-RAS y tolerancia, y contrastar conjuntos públicos desidentificados antes de afirmar fiabilidad. Issues #9/#10.

### P1 — Memoria, cancelación y decodificador
#24 limita tamaño de entrada (hasta 320 MB) y lectura secuencial, pero no limita realmente RAM residente. `Blob.arrayBuffer()` iniciado puede continuar tras cancelación. El mensaje de cancelación no debe interpretarse como liberación inmediata de todos los buffers. Faltan mediciones y tests de navegadores; no hay loader OSS definitivo. Issue #8, posteriormente #13.

### P1 — Falta verificación funcional en interfaz
No se inspeccionó runtime real del prototipo ni hubo screenshots de visor DICOM en navegador con conjunto de prueba. La UI 2D experimental no puede darse por verificada como funcional ni como producto clínico.

## Decisión de control

1. **No aceptar como completos ni cerrar** Issues #6, #7, #8, #9; sus partes A están técnicamente avanzadas, no los objetivos enteros.
2. **Mantener PR #21–#24 DRAFT** hasta revisión por Dirección; no fusionar en piloto por iniciativa de esta auditoría.
3. Mantener PR #5 DRAFT y `main` intacta; prohibido deploy de Site no verificado o uso de PHI.
4. Enviar comentarios de control a cada PR y conectar Issue #25 con plan de integración/reconciliación/CI combinado.
5. Prioridad: #20 protección de ramas (propuesta, sin configurar), #25 integración, #7 origen de identidad; después #9 Slicer y #8 loader robusto.
6. No autorizar contratar nuevas aplicaciones, SaaS ni APIs; usar software libre bajo compatibilidad de licencias verificable.

**Resultado:** `Codificado parcialmente / CI aisladas PASS / Integración NO probada / Geometría externa NO validada / Seguridad de acceso NO auditada / Despliegue NO realizado`.

## Evidencias de comunicación

- Dirección dejó comentarios en PR #21–#24 con evaluación específica.
- Issue de integración: https://github.com/sinergiaestudio/entheos/issues/25
- Bloqueo de protección de ramas: https://github.com/sinergiaestudio/entheos/issues/20

La aceptación final requiere revisar PR/HEAD nuevos; este documento describe una fotografía del repositorio a la fecha y SHA aquí indicados, no certifica los cambios posteriores.
