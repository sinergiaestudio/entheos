# Despliegue autenticado

## Entorno actual

La aplicación se despliega con Sites sobre Cloudflare Workers. `.openai/hosting.json` declara los nombres genéricos de las vinculaciones:

- `DB`: base D1 estructurada;
- `BUCKET`: almacenamiento R2 de documentos;

El identificador del proyecto de producción se administra fuera de este repositorio público.

La portada puede ser pública, pero el acceso a información y APIs debe exigir identidad de ChatGPT. La visibilidad del sitio nunca sustituye la autorización por usuario y paciente.

## Procedimiento

1. Instalar dependencias con `npm run install:ci`.
2. Ejecutar `npm run lint` y `npm run typecheck`.
3. Generar migraciones sólo cuando cambie `db/schema.ts`.
4. Ejecutar `npm test`; el build valida el Worker ESM y el manifiesto de hosting.
5. Crear un checkpoint mediante la herramienta de Sites.
6. Verificar que D1 aplique todas las migraciones de `drizzle/` en orden.
7. Confirmar acceso privado, carga D1 y escritura R2 con un documento ficticio.

## Encabezados y caché

La raíz envía `private, no-store`, `noindex`, `nosniff`, política de referentes y restricciones de embedding. Las APIs agregan `no-store` y los documentos usan CSP sandbox.

El service worker raíz no intercepta navegaciones, HTML, autenticación ni rutas `/api`.

## Reversión

- Revertir el checkpoint de aplicación desde Sites.
- No revertir migraciones D1 destructivamente.
- Si una migración nueva causa incompatibilidad, publicar una corrección hacia adelante.
- Los objetos R2 cargados antes de una falla D1 se eliminan en la misma operación de aplicación.

## Variables y secretos

No se requieren secretos escritos en archivos. Identidad, D1 y R2 se inyectan como capacidades del entorno. Los tokens personales se crean en la UI, se muestran una vez y sólo su hash llega a D1.

## Verificación en producción

- Solicitud sin autenticar → acceso de ChatGPT.
- Usuario autorizado → HTTP 200 y aplicación clínica.
- Segundo usuario autenticado → espacio propio, sin acceso al ámbito de otra persona.
- API sin identidad/token → HTTP 401.
- Documento inexistente o de otro ámbito → HTTP 404.
- `manifest.webmanifest` e iconos → accesibles tras autenticar.
- `/app/index.html` legado → no se distribuye.
