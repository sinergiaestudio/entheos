# Modelo de amenazas

## Alcance

Entheos es una aplicación privada, de un único titular, desplegada como Worker mediante Sites. La identidad autenticada de la plataforma habilita la interfaz y las API del navegador; D1 conserva los datos clínicos estructurados y R2 conserva los originales de documentos. Una API técnica y un endpoint MCP exponen únicamente lectura mediante tokens revocables y con vencimiento.

La migración desde el seguimiento nutricional familiar retirado es aditiva, requiere la sesión y la contraseña del perfil anterior y no elimina los datos de origen. Las rutas públicas de alta, acceso y sincronización del sistema anterior ya no existen.

## Activos protegidos

- Perfil, mediciones, síntomas, antecedentes, medicación, hábitos, nutrición, laboratorios y cronología.
- Archivos clínicos originales, metadatos, hashes y versiones.
- Identidad, organización, titular, permisos, tokens y consentimientos.
- Fuente, fecha clínica, estado de verificación, decisiones de revisión y auditoría.
- Respaldos, eventos de sincronización, borradores sin conexión y claves de idempotencia.

## Límites de confianza

- Navegador e Internet → control de acceso privado de Sites e identidad de plataforma.
- Encabezados de identidad inyectados por la plataforma → contexto interno de usuario, organización y titular.
- Solicitudes del navegador → API de mismo origen; todos los cuerpos, consultas, rutas, archivos y encabezados se consideran no confiables.
- Token portador → permisos de lectura y contexto del titular asociado.
- Aplicación → consultas parametrizadas de D1 y claves de R2 generadas por el servidor.
- Archivos o respaldos importados → almacenamiento, reportes, cronología y revisión humana.
- Estado del servidor → IndexedDB de un dispositivo potencialmente compartido o comprometido.
- Exportaciones → almacenamiento externo, profesionales o conversaciones fuera de la aplicación.

## Capacidades del atacante

- Una persona no autenticada puede descubrir el host e intentar solicitudes arbitrarias.
- Una persona autenticada pero no autorizada puede intentar acceder al sitio o adivinar identificadores.
- Quien obtenga un token técnico puede automatizar lecturas hasta su vencimiento o revocación.
- El titular puede subir por error un archivo malicioso, corrupto o engañoso.
- Un sitio externo puede intentar CSRF, framing o confusión de origen contra un navegador autenticado.
- Alguien con acceso al dispositivo puede inspeccionar la caché local y los borradores pendientes.
- Una dependencia, capacidad de hosting o límite de confianza de la plataforma comprometidos pueden afectar todos los registros.

## Invariantes de seguridad

1. No se devuelve información clínica ni un documento sin autenticación y autorización sobre la organización y el titular.
2. Un identificador aportado por el cliente nunca determina la propiedad: cada consulta incluye el titular y la organización autorizados.
3. Las mutaciones del navegador fallan ante un origen distinto y validan límites, tipos y fechas.
4. Los tokens son aleatorios, se almacenan como hash, vencen, pueden revocarse, tienen permisos mínimos y se muestran una sola vez.
5. Las consultas SQL usan parámetros y el texto importado se trata como datos, nunca como código, HTML, consultas o rutas.
6. Las claves de R2 se generan en el servidor; se rechazan formatos activos, se verifica el contenido, se detectan duplicados y se elimina un objeto huérfano si falla D1.
7. Una propuesta de IA permanece pendiente hasta una decisión humana explícita y conserva su procedencia.
8. La fuente, fecha clínica, unidad, rango y estado de verificación no se infieren ni sobrescriben silenciosamente.
9. La auditoría registra acción y resultado sin duplicar contenido clínico sensible.
10. El service worker y el almacenamiento local no autentican, no almacenan HTML ni respuestas de API y separan los datos por identidad.
11. Las operaciones sin conexión, restauración y migración son idempotentes o fallan de forma visible.
12. La migración conserva la fecha original del plan y no mezcla perfiles ni elimina el origen.
13. Repositorio, logs, ejemplos y artefactos de compilación no contienen datos reales, documentos, credenciales ni tokens.

## Riesgos residuales y controles externos

- Sites debe bloquear toda solicitud que no pertenezca al titular y debe retirar encabezados de identidad enviados por el cliente antes de inyectar los propios.
- D1, R2, HTTPS, límites de tamaño y protección volumétrica dependen de la plataforma de alojamiento.
- Un dispositivo comprometido puede revelar la última vista y los borradores de IndexedDB; la separación por identidad reduce, pero no elimina, este riesgo local.
- La API técnica actual usa tokens manuales de lectura. OAuth 2.1 para una conexión directa de ChatGPT es una evolución futura, no una capacidad declarada de esta versión.
- Incorporar familiares o profesionales requiere un modelo explícito de consentimiento, roles y pruebas de aislamiento antes de ampliar el acceso.
