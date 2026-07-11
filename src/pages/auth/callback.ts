import type { APIRoute } from 'astro';
import { getServerClient } from '../../lib/supabase';

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/dashboard';

  if (!code) {
    return redirect('/login?error=No+recibimos+el+c%C3%B3digo+de+verificaci%C3%B3n');
  }

  const supabase = getServerClient(cookies);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return redirect(`/login?error=${encodeURIComponent('No+pudimos+verificar+el+link: ' + error.message)}`);
  }

  return redirect(next);
};