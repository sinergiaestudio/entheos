# Entheos para Android

Aplicación Android de Entheos. Abre el espacio personal web y, con autorización explícita, lee los datos de Health Connect para incorporarlos al historial. La parte nativa es necesaria porque una PWA no puede usar por sí sola la API de Health Connect.

## Flujo de vinculación

1. En la app Android, tocar `Conectar con mi cuenta de Entheos`.
2. La web reconoce la cuenta de ChatGPT y vuelve automáticamente a la app mediante un Android App Link verificado.
3. La credencial temporal viaja dentro de ese enlace: el usuario no necesita copiar ni escribir ninguna clave.
4. Entheos guarda el token de la conexión cifrado con Android Keystore y abre el selector oficial de permisos de Health Connect.
5. Al conceder permisos se ejecuta la primera sincronización. Cada registro conserva `dataOrigin`, por lo que un dato escrito por Zepp sigue identificado por su paquete de origen.

El código de ocho caracteres existe únicamente como mecanismo técnico de recuperación, dentro de una sección colapsada de ayuda. Es de un solo uso, vence a los diez minutos y no es la contraseña de la cuenta.

## Compilar y firmar

Este directorio es un proyecto Android Studio completo. Requiere JDK 17 y Android SDK 36.

1. Abrir `android/entheos-bridge` en Android Studio.
2. Esperar la sincronización de Gradle.
3. Conectar el teléfono con depuración USB o crear un emulador compatible.
4. Ejecutar la variante `debug`.
5. Para Google Play, generar un Android App Bundle `release` firmado con la clave de subida y activar Play App Signing.

La compilación de producción toma la firma exclusivamente de variables de entorno:

- `ENTHEOS_UPLOAD_KEYSTORE`: ruta absoluta al almacén de claves;
- `ENTHEOS_UPLOAD_STORE_PASSWORD`: contraseña del almacén;
- `ENTHEOS_UPLOAD_KEY_ALIAS`: alias de la clave;
- `ENTHEOS_UPLOAD_KEY_PASSWORD`: contraseña de la clave.

El repositorio nunca debe contener el almacén ni sus contraseñas. Si faltan esas cuatro variables, la variante `release` se genera sin firmar para poder validarla, pero no debe distribuirse. La variante `debug` usa un identificador distinto (`app.entheos.salud.debug`) para que nunca bloquee una instalación futura desde Google Play.

La app sólo acepta el servidor oficial compilado en `BuildConfig`. El servidor publica `/.well-known/assetlinks.json` para que Android verifique el dominio y abra la conexión directamente en Entheos.

La estrategia completa de custodia y publicación está en [`RELEASE.md`](RELEASE.md). El script `scripts/build-release.sh` rechaza cualquier intento de distribución si no están presentes las cuatro variables de firma.

## Datos y permisos

El puente solicita sólo lectura de:

- pasos;
- frecuencia cardíaca y frecuencia en reposo;
- saturación de oxígeno y frecuencia respiratoria;
- sueño;
- peso;
- distancia y calorías;
- sesiones de ejercicio;
- VO₂ máx.

La lectura del historial completo y la lectura en segundo plano se solicitan como permisos separados. Si el teléfono no admite segundo plano, la actualización manual sigue disponible. No se solicitan permisos de escritura, ubicación ni contactos.

## Sincronización

- Primera lectura: comprueba una categoría por vez, empezando por las de menor volumen. Pasos y frecuencia cardíaca usan intervalos iniciales breves para evitar sobrecargar Health Connect.
- Cursores independientes: cada categoría conserva su propio avance. Un fallo puntual no hace retroceder ni descarta las categorías que ya respondieron.
- Historial: después del primer éxito, si el usuario concede el permiso histórico, recupera un bloque pequeño de una categoría por ejecución y rota entre ellas.
- Lecturas posteriores: desde el último éxito de cada categoría, con una superposición de quince minutos y un máximo de siete días.
- Lectura: usa páginas de 50 registros, una pausa entre categorías y una espera escalonada antes de recrear el cliente si Android reinicia la conexión Binder.
- Lotes de subida: 100 registros como máximo y guardado inmediato por categoría.
- Idempotencia: el servidor deriva el identificador de la persona, proveedor, ID de Health Connect y tipo de métrica.
- Automatización: WorkManager intenta sincronizar cada seis horas cuando existe permiso de lectura en segundo plano y conexión de red.
- Fallos: una categoría problemática queda pendiente sin bloquear el resto. El estado `degraded` distingue una sincronización parcial de una interrupción completa, y nunca borra la constancia de los permisos ya concedidos.

## Extensión a otras fuentes

El contrato del servidor separa `provider`, conexión, capacidades, token y estado. Un conector futuro puede reutilizar el ciclo de vida de Entheos sin acceder a tokens ni datos de otro proveedor.
