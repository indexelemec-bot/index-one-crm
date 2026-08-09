# Instrucciones para Codex — INDEX ONE CRM

## Objetivo
Construir un CRM web B2B para vender soluciones integrales de administración condominial de Index Condo. No es un CRM para implementar sistemas.

## Principios obligatorios
1. Mantener el UX/UI aprobado en la demo v0.1: corporativo, limpio, azul/naranja, responsive.
2. La cuenta comercial es el condominio, torre, residencial, constructora o proyecto; una cuenta puede tener varios stakeholders.
3. El embudo representa venta consultiva de soluciones: problema, diagnóstico, solución, presentación, propuesta, negociación, aprobación, contrato/transición y cliente activo.
4. Toda oportunidad activa debe tener próxima acción, responsable y fecha.
5. Los ejecutivos solo ven sus oportunidades; gerencia y superadmin ven todas.
6. El superadmin puede activar/desactivar usuarios de inmediato.
7. El generador de propuestas usa `public/templates/propuesta-index-condo-2026.docx` como plantilla corporativa bloqueada. No rediseñar ni cambiar textos, colores, tipografías o estructura.
8. Al generar propuesta, cambiar únicamente: nombre del cliente, fecha, honorarios mensuales y referencias comerciales.
9. Las referencias se seleccionan por similitud: tipo/perfil de cliente y cantidad cercana de unidades. Priorizar referencias aprobadas y comparables.
10. Registrar versiones, envío, estado, vencimiento y seguimiento de cada propuesta.

## Primer PR solicitado
- Configurar Next.js 15 + TypeScript.
- Crear cliente Supabase SSR y variables de entorno de ejemplo.
- Implementar autenticación y protección de rutas.
- Implementar perfiles/roles y políticas RLS.
- CRUD de cuentas, stakeholders y oportunidades.
- Dashboard inicial y embudo Kanban.
- Validaciones Zod y manejo de errores.
- Pruebas mínimas de permisos y creación de oportunidad.

## Criterios de aceptación
- `npm run build` termina sin errores.
- Un superadmin puede crear/desactivar usuarios.
- Un ejecutivo solo ve oportunidades asignadas.
- Se puede crear una cuenta con al menos un stakeholder y una oportunidad.
- No se puede dejar una oportunidad activa sin próxima acción.
- El Kanban usa las etapas B2B definidas.
