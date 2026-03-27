# Rent a Home Website

Lightweight rental platform using Supabase (Postgres, Auth, Storage) and a static frontend (HTML/Bootstrap/JS).

## Setup
1. Create a Supabase project.
2. Create a public storage bucket named `property-images` (make public for simple demo) or configure signed URLs.
3. In Supabase SQL editor run the entire `database.sql` file once.
4. Enable Row Level Security (RLS) is already turned on by the script; confirm policies in dashboard.
5. Copy your `SUPABASE_URL` and `SUPABASE_ANON_KEY` into `js/supabaseClient.js`.
6. Open `index.html` in your browser.

Storage bucket note:
- Create a storage bucket named `property-images` in Supabase (Storage → Create bucket).
- For simple demos set the bucket to **Public** so `getPublicUrl` returns usable image URLs.
- If you use a **Private** bucket, update `js/properties.js` to use `createSignedUrl` when fetching images.

No changes to `database.sql` are required for storage buckets — they are managed in Supabase Storage, not SQL.

## Files
- `database.sql` - Full schema and RLS policies.
- Pages: `index.html`, `login.html`, `register.html`, `dashboard.html`, `add-property.html`, `property-details.html`, `profile.html`.
- JS modules in `js/` for auth, properties, bookings, and Supabase client.
- CSS in `css/styles.css`.

## Notes
- This is a frontend-only app that uses Supabase as the backend.
- For production, secure your storage and refine RLS policies.
- Some features (RPCs, advanced booking lists) are left extensible as exercises.

## Development
- Use a static server (e.g., `npx http-server .`) to serve pages if browser blocks local module imports.

Enjoy!
