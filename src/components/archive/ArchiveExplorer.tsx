'use client';
import { useMemo, useRef, useState, ViewTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getDict } from '@/i18n';
import { TrustBadge, DemoTag } from '@/components/TrustBadge';
import { play, buzz } from '@/lib/client/sound';
import s from './explorer.module.css';
import w from './archive.module.css';

export type ExItem = {
  id: string; title: string; kind: string; trust: 'official_document' | 'personal_testimony' | 'circulated_account' | 'under_review';
  is_demo: boolean; place: string | null; when: string | null; year: number | null; period: string | null;
  img: { src: string; w: number; h: number; alt: string; blur: string | null } | null;
};
export type Era = { key: string; name: string; start: number; end: number };

const ar = (n: number) => new Intl.NumberFormat('ar-JO-u-nu-arab').format(n);

/** موضع المادة على الشريط: كل عصر مقطع بعرض واحد، والمقطع الأخير لغير المؤرخ */
function position(it: ExItem, eras: Era[]) {
  if (it.year != null) {
    // أحدث عصر يحتوي السنة (العصور تتداخل أحياناً)
    let idx = -1;
    eras.forEach((e, i) => { if (it.year! >= e.start && it.year! < e.end) idx = i; });
    if (idx === -1) idx = it.year < eras[0].start ? 0 : eras.findIndex((e) => it.year! < e.start) - 1;
    if (idx < 0) idx = eras.length - 1;
    const e = eras[idx]; const f = Math.min(0.96, Math.max(0.04, (it.year - e.start) / Math.max(1, e.end - e.start)));
    return idx + f;
  }
  const i = eras.findIndex((e) => e.key === it.period);
  return i >= 0 ? i + 0.5 : eras.length + 0.5;
}

