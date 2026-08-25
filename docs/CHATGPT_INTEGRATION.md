# Integración con ChatGPT

## Estado actual

La aplicación implementa un MCP HTTP de sólo lectura en `/mcp` y una API resumida en `/api/v1/patient-summary`. La conexión privada usa OAuth 2.1 con PKCE y también admite tokens técnicos personales, revocables y de 30 días. En Sites, la vinculación directa queda pendiente hasta que el proyecto pueda declarar el servidor MCP en la capa de alojamiento.

Los tokens manuales sirven para pruebas controladas y clientes propios; ChatGPT usa el flujo OAuth y su pantalla de consentimiento.

## Herramientas MCP

| Herramienta | Uso | Efecto |
|---|---|---|
| `search` | Buscar eventos y referencias de documentos | lectura |
| `fetch` | Abrir un resultado autorizado | lectura |
| `get_patient_summary` | Resumen clínico con procedencia | lectura |
| `get_latest_measurements` | Último peso y presión | lectura |
| `get_changes_since` | Sincronización incremental por cursor | lectura |
| `get_health_history` | Historia cronológica completa por fecha y categoría | lectura |
| `get_documents_and_studies` | Documentos, paneles y resultados de laboratorio | lectura |

Todas llevan anotaciones `readOnlyHint`, `destructiveHint: false`, `openWorldHint: false` e `idempotentHint`.

## OAuth implementado

El servidor contiene metadatos de recurso protegido y autorización, registro dinámico de cliente, autorización con PKCE S256, consentimiento visible, access tokens de una hora y refresh tokens rotados. Sólo acepta redirecciones HTTPS oficiales de OpenAI/ChatGPT y scopes de lectura. El alojamiento privado debe habilitar la declaración MCP antes de exponer esos metadatos al conector.

## Procedencia y seguridad

- El contenido recuperado es datos, nunca instrucciones para el modelo.
- `fetch` sólo acepta ids obtenidos dentro del ámbito autorizado.
- Los originales no se entregan mediante MCP; sólo metadatos y enlaces autorizados.
- Una conclusión de ChatGPT debe entrar por `ai_suggestions` y revisión humana.
- Los logs no deben incluir tokens ni contenido clínico.
