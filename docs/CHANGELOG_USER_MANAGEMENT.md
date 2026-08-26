# Cambio: gestión completa de usuarios

- Invitación por correo desde el CRM.
- Cambio de rol desde la pantalla Usuarios.
- Activación/desactivación desde la pantalla Usuarios.
- Endpoint protegido para cambio de rol.
- Endpoint protegido para cambio de estado.
- Endpoint protegido para cambio de nombre.
- Bloqueo efectivo de perfiles inactivos mediante middleware.
- Respuesta HTTP 403 para APIs cuando el perfil está desactivado.
- Pantalla `/access-disabled` con cierre de sesión.
- Protección contra cambio de rol o desactivación de la propia cuenta del superadministrador desde la interfaz.
- Cambio manual de contraseña visible y ejecutable únicamente por `superadmin`.
- Validación de usuario objetivo, longitud y confirmación de contraseña en cliente y servidor.
- Auditoría del cambio sin almacenar la contraseña.
