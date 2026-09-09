# Clasificación de proyectos y referencias comerciales

## Compatibilidad de datos existentes

La migración clasifica como `residencial` los tipos históricos `condominio_existente`, `torre_residencial` y `proyecto_nuevo`, con subtipo inicial `apartamento`. `constructora`, `desarrollador` y `aliado` se clasifican como `comercial`.

`proyecto_nuevo` puede ser ambiguo. Después del despliegue, Gerencia debe revisar esas cuentas desde el Expediente Comercial y corregirlas cuando el proyecto sea comercial. El cambio conserva oportunidades y propuestas históricas.

Los leads de Meta y Google Forms aceptan `tipo de proyecto`, `subcategoría residencial` y `otro tipo de unidad`. Formularios antiguos sin esos campos continúan entrando como residencial/apartamento, que es el comportamiento histórico y debe confirmarse durante el primer contacto.

## Reglas

- Todo prospecto requiere `comercial` o `residencial`.
- Comercial usa el término `locales`.
- Residencial requiere `apartamento`, `casa` u `otros`; `otros` exige un término personalizado.
- Solo referencias activas, aprobadas y del mismo tipo de proyecto pueden guardarse en una propuesta nueva.
- Cada versión de propuesta guarda un snapshot JSON de sus tres referencias. Desactivar o editar el catálogo no cambia documentos históricos.
- Administración, Gerencia Comercial y Superadmin administran el catálogo. Los demás perfiles solo leen referencias activas según RLS.

## Despliegue

### Checklist preproducción

- [ ] Crear un backup verificable de la base de datos y registrar su identificador/hora.
- [ ] Confirmar que cada propuesta histórica resuelve exactamente tres `reference_ids` distintos en `references_catalog`.
- [ ] Aplicar `20260908171353_project_classification_and_commercial_references.sql` primero en preview. El preflight abortará toda la transacción y mostrará hasta 20 identificadores si detecta históricos incompletos.
- [ ] Confirmar que todas las propuestas tienen `project_type` y un `references_snapshot` JSON de exactamente tres elementos.
- [ ] Revisar las cuentas históricas ambiguas y cargar al menos tres referencias activas por tipo de proyecto que se vaya a cotizar.
- [ ] Probar propuesta comercial, residencial-apartamento, residencial-casa y residencial-otros.
- [ ] Confirmar descarga de una propuesta después de desactivar una referencia usada; debe renderizar desde el snapshot.
- [ ] Ejecutar advisors de seguridad/rendimiento y smoke test con perfiles Ejecutivo, Administración y Gerencia.

### Reversión forward no destructiva

No se deben eliminar las columnas, snapshots ni tablas después de aceptar tráfico: contienen datos históricos que no se pueden reconstruir con certeza. Si hay que retirar la funcionalidad, desplegar una nueva migración forward que:

1. revoque temporalmente `insert`, `update` y `delete` sobre `references_catalog`, conservando lectura;
2. mantenga activos los triggers y constraints de snapshots para proteger propuestas ya creadas;
3. restaure únicamente las policies anteriores que sean necesarias para la versión previa de la aplicación;
4. despliegue la versión anterior de la aplicación después de confirmar que tolera las columnas adicionales;
5. conserve el backup hasta completar comparación de conteos y una descarga de muestra.

Si la migración falla durante su aplicación, no ejecutar SQL parcial manualmente: corregir los `reference_ids` indicados por el preflight en una migración preparatoria y volver a aplicar. El rollback destructivo queda reservado para restauración completa desde backup en una ventana aprobada.
