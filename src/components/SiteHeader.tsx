import { Suspense } from 'react';
import Link from 'next/link';
import { getDict } from '@/i18n';
import { getViewer, hasRole } from '@/lib/viewer';
import { signOut } from '@/app/signin/actions';
import { ThemeToggle } from './ThemeToggle';
import { AccountMenu } from './AccountMenu';
import s from './SiteHeader.module.css';

async function UserNav() {
  const t = getDict();
  const v = await getViewer();
  if (!v) return <li><Link href="/signin">{t.nav.signIn}</Link></li>;
  const items: { href: string; label: string }[] = [{ href: '/studio', label: t.nav.studio }];
  if (hasRole(v, 'admin', 'reviewer')) items.push({ href: '/admin', label: t.nav.admin });
  return <AccountMenu items={items} signOut={signOut} signOutLabel={t.nav.signOut} menuLabel={t.nav.account} />;
}

/** الإطار ثابت ويُرسل فوراً؛ الجزء الخاص بالمستخدم يصل بعده (أسرع على الإنترنت الضعيف) */
export function SiteHeader() {
  const t = getDict();
  return (
    <header className={s.header}>
      <Link href="/" className={s.mark}>
        <span className={s.name}>{t.site.name}</span>
        <span className={s.provisional}>{t.site.provisional}</span>
      </Link>
      <nav aria-label={t.nav.main} className={s.nav}>
        <ul>
          <Suspense fallback={<li aria-hidden="true" className={s.placeholder} />}>
            <UserNav />
          </Suspense>
          <li><ThemeToggle label={t.nav.theme} /></li>
        </ul>
      </nav>
    </header>
  );
}
