/**
 * Auth Module - Authentication & Authorization
 */
const Auth = {
    async login(username, password) {
        const email = username + '@gmail.com';
        const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    },
    async logout() {
        await _supabase.auth.signOut();
        window.location.href = 'index.html';
    },
    async getSession() {
        const { data: { session } } = await _supabase.auth.getSession();
        return session;
    },
    async getUserProfile() {
        const session = await this.getSession();
        if (!session) return null;
        const { data, error } = await _supabase.from('profiles')
            .select('*, kelas:kelas_id(id, nama, tingkat, tahun_ajaran)')
            .eq('id', session.user.id).single();
        if (error) throw error;
        return data;
    },
    async requireAuth() {
        const session = await this.getSession();
        if (!session) { window.location.href = 'index.html'; return null; }
        return await this.getUserProfile();
    },
    async requireAdmin() {
        const profile = await this.requireAuth();
        if (profile && profile.role !== 'admin') { window.location.href = 'dashboard.html'; return null; }
        return profile;
    },
    isAdmin(p) { return p && p.role === 'admin'; },
    getKelasFilter(p) { return this.isAdmin(p) ? null : p.kelas_id; },
    async createUser(username, password, nama, role, kelasId) {
        const email = username + '@gmail.com';
        const { data, error } = await _supabase.auth.signUp({
            email, password, options: { data: { nama, role } }
        });
        if (error) throw error;
        if (role === 'walas' && kelasId) {
            await _supabase.from('profiles').update({ kelas_id: kelasId }).eq('id', data.user.id);
        }
        return data;
    },
    initSidebar(profile, activePage) {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;
        const isAdmin = this.isAdmin(profile);
        const menu = [
            { id: 'dashboard', label: 'Dashboard', icon: '📊', href: 'dashboard.html', show: true },
            { id: 'kelas', label: 'Kelola Kelas', icon: '🏫', href: 'kelas.html', show: isAdmin },
            { id: 'users', label: 'Kelola User', icon: '👥', href: 'users.html', show: isAdmin },
        ];
        sidebar.innerHTML = `
            <div class="sidebar-header"><div class="sidebar-logo"><span class="logo-icon">🎓</span><span class="logo-text">Arsip Siswa</span></div></div>
            <nav class="sidebar-nav">${menu.filter(m => m.show).map(m => `<a href="${m.href}" class="nav-item ${activePage === m.id ? 'active' : ''}"><span class="nav-icon">${m.icon}</span><span class="nav-label">${m.label}</span></a>`).join('')}</nav>
            <div class="sidebar-footer">
                <div class="user-info"><div class="user-avatar">${profile.nama.charAt(0).toUpperCase()}</div><div class="user-details"><div class="user-name">${profile.nama}</div><div class="user-role">${isAdmin ? 'Administrator' : 'Wali Kelas ' + (profile.kelas ? profile.kelas.nama : '')}</div></div></div>
                <button class="btn-logout" onclick="Auth.logout()" title="Logout"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></button>
            </div>`;
    }
};

/** Toast Notifications */
const Toast = {
    container: null,
    init() {
        if (!this.container) { this.container = document.createElement('div'); this.container.className = 'toast-container'; document.body.appendChild(this.container); }
    },
    show(message, type = 'info', duration = 3500) {
        this.init();
        const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
        const t = document.createElement('div'); t.className = `toast toast-${type}`;
        t.innerHTML = `<span class="toast-icon">${icons[type]||icons.info}</span><span class="toast-message">${message}</span>`;
        this.container.appendChild(t);
        requestAnimationFrame(() => t.classList.add('show'));
        setTimeout(() => { t.classList.remove('show'); t.addEventListener('transitionend', () => t.remove()); }, duration);
    },
    success(m) { this.show(m, 'success'); }, error(m) { this.show(m, 'error', 5000); },
    info(m) { this.show(m, 'info'); }, warning(m) { this.show(m, 'warning', 4000); }
};

/** Modal Helper */
const Modal = {
    open(id) { const m = document.getElementById(id); if (m) { m.classList.add('active'); document.body.style.overflow = 'hidden'; } },
    close(id) { const m = document.getElementById(id); if (m) { m.classList.remove('active'); document.body.style.overflow = ''; } },
    init() { document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o) { o.classList.remove('active'); document.body.style.overflow = ''; } })); }
};

/** Utility Functions */
const Utils = {
    formatDate(d) { if (!d) return '-'; return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); },
    formatFileSize(b) { if (!b) return '0 B'; const k = 1024; const s = ['B','KB','MB','GB']; const i = Math.floor(Math.log(b)/Math.log(k)); return parseFloat((b/Math.pow(k,i)).toFixed(1))+' '+s[i]; },
    truncate(s, l=30) { return !s ? '' : s.length > l ? s.substring(0,l)+'...' : s; },
    getUrlParam(k) { return new URLSearchParams(window.location.search).get(k); },
    debounce(fn, d=300) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), d); }; }
};

/** Global Sidebar Toggle for Mobile */
window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.toggle('open');
    if (backdrop) backdrop.classList.toggle('active');
};
