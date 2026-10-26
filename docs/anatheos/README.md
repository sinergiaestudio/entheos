# ANATHEOS 3D — Centro de dirección e ingeniería

**Proyecto:** plataforma general de reconstrucción médica 3D.  
**Código y documentación:** módulo experimental de Entheos en rama feature/anatheos-3d-owner-pilot.  
**Política:** sin licencias, APIs o suscripciones externas pagas; ningún gasto adicional sin autorización.
**Privacidad:** GitHub público; prohibido introducir datos clínicos reales y secretos.
**Producción:** main y el Site Entheos permanecen fuera del piloto hasta autorización futura.

## Documentos canónicos

1. [Plan maestro](PLAN_MAESTRO.md) — visión, G0–G8, dependencias, criterios, prioridades, riesgos.
2. [Arquitectura objetivo](ARQUITECTURA_OBJETIVO.md) — límites, módulos, datos, geometría y elección técnica.
3. [Calidad, seguridad y validación](CALIDAD_SEGURIDAD_VALIDACION.md) — pruebas, gates, privacidad, validación DICOM/Slicer.
4. [Decisiones adoptadas y propuestas](REGISTRO_DECISIONES.md) — D-001–D-009 y opciones técnicas pendientes.
5. [Protocolo GitHub / dos chats](PROTOCOLO_GIT_Y_CHATS.md) — responsables, issues, PR, aprobaciones, comunicación.
6. [Estado y riesgos actualizables](ESTADO.md) — hechos comprobados, tareas inmediatas, auditoría.
7. [Inicio del chat de desarrollo](INICIO_CHAT_DESARROLLO.md) — instrucción ejecutiva que debe leer el programador.
8. [Registro previo de hitos](../ANATHEOS_MILESTONES.md) — prototipo DICOM inicial y su QA.
9. [Especificación del piloto inicial](../ANATHEOS_3D_PILOT.md) y [traspaso del Proyecto ChatGPT](../ANATHEOS_CHATGPT_PROJECT_HANDOFF.md) — historia y contexto.

## Tablero de ingeniería

- **PR piloto, borrador, no fusionar:** [#5](https://github.com/sinergiaestudio/entheos/pull/5).
- **Gobierno G0:** [#6](https://github.com/sinergiaestudio/entheos/issues/6).
- **Seguridad G1:** [#7](https://github.com/sinergiaestudio/entheos/issues/7).
- **Importador G2a:** [#8](https://github.com/sinergiaestudio/entheos/issues/8).
- **Corpus DICOM G2b:** [#9](https://github.com/sinergiaestudio/entheos/issues/9).
- **MPR G3a:** [#10](https://github.com/sinergiaestudio/entheos/issues/10).
- **UX/mediciones G3b:** [#11](https://github.com/sinergiaestudio/entheos/issues/11).
- **Volumen 3D G4a:** [#12](https://github.com/sinergiaestudio/entheos/issues/12).
- **Rendimiento G4b:** [#13](https://github.com/sinergiaestudio/entheos/issues/13).
- **Segmentación manual G5a:** [#14](https://github.com/sinergiaestudio/entheos/issues/14).
- **IA local optativa G5b:** [#15](https://github.com/sinergiaestudio/entheos/issues/15).
- **Datos/Entheos G6:** [#16](https://github.com/sinergiaestudio/entheos/issues/16).
- **Preview privado G7:** [#17](https://github.com/sinergiaestudio/entheos/issues/17).
- **Apertura/regulación G8:** [#18](https://github.com/sinergiaestudio/entheos/issues/18).
- **Privacidad, supply chain y seguridad transversal:** [#19](https://github.com/sinergiaestudio/entheos/issues/19).

## Inicio recomendado

**Dirección (este chat):** leer README, ESTADO, Issues, PR y checks; decidir alcance y aprobar o devolver hitos. Nunca confundir un commit con validación geométrica ni un branch con una URL privada.

**Desarrollo (chat separado):** abrir INICIO_CHAT_DESARROLLO; implementar issue en rama desde integración; crear PR contra rama piloto; adjuntar CI y resultados; dejar comentario de entrega y actualizar documentación. Si cambia alcance o presupuesto, detener e iniciar propuesta de decisión.

## Estado al centralizar

La rama contiene una portada de propietario y un lector DICOM experimental local muy limitado, con un visor de planos simples. Existen pruebas sintéticas en CI, pero **no** existe renderizado volumétrico 3D ni Site piloto privado desplegado o validado. Los documentos maestros describen un diseño y metas, no funciones implementadas.

## Política de conservación

- Todo hito debe quedar como commits/Issues/PR y su estado en ESTADO; todo cambio estratégico debe figurar en REGISTRO_DECISIONES.
- No guardar datos médicos, PDF de pacientes, dicoms reales, contraseñas o tokens en el repo ni en Issues.
- Nunca borrar una decisión histórica para ocultar un cambio de criterio; agregar reemplazo y enlace.
- Evitar usar el chat como único respaldo. GitHub aloja el registro técnico, no expedientes clínicos.
