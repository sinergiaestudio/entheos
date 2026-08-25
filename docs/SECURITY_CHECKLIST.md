# Checklist de seguridad

Fecha de revisión: 2026-08-23.

## Identidad y acceso

- [x] Sitio configurado owner-only.
- [x] Identidad derivada de encabezados autenticados de la plataforma.
- [x] Sin alta pública, contraseñas propias ni listado de usuarios.
- [x] API devuelve 401 sin identidad o token válido.
- [x] Tokens almacenados únicamente por hash, con scopes, vencimiento y revocación.
- [x] Consultas clínicas filtran por organización y paciente.
- [x] Búsqueda de documentos usa id + organización + paciente.
- [x] Respuestas fuera de ámbito no revelan existencia.
- [ ] OAuth 2.1 para conexión directa con ChatGPT; integración desactivada hasta completarlo.

## Sesión, navegador y caché

- [x] La app no administra cookies de sesión.
- [x] `localStorage` sólo conserva el tema.
- [x] IndexedDB limita su uso a última vista y cola de borradores.
- [x] Service worker no intercepta HTML, navegación, autenticación ni `/api`.
- [x] La raíz y las APIs usan `private, no-store`.
- [x] Sitio y metadata usan `noindex/nofollow`.
- [x] Origen verificado en escrituras del navegador.

## Entradas y archivos

- [x] Texto normalizado, límites de longitud y rangos numéricos.
- [x] SQL parametrizado mediante `prepare().bind()`.
- [x] Fechas validadas antes de persistir.
- [x] Archivo limitado a 25 MB.
- [x] Tipo verificado por firma mágica o formato de datos permitido.
- [x] HTML, SVG y ejecutables no admitidos.
- [x] SHA-256 y rechazo de duplicados por paciente.
- [x] R2 usa claves no controladas por nombre de archivo.
- [x] Vista de documentos con `nosniff`, `no-store` y CSP sandbox.
- [x] Si falla D1 tras subir, se elimina el objeto R2.

## Procedencia, IA y auditoría

- [x] Fuente y verificación visibles en UI y exportaciones.
- [x] IA escribe sólo en bandeja pendiente.
- [x] Aprobar/corregir/rechazar exige acción humana.
- [x] Contenido importado se trata como texto, no como instrucciones.
- [x] Auditoría evita copiar PHI en metadatos.
- [x] Descarga, carga, migración, restauración y tokens generan auditoría.

## Respaldo y disponibilidad

- [x] Vista previa antes de restaurar.
- [x] Huella idempotente por archivo de respaldo.
- [x] Un intento fallido se bloquea para evitar duplicados silenciosos.
- [x] Migraciones actuales son aditivas.
- [x] Documentos originales se respaldan por separado y esto se informa.
- [ ] Definir retención operativa y procedimiento de borrado definitivo antes de habilitar más usuarios.

## Operación pendiente antes de multiusuario

- [ ] Pruebas automáticas de aislamiento con dos identidades en un entorno D1.
- [ ] Rate limiting específico para endpoints de tokens y MCP, además del límite de plataforma.
- [ ] Alertas sobre errores repetidos de autorización y restauraciones fallidas.
- [ ] Política raíz `SECURITY.md` aprobada por el propietario.
- [ ] Revisión periódica de dependencias y respuesta a vulnerabilidades.
