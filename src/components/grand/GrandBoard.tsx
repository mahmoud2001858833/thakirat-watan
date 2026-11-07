'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '@/lib/supabase/browser';
import { openChannel } from '@/lib/client/realtime';
import { crop, type Board } from '@/lib/grand';
import { play, buzz } from '@/lib/client/sound';
import s from './grand.module.css';

const ar = (n: number) => new Intl.NumberFormat('ar-JO-u-nu-arab').format(n);

/** اللوحة الكبرى للعامة: كل جزء يتغير لحظياً، وعند اكتمالها احتفال يظهر فيه اسم كل مدرسة على جزئها */
export function GrandBoard({ initial }: { initial: Board }) {
  const [board, setBoard] = useState(initial);
  const [celebrate, setCelebrate] = useState(false);
  const wasDone = useRef(!!initial.mosaic.completed_at);
  const m = board.mosaic;
  const done = board.sections.filter((x) => x.done).length, claimed = board.sections.filter((x) => x.claimed).length;

  const refresh = useCallback(async () => {
    const { data } = await browserClient().rpc('grand_board', { p_slug: m.slug });
    if (data) setBoard(data as Board);
  }, [m.slug]);
  useEffect(() => {
    let t = 0;
    const close = openChannel(browserClient(), (sb) => sb.channel(`grand-board:${m.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'grand_sections', filter: `mosaic_id=eq.${m.id}` }, () => { clearTimeout(t); t = window.setTimeout(refresh, 250); })
      .subscribe());
    const iv = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 15_000);
    return () => { close(); clearInterval(iv); };
  }, [m.id, refresh]);
  // اكتملت للتو، أو مكتملة عند فتح الصفحة: احتفال
  useEffect(() => {
    if (!m.completed_at) return;
    const fresh = !wasDone.current; wasDone.current = true;
    const t = setTimeout(() => { setCelebrate(true); play('chime'); if (fresh) buzz([30, 80, 30, 80, 60]); }, fresh ? 200 : 600);
    return () => clearTimeout(t);
  }, [m.completed_at]);

  return (
    <div className={s.wrap}>
      <div className={s.status} aria-live="polite">
        <span className={s.big} data-testid="grand-done">{ar(done)}<small> / {ar(board.sections.length)}</small></span>
        <span>جزءاً مكتملاً · {ar(claimed)} صفاً تبنّى جزءاً · {ar(board.sections.length - claimed)} جزءاً ينتظر من يتبناه</span>
        {m.completed_at && <button type="button" className="btn" onClick={() => { setCelebrate(false); requestAnimationFrame(() => setCelebrate(true)); play('chime'); }}>أعد الاحتفال</button>}
      </div>
      <div className={`${s.board} ${m.completed_at ? s.complete : ''} ${celebrate ? s.celebrate : ''}`} style={{ aspectRatio: `${m.width} / ${m.height}`, gridTemplateColumns: `repeat(${m.cols}, 1fr)` }}
        role="img" aria-label={`${m.title_ar}: ${ar(done)} من ${ar(board.sections.length)} جزءاً مكتملاً`} data-testid="grand-board" data-complete={!!m.completed_at}>
        {board.sections.map((sec) => (
          <div key={sec.id} className={`${s.sec} ${sec.done ? s.secDone : sec.claimed ? s.secWork : s.secFree} ${sec.mine ? s.secMine : ''}`}
            style={{ ...(sec.done ? crop(m, sec.idx) : {}), animationDelay: `${(sec.idx % m.cols) * 70 + Math.floor(sec.idx / m.cols) * 90}ms` }} data-idx={sec.idx}>
            {!sec.done && sec.claimed && sec.state && (
              <div className={s.mini} style={{ gridTemplateColumns: `repeat(${m.piece_grid}, 1fr)` }} aria-hidden="true">
                {sec.state.map((piece, pos) => <span key={pos} className={piece === pos ? s.home : ''} style={crop(m, sec.idx, m.piece_grid, piece)} />)}
              </div>
            )}
            {!sec.done && !sec.claimed && <span className={s.wait} style={crop(m, sec.idx)} aria-hidden="true" />}
            {sec.done && sec.school && <span className={s.school}>{sec.school}</span>}
            {sec.mine && !sec.done && <Link href={`/grand/${sec.id}`} className={s.mineLink}>جزء صفك ←</Link>}
          </div>
        ))}
        {celebrate && <Confetti />}
      </div>
      <p className={s.credit}>{m.title_ar} — الصورة: <bdi>{m.credit}</bdi> · {m.license_url ? <a href={m.license_url} target="_blank" rel="noopener noreferrer"><bdi>{m.license}</bdi></a> : m.license} · <a href={m.source_url} target="_blank" rel="noopener noreferrer">المصدر</a>{m.is_demo && ' · لوحة تجريبية'}</p>
      <p className={s.summary}>{m.summary_ar}</p>
    </div>
  );
}

/** قطع فسيفساء صغيرة تتساقط بألوان اللوحة */
function Confetti() {
  const colors = ['#c4836f', '#b58a3c', '#6e7b4f', '#e2c37a', '#8e4c39', '#ede2ce'];
  return (
    <div className={s.confetti} aria-hidden="true">
      {Array.from({ length: 90 }, (_, i) => (
        <span key={i} style={{ left: `${(i * 37) % 100}%`, background: colors[i % colors.length], animationDelay: `${(i % 18) * 90}ms`, animationDuration: `${2200 + (i % 7) * 260}ms`, transform: `rotate(${i * 23}deg)` }} />
      ))}
    </div>
  );
}