export function ArchiveExplorer({ items, eras }: { items: ExItem[]; eras: Era[] }) {
  const t = getDict();
  const router = useRouter();
  const segs = eras.length + 1;
  const pos = useMemo(() => new Map(items.map((it) => [it.id, position(it, eras)])), [items, eras]);
  const [range, setRange] = useState<[number, number]>([0, segs]);
  const [picked, setPicked] = useState<string[]>([]);
  const [rolling, setRolling] = useState<string | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: 'lo' | 'hi' | 'mid'; start: number; r: [number, number] } | null>(null);
  const lastSeg = useRef(-1);

  const shown = items.filter((it) => { const p = pos.get(it.id)!; return p >= range[0] && p <= range[1]; });
  const full = range[0] <= 0 && range[1] >= segs;

  // في الواجهة العربية الزمن يسير من اليمين (الأقدم) إلى اليسار
  const toUnits = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return Math.min(segs, Math.max(0, ((r.right - clientX) / r.width) * segs));
  };
  const apply = (r: [number, number]) => {
    const seg = Math.floor((r[0] + r[1]) / 2);
    if (seg !== lastSeg.current) { lastSeg.current = seg; play('wheel'); }
    setRange(r);
  };
  const onDown = (mode: 'lo' | 'hi' | 'mid', e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { mode, start: toUnits(e.clientX), r: [...range] as [number, number] };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const u = toUnits(e.clientX), dx = u - d.start, minW = 0.6;
    if (d.mode === 'lo') apply([Math.min(u, d.r[1] - minW), d.r[1]]);
    else if (d.mode === 'hi') apply([d.r[0], Math.max(u, d.r[0] + minW)]);
    else { const wdt = d.r[1] - d.r[0]; const lo = Math.min(segs - wdt, Math.max(0, d.r[0] + dx)); apply([lo, lo + wdt]); }
  };
  const onUp = () => { drag.current = null; };
  // لمس الشريط: تتحرك النافذة إلى العصر الملموس
  const onTrack = (e: React.PointerEvent) => {
    if (drag.current) return;
    const u = toUnits(e.clientX), seg = Math.min(segs - 1, Math.floor(u));
    const wdt = full ? 1 : range[1] - range[0];
    const lo = Math.min(segs - wdt, Math.max(0, seg + 0.5 - wdt / 2));
    apply([lo, lo + wdt]); buzz(8);
  };
  const keys = (which: 'lo' | 'hi' | 'mid', e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 1 : 0.25;
    const dir = e.key === 'ArrowLeft' ? 1 : e.key === 'ArrowRight' ? -1 : 0; // اليسار = أحدث
    if (e.key === 'Home') { e.preventDefault(); apply([0, segs]); return; }
    if (!dir) return;
    e.preventDefault();
    const [lo, hi] = range;
    if (which === 'lo') apply([Math.min(hi - 0.6, Math.max(0, lo + dir * step)), hi]);
    else if (which === 'hi') apply([lo, Math.max(lo + 0.6, Math.min(segs, hi + dir * step))]);
    else { const wdt = hi - lo; const n = Math.min(segs - wdt, Math.max(0, lo + dir * step)); apply([n, n + wdt]); }
  };
  const label = (u: number) => {
    const i = Math.min(segs - 1, Math.floor(u));
    return i >= eras.length ? 'غير مؤرخ بعد' : eras[i].name;
  };

  const togglePick = (id: string) => {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p.slice(-1), id]));
    play('tap');
  };

  function surprise() {
    const pool = (shown.length ? shown : items).filter((x) => x.img);
    if (!pool.length) return;
    play('chime'); buzz([10, 40, 10]);
    // ومضات قصيرة على الجدار قبل الذهاب إلى المادة
    let n = 0;
    // eslint-disable-next-line react-hooks/purity -- يُستدعى من زر فقط
    const final = pool[Math.floor(Math.random() * pool.length)];
    const flick = () => {
      n++;
      if (n < 7) { setRolling(pool[Math.floor(Math.random() * pool.length)].id); play('wheel'); setTimeout(flick, 70 + n * 18); }
      else { setRolling(final.id); setTimeout(() => router.push(`/archive/${final.id}`), 260); }
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) router.push(`/archive/${final.id}`); else flick();
  }

  const pct = (u: number) => `${(u / segs) * 100}%`;
  return (
    <div className={s.explorer}>
      <section className={s.timeline} aria-labelledby="tl-h">
        <div className={s.tlHead}>
          <h2 id="tl-h" className={s.tlTitle}>الشريط الزمني</h2>
          <p className={s.tlNow} aria-live="polite" data-testid="tl-range">
            {full ? `كل العصور · ${ar(items.length)} مادة` : `${label(range[0])} ← ${label(range[1] - 0.001)} · ${ar(shown.length)} مادة`}
          </p>
          <div className={s.tlActions}>
            {!full && <button type="button" className="btn btn-quiet" onClick={() => { apply([0, segs]); }}>كل العصور</button>}
            <button type="button" className={`btn btn-accent ${s.surprise}`} onClick={surprise} data-testid="surprise">
              <span aria-hidden="true" className={s.die}>✦</span> فاجئني
            </button>
          </div>
        </div>
        <div className={s.trackWrap}>
          <div ref={track} className={s.track} onPointerDown={onTrack} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} data-testid="timeline">
            {Array.from({ length: segs }, (_, i) => (
              <div key={i} className={`${s.seg} ${i >= eras.length ? s.segUndated : ''}`} style={{ insetInlineStart: pct(i), width: pct(1) }}>
                <span className={s.segName}>{i < eras.length ? eras[i].name.replace(/\s*\(.*\)/, '') : 'غير مؤرخ'}</span>
              </div>
            ))}
            {items.map((it) => {
              const p = pos.get(it.id)!; const on = p >= range[0] && p <= range[1];
              return <span key={it.id} className={`${s.dot} ${on ? s.dotOn : ''}`} style={{ insetInlineStart: pct(p) }} aria-hidden="true" />;
            })}
            <div className={s.lens} style={{ insetInlineStart: pct(range[0]), width: pct(range[1] - range[0]) }}
              onPointerDown={(e) => onDown('mid', e)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} data-testid="lens" aria-hidden="true" />
            <span className={s.handle} style={{ insetInlineStart: pct(range[0]) }} onPointerDown={(e) => onDown('lo', e)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
              role="slider" tabIndex={0} aria-label="بداية النافذة (الأقدم)" aria-valuemin={0} aria-valuemax={segs} aria-valuenow={Math.round(range[0] * 100) / 100}
              aria-valuetext={label(range[0])} onKeyDown={(e) => keys(e.shiftKey && e.altKey ? 'mid' : 'lo', e)} />
            <span className={s.handle} style={{ insetInlineStart: pct(range[1]) }} onPointerDown={(e) => onDown('hi', e)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
              role="slider" tabIndex={0} aria-label="نهاية النافذة (الأحدث)" aria-valuemin={0} aria-valuemax={segs} aria-valuenow={Math.round(range[1] * 100) / 100}
              aria-valuetext={label(range[1] - 0.001)} onKeyDown={(e) => keys('hi', e)} />
          </div>
          <div className={s.scale} aria-hidden="true">
            <span>الأقدم</span><span>الأحدث</span>
          </div>
        </div>
        <p className={s.tlHint}>اسحب طرفي النافذة لتضييقها، واسحب وسطها لتعبر العصور، أو المس عصراً لتنتقل إليه.</p>
      </section>

      <ul className={w.wall} data-testid="wall">
        {shown.map((it, i) => (
          <li key={it.id} className={`${w.piece} ${s.piece} ${rolling === it.id ? s.rolling : ''}`} data-id={it.id}>
            <Link href={`/archive/${it.id}`} className={`${w.pieceLink} ${s.pieceLink}`}>
              {it.img && (
                <ViewTransition name={`piece-${it.id}`} share="morph" default="none">
                  <Image src={it.img.src} alt={it.img.alt} width={it.img.w} height={it.img.h}
                    sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw" className={w.img}
                    placeholder={it.img.blur ? 'blur' : 'empty'} blurDataURL={it.img.blur ?? undefined} priority={i < 3} />
                </ViewTransition>
              )}
              <span className={w.label}>
                <span className={w.title}>{it.title}</span>
                <span className={w.meta}>{[it.place, it.when, t.kind[it.kind as keyof typeof t.kind]].filter(Boolean).join(' · ')}</span>
              </span>
            </Link>
            <span className={w.badges}>
              <TrustBadge trust={it.trust} />{it.is_demo && <DemoTag />}
              <button type="button" className={`${s.pick} ${picked.includes(it.id) ? s.picked : ''}`} aria-pressed={picked.includes(it.id)}
                onClick={() => togglePick(it.id)} data-testid="pick">
                {picked.includes(it.id) ? '✓ للمقارنة' : '+ قارن'}
              </button>
            </span>
          </li>
        ))}
      </ul>
      {!shown.length && <p className={s.none}>لا مواد في هذه النافذة من الزمن بعد. وسّع النافذة أو حرّكها.</p>}

      {picked.length > 0 && (
        <div className={s.tray} role="region" aria-label="المقارنة">
          <span>{picked.length === 1 ? 'اختر مادة ثانية للمقارنة' : 'مادتان جاهزتان'}</span>
          {picked.length === 2 && <Link className="btn btn-primary" href={`/archive/compare?a=${picked[0]}&b=${picked[1]}`} data-testid="go-compare">قارن الآن</Link>}
          <button type="button" className="btn btn-quiet" onClick={() => setPicked([])}>إلغاء</button>
        </div>
      )}
    </div>
  );
}
