-- INDEX ONE Communications Center v1.1
-- Private document/media storage for WhatsApp/email conversation attachments.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'communication-files',
  'communication-files',
  false,
  15728640,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
    'audio/ogg',
    'audio/opus',
    'audio/mpeg',
    'audio/mp4',
    'audio/aac',
    'audio/webm'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Files are uploaded/downloaded only through authenticated server routes using service_role.
-- No direct client storage policies are intentionally granted.
