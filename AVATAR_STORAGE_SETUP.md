# Avatar Storage Setup

To enable profile picture uploads, you need to create a storage bucket in Supabase:

1. Go to your Supabase Dashboard
2. Navigate to Storage
3. Create a new bucket named `avatars`
4. Set it to **Public** (so profile pictures can be accessed)
5. Set up RLS policies if needed (or make it public)

The bucket should allow:
- Authenticated users to upload files
- Public read access for viewing avatars

## RLS Policy Example

```sql
-- Allow authenticated users to upload
CREATE POLICY "Users can upload their own avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public read access
CREATE POLICY "Avatars are publicly readable"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');
```


