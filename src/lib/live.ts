export type Activity = { id: string; idx: number; kind: 'poll' | 'text' | 'pin'; prompt: string; options: string[]; image: string | null; item_id: string | null };
export type Results = { votes: { choice: number; n: number }[]; pins: [number, number][]; texts: { id: string; body: string; by: string }[]; answered: number; class_size: number };
export type Session = { id: string; title: string; code: string; status: 'open' | 'ended'; current: number; reveal: boolean; class_id: string };
