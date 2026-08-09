# INDEX ONE CRM

CRM B2B para vender soluciones integrales de administración de condominios de Index Condo.

## Versión revisable v0.3

- Acceso demostrativo y arquitectura de autenticación Supabase SSR.
- Dashboard comercial con embudo, forecast y próximas acciones.
- Cuentas B2B, stakeholders, decisores y expedientes.
- Embudo Kanban de venta consultiva orientado a diagnóstico y solución.
- Tareas con resultado y próxima acción obligatoria.
- Usuarios, roles y visualización por cartera.
- Propuestas generadas desde la plantilla corporativa 2026 sin rediseñarla.
- Selección automática de referencias por tipo, perfil y unidades comparables.
- Persistencia local para revisión inmediata y esquema PostgreSQL/RLS para producción.

## Inicio local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000` y usa:

- Correo: `admin@indexelemecsrl.com`
- Contraseña: `Index2026!`

Sin variables de entorno, la aplicación funciona en modo demostrativo y guarda los cambios en el navegador. Para activar Supabase, copia `.env.example` a `.env.local`, completa las variables y ejecuta la migración `supabase/migrations/001_initial_schema.sql`.

## Validación

```bash
npm test
npm run lint
npm run build
```

El contrato técnico de la plantilla corporativa se encuentra en `docs/PROPOSAL_TEMPLATE_CONTRACT.md`.
