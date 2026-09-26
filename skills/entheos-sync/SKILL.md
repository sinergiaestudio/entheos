---
name: entheos-sync
description: Guarda en Entheos datos de salud y archivos de una conversación únicamente cuando el usuario lo solicita expresamente.
---

# Entheos · sincronización clínica desde conversaciones

## Cuándo usarla

Usá esta habilidad cuando el usuario diga expresamente alguna instrucción equivalente a:

- Enviar a Entheos.
- Subir a Entheos.
- Guardar en Entheos.
- Actualizar mi historia en Entheos.
- Sincronizar con Entheos.
- Cargar este estudio en Entheos.

Esa instrucción constituye la aprobación del usuario para guardar inmediatamente ese lote concreto. No pidas una segunda confirmación ni lo envíes a una bandeja de revisión adicional.

## Flujo obligatorio

1. Consultá `get_changes_since`, `search` o `get_health_history` para detectar duplicados relevantes.
2. Extraé únicamente datos clínicos confirmados por el usuario o presentes en documentos aportados.
3. Conservá la fecha clínica original. Distinguí la fecha del hecho de la fecha de carga.
4. Prepará registros estructurados compatibles con Entheos.
5. Adjuntá los archivos originales mediante el parámetro `files` de `send_to_entheos` y relacioná cada archivo con su metadata mediante `file_id`.
6. Generá una `idempotency_key` estable para el mismo lote.
7. Llamá `send_to_entheos` una sola vez por lote aprobado.
8. Verificá el resultado con `get_changes_since`.
9. Informá qué se guardó, qué se omitió por duplicado y los identificadores devueltos.

## Qué guardar

- Mediciones declaradas: peso, presión, sueño y actividad.
- Síntomas y su estado cuando el usuario los considera relevantes.
- Medicación, suplementos, procedimientos, hábitos y tratamientos.
- Consultas, estudios, resultados de laboratorio y documentos originales.
- Notas o eventos clínicos con fecha y procedencia.
- Actualizaciones de perfil solicitadas explícitamente.

## Qué no guardar como hecho clínico

- Hipótesis del asistente.
- Diagnósticos no confirmados.
- Recomendaciones generales.
- Alarmas, interpretaciones o rangos agregados por el modelo que no figuren en la fuente.
- Datos personales no relacionados con salud.
- Conversación redundante o comentarios sin valor clínico.

Las interpretaciones del asistente sólo pueden guardarse como nota diferenciada si el usuario pide expresamente conservarlas como tal.

## Documentos

Guardá siempre el archivo original. Usá metadata objetiva:

- título;
- tipo documental;
- fecha del estudio;
- institución;
- profesional;
- especialidad;
- descripción breve basada en la fuente;
- etiquetas.

No inventes metadata ausente. Si un campo no está disponible, omitilo.

## Conversaciones extensas y carga inicial

Para una carga histórica completa, dividí la conversación en lotes cronológicos y temáticos. Comenzá por documentos y tratamientos activos, luego mediciones y antecedentes. Consultá Entheos entre lotes para evitar duplicaciones.
