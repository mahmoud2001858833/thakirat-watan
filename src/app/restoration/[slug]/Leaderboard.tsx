const ar = (n: number) => new Intl.NumberFormat('ar-JO-u-nu-arab').format(n);
const clock = (sec: number) => `${ar(Math.floor(sec / 60))}:${new Intl.NumberFormat('ar-JO-u-nu-arab', { minimumIntegerDigits: 2 }).format(sec % 60)}`;
const day = (d: string) => new Intl.DateTimeFormat('ar-JO-u-nu-arab', { day: 'numeric', month: 'long' }).format(new Date(d));
export type Best = { seconds: number; moves: number; created_at: string };

/** أفضل الأزمنة: بلا أسماء ولا بيانات شخصية، الزمن والحركات والتاريخ فقط */
export function Leaderboard({ rows, mine, justDone }: { rows: Best[]; mine: number | null; justDone: number | null }) {
  return (
    <section aria-labelledby="lb-h" style={{ marginBottom: 'var(--space-5)' }}>
      <h3 id="lb-h" style={{ fontSize: 'var(--step-1)' }}>أفضل الأزمنة</h3>
      {mine != null && <p style={{ fontSize: 'var(--step--1)', color: 'var(--olive-text)', margin: '0 0 var(--space-2)' }}>أفضل زمن لك على هذا الجهاز: {clock(mine)}</p>}
      {rows.length === 0 ? <p style={{ fontSize: 'var(--step--1)', color: 'var(--ink-2)' }}>لم يكمل أحد هذه اللوحة بعد. كن الأول.</p> : (
        <ol className="lb" data-testid="leaderboard">
          {rows.map((r, i) => (
            <li key={i} data-you={justDone != null && r.seconds === justDone ? 'true' : undefined}>
              <span className="lb-n">{ar(i + 1)}</span><span className="lb-t">{clock(r.seconds)}</span><span className="lb-m">{ar(r.moves)} حركة</span><span className="lb-d">{day(r.created_at)}</span>
            </li>
          ))}
        </ol>
      )}
      <p style={{ fontSize: '.78rem', color: 'var(--ink-2)', margin: 'var(--space-2) 0 0' }}>لا نحفظ أسماء اللاعبين ولا أي بيانات عنهم.</p>
    </section>
  );
}
