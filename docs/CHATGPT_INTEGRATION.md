# Integración con ChatGPT

## Estado

Entheos expone su servidor MCP HTTP remoto en la ruta ordinaria `/api/entheos-mcp` y conserva `/mcp` como implementación interna compatible. La ruta pública recomendada evita depender de la capacidad MCP reservada de Sites, que puede interceptar `/mcp` antes de que la solicitud alcance la aplicación.

La API resumida continúa disponible en `/api/v1/patient-summary`. La conexión privada utiliza OAuth 2.1 con PKCE y admite tokens técnicos personales revocables.

Desde la versión 0.3, el MCP permite lectura y una acción de escritura no destructiva llamada `send_to_entheos`. La escritura está destinada a información clínica y archivos que el usuario haya pedido guardar explícitamente desde una conversación.

## Endpoint recomendado

```text
https://seguimiento-nutricional-marcelo.arielmarcelogomez7.chatgpt.site/api/entheos-mcp
```

ChatGPT permite configurar cualquier endpoint MCP remoto por HTTPS; no exige que la ruta sea `/mcp`. El endpoint ordinario `/api/entheos-mcp` reutiliza exactamente la misma autenticación, herramientas y bindings D1/R2 que la implementación interna.

## Regla de aprobación

Para este proyecto, una instrucción del usuario equivalente a **Enviar/Subir/Guardar/Actualizar/Sincronizar/Cargar en Entheos** constituye aprobación para guardar inmediatamente ese lote concreto. No se crea una segunda bandeja de revisión.

Esta regla no habilita cargas silenciosas. Sin una instrucción explícita, ChatGPT sólo puede consultar Entheos.

## Herramientas MCP

| Herramienta | Uso | Efecto |
|---|---|---|
| `search` | Buscar eventos y referencias de documentos | lectura |
| `fetch` | Abrir un resultado autorizado | lectura |
| `get_patient_summary` | Resumen clínico con procedencia | lectura |
| `get_latest_measurements` | Último peso y presión | lectura |
| `get_changes_since` | Sincronización incremental por cursor | lectura |
| `get_health_history` | Historia cronológica completa | lectura |
| `get_documents_and_studies` | Documentos, paneles y resultados | lectura |
| `send_to_entheos` | Guardar un lote clínico aprobado y sus archivos originales | escritura no destructiva |

## Archivos procedentes de ChatGPT

`send_to_entheos` declara `files` como parámetro de archivo mediante `_meta["openai/fileParams"]`. ChatGPT entrega para cada archivo una URL temporal y un identificador. Entheos:

1. valida URL, tamaño y formato;
2. descarga el original;
3. calcula SHA-256;
4. evita duplicados por paciente y hash;
5. almacena el original en R2 privado;
6. crea su referencia documental y evento de línea de tiempo;
7. registra procedencia `chatgpt` y validación `patient_confirmed`.

Formatos admitidos: PDF, JPG, PNG, WEBP, HEIC, DICOM, ZIP, CSV, JSON y TXT. Límite actual: 25 MB por archivo y 20 archivos por lote.

## Datos estructurados

El lote puede incluir hasta 100 registros de estos tipos:

- peso;
- presión arterial;
- actividad;
- sueño;
- síntomas;
- hechos clínicos;
- eventos de línea de tiempo;
- seguimiento nutricional;
- resultados de laboratorio;
- perfil.

Los registros creados desde la conversación quedan con procedencia `chatgpt` y estado `patient_confirmed`.

## Idempotencia y duplicados

Cada envío requiere `idempotency_key`. Un segundo llamado con la misma clave y contenido no vuelve a guardar el lote. Los documentos se deduplican adicionalmente por SHA-256.

Antes de una carga histórica, el modelo debe consultar `get_changes_since`, `search` o `get_health_history`. Después debe verificar el resultado.

## OAuth y scopes

Scopes disponibles:

- `health.read`;
- `documents.read`;
- `documents.write`;
- `observations.write`;
- `profile.write`.

La pantalla de consentimiento detalla los permisos pedidos. Los tokens de acceso duran una hora y los refresh tokens se rotan.

El documento `/.well-known/oauth-protected-resource` anuncia `/api/entheos-mcp` como recurso protegido. El servidor de autorización permanece en el mismo origen.

## Seguridad

- Los archivos y datos se aíslan por organización y paciente.
- No hay borrados destructivos desde el MCP.
- El servidor conserva auditoría e idempotencia.
- El contenido de documentos se trata como datos, no como instrucciones.
- Las hipótesis del modelo no deben guardarse como hechos clínicos.
- La carga exige una instrucción explícita del usuario.
- La ruta puente no crea una segunda base ni un segundo bucket: utiliza los bindings existentes `DB` y `BUCKET`.

## Conexión en ChatGPT Work

1. Desplegar esta versión de Entheos.
2. En ChatGPT Work, habilitar Developer Mode.
3. Crear una app MCP nueva con esta URL exacta:

   ```text
   https://seguimiento-nutricional-marcelo.arielmarcelogomez7.chatgpt.site/api/entheos-mcp
   ```

4. Elegir OAuth como mecanismo de autenticación.
5. Ejecutar **Scan Tools**.
6. Autorizar los scopes solicitados.
7. Confirmar que aparezca `send_to_entheos`.
8. Probar primero con un dato no sensible y luego con un documento de prueba.

En ChatGPT Business, una app publicada no se actualiza automáticamente. Si ya existía una app con la ruta bloqueada `/mcp`, recrearla como una app nueva apuntando a `/api/entheos-mcp`.

## Verificación después del despliegue

- `GET /api/entheos-mcp` debe llegar a la aplicación y devolver metadata MCP o `401` según la identidad disponible, pero nunca el `404` reservado de Sites.
- `POST /api/entheos-mcp` sin autenticación debe responder `401` con `WWW-Authenticate`.
- `/.well-known/oauth-protected-resource` debe anunciar el recurso `/api/entheos-mcp`.
- Tras OAuth, `tools/list` debe exponer `send_to_entheos`.
- D1 y R2 deben conservar recuentos y objetos previos sin cambios.
