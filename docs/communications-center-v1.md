# INDEX ONE — Centro de Comunicaciones v1

## Objetivo
Centralizar correo y WhatsApp dentro del CRM usando un único número corporativo, múltiples agentes internos, trazabilidad por cliente/stakeholder, documentos, mensajes programados y seguimiento comercial.

## Principios
1. El cliente conversa siempre con la identidad corporativa de INDEX CONDO.
2. Cada mensaje saliente registra qué agente de INDEX lo escribió.
3. El nombre del agente se presenta al cliente dentro del contenido del mensaje (por ejemplo: `Sidney Cuevas | INDEX CONDO`) y cambia automáticamente cuando cambia el agente asignado.
4. El encabezado nativo de WhatsApp continúa correspondiendo al perfil/número comercial; el CRM no intenta suplantar identidades individuales.
5. Las conversaciones quedan asociadas al stakeholder y a la oportunidad, no solo al condominio.
6. Los mensajes entrantes se incorporan por webhook y se convierten en parte del histórico comercial.
7. Toda prueba se realiza fuera de `main` y contra una base de datos de staging antes de publicar.

## UI propuesta
### Comunicaciones
Tabs: `Correo`, `WhatsApp`, `Programados`.

### WhatsApp
- Columna izquierda: conversaciones, búsqueda, no leídos, agente asignado, filtros.
- Centro: chat, respuesta, documentos, plantillas, speeches, notas internas, programar mensaje.
- Panel derecho: cuenta, stakeholder, cargo, etapa, honorarios, tareas, propuesta y próximos pasos.

## Identificación visible del agente
La Cloud API envía desde el número corporativo. Para que el cliente sepa quién lo atiende, INDEX ONE añadirá una firma automática en el primer mensaje del agente y cuando cambie la asignación:

`Hola, soy Sidney Cuevas del equipo comercial de INDEX CONDO. A partir de este momento estaré dando seguimiento a su proceso.`

Los mensajes posteriores pueden usar una firma compacta configurable:

`— Sidney | INDEX CONDO`

Internamente cada mensaje conserva `agent_id` y `agent_name_snapshot` para auditoría incluso si el usuario se archiva o cambia de nombre.

## Flujo de conversación
1. WhatsApp entrante llega al webhook.
2. Se identifica el stakeholder por número.
3. Se localiza o crea el hilo WhatsApp asociado a su oportunidad.
4. Se asigna al ejecutivo responsable o queda `Sin asignar`.
5. Se incrementa el contador de no leídos.
6. El agente responde desde INDEX ONE.
7. La respuesta se guarda con agente, hora, estado y proveedor.
8. Estados enviado/entregado/leído/fallido actualizan el mismo registro.

## Mensajes programados
Cada mensaje programado tendrá:
- cliente/stakeholder;
- fecha y hora;
- texto o plantilla;
- archivo opcional;
- responsable;
- recurrencia opcional en meses;
- estado y error de ejecución.

## Documentos
La bandeja podrá adjuntar:
- propuestas;
- contratos;
- presentaciones;
- casos de éxito;
- PDF/Word/imágenes;
- documentos cargados al expediente.

## Permisos iniciales
- Ejecutivo: conversaciones de su cartera.
- Gerencia comercial: todas las conversaciones comerciales y reasignación.
- Superadministrador: acceso total y configuración.
- Consulta: lectura solamente.
- Administración: sin envío comercial por defecto.

## Estrategia de pruebas sin afectar producción
### Código
Branch GitHub: `feat/communications-center-whatsapp`.
No se fusionará a `main` hasta aprobación del usuario.

### Frontend
Vercel Preview Deployment generado desde la rama de feature.

### Datos
Proyecto Supabase staging separado con Project Ref `ecexjlgozrqqdmqukhyl`.
El Preview de Vercel usa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` exclusivos para Preview.
Nunca conectar el Preview a la base de producción para pruebas de escritura.

### WhatsApp
Mientras se construye la UI se utilizará modo simulación/test. La conexión con el número corporativo real se habilita únicamente después de validar:
- recepción webhook;
- asignación de agentes;
- envío de texto;
- documentos;
- plantillas;
- mensajes programados;
- permisos;
- histórico por cliente.

## Criterio para publicar
Solo se fusiona a `main` cuando:
1. pruebas funcionales pasen en Preview;
2. no existan errores de runtime relevantes;
3. RLS/seguridad sea validada;
4. usuarios de prueba no puedan acceder a carteras no autorizadas;
5. usuario apruebe visualmente la bandeja;
6. envío/recepción con número de prueba sea satisfactorio.
