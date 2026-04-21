-- Ensure the recordings bucket exists and is private (no public URLs).
-- All access must go through short-lived signed URLs generated server-side.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recordings',
  'recordings',
  false,
  524288000, -- 500 MB
  ARRAY['audio/webm', 'audio/ogg', 'audio/mp4', 'video/mp4', 'video/webm']
)
ON CONFLICT (id) DO UPDATE
  SET public             = false,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
