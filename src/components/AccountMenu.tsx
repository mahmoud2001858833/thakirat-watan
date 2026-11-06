'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import s from './SiteHeader.module.css';

type Item = { href: string; label: string };

/** على الشاشات الصغيرة تُجمع روابط الحساب في قائمة؛ وعلى الكبيرة تظهر في السطر */
export function AccountMenu({ items, signOut, signOutLabel, menuLabel }: {
  items: Item[]; signOut: () => Promise<void>; signOutLabel: string; menuLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', close); };
  }, [open]);
  return (
    <li ref={ref} className={s.account}>
      <button type="button" className={s.menuBtn} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {menuLabel}<span aria-hidden="true" className={s.chev} />
      </button>
      <ul id={id} className={s.menu} data-open={open}>
        {items.map((i) => <li key={i.href}><Link href={i.href} onClick={() => setOpen(false)}>{i.label}</Link></li>)}
        <li><form action={signOut}><button className="btn btn-quiet" type="submit">{signOutLabel}</button></form></li>
      </ul>
    </li>
  );
}
