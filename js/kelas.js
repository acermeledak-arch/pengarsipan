/**
 * Kelas Management Module - CRUD, Transfer, Promotion
 */
let currentProfile = null;
let kelasList = [];
let transferSiswa = [];
let selectedTransfer = new Set();

(async function init() {
    currentProfile = await Auth.requireAdmin();
    if (!currentProfile) return;
    Auth.initSidebar(currentProfile, 'kelas');
    Modal.init();
    await loadKelas();
})();

function switchTab(tab, btn) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    btn.classList.add('active');
    if (tab === 'pindah') populateTransferSelects();
}

// ---- KELAS CRUD ----
async function loadKelas() {
    const { data } = await _supabase.from('kelas').select('*').eq('is_active', true).order('tingkat').order('nama');
    kelasList = data || [];

    // Count students per class
    const { data: counts } = await _supabase.from('siswa').select('kelas_id').eq('is_active', true);
    const countMap = {};
    (counts || []).forEach(s => { countMap[s.kelas_id] = (countMap[s.kelas_id] || 0) + 1; });

    // Get walas per class
    const { data: profiles } = await _supabase.from('profiles').select('kelas_id, nama').eq('role', 'walas');
    const walasMap = {};
    (profiles || []).forEach(p => { if (p.kelas_id) walasMap[p.kelas_id] = p.nama; });

    renderKelasGrid(countMap, walasMap);
}

function renderKelasGrid(countMap, walasMap) {
    const grid = document.getElementById('kelasGrid');
    if (kelasList.length === 0) {
        grid.innerHTML = '<div class="empty-state"><div class="empty-icon">🏫</div><p>Belum ada kelas. Tambahkan kelas baru.</p></div>';
        return;
    }
    grid.innerHTML = kelasList.map(k => `
        <div class="card kelas-card" onclick="showKelasDetail('${k.id}')">
            <div style="display:flex;justify-content:space-between;align-items:start;">
                <div>
                    <div class="kelas-name">${k.nama}</div>
                    <div style="font-size:0.8rem;color:var(--text-secondary);">Tingkat ${k.tingkat} · ${k.tahun_ajaran}</div>
                </div>
                <div style="text-align:right;">
                    <div class="kelas-count">${countMap[k.id] || 0}</div>
                    <div style="font-size:0.75rem;color:var(--text-muted);">siswa</div>
                </div>
            </div>
            ${walasMap[k.id] ? `<div style="margin-top:0.75rem;font-size:0.8rem;color:var(--text-secondary);">👤 ${walasMap[k.id]}</div>` : '<div style="margin-top:0.75rem;font-size:0.8rem;color:var(--text-muted);">Belum ada wali kelas</div>'}
            <div class="table-actions" style="margin-top:0.75rem;" onclick="event.stopPropagation()">
                <button class="btn btn-ghost btn-sm" onclick="editKelas('${k.id}')">✏️</button>
                <button class="btn btn-ghost btn-sm" onclick="deleteKelas('${k.id}','${k.nama}')">🗑️</button>
            </div>
        </div>
    `).join('');
}

