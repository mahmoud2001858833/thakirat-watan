import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireViewer } from '@/lib/viewer';
import { createClient } from '@/lib/supabase/server';
import { fmtNumber } from '@/i18n';
import { mediaSrc } from '@/lib/media';
import { claimGrand, proposeTwin, respondTwin, setTwinOpen } from '@/lib/actions/classroom';
import { Roster } from './Roster';
import { LiveBuilder } from './LiveBuilder';
import s from '@/components/classroom/ui.module.css';

export const metadata: Metadata = { title: 'إدارة الصف' };

type Twin = { id: string; status: string; mine: string; theirs: string; their_school: string; their_gov: string; can_accept: boolean; approved: number };

export default async function ClassPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const v = await requireViewer(`/teach/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const { data: cls } = await supabase.from('classes').select('id, name, grade, teacher_id, open_for_twinning, schools(name, places(name_ar, key))').eq('id', id).maybeSingle();
  if (!cls || cls.teacher_id !== v.id) notFound();
  const [{ data: members }, { data: twins }, { data: dir }, { data: pending }, { data: claim }, { data: items }, { data: sessions }, { data: grand }] = await Promise.all([
    supabase.from('class_members').select('id, pseudonym, login, joined_at').eq('class_id', id).order('joined_at'),
    supabase.rpc('my_twinnings'),
    cls.open_for_twinning ? supabase.rpc('twin_directory') : Promise.resolve({ data: [] }),
    supabase.from('twin_messages').select('id, twinning_id').eq('from_class', id).eq('status', 'pending'),
    supabase.from('grand_claims').select('section_id').eq('class_id', id).maybeSingle(),
    supabase.from('items').select('id, title_ar, item_media(storage_path, external_url)').eq('status', 'published').eq('is_event', false).limit(60),
    supabase.from('live_sessions').select('id, title, code, status, created_at').eq('class_id', id).order('created_at', { ascending: false }).limit(5),
    supabase.from('grand_mosaics').select('slug, title_ar, is_demo').eq('published', true).order('created_at'),
  ]);
  const myTwins = ((twins ?? []) as Twin[]).filter((t) => t.mine === id);
  const school = cls.schools as unknown as { name: string; places: { name_ar: string; key: string } | null } | null;
  const pics = (items ?? []).map((it) => {
    const m = (it.item_media as unknown as { storage_path: string | null; external_url: string | null }[])[0];
    return m ? { id: it.id, title: it.title_ar, src: mediaSrc(m) } : null;
  }).filter((x): x is { id: string; title: string; src: string } => !!x && x.src.startsWith('/media/'));
  const pendingByTwin = new Map<string, number>();
  (pending ?? []).forEach((p) => pendingByTwin.set(p.twinning_id, (pendingByTwin.get(p.twinning_id) ?? 0) + 1));

  return (
    <main className={s.page}>
      <p className={s.crumb}><Link href="/teach">صفوفي</Link> / {cls.name}</p>
      <header className={s.head}>
        <p className={s.kicker}>{school?.name}{school?.places && ` · ${school.places.name_ar}`}</p>
        <h1>{cls.name}</h1>
        <p className={s.lede}>{fmtNumber(members?.length ?? 0)} طالباً بأسماء مستعارة{pending?.length ? ` · ${fmtNumber(pending.length)} رسالة تنتظر مراجعتك` : ''}.</p>
      </header>
      {ok === 'proposed' && <p role="status" className="notice notice-ok">أرسلت طلب التوأمة. يصبح فعالاً حين يقبله معلم الصف الآخر.</p>}
      {error === 'samegov' && <p role="alert" className="notice notice-error">التوأمة مع صف من محافظة أخرى فقط.</p>}
      {error === 'twin' && <p role="alert" className="notice notice-error">تعذّر طلب التوأمة. ربما يوجد طلب قائم مع هذا الصف.</p>}
      {error === 'grand' && <p role="alert" className="notice notice-error">تعذّر تبنّي جزء. ربما امتلأت اللوحة.</p>}

      <section id="students" className={s.section} aria-labelledby="st-h">
        <h2 id="st-h"><span className={s.num}>١</span> الطلاب</h2>
        <Roster classId={id} members={(members ?? []).map((m) => ({ id: m.id, pseudonym: m.pseudonym, login: m.login }))} />
      </section>

      <section id="twin" className={s.section} aria-labelledby="tw-h">
        <h2 id="tw-h"><span className={s.num}>٢</span> توأمة المدارس</h2>
        <p className={s.note}>يتبادل صفك مع صف من محافظة بعيدة «صندوق رسائل»: أسئلة عن بلدتكم وأجوبة بالصور والتسجيلات. كل رسالة يكتبها طالبك تمر بك أولاً.</p>
        {myTwins.length > 0 && (
          <ul className={s.list} style={{ marginTop: 'var(--space-5)' }}>
            {myTwins.map((t) => (
              <li key={t.id}>
                <div>
                  <span className={s.itemTitle}>{t.their_school}</span>
                  <p className={s.itemMeta} style={{ margin: 0 }}>{t.their_gov} · {t.status === 'active' ? `${fmtNumber(t.approved)} رسالة معتمدة` : 'بانتظار القبول'}{pendingByTwin.get(t.id) ? ` · ${fmtNumber(pendingByTwin.get(t.id)!)} تنتظر مراجعتك` : ''}</p>
                </div>
                <div className={s.row}>
                  {t.can_accept && <form action={respondTwin.bind(null, id, t.id, true)}><button className="btn btn-primary">اقبل التوأمة</button></form>}
                  {t.status === 'active' && <Link className="btn btn-primary" href={`/twin/${t.id}`}>صندوق الرسائل</Link>}
                  <form action={respondTwin.bind(null, id, t.id, false)}><button className="btn btn-quiet">{t.status === 'active' ? 'أنهِ التوأمة' : 'ألغِ'}</button></form>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className={s.panel} style={{ marginTop: 'var(--space-5)' }}>
          <form action={setTwinOpen.bind(null, id, !cls.open_for_twinning)} className={s.row}>
            <span>{cls.open_for_twinning ? 'صفك ظاهر لمعلمي المحافظات الأخرى ليطلبوا التوأمة.' : 'صفك غير ظاهر في دليل التوأمة.'}</span>
            <button className="btn">{cls.open_for_twinning ? 'أخفِ صفي من الدليل' : 'افتح صفي للتوأمة'}</button>
          </form>
          {cls.open_for_twinning && (
            <>
              <h3 style={{ fontSize: 'var(--step-1)', marginTop: 'var(--space-5)' }}>صفوف تنتظر توأماً</h3>
              {!(dir ?? []).length ? <p className={s.itemMeta}>لا صفوف مفتوحة الآن في محافظات أخرى.</p> : (
                <ul className={s.list}>
                  {(dir as { class_id: string; class_name: string; grade: number | null; school: string; governorate: string; gov_key: string }[])
                    .filter((d) => d.gov_key !== school?.places?.key).map((d) => (
                    <li key={d.class_id}>
                      <div><span className={s.itemTitle}>{d.school}</span><p className={s.itemMeta} style={{ margin: 0 }}>{d.governorate}{d.grade ? ` · الصف ${fmtNumber(d.grade)}` : ''}</p></div>
                      <form action={proposeTwin.bind(null, id, d.class_id)}><button className="btn">اطلب التوأمة</button></form>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </section>

      <section id="live" className={s.section} aria-labelledby="lv-h">
        <h2 id="lv-h"><span className={s.num}>٣</span> الجلسة المباشرة</h2>
        <p className={s.note}>افتح جلسة على شاشة الصف، ويدخلها طلابك من جوالاتهم برمز من ستة أرقام. يصوّتون ويجيبون ويضعون إشارات على صورة من الأرشيف، والنتائج تظهر أمام الصف مباشرة. النصوص لا تظهر قبل أن توافق عليها.</p>
        {!!sessions?.length && (
          <ul className={s.list} style={{ margin: 'var(--space-4) 0' }}>
            {sessions.map((l) => (
              <li key={l.id}><span>{l.title} <span className={`${s.pill} ${l.status === 'open' ? s.pillOk : ''}`}>{l.status === 'open' ? `مفتوحة · ${l.code}` : 'انتهت'}</span></span>
                {l.status === 'open' && <Link className="btn" href={`/live/${l.id}`}>عُد إلى الجلسة</Link>}</li>
            ))}
          </ul>
        )}
        <LiveBuilder classId={id} pictures={pics} />
      </section>

      <section id="grand" className={s.section} aria-labelledby="gr-h">
        <h2 id="gr-h"><span className={s.num}>٤</span> الفسيفساء الكبرى</h2>
        <p className={s.note}>لوحة فسيفساء واحدة كبيرة لكل مدارس الأردن. يتبنى صفك جزءاً منها، ويرمّمه طلابك معاً في الوقت نفسه، كلٌّ من جهازه. حين تكتمل الأجزاء كلها تظهر اللوحة كاملة، وعلى كل جزء اسم مدرسته.</p>
        {claim ? <Link className="btn btn-primary" href={`/grand/${claim.section_id}`}>افتح جزء صفك</Link> : (
          <div className={s.row}>
            {(grand ?? []).map((g) => (
              <form key={g.slug} action={claimGrand.bind(null, id, g.slug)}><button className="btn btn-primary">تبنَّ جزءاً من «{g.title_ar}»{g.is_demo ? ' (تجريبي)' : ''}</button></form>
            ))}
          </div>
        )}
        <p><Link href="/grand">شاهد اللوحة كاملة</Link></p>
      </section>
    </main>
  );
}
