# ANATHEOS 3D — Arquitectura y contratos técnicos (objetivo)

**Estado:** arquitectura propuesta, susceptible de ADR y pruebas. No declarar estos componentes como integrados si aún no hay PR aprobado.
**Relación:** se acopla a Entheos mediante una frontera de módulo; no altera su despliegue principal en la fase privada.

## 1. Arquitectura lógica

- **Interfaz/identidad:** actual Entheos React/Next/Vinext y autenticación ChatGPT/Sites para acceso propietario, detrás de verificación server-side configurada, no de un mero enlace oculto.
- **Núcleo de imágenes:** visor DICOM navegador con Cornerstone3D / OHIF evaluados; lectura robusta de series y geometría, MPR y 3D. Seleccionar integración real tras evaluar coste de bundle, carga local vs DICOMweb, CSP, WebGL y compatibilidad con Cloudflare Workers.
- **Procesamiento opcional:** motor local Python con SimpleITK/pydicom y más adelante MONAI; acceso restringido a loopback o túnel local explícitamente autorizado, jamás puerto público abierto.
- **Persistencia inicial:** sólo memoria del navegador, opcional caché local efímera con control explícito. No escribir DICOM real en D1, R2 o GitHub sin diseño seguro y aprobación.
- **Persistencia futura:** Entheos D1 conserva metadatos y autorizaciones; R2 originales cifrados y versionados, con segregación. No mezclar con almacenamiento clínico real de producción durante pruebas.
- **Servicios futuros optativos:** Orthanc + DICOMweb y FHIR si la interoperabilidad institucional lo exige; no son dependencias obligatorias del primer prototipo.
- **Infraestructura:** Cloudflare Worker opera como interfaz/orquestador; procesamiento volumétrico intensivo en navegador o equipo local. No se presuponen GPU ni servicios de pago.

## 2. Contexto de ejecución actual (verificado en repositorio)

El paquete de Entheos usa Next 16, React 19, Vite/Vinext, Workers con bases D1 y storage R2. La app tiene autenticación vía requireChatGPTUser, con isGlobalAdmin determinada por APP_OWNER_EMAIL. El laboratorio en /app/anatheos-3d consulta esta condición. **Esto aún no significa que la autorización esté probada bajo una URL privada.**

La implementación P1A existente sólo admite DICOM Part10 Little Endian no comprimidos, de un frame monocromático; ordena cortes y muestra cortes axiales/ortogonales muy limitados. No renderiza volumen 3D. Debe refactorizarse en torno a un decodificador maduro y tests geométricos, evitando acumular deuda técnica o intentar soportar todos los casos con parser propio.

## 3. Pipeline contractual

1. **Entrada:** File[] local, ZIP futuro evaluado; origen explícito, no red por defecto.
2. **Parser:** validar preámbulo/sintaxis o utilizar decodificador DICOM compatible, sin asumir nombres de archivo; filtrar metadatos sensibles en logs.
3. **Catálogo:** StudyInstanceUID -> SeriesInstanceUID -> SOPInstanceUID/frames; DICOM no garantiza que una carpeta equivale a una única serie.
4. **Clasificador de geometría:** imagen plana, volumen regular, volumen oblicuo, multiframe, irregular, incompleto, no compatible. Etiquetas explícitas sin autocorrección silenciosa.
5. **Transformación física:** matriz índice de voxel -> coordenadas DICOM LPS mm, con IOP, IPP, PixelSpacing y separación inferida de posiciones; la dirección normal determina orden, nunca el orden de los nombres. Si se usa RAS, registrar conversión e invertir signos correctos.
6. **MPR:** sampling/remuestreo espacial real en coordenadas del paciente para volúmenes que lo exijan; no crear planos físicos con intercambio de índices en adquisiciones oblicuas.
7. **Volumen:** texturas/rendering con spacing y orientación correcta; control de calidad y indicador de resolución original vs interpolada.
8. **Segmentación futura:** labelmap y referencias a estudio/serie/volumen, checksum, algoritmos y versiones; revisión explícita.
9. **Exportación futura:** mallas GLB/STL con unidades/orientación declaradas; DICOM SEG como interoperabilidad preferida para segmentación anatómica.
10. **Descartar:** revocación de URLs temporales, liberación de memoria y worker, borrado de datos efímeros y confirmación UI.

