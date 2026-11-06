import { humanError, okMessages } from '@/lib/messages';

export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (error !== undefined) return <p role="alert" className="notice notice-error">{humanError(error)}</p>;
  if (ok && okMessages[ok]) return <p role="status" className="notice notice-ok">{okMessages[ok]}</p>;
  return null;
}
