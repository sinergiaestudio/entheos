# Instalador Windows · actualización local 0.10.0-beta

Instalación por usuario en LOCALAPPDATA/Programs/ANATHEOS; Python, NumPy y Pillow/OpenJPEG incluidos por PyInstaller onedir. No se utiliza pip, Python externo ni Internet durante instalación o primer inicio. La construcción descarga únicamente dependencias libres y el atlas SPL público con hashes verificados. No incluye estudios privados.

Los datos viven en LOCALAPPDATA/ANATHEOS; el desinstalador los conserva. Cerrar ANATHEOS antes de instalar, actualizar o desinstalar. Las versiones se conservan en subcarpetas; el acceso «Recuperar version anterior» permite ejecutar el binario previo. La selección de nueva versión sólo se realiza después del self-test JPEG2000 y comprobación SHA-256 de cada archivo. No hay actualización remota.

Antes de ejecutar un instalador local, comparar su SHA-256 con SHA256SUMS.txt obtenido por el mismo canal privado. El hash verifica integridad, no identidad del editor. Beta sin Authenticode: Windows puede mostrar SmartScreen; no se recomienda eludir controles de seguridad. 0.9.0 fue aceptada físicamente por el titular. La aceptación física de 0.10.0 debe registrarse por separado.

Licencias verificadas: Python PSF; NumPy BSD con avisos de bibliotecas incluidas; Pillow HPND y OpenJPEG BSD; PyInstaller GPL con excepción de distribución del bootloader (https://pyinstaller.org/en/stable/license.html); NSIS zlib y avisos de módulos (https://nsis.sourceforge.io/Docs/AppendixI.html). El build conserva los textos de licencia de las distribuciones instaladas y Python en THIRD_PARTY. Atlas SPL conserva atribución y licencia 3D Slicer Parte B existentes.

Limitaciones abiertas: prueba visual de todas las herramientas en Windows físico; pruebas de corte eléctrico y rollback tras escritura fallida; validación Slicer. El ZIP clínico se selecciona desde el visor existente. Las funciones TC, rodilla, cerebro, máscaras y 3D reutilizan el mismo código de la rama W1.

## Uso mínimo de 0.10.0

1. Cerrar ANATHEOS y ejecutar `ANATHEOS-Setup-0.10.0-beta.exe` en el mismo usuario de Windows. No desinstalar 0.9.0 primero.
2. Abrir ANATHEOS desde el escritorio. En el menú de estudio, seleccionar el ZIP DICOM original; el selector de carpeta preparada se conserva para recuperación.
3. En RM JPEG2000, desplegar «Comparar series y orientaciones» para seleccionar independientemente hasta cuatro vistas. En «Reconstrucción» se explica la elegibilidad; sólo los grupos aprobados ofrecen volumen/MPR/máscaras.
4. En pilas originales compatibles (por ejemplo Leeds/TC), «Volumen 3D» utiliza el motor anterior y aparece «MPR de la pila elegible». Los tres ejes son los de adquisición, no etiquetas anatómicas universales. No se interpola resolución adicional.
5. Para volver a 0.9.0, cerrar ANATHEOS y abrir «Recuperar version anterior» en Inicio/ANATHEOS. Los datos de usuario permanecen fuera de la instalación. No hay conversión destructiva de proyectos ni actualización automática.

La RM cardíaca no recibe un volumen automático por reunir 1.318 imágenes: orientaciones, fases y huecos impiden tratar ese conjunto como una pila continua. SURVEY se explora por planos y referencias geométricas dentro de la misma serie; entre series distintas se exige registro validado. Las anotaciones del comparador son temporales. Las máscaras y superficies derivadas conservan el flujo y procedencia anteriores. Candidatura geométrica no significa ausencia de movimiento ni validación clínica.

Pruebas reproducibles: `test_spatial_reference.mjs`, `test_eligible_volume.mjs`, `r3/test_g4.py`, `r3/test_mapping.py`, `r3/test_public_eligibility.py` y `r3/test_public_reconstruction.py`. La CI Windows instala el EXE 0.9.0 publicado (SHA verificado), actualiza/reinstala 0.10.0, importa JPEG2000 desde el ejecutable empaquetado, cancela, abre volumen/MPR, comprueba datos preservados/versión anterior y desinstala/reinstala. No reemplaza prueba física ni Slicer.
