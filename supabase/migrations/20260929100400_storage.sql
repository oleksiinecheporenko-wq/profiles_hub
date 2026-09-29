-- Private image buckets. Uploads go through a server action; images are shown via
-- signed URLs generated on the server. No storage policies: only the service role
-- (which bypasses RLS) can read or write.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('profile-photos', 'profile-photos', false, 5242880,
   array['image/jpeg', 'image/png', 'image/webp']),
  ('portfolio-images', 'portfolio-images', false, 5242880,
   array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
