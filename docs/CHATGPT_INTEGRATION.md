# Integración con ChatGPT

## Estado

Entheos expone un MCP HTTP remoto en `/mcp` y una API resumida en `/api/v1/patient-summary`. La conexión privada utiliza OAuth 2.1 con PKCE y admite tokens técnicos personales revocables.

Desde la versión 0.3, el MCP permite lectura y una acción de escritura no destructiva llamada `send_to_entheos`. La escritura está destinada a información clínica y archivos que el usuario haya pedido guardar explícitamente desde una conversación.

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

## Seguridad

- Los archivos y datos se aíslan por organización y paciente.
- No hay borrados destructivos desde el MCP.
- El servidor conserva auditoría e idempotencia.
- El contenido de documentos se trata como datos, no como instrucciones.
- Las hipótesis del modelo no deben guardarse como hechos clínicos.
- La carga exige una instrucción explícita del usuario.

## Conexión en ChatGPT Work

1. Desplegar esta versión de Entheos.
2. En ChatGPT Work, habilitar Developer Mode.
3. Crear o actualizar la app MCP con la URL `https://seguimiento-nutricional-marcelo.arielmarcelogomez7.chatgpt.site/mcp`.
4. Escanear nuevamente las herramientas.
5. Aprobar la nueva acción `send_to_entheos` y los scopes de escritura.
6. Reconectar la cuenta Entheos para emitir tokens con los nuevos scopes.
7. Probar primero con un dato no sensible y luego con un documento de prueba.

Los cambios del servidor MCP no aparecen automáticamente en una app ya escaneada: es necesario refrescar sus acciones en ChatGPT Work.
