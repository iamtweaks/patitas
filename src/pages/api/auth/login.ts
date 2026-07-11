import type { APIRoute } from 'astro';
import { getServerClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const formData = await request.formData();
  const email = String(formData.get('email') ?? '').trim();
  const next = String(formData.get('next') ?? '/dashboard');

  if (!email || !email.includes('@')) {
    return redirect('/login?error=Email+inv%C3%A1lido');
  }

  const supabase = getServerClient(cookies);
  const siteUrl = (import.meta.env.PUBLIC_SITE_URL ?? url.origin).trim().replace(/\/$/, '');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${siteUrl}/login?next=${encodeURIComponent(next)}`
    }
  });

  if (error) {
    return redirect(`/login?error=${encodeURIComponent('Error: ' + error.message)}`);
  }

  return redirect('/login?error=Listo%2C+revis%C3%A1+tu+email+%28puede+tardar+1+minuto%29');
};