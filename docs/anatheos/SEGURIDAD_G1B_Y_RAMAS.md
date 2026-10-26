# ANATHEOS · G1B y protección de ramas · Informe técnico de seguridad

**Fecha:** 26/10/2026 · **Estado:** propuesta para Dirección, no prueba HTTP completada, sin cambios en Settings ni infraestructura. Issues #7, #20 y #25.

## 1. Hallazgos actuales y alcance demostrado

- `main` = `8e7602280d6c4fddc234c1973537839592683798` y piloto = `aec8222c5fa4b529575fc49a85f401ecf7a41a49` al iniciar Issue #25. Ambos reportan `protected=false`.
- GET `/repos/sinergiaestudio/entheos/rulesets` respondió **lista vacía** el 26/10/2026. Consultar el detalle de `branches/main/protection` devolvió **403: Resource not accessible by integration**; por ello NO se afirma haber inspeccionado todas las opciones de branch protection. Antes de habilitar cualquier regla, un administrador debe confirmar permisos y configuración desde GitHub Settings.
- La rama temporal de Issue #25 integra el código de flag off por defecto (`ANATHEOS_PILOT_ENABLED`), `APP_OWNER_EMAIL` e identidad administrativa del servidor; la comparación de identidad solo es fiable si `oai-authenticated-user-email` no puede ser impuesta por un cliente a través del proxy/frontdoor.
- `next.config.ts` declara `private, no-store`, `noindex` y cabeceras para la ruta. **No hay captura HTTP que demuestre que el Worker desplegado las envía.**
- `vite.config.ts`, `worker/index.ts`, `.openai/hosting.json` y `cloudflare-env.d.ts` incluyen contratos D1/R2 de Entheos para desarrollo/hosting. Aunque la ruta ANATHEOS no llama directamente a esas capacidades, **un runtime de staging no está segregado automáticamente**. No se ha creado staging remoto.

## 2. Matriz G1B de verificación real requerida antes de cualquier habilitación

| Prueba | Instrumentación/condiciones | Resultado exigido | Estado |
|---|---|---|---|
| Flag ausente/`false` | Lab local, `GET /app/anatheos-3d`, con y sin cabecera de propietario | 404 sin render de datos, no ruta compartida de archivos | **No ejecutado vía HTTP** |
| Anónimo, flag `true` | Solo en runtime **aislado** con proveedor autenticado confiable | Redirección controlada a login, ninguna vista/artefacto ANATHEOS | **Bloqueado por entorno** |
| Tercero autenticado | Dos sesiones reales distintas, sin registrar correos en CI | 404 incluso ante rutas RSC y otros métodos | **Bloqueado por entorno** |
| Propietario autenticado | Sesión legítima, control de cookies expiradas y renovación | Mostrar solo módulo experimental; no acceso lateral a D1/R2 | **Bloqueado por entorno** |
| Cabeceras suplantadas | Cliente anónimo envía `oai-authenticated-user-email` y variantes; cliente tercero intenta inyectar correo del owner | Borde elimina/sobrescribe cualquier valor aportado por cliente; owner gate sigue negando | **Bloqueador crítico** |
| No-store/noindex/CSP | GET, RSC, errores 404, recursos derivados y routes futuras | Cabeceras reales sin cache pública, indexación ni fuga | **Pendiente** |
| API/carga DICOM | Inventario de rutas actuales y futuras en `/app/anatheos-3d` y `/api/anatheos*` | Ningún endpoint expuesto sin guard equivalente y test negativo | **Pendiente al agregar API** |
| Estado y bindings | Listar (sin valores secretos) ID de proyecto y nombres de bindings del staging y comparar con producción | Identidades, D1, R2, buckets y URLs segregados; denegar deploy si coinciden | **Bloqueado, no hay staging** |
| Revocación y rollback | Desactivar flag, invalidar sesión, rollback de versión | 404, desaparición de vistas, sin datos clínicos persistidos | **Pendiente** |

No ejecutar solicitudes contra la URL de producción para simular autenticación ni afirmar que un header con email autenticó a nadie. El riesgo es la **proveniencia del header**; los tests unitarios no cierran esta brecha.

## 3. Estrategia gratuita propuesta para #20

GitHub Docs confirma disponibilidad de branch protection y branch rulesets en repositorios **públicos** de GitHub Free (licencias gratuitas), sujeto a permisos de administración y opciones concretas del repositorio:

- <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule>
- <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets>

**Propuesta A · `main` (Entheos productivo):** crear ruleset específico de `main`, inicialmente modo de evaluación si está disponible, luego `Active` solo tras ensayos aprobados; requerir PR antes de merge, prohibir force-push y eliminación, exigir check exacto GitHub Actions `verify` (comprobar nombre y origen) y resolver conversaciones de revisión. Requerir revisor externo solamente si realmente existe otra cuenta con permiso de escritura; no bloquear permanentemente un repositorio de único mantenedor. Evaluar aplicabilidad a administradores/bypass explícitos. Revisar que Site y bots desplieguen normalmente sin depender de push directo a `main`.

**Propuesta B · `feature/anatheos-3d-owner-pilot`:** ruleset independiente de `main`; PR obligatorio, check `verify`, sin borrado ni force-push y limitación de bypass. Mantener `anatheos/issue-*` libre para desarrollo y experimentos. **No activar requisito de historial lineal sin probarlo**: la rama de revisión #25 utiliza merge commits de dos padres. Habilitar estrategia más estricta cuando se confirme su compatibilidad con ese flujo.

**Precauciones:**
1. Un PR DRAFT no es control de seguridad contra push directo.
2. Si una regla requiere revisión por persona distinta del autor y solo existe un mantenedor, puede bloquear todos los merges.
3. No confiar en que `verify` equivale a seguridad de despliegue o validación médica; solo cubre el workflow existente.
4. Si GitHub ofrece ruleset en modo `Evaluate`, usarlo para observar violaciones antes de `Active`; la disponibilidad concreta se revisa en Settings.
5. Sin verificar permisos actuales no aplicar cambios ni afirmar protección efectiva.
6. Registrar captura saneada de Settings y resultado de un PR de prueba deliberadamente no conforme **solo en rama aislada** antes de adoptar regla efectiva. No provocar pruebas destructivas sobre `main`.

**Rollback propuesto:** exportar/capturar configuración no secreta antes de cambios, anotar IDs de ruleset, guardar plan para desactivar temporalmente o restaurar reglas anteriores, corroborar funcionamiento de CI y deploy. Solamente administrador/titular con aprobación explícita puede ejecutarlo.

## 4. Go/no-go

**NO-GO actual para Site remoto:** flag apagado, identidad upstream y separación D1/R2 sin probar. **NO-GO para fusionar PR #26:** falta revisión/decisión de Dirección aun si CI verde. **NO-GO para Settings:** falta aprobación y auditoría de procesos de despliegue. **GO para trabajo local no productivo con DICOM sintéticos y regresiones cruzadas.**

El informe no habilita software/licencias de pago, tratamiento de estudios reales ni uso diagnóstico. Riesgos vinculados: #7, #8, #9, #10, #19, #20, #25.
