-- Create the 'resources' storage bucket for tournament resource file uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resources',
  'resources',
  true,
  52428800,
  ARRAY[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload resources"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'resources');

-- Allow authenticated users to delete resource files
CREATE POLICY "Authenticated users can delete resources"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'resources');

-- Public reads (bucket is public, but explicit policy for SELECT operations)
CREATE POLICY "Public can read resources"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'resources');
