# Estrategia de migración

## Objetivo

Transformar el seguimiento nutricional previo en la historia clínica privada sin borrar datos, modificar fechas ni mezclar perfiles.

## Origen conservado

Las tablas `family_users`, `family_sessions` y `nutrition_data` permanecen temporalmente en el esquema. Ya no existen rutas públicas de alta, acceso o sincronización sobre ellas. Sólo `GET/POST /api/health/migrate` puede leerlas cuando coinciden:

1. una identidad privada actual;
2. una cookie de sesión heredada válida;
3. la contraseña del perfil anterior confirmada nuevamente;
4. un payload nutricional perteneciente a esa sesión.

## Transformación

| Origen legado | Destino |
|---|---|
| configuración de inicio y duración | `nutrition_plans` |
| día guardado | `nutrition_days` |
| seis bloques de comida | `nutrition_meals` |
| peso diario | `weight_entries` + evento |
| presión mañana/tarde/noche | `blood_pressure_readings` + serie + evento |
| actividad | `activity_sessions` + evento |

La fecha de inicio se toma, en orden, de `settings.startDate`, del primer día válido o de la fecha de migración sólo cuando el origen no contiene ninguna fecha recuperable.

## Idempotencia

La clave `legacy-nutrition:{legacy_user_id}` se reserva en `sync_events` antes de escribir. Una migración completada no se ejecuta otra vez; una migración interrumpida queda bloqueada para impedir duplicados silenciosos. Los días se insertan o actualizan por `(plan_id, date)` y las comidas de ese día se reconstruyen de forma determinística.

## Verificación posterior

- Confirmar fecha inicial, fecha final y cantidad de días.
- Comparar pesos, series de presión y actividades.
- Revisar P/H/V y estados de las seis comidas.
- Exportar un respaldo JSON de la nueva estructura.
- Mantener el origen hasta completar la comparación.

## Retiro futuro

Las tablas heredadas sólo podrán eliminarse en una migración separada, después de:

1. verificar la importación en producción;
2. conservar un respaldo independiente;
3. documentar período de retención;
4. obtener aprobación explícita del propietario.

La migración actual no contiene `DROP`, `TRUNCATE` ni borrados masivos.
