// src/lib/supabaseClient.js
//
// Satu-satunya tempat bikin koneksi ke Supabase. Import `supabase` dari sini
// di file manapun yang butuh baca/tulis data (App.jsx, CmsDashboard.jsx, dst).

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!supabaseUrl || !supabaseAnonKey) {
  // Ini bakal muncul di console kalau .env belum diisi / belum di-restart.
  console.error(
    'Supabase belum ke-konfigurasi. Cek file .env lo — pastikan ada VITE_SUPABASE_URL ' +
    'dan VITE_SUPABASE_ANON_KEY, terus restart dev server (npm run dev).'
  );
}

// Keep the public portfolio renderable when deployment variables are missing.
// Calls are skipped by the app when `isSupabaseConfigured` is false.
export const supabase = createClient(
  supabaseUrl || 'https://configuration-missing.supabase.co',
  supabaseAnonKey || 'configuration-missing'
);

// Nama bucket Storage tempat naro foto upload dari CMS (foto profil, dll).
// Harus PERSIS sama dengan nama bucket yang lo bikin di dashboard Supabase.
export const IMAGES_BUCKET = 'portofolio-images';
