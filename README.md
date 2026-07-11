# Patitas

App de gestión para peluquería y baño canino. Astro SSR + React islands + Supabase (Postgres + Auth) + Vercel.

## Stack
- Astro 5 con `output: 'server'` (SSR) + Node adapter standalone
- React islands (formularios interactivos)
- Supabase Postgres + Auth (magic link email)
- TypeScript end-to-end
- Deployed on Vercel

## Modelo de datos
3 tablas, todas con `user_id` foreign key a `auth.users` + RLS:

- `patitas_clientes` — dueños de los perros (nombre, tel, email, notas)
- `patitas_perros` — mascotas (FK a cliente, raza, tamaño, peso, fecha nac, notas)
- `patitas_servicios` — visitas (FK a perro, fecha, tipo baño/corte/completo/otro, precio, notas)

Las migraciones viven en `supabase/migrations/`.

## Páginas

- `/` — landing pública
- `/login` — magic link via Supabase
- `/dashboard` — KPIs (ganancia mes/total, clientes, perros), gráficos 30 días + 6 meses, top perros y razas
- `/dashboard/clientes` — CRUD
- `/dashboard/perros` — CRUD
- `/dashboard/servicios` — CRUD + historial

## Paleta Canagua Forest
- Pine `#1f3a2e` (fondo) + Pine Deep `#14241c`
- Bone `#f5efe6` (texto)
- Sage `#7ba07a`, Forest `#2d5a3f`, Amber `#d98e3e`, Coral `#c75d4f`, Bark `#6b4f3a`

## Local
```bash
npm install
cp .env.example .env  # y completar
npx astro build
HOST=0.0.0.0 PORT=4323 node ./dist/server/entry.mjs
```

## Auth
Supabase magic-link. Cualquier email puede loguearse — la primera vez crea un user nuevo automáticamente.

## Deploy
Vercel con `vercel.json` o directamente desde GitHub (auto-detecta Astro).
Necesita env vars: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`.

## Seguridad
- RLS activo en las 3 tablas — cada user solo ve sus datos
- Middleware valida auth en `/dashboard/*` y redirige a `/login`
- Logout limpia sesión de Supabase

## Lo que NO está (todavía)
- Foto de perros
- Edición de perros/servicios (solo crear/borrar)
- Export CSV
- Categorías de servicio configurables
- Historial por perro (vista detalle)
- Recordatorios automáticos
- Multi-tenant / teams