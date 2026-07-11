import { defineMiddleware } from 'astro:middleware';
import { createClient } from '@supabase/supabase-js';

const PUBLIC_PATHS = ['/', '/login'];
const PUBLIC_PREFIXES = ['/api/auth/', '/auth/callback'];

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;

  // Always allow public paths and assets
  if (
    PUBLIC_PATHS.includes(path) ||
    PUBLIC_PREFIXES.some(p => path.startsWith(p)) ||
    path.startsWith('/_astro/') ||
    path.startsWith('/favicon')
  ) {
    return next();
  }

  // Everything under /dashboard requires auth
  if (path.startsWith('/dashboard')) {
    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return Object.entries(context.cookies.getAll()).map(([name, value]) => ({
              name,
              value: value.value
            }));
          },
          setAll(cookiesToSet) {
            for (const { name, value, options } of cookiesToSet) {
              context.cookies.set(name, value, options);
            }
          }
        }
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return context.redirect('/login?next=' + encodeURIComponent(path), 302);
    }

    context.locals.user = user;
  }

  return next();
});