## 4. Interfaces propuestas (sin implementar aún)

### Módulos internos

- imaging/importer — DICOM loader, buffers, límites y cancelación.
- imaging/catalog — agrupación por estudio y serie, compatibilidad y metadatos mínimos.
- imaging/geometry — series, spacing, matrices y conversiones LPS/RAS.
- imaging/viewport — stack, MPR y volume 3D; adaptadores de OHIF/Cornerstone.
- imaging/segmentation — labelmaps, ediciones y conversión a mallas (etapa posterior).
- imaging/provenance — origen, checksum, versión, transformaciones, fecha y revisión.
- imaging/security — control de acceso y protección de datos/límites/logs.
- imaging/export — formatos derivados con leyenda no diagnóstica.

Cada interfaz de lectura o transformación debe admitir errores tipados y nunca devolver un objeto aparentemente válido cuando la geometría no sea coherente.

### Entidades

**Study:** studyUID, modality summary, acquisition date (cuando corresponda y sin exponer al público), source id, status.
**Series:** seriesUID, studyUID, dimensions, orientation, positions, spacing, transfer syntax, decode state.
**Volume:** id, source series/frames, affine index-LPS, voxel type, intensity transform, generation parameters, quality state.
**Segmentation:** id, volume id, structure ontology, mask geometry, algorithm/version/manual edits, reviewer status.
**DerivedMesh:** id, segmentation id, units, coordinate frame, simplification settings, export format.
**AccessGrant:** owner/user/org/study/scope/revocation/expiry (solo futura multiusuario).
**AuditEvent:** actor/action/asset id/time/result (sin PHI duplicada).

## 5. Seguridad por diseño

- Toda entrada DICOM debe tratarse como dato no confiable (límites tamaño, longitud, sintaxis y metadatos; no ejecutar contenido embebido).
- No enviar buffers a APIs, modelos remotos, telemetry, bug reporters ni logs; desactivar analíticas de datos clínicos.
- En modo privado no exponer datos a terceras personas. Una rama Git pública no garantiza privacidad del Site.
- Autorización server-side independiente de la visibilidad del enlace; ninguna API propietaria bypass.
- Mínimo privilegio, no-store en contenido médico, CSP compatible con loaders/WASM; pruebas de degradación por consumo RAM.
- No se escriben datos clínicos en commits, issues, PR, capturas públicas, tickets o artefactos CI.
- Cualquier fixture público requiere procedencia verificable y revisión de desidentificación.
- Originales inmutables y resultado derivado explícitamente versionado.

## 6. Opciones y decisiones técnicas pendientes

| Decisión | Alternativas | Criterio de elección |
|---|---|---|
| Visor base | OHIF embebido vs Cornerstone3D integrado vs vtk.js puro | Integración real, MPR/volumen, tamaño bundle, licencia, experiencia |
| DICOM loader | Decodificador robusto vs extender parser de prueba | Cobertura transfer syntax, multiframe, seguridad, QA |
| Persistencia MVP | RAM solamente vs almacenamiento local consentido | Privacidad, recuperación, tamaño, rendimiento |
| CPU/GPU | WebGL navegador vs motor Python local | Disponibilidad, tamaño de estudio, latencia y costo |
| Servicio DICOM | Ninguno vs Orthanc | Interoperabilidad necesaria, operación, licencia |
| Segmentación | Manual primero vs AI local optativa | Control humano, licencias, CPU/GPU, tiempo |
| Exportación | GLB/STL vs DICOM SEG | Semántica, unidades, interoperabilidad |

## 7. Fuentes técnicas iniciales

- DICOM PS3.3 sección C.7.6.2 — https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_C.7.6.2.html
- OHIF 3.13 — https://ohif.org/release-notes/3p13/
- 3D Slicer — https://www.slicer.org/
- Cloudflare Workers limits — https://developers.cloudflare.com/workers/platform/limits/
- Marco ANMAT — https://www.argentina.gob.ar/noticias/anmat-actualiza-los-criterios-regulatorios-para-software-como-dispositivo-medico-samd

Las fuentes técnicas se revisarán antes de implementar adaptadores o adoptar licencias. Esta arquitectura no determina por sí sola la clasificación sanitaria del producto.
