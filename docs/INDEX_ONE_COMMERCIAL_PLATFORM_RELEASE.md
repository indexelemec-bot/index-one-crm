# INDEX ONE CRM — checklist de lanzamiento

Rama: `feature/index-one-commercial-platform`

## Estado por bloque

- ✅ A — Expediente Comercial: refresco inmediato, protección contra datos obsoletos, Realtime acotado, botón de actualización y estados de carga/error.
- ✅ B — Reasignación: motivo obligatorio, nota opcional, operación atómica, histórico inmutable y permisos por rol.
- ✅ C — Clasificación: comercial/residencial, subtipos residenciales, validación condicional e integración con formularios y leads.
- ✅ D — Referencias: catálogo administrable, selección de tres por similitud, reemplazo manual y snapshot histórico inmutable.
- ✅ E — Equipo: conversaciones 1:1/grupales, participantes, responsable, menciones, lecturas, tareas, adjuntos privados, timeline y diseño móvil.
- 🟡 F — Entrega: QA local aprobado; migraciones, preview y smoke test remoto pendientes antes de producción.

## Migraciones

Aplicar en este orden:

1. `20260908171341_internal_messaging_collaboration.sql`
2. `20260908171343_commercial_file_refresh_and_assignment_audit.sql`
3. `20260908171353_project_classification_and_commercial_references.sql`
4. `20260909144326_inactive_profile_access_guard.sql`

La migración de clasificación aborta si encuentra propuestas históricas cuyas tres referencias no puedan resolverse. Corregir los IDs que reporte y volver a ejecutar; no omitir el preflight.

## QA aprobado localmente

- 56 pruebas automatizadas.
- TypeScript sin errores.
- ESLint sin errores; permanece una advertencia preexistente en `docs/google-forms-apps-script.js`.
- Build de Next.js: 65/65 rutas.
- `git diff --check` limpio.

## Checklist de preview

- [ ] Crear/validar base Supabase aislada; nunca apuntar el preview a Index PMS.
- [ ] Respaldar la base objetivo antes de aplicar migraciones.
- [ ] Aplicar migraciones y ejecutar asesores de seguridad/rendimiento.
- [ ] Configurar en Vercel Preview las claves de la base aislada.
- [ ] Confirmar que `WHATSAPP_REAL_SEND_ENABLED` no es `true` en Preview.
- [ ] Probar los escenarios comercial, residencial/apartamento, residencial/casa y residencial/otros.
- [ ] Probar reasignación con motivo, histórico y actualización automática del expediente.
- [ ] Probar CRUD y reemplazo de referencias, más PDF/DOCX comercial y residencial.
- [ ] Probar chat 1:1, grupo, menciones, lectura, participantes, reasignación, tarea y adjunto.
- [ ] Confirmar RLS con ejecutivo, gerencia, superadmin y usuario deshabilitado.
- [ ] Verificar escritorio y móvil, incluyendo el contexto desplegable de Equipo.
- [ ] Ejecutar regresión de WhatsApp/correo únicamente en modo simulado.

## Producción y reversión

No promover mientras falle cualquier punto del preview. La reversión preferida es forward-only: restaurar el código anterior y corregir policies/funciones con una migración nueva sin eliminar columnas, tablas, mensajes ni snapshots. Conservar un backup verificable previo a producción.
