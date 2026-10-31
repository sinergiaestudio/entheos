# ANATHEOS W1 · prueba experimental Windows

1. Extraé el paquete completo en una carpeta local. Necesitás Python 3.11 o posterior; el primer inicio instala `numpy` y `Pillow` libres en una carpeta aislada del paquete. Requiere Internet únicamente para esa descarga inicial.
2. Abrí `INICIAR_ANATHEOS_W1.cmd`. Se abrirá ANATHEOS en `127.0.0.1`.
3. Elegí «RM cardíaca · Abrir ZIP DICOM original» y seleccioná el ZIP original intacto. Navegá las 24 series y comprobá SURVEY en sus tres orientaciones.
4. Cerrá el estudio; la copia temporal se elimina. Cerrá la ventana de comandos para detener el servidor.

La prueba física en tu PC está pendiente. Este paquete experimental no incluye el ZIP privado ni una distribución autónoma de Python. La DESS pública incluida en distribuciones previas puede añadirse en `demos/anatheos-local-v0.5/datasets/RTKN0668_MR_DESS.zip`, verificando su SHA-256 publicado antes de utilizarla. Las funciones de atlas SPL usan la preparación pública previa con comprobación de SHA-256.

Sin diagnóstico ni sincronización temporal cardíaca validada.
