# ANATHEOS 3D · Propuesta de protección gratuita de ramas · Issue #20

**Fecha:** 26/10/2026 · **Estado:** propuesta a Dirección, NO aplicada. **Repositorio:** `sinergiaestudio/entheos` (público). **Rama documental:** `anatheos/issue-20-branch-protection-design` desde `19c945cf69ff69daa95804639a4aabc9ce9ad7db`.

## 1. Evidencia técnica obtenida, límites de administración

| Comprobación | Resultado leído de GitHub |
|---|---|
| `main` HEAD | `8e7602280d6c4fddc234c1973537839592683798` |
| Rama piloto HEAD | `19c945cf69ff69daa95804639a4aabc9ce9ad7db` |
| Branch flags | `protected=false` ambas |
| GET /repos/sinergiaestudio/entheos/rulesets | lista vacía `[]` |
| GET branch protection detallado | `403 Resource not accessible by integration` |
| Metadata de permisos de repositorio | `admin=true, maintain=true, push=true`, **pero ello no concede a este conector lectura/escritura administrativa de reglas** |
| Plan/visibilidad | Repositorio **público**; las protecciones de ramas están disponibles para repos públicos en GitHub Free |
| GitHub Actions | único workflow revisado `.github/workflows/ci.yml`, job **`verify`**. Ejecuta push en `main` y todo pull_request |
| PR #5 | DRAFT desde rama piloto a `main`, NO MERGE |
| Plataforma de Entheos | `.openai/hosting.json` mapea nombres D1 `DB` y R2 `BUCKET`; el despliegue del Site no se instrumenta en el workflow CI observado y podría depender de automatismos del servicio externo. **No se inspeccionó contrato real de despliegue** |

**Fuentes oficiales de GitHub:** [Protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches), [Configure classic branch protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule) y [Rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).

No afirmar `protected=true` ni que exista un ruleset. Ninguna configuración se ha modificado en esta fase.

## 2. Propuesta mínima · dos ramas y dos políticas independientes

| Ajuste | `main` (producción) | `feature/anatheos-3d-owner-pilot` (experimental) |
|---|---|---|
| Patrón de rama exacto | `main` | `feature/anatheos-3d-owner-pilot` |
| Exigir PR antes de modificar la rama | **Sí**, barrera a push directo | **Sí**, evitar cambios accidentales |
| Revisión humana | 1 aprobación **si existe otro revisor con write**, no asumir disponibilidad | 1 aprobación independiente si existe; caso contrario documentar limitación y mantener no-merge por gobierno hasta nueva decisión |
| Check obligatorio | `verify`, fijar **app GitHub Actions** como source si Settings lo permite | `verify`, misma fuente |
| Up-to-date branch antes de merge | Sí, si el flujo Site y GH Actions soporta actualización sin bloquear | Sí, verificar comportamiento con las ramas hijas |
| Conversaciones resueltas | Sí | Sí |
| Force push | **Bloqueado** | **Bloqueado** |
| Delete branch | **Bloqueado** | **Bloqueado** |
| Historial lineal | **No habilitar**; la fusión normal aprobada genera merge commit | **No habilitar**; Issue #25 usa merge de dos padres |
| Restricción de bots y bypass | Ningún bypass general desconocido. Auditar actores existentes de despliegue | Idem; si se necesita bypass técnico concreto, requerir nueva aprobación |
| Require deployment check | No activar sin evidencia de job de deployment y entorno confiable | No activar; no existe staging |
| Status de protección | Requiere confirmación `protected=true` tras aplicar la regla | Igual |

**Riesgo de aprobación imposible:** GitHub no permite aprobar el propio PR como segunda revisión independiente. Si solo existe una cuenta con permisos suficientes, activar un requisito de una aprobación puede bloquear toda operación legítima. La Dirección debe elegir entre invitar otro revisor sin costo, mantener bloqueo hasta disponer de él o autorizar un bypass documentado muy restringido. **No sustituir aprobación técnica automática por autofirma**.

**Riesgo de CI ambigua:** el check de este repositorio se llama `verify`. Confirmar el texto y emisor exactos en Settings para evitar checks de otra aplicación con el mismo nombre. El cambio al workflow de G1B añade un paso, no otro job con nombre `verify`; los PR deben demostrar un ciclo de checks completo.

## 3. Aplicación futura: pasos de UI exclusivos del administrador

**Ninguno de estos pasos está autorizado para ejecutarse en la sesión actual.**

1. Abrir https://github.com/sinergiaestudio/entheos/settings/rules (si la UI ofrece Rulesets) o `Settings → Branches → Branch protection rules`.
2. Confirmar permisos efectivos de administración, actores que hacen push y si Sites requiere integración que inserta commits en `main`. Hacer un inventario no secreto de pipelines en GitHub y en el producto de hosting; no probar cambios en producción.
3. Crear una política con nombre `entheos-main-protection` y destino rama exacta `main`; configurar PR obligatorio, status check `verify` de GitHub Actions, prohibiciones de force/delete y resolución de conversaciones. **No activarla aún**. Si existe `Evaluate`, probar ese modo sin bloquear cambios; si no, pedir aprobación para una activación coordinada y reversible.
4. Crear otra política `anatheos-owner-pilot-protection` para la rama exacta `feature/anatheos-3d-owner-pilot`, con requisitos equivalentes y sin `Require linear history`.
5. Antes de aplicar, presentar a Dirección una captura saneada de cada regla y sus bypasses, la lista de checks exigidos y un plan de reversión. **Activación requiere autorización explícita adicional**.
6. Tras activar, comprobar API `branches/main` y `branches/feature/anatheos-3d-owner-pilot`: `protected=true`; revisar ruleset IDs y `enforcement=active`. Si este conector devuelve 403, emplear captura de UI por un administrador sin exponer credenciales.
7. Validar **sin tocar directamente `main`**: PR sintético en rama descartable, comportamiento ante check requerido fallido, estado de aprobación y conversación pendiente; si no puede probarse denegación de pushes de manera segura, consignar esa parte como NO PROBADA. Verificar que el flujo legítimo de Entheos sigue operativo con una prueba aprobada específicamente.

**Importante:** el modo Evaluate podría no estar incluido en la versión/plan efectivos del repositorio; no afirmar que está disponible sin comprobar la UI.

## 4. Protección de producción y pruebas de rollback

- Guardar antes de activar una exportación/captura de la configuración visible, names/IDs de reglas, SHA de ambas ramas, permisos y estado de CI; nunca registrar tokens.
- Exigir que `main` conserve HEAD previsto; impedir que el PR #5 pueda fusionarse por descuido. PR DRAFT por sí solo no constituye protección.
- Si una regla impide el funcionamiento legítimo, un administrador con autorización puede **desactivar temporalmente únicamente la regla implicada**, volver a configuración original con auditoría y verificar el despliegue; no desactivar la protección global automáticamente.
- Durante pruebas no usar datos clínicos, credenciales ni publicar ANATHEOS. No activar ningún gasto o cuenta externa.

## 5. Decisión requerida de Dirección

**P-008 todavía propuesta, no aprobada:** validar rama exacta, checks, condición de revisión (segundo revisor), implicación en hosting productivo y plan de rollback. Autorizar por separado el acto administrativo de crear/activar las reglas. Sin esa autorización, #20 continúa abierto y `main`/piloto continúan sin protección efectiva.

**Riesgos relacionados:** Issue #7 identidad remota, Issue #25 ya consolidado (no reabrir), Issue #5 borrador a producción. **No merge ni deploy por este informe.**
