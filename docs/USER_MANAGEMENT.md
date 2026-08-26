# Gestión de usuarios — INDEX ONE CRM

## Flujo administrador

1. Ir a **Usuarios**.
2. Pulsar **Invitar usuario**.
3. Registrar nombre, correo corporativo y rol.
4. El usuario recibe una invitación de Supabase para establecer su contraseña.
5. Desde la misma pantalla, el superadministrador puede cambiar nombre, cambiar rol, establecer una nueva contraseña y activar/desactivar acceso.

## Reglas de seguridad

- Solo el rol `superadmin` puede invitar o administrar perfiles.
- El superadministrador no puede desactivar ni cambiar su propio rol desde la tabla, para evitar un bloqueo accidental.
- Un perfil con `active = false` es interceptado por middleware y enviado a `/access-disabled`.
- Las llamadas API de un perfil desactivado reciben HTTP 403.
- La autorización de datos continúa reforzada por RLS en Supabase.
- La contraseña manual exige entre 10 y 128 caracteres y confirmación idéntica.
- El cambio se ejecuta exclusivamente en el servidor con `auth.admin.updateUserById` y se audita sin guardar la contraseña.

## Roles

- `superadmin`: configuración, usuarios y todo el CRM.
- `gerencia_comercial`: cartera completa, asignaciones y reportes.
- `ejecutivo`: prospectos, tareas y oportunidades asignadas.
- `administracion`: ventas, comisiones y consulta comercial.
- `consulta`: lectura sin modificaciones.

## Variables requeridas en producción

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`

La `SUPABASE_SERVICE_ROLE_KEY` debe permanecer únicamente en el servidor y nunca exponerse al navegador.
