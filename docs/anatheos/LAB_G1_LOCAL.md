# ANATHEOS 3D — Laboratorio y seguridad G1 (bloque G1A)

**Estado:** controles de código y procedimiento propuestos en Issue #7; **no es una certificación de entorno aislado ni autorización para publicar**. Fecha: 2026-10-26.

## 1. Alcance del bloque

- ANATHEOS no debe poder abrirse sin la bandera de servidor `ANATHEOS_PILOT_ENABLED` exactamente igual a `true`. **Sin bandera o con cualquier otro valor: 404**, incluso para el administrador de Entheos.
- Con la bandera habilitada, se exige `requireChatGPTUser` del servidor, el privilegio `isGlobalAdmin` y una coincidencia estricta con una **única dirección de propietario** `APP_OWNER_EMAIL`. Ninguna combinación parcial concede acceso.
- La ruta HTML `/app/anatheos-3d` y futuros subpaths declaran `Cache-Control: private, no-store`, `X-Robots-Tag: noindex, nofollow, noarchive`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff` y CSP de Entheos. **Estos son ajustes declarativos; hay que verificar las cabeceras HTTP reales en el hosting.**
- El visor DICOM existente continúa local en la memoria del navegador. No se creó endpoint de carga ni se integró DB/R2.
- No se cambia el flujo general de autenticación de Entheos ni se modifica producción.

## 2. Laboratorio local propuesto (sin datos médicos)

**Prerequisito:** Node >=24 y herramientas del repositorio; rama del PR de G1A, repositorio sin datos privados. No contratar ni activar nuevas cuentas o hosting.

1. Usar un checkout independiente de Entheos, bajo una ruta de usuario local que no sea la instalación productiva.
2. Crear una configuración local **ignorada por Git** (por ejemplo `.env.local`) y usar exclusivamente una identidad ficticia de pruebas. No registrar el correo del propietario verdadero en GitHub, issues o CI. No introducir contraseñas ni tokens de producción.
3. Mantener `ANATHEOS_PILOT_ENABLED=false` por defecto. La activación `true` solo se contempla en laboratorio que ya cumpla confianza de cabeceras e identidad y sin exposición externa. No establecer `true` en el Site ni entorno productivo.
4. Si se requiere ejecutar el servidor local, limitar el bind a loopback, no exponer puertos al exterior y utilizar estado separado de Miniflare/Workers. Ejemplo para shell compatible con bash:
   ```bash
   export SITES_RUNTIME_ROOT="$PWD/.sites-runtime/anatheos-g1"
   bash scripts/sites-env.sh -- npm run dev -- --host 127.0.0.1
   ```
   **Atención:** el script general de Entheos usa Cloudflare/Vinext y el proyecto declara `DB` y `BUCKET` como bindings. El ejemplo configura su estado de desarrollo local; **no prueba** que un runtime remoto tenga bindings segregados ni que sus cabeceras sean confiables. No iniciar con cuentas, credenciales o enlaces de producción.
5. Para la verificación no interactiva ejecutar `npm run lint`, `npm run typecheck` y `npm test` (que ejecuta build y tests), anotando SHA y resultado. La ejecución en CI no realiza login real.
6. **No cargar DICOM real** en este laboratorio. Para probar carga de imágenes usar solo fixtures sintéticos de Issue #9 después de revisar su procedencia.

## 3. Matriz de control G1

| Caso | Código / prueba unitaria | HTTP real / staging | Estado |
|---|---|---|---|
| Flag ausente o distinto de `true` | 404 declarado y predicado unitario negativo | Solicitud GET sin sesión | Pendiente de prueba HTTP |
| Flag `true`, identidad ausente | `requireChatGPTUser` deriva al login, no muestra visor | Solicitud GET anónima y recurso RSC | Pendiente de prueba HTTP |
| Flag `true`, identidad de un tercero | Predicado niega aunque `isGlobalAdmin` sea verdadero si el correo difiere | Solicitud con otra cuenta autenticada | Pendiente de prueba HTTP |
| Flag `true`, configuración `APP_OWNER_EMAIL` vacía | Predicado niega acceso | Solicitud con cuenta del titular | Pendiente de prueba HTTP |
| Flag `true`, identidad correcta y admin | Predicado permite, condicionado a identidad de origen confiable | Solicitud de titular y sesión renovada | Pendiente de prueba HTTP |
| Cabeceras `Cache-Control`, CSP y robots | Configuración + test unitario | Captura HTTP `GET` y navegación/RSC real | Pendiente de prueba HTTP |
| API ANATHEOS | No existe API de ANATHEOS en este bloque | Inventariar futuros endpoints y exigir guard en cada uno | No aplicable aún |
| D1/R2 | Ninguna operación en rutas ANATHEOS actualmente | Demostrar ausencia de bindings productivos en staging y de llamadas accidentales | Pendiente |
| Suplantación de cabeceras de identidad | El código depende de cabeceras proporcionadas por `getChatGPTUser` de Entheos | Verificar que el borde confiable **elimina/reemplaza** cabeceras `oai-authenticated-*` suministradas por el cliente; inyectar valores maliciosos en pruebas aisladas y esperar denegación | **Bloqueo crítico** hasta auditar |
| Rollback | Flag distinto de `true` deja ruta inaccesible a nivel de aplicación | Verificar rollback del entorno, ausencia de tráfico/caché persistente | Pendiente |

**No implementar un nuevo endpoint privado sin el mismo guard del servidor y una prueba HTTP negativa.** No confundir el `isGlobalAdmin` declarado por una cabecera posiblemente falsificable con identidad ya autenticada.

## 4. Evidencia y limitaciones

- Tests nuevos `tests/anatheos-access.test.mjs`: flag desactivado por defecto, usuarios no autorizados, error de configuración, propietario autorizado, cableado de la página y encabezados declarados.
- El test de código **no prueba** la procedencia confiable de `oai-authenticated-user-email`, ejecución real de `headers()` en Vinext, aislamiento de Workers/D1/R2 ni resistencia frente a terceros por Internet.
- GitHub Actions validará lint/typecheck/build/tests en el HEAD del PR; guardar run y SHA antes de afirmar PASS.
- No se creó ni publicó URL de pruebas. No se ejecutaron requests con sesiones reales.
- Este bloque **no cierra G1/#7**; se requiere laboratorio operativo, prueba HTTP y auditoría de confianza upstream.

## 5. Condiciones de salida para el siguiente bloque G1B

1. Verificar dónde se establecen y sanea la identidad del request, con pruebas anónimas/otro usuario/propietario sin registrar credenciales ni correos reales.
2. Aislar un runtime preview con bindings y proyecto Cloudflare separados, sin publicar URLs ni activar gastos sin aprobación del titular.
3. Registrar resultados de las cabeceras reales, cachés y RSC; desactivar el piloto ante discrepancias.
4. Conservar vínculo al Issue #20: `main` e integración continúan sin branch protection; bloqueo de merges por procedimiento no sustituye protección técnica.
