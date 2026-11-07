// تحويل اسم عربي إلى حروف الخطوط القديمة، حرفاً بحرف، من جداول قاعدة البيانات.
export type Letter = { script: Script; codepoint: number; arabic: string; translit: string; name: string; note_ar: string | null };
export type Script = 'safaitic' | 'nabataean' | 'moabite';
export type Piece = { ar: string; glyph: string | null; letter: Letter | null; skipped?: 'vowel' | 'unknown' };

// الأشكال الأخيرة في النبطية (جدول Unicode الرسمي لكتلة Nabataean)
const NAB_FINAL: Record<number, number> = { 0x10881: 0x10880, 0x10883: 0x10882, 0x10887: 0x10886, 0x1088d: 0x1088c, 0x1088f: 0x1088e, 0x10891: 0x10890, 0x10893: 0x10892, 0x10895: 0x10894, 0x1089d: 0x1089c };

const clean = (s: string) => s.normalize('NFC').replace(/[ً-ٰٟـ]/g, '').replace(/\s+/g, ' ').trim();
export const isArabicName = (s: string) => /^[ء-ي\s]{2,40}$/.test(clean(s));

export function transliterate(name: string, letters: Letter[], script: Script): Piece[][] {
  const table = new Map<string, Letter>();
  for (const l of letters.filter((x) => x.script === script)) for (const a of l.arabic.split(',')) table.set(a, l);
  return clean(name).split(' ').map((word) => {
    const chars = [...word];
    const pieces = chars.map((ar, i): Piece => {
      // الألف الممدودة والألف المقصورة داخل الكلمة صوتان طويلان لم تكن الكتابات القديمة تكتبهما غالباً
      if ((ar === 'ا' && i > 0) || (ar === 'ى' && i > 0)) return { ar, glyph: null, letter: null, skipped: 'vowel' };
      const l = table.get(ar);
      return l ? { ar, glyph: String.fromCodePoint(l.codepoint), letter: l } : { ar, glyph: null, letter: null, skipped: 'unknown' };
    });
    if (script === 'nabataean') {
      const last = [...pieces].reverse().find((p) => p.letter);
      if (last?.letter && NAB_FINAL[last.letter.codepoint]) last.glyph = String.fromCodePoint(NAB_FINAL[last.letter.codepoint]);
    }
    return pieces;
  });
}

export const glyphs = (words: Piece[][]) => words.map((w) => w.map((p) => p.glyph ?? '').join('')).filter(Boolean).join(' ');
