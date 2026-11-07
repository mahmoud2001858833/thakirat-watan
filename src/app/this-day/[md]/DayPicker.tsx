'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import s from './paper.module.css';

const DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function DayPicker({ mo, d, months }: { mo: number; d: number; months: string[] }) {
  const router = useRouter();
  const [m, setM] = useState(mo);
  const [day, setDay] = useState(d);
  const go = (e: React.FormEvent) => { e.preventDefault(); router.push(`/this-day/${String(m).padStart(2, '0')}-${String(Math.min(day, DAYS_IN[m - 1])).padStart(2, '0')}`); };
  return (
    <form className={s.picker} onSubmit={go} aria-label="اختر يوماً">
      <label htmlFor="pd" className="sr-only">اليوم</label>
      <select id="pd" value={day} onChange={(e) => setDay(+e.target.value)}>
        {Array.from({ length: DAYS_IN[m - 1] }, (_, i) => <option key={i + 1} value={i + 1}>{new Intl.NumberFormat('ar-JO-u-nu-arab').format(i + 1)}</option>)}
      </select>
      <label htmlFor="pm" className="sr-only">الشهر</label>
      <select id="pm" value={m} onChange={(e) => setM(+e.target.value)}>
        {months.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
      </select>
      <button className="btn">اذهب</button>
    </form>
  );
}
