# ANATHEOS 3D v0.5 · Windows portátil B3 — sin instalación de terceros

**Investigación local. NO diagnóstico. No compartas estudios de terceros.**

## Primera ejecución
1. Extraer todo el ZIP en una carpeta escribible (por ejemplo, Documentos/ANATHEOS_3D_v05).
2. Doble clic en **DIAGNOSTICO_ANATHEOS.cmd**: comprobar presencia de módulos, PowerShell y el puerto local.
3. Doble clic en **INICIAR_ANATHEOS.cmd**. Se abrirá el navegador predeterminado en http://127.0.0.1:8765/ o el siguiente puerto libre hasta 8775. No se usa conexión externa.
4. Presionar **Superficies 3D**. Para usar el atlas público: ejecutar una sola vez **OBTENER_ATLAS_SPL.cmd** (descarga por red de los modelos oficiales y su máscara a ATLAS_SPL, ~30 MB), seleccionar origen «SPL Knee Atlas», pulsar «Importar superficies» y elegir femur-95.stl y tibia-96.stl. Los SHA se verifican antes de reconocerlos como atlas.
5. Después de descargar el atlas, el visor puede funcionar sin Internet.

## Administrar el servidor
- **DETENER_ANATHEOS.cmd**: cierra únicamente el servidor ANATHEOS perteneciente a esta carpeta; también se puede pulsar Ctrl+C en su ventana.
- **REINICIAR_ANATHEOS.cmd**: detiene e inicia nuevamente.
- **DIAGNOSTICO_ANATHEOS.cmd**: prueba integridad y enumera archivos faltantes; no envía información.
- Cerrar el servidor no borra estudios locales ni cambia una instalación anterior.

## Conservación y seguridad
- El ZIP de aplicación NO contiene DICOM, NRRD, atlas, STL ni datos de pacientes.
- El navegador lee los archivos que el usuario selecciona y el servidor únicamente distribuye el código/estilos de la carpeta (y, si existe, el dataset privado Leeds anterior mediante su ruta local prevista).
- El servidor se vincula exclusivamente a 127.0.0.1, no a 0.0.0.0.
- La aplicación no está desplegada en Entheos, no se publicó como Site, no se integró con la historia clínica y no utiliza APIs pagas.
- Si Windows muestra advertencia, consultá el contenido de los scripts antes de ejecutar; no necesitan privilegios de administrador.
- El procesamiento WebGL2 depende del controlador gráfico y de la RAM. Esta demo aún no fue ejecutada manualmente en tu computadora.
- Conservá siempre la v0.4 como respaldo estable. No superpongas mallas SPL sobre RM Leeds.

## Validación independiente (opcional)
- 3D Slicer es gratuito y de código abierto: https://download.slicer.org/
- Slicer debe descargarse e instalarse por separado; no se incluye en esta distribución.
- Para comparar mallas con etiquetas del atlas, ver PROTOCOLO_VALIDACION_SLICER_B3.md.
- Hasta completar esta verificación cruzada de estudios y el examen de lateridad, no usar resultados para decisiones médicas.

## Licencias
- Datos SPL Knee Atlas: https://www.openanatomy.org/atlas-pages/slicer-license.html (Parte B), conservar aviso y atribución.
- Datos originales Leeds CC BY 4.0 sólo si el usuario aporta su copia privada; ver ATTRIBUTION_CC_BY_4.0.txt.
