import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/viewer';
import { createClient } from '@/lib/supabase/server';
import { setSetting } from '@/lib/actions/admin';
import { Flash } from '@/components/Flash';

export const metadata: Metadata = { title: 'الإعدادات' };

export default async function Settings({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireAdmin();
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from('settings').select('key, value').eq('key', 'assistant.enabled').single();
  const on = data?.value === true;
  return (
    <main className="page">
      <div className="page-head"><div><h1>الإعدادات</h1><p>كل تغيير هنا يُسجَّل في سجل التدقيق.</p></div></div>
      <Flash ok={ok} error={error} />
      <section style={{ maxWidth: '40rem', borderTop: '1px solid var(--ink)', paddingTop: 'var(--space-4)' }} aria-labelledby="asst">
        <h2 id="asst" style={{ fontSize: 'var(--step-2)' }}>مساعد «اسأل الأرشيف»</h2>
        <p>يجيب من المواد المنشورة فقط ويذكر مصادره. الحالة الآن: <strong>{on ? 'يعمل' : 'متوقف'}</strong>.</p>
        <form action={setSetting}>
          <input type="hidden" name="key" value="assistant.enabled" />
          <input type="hidden" name="value" value={on ? 'false' : 'true'} />
          <button className={`btn ${on ? 'btn-danger' : 'btn-primary'}`}>{on ? 'أوقف المساعد' : 'شغّل المساعد'}</button>
        </form>
      </section>
    </main>
  );
}
