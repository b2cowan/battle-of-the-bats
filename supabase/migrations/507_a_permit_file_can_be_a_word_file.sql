-- 507 — A permit's file can be a Word file (owner ruling 2026-11-19, asked in the Board Ready trust-fix queue P8b:
-- "allow Word files on permits?" — yes, as recommended).
--
-- The private `org-permit-documents` bucket was made by mig 322 with allowed_mime_types PDF, JPEG and PNG, the permit's
-- own list since it was built. The upload route now takes a Word .docx too (its type read from the file's bytes by
-- lib/document-upload.ts, the same check the player documents use), so the bucket must allow the .docx type or storage
-- refuses the upload; and org_permits.document_type's check (mig 322, the same three types) takes the .docx type too, or
-- the record of an uploaded Word file is refused. The size limit (10 MB) and the bucket's privacy (no storage policies;
-- the service role only) are unchanged.
--
-- PRODUCTION: before the code (code first would answer a Word upload with "couldn't be saved just now"). The bucket half
-- is INVISIBLE to check:migrations (entry in MANUAL_PROD_STEPS.json); the constraint half is visible. Idempotent.

alter table public.org_permits drop constraint if exists org_permits_document_type_check;
alter table public.org_permits add constraint org_permits_document_type_check check (
  document_type is null or document_type in (
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
);

update storage.buckets
   set allowed_mime_types = array[
     'application/pdf',
     'image/jpeg',
     'image/png',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
   ]
 where id = 'org-permit-documents';
