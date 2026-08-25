# Publicación segura de Entheos Android

## Identidad permanente

- Nombre visible: `Entheos`.
- Identificador definitivo: `app.entheos.salud`.
- Modelo base conservado: `1.0.0` (`versionCode 1`).
- Versión actual: `1.0.3` (`versionCode 4`).

El identificador fue confirmado antes del primer alta de Google Play y debe mantenerse en todas las versiones futuras.

La actualización 1.0.3 mantiene el mismo identificador y la misma firma de subida. El APK de prueba conserva además la identidad de depuración usada desde 1.0.1, por lo que puede actualizar la instalación actual sin borrar la cuenta vinculada ni los permisos.

## Enlaces verificados

La ruta `https://seguimiento-nutricional-marcelo.arielmarcelogomez7.chatgpt.site/connect/health-connect` está declarada como Android App Link. El dominio publica los certificados autorizados en `/.well-known/assetlinks.json`. Cuando Google Play App Signing quede activo, agregar allí la huella de la clave de firma de aplicación que informa Play Console; la huella de la clave de subida no la reemplaza.

## Estrategia de firma recomendada

Usar Google Play App Signing con dos claves separadas:

1. Google genera y custodia la clave de firma de la aplicación.
2. El propietario conserva una clave de subida independiente.
3. Cada AAB se firma localmente con la clave de subida.
4. Google verifica esa firma y distribuye los APK con la clave permanente de la aplicación.

La clave de subida puede restablecerse desde Play Console si se pierde o se compromete. La clave privada y sus contraseñas nunca deben guardarse en Git, dentro de un ZIP de código, en un mensaje ni en una variable pública.

## Crear la clave de subida

Hacerlo en la computadora del propietario, con JDK 17 instalado. Este comando pide las contraseñas de forma interactiva para que no queden en el historial del shell:

```bash
keytool -genkeypair \
  -keystore entheos-upload.p12 \
  -storetype PKCS12 \
  -alias entheos-upload \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000
```

Guardar el archivo en dos copias cifradas y registrar las contraseñas en un gestor de contraseñas. No reutilizar la contraseña de ChatGPT ni de Google.

## Compilar

Definir, sólo durante la compilación, las cuatro variables descriptas en `README.md` y ejecutar:

```bash
./scripts/build-release.sh
```

El proceso exige firma, ejecuta lint, crea APK y AAB, verifica sus certificados y genera archivos SHA-256. Si falta una variable, termina sin producir una distribución firmada.

## Alta en Google Play

1. Crear la app con el identificador confirmado.
2. Elegir Google Play App Signing y permitir que Google genere la clave de la aplicación.
3. Cargar el AAB firmado con la clave de subida.
4. Completar política de privacidad, seguridad de datos y declaración de Health Connect.
5. Publicar primero en prueba interna o cerrada.
6. Instalar desde Google Play y validar vinculación, permisos, sincronización manual, segundo plano y revocación.

La variante `debug` usa `app.entheos.salud.debug`. Por eso se puede instalar para pruebas sin ocupar ni contaminar la identidad de producción.
