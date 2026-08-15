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
