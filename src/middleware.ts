import { defineMiddleware } from 'astro:middleware';

// Patitas ahora corre 100% en browser storage, así que la auth vive del lado cliente.
// El middleware no bloquea rutas: la guardia real la hace el frontend con localStorage.
export const onRequest = defineMiddleware(async (_context, next) => next());