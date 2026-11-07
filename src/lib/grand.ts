export type GrandMosaic = { id: string; slug: string; title_ar: string; summary_ar: string; image_path: string; credit: string; license: string; license_url: string | null;
  source_url: string; width: number; height: number; cols: number; rows: number; piece_grid: number; completed_at: string | null; is_demo: boolean };
export type GrandSection = { id: string; idx: number; claimed: boolean; done: boolean; completed_at: string | null; moves: number; state: number[] | null; school: string | null; mine: boolean };
export type Board = { mosaic: GrandMosaic; sections: GrandSection[] };
/** خلفية قطعة: الجزء (sc, sr) من اللوحة، والقطعة (pc, pr) داخله */
export function crop(m: Pick<GrandMosaic, 'cols' | 'rows' | 'image_path'>, idx: number, g = 1, piece = 0) {
  const sc = idx % m.cols, sr = Math.floor(idx / m.cols), pc = piece % g, pr = Math.floor(piece / g);
  const W = m.cols * g, H = m.rows * g, x = sc * g + pc, y = sr * g + pr;
  return {
    backgroundImage: `url(${m.image_path})`,
    backgroundSize: `${W * 100}% ${H * 100}%`,
    backgroundPosition: `${W > 1 ? (x / (W - 1)) * 100 : 0}% ${H > 1 ? (y / (H - 1)) * 100 : 0}%`,
  };
}
