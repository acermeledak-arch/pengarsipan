-- ============================================
-- Web Pengarsipan Siswa - Supabase Setup SQL
-- ============================================
-- Jalankan SQL ini di Supabase SQL Editor
-- (Dashboard > SQL Editor > New Query)
-- ============================================

-- 1. Tabel Kelas
CREATE TABLE IF NOT EXISTS kelas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama TEXT NOT NULL,
    tingkat INTEGER NOT NULL CHECK (tingkat BETWEEN 1 AND 12),
    tahun_ajaran TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(nama, tahun_ajaran)
);

-- 2. Tabel Profiles (terhubung dengan auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    nama TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'walas')) DEFAULT 'walas',
    kelas_id UUID REFERENCES kelas(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabel Siswa
CREATE TABLE IF NOT EXISTS siswa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama TEXT NOT NULL,
    kelas_id UUID REFERENCES kelas(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Tabel Dokumen
CREATE TABLE IF NOT EXISTS dokumen (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    siswa_id UUID NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
    jenis TEXT NOT NULL CHECK (jenis IN ('kk', 'akta_kelahiran', 'ktp_ortu', 'kia', 'pas_foto', 'kip', 'surat_tidak_mampu')),
    drive_file_id TEXT NOT NULL,
    drive_url TEXT,
    file_name TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    uploaded_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(siswa_id, jenis)
);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE dokumen ENABLE ROW LEVEL SECURITY;

-- Helper function: get user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get user kelas_id
CREATE OR REPLACE FUNCTION get_user_kelas_id()
RETURNS UUID AS $$
    SELECT kelas_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---- PROFILES ----
-- Admin: full access. Walas: read own profile
CREATE POLICY "profiles_select" ON profiles
    FOR SELECT USING (
        get_user_role() = 'admin' OR id = auth.uid()
    );

CREATE POLICY "profiles_insert" ON profiles
    FOR INSERT WITH CHECK (
        get_user_role() = 'admin'
    );

CREATE POLICY "profiles_update" ON profiles
    FOR UPDATE USING (
        get_user_role() = 'admin'
    );

CREATE POLICY "profiles_delete" ON profiles
    FOR DELETE USING (
        get_user_role() = 'admin'
    );

-- ---- KELAS ----
-- Admin: full access. Walas: read all kelas
CREATE POLICY "kelas_select" ON kelas
    FOR SELECT USING (true);

CREATE POLICY "kelas_insert" ON kelas
    FOR INSERT WITH CHECK (
        get_user_role() = 'admin'
    );

CREATE POLICY "kelas_update" ON kelas
    FOR UPDATE USING (
        get_user_role() = 'admin'
    );

CREATE POLICY "kelas_delete" ON kelas
    FOR DELETE USING (
        get_user_role() = 'admin'
    );

-- ---- SISWA ----
-- Admin: full access. Walas: read only their class
CREATE POLICY "siswa_select" ON siswa
    FOR SELECT USING (
        get_user_role() = 'admin'
        OR kelas_id = get_user_kelas_id()
    );

CREATE POLICY "siswa_insert" ON siswa
    FOR INSERT WITH CHECK (
        get_user_role() = 'admin'
    );

CREATE POLICY "siswa_update" ON siswa
    FOR UPDATE USING (
        get_user_role() = 'admin'
    );

CREATE POLICY "siswa_delete" ON siswa
    FOR DELETE USING (
        get_user_role() = 'admin'
    );

-- ---- DOKUMEN ----
-- Admin: full access. Walas: read only their class's documents
CREATE POLICY "dokumen_select" ON dokumen
    FOR SELECT USING (
        get_user_role() = 'admin'
        OR siswa_id IN (
            SELECT id FROM siswa WHERE kelas_id = get_user_kelas_id()
        )
    );

CREATE POLICY "dokumen_insert" ON dokumen
    FOR INSERT WITH CHECK (
        get_user_role() = 'admin'
    );

CREATE POLICY "dokumen_update" ON dokumen
    FOR UPDATE USING (
        get_user_role() = 'admin'
    );

CREATE POLICY "dokumen_delete" ON dokumen
    FOR DELETE USING (
        get_user_role() = 'admin'
    );

-- ============================================
-- Auto-create profile on user signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, nama, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'nama', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'walas')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_siswa_kelas_id ON siswa(kelas_id);
CREATE INDEX IF NOT EXISTS idx_siswa_is_active ON siswa(is_active);
CREATE INDEX IF NOT EXISTS idx_dokumen_siswa_id ON dokumen(siswa_id);
CREATE INDEX IF NOT EXISTS idx_dokumen_jenis ON dokumen(jenis);
CREATE INDEX IF NOT EXISTS idx_kelas_tahun_ajaran ON kelas(tahun_ajaran);
CREATE INDEX IF NOT EXISTS idx_kelas_is_active ON kelas(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_kelas_id ON profiles(kelas_id);
