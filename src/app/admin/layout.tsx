import { Suspense } from 'react';
import { requireStaff, hasRole } from '@/lib/viewer';
import { Loading } from '@/components/Loading';
import { AdminNav } from './AdminNav';
import s from './admin.module.css';

async function Gate({ children }: { children: React.ReactNode }) {
  const v = await requireStaff();
  return (
    <div className={s.room}>
      <AdminNav admin={hasRole(v, 'admin')} />
      <div className={s.content}>{children}</div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Loading />}><Gate>{children}</Gate></Suspense>;
}
