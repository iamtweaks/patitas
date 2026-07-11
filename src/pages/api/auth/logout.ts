import type { APIRoute } from 'astro';
import { getServerClient } from '../../../lib/supabase';

export const GET: APIRoute = async ({ cookies, redirect }) => {
  const supabase = getServerClient(cookies);
  await supabase.auth.signOut();
  return redirect('/');
};