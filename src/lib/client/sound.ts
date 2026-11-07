'use client';
// أصوات خفيفة مُولَّدة بـ Web Audio (لا ملفات صوتية). تعمل بعد أول لمسة فقط، وتُكتم بزر في الترويسة.
type Kind = 'tap' | 'snap' | 'chisel' | 'page' | 'rustle' | 'chime' | 'wheel' | 'error' | 'pop';
let ctx: AudioContext | null = null;
let muted: boolean | null = null;
const listeners = new Set<() => void>();

export function isMuted() {
  if (muted === null) { try { muted = localStorage.getItem('sound') === 'off'; } catch { muted = false; } }
  return muted;
}
export function setMuted(m: boolean) {
  muted = m;
  try { localStorage.setItem('sound', m ? 'off' : 'on'); } catch {}
  listeners.forEach((f) => f());
}
export function subscribeMuted(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; }

function ac() {
  if (typeof window === 'undefined' || isMuted()) return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}

function noise(c: AudioContext, dur: number) {
  const b = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(); s.buffer = b; return s;
}
function env(c: AudioContext, peak: number, attack: number, decay: number, t = c.currentTime) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(c.destination); return g;
}
function tone(c: AudioContext, f: number, type: OscillatorType, peak: number, a: number, d: number, at = 0) {
  const t = c.currentTime + at, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
  o.connect(env(c, peak, a, d, t)); o.start(t); o.stop(t + a + d + 0.05);
}
function burst(c: AudioContext, dur: number, filter: BiquadFilterType, freq: number, q: number, peak: number, at = 0) {
  const t = c.currentTime + at, n = noise(c, dur + 0.05), f = c.createBiquadFilter();
  f.type = filter; f.frequency.value = freq; f.Q.value = q;
  n.connect(f); f.connect(env(c, peak, 0.004, dur, t)); n.start(t); n.stop(t + dur + 0.05);
}

let last = 0;
export function play(kind: Kind) {
  const c = ac(); if (!c) return;
  const now = performance.now();
  if (kind === 'chisel' && now - last < 45) return; // لا تتراكم الطرقات
  last = now;
  switch (kind) {
    case 'tap': tone(c, 880, 'sine', 0.03, 0.003, 0.06); break;
    case 'pop': tone(c, 520, 'triangle', 0.05, 0.004, 0.09); tone(c, 780, 'sine', 0.025, 0.004, 0.08, 0.03); break;
    case 'snap': burst(c, 0.05, 'bandpass', 2400, 3, 0.18); tone(c, 1320, 'sine', 0.035, 0.002, 0.12, 0.01); break;
    case 'chisel': burst(c, 0.035, 'bandpass', 3200 + Math.random() * 1600, 6, 0.22); tone(c, 2100 + Math.random() * 500, 'triangle', 0.03, 0.001, 0.05); break;
    case 'page': burst(c, 0.32, 'highpass', 1600, 0.7, 0.07); burst(c, 0.18, 'bandpass', 600, 0.8, 0.05, 0.1); break;
    case 'rustle': for (let i = 0; i < 4; i++) burst(c, 0.08, 'highpass', 3000 + i * 400, 1, 0.025, i * 0.05); break;
    case 'wheel': burst(c, 0.02, 'bandpass', 1800, 8, 0.12); break;
    case 'chime': [784, 988, 1175, 1568].forEach((f, i) => tone(c, f, 'sine', 0.05, 0.005, 0.9, i * 0.09)); break;
    case 'error': tone(c, 220, 'triangle', 0.05, 0.005, 0.18); tone(c, 196, 'triangle', 0.04, 0.005, 0.2, 0.1); break;
  }
}

/** اهتزاز قصير على الجوال (إن سمح الجهاز) */
export function buzz(ms: number | number[] = 12) {
  try {
    // المتصفح يمنع الاهتزاز قبل أول لمسة من الزائر
    const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (ua && !ua.hasBeenActive) return;
    navigator.vibrate?.(ms);
  } catch {}
}
