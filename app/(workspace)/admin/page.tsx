import { redirect } from 'next/navigation';
import { AdminPage } from '@/components/pages/misc';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function Page() {
  const supabase = createSupabaseServerClient();
  if (!supabase) redirect('/overview');
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
  const { data: admin, error } = await supabase.from('admin_users').select('role').eq('user_id', data.user.id).maybeSingle();
  if (error || admin?.role !== 'admin') redirect('/overview');
  return <AdminPage />;
}
