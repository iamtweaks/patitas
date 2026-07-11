import type { APIRoute } from 'astro';
import { getServerClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const data = {
    perro_id: String(formData.get('perro_id') ?? ''),
    fecha: String(formData.get('fecha') ?? ''),
    tipo: String(formData.get('tipo') ?? 'otro') as 'bano' | 'corte' | 'bano_y_corte' | 'otro',
    precio: Number(formData.get('precio') ?? 0),
    notas: String(formData.get('notas') ?? '').trim() || null
  };

  if (!data.perro_id || !data.fecha || data.precio < 0) {
    return redirect('/dashboard/servicios?error=datos+incompletos');
  }

  const supabase = getServerClient(cookies);
  const { error } = await supabase.from('patitas_servicios').insert(data);
  if (error) return redirect(`/dashboard/servicios?error=${encodeURIComponent(error.message)}`);
  return redirect('/dashboard/servicios');
};