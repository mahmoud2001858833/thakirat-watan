export type ItemRow = {
  id: string; kind: 'image' | 'audio' | 'video' | 'document' | 'text';
  title_ar: string; title_en: string | null; summary_ar: string | null; body_ar: string | null;
  status: 'draft' | 'in_review' | 'verified' | 'published' | 'rejected' | 'archived';
  trust: 'official_document' | 'personal_testimony' | 'circulated_account' | 'under_review';
  rights: 'public_domain' | 'cc_by' | 'cc_by_sa' | 'cc_by_nc' | 'permission' | 'all_rights_reserved' | 'unknown';
  rights_holder: string | null; rights_note: string | null;
  year_start: number | null; year_end: number | null;
  contributor_public_name: string | null; is_student_work: boolean; is_demo: boolean;
  reject_reason: string | null; contributor_id: string | null; created_at: string; updated_at: string;
};
export type SourceLink = { locator: string | null; sources: { id: string; kind: string; citation: string; url: string | null; archive_ref: string | null } };
export type ConsentRow = { id: string; subject_name_private: string; method: string; consent_text_version: string; given_at: string; withdrawn_at: string | null };
export type EventRow = { id: number; from_status: string; to_status: string; reason: string | null; at: string };
