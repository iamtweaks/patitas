import type { APIRoute } from 'astro';
import { getServerClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const id = formData.get('id');

  const data = {
    nombre: String(formData.get('nombre') ?? '').trim(),
    telefono: String(formData.get('telefono') ?? '').trim() || null,
    email: String(formData.get('email') ?? '').trim() || null,
    notas: String(formData.get('notas') ?? '').trim() || null
  };

  if (!data.nombre) {
    return redirect('/dashboard/clientes?error=nombre+requerido');
  }

  const supabase = getServerClient(cookies);
  let error;
  if (id) {
    ({ error } = await supabase.from('patitas_clientes').update(data).eq('id', String(id)));
  } else {
    ({ error } = await supabase.from('patitas_clientes').insert(data));
  }

  if (error) {
    return redirect(`/dashboard/clientes?error=${encodeURIComponent(error.message)}`);
  }
  return redirect('/dashboard/clientes');
};