async function showKelasDetail(kelasId) {
    const kelas = kelasList.find(k => k.id === kelasId);
    if (!kelas) return;
    document.getElementById('detailKelasTitle').textContent = 'Kelas ' + kelas.nama;
    document.getElementById('detailKelasBody').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    Modal.open('modalDetailKelas');

    const { data: siswa } = await _supabase.from('siswa').select('*').eq('kelas_id', kelasId).eq('is_active', true).order('nama');
    const body = document.getElementById('detailKelasBody');
    if (!siswa || siswa.length === 0) {
        body.innerHTML = '<div class="empty-state"><p>Tidak ada siswa di kelas ini</p></div>';
        return;
    }
    body.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <p style="color:var(--text-secondary);margin:0;">${siswa.length} siswa</p>
            <button class="btn btn-primary" onclick="window.location.href='siswa.html?wizard=${kelasId}&index=0'">🚀 Mulai Scan Massal</button>
        </div>
        <div class="table-responsive">
            <table>
                <thead><tr><th>No</th><th>Nama</th><th style="text-align:right;">Aksi</th></tr></thead>
                <tbody>
                    ${siswa.map((s, i) => `<tr>
                        <td>${i+1}</td>
                        <td>${s.nama}</td>
                        <td style="text-align:right;">
                            <button class="btn btn-secondary btn-sm" onclick="window.location.href='siswa.html?id=${s.id}'">Buka Profil</button>
                            <button class="btn btn-primary btn-sm" onclick="window.location.href='siswa.html?wizard=${kelasId}&index=${i}'">▶ Lanjut Scan</button>
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>`;
}

function openAddKelas() {
    document.getElementById('kelasModalTitle').textContent = 'Tambah Kelas';
    document.getElementById('formKelas').reset();
    document.getElementById('kelasId').value = '';
    Modal.open('modalKelas');
}

function editKelas(id) {
    const k = kelasList.find(x => x.id === id);
    if (!k) return;
    document.getElementById('kelasModalTitle').textContent = 'Edit Kelas';
    document.getElementById('kelasId').value = k.id;
    document.getElementById('kNama').value = k.nama;
    document.getElementById('kTingkat').value = k.tingkat;
    document.getElementById('kTahun').value = k.tahun_ajaran;
    Modal.open('modalKelas');
}

async function saveKelas(e) {
    e.preventDefault();
    const id = document.getElementById('kelasId').value;
    const payload = {
        nama: document.getElementById('kNama').value,
        tingkat: parseInt(document.getElementById('kTingkat').value),
        tahun_ajaran: document.getElementById('kTahun').value
    };
    let error;
    if (id) { ({ error } = await _supabase.from('kelas').update(payload).eq('id', id)); }
    else { ({ error } = await _supabase.from('kelas').insert(payload)); }
    if (error) { Toast.error('Gagal: ' + error.message); return; }
    Modal.close('modalKelas');
    Toast.success(id ? 'Kelas diupdate' : 'Kelas ditambahkan');
    await loadKelas();
}

async function deleteKelas(id, nama) {
    if (!confirm(`Hapus kelas "${nama}"? Siswa di kelas ini akan kehilangan kelasnya.`)) return;
    const { error } = await _supabase.from('kelas').delete().eq('id', id);
    if (error) { Toast.error('Gagal: ' + error.message); return; }
    Toast.success('Kelas dihapus');
    await loadKelas();
}

// ---- TRANSFER / PINDAH SISWA ----
function populateTransferSelects() {
    ['kelasAsal', 'kelasTujuan'].forEach(id => {
        const sel = document.getElementById(id);
        sel.innerHTML = '<option value="">Pilih Kelas</option>' + kelasList.map(k => `<option value="${k.id}">${k.nama}</option>`).join('');
    });
}

async function loadTransferSiswa() {
    const kelasId = document.getElementById('kelasAsal').value;
    const tList = document.getElementById('transferList');
    if (!kelasId) { tList.innerHTML = '<div class="empty-state" style="padding:2rem;"><p>Pilih kelas asal</p></div>'; return; }

    const { data } = await _supabase.from('siswa').select('*').eq('kelas_id', kelasId).eq('is_active', true).order('nama');
    transferSiswa = data || [];
    selectedTransfer.clear();
    tList.innerHTML = transferSiswa.length === 0
        ? '<div class="empty-state" style="padding:2rem;"><p>Tidak ada siswa</p></div>'
        : transferSiswa.map(s => `<div class="transfer-item" data-id="${s.id}" onclick="toggleSelect('${s.id}',this)"><input type="checkbox" style="pointer-events:none;"><span>${s.nama}</span></div>`).join('');

    // Load target kelas
    const tujuanId = document.getElementById('kelasTujuan').value;
    if (tujuanId) loadTargetList(tujuanId);
    document.getElementById('kelasTujuan').onchange = () => loadTargetList(document.getElementById('kelasTujuan').value);
}

async function loadTargetList(kelasId) {
    const el = document.getElementById('targetList');
    if (!kelasId) { el.innerHTML = '<div class="empty-state" style="padding:2rem;"><p>Pilih kelas tujuan</p></div>'; return; }
    const { data } = await _supabase.from('siswa').select('*').eq('kelas_id', kelasId).eq('is_active', true).order('nama');
    el.innerHTML = (!data || data.length === 0)
        ? '<div class="empty-state" style="padding:2rem;"><p>Tidak ada siswa</p></div>'
        : data.map(s => `<div class="transfer-item"><span>${s.nama}</span></div>`).join('');
}

function toggleSelect(id, el) {
    if (selectedTransfer.has(id)) { selectedTransfer.delete(id); el.classList.remove('selected'); el.querySelector('input').checked = false; }
    else { selectedTransfer.add(id); el.classList.add('selected'); el.querySelector('input').checked = true; }
}

async function transferSelected() {
    const tujuan = document.getElementById('kelasTujuan').value;
    if (!tujuan) { Toast.warning('Pilih kelas tujuan'); return; }
    if (selectedTransfer.size === 0) { Toast.warning('Pilih siswa yang akan dipindahkan'); return; }
    if (document.getElementById('kelasAsal').value === tujuan) { Toast.warning('Kelas asal dan tujuan harus berbeda'); return; }

    const ids = Array.from(selectedTransfer);
    const { error } = await _supabase.from('siswa').update({ kelas_id: tujuan }).in('id', ids);
    if (error) { Toast.error('Gagal: ' + error.message); return; }
    Toast.success(`${ids.length} siswa berhasil dipindahkan`);
    await loadTransferSiswa();
    loadTargetList(tujuan);
}

// ---- KENAIKAN KELAS ----
async function previewKenaikan() {
    const tahun = document.getElementById('tahunAjaranBaru').value;
    const tMin = parseInt(document.getElementById('tingkatMin').value);
    const tMax = parseInt(document.getElementById('tingkatMax').value);
    const jmlKelas = parseInt(document.getElementById('jumlahKelasPerTingkat').value);

    if (!tahun) { Toast.warning('Isi tahun ajaran baru'); return; }
    if (tMin >= tMax) { Toast.warning('Tingkat terendah harus kurang dari tertinggi'); return; }

    const container = document.getElementById('previewKenaikan');
    container.style.display = '';
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    // Fetch all active students
    const { data: allSiswa } = await _supabase.from('siswa').select('*, kelas:kelas_id(tingkat, nama)').eq('is_active', true);
    if (!allSiswa || allSiswa.length === 0) { container.innerHTML = '<p>Tidak ada siswa aktif</p>'; return; }

    // Group by current tingkat
    const byTingkat = {};
    allSiswa.forEach(s => {
        const t = s.kelas ? s.kelas.tingkat : 0;
        if (!byTingkat[t]) byTingkat[t] = [];
        byTingkat[t].push(s);
    });

    const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let html = '';

    // Graduating students (tingkat max)
    const graduating = byTingkat[tMax] || [];
    if (graduating.length > 0) {
        html += `<div class="card" style="margin-bottom:1rem;border-color:var(--success);"><h3>🎓 Lulus (${graduating.length} siswa dari tingkat ${tMax})</h3><p style="color:var(--text-secondary);font-size:0.85rem;">Siswa ini akan ditandai lulus (is_active = false)</p></div>`;
    }

    // Promoted students
    for (let t = tMax - 1; t >= tMin; t--) {
        const students = byTingkat[t] || [];
        if (students.length === 0) continue;
        const newTingkat = t + 1;

        // Shuffle
        const shuffled = [...students].sort(() => Math.random() - 0.5);
        const perKelas = Math.ceil(shuffled.length / jmlKelas);

        html += `<div class="card" style="margin-bottom:1rem;">
            <h3>Tingkat ${t} → Tingkat ${newTingkat} (${students.length} siswa)</h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0.75rem;margin-top:1rem;">`;

        for (let k = 0; k < jmlKelas; k++) {
            const chunk = shuffled.slice(k * perKelas, (k + 1) * perKelas);
            if (chunk.length === 0) continue;
            const kelasNama = `${newTingkat}${labels[k]}`;
            html += `<div style="background:var(--bg-primary);border-radius:var(--radius-sm);padding:0.75rem;">
                <div style="font-weight:600;margin-bottom:0.5rem;">Kelas ${kelasNama} <span class="badge badge-info">${chunk.length}</span></div>
                <div style="font-size:0.8rem;color:var(--text-secondary);">${chunk.map(s => s.nama).join('<br>')}</div>
            </div>`;
        }
        html += '</div></div>';
    }

    html += `<div style="display:flex;gap:0.75rem;margin-top:1rem;">
        <button class="btn btn-primary btn-lg" onclick="executeKenaikan()">✅ Konfirmasi & Proses</button>
        <button class="btn btn-secondary btn-lg" onclick="previewKenaikan()">🔄 Acak Ulang</button>
    </div>`;

    container.innerHTML = html;
}

async function executeKenaikan() {
    if (!confirm('Proses kenaikan kelas? Aksi ini akan membuat kelas baru dan memindahkan semua siswa. Lanjutkan?')) return;

    const tahun = document.getElementById('tahunAjaranBaru').value;
    const tMin = parseInt(document.getElementById('tingkatMin').value);
    const tMax = parseInt(document.getElementById('tingkatMax').value);
    const jmlKelas = parseInt(document.getElementById('jumlahKelasPerTingkat').value);
    const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    Toast.info('Memproses kenaikan kelas...');

    try {
        // 1. Mark graduating students
        const { data: allSiswa } = await _supabase.from('siswa').select('*, kelas:kelas_id(tingkat)').eq('is_active', true);
        const graduating = allSiswa.filter(s => s.kelas && s.kelas.tingkat === tMax);
        if (graduating.length > 0) {
            await _supabase.from('siswa').update({ is_active: false }).in('id', graduating.map(s => s.id));
        }

        // 2. Create new classes
        const newKelasMap = {};
        for (let t = tMin; t <= tMax; t++) {
            for (let k = 0; k < jmlKelas; k++) {
                const nama = `${t}${labels[k]}`;
                const { data: kd, error } = await _supabase.from('kelas')
                    .insert({ nama, tingkat: t, tahun_ajaran: tahun })
                    .select().single();
                if (!error && kd) {
                    if (!newKelasMap[t]) newKelasMap[t] = [];
                    newKelasMap[t].push(kd.id);
                }
            }
        }

        // 3. Distribute promoted students
        for (let t = tMax - 1; t >= tMin; t--) {
            const students = allSiswa.filter(s => s.kelas && s.kelas.tingkat === t);
            if (students.length === 0) continue;
            const newTingkat = t + 1;
            const newClasses = newKelasMap[newTingkat] || [];
            if (newClasses.length === 0) continue;

            const shuffled = [...students].sort(() => Math.random() - 0.5);
            const perKelas = Math.ceil(shuffled.length / newClasses.length);

            for (let k = 0; k < newClasses.length; k++) {
                const chunk = shuffled.slice(k * perKelas, (k + 1) * perKelas);
                if (chunk.length > 0) {
                    await _supabase.from('siswa').update({ kelas_id: newClasses[k] }).in('id', chunk.map(s => s.id));
                }
            }
        }

        // 4. Deactivate old classes
        await _supabase.from('kelas').update({ is_active: false }).neq('tahun_ajaran', tahun).eq('is_active', true);

        Toast.success('Kenaikan kelas berhasil diproses!');
        document.getElementById('previewKenaikan').style.display = 'none';
        await loadKelas();
    } catch (err) {
        Toast.error('Gagal: ' + err.message);
    }
}
