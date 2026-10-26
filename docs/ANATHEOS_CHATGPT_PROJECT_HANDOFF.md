# ANATHEOS 3D · Documento de traspaso a Proyecto ChatGPT

**Fecha de consolidación:** 26 de octubre de 2026  
**Estado:** documentación y entrada privada codificadas en una rama; **no existe aún un piloto desplegado ni un motor de reconstrucción operativo**.  
**Nuevo Proyecto de ChatGPT (a crear manualmente):** ANATHEOS 3D · Reconstrucción Médica.

## 1. Propósito

Desarrollar una plataforma general de reconstrucción médica 3D para pacientes y profesionales, capaz de importar estudios DICOM (inicialmente tomografía computada y resonancia magnética), reconstruir volúmenes, navegar cortes en los planos axial/coronal/sagital, visualizar modelos anatómicos, segmentar estructuras cuando sea válido y exportar derivados trazables al estudio original.

El primer piloto será exclusivamente para su titular, utilizando Entheos como plataforma madre. La eventual apertura a pacientes, médicos e instituciones se decidirá después de pruebas y controles de seguridad. No ofrecer diagnóstico automático ni recomendaciones terapéuticas en el MVP.

## 2. Condiciones expresas no negociables

1. **No contratar ni suscribirse a aplicaciones, SaaS, APIs, complementos ni servicios externos pagos.** Utilizar software libre y procesamiento propio para el prototipo.
2. Ningún cargo, infraestructura o proveedor pago se activa sin una nueva autorización explícita. El software podrá costar cero; hardware, energía, alojamiento y almacenamiento no necesariamente.
3. Preservar sitio, identidad, base D1, archivos R2 e integraciones existentes de Entheos; no alterar `main` ni desplegar en producción sin pruebas.
4. Mantener rama de GitHub separada y un entorno de pruebas de acceso exclusivo al propietario. Una rama pública **no** es un espacio de datos privado.
5. No guardar archivos médicos reales, información de pacientes, secretos o tokens en el repositorio público, ni usar estudios identificables como fixtures.
6. La IA anatómica es opcional, con revisión humana y procedencia. No inferir diagnósticos a partir de modelos reconstruidos.
7. Documentar hallazgos, avances, decisiones, límites y pruebas; nunca declarar una funcionalidad como implementada sin evidencia.

## 3. Arquitectura acordada y adaptación real

### Producto / MVP

- Importación DICOM de TC y RM, con verificación de integridad, orientación, posición y espaciamiento.
- Reconstrucción multiplanar (MPR), renderizado volumétrico 3D, ventanas/opacidad.
- Segmentación manual básica y piloto de IA limitado a modelos/licencias compatibles.
- Vinculación de reconstrucciones al original DICOM; exportación de modelos GLB/STL en etapas siguientes.
- Acceso diferenciado paciente/profesional en el futuro; fase inicial de propietario único.
- Sin detección automatizada de enfermedades ni decisiones clínicas.

### Tecnologías

- **Sitio existente:** Entheos usa Next/Vinext + React + TypeScript en Cloudflare Workers; D1/Drizzle para datos y R2 para documentos. Identidad ChatGPT/Sites ya integrada.
- **Visor:** OHIF + Cornerstone3D, sujeto a integración y verificación de compatibilidad con la aplicación.
- **Motor de volumen:** Cornerstone3D/vtk.js en navegador cuando los recursos lo permitan; SimpleITK/pydicom para geometría y procesamiento local.
- **Segmentación:** MONAI / TotalSegmentator, sólo modelos y tareas con licencias aceptables para el uso concreto.
- **Repositorio DICOM opcional posterior:** Orthanc + DICOMweb, en servidor propio y con revisión de obligaciones GPL/AGPL.
- **API de procesamiento eventual:** FastAPI en proceso local separado, nunca asumir que Cloudflare Workers puede ejecutar cargas volumétricas o GPU de forma nativa.
- **Referencia de validación:** 3D Slicer.

Mantener al principio el sitio en Cloudflare y el motor volumétrico desacoplado; no introducir PostgreSQL, Orthanc o GPU remota sólo porque figuren en una propuesta inicial. Incluirlos cuando surja necesidad demostrable y respetando la política de cero suscripciones.

## 4. Estado verificado del código

Repositorio: https://github.com/sinergiaestudio/entheos (público).  
Rama base: `main`.  
Rama piloto: `feature/anatheos-3d-owner-pilot`.

