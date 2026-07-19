/**
 * Dashboard Module - CRUD Siswa, Search, Filter, Stats
 */
let currentProfile = null;
let allSiswa = [];
let kelasList = [];
let currentPage = 1;
const perPage = 15;

// ---- INIT ----
(async function init() {
    currentProfile = await Auth.requireAuth();
    if (!currentProfile) return;
    Auth.initSidebar(currentProfile, 'dashboard');
    Modal.init();

    if (Auth.isAdmin(currentProfile)) {
        document.getElementById('btnTambah').style.display = '';
        document.getElementById('btnBulkUpload').style.display = '';
    }

    await loadKelas();
    await loadSiswa();

    document.getElementById('searchInput').addEventListener('input', Utils.debounce(renderTable));
    document.getElementById('filterKelas').addEventListener('change', renderTable);
})();

async function loadKelas() {
    const { data } = await _supabase.from('kelas').select('*').eq('is_active', true).order('tingkat').order('nama');
    kelasList = data || [];

    const filter = document.getElementById('filterKelas');
    const fKelas = document.getElementById('fKelas');

    kelasList.forEach(k => {
        filter.innerHTML += `<option value="${k.id}">${k.nama}</option>`;
        if (fKelas) fKelas.innerHTML += `<option value="${k.id}">${k.nama}</option>`;
    });

    // Walas: auto-select their class
    if (!Auth.isAdmin(currentProfile) && currentProfile.kelas_id) {
        filter.value = currentProfile.kelas_id;
        filter.disabled = true;
    }
}

async function loadSiswa() {
    let query = _supabase.from('siswa')
        .select('*, kelas:kelas_id(nama), dokumen(jenis)')
        .eq('is_active', true)
        .order('nama');

    const kelasFilter = Auth.getKelasFilter(currentProfile);
    if (kelasFilter) query = query.eq('kelas_id', kelasFilter);

    const { data, error } = await query;
    if (error) { Toast.error('Gagal memuat data siswa'); console.error(error); return; }
    allSiswa = data || [];
    updateStats();
    renderTable();
}

function updateStats() {
    const total = allSiswa.length;
    let lengkap = 0, totalDocs = 0;
    allSiswa.forEach(s => {
        const count = s.dokumen ? s.dokumen.length : 0;
        totalDocs += count;
        if (count >= 7) lengkap++;
    });
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statLengkap').textContent = lengkap;
    document.getElementById('statBelum').textContent = total - lengkap;
    document.getElementById('statDocs').textContent = totalDocs;
}

function getFilteredSiswa() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const kelas = document.getElementById('filterKelas').value;
    return allSiswa.filter(s => {
        const matchSearch = !search || s.nama.toLowerCase().includes(search);
        const matchKelas = !kelas || s.kelas_id === kelas;
        return matchSearch && matchKelas;
    });
}

