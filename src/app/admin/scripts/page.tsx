import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/viewer';
import { saveLetterNote } from '@/lib/actions/features';
import { Flash } from '@/components/Flash';

export const metadata: Metadata = { title: 'جداول الحروف' };
const NAMES: Record<string, string> = { safaitic: 'الصفوي', nabataean: 'النبطي', moabite: 'المؤابي' };

export default async function AdminScripts({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; script?: string }> }) {
  await requireStaff();
  const { ok, error, script = 'safaitic' } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from('script_letters').select('id, codepoint, arabic, translit, name, note_ar, sources(citation, url)').eq('script', script in NAMES ? script : 'safaitic').order('position');
  return (
    <main className="page">
      <div className="page-head"><div><h1>جداول الحروف</h1><p>مقابلات الحروف من مصادرها. التعديل هنا يغيّر الملاحظة الظاهرة للزائر ويُسجَّل في سجل التدقيق.</p></div></div>
      <Flash ok={ok} error={error} />
      <p>{Object.entries(NAMES).map(([k, n]) => <a key={k} href={`/admin/scripts?script=${k}`} aria-current={k === script ? 'page' : undefined} style={{ marginInlineEnd: '1rem' }}>{n}</a>)}</p>
      <div className="ledger-wrap"><table className="ledger">
        <thead><tr><th scope="col">العربية</th><th scope="col">النقحرة</th><th scope="col">اسم Unicode</th><th scope="col">المصدر</th><th scope="col">ملاحظة للزائر</th></tr></thead>
        <tbody>{(data ?? []).map((l) => (
          <tr key={l.id}>
            <td>{l.arabic.replaceAll(',', ' ')}</td>
            <td dir="ltr">{l.translit}</td>
            <td dir="ltr"><code>U+{l.codepoint.toString(16).toUpperCase()}</code> {l.name}</td>
            <td>{(l.sources as unknown as { url: string } | null)?.url && <a href={(l.sources as unknown as { url: string }).url} target="_blank" rel="noopener noreferrer">المصدر</a>}</td>
            <td>
              <form action={saveLetterNote.bind(null, l.id)} style={{ display: 'flex', gap: '0.4rem', minWidth: '16rem' }}>
                <label htmlFor={`n-${l.id}`} className="sr-only">ملاحظة</label>
                <input id={`n-${l.id}`} name="note" type="text" defaultValue={l.note_ar ?? ''} maxLength={500} />
                <button className="btn">احفظ</button>
              </form>
            </td>
          </tr>))}
        </tbody>
      </table></div>
    </main>
  );
}