Cambios realizados exclusivamente en la rama piloto:
- `docs/ANATHEOS_3D_PILOT.md` — especificación técnica y controles (commit `07b93428809dd80651ad5c414b6502f7f64fd35d`).
- `app/app/anatheos-3d/page.tsx` — portada conceptual protegida mediante `requireChatGPTUser` y rechazo de usuarios sin `isGlobalAdmin` (commit `6ec6295f19ec2ab25a5025bb3b0d2462fa8c7462`).

La protección depende de que `APP_OWNER_EMAIL` esté configurado y de que la plataforma inyecte identidad autenticada segura. **Aún debe probarse contra acceso anónimo y otras identidades en un entorno real**. No hay despliegue, integración de OHIF ni reconstrucción DICOM verificada.

Documento técnico: https://github.com/sinergiaestudio/entheos/blob/feature/anatheos-3d-owner-pilot/docs/ANATHEOS_3D_PILOT.md

## 5. Próximas tareas prioritarias

1. Verificar estado actual del repositorio y confirmar que la rama está separada de `main`.
2. Establecer desarrollo y pruebas independientes (sin usar D1/R2 clínicos productivos ni publicar una ruta experimental en el dominio productivo). Validar configuración de `APP_OWNER_EMAIL`.
3. Ejecutar lint, typecheck y pruebas existentes en la rama. No afirmar que pasaron hasta contar con resultados.
4. Incorporar visor con un conjunto DICOM **público y desidentificado** o sintético; probar importación de series, continuidad geométrica y MPR.
5. Comparar resultados y dimensiones físicas contra 3D Slicer.
6. Integrar renderizado 3D con control de ventanas y opacidades; medir rendimiento con datos de prueba.
7. Diseñar procesamiento local desacoplado, contenedor opcional sin pago y persistencia segura de derivados.
8. Revisar licencias por dependencias y modelos, con inventario de versiones.
9. Hacer pruebas de seguridad, protección de datos y eventual análisis de marco ANMAT antes de cualquier uso clínico o acceso a terceros.
10. Presentar cada hito con evidencia, cambios, pruebas y pendientes.

## 6. Conversaciones a mover al nuevo Proyecto ChatGPT

- **Esta conversación actual**, donde surgió la idea de reconstruir series multislice, se definió el alcance para pacientes/profesionales, se aprobó la política sin pagos y se creó la rama piloto.
- Otros chats específicamente dedicados a ANATHEOS 3D o a su **ingeniería** si existieran en el historial.

**No trasladar indiscriminadamente** conversaciones sobre síntomas, diagnósticos, informes médicos personales ni el seguimiento clínico de Entheos. Permanecen en su contexto clínico. El desarrollo de ANATHEOS reutiliza el código de Entheos mediante GitHub, sin necesitar reproducir datos sensibles en un nuevo proyecto técnico.

La creación del Proyecto ChatGPT y el movimiento de conversaciones deben realizarse desde la interfaz de ChatGPT: `Nuevo proyecto` → nombre → en cada chat `•••` → `Mover al proyecto`, o arrastrarlo al proyecto. Algunos chats no son elegibles, especialmente los iniciados con GPTs.

## 7. Instrucciones sugeridas del nuevo Proyecto ChatGPT

Actuá como director técnico, arquitecto de software de imágenes médicas, ingeniero de seguridad y coordinador de producto del proyecto ANATHEOS 3D. Conservá este documento como referencia de continuidad; consultá el repositorio real antes de afirmar estados de implementación.

Priorizá MVP usable, reconstrucción geométricamente fiel, pruebas reproducibles, interoperabilidad DICOM, procesamiento propio sin suscripciones externas y privacidad desde el diseño.

Separá estrictamente: propuesta, implementado, probado, desplegado y validado clínicamente. No modifiques Entheos productivo ni compartas datos médicos reales. Toda intervención de código debe ocurrir primero en la rama `feature/anatheos-3d-owner-pilot`, salvo decisión expresa posterior. No generes servicios pagos, claves API comerciales ni compromisos de gasto. Registrá los avances por hitos breves, el resultado de cada prueba y el próximo paso.

La plataforma inicialmente es **exploratoria y privada**, no un dispositivo diagnóstico validado. Cualquier expansión a terceros debe esperar aprobación, revisión de licencias y evaluación de privacidad/regulación.

## 8. Mensaje de inicio sugerido

«Continuemos ANATHEOS 3D desde el documento de traspaso y el repositorio `sinergiaestudio/entheos`, rama `feature/anatheos-3d-owner-pilot`. Primero auditá el estado real de la rama y de los entornos disponibles, confirmá que producción permanece intacta y prepará el siguiente hito de visor DICOM con datos públicos anonimizados. Ninguna contratación, suscripción ni API paga. Trabajá con pruebas verificables, actualizá el registro de decisiones y no declares el piloto desplegado hasta comprobarlo».
