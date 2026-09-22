# Meta WhatsApp Coexistence — INDEX ONE CRM

## Estado

Diseño iniciado. No modifica producción ni las credenciales WhatsApp actuales.

Documento maestro compartido:
`indexelemec-bot/index-communications/docs/META_WHATSAPP_COEXISTENCE.md`

## Auditoría del CRM actual

El CRM ya tiene integración WhatsApp Cloud API para:

- envío de propuestas;
- mensajes de conversaciones comerciales;
- status sent/delivered/read/failed;
- inbound 1:1;
- media;
- notas de voz con estado de transcripción;
- templates.

Actualmente la configuración se basa en variables de entorno:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_BUSINESS_PHONE_NUMBER_ID`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- `WHATSAPP_GRAPH_VERSION`

El envío real está controlado por:

`WHATSAPP_REAL_SEND_ENABLED`

### Brechas encontradas para Coexistence

1. No existe Embedded Signup.
2. No existe intercambio server-side del authorization code.
3. No existe persistencia por número/WABA de token obtenido por Embedded Signup.
4. El webhook solo normaliza `messages` / `statuses`.
5. No procesa:
   - `history`
   - `smb_app_state_sync`
   - `smb_message_echoes`
   - `account_update`
6. `communications` no distingue explícitamente:
   - API/web;
   - WhatsApp Business App móvil;
   - history import.
7. No existe raw provider archive durable-before-ACK.
8. El CRM puede registrar mensajes del móvil como humanos solo después de implementar
   `smb_message_echoes`.
9. No debe registrar un número con Meta si ese `phone_number_id` ya tiene como transport
   owner a INDEX Communications / Gateway.

## Decisión de arquitectura

No duplicar transporte Meta sin control.

Regla:

> Un `phone_number_id` tiene un único transport owner.

Arquitectura preferida:

```
Meta Cloud API
      ↓
INDEX WhatsApp Gateway
      ↓
 ┌────┴─────┐
IC          CRM
operación   comercial
```

El gateway puede vivir inicialmente dentro de INDEX Communications, pero el contrato debe
ser neutral.

Para un número comercial completamente separado, CRM puede ejecutar el mismo provider
adapter de forma independiente.

## Cambios requeridos en CRM

### Base de datos

Añadir a `communications`:

- `source_channel`
- `source_device`
- `source_phone_number_id`
- `sender_identity_confidence`
- `raw_event_id`

Valores iniciales sugeridos:

`source_channel`
- cloud_api
- whatsapp_business_app
- history_sync

`source_device`
- api
- web
- mobile_or_linked_device
- unknown

### Webhook

Antes de ACK:

1. verificar HMAC;
2. guardar raw event de forma durable;
3. si falla storage → 5xx;
4. si guarda → 200;
5. normalizar async/idempotente.

### Coexistence

Procesar:

- `history`
- `smb_app_state_sync`
- `smb_message_echoes`
- `account_update`

### Human takeover

Un `smb_message_echoes` debe significar:

- un humano respondió desde el número corporativo;
- pausar bot/automatización conversacional;
- registrar la fuente;
- no inventar identidad individual si Meta no la entrega.

## Embedded Signup

El CRM no debe guardar tokens Meta en el navegador.

Flujo:

```
Facebook JS SDK
   ↓ authorization code
CRM/Gateway backend
   ↓ exchange
Meta
   ↓ BISU/system token + WABA/phone
encrypted server storage
```

## Restricción de grupos

Coexistence no sustituye el Group Bridge.

Los grupos operacionales pertenecen al dominio de INDEX Communications y se capturan por
el Group Bridge. El CRM solo consumiría eventos de grupo si una necesidad comercial
explícita lo requiere.

## Piloto

No usar el número comercial actual para el primer ensayo.

Orden:

1. probar Coexistence con número secundario en IC STAGING;
2. validar echo móvil, media, history y lifecycle;
3. estabilizar gateway/provider;
4. replicar en este branch del CRM;
5. probar número comercial secundario;
6. solo después planificar migración del número real.
