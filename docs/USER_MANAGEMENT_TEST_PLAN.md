# Plan de prueba — Gestión de usuarios

1. Iniciar sesión como superadministrador.
2. Abrir **Usuarios** y enviar una invitación a un correo de prueba.
3. Confirmar recepción del correo y establecimiento de contraseña.
4. Confirmar que el usuario nuevo aparece activo con el rol elegido.
5. Cambiar su rol y verificar que la tabla se actualiza.
6. Desactivar el usuario.
7. Intentar navegar con la sesión del usuario desactivado: debe ir a `/access-disabled`.
8. Intentar una llamada API con el usuario desactivado: debe responder 403.
9. Reactivar el usuario desde la cuenta superadministradora.
10. Verificar que vuelve a poder acceder al CRM.
11. Confirmar que el superadministrador no puede desactivar ni cambiar su propio rol desde la interfaz.
12. Como superadministrador, abrir **Contraseña** para un usuario, confirmar que se rechazan claves de menos de 10 caracteres y confirmaciones distintas.
13. Cambiar la contraseña y confirmar que el usuario puede iniciar sesión con la nueva clave.
14. Confirmar que `admin_password_change_audit` contiene actor, objetivo, estado y fecha, pero ningún dato de contraseña.
15. Como un rol distinto de `superadmin`, confirmar que la acción **Contraseña** no aparece y que una llamada directa a `/api/admin/users/password` responde HTTP 403.
