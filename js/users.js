/**
 * Users Management Module - Admin only
 */
let currentProfile = null;
let usersList = [];
let kelasList = [];

(async function init() {
    currentProfile = await Auth.requireAdmin();
    if (!currentProfile) return;
    Auth.initSidebar(currentProfile, 'users');
    Modal.init();
    await loadKelas();
    await loadUsers();
})();

async function loadKelas() {
    const { data } = await _supabase.from('kelas').select('*').eq('is_active', true).order('nama');
    kelasList = data || [];
    const sel = document.getElementById('uKelas');
    sel.innerHTML = '<option value="">Pilih Kelas</option>' + kelasList.map(k => `<option value="${k.id}">${k.nama}</option>`).join('');
}

async function loadUsers() {
    const { data, error } = await _supabase.from('profiles').select('*, kelas:kelas_id(nama)').order('created_at', { ascending: false });
    if (error) { Toast.error('Gagal memuat data user'); return; }
    usersList = data || [];
    renderUsers();
}

function renderUsers() {
    const tbody = document.getElementById('usersTable');
    if (usersList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">👥</div><p>Belum ada user</p></div></td></tr>';
        return;
    }
    tbody.innerHTML = usersList.map((u, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${u.nama}</strong></td>
            <td>${u.email.replace('@gmail.com', '')}</td>
            <td><span class="badge ${u.role === 'admin' ? 'badge-info' : 'badge-success'}">${u.role === 'admin' ? 'Admin' : 'Wali Kelas'}</span></td>
            <td>${u.kelas ? u.kelas.nama : '-'}</td>
            <td>
                <div class="table-actions">
                    <button class="btn btn-ghost btn-sm" onclick="editUser('${u.id}')" title="Edit">✏️</button>
                    ${u.id !== currentProfile.id ? `<button class="btn btn-ghost btn-sm" onclick="deleteUser('${u.id}','${u.nama}')" title="Hapus">🗑️</button>` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

function toggleKelasField() {
    const role = document.getElementById('uRole').value;
    document.getElementById('kelasGroup').style.display = role === 'walas' ? '' : 'none';
}

function openAddUser() {
    document.getElementById('userModalTitle').textContent = 'Tambah User';
    document.getElementById('formUser').reset();
    document.getElementById('userId').value = '';
    document.getElementById('passwordGroup').style.display = '';
    document.getElementById('uPassword').required = true;
    toggleKelasField();
    Modal.open('modalUser');
}

function editUser(id) {
    const u = usersList.find(x => x.id === id);
    if (!u) return;
    document.getElementById('userModalTitle').textContent = 'Edit User';
    document.getElementById('userId').value = u.id;
    document.getElementById('uNama').value = u.nama;
    document.getElementById('uUsername').value = u.email.replace('@gmail.com', '');
    document.getElementById('uUsername').disabled = true;
    document.getElementById('passwordGroup').style.display = 'none';
    document.getElementById('uPassword').required = false;
    document.getElementById('uRole').value = u.role;
    document.getElementById('uKelas').value = u.kelas_id || '';
    toggleKelasField();
    Modal.open('modalUser');
}

async function saveUser(e) {
    e.preventDefault();
    const id = document.getElementById('userId').value;
    const role = document.getElementById('uRole').value;
    const kelasId = role === 'walas' ? document.getElementById('uKelas').value : null;

    if (id) {
        // Update existing profile
        const { error } = await _supabase.from('profiles').update({
            nama: document.getElementById('uNama').value,
            role: role,
            kelas_id: kelasId || null
        }).eq('id', id);
        if (error) { Toast.error('Gagal: ' + error.message); return; }
        Toast.success('User berhasil diupdate');
    } else {
        // Create new user
        try {
            await Auth.createUser(
                document.getElementById('uUsername').value,
                document.getElementById('uPassword').value,
                document.getElementById('uNama').value,
                role, kelasId
            );
            Toast.success('User berhasil ditambahkan. Email konfirmasi telah dikirim.');
        } catch (err) {
            Toast.error('Gagal: ' + err.message);
            return;
        }
    }

    document.getElementById('uUsername').disabled = false;
    Modal.close('modalUser');
    await loadUsers();
}

async function deleteUser(id, nama) {
    if (!confirm(`Hapus user "${nama}"? Aksi ini tidak bisa dibatalkan.`)) return;
    const { error } = await _supabase.from('profiles').delete().eq('id', id);
    if (error) { Toast.error('Gagal: ' + error.message); return; }
    Toast.success('User berhasil dihapus');
    await loadUsers();
}
