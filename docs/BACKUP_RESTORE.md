# Respaldo y restauración

## Crear un respaldo

En **Más → Informes y respaldo**, elegir **Descargar respaldo JSON**. El archivo incluye perfil, mediciones, sueño, síntomas, hechos clínicos, línea de tiempo, laboratorio, nutrición y metadatos de documentos.

Los binarios originales no se incluyen en el JSON. Deben descargarse desde Documentos y conservarse junto al respaldo.

## Restaurar

1. Elegir el JSON.
2. La app valida formato y versión.
3. Se muestran cantidades por módulo y advertencias.
4. Confirmar sólo después de revisar.
5. La importación agrega datos; no borra la historia actual.

El archivo se identifica por SHA-256. Una restauración completada no puede repetirse. Si la operación se interrumpe, queda marcada como fallida y el mismo archivo se bloquea para impedir duplicados silenciosos.

## Qué se restaura

- perfil clínico;
- peso, presión, actividad, sueño y síntomas;
- antecedentes, medicación, alergias y otros hechos declarados;
- días y comidas del seguimiento nutricional;
- resultados de laboratorio manuales;
- eventos manuales sin entidad fuente.

No se restauran desde JSON:

- originales R2;
- logs de auditoría;
- tokens API;
- sesiones;
- propuestas de IA pendientes.

## Recomendación

Crear un respaldo después de cambios importantes y antes de una migración. Guardar JSON y documentos en un medio cifrado o una ubicación personal con control de acceso.
