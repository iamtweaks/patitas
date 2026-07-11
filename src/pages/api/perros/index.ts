import type { APIRoute } from 'astro';
import { getServerClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const data = {
    cliente_id: String(formData.get('cliente_id') ?? ''),
    nombre: String(formData.get('nombre') ?? '').trim(),
    raza: String(formData.get('raza') ?? '').trim(),
    tamanio: String(formData.get('tamanio') ?? '') || null,
    peso_kg: formData.get('peso_kg') ? Number(formData.get('peso_kg')) : null,
    fecha_nacimiento: String(formData.get('fecha_nacimiento') ?? '') || null,
    notas: String(formData.get('notas') ?? '').trim() || null
  };

  if (!data.cliente_id || !data.nombre || !data.raza) {
    return redirect('/dashboard/perros?error=datos+requeridos');
  }

  const supabase = getServerClient(cookies);
  const { error } = await supabase.from('patitas_perros').insert(data);
  if (error) return redirect(`/dashboard/perros?error=${encodeURIComponent(error.message)}`);
  return redirect('/dashboard/perros');
};