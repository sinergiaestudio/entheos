# TC LCTSC · ejemplo público y contornos expertos del mismo caso

Fuente de distribución: Phillip Chlap, LCTSC DICOM & NIFTI Test Data (2021),
https://doi.org/10.5281/zenodo.4747795, CC BY 3.0 Unported.
Fuente original: Yang, Jinzhong; Sharp, Greg; Veeraraghavan, Harini; van Elmpt,
Wouter; Dekker, Andre; Lustberg, Tim; Gooding, Mark (2017).
Data from Lung CT Segmentation Challenge. The Cancer Imaging Archive.
https://doi.org/10.7937/K9/TCIA.2017.3r3fvz08

Publicación: Yang J. et al. (2018), Autosegmentation for thoracic radiation
 treatment planning: A grand challenge at AAPM 2017. Medical Physics.
https://doi.org/10.1002/mp.13141
TCIA: Clark K. et al. (2013), The Cancer Imaging Archive (TCIA): Maintaining and
Operating a Public Information Repository. Journal of Digital Imaging 26(6),1045–1057.

Licencia: https://creativecommons.org/licenses/by/3.0/
Política de uso: https://www.cancerimagingarchive.net/data-usage-policies-and-restrictions/
ZIP fuente sin cambios, 130 imágenes CT y RTSTRUCT experto. SHA-256:
0e02554ffbf80c8c7e8f0868ec527c8ec10f7c4fd5b532c715cb3d6333676e5f

Cambios realizados por ANATHEOS: conversión del CT a int16 HU y rasterización
local de contornos RTSTRUCT mediante el convertidor existente preparar_lctsc.py,
a NRRD RAW LPS y bitmask de cinco capas con solapamientos conservados.
Estas máscaras derivan de expertos externos; no son predicciones de IA propia.
El visor exige coincidencia de geometría y de todos los vóxeles del CT para
activar la superposición. Fidelidad de rasterización y geometría: cotejo Slicer
independiente pendiente; visualización experimental no diagnóstica.
