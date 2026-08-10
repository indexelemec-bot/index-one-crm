# Correo comercial de INDEX CONDO

El CRM envía correos transaccionales mediante Resend y registra cada intento en Supabase. Las respuestas se centralizan en el buzón `ventas@indexelemecsrl.com`, alojado en Private Email.

## Arquitectura elegida

- **Salida desde el CRM:** Resend, porque permite adjuntar propuestas, registrar el identificador del mensaje y recibir estados de entrega, apertura, rebote y fallo.
- **Respuesta del cliente:** Private Email recibe las respuestas en `ventas@indexelemecsrl.com`.
- **Correo entrante en el CRM:** se conectará posteriormente por IMAP para incorporar las respuestas al expediente comercial.

No se usa `admincondo@indexelemecsrl.com` para la comunicación comercial.

### Buzón Private Email

| Uso | Servidor | Puerto | Seguridad | Usuario |
|---|---|---:|---|---|
| Entrada IMAP | `mail.privateemail.com` | 993 | SSL/TLS | `ventas@indexelemecsrl.com` |
| Salida SMTP | `mail.privateemail.com` | 465 | SSL/TLS | `ventas@indexelemecsrl.com` |

La contraseña del buzón debe guardarse únicamente como secreto del proveedor correspondiente; nunca debe añadirse al repositorio ni compartirse en conversaciones.

## Configuración de producción

1. Crear o conectar una cuenta de Resend al proyecto de Vercel.
2. Verificar el dominio `indexelemecsrl.com` en Resend mediante los registros SPF y DKIM que entregue el proveedor de DNS. Resend usa el subdominio `send`, por lo que esta configuración puede convivir con el correo entrante de Private Email.
3. Definir estas variables en Production, Preview y Development:

   - `RESEND_API_KEY`
   - `EMAIL_FROM=INDEX CONDO <ventas@indexelemecsrl.com>`
   - `EMAIL_REPLY_TO=ventas@indexelemecsrl.com`
   - `RESEND_WEBHOOK_SECRET`

4. En Resend, registrar el webhook `https://index-one-crm.vercel.app/api/webhooks/resend` y habilitar los eventos de envío, entrega, apertura, demora, rebote, fallo y queja.
5. Ejecutar `supabase/migrations/005_client_communications.sql` y `supabase/migrations/007_proposal_delivery_history.sql` si todavía no están aplicadas.
6. Enviar una prueba a un correo controlado y comprobar en **Comunicaciones** que cambia de `Enviado` a `Entregado` y luego a `Abierto`.

## Alcance actual

- Correos formales desde el módulo de Comunicaciones.
- Propuestas Word o PDF adjuntas desde el módulo de Propuestas.
- Remitente corporativo y respuesta centralizada.
- Historial por cliente, destinatario, propuesta, fecha y estado.
- Webhooks firmados para entrega, apertura, rebote, fallo y queja.

La recepción y lectura de respuestas dentro del CRM requiere una segunda etapa de correo entrante. Mientras se implementa, las respuestas llegan al buzón `ventas@indexelemecsrl.com`.
