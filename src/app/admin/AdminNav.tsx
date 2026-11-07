'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import s from './admin.module.css';

const links = [
  { href: '/admin', label: 'نظرة عامة', exact: true },
  { href: '/admin/review', label: 'طابور المراجعة' },
  { href: '/admin/items/new', label: 'مادة جديدة' },
  { href: '/admin/olive', label: 'أوراق الزيتونة' },
  { href: '/admin/mosaics', label: 'لوحات الترميم' },
  { href: '/admin/scripts', label: 'جداول الحروف' },
  { href: '/admin/reports', label: 'البلاغات' },
  { href: '/admin/users', label: 'المستخدمون والأدوار', admin: true },
  { href: '/admin/schools', label: 'المدارس', admin: true },
  { href: '/admin/settings', label: 'الإعدادات', admin: true },
  { href: '/admin/audit', label: 'سجل التدقيق', admin: true },
];

export function AdminNav({ admin }: { admin: boolean }) {
  const path = usePathname();
  return (
    <nav aria-label="غرفة الأمين" className={s.nav}>
      <p className={s.navTitle}>غرفة الأمين</p>
      <ul>
        {links.filter((l) => !l.admin || admin).map((l) => {
          const active = l.exact ? path === l.href : path.startsWith(l.href);
          return (
            <li key={l.href}>
              <Link href={l.href} aria-current={active ? 'page' : undefined}>{l.label}</Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
