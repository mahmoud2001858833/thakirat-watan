'use client';
import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ZoomStage, type ZoomImage } from '@/components/archive/ZoomStage';
import type { View } from '@/components/archive/usePanZoom';
import { play } from '@/lib/client/sound';
import s from './compare.module.css';

export type Side = { id: string; title: string; credit: string; sourceUrl: string | null; img: ZoomImage; facts: [string, string][] };
type Opt = { id: string; title: string; place: string };

export function CompareView({ a, b, options }: { a: Side | null; b: Side | null; options: Opt[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [linked, setLinked] = useState(true);
  const [syncA, setSyncA] = useState<View | null>(null);
  const [syncB, setSyncB] = useState<View | null>(null);
  // التزامن بنسبة التكبير وموضع المركز نسبياً، لأن الصورتين بأبعاد مختلفة
  const relay = useCallback((to: 'a' | 'b') => (v: View) => { if (linked) (to === 'a' ? setSyncA : setSyncB)({ ...v }); }, [linked]);
  const choose = (which: 'a' | 'b', id: string) => {
    const q = new URLSearchParams(sp.toString()); q.set(which, id);
    if (which === 'a' && !q.get('b') && b) q.set('b', b.id);
    if (which === 'b' && !q.get('a') && a) q.set('a', a.id);
    play('tap'); router.replace(`/archive/compare?${q}`, { scroll: false });
  };
  const swap = () => { if (a && b) { play('tap'); router.replace(`/archive/compare?a=${b.id}&b=${a.id}`, { scroll: false }); } };
  const random = (which: 'a' | 'b') => {
    const pool = options.filter((o) => o.id !== a?.id && o.id !== b?.id);
    if (pool.length) choose(which, pool[Math.floor(Math.random() * pool.length)].id);
  };

  return (
    <div className={s.wrap}>
      <div className={s.bar}>
        <label className={s.link}>
          <input type="checkbox" checked={linked} onChange={(e) => setLinked(e.target.checked)} data-testid="link-zoom" />
          <span>كبّر وحرّك الصورتين معاً</span>
        </label>
        <button type="button" className="btn" onClick={swap}>بدّل الجانبين ⇄</button>
      </div>
      <div className={s.pair}>
        {([['a', a, syncA, 'b'], ['b', b, syncB, 'a']] as const).map(([k, side, sync, other]) => (
          <section key={k} className={s.side} aria-label={k === 'a' ? 'المادة الأولى' : 'المادة الثانية'}>
            <div className={s.pick}>
              <label htmlFor={`pick-${k}`} className="sr-only">اختر مادة</label>
              <select id={`pick-${k}`} value={side?.id ?? ''} onChange={(e) => choose(k, e.target.value)}>
                {options.map((o) => <option key={o.id} value={o.id}>{o.title}{o.place ? ` — ${o.place}` : ''}</option>)}
              </select>
              <button type="button" className={`btn btn-quiet ${s.dice}`} onClick={() => random(k)} aria-label="مادة عشوائية لهذا الجانب">🎲</button>
            </div>
            {side ? (
              <>
                <ZoomStage key={side.id} img={side.img} label={side.title} className={s.stage} light sync={sync}
                  onView={relay(other)} />
                <h2 className={s.title}><Link href={`/archive/${side.id}`}>{side.title}</Link></h2>
                <dl className={s.facts}>
                  {side.facts.map(([dt, dd]) => <div key={dt}><dt>{dt}</dt><dd>{dd}</dd></div>)}
                </dl>
                <p className={s.credit}>الصورة: <bdi>{side.credit}</bdi>{side.sourceUrl && <> · <a href={side.sourceUrl} target="_blank" rel="noopener noreferrer">المصدر</a></>}</p>
              </>
            ) : <p>لا توجد صورة لهذه المادة.</p>}
          </section>
        ))}
      </div>
    </div>
  );
}
