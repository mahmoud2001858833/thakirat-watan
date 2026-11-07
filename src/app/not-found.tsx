import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="page" style={{ textAlign: 'center', minHeight: '60svh', display: 'grid', placeContent: 'center' }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--step-5)', color: 'var(--petra-fill)', margin: '0 auto', lineHeight: 1 }}>٤٠٤</p>
      <h1 style={{ fontSize: 'var(--step-3)' }}>لم نجد هذه الصفحة في الأرشيف</h1>
      <p style={{ margin: '0 auto var(--space-5)', color: 'var(--ink-2)' }}>ربما نُقلت، أو أن الرابط غير صحيح.</p>
      <p style={{ margin: '0 auto' }}><Link href="/" className="btn btn-primary">إلى القوس</Link></p>
    </main>
  );
}
