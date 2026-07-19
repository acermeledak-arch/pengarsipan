/**
 * ============================================
 * Konfigurasi Aplikasi
 * ============================================
 * Ganti placeholder dengan credentials Anda
 */

// Supabase Configuration
const SUPABASE_URL = 'https://blplftizqxclnioljkzn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJscGxmdGl6cXhjbG5pb2xqa3puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0MTI1MjksImV4cCI6MjA5OTk4ODUyOX0.1hBowZaGElQBtSzndm6IrlzvyTVwWafAui0P3o4tqbo';

// Google Apps Script Web App URL
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxyL7fxBpu8aagt8NA4SMOfR7ipdIeGEZMh1j6B1tKOPfnIV2Xzlng5Tl8ggRkWxs53/exec';    // contoh: https://script.google.com/macros/s/xxxx/exec

// Initialize Supabase Client
const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Jenis Dokumen
const JENIS_DOKUMEN = [
    { key: 'kk', label: 'Kartu Keluarga (KK)', icon: '📋' },
    { key: 'akta_kelahiran', label: 'Akta Kelahiran', icon: '📜' },
    { key: 'ktp_ortu', label: 'KTP Orang Tua/Wali', icon: '🪪' },
    { key: 'kia', label: 'Kartu Identitas Anak (KIA)', icon: '👶' },
    { key: 'pas_foto', label: 'Pas Foto', icon: '📷' },
    { key: 'kip', label: 'Kartu Indonesia Pintar (KIP)', icon: '🎓' },
    { key: 'surat_tidak_mampu', label: 'Surat Tidak Mampu', icon: '📄' }
];

// Max file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed file types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
