# Integraciones de salud

## Canal principal

Entheos utiliza el circuito `Zepp → Intervals.icu → Entheos`.

1. La persona crea su cuenta en Intervals.icu y autoriza allí la conexión con Zepp.
2. Desde Entheos inicia OAuth 2.0 con Intervals.icu.
3. Intervals.icu muestra su consentimiento oficial para `ACTIVITY:READ` y `WELLNESS:READ`.
4. El código, válido por pocos minutos, vuelve al servidor de Entheos y se intercambia por un token.
5. El token se cifra con AES-GCM antes de guardarse en `integration_connections.config_json`.
6. La primera actualización consulta seis semanas; después pueden elegirse períodos de hasta 366 días.

Entheos nunca solicita la contraseña ni la clave personal de API de Intervals.icu.

## Datos admitidos

- actividades con fecha, tipo, duración, distancia y frecuencia cardíaca cuando estén disponibles;
- pasos;
- sueño y calidad informada;
- frecuencia cardíaca en reposo;
- HRV, peso, SpO₂ y presión únicamente cuando Intervals.icu los entregue en bienestar.

Cada registro usa `source_type=intervals_icu`, conserva la referencia externa y registra la fuente ascendente informada por el proveedor. Los identificadores determinísticos permiten repetir una actualización sin duplicar datos.

## Estados

- `pending_pairing`: se inició OAuth y todavía no volvió el consentimiento;
- `active`: bienestar y actividades respondieron;
- `degraded`: una categoría respondió y otra no;
- `interrupted`: ambas consultas fallaron o la autorización dejó de ser válida;
- `revoked`: el usuario desconectó la fuente.

## Health Connect

El conector Android se conserva completo en el repositorio, incluidos APK, código, rutas y pruebas. Está fuera de la interfaz pública porque el proveedor Health Connect del teléfono probado terminaba su proceso incluso ante consultas mínimas con permisos concedidos. No se borró ningún dato recibido previamente.

## Configuración de servidor

La publicación requiere una clave maestra administrada por el entorno:

- `ENTHEOS_INTEGRATION_KEY`.

El administrador global puede cargar el `client_id` y el `client_secret` de
Intervals.icu desde **Admin → Integraciones**. El secreto se cifra con AES-GCM
antes de persistirse en D1, nunca se devuelve a la interfaz y no forma parte de
respaldos ni auditorías. Para despliegues administrados también se conservan
como alternativa `INTERVALS_CLIENT_ID` e `INTERVALS_CLIENT_SECRET` en el entorno.

El alta de la aplicación en Intervals.icu utiliza:

- sitio: URL pública de Entheos;
- política: `/privacy`;
- retorno OAuth: `/api/health/connectors/intervals/callback`;
- logo: `/app/icon-192.png`.
