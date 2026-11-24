import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/app-shell';

export default async function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = createSupabaseServerClient();
  if (!supabase) redirect('/login?error=configuration');
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect('/login');
  return <AppShell email={data.user.email ?? ''}>{children}</AppShell>;
}
