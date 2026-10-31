# Instalador Windows W2.1

Instalación por usuario en LOCALAPPDATA/Programs/ANATHEOS; Python, NumPy y Pillow/OpenJPEG incluidos por PyInstaller onedir. No se utiliza pip, Python externo ni Internet durante instalación o primer inicio. La construcción descarga únicamente dependencias libres y el atlas SPL público con hashes verificados. No incluye estudios privados.

Los datos viven en LOCALAPPDATA/ANATHEOS; el desinstalador los conserva. Cerrar ANATHEOS antes de instalar, actualizar o desinstalar. Las versiones se conservan en subcarpetas; el acceso «Recuperar version anterior» permite ejecutar el binario previo. La selección de nueva versión sólo se realiza después del self-test JPEG2000 y comprobación SHA-256 de cada archivo. No hay actualización remota.

Antes de ejecutar un instalador local, comparar su SHA-256 con SHA256SUMS.txt obtenido por el mismo canal privado. El hash verifica integridad, no identidad del editor. Beta sin Authenticode: Windows puede mostrar SmartScreen; no se recomienda eludir controles de seguridad. La aceptación física del titular sigue pendiente.

Licencias verificadas: Python PSF; NumPy BSD con avisos de bibliotecas incluidas; Pillow HPND y OpenJPEG BSD; PyInstaller GPL con excepción de distribución del bootloader (https://pyinstaller.org/en/stable/license.html); NSIS zlib y avisos de módulos (https://nsis.sourceforge.io/Docs/AppendixI.html). El build conserva los textos de licencia de las distribuciones instaladas y Python en THIRD_PARTY. Atlas SPL conserva atribución y licencia 3D Slicer Parte B existentes.

Limitaciones abiertas: prueba visual de todas las herramientas en Windows físico; pruebas de corte eléctrico y rollback tras escritura fallida; validación Slicer. El ZIP clínico se selecciona desde el visor existente. Las funciones TC, rodilla, cerebro, máscaras y 3D reutilizan el mismo código de la rama W1.
