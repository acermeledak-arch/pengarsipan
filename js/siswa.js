/**
 * Siswa Detail Module - Full Biodata, Documents, Upload/Preview/Download
 */
let currentProfile = null;
let siswaData = null;
let dokumenList = [];
let selectedFile = null;
let currentPreviewFileId = null;

// All siswa fields mapping for edit form
const FIELD_MAP = {
    epNama:'nama'
};

(async function init() {
    currentProfile = await Auth.requireAuth();
    if (!currentProfile) return;
    Auth.initSidebar(currentProfile, 'dashboard');
    Modal.init();
    const siswaId = Utils.getUrlParam('id');
    if (!siswaId) { window.location.href = 'dashboard.html'; return; }
    if (Auth.isAdmin(currentProfile)) document.getElementById('btnEditProfil').style.display = '';
    await loadSiswa(siswaId);
    await loadDokumen(siswaId);
    setupDragDrop();
})();

// Tab switching
function switchDetailTab(tab, btn) {
    document.querySelectorAll('.main-content > .tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.main-content > .tabs .tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    btn.classList.add('active');
}
function switchEditTab(tab, btn) {
    document.querySelectorAll('#formEditProfil > .tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#formEditProfil .tabs .tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    btn.classList.add('active');
}

async function loadSiswa(id) {
    const { data, error } = await _supabase.from('siswa').select('*, kelas:kelas_id(id, nama)').eq('id', id).single();
    if (error || !data) { Toast.error('Siswa tidak ditemukan'); window.location.href = 'dashboard.html'; return; }
    siswaData = data;
    document.getElementById('pageTitle').textContent = data.nama;
    renderProfile();
}

function pf(label, value) {
    return `<div class="profile-field"><label>${label}</label><p>${value || '-'}</p></div>`;
}

function renderProfile() {
    const s = siswaData;
    document.getElementById('profileCard').innerHTML = `
        <div class="profile-card">
            <div class="profile-avatar">${s.nama.charAt(0).toUpperCase()}</div>
            <div class="profile-info">
                <h2>${s.nama}</h2>
                <div style="display:flex;gap:0.5rem;margin-top:0.25rem;flex-wrap:wrap;">
                    <span class="badge badge-info">${s.kelas ? s.kelas.nama : '-'}</span>
                </div>
            </div>
        </div>`;
}

// ---- DOKUMEN ----
async function loadDokumen(siswaId) {
    const { data } = await _supabase.from('dokumen').select('*').eq('siswa_id', siswaId);
    dokumenList = data || [];
    renderDocs();
}

function renderDocs() {
    const isAdmin = Auth.isAdmin(currentProfile);
    const grid = document.getElementById('docsGrid');
    grid.innerHTML = JENIS_DOKUMEN.map(jd => {
        const doc = dokumenList.find(d => d.jenis === jd.key);
        const up = !!doc;
        return `<div class="doc-card">
            <div class="doc-card-header"><span class="doc-icon">${jd.icon}</span><div><div class="doc-title">${jd.label}</div><div class="doc-status ${up?'uploaded':'pending'}">${up?'✅ Ter-upload':'⏳ Belum upload'}</div></div></div>
            <div class="doc-preview" ${up?`onclick="previewDoc('${doc.drive_file_id}','${jd.label}','${doc.file_name}')" style="cursor:pointer"`:''}>
                ${up?`<span style="font-size:1.5rem;">📄</span><span style="font-size:0.75rem;color:var(--text-secondary);margin-left:0.5rem;">${Utils.truncate(doc.file_name,25)}</span>`:'<span class="placeholder-icon">📁</span>'}
            </div>
            <div class="doc-actions">
                ${isAdmin&&!up?`<button class="btn btn-primary btn-sm" onclick="openUpload('${jd.key}','${jd.label}')">📤 Upload</button>`:''}
                ${isAdmin&&up?`<button class="btn btn-secondary btn-sm" onclick="openUpload('${jd.key}','${jd.label}')">🔄 Ganti</button>`:''}
                ${up?`<button class="btn btn-secondary btn-sm" onclick="previewDoc('${doc.drive_file_id}','${jd.label}','${doc.file_name}')">👁 Preview</button>`:''}
                ${up?`<button class="btn btn-success btn-sm" onclick="doDownloadDirect('${doc.drive_file_id}','${doc.file_name}')">⬇ Download</button>`:''}
                ${isAdmin&&up?`<button class="btn btn-danger btn-sm" onclick="deleteDoc('${doc.id}','${doc.drive_file_id}','${jd.label}')">🗑</button>`:''}
            </div>
            ${up?`<div style="font-size:0.7rem;color:var(--text-muted);margin-top:0.75rem;">📅 ${Utils.formatDate(doc.uploaded_at)} · ${Utils.formatFileSize(doc.file_size)}</div>`:''}
        </div>`;
    }).join('');
}

// ---- UPLOAD ----
function openUpload(jenis, label) {
    document.getElementById('uploadJenis').value = jenis;
    document.getElementById('uploadTitle').textContent = 'Upload ' + label;
    clearFile(); Modal.open('modalUpload');
}
function onFileSelected(input, isCamera = false) {
    const file = input.files[0]; if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) { Toast.warning('Format tidak didukung. Gunakan JPG, PNG, atau PDF.'); return; }
    if (file.size > MAX_FILE_SIZE) { Toast.warning('Ukuran file melebihi 5MB.'); return; }
    
    // If image and camera, send to scanner editor
    if (file.type.startsWith('image/') && typeof initScanner === 'function') {
        initScanner(file);
        return;
    }

    selectedFile = file;
    document.getElementById('fileInfo').style.display = '';
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = Utils.formatFileSize(file.size);
    document.getElementById('btnUpload').disabled = false;
    
    // Show thumbnail if image
    const thumb = document.getElementById('filePreviewThumb');
    const icon = document.getElementById('fileIconFallback');
    if (file.type.startsWith('image/')) {
        thumb.src = URL.createObjectURL(file);
        thumb.style.display = 'block';
        if(icon) icon.style.display = 'none';
    } else {
        thumb.style.display = 'none';
        if(icon) icon.style.display = 'block';
    }
}
function clearFile() {
    selectedFile = null; 
    document.getElementById('fileInput').value = '';
    document.getElementById('cameraInput').value = '';
    document.getElementById('fileInfo').style.display = 'none';
    document.getElementById('btnUpload').disabled = true;
    document.getElementById('uploadProgress').classList.remove('active');
}
function setupDragDrop() {
    const area = document.getElementById('uploadArea'); if (!area) return;
    ['dragenter','dragover'].forEach(e => area.addEventListener(e, ev => { ev.preventDefault(); area.classList.add('dragover'); }));
    ['dragleave','drop'].forEach(e => area.addEventListener(e, ev => { ev.preventDefault(); area.classList.remove('dragover'); }));
    area.addEventListener('drop', ev => { const f=ev.dataTransfer.files[0]; if(f){document.getElementById('fileInput').files=ev.dataTransfer.files; onFileSelected(document.getElementById('fileInput'));} });
}
async function doUpload() {
    if (!selectedFile || !siswaData) return;
    const jenis = document.getElementById('uploadJenis').value;
    const btn = document.getElementById('btnUpload');
    btn.disabled = true; btn.textContent = 'Mengupload...';
    document.getElementById('uploadProgress').classList.add('active');
    try {
        let pct = 0;
        const pi = setInterval(() => { pct=Math.min(pct+10,90); document.getElementById('progressFill').style.width=pct+'%'; document.getElementById('progressText').textContent=pct+'%'; }, 200);
        const base64 = await fileToBase64(selectedFile);
        const className = siswaData.kelas ? siswaData.kelas.nama : 'Tanpa Kelas';
        const fileExt = selectedFile.name.split('.').pop();
        const formattedFileName = `${siswaData.nama}_${className}_${jenis}.${fileExt}`;
        
        const res = await fetch(APPS_SCRIPT_URL, { 
            method: 'POST', 
            body: JSON.stringify({ 
                action: 'upload', 
                fileData: base64, 
                fileName: formattedFileName, 
                mimeType: selectedFile.type, 
                className: className,
                studentName: siswaData.nama
            }) 
        });
        const result = await res.json(); clearInterval(pi);
        if (!result.success) throw new Error(result.error || 'Upload gagal');
        document.getElementById('progressFill').style.width='100%'; document.getElementById('progressText').textContent='100%';
        const existing = dokumenList.find(d => d.jenis === jenis);
        if (existing) { await _supabase.from('dokumen').delete().eq('id', existing.id); fetch(APPS_SCRIPT_URL,{method:'POST',body:JSON.stringify({action:'delete',fileId:existing.drive_file_id})}); }
        await _supabase.from('dokumen').insert({ siswa_id:siswaData.id, jenis, drive_file_id:result.fileId, drive_url:result.fileUrl, file_name:selectedFile.name, file_size:selectedFile.size });
        Modal.close('modalUpload'); Toast.success('Dokumen berhasil diupload!'); 
        await loadDokumen(siswaData.id);
        
        // Auto-next for wizard
        if (typeof Wizard !== 'undefined' && Wizard.isActive) {
            Wizard.nextDoc();
        }
    } catch (err) { Toast.error('Upload gagal: ' + err.message); }
    btn.disabled = false; btn.textContent = 'Upload';
}
function fileToBase64(file) { return new Promise((res,rej) => { const r=new FileReader(); r.onload=()=>res(r.result.split(',')[1]); r.onerror=rej; r.readAsDataURL(file); }); }

// ---- PREVIEW ----
async function previewDoc(fileId, title, fileName) {
    currentPreviewFileId = fileId; document.getElementById('previewTitle').textContent = title;
    document.getElementById('previewContainer').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    Modal.open('modalPreview');
    try {
        const res = await fetch(`${APPS_SCRIPT_URL}?action=getFile&fileId=${fileId}`);
        const data = await res.json(); if (!data.success) throw new Error(data.error);
        const c = document.getElementById('previewContainer');
        if (data.mimeType.startsWith('image/')) c.innerHTML = `<img src="data:${data.mimeType};base64,${data.fileData}" alt="${fileName}">`;
        else if (data.mimeType==='application/pdf') { const b=base64ToBlob(data.fileData,'application/pdf'); c.innerHTML=`<iframe src="${URL.createObjectURL(b)}"></iframe>`; }
        else c.innerHTML = '<div class="empty-state"><p>Format tidak bisa di-preview</p></div>';
    } catch (err) { document.getElementById('previewContainer').innerHTML = `<div class="empty-state"><p>Gagal: ${err.message}</p></div>`; }
}
function base64ToBlob(b64,type) { const b=atob(b64); const a=new Uint8Array(b.length); for(let i=0;i<b.length;i++) a[i]=b.charCodeAt(i); return new Blob([a],{type}); }
function doDownload() { if (currentPreviewFileId) doDownloadDirect(currentPreviewFileId, document.getElementById('previewTitle').textContent); }
async function doDownloadDirect(fileId, fileName) {
    Toast.info('Mengunduh...'); try {
        const res=await fetch(`${APPS_SCRIPT_URL}?action=getFile&fileId=${fileId}`); const data=await res.json();
        if (!data.success) throw new Error(data.error); 
        
        // Convert WebP to JPG on client side before download
        if (data.mimeType === 'image/webp') {
            const img = new Image();
            img.src = `data:image/webp;base64,${data.fileData}`;
            await new Promise(r => img.onload = r);
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0,0,canvas.width,canvas.height);
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            const b64 = dataUrl.split(',')[1];
            const blob = base64ToBlob(b64, 'image/jpeg');
            const a=document.createElement('a'); a.href=URL.createObjectURL(blob); 
            a.download=(data.fileName||fileName).replace('.webp','.jpg'); 
            a.click(); Toast.success('File diunduh (JPG)');
            return;
        }

        const blob=base64ToBlob(data.fileData,data.mimeType);
        const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=data.fileName||fileName; a.click(); Toast.success('File diunduh');
    } catch(err) { Toast.error('Download gagal: '+err.message); }
}
function doPrint() {
    const c=document.getElementById('previewContainer').innerHTML;
    const w=window.open('','_blank'); w.document.write(`<html><head><title>Cetak</title><style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#fff;}img{max-width:100%;height:auto;}iframe{width:100%;height:100vh;border:none;}</style></head><body>${c}</body></html>`);
    w.document.close(); w.onload=()=>w.print();
}
async function deleteDoc(docId, driveFileId, label) {
    if (!confirm(`Hapus dokumen "${label}"?`)) return;
    await _supabase.from('dokumen').delete().eq('id', docId);
    fetch(APPS_SCRIPT_URL,{method:'POST',body:JSON.stringify({action:'delete',fileId:driveFileId})});
    Toast.success('Dokumen dihapus'); await loadDokumen(siswaData.id);
}

// ---- EDIT PROFILE ----
async function openEditProfil() {
    const {data:kl} = await _supabase.from('kelas').select('*').eq('is_active',true).order('nama');
    document.getElementById('epKelas').innerHTML = '<option value="">Pilih</option>' + (kl||[]).map(k=>`<option value="${k.id}" ${siswaData.kelas_id===k.id?'selected':''}>${k.nama}</option>`).join('');
    // Populate all fields
    for (const [elId, dbKey] of Object.entries(FIELD_MAP)) {
        const el = document.getElementById(elId);
        if (el) el.value = siswaData[dbKey] || '';
    }
    Modal.open('modalEditProfil');
}

async function saveProfile(e) {
    e.preventDefault();
    const payload = { kelas_id: document.getElementById('epKelas').value || null };
    for (const [elId, dbKey] of Object.entries(FIELD_MAP)) {
        const el = document.getElementById(elId);
        if (el) payload[dbKey] = el.value || null;
    }


    const { error } = await _supabase.from('siswa').update(payload).eq('id', siswaData.id);
    if (error) { Toast.error('Gagal: ' + error.message); return; }
    Modal.close('modalEditProfil'); Toast.success('Biodata berhasil diupdate');
    await loadSiswa(siswaData.id);
}