function renderTable() {
    const filtered = getFilteredSiswa();
    const totalPages = Math.ceil(filtered.length / perPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * perPage;
    const pageData = filtered.slice(start, start + perPage);
    const isAdmin = Auth.isAdmin(currentProfile);

    const tbody = document.getElementById('siswaTable');
    if (pageData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📭</div><p>Tidak ada data siswa</p></div></td></tr>`;
    } else {
        tbody.innerHTML = pageData.map((s, i) => {
            const docCount = s.dokumen ? s.dokumen.length : 0;
            const pct = Math.round((docCount / 7) * 100);
            return `<tr style="cursor:pointer" onclick="window.location.href='siswa.html?id=${s.id}'">
                <td>${start + i + 1}</td>
                <td><strong>${s.nama}</strong></td>
                <td><span class="badge badge-info">${s.kelas ? s.kelas.nama : '-'}</span></td>
                <td>
                    <div style="display:flex;align-items:center;gap:0.5rem;">
                        <div class="progress-bar" style="flex:1;"><div class="progress-fill ${pct===100?'complete':''}" style="width:${pct}%"></div></div>
                        <span style="font-size:0.75rem;color:var(--text-secondary);min-width:35px;">${docCount}/7</span>
                    </div>
                </td>
                <td>
                    <div class="table-actions" onclick="event.stopPropagation()">
                        ${isAdmin ? `<button class="btn btn-ghost btn-sm" onclick="openEditModal('${s.id}')" title="Edit">✏️</button>
                        <button class="btn btn-ghost btn-sm" onclick="confirmDelete('${s.id}','${s.nama}')" title="Hapus">🗑️</button>` : ''}
                        <button class="btn btn-ghost btn-sm" onclick="window.location.href='siswa.html?id=${s.id}'" title="Detail">👁️</button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    // Pagination
    document.getElementById('paginationInfo').textContent = `Menampilkan ${start+1}-${Math.min(start+perPage, filtered.length)} dari ${filtered.length} siswa`;
    const pagBtns = document.getElementById('paginationButtons');
    pagBtns.innerHTML = '';
    if (totalPages > 1) {
        pagBtns.innerHTML += `<button ${currentPage===1?'disabled':''} onclick="goPage(${currentPage-1})">&lt;</button>`;
        for (let p = 1; p <= totalPages; p++) {
            if (totalPages > 7 && p > 2 && p < totalPages - 1 && Math.abs(p - currentPage) > 1) {
                if (p === 3 || p === totalPages - 2) pagBtns.innerHTML += `<button disabled>...</button>`;
                continue;
            }
            pagBtns.innerHTML += `<button class="${p===currentPage?'active':''}" onclick="goPage(${p})">${p}</button>`;
        }
        pagBtns.innerHTML += `<button ${currentPage===totalPages?'disabled':''} onclick="goPage(${currentPage+1})">&gt;</button>`;
    }
}

function goPage(p) { currentPage = p; renderTable(); }

// ---- CRUD ----
function openAddModal() {
    document.getElementById('modalTitle').textContent = 'Tambah Siswa';
    document.getElementById('formSiswa').reset();
    document.getElementById('siswaId').value = '';
    Modal.open('modalSiswa');
}

function openEditModal(id) {
    const s = allSiswa.find(x => x.id === id);
    if (!s) return;
    document.getElementById('modalTitle').textContent = 'Edit Siswa';
    document.getElementById('siswaId').value = s.id;
    document.getElementById('fNama').value = s.nama;
    document.getElementById('fKelas').value = s.kelas_id || '';
    Modal.open('modalSiswa');
}

async function saveSiswa(e) {
    e.preventDefault();
    const id = document.getElementById('siswaId').value;
    const payload = {
        nama: document.getElementById('fNama').value,
        kelas_id: document.getElementById('fKelas').value || null
    };

    let error;
    if (id) {
        ({ error } = await _supabase.from('siswa').update(payload).eq('id', id));
    } else {
        ({ error } = await _supabase.from('siswa').insert(payload));
    }

    if (error) { Toast.error('Gagal menyimpan: ' + error.message); return; }
    Modal.close('modalSiswa');
    Toast.success(id ? 'Siswa berhasil diupdate' : 'Siswa berhasil ditambahkan');
    await loadSiswa();
}

let deleteTargetId = null;
function confirmDelete(id, nama) {
    deleteTargetId = id;
    document.getElementById('hapusNama').textContent = nama;
    document.getElementById('btnConfirmHapus').onclick = doDelete;
    Modal.open('modalHapus');
}

async function doDelete() {
    if (!deleteTargetId) return;
    const { error } = await _supabase.from('siswa').delete().eq('id', deleteTargetId);
    if (error) { Toast.error('Gagal menghapus: ' + error.message); return; }
    Modal.close('modalHapus');
    Toast.success('Siswa berhasil dihapus');
    await loadSiswa();
}

// ---- BULK UPLOAD CSV ----
let csvDataToProcess = [];

function openBulkModal() {
    csvDataToProcess = [];
    document.getElementById('csvInput').value = '';
    document.getElementById('csvFileInfo').style.display = 'none';
    document.getElementById('btnProcessCsv').disabled = true;
    Modal.open('modalBulk');
}

function handleCSVSelected(input) {
    const file = input.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
        Toast.warning('Harus berupa file CSV');
        return;
    }
    
    document.getElementById('csvFileInfo').style.display = 'block';
    document.getElementById('csvFileName').textContent = file.name;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        parseCSV(text);
    };
    reader.readAsText(file);
}

function parseCSV(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 2) {
        Toast.error('File CSV kosong atau tidak ada data');
        return;
    }
    
    // Check header
    const header = lines[0].toLowerCase().split(',');
    if (!header.includes('nama') || !header.includes('kelas')) {
        Toast.error('Header tidak valid. Harus ada kolom "nama" dan "kelas"');
        return;
    }
    
    const namaIdx = header.indexOf('nama');
    const kelasIdx = header.indexOf('kelas');
    
    csvDataToProcess = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length > Math.max(namaIdx, kelasIdx)) {
            const nama = cols[namaIdx].trim();
            const kelas = cols[kelasIdx].trim();
            if (nama && kelas) {
                csvDataToProcess.push({ nama, kelasNama: kelas });
            }
        }
    }
    
    document.getElementById('btnProcessCsv').disabled = csvDataToProcess.length === 0;
    if (csvDataToProcess.length > 0) {
        Toast.info(`Ditemukan ${csvDataToProcess.length} data siap diproses`);
    } else {
        Toast.warning('Tidak ada data valid yang ditemukan dalam CSV');
    }
}

async function processCSV() {
    if (csvDataToProcess.length === 0) return;
    const btn = document.getElementById('btnProcessCsv');
    btn.disabled = true;
    btn.textContent = 'Memproses...';
    
    try {
        let insertedCount = 0;
        
        // Buat map nama kelas ke ID agar lebih efisien
        const kelasMap = {};
        kelasList.forEach(k => { kelasMap[k.nama.toLowerCase()] = k.id; });
        
        const payloadToInsert = [];
        
        for (const data of csvDataToProcess) {
            const kn = data.kelasNama.toLowerCase();
            if (kelasMap[kn]) {
                payloadToInsert.push({
                    nama: data.nama,
                    kelas_id: kelasMap[kn]
                });
            } else {
                console.warn(`Kelas ${data.kelasNama} tidak ditemukan untuk siswa ${data.nama}`);
            }
        }
        
        if (payloadToInsert.length > 0) {
            const { error } = await _supabase.from('siswa').insert(payloadToInsert);
            if (error) throw error;
            insertedCount = payloadToInsert.length;
        }
        
        Modal.close('modalBulk');
        Toast.success(`${insertedCount} data siswa berhasil diimpor!`);
        await loadSiswa();
        
    } catch (err) {
        Toast.error('Gagal memproses CSV: ' + err.message);
    }
    
    btn.disabled = false;
    btn.textContent = 'Proses Data';
}
