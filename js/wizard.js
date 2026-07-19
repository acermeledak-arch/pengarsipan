// js/wizard.js

const Wizard = {
    classId: null,
    students: [],
    currentStudentIndex: 0,
    requiredDocs: [], // Akan diisi dari config.js
    currentDocIndex: 0,
    isActive: false,
    
    async init() {
        this.requiredDocs = typeof JENIS_DOKUMEN !== 'undefined' ? JENIS_DOKUMEN : [];
        
        const wizardParam = Utils.getUrlParam('wizard');
        const indexParam = Utils.getUrlParam('index');
        
        if (!wizardParam) return;
        
        this.classId = wizardParam;
        this.currentStudentIndex = parseInt(indexParam) || 0;
        this.isActive = true;
        
        Toast.info('Memulai Batch Scanning...');
        
        // Fetch all students in class
        const { data: siswaList } = await _supabase.from('siswa').select('id, nama').eq('kelas_id', this.classId).eq('is_active', true).order('nama');
        
        if (!siswaList || siswaList.length === 0) {
            Toast.error('Tidak ada siswa di kelas ini.');
            return;
        }
        
        this.students = siswaList;
        document.getElementById('wizardOverlay').style.display = 'flex';
        
        this.processCurrentStudent();
    },
    
    async processCurrentStudent() {
        if (this.currentStudentIndex >= this.students.length) {
            this.finish();
            return;
        }
        
        this.currentDocIndex = 0;
        const student = this.students[this.currentStudentIndex];
        
        // Load student data into the page by silently updating URL & calling loadSiswa
        window.history.replaceState({}, '', `siswa.html?id=${student.id}&wizard=${this.classId}&index=${this.currentStudentIndex}`);
        
        // loadSiswa loads the profile, and we also need to load documents
        if (typeof loadSiswa === 'function') {
            await loadSiswa(student.id);
            if (typeof loadDokumen === 'function') {
                await loadDokumen(student.id);
            }
        }
        
        this.promptCurrentDoc();
    },
    
    promptCurrentDoc() {
        if (!this.isActive) return;
        
        if (this.currentDocIndex >= this.requiredDocs.length) {
            // Done with this student, move to next
            this.currentStudentIndex++;
            this.processCurrentStudent();
            return;
        }
        
        const docObj = this.requiredDocs[this.currentDocIndex];
        const docKey = docObj.key;
        const docLabel = docObj.label;
        const student = this.students[this.currentStudentIndex];
        
        document.getElementById('wizardStatusText').textContent = `Siswa: ${student.nama} (${this.currentStudentIndex + 1}/${this.students.length})`;
        document.getElementById('wizardDocText').textContent = `File ${this.currentDocIndex + 1}/${this.requiredDocs.length}: ${docLabel}`;
        
        // Check if doc exists
        // loadDokumen sets window.dokumenList
        const exists = window.dokumenList && window.dokumenList.some(d => d.jenis === docKey);
        
        const actionsEl = document.getElementById('wizardActions');
        
        if (exists) {
            actionsEl.innerHTML = `
                <span style="background:rgba(255,255,255,0.2); padding:0.4rem 0.8rem; border-radius:4px; font-size:0.85rem; white-space:nowrap;">✅ Sudah Ada</span>
                <button class="btn btn-sm" style="background:white; color:var(--accent-1); font-weight:bold; border:none;" onclick="Wizard.nextDoc()">⏭ Lewati</button>
                <button class="btn btn-sm btn-ghost" style="color:white; border:1px solid rgba(255,255,255,0.5);" onclick="Wizard.openScanner('${docKey}')">📸 Foto Ulang</button>
                <button class="btn btn-sm btn-ghost" style="color:white; border:1px solid rgba(255,255,255,0.5);" onclick="Wizard.openGallery('${docKey}')">📁 Galeri</button>
            `;
        } else {
            actionsEl.innerHTML = `
                <button class="btn btn-sm" style="background:white; color:var(--accent-1); font-weight:bold; border:none;" onclick="Wizard.openScanner('${docKey}')">📸 Kamera</button>
                <button class="btn btn-sm btn-ghost" style="color:white; border:1px solid rgba(255,255,255,0.5);" onclick="Wizard.openGallery('${docKey}')">📁 Galeri</button>
                <button class="btn btn-sm btn-ghost" style="color:white; background:rgba(255,255,255,0.2);" onclick="Wizard.nextDoc()">⏭ Lewati</button>
            `;
        }
    },
    
    openScanner(docName) {
        document.getElementById('uploadJenis').value = docName;
        document.getElementById('cameraInput').click();
    },
    
    openGallery(docName) {
        document.getElementById('uploadJenis').value = docName;
        document.getElementById('fileInput').click();
    },
    
    nextDoc() {
        this.currentDocIndex++;
        this.promptCurrentDoc();
    },
    
    stop() {
        this.isActive = false;
        document.getElementById('wizardOverlay').style.display = 'none';
        Toast.info('Batch Scanning dihentikan.');
        
        // Remove wizard params from URL so it doesn't auto-start on refresh
        if (window.siswaData) {
            window.history.replaceState({}, '', `siswa.html?id=${window.siswaData.id}`);
        }
    },
    
    finish() {
        this.isActive = false;
        document.getElementById('wizardOverlay').style.display = 'none';
        Toast.success('Selesai! Seluruh siswa di kelas ini telah dipindai.');
        setTimeout(() => {
            window.location.href = `kelas.html`;
        }, 2000);
    }
};

// Hook into document load. 
// We wait for a bit to ensure Supabase auth resolves and loadSiswa is ready.
window.addEventListener('load', () => {
    setTimeout(() => {
        Wizard.init();
    }, 800); // 800ms to allow config.js and auth.js to initialize Session
});
