import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Fill these with your Supabase project values
const SUPABASE_URL = 'https://navalyucfsiollbtvedi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hdmFseXVjZnNpb2xsYnR2ZWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MjA2MjIsImV4cCI6MjA5MDA5NjYyMn0.vejGfK5S-HLmKZktVJB61fIan1DKE4elHVibQMfEchI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper to get current user id
export const getUserId = () => supabase.auth.getUser().then(r => r.data?.user?.id).catch(() => null);
