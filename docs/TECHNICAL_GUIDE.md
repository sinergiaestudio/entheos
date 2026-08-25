# Guía técnica

## Estructura

- `app/`: página privada y rutas API.
- `components/`: shell, pantallas, formularios e iconos SVG.
- `db/schema.ts`: esquema Drizzle.
- `db/clinical.ts`: identidad, ámbito, validación y auditoría.
- `db/health-data.ts`: consultas y escrituras clínicas.
- `lib/offline.ts`: IndexedDB e idempotencia de cola.
- `public/sw.js`: caché estática acotada.
- `drizzle/`: migraciones SQL.

## Comandos

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run db:generate
```

## Agregar una entidad

1. Incluir `organization_id`, `patient_id`, fuente, verificación, creador y timestamps.
2. Agregar índice por paciente y fecha/categoría.
3. Consultar siempre con ambos identificadores de ámbito.
4. Validar tamaño, tipo, rango y fecha del payload.
5. Crear evento de línea de tiempo cuando corresponda.
6. Registrar auditoría sin contenido clínico.
7. Añadir tipos de cliente, estado vacío y exportación.
8. Generar migración aditiva y prueba.

## Contrato de errores

- `400`: payload inválido; no se aplicó la operación.
- `401`: falta identidad o token/scopes.
- `403`: origen no permitido.
- `404`: entidad ausente **o fuera del ámbito**.
- `409`: duplicado o intento de restauración ya procesado.
- `413/415`: archivo demasiado grande o no admitido.
- `503`: capacidad D1/R2 no disponible.

Los mensajes al cliente no incluyen stack traces, SQL ni identificadores de otros pacientes.

## Pruebas mínimas por cambio

- lint y TypeScript;
- build Worker;
- autorización negativa;
- aislamiento entre dos contextos ficticios;
- idempotencia si existe escritura offline/importación;
- responsive móvil;
- modo oscuro e impresión si cambia UI;
- revisión de migración sin `DROP` accidental.

## Datos de prueba

Usar sólo `seed.example.json` o valores ficticios. No copiar respaldos, capturas, nombres, correos, documentos ni tokens reales al repositorio o a logs de CI.
