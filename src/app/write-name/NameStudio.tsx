'use client';
import { useMemo, useRef, useState } from 'react';
import { glyphs, isArabicName, transliterate, type Letter, type Script } from '@/lib/scripts/transliterate';
import { CarvedStone, type StoneHandle } from './CarvedStone';
import type { Material } from './carve';
import s from './name.module.css';

const MATERIAL: Record<Script, Material> = { safaitic: 'basalt', nabataean: 'sandstone', moabite: 'stele' };
const STONE: Record<Script, string> = { safaitic: 'صخرة بازلت من الحرّة، كالتي نقش عليها أهل البادية', nabataean: 'صخر رملي وردي كصخر البترا', moabite: 'بازلت أسود كحجر مسلة ميشع' };

type Credit = { credit: string; license: string; license_url: string | null; source_url: string };
export type ScriptInfo = {
  key: Script; name: string; font: string; bg: string; bgCredit: Credit; about: string;
  source: { citation: string; url: string } | null; extra: { citation: string; url: string } | null; unicode: string;
};

const MERGE: Record<string, string> = { 'ث': 'ت', 'ذ': 'د', 'خ': 'ح', 'ظ': 'ط', 'ض': 'ص', 'غ': 'ع', 'ة': 'ه' };

export function NameStudio({ scripts, letters }: { scripts: ScriptInfo[]; letters: Letter[] }) {
  const [name, setName] = useState('سلمى');
  const [active, setActive] = useState<Script>('safaitic');
  const [busy, setBusy] = useState(false);
  const valid = isArabicName(name);
  const info = scripts.find((x) => x.key === active)!;
  const words = useMemo(() => (valid ? transliterate(name, letters, active) : []), [name, letters, active, valid]);
  const text = glyphs(words);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const stone = useRef<StoneHandle>(null);

  async function saveCard() {
    setBusy(true);
    try {
      await document.fonts.load(`120px ${info.font}`, text);
      const W = 1200, H = 1500;
      const c = await stone.current!.snapshot(W, H);
      const g = c.getContext('2d')!;
      const grad = g.createLinearGradient(0, H * 0.55, 0, H);
      grad.addColorStop(0, 'rgba(20,16,12,0)'); grad.addColorStop(1, 'rgba(20,16,12,.85)');
      g.fillStyle = grad; g.fillRect(0, 0, W, H);
      g.fillStyle = '#fbf7ef'; g.textAlign = 'center'; g.direction = 'rtl';
      g.font = `600 64px ${getComputedStyle(document.body).getPropertyValue('--font-display') || 'sans-serif'}`;
      g.fillText(name.trim(), W / 2, H * 0.78);
      g.font = `36px ${getComputedStyle(document.body).fontFamily}`;
      g.fillStyle = '#ede2ce';
      g.fillText(`بالخط ${info.name} · ذاكرة وطن`, W / 2, H * 0.84);
      g.font = `22px ${getComputedStyle(document.body).fontFamily}`;
      g.fillText('الحجر مرسوم بالكود، والحروف من جداول موثقة مذكورة في المنصة', W / 2, H - 60);
      const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/png'));
      const a = linkRef.current!;
      a.href = URL.createObjectURL(blob); a.download = `${name.trim()}-${info.key}.png`; a.click();
    } finally { setBusy(false); }
  }

  return (
    <div className={s.studio}>
      <div className={s.input}>
        <label htmlFor="name">اسمك بالعربية <span className="hint">حروف عربية فقط، حتى 40 حرفاً</span></label>
        <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="given-name" aria-invalid={!valid} aria-describedby="name-err" />
        {!valid && <p id="name-err" role="alert" className="notice notice-error">اكتب الاسم بحروف عربية (حرفان على الأقل).</p>}
      </div>

      <div className={s.tabs} role="tablist" aria-label="الخط">
        {scripts.map((sc) => (
          <button key={sc.key} role="tab" type="button" aria-selected={active === sc.key} aria-controls="panel" id={`tab-${sc.key}`}
            className={s.tab} onClick={() => { setActive(sc.key); }}>
            <span className={s.tabGlyph} style={{ fontFamily: sc.font }} aria-hidden="true">{valid ? glyphs(transliterate(name, letters, sc.key)) : ''}</span>
            <span>{sc.name}</span>
          </button>
        ))}
      </div>

      <section id="panel" role="tabpanel" aria-labelledby={`tab-${active}`} className={s.panel}>
        <div className={s.stoneCol}>
          <CarvedStone ref={stone} text={valid ? text : ''} font={info.font} material={MATERIAL[active]} label={`${name} بالخط ${info.name}، منقوشاً على ${STONE[active]}`} />
          <p className="sr-only" dir="rtl" lang="und" data-testid="glyphs">{text}</p>
          <figure className={s.real}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={info.bg} alt={`نقش حقيقي بالخط ${info.name}`} className={s.realImg} loading="lazy" />
            <figcaption>
              <strong>نقش حقيقي بهذا الخط.</strong> <bdi>{info.bgCredit.credit}</bdi> · <a href={info.bgCredit.license_url ?? info.bgCredit.source_url} target="_blank" rel="noopener noreferrer"><bdi>{info.bgCredit.license}</bdi></a> · <a href={info.bgCredit.source_url} target="_blank" rel="noopener noreferrer">المصدر</a>
            </figcaption>
          </figure>
        </div>

        <div className={s.explain}>
          <h2>{name.trim()} بالخط {info.name}</h2>
          <p className={s.about}>{info.about}</p>
          <ol className={s.letters} aria-label="الحروف واحداً واحداً">
            {words.flat().map((p, i) => (
              <li key={i} className={p.letter ? s.letter : s.skip}>
                <span className={s.ar}>{p.ar}</span>
                <span className={s.arrow} aria-hidden="true">←</span>
                {p.letter ? (
                  <>
                    <span className={s.glyph} style={{ fontFamily: info.font }} aria-hidden="true">{p.glyph}</span>
                    <span className={s.tr} lang="en" dir="ltr">{p.letter.translit}</span>
                    {MERGE[p.ar] && info.key !== 'safaitic' && <span className={s.why}>يُكتب بحرف «{MERGE[p.ar]}»</span>}
                    {p.ar === 'ة' && info.key === 'safaitic' && <span className={s.why}>تُكتب تاءً كما في النقوش</span>}
                  </>
                ) : <span className={s.why}>{p.skipped === 'vowel' ? 'صوت ممدود لم يُكتب غالباً' : 'لا مقابل له'}</span>}
              </li>
            ))}
          </ol>
          <p className={s.method}>طريقتنا: نكتب الحروف الساكنة كما كان يفعل كتّاب النقوش، ونترك الألف الممدودة داخل الكلمة. والنتيجة تقريب تعليمي، لا قراءة علمية للاسم.</p>
          <div className={s.actions}>
            <button className="btn btn-primary" type="button" onClick={saveCard} disabled={!valid || busy}>{busy ? 'جارٍ التجهيز…' : 'احفظ البطاقة'}</button>
            <a ref={linkRef} className="sr-only" aria-hidden="true" tabIndex={-1}>تنزيل</a>
          </div>
          <h3 className={s.h3}>مصادر جدول الحروف</h3>
          <ul className={s.sources}>
            {info.source && <li><a href={info.source.url} target="_blank" rel="noopener noreferrer"><bdi>{info.source.citation}</bdi></a></li>}
            {info.extra && <li><a href={info.extra.url} target="_blank" rel="noopener noreferrer"><bdi>{info.extra.citation}</bdi></a></li>}
            <li><a href={info.unicode} target="_blank" rel="noopener noreferrer">جدول Unicode الرسمي لأشكال الحروف</a></li>
          </ul>
        </div>
      </section>
    </div>
  );
}
