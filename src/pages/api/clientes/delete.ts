import type { APIRoute } from 'astro';
import { getServerClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const id = formData.get('id');
  if (!id) return redirect('/dashboard/clientes');

  const supabase = getServerClient(cookies);
  // Cascada: borra perros del cliente y servicios de esos perros via FK
  await supabase.from('patitas_perros').delete().eq('cliente_id', String(id));
  await supabase.from('patitas_clientes').delete().eq('id', String(id));

  return redirect('/dashboard/clientes');
};