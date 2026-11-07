import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { ammanToday } from '@/lib/thisday';
import { Loading } from '@/components/Loading';

async function Today() {
  await connection(); // التاريخ يُحسب عند الطلب بتوقيت عمّان
  redirect(`/this-day/${ammanToday()}`);
  return null;
}
export default function ThisDay() { return <Suspense fallback={<Loading />}><Today /></Suspense>; }
