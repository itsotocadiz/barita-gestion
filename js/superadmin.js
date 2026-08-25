/* ================================================================
   superadmin.js — Módulo del Super Administrador (BARITA)
   ================================================================ */

(() => {
const SuperAdminView = {
  currentTab: 'colegios',
  currentSystem: 'gestion',
  colegiosList: [],
  docentesList: [],
  directoresList: [],
  usersList: [],

  logout() {
    if (typeof Auth !== 'undefined' && typeof Auth.handleLogout === 'function') {
      try { return Auth.handleLogout(); } catch (_e) {}
    }
    if (typeof Auth !== 'undefined' && typeof Auth.logout === 'function') {
      try { return Auth.logout(); } catch (_e) {}
    }
    try { sessionStorage.removeItem('superadmin_original'); } catch (_e) {}
    try { localStorage.removeItem('barita_active_school'); localStorage.removeItem('barita_active_year'); } catch (_e) {}
    try { localStorage.removeItem('barita-gestion-auth-token'); localStorage.removeItem('barita-postulaciones-auth-token'); } catch (_e) {}
    try { history.replaceState(null, '', window.location.pathname + '#/'); } catch (_e) {}
    try { window.location.hash = '#/'; } catch (_e) {}
    try { if (typeof Auth !== 'undefined' && Auth.showLogin) Auth.showLogin(); } catch (_e) {}
    try { window.location.reload(); } catch (_e) {}
  },

  async render(container) {
    App.setBreadcrumb('Panel de Control - Super Administrador');

    if (Auth.currentRole !== 'superadmin') {
      container.innerHTML = `<div class="card text-danger"><h2>Acceso Denegado</h2><p>Esta sección es exclusiva para el Super Administrador.</p></div>`;
      return;
    }

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem; color: var(--text-secondary);">
        <div class="spinner" style="width: 40px; height: 40px; border: 4px solid var(--border-color); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 1rem;"></div>
        <div>Cargando datos globales del sistema...</div>
      </div>
    `;

    try {
      await this.loadData();
      this.renderLayout(container);
    } catch (e) {

      container.innerHTML = `<div class="card text-danger"><h2>Error al cargar datos</h2><p>${e.message}</p></div>`;
    }
  },

  renderSystemSelector(container) {
    container.innerHTML = `
      <div class="card" style="max-width: 900px; margin: 0 auto;">
        <div class="card-header" style="background: var(--primary); color: white;">
          <h3 class="card-title inline-flex items-center gap-2" style="margin: 0;">${Icons.get('crown', 20)} Panel Super Administrador</h3>
        </div>
        <div class="card-body">
          <p class="text-muted">Administración global del SaaS Gestión.</p>
          <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 1rem;">
            <button class="btn btn-primary inline-flex items-center justify-center gap-2" onclick="SuperAdminView.switchSystem('gestion')" style="flex: 1; min-width: 220px; padding: 1.5rem; font-size: 1.1rem; font-weight: 700;">
              ${Icons.get('school', 20)} Sistema de Gestión
            </button>
          </div>
        </div>
      </div>
    `;
  },

  switchSystem(system) {
    this.currentSystem = system;
    if (system === 'gestion') {
      this.currentTab = 'colegios';
    } else {
      this.currentTab = 'docentes';
    }
    this.renderLayout(document.getElementById('app-content'));
  },

  pendingSchoolId: null,
  pendingRole: 'admin',

  async changeActiveSchool(schoolId) {
    if(Auth.currentRole !== 'superadmin' && !sessionStorage.getItem('superadmin_original')){ App.showToast('Solo SUPER_ADMIN puede cambiar de colegio','danger'); return; }
    if (typeof Storage !== 'undefined' && Storage.setActiveSchool) {
      await Storage.setActiveSchool(schoolId);
    } else {
      localStorage.setItem('barita_active_school', schoolId);
      Storage.activeSchool = schoolId;
    }
    App.showToast(`Cambiado a colegio: ${schoolId === 'terra_di_bimbi' ? 'TERRA DI BIMBI' : (schoolId === 'demo' ? 'DEMO' : schoolId)}`, 'success');
    window.location.hash = '#/dashboard';
    this.showAppForImpersonation();
  },

  ingresarAColegio(schoolId) {
    const colegio = this.colegiosList.find(c=>c.id===schoolId) || { id: schoolId, nombre: schoolId==='terra_di_bimbi' ? 'TERRA DI BIMBI' : (schoolId==='demo'?'Escuela DEMO':schoolId), rbd: schoolId==='terra_di_bimbi'?'RBD-002':'RBD-001', estado_suscripcion: 'activo', motivo_bloqueo: '' };
    if(this._isBloqueado(colegio)){ App.showToast('Colegio bloqueado por suscripción — desbloquee en Editar','warning'); return; }
    this.pendingSchoolId = schoolId;
    this.pendingRole = 'admin';
    this.openRoleBridgeModal(colegio);
  },

  openRoleBridgeModal(colegio){
    const roles = [
      {key:'admin', label:'Admin Local', desc:'Gestión total', icon:'shield-check'},
      {key:'directora', label:'Directora', desc:'Visión directiva', icon:'crown'},
      {key:'utp', label:'UTP', desc:'Currículum', icon:'book-open'},
      {key:'pie', label:'PIE', desc:'Inclusión', icon:'puzzle'},
      {key:'convivencia', label:'Convivencia', desc:'Clima escolar', icon:'heart-handshake'},
      {key:'profesor', label:'Profesor', desc:'Aula', icon:'briefcase'},
      {key:'inspectoria', label:'Inspectoría', desc:'Asistencia', icon:'clock'},
      {key:'finanzas', label:'Finanzas', desc:'Pagos', icon:'dollar-sign'},
      {key:'coordinadora', label:'Coordinadora', desc:'Operación', icon:'user-check'},
    ];
    const bloqueado = this._isBloqueado(colegio);
    const grid = roles.map(r=>`
      <button type="button" class="barita-role-card ${this.pendingRole===r.key?'is-selected':''}" data-role="${r.key}" onclick="SuperAdminView.selectBridgeRole('${r.key}')" aria-pressed="${this.pendingRole===r.key?'true':'false'}" aria-label="Emular rol ${r.label}">
        <span class="barita-role-icon">${Icons.get(r.icon,18)}</span>
        <span class="barita-role-label">${r.label}</span>
        <span class="barita-role-desc">${r.desc}</span>
        <span class="barita-role-check">✓ Seleccionado</span>
      </button>`).join('');
    const html=`
      <div class="barita-impersonate-head">
        <h3>${Icons.get('school',20)} Ingresar a ${this._esc(colegio.nombre)}</h3>
        <span class="badge ${bloqueado?'badge-danger':'badge-success'}">${bloqueado?'Bloqueado':'Activo'}</span>
        <span class="text-muted" style="font-size:.75rem">${this._esc(colegio.rbd||'')}</span>
      </div>
      <p class="text-muted" style="font-size:.85rem; margin-bottom:1rem">Elige el rol a emular. Podrás cambiarlo dentro del colegio sin volver a Super Admin (selector en el header).</p>
      <div class="barita-role-grid" role="group" aria-label="Selector de rol a emular">${grid}</div>
      <div style="margin-top:1rem; display:flex; align-items:center; gap:.5rem; background:var(--bg-hover); border:1px solid var(--border-card); padding:.6rem .8rem; border-radius:var(--radius-md)">
        <span style="font-size:.8rem; font-weight:600; color:var(--text-secondary)">Rol seleccionado:</span>
        <strong id="bridge-role-label" style="color:var(--primary); font-size:.85rem">${roles.find(x=>x.key===this.pendingRole)?.label}</strong>
        <select class="form-control" style="margin-left:auto; width:auto; padding:.25rem .5rem; font-weight:700; color:var(--primary); background:transparent; border:none; cursor:pointer" aria-label="Cambiar rol rápido" onchange="SuperAdminView.selectBridgeRole(this.value)">${roles.map(r=>`<option value="${r.key}" ${r.key===this.pendingRole?'selected':''}>${r.label}</option>`).join('')}</select>
      </div>`;
    const footer=`
      <button class="btn btn-secondary" onclick="App.closeModal()" autofocus>Cancelar</button>
      <button class="btn btn-primary" onclick="SuperAdminView.confirmBridgeIngress()" style="font-weight:700">Ingresar como <span id="bridge-cta-role">${roles.find(x=>x.key===this.pendingRole)?.label}</span> →</button>`;
    App.openModal('Ingresar a colegio', html, footer, { ariaLabel:'Selector de rol a emular'});
  },
  selectBridgeRole(role){
    this.pendingRole = role;
    document.querySelectorAll('.barita-role-card').forEach(el=>{
      const is=el.dataset.role===role;
      el.classList.toggle('is-selected',is);
      el.setAttribute('aria-pressed', is?'true':'false');
    });
    const label = document.querySelector(`.barita-role-card[data-role="${role}"] .barita-role-label`)?.textContent || role;
    const a=document.getElementById('bridge-role-label'); if(a) a.textContent=label;
    const b=document.getElementById('bridge-cta-role'); if(b) b.textContent=label;
    const sel=document.querySelector('[aria-label="Cambiar rol rápido"]'); if(sel) sel.value=role;
  },
  async confirmBridgeIngress(){
    const schoolId = this.pendingSchoolId; const role = this.pendingRole;
    if(!schoolId) return;
    App.closeModal();
    if(Storage.setActiveSchool) await Storage.setActiveSchool(schoolId);
    else { localStorage.setItem('barita_active_school', schoolId); Storage.activeSchool=schoolId; }
    const profile = { email: Auth.currentUser.email, nombres: Auth.userProfile?.nombres||'Super', apellidos: Auth.userProfile?.apellidos||'Admin', colegio_id: schoolId, colegioId: schoolId };
    await this.impersonateFromRoleSwitcher(Auth.currentUser.uid, role, profile);
  },

  async impersonateFromRoleSwitcher(uid, role, profile) {
    const allowed = ['admin','coordinadora','directora','profesor','utp','pie','convivencia','inspectoria','finanzas'];
    if(role === 'superadmin'){ App.showToast('No se puede emular superadmin','warning'); return; }
    if(!allowed.includes(role)){ App.showToast('Rol no permitido para emulación','danger'); return; }
    if (Auth.currentRole !== 'superadmin' && !sessionStorage.getItem('superadmin_original')) {
      App.showToast('Solo SUPER_ADMIN puede suplantar','danger'); return;
    }
    // Determinar colegio objetivo (el seleccionado en Ingresar o el actual)
    const targetColegio = (profile && (profile.colegio_id||profile.colegioId)) || this.pendingSchoolId || Storage.activeSchool || 'demo';
    if (!sessionStorage.getItem('superadmin_original')) {
      sessionStorage.setItem('superadmin_original', JSON.stringify({
        uid: Auth.currentUser.uid,
        role: Auth.currentRole,
        profile: Auth.userProfile,
        colegio_id: Storage.activeSchool,
        ts: Date.now()
      }));
    }
    const enrichedProfile = { ...profile, colegio_id: targetColegio, colegioId: targetColegio };
    Auth.currentRole = role;
    Auth.userProfile = enrichedProfile;
    Auth.currentUser = { uid, email: profile.email };
    // FIX: sincronizar Storage para evitar desfase header TERRA vs body DEMO (todos los roles)
    if (typeof Storage !== 'undefined' && Storage.setActiveSchool && Storage.activeSchool !== targetColegio) {
      try { await Storage.setActiveSchool(targetColegio); } catch (_e) { try { localStorage.setItem('barita_active_school', targetColegio); Storage.activeSchool = targetColegio; } catch(__e){} }
    }
    try { localStorage.setItem('barita_user_role', role); } catch(_e){}
    // FIX: forzar re-render dashboard aunque hash ya sea #/dashboard
    if (typeof App !== 'undefined') App._lastRouteHash = null;
    App.showToast(`Simulando rol: ${role}`, 'info');
    if (typeof Auth !== 'undefined' && Auth.checkImpersonationBanner) Auth.checkImpersonationBanner();
    window.location.hash = '#/dashboard';
    this.showAppForImpersonation();
    setTimeout(()=>{ if(typeof App!=='undefined' && App.handleRoute){ App._lastRouteHash=null; App.handleRoute(); } }, 50);
  },

  showAppForImpersonation() {
    const overlay = document.getElementById('login-overlay');
    if (overlay) overlay.style.display = 'none';
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    if (sidebar) sidebar.style.display = 'flex';
    if (mainContent) {
      mainContent.style.display = 'block';
      mainContent.style.marginLeft = '';
      mainContent.style.width = '';
      mainContent.style.maxWidth = '';
    }
    Auth.updateUIForRole();
    App.handleRoute();
  },

  volverSuperAdmin() {
    const original = sessionStorage.getItem('superadmin_original');
    if (!original) {
      App.showToast('No hay sesión de Super Admin guardada', 'warning');
      return;
    }
    try {
      const data = JSON.parse(original);
      if(data.role !== 'superadmin'){ sessionStorage.removeItem('superadmin_original'); App.showToast('Sesión corrupta','danger'); return; }
      if(data.ts && (Date.now() - data.ts > 8*60*60*1000)){ sessionStorage.removeItem('superadmin_original'); App.showToast('Sesión expirada','warning'); return; }
      Auth.currentRole = data.role;
      Auth.userProfile = data.profile;
      Auth.currentUser = { uid: data.uid, email: data.profile.email };
      if(data.colegio_id && typeof Storage!=='undefined' && Storage.setActiveSchool){
        try{ Storage.activeSchool = data.colegio_id; localStorage.setItem('barita_active_school', data.colegio_id); }catch(_e){}
      }
    } catch (e) {
      App.showToast('Error al restaurar sesión', 'danger');
      return;
    }
    sessionStorage.removeItem('superadmin_original');
    if (typeof Auth !== 'undefined' && Auth.checkImpersonationBanner) Auth.checkImpersonationBanner();
    App.showToast('Sesión de Super Admin restaurada', 'success');
    window.location.hash = '#/superadmin';
    this.render(document.getElementById('app-content'));
  },

  table(name) {
    if (name === 'colegios') return window.supabaseGestion.from('colegios');
    if (name === 'usuarios') return window.supabaseGestion.from('usuarios');
    if (name === 'funcionarios') return window.supabaseGestion.from('funcionarios');
    return window.supabaseGestion.from(name);
  },
  clientForSystem() {
    return window.getSupabaseClient('gestion');
  },
  safeClient() {
    return this.clientForSystem('gestion');
  },

  async loadData() {
    const { data: snapColegios } = await this.table('colegios').select('*');
    this.colegiosList = snapColegios || [];
    const { data: snapFuncionarios } = await this.table('funcionarios').select('*');
    this.docentesList = snapFuncionarios || [];
    this.directoresList = [];
    const { data: snapUsers } = await this.table('usuarios').select('*');
    this.usersList = snapUsers || [];
  },

  renderLayout(container) {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    if (sidebar) sidebar.style.display = 'none';
    if (mainContent) {
      mainContent.style.marginLeft = '0';
      mainContent.style.width = '100%';
      mainContent.style.maxWidth = '100%';
    }

    const tabStyle = `padding: 0.75rem 1.25rem; font-weight: 600; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s;`;
    const tabActiveStyle = `border-bottom: 2px solid var(--primary); color: var(--primary);`;

    const activeSchoolName = Storage.activeSchool === 'terra_di_bimbi' ? 'TERRA DI BIMBI' : 'DEMO';

    const rolesList = [
      { key: 'superadmin', label: 'Super Administrador' },
      { key: 'admin', label: 'Administrador' },
      { key: 'coordinadora', label: 'Coordinadora' },
      { key: 'directora', label: 'Directora' },
      { key: 'profesor', label: 'Profesor' },
      { key: 'utp', label: 'UTP' },
      { key: 'pie', label: 'PIE' },
      { key: 'convivencia', label: 'Convivencia Escolar' },
      { key: 'inspectoria', label: 'Inspectoría General' },
      { key: 'finanzas', label: 'Finanzas' }
    ];

    const rolesOptions = rolesList.map(r => `<option value="${r.key}">${r.label}</option>`).join('');

    let html = `
      <!-- Header Banner -->
      <div class="card mb-4" style="border-top: 5px solid var(--primary); background: var(--bg-card); display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h2 style="margin: 0; color: var(--primary); font-weight: 800; font-size: 1.6rem; display: flex; align-items: center; gap: 0.5rem;">
            ${Icons.get('crown', 24)} ${this.currentSystem === 'postulaciones' ? 'Sistema de Postulaciones' : 'barita Global SaaS Management'}
          </h2>
          <p class="text-muted" style="margin: 4px 0 0 0; font-size: 0.9rem;">${this.currentSystem === 'postulaciones' ? 'Administración de directivos y docentes postulantes.' : 'Consola de administración global del SaaS BARITA y suplantación de identidad para soporte.'}</p>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem; background: var(--bg-hover); padding: 0.5rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); flex-wrap: wrap;">
          ${this.currentSystem === 'gestion' ? `
          <span style="font-weight: 700; font-size: 0.85rem; color: var(--text-secondary);">INSTITUCIÓN ACTIVA:</span>
          <select id="sa-school-select" class="form-control" style="width: auto; padding: 0.25rem 0.5rem; font-weight: 800; color: var(--primary); background: transparent; border: none; cursor: pointer;" onchange="SuperAdminView.changeActiveSchool(this.value)">
            <option value="demo" ${Storage.activeSchool === 'demo' ? 'selected' : ''}>Escuela DEMO</option>
            <option value="terra_di_bimbi" ${Storage.activeSchool === 'terra_di_bimbi' ? 'selected' : ''}>Escuela TERRA DI BIMBI</option>
          </select>
          ` : ''}

          <span style="font-weight: 700; font-size: 0.85rem; color: var(--text-secondary); margin-left: 0.5rem;">ROL:</span>
          <select id="sa-role-switcher" class="form-control" style="width: auto; padding: 0.25rem 0.5rem; font-weight: 800; color: var(--primary); background: transparent; border: none; cursor: pointer;" onchange="SuperAdminView.impersonateFromRoleSwitcher('${Auth.currentUser.uid}', this.value, { email: '${Auth.currentUser.email}', nombres: '${(Auth.userProfile && Auth.userProfile.nombres) || 'Super' }', apellidos: '${(Auth.userProfile && Auth.userProfile.apellidos) || 'Admin'}', colegio_id: (Auth.userProfile && Auth.userProfile.colegio_id) || Storage.activeSchool, colegioId: (Auth.userProfile && Auth.userProfile.colegio_id) || Storage.activeSchool })">
            ${rolesOptions}
          </select>

          <button class="btn btn-sm btn-secondary inline-flex items-center gap-1" onclick="SuperAdminView.renderSystemSelector(document.getElementById('app-content'))">🏠 Menú inicial</button>

          <button id="btn-volver-superadmin" class="btn btn-sm btn-danger" onclick="SuperAdminView.volverSuperAdmin()" style="display: ${sessionStorage.getItem('superadmin_original') ? 'inline-flex' : 'none'}; align-items: center; gap: 0.25rem; font-weight: 700;">${Icons.get('crown', 14)} Volver a Super Admin</button>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 1.5rem;">
        <div style="display: flex; border-bottom: 1px solid var(--border-color); background: var(--bg-card); flex-wrap: wrap;">
          ${this.currentSystem === 'gestion' ? `
          <div style="${tabStyle} ${this.currentTab === 'colegios' ? tabActiveStyle : ''} display: inline-flex; align-items: center; gap: 0.4rem;" onclick="SuperAdminView.switchTab('colegios')">${Icons.get('school', 16)} Colegios</div>
          ` : ''}
        </div>

        <div style="padding: 1.5rem;" id="superadmin-tab-content">
          ${this.renderTabContent()}
        </div>
      </div>

      <!-- Botones de Acción Inferiores -->
      <div style="display: flex; gap: 1rem; margin-top: 1.5rem; justify-content: flex-start; padding-bottom: 3rem;">
        <button class="btn btn-secondary" onclick="SuperAdminView.abrirConfiguracionSaas()" style="display: flex; align-items: center; gap: 0.5rem; font-weight: 600;">
          ${Icons.get('settings', 18)} Configuración del Sistema
        </button>
        <button class="btn btn-danger" onclick="SuperAdminView.logout()" style="background: #fee2e2; color: #ef4444; border: 1px solid #fca5a5; display: flex; align-items: center; gap: 0.5rem; font-weight: 600;">
          ${Icons.get('log-out', 18)} Cerrar Sesión
        </button>
      </div>
    `;

    container.innerHTML = html;
  },

  async toggleSuscripcion(id) {
    if(Auth.currentRole !== 'superadmin'){ App.showToast('Solo SUPER_ADMIN','danger'); return; }
    const colegio = this.colegiosList.find(c => c.id === id);
    if (!colegio) return;
    const actualmenteBloqueado = this._isBloqueado(colegio);
    const nuevoBloqueado = !actualmenteBloqueado;
    const nuevoEstado = nuevoBloqueado ? 'bloqueado' : 'activo';
    const suscripcion = nuevoBloqueado ? 'suspendida' : 'activa';
    // Si va a bloquear, pedir motivo rápido
    let motivo = colegio.motivo_bloqueo || '';
    if(nuevoBloqueado){
      motivo = prompt(`Motivo del bloqueo para ${colegio.nombre}:`, motivo) || '';
      if(!motivo.trim()){ App.showToast('Bloqueo cancelado — indique motivo','warning'); return; }
    }
    try{
      const payload = { estado_suscripcion: nuevoEstado, suscripcion, motivo_bloqueo: nuevoBloqueado?motivo:null, fecha_bloqueo: nuevoBloqueado?new Date().toISOString():null, bloqueado_por: nuevoBloqueado?(Auth.currentUser?.uid||Auth.currentUser?.id||null):null, bloqueado_at: nuevoBloqueado?new Date().toISOString():null, updated_at: new Date().toISOString() };
      const { error } = await this.table('colegios').update(payload).eq('id', id);
      if(error) throw error;
      try{ await this.table('auditoria_colegios').insert({ colegio_id: id, accion: nuevoBloqueado?'bloquear':'desbloquear', por: Auth.currentUser?.uid||Auth.currentUser?.id||null, detalle: { motivo } }); }catch(_e){}
      this.colegiosList = this.colegiosList.map(c => c.id === id ? { ...c, ...payload, motivo_bloqueo: payload.motivo_bloqueo } : c);
      App.showToast(`Colegio ${nuevoBloqueado?'bloqueado':'desbloqueado'} — ${this._esc(colegio.nombre)}`, nuevoBloqueado?'warning':'success');
      this.renderLayout(document.getElementById('app-content'));
    }catch(e){ App.showToast('Error toggle: '+e.message,'danger'); }
  },

  switchTab(tab) {
    this.currentTab = tab;
    this.renderLayout(document.getElementById('app-content'));
  },

  renderTabContent() {
    if (this.currentSystem !== 'gestion') {
      return this.renderPostulacionesUnificadas();
    }
    switch (this.currentTab) {
      case 'colegios':
        return this.renderColegios();
      case 'docentes':
        return this.renderPostulantes(this.docentesList, 'postulante');
      case 'directores':
        return this.renderDirectivosList(this.directoresList);
      case 'switch_user':
        return this.renderSwitchUser();
      default:
        return '';
    }
  },

  renderPostulacionesUnificadas() {
    const tabs = [
      { key: 'docentes', label: 'Docentes', icon: Icons.get('graduation-cap', 16) },
      { key: 'directores', label: 'Directivos', icon: Icons.get('target', 16) },
      { key: 'postulaciones', label: 'Postulaciones efectivas', icon: Icons.get('file-text', 16) }
    ];
    const activeTab = tabs.find(t => t.key === this.currentTab) ? this.currentTab : 'docentes';
    const tabStyle = `padding: 0.75rem 1.25rem; font-weight: 600; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s; display: inline-flex; align-items: center; gap: 0.4rem;`;
    const tabActiveStyle = `border-bottom: 2px solid var(--primary); color: var(--primary); font-weight: 700;`;

    return `
      <div style="display: flex; border-bottom: 1px solid var(--border-color); background: var(--bg-card); flex-wrap: wrap; margin-bottom: 1rem;">
        ${tabs.map(t => `
          <div style="${tabStyle} ${activeTab === t.key ? tabActiveStyle : ''}" onclick="SuperAdminView.switchTab('${t.key}')">${t.icon} ${t.label}</div>
        `).join('')}
      </div>
      <div id="superadmin-tab-content">
        ${activeTab === 'directores' ? this.renderDirectivosList(this.directoresList) : activeTab === 'docentes' ? this.renderPostulantes(this.docentesList, 'postulante') : this.renderPostulacionesEfectivas()}
      </div>
    `;
  },

  renderPostulacionesEfectivas() {
    const rows = (this.docentesList || []).map(d => {
      const colegio = (this.colegiosList || []).find(c => c.id === (d.colegioId || d.colegio || ''));
      const nombreColegio = colegio ? colegio.nombre : (d.colegioNombre || 'Sin colegio asignado');
      const resultado = d.resultadoPostulacion || '';
      const motivo = d.motivoFracaso || '';

      return `
        <tr>
          <td style="padding: 1rem; vertical-align: middle;"><b>${d.nombres || 'Sin nombre'} ${d.apellidos || ''}</b></td>
          <td style="padding: 1rem; vertical-align: middle;">${nombreColegio}</td>
          <td style="padding: 1rem; vertical-align: middle;">
            <select class="form-control" onchange="SuperAdminView.marcarResultadoPostulacion('${d.id}', this.value)" style="min-width: 140px;">
              <option value="">-- Estado --</option>
              <option value="exitoso" ${resultado === 'exitoso' ? 'selected' : ''}>Exitoso</option>
              <option value="fracasado" ${resultado === 'fracasado' ? 'selected' : ''}>Fracasado</option>
            </select>
          </td>
          <td style="padding: 1rem; vertical-align: middle;">
            <input type="text" class="form-control" placeholder="Razón del fracaso" value="${motivo}" onchange="SuperAdminView.guardarMotivoFracaso('${d.id}', this.value)" />
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div class="card">
        <div class="card-header" style="background: var(--primary); color: white;">
          <h3 class="card-title" style="margin: 0;">📄 Postulaciones efectivas</h3>
        </div>
        <div class="card-body">
          <p class="text-muted">Relación docente-colegio, resultado de la postulación y feedback para mejorar la plataforma.</p>
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th style="width: 30%;">Docente</th>
                  <th style="width: 30%;">Colegio relacionado</th>
                  <th style="width: 20%;">Resultado</th>
                  <th style="width: 20%;">Razón del fracaso</th>
                </tr>
              </thead>
              <tbody>
                ${rows || '<tr><td colspan="4" class="text-muted">Sin docentes registrados.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  filtrarPostulacionesPorCargo(cargo) {
    this.cargoFiltro = cargo || '';
    this.renderLayout(document.getElementById('app-content'));
  },

  async marcarResultadoPostulacion(id, valor) {
    if (!id || !valor) return;
    await this.table('postulantes').update({ resultadoPostulacion: valor }).eq('id', id);
    this.docentesList = this.docentesList.map(d => d.id === id ? { ...d, resultadoPostulacion: valor } : d);
    App.showToast('Resultado guardado', 'success');
  },

  async guardarMotivoFracaso(id, valor) {
    if (!id) return;
    const data = { motivoFracaso: valor ? valor.trim() : '' };
    await this.table('postulantes').update(data).eq('id', id);
    this.docentesList = this.docentesList.map(d => d.id === id ? { ...d, motivoFracaso: data.motivoFracaso } : d);
  },

  // -------------------------------------------------------------
  // PESTAÑA: COLEGIOS
  // -------------------------------------------------------------
  // Helper XSS-safe
  _esc(s){ try{ return (typeof Storage!=='undefined' && Storage.escapeHtml) ? Storage.escapeHtml(s) : (typeof S==='function'?S(s):String(s||'').replace(/[<>"'&]/g,'')); }catch(_e){ return String(s||''); } },

  _isBloqueado(c){
    const v = (c.estado_suscripcion || c.suscripcion || 'activa').toString().toLowerCase();
    return v === 'bloqueado' || v === 'suspendida';
  },

  renderColegios() {
    let rows = this.colegiosList.map(c => {
      const bloqueado = this._isBloqueado(c);
      const estadoBadge = bloqueado
        ? `<span class="badge badge-danger" title="${this._esc(c.motivo_bloqueo||'Bloqueado por suscripción')}">Bloqueado</span>`
        : `<span class="badge badge-success">Activo</span>`;
      const logo = c.logo_url ? `<img src="${this._esc(c.logo_url)}" alt="" style="width:28px;height:28px;object-fit:contain;border-radius:6px;border:1px solid var(--border-card);background:#fff;margin-right:0.5rem;vertical-align:middle;" onerror="this.style.display='none'">` : '';
      const rbd = this._esc(c.rbd || '');
      const dir = this._esc(c.director_nombre || c.director || '');
      return `
      <tr style="${bloqueado ? 'opacity:0.85;background:var(--badge-danger-bg);' : ''}">
        <td style="padding: 1rem; vertical-align: middle;"><div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">${logo}<b>${this._esc(c.nombre)}</b> ${estadoBadge} ${dir ? `<span class="text-muted" style="font-size:0.75rem;">— ${dir}</span>`:''}</div>${bloqueado && c.motivo_bloqueo ? `<div class="text-muted" style="font-size:0.7rem;margin-top:0.2rem;">Motivo: ${this._esc(c.motivo_bloqueo)}</div>`:''}</td>
        <td style="padding: 1rem; vertical-align: middle;">${rbd}</td>
        <td style="padding: 1rem; vertical-align: middle; text-align: right; display: flex; gap: 0.5rem; justify-content: flex-end; flex-wrap:wrap;">
          <button class="btn btn-sm btn-primary inline-flex items-center gap-1" ${bloqueado ? 'disabled title="Colegio bloqueado por suscripción — desbloquee en Editar"' : ''} onclick="${bloqueado ? '' : `SuperAdminView.ingresarAColegio('${this._esc(c.id)}')`}">${Icons.get('school', 14)} Ingresar</button>
          <button class="btn btn-sm btn-secondary inline-flex items-center gap-1" onclick="SuperAdminView.editarColegio('${this._esc(c.id)}')">${Icons.get('pencil', 14)} Editar</button>
        </td>
      </tr>`;
    }).join('');

    const demoInList = this.colegiosList.some(col => col.nombre.toLowerCase().includes('demo'));
    const terraInList = this.colegiosList.some(col => col.nombre.toLowerCase().includes('terra di bimbi'));

    let extraRows = '';
    if (!demoInList) {
      extraRows += `
        <tr style="background: var(--bg-hover);">
          <td style="padding: 1rem; vertical-align: middle;"><b>Escuela DEMO</b></td>
          <td style="padding: 1rem; vertical-align: middle;">RBD-001</td>
          <td style="padding: 1rem; vertical-align: middle; text-align: right; display: flex; gap: 0.5rem; justify-content: flex-end;">
            <button class="btn btn-sm btn-primary inline-flex items-center gap-1" onclick="SuperAdminView.ingresarAColegio('demo')">${Icons.get('school', 14)} Ingresar</button>
            <button class="btn btn-sm btn-secondary inline-flex items-center gap-1" onclick="SuperAdminView.editarColegio('demo')">${Icons.get('pencil', 14)} Editar</button>
          </td>
        </tr>
      `;
    }
    if (!terraInList) {
      extraRows += `
        <tr style="background: var(--bg-hover);">
          <td style="padding: 1rem; vertical-align: middle;"><b>Escuela TERRA DI BIMBI</b></td>
          <td style="padding: 1rem; vertical-align: middle;">RBD-002</td>
          <td style="padding: 1rem; vertical-align: middle; text-align: right; display: flex; gap: 0.5rem; justify-content: flex-end;">
            <button class="btn btn-sm btn-primary inline-flex items-center gap-1" onclick="SuperAdminView.ingresarAColegio('terra_di_bimbi')">${Icons.get('school', 14)} Ingresar</button>
            <button class="btn btn-sm btn-secondary inline-flex items-center gap-1" onclick="SuperAdminView.editarColegio('terra_di_bimbi')">${Icons.get('pencil', 14)} Editar</button>
          </td>
        </tr>
      `;
    }

    return `
      <div class="flex justify-between items-center mb-3">
        <h4>Listado de Instituciones registradas</h4>
        <button class="btn btn-primary btn-sm" onclick="SuperAdminView.nuevoColegio()">➕ Agregar Colegio</button>
      </div>
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th style="width: 60%;">Colegio</th>
              <th style="width: 20%;">RBD</th>
              <th style="width: 20%; text-align: right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${extraRows}
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  },

  nuevoColegio() {
    const html = `
      <form id="form-nuevo-colegio" onsubmit="event.preventDefault(); SuperAdminView.guardarColegio()" novalidate>
        <div class="barita-grid-2">
          <div class="form-group mb-3">
            <label class="form-label">Nombre del Colegio *</label>
            <input type="text" id="col-nombre" class="form-control" required placeholder="Ej: Colegio San Agustín" maxlength="120">
          </div>
          <div class="form-group mb-3">
            <label class="form-label">RBD</label>
            <input type="text" id="col-rbd" class="form-control" placeholder="12345-6" pattern="\\d{1,5}-[0-9Kk]" title="Formato: 12345-6">
          </div>
        </div>
        <fieldset class="form-group barita-fieldset mb-3">
          <legend class="form-label">Logo Colegio</legend>
          <div class="barita-logo-grid">
            <div class="barita-logo-preview" aria-live="polite">
              <div id="col-logo-fallback-new" class="barita-logo-fallback" style="display:flex;">${Icons.get('image',24)}<span>Sin logo</span></div>
              <img id="col-logo-preview-new" src="" alt="Preview logo" style="display:none;" onerror="this.style.display='none';document.getElementById('col-logo-fallback-new').style.display='flex'">
            </div>
            <div class="flex-col gap-2">
              <label for="col-logo-file" class="btn btn-secondary btn-sm" style="cursor:pointer;justify-content:center;">📁 Subir archivo</label>
              <input type="file" id="col-logo-file" accept="image/png,image/jpeg,image/webp,.svg" class="sr-only" onchange="SuperAdminView.previewLogoFile(this, 'col-logo-preview-new', 'col-logo-fallback-new', 'col-logo-url')">
              <div class="flex items-center gap-2" style="font-size:.75rem;color:var(--text-secondary);">o pega URL</div>
              <input type="url" id="col-logo-url" class="form-control" placeholder="https://..." oninput="SuperAdminView.previewLogoUrl(this.value, 'col-logo-preview-new', 'col-logo-fallback-new')">
            </div>
          </div>
        </fieldset>
        <div class="barita-grid-2">
          <div class="form-group mb-3">
            <label class="form-label">Director / Nombre contacto *</label>
            <input type="text" id="col-director" class="form-control" required placeholder="Nombre y apellido" maxlength="80">
          </div>
          <div class="form-group mb-3">
            <label class="form-label">Email o Teléfono de Contacto *</label>
            <input type="text" id="col-contacto" class="form-control" required placeholder="contacto@colegio.cl / +56 9...">
          </div>
        </div>
        <div class="form-group mb-3 barita-lock-card" id="lock-card-new">
          <div class="flex justify-between items-center gap-4">
            <div>
              <h4 style="margin:0;font-size:.9rem;display:flex;gap:.4rem;align-items:center;">${Icons.get('lock',16)} Bloquear acceso por suscripción</h4>
              <p class="text-muted" style="font-size:.75rem;margin:.15rem 0 0;">Desactiva el login de todo el colegio.</p>
            </div>
            <label class="barita-toggle"><input type="checkbox" id="col-bloqueo-toggle-new" onchange="SuperAdminView.toggleBloqueoMotivo(this.checked, 'col-bloqueo-motivo-wrap-new', 'lock-card-new', 'col-bloqueo-motivo-new')"><span class="barita-toggle-track"></span></label>
          </div>
          <div id="col-bloqueo-motivo-wrap-new" style="display:none;" class="mt-4">
            <label class="form-label">Motivo del bloqueo *</label>
            <textarea id="col-bloqueo-motivo-new" class="form-control" rows="2" placeholder="Ej: Morosidad 60 días"></textarea>
          </div>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="document.getElementById('form-nuevo-colegio').requestSubmit()">Crear Colegio</button>
    `;

    App.openModal('Agregar Nuevo Colegio', html, footer, { ariaLabel: 'Agregar Nuevo Colegio' });
  },

  // Helpers logo preview
  previewLogoFile(input, previewId, fallbackId, urlInputId){
    try{
      const f = input.files && input.files[0];
      if(!f){ return; }
      if(f.size > 2*1024*1024){ App.showToast('Logo muy pesado (máx 2MB)','warning'); input.value=''; return; }
      if(!f.type.startsWith('image/')){ App.showToast('Solo imágenes','warning'); return; }
      const r = new FileReader();
      r.onload = e => {
        const img = document.getElementById(previewId);
        const fb = document.getElementById(fallbackId);
        const urlIn = urlInputId ? document.getElementById(urlInputId) : null;
        if(img){ img.src = e.target.result; img.style.display='block'; }
        if(fb) fb.style.display='none';
        if(urlIn) urlIn.value = '';
      };
      r.readAsDataURL(f);
    }catch(_e){}
  },
  previewLogoUrl(url, previewId, fallbackId){
    const img = document.getElementById(previewId);
    const fb = document.getElementById(fallbackId);
    if(!img) return;
    const v = (url||'').trim();
    if(!v || !(v.startsWith('http://')||v.startsWith('https://')||v.startsWith('data:image/'))){
      img.style.display='none'; if(fb) fb.style.display='flex'; return;
    }
    img.src = v; img.style.display='block'; if(fb) fb.style.display='none';
    img.onerror = () => { img.style.display='none'; if(fb) fb.style.display='flex'; };
  },
  clearLogo(previewId, fallbackId, urlInputId, fileInputId){
    const img = document.getElementById(previewId);
    const fb = document.getElementById(fallbackId);
    if(img){ img.src=''; img.style.display='none'; } if(fb) fb.style.display='flex';
    const u = urlInputId ? document.getElementById(urlInputId) : null; if(u) u.value='';
    const f = fileInputId ? document.getElementById(fileInputId) : null; if(f) f.value='';
  },
  toggleBloqueoMotivo(checked, wrapId, cardId, motivoId){
    const w = document.getElementById(wrapId);
    const c = document.getElementById(cardId);
    const m = document.getElementById(motivoId);
    if(w) w.style.display = checked ? 'block' : 'none';
    if(c) c.classList.toggle('is-blocked', checked);
    if(m){ if(checked) m.setAttribute('required',''); else m.removeAttribute('required'); }
  },

  editarColegio(id) {
    if(Auth.currentRole !== 'superadmin'){ App.showToast('Solo SUPER_ADMIN puede editar colegios','danger'); return; }
    const c = this.colegiosList.find(col => col.id === id);
    if (!c) return;
    const bloqueado = this._isBloqueado(c);
    const safeId = this._esc(id);
    const html = `
      <form id="form-edit-colegio" onsubmit="event.preventDefault(); SuperAdminView.actualizarColegio('${safeId}')" novalidate>
        <div class="barita-modal-status ${bloqueado ? 'is-blocked' : 'is-active'}" role="status" aria-live="polite">
          <span class="status-indicator ${bloqueado ? 'status-red' : 'status-green'}"><span class="dot"></span>${bloqueado ? 'Acceso Bloqueado' : 'Acceso Activo'}</span>
          <span class="text-muted" style="font-size:.75rem;">${bloqueado ? this._esc(c.motivo_bloqueo||'Bloqueado por suscripción') : 'Suscripción al día'}</span>
        </div>
        <div class="barita-grid-2">
          <div class="form-group mb-3">
            <label class="form-label">Nombre del Colegio *</label>
            <input type="text" id="col-nombre-edit" class="form-control" value="${this._esc(c.nombre)}" required maxlength="120">
          </div>
          <div class="form-group mb-3">
            <label class="form-label">RBD</label>
            <input type="text" id="col-rbd-edit" class="form-control" value="${this._esc(c.rbd||'')}" pattern="\\d{1,5}-[0-9Kk]" placeholder="12345-6" title="Formato: 12345-6">
          </div>
        </div>
        <fieldset class="form-group barita-fieldset mb-3">
          <legend class="form-label">Logo Colegio</legend>
          <div class="barita-logo-grid">
            <div class="barita-logo-preview">
              <img id="col-logo-preview" src="${this._esc(c.logo_url||'')}" alt="Preview" style="${c.logo_url?'display:block':'display:none'}" onerror="this.style.display='none';document.getElementById('col-logo-fallback').style.display='flex'">
              <div id="col-logo-fallback" class="barita-logo-fallback" style="${c.logo_url?'display:none':'display:flex'}">${Icons.get('image',24)}<span>Sin logo</span></div>
            </div>
            <div class="flex-col gap-2">
              <label for="col-logo-file-edit" class="btn btn-secondary btn-sm" style="cursor:pointer;justify-content:center;">📁 Subir archivo</label>
              <input type="file" id="col-logo-file-edit" accept="image/png,image/jpeg,image/webp,.svg" class="sr-only" onchange="SuperAdminView.previewLogoFile(this, 'col-logo-preview', 'col-logo-fallback', 'col-logo-url-edit')">
              <div class="flex items-center gap-2" style="font-size:.75rem;color:var(--text-secondary);">o pega URL</div>
              <input type="url" id="col-logo-url-edit" class="form-control" value="${this._esc(c.logo_url||'')}" placeholder="https://..." oninput="SuperAdminView.previewLogoUrl(this.value, 'col-logo-preview', 'col-logo-fallback')">
              <button type="button" class="btn btn-sm btn-secondary" onclick="SuperAdminView.clearLogo('col-logo-preview','col-logo-fallback','col-logo-url-edit','col-logo-file-edit')" style="font-size:.7rem;">Quitar</button>
            </div>
          </div>
        </fieldset>
        <div class="barita-grid-2">
          <div class="form-group mb-3">
            <label class="form-label">Director / Nombre contacto *</label>
            <input type="text" id="col-director-edit" class="form-control" value="${this._esc(c.director_nombre||c.director||'')}" required maxlength="80" placeholder="Nombre y apellido">
          </div>
          <div class="form-group mb-3">
            <label class="form-label">Email o Teléfono de Contacto *</label>
            <input type="text" id="col-contacto-edit" class="form-control" value="${this._esc(c.director_contacto||c.contacto||'')}" required placeholder="contacto@colegio.cl / +56 9...">
          </div>
        </div>
        <div class="form-group barita-lock-card ${bloqueado ? 'is-blocked' : ''}" id="lock-card-edit" role="group" aria-labelledby="lock-title">
          <div class="flex justify-between items-center gap-4">
            <div>
              <h4 id="lock-title" style="margin:0;font-size:.9rem;display:flex;gap:.4rem;align-items:center;">${Icons.get('lock',16)} Bloquear acceso por suscripción</h4>
              <p class="text-muted" style="font-size:.75rem;margin:.15rem 0 0;">Desactiva login de todos los usuarios del colegio.</p>
            </div>
            <label class="barita-toggle" aria-label="Bloquear acceso"><input type="checkbox" id="col-bloqueo-toggle" ${bloqueado?'checked':''} onchange="SuperAdminView.toggleBloqueoMotivo(this.checked, 'col-bloqueo-motivo-wrap', 'lock-card-edit', 'col-bloqueo-motivo')"><span class="barita-toggle-track"></span></label>
          </div>
          <div id="col-bloqueo-motivo-wrap" style="${bloqueado?'display:block':'display:none'}" class="mt-4">
            <label class="form-label">Motivo del bloqueo *</label>
            <textarea id="col-bloqueo-motivo" class="form-control" rows="2" placeholder="Ej: Morosidad 60 días, contrato vencido...">${this._esc(c.motivo_bloqueo||'')}</textarea>
          </div>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-danger" onclick="SuperAdminView.eliminarColegio('${safeId}'); App.closeModal();" style="margin-right:auto;">${Icons.get('trash-2',14)} Eliminar</button>
      <button class="btn btn-primary" onclick="document.getElementById('form-edit-colegio').requestSubmit()">Guardar Cambios</button>
    `;

    App.openModal('Editar Colegio', html, footer, { ariaLabel: 'Editar Colegio' });
  },

  _sanitizeNombre(v){ return (v||'').toString().trim().slice(0,120).replace(/[<>]/g,''); },
  _sanitizeRbd(v){
    const t=(v||'').toString().trim();
    if(!t) return '';
    if(!/^\d{1,5}-[0-9Kk]$/.test(t)){ App.showToast('RBD inválido. Formato: 12345-6','warning'); return null; }
    return t;
  },
  _sanitizeLogo(v, fallback){
    const s=(v||'').toString().trim();
    if(!s) return fallback||'';
    if(s.startsWith('data:image/')) return s.slice(0,8000);
    try{
      const u=new URL(s);
      if(!['https:','http:'].includes(u.protocol)) return fallback||'';
      // must be image extension or storage url
      return s.slice(0,2000);
    }catch(_e){ App.showToast('URL de logo inválida','warning'); return null; }
  },

  async guardarColegio() {
    if(Auth.currentRole !== 'superadmin'){ App.showToast('Solo SUPER_ADMIN puede crear colegios','danger'); return; }
    const rawNombre = document.getElementById('col-nombre').value;
    const nombre = this._sanitizeNombre(rawNombre);
    if(!nombre || nombre.length < 3){ App.showToast('Nombre mínimo 3 caracteres','warning'); return; }
    const rbdRaw = document.getElementById('col-rbd') ? document.getElementById('col-rbd').value : '';
    const rbd = rbdRaw ? this._sanitizeRbd(rbdRaw) : '';
    if(rbd===null) return;
    const director_nombre = this._sanitizeNombre(document.getElementById('col-director') ? document.getElementById('col-director').value : '');
    const director_contacto = (document.getElementById('col-contacto') ? document.getElementById('col-contacto').value.trim() : '').slice(0,120);
    if(!director_contacto){ App.showToast('Contacto requerido','warning'); return; }
    if(!director_nombre){ App.showToast('Director requerido','warning'); return; }
    const previewNew = document.getElementById('col-logo-preview-new');
    const urlNew = document.getElementById('col-logo-url') ? document.getElementById('col-logo-url').value : '';
    let logo_url = '';
    if(previewNew && previewNew.src && previewNew.style.display!=='none' && previewNew.src.startsWith('data:')) logo_url = previewNew.src;
    else if(urlNew) logo_url = urlNew;
    const sanitizedLogo = this._sanitizeLogo(logo_url, '');
    if(sanitizedLogo===null) return;
    logo_url = sanitizedLogo;
    const isBlocked = document.getElementById('col-bloqueo-toggle-new') ? document.getElementById('col-bloqueo-toggle-new').checked : false;
    const motivo = document.getElementById('col-bloqueo-motivo-new') ? document.getElementById('col-bloqueo-motivo-new').value.trim().slice(0,300) : '';
    if(isBlocked && !motivo){ App.showToast('Indica motivo del bloqueo','warning'); return; }
    const estado_suscripcion = isBlocked ? 'bloqueado' : 'activo';
    const suscripcion = isBlocked ? 'suspendida' : 'activa';

    try {
      const docId = Date.now().toString();
      const payload = {
        id: docId,
        nombre,
        rbd: rbd||null,
        contacto: director_contacto,
        director_nombre,
        director_contacto: director_contacto,
        logo_url: logo_url||null,
        suscripcion,
        estado_suscripcion,
        motivo_bloqueo: isBlocked ? motivo : null,
        fecha_bloqueo: isBlocked ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      };
      const { error } = await this.table('colegios').insert(payload);
      if (error) throw error;
      // auditoria
      try{ await this.table('auditoria_colegios').insert({ colegio_id: docId, accion: isBlocked?'crear_bloqueado':'crear', por: Auth.currentUser?.uid||Auth.currentUser?.id||null, detalle: payload }); }catch(_e){}
      App.closeModal();
      App.showToast('Colegio registrado exitosamente', 'success');
      await this.loadData();
      this.renderLayout(document.getElementById('app-content'));
    } catch (e) {
      App.showToast('Error al crear colegio: ' + e.message, 'danger');
    }
  },

  async actualizarColegio(id) {
    if(Auth.currentRole !== 'superadmin'){ App.showToast('Solo SUPER_ADMIN puede editar colegios','danger'); return; }
    const rawNombre = document.getElementById('col-nombre-edit').value;
    const nombre = this._sanitizeNombre(rawNombre);
    if(!nombre || nombre.length < 3){ App.showToast('Nombre mínimo 3 caracteres','warning'); return; }
    const rbdRaw = document.getElementById('col-rbd-edit') ? document.getElementById('col-rbd-edit').value : '';
    const rbd = rbdRaw ? this._sanitizeRbd(rbdRaw) : '';
    if(rbd===null) return;
    const director_nombre = this._sanitizeNombre(document.getElementById('col-director-edit') ? document.getElementById('col-director-edit').value : '');
    const director_contacto = (document.getElementById('col-contacto-edit') ? document.getElementById('col-contacto-edit').value.trim() : '').slice(0,120);
    if(!director_contacto){ App.showToast('Contacto requerido','warning'); return; }
    if(!director_nombre){ App.showToast('Director requerido','warning'); return; }
    const urlEdit = document.getElementById('col-logo-url-edit') ? document.getElementById('col-logo-url-edit').value : '';
    const previewEdit = document.getElementById('col-logo-preview');
    let logo_url = '';
    if(previewEdit && previewEdit.src && previewEdit.style.display!=='none' && previewEdit.src.startsWith('data:')) logo_url = previewEdit.src;
    else if(urlEdit) logo_url = urlEdit;
    // fallback to existing if both empty but there was previous logo
    const existing = this.colegiosList.find(c=>c.id===id);
    if(!logo_url && existing && existing.logo_url && (!previewEdit || previewEdit.style.display==='none') && !urlEdit) logo_url = '';
    else if(!logo_url && existing && existing.logo_url && urlEdit==='') logo_url = existing.logo_url;
    // Actually if user cleared, keep cleared; else use sanitized
    const sanitizedLogo = logo_url ? this._sanitizeLogo(logo_url, existing ? existing.logo_url : '') : '';
    if(sanitizedLogo===null) return;
    logo_url = sanitizedLogo;
    const isBlocked = document.getElementById('col-bloqueo-toggle') ? document.getElementById('col-bloqueo-toggle').checked : false;
    const motivo = document.getElementById('col-bloqueo-motivo') ? document.getElementById('col-bloqueo-motivo').value.trim().slice(0,300) : '';
    if(isBlocked && !motivo){ App.showToast('Indica motivo del bloqueo','warning'); return; }
    const estado_suscripcion = isBlocked ? 'bloqueado' : 'activo';
    const suscripcion = isBlocked ? 'suspendida' : 'activa';

    try {
      const payload = {
        nombre,
        contacto: director_contacto,
        director_nombre,
        director_contacto,
        rbd: rbd||null,
        logo_url: logo_url||null,
        suscripcion,
        estado_suscripcion,
        motivo_bloqueo: isBlocked ? motivo : null,
        fecha_bloqueo: isBlocked ? new Date().toISOString() : null,
        bloqueado_por: isBlocked ? (Auth.currentUser?.uid||Auth.currentUser?.id||null) : null,
        bloqueado_at: isBlocked ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      };
      const { error } = await this.table('colegios').update(payload).eq('id', id);
      if (error) throw error;
      try{ await this.table('auditoria_colegios').insert({ colegio_id: id, accion: isBlocked?'bloquear':'desbloquear', por: Auth.currentUser?.uid||Auth.currentUser?.id||null, detalle: { motivo: motivo||null, estado: estado_suscripcion } }); }catch(_e){}
      App.closeModal();
      App.showToast(`Colegio ${isBlocked?'bloqueado':'desbloqueado'} y actualizado correctamente`, 'success');
      await this.loadData();
      this.renderLayout(document.getElementById('app-content'));
    } catch (e) {
      App.showToast('Error al actualizar colegio: ' + e.message, 'danger');
    }
  },

  async eliminarColegio(id) {
    if(Auth.currentRole !== 'superadmin'){ App.showToast('Solo SUPER_ADMIN','danger'); return; }
    App.confirm('¿Eliminar Colegio?', 'Esta acción borrará al colegio y quedará en auditoría. ¿Continuar?', async () => {
      try {
        const { error } = await this.table('colegios').delete().eq('id', id);
        if (error) throw error;
        try{ await this.table('auditoria_colegios').insert({ colegio_id: id, accion: 'eliminar', por: Auth.currentUser?.uid||Auth.currentUser?.id||null, detalle: { id } }); }catch(_e){}
        App.showToast('Colegio eliminado', 'success');
        await this.loadData();
        this.render(document.getElementById('app-content'));
      } catch (e) {
        App.showToast('Error al eliminar colegio: ' + e.message, 'danger');
      }
    });
  },

  // -------------------------------------------------------------
  // PESTAÑA: POSTULANTES (Docentes)
  // -------------------------------------------------------------
  renderPostulantes(list, tipo, filtroCargo = '') {
    const term = (filtroCargo || '').toLowerCase();
    const data = (list || []).filter(c => (c.cargo || '').toLowerCase().includes(term));
    let rows = data.map(c => {
      const userObj = { id: c.id, email: c.email, role: 'postulante', nombres: c.nombres, apellidos: c.apellidos };

      return `
        <tr>
          <td style="padding: 1rem; vertical-align: middle;"><b>${c.nombres} ${c.apellidos}</b></td>
          <td style="padding: 1rem; vertical-align: middle;">${c.rut}</td>
          <td style="padding: 1rem; vertical-align: middle;">${c.cargo}</td>
          <td style="padding: 1rem; vertical-align: middle;" class="text-center">${c.experiencia || 0} años</td>
          <td style="padding: 1rem; vertical-align: middle; text-align: right;">
            <button class="btn btn-sm btn-secondary inline-flex items-center gap-1" onclick="SuperAdminView.editarPostulante('${c.id}')">${Icons.get('pencil', 14)} Editar</button>
          </td>
        </tr>
      `;
    }).join('');

    if (rows === '') {
      rows = `<tr><td colspan="5" class="text-center text-muted py-4">No hay docentes para este filtro.</td></tr>`;
    }

    return `
      <div class="mb-3" style="display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap;">
        <h4 style="margin:0;">Postulantes registrados en el Portal Público</h4>
        <input type="search" class="form-control" placeholder="Filtrar por cargo..." value="${term}" oninput="SuperAdminView.filtrarPostulantes('${tipo}', this.value)" style="max-width: 260px;" />
      </div>
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th style="width: 25%;">Nombre Completo</th>
              <th style="width: 15%;">RUT</th>
              <th style="width: 25%;">Cargo al que Postula</th>
              <th style="width: 10%; text-align: center;">Experiencia</th>
              <th style="width: 25%; text-align: right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  },

  editarPostulante(id) {
    const c = this.docentesList.find(p => p.id === id);
    if (!c) return;

    const html = `
      <form id="form-edit-postulante" onsubmit="event.preventDefault(); SuperAdminView.actualizarPostulante('${id}')">
        <div class="form-group mb-3">
          <label class="form-label">Nombres *</label>
          <input type="text" id="post-nombres-edit" class="form-control" value="${c.nombres || ''}" required>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Apellidos *</label>
          <input type="text" id="post-apellidos-edit" class="form-control" value="${c.apellidos || ''}" required>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Teléfono *</label>
          <input type="text" id="post-telefono-edit" class="form-control" value="${c.telefono || ''}" required>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Cargo *</label>
          <input type="text" id="post-cargo-edit" class="form-control" value="${c.cargo || ''}" required>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Años de Experiencia *</label>
          <input type="number" id="post-experiencia-edit" class="form-control" value="${c.experiencia || 0}" required min="0">
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="document.getElementById('form-edit-postulante').requestSubmit()">Guardar Cambios</button>
    `;

    App.openModal('Editar Datos de Postulante', html, footer);
  },

  async actualizarPostulante(id) {
    const nombres = document.getElementById('post-nombres-edit').value.trim();
    const apellidos = document.getElementById('post-apellidos-edit').value.trim();
    const telefono = document.getElementById('post-telefono-edit').value.trim();
    const cargo = document.getElementById('post-cargo-edit').value.trim();
    const experiencia = parseInt(document.getElementById('post-experiencia-edit').value);

    try {
      await this.table('postulantes').update({
        nombres,
        apellidos,
        telefono,
        cargo,
        experiencia
      });

      const { data: userDoc } = await this.table('usuarios').select('*').eq('id', id).single();
      if (userDoc) {
        await this.table('usuarios').update({
          nombres,
          apellidos
        }).eq('id', id);
      }

      App.closeModal();
      App.showToast('Postulante actualizado correctamente', 'success');
      this.render(document.getElementById('app-content'));
    } catch (e) {

      App.showToast('Error al actualizar postulante: ' + e.message, 'danger');
    }
  },

  async eliminarPostulante(id) {
    App.confirm('¿Eliminar Postulante?', 'Esta acción borrará la postulación y cuenta de este usuario del sistema.', async () => {
      try {
        await this.table('postulantes').delete().eq('id', id);
        await this.table('usuarios').delete().eq('id', id);

        App.showToast('Postulante eliminado', 'success');
        this.render(document.getElementById('app-content'));
      } catch (e) {

        App.showToast('Error al eliminar postulante: ' + e.message, 'danger');
      }
    });
  },

  // -------------------------------------------------------------
  // PESTAÑA: DIRECTIVOS REGISTRADOS
  // -------------------------------------------------------------
  renderDirectivosList(list) {
    let rows = list.map(c => {
      const userObj = { id: c.id, email: c.email, role: 'directivo', nombres: c.nombres, apellidos: '' };

      return `
        <tr>
          <td style="padding: 1rem; vertical-align: middle;"><b>${c.nombres}</b></td>
          <td style="padding: 1rem; vertical-align: middle;">${c.email}</td>
          <td style="padding: 1rem; vertical-align: middle;">${c.colegio || 'No especificado'}</td>
          <td style="padding: 1rem; vertical-align: middle; text-align: right;">
            <button class="btn btn-sm btn-primary inline-flex items-center gap-1" onclick="Auth.impersonateUser('${c.id}', 'directivo', ${JSON.stringify(userObj).replace(/"/g, '&quot;')})" style="margin-right: 0.5rem; background: #8b5cf6; border: none; font-weight: bold;">${Icons.get('user', 14)} Simular Sesión</button>
            <button class="btn btn-sm btn-danger inline-flex items-center gap-1" onclick="SuperAdminView.eliminarDirectivo('${c.id}')" style="">${Icons.get('trash-2', 14)} Eliminar</button>
          </td>
        </tr>
      `;
    }).join('');

    if (rows === '') {
      rows = `<tr><td colspan="4" class="text-center text-muted py-4">No hay directivos registrados aún.</td></tr>`;
    }

    return `
      <div class="mb-3">
        <h4>Directivos registrados con acceso al buscador</h4>
      </div>
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th style="width: 30%;">Nombre Completo</th>
              <th style="width: 30%;">Email</th>
              <th style="width: 25%;">Colegio / Institución</th>
              <th style="width: 15%; text-align: right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  },

  async eliminarDirectivo(id) {
    App.confirm('¿Eliminar Directivo?', 'Esta acción borrará la cuenta de este directivo del sistema.', async () => {
      try {
        await this.safeClient()
          .from('usuarios')
          .delete()
          .eq('id', id);

        App.showToast('Directivo eliminado', 'success');
        this.render(document.getElementById('app-content'));
      } catch (e) {

        App.showToast('Error al eliminar directivo: ' + e.message, 'danger');
      }
    });
  },

  // -------------------------------------------------------------
  // PESTAÑA: CAMBIO DE USUARIO (SWITCH USER)
  // -------------------------------------------------------------
  renderSwitchUser() {
    let rows = this.usersList.map(u => {
      if (u.role === 'superadmin' && u.email !== Auth.currentUser.email) return '';
      
      const displayName = u.nombres ? `${u.nombres} ${u.apellidos || ''}` : u.email;
      
      return `
        <tr>
          <td style="padding: 1rem; vertical-align: middle;"><b>${displayName}</b></td>
          <td style="padding: 1rem; vertical-align: middle;">${u.email}</td>
          <td style="padding: 1rem; vertical-align: middle;"><span class="badge" style="background:#e2e8f0; color:#475569;">${u.role}</span></td>
          <td style="padding: 1rem; vertical-align: middle; text-align: right;">
            <button class="btn btn-sm btn-primary inline-flex items-center gap-1" onclick="Auth.impersonateUser('${u.id}', '${u.role}', ${JSON.stringify(u).replace(/"/g, '&quot;')})" style="background:#8b5cf6; border:none; padding: 0.4rem 0.8rem; font-weight:bold;">
              ${Icons.get('user', 14)} Simular Sesión
            </button>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div class="mb-3">
        <h4>Cambiar de Usuario (Impersonate)</h4>
        <p class="text-muted">Selecciona a un usuario para ingresar al sistema y ver exactamente su vista, permisos y capacidades de edición.</p>
      </div>
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th style="width: 40%;">Nombre Completo</th>
              <th style="width: 30%;">Correo Electrónico</th>
              <th style="width: 15%;">Rol</th>
              <th style="width: 15%; text-align: right;">Acción</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  },

  abrirConfiguracionSaas() {
    const html = `
      <div style="padding: 0.5rem;">
        <h4>Parámetros Generales de BARITA</h4>
        <p class="text-muted" style="font-size: 0.85rem;">Configuraciones globales de las APIs de IA, cuotas de correos y variables del sistema.</p>
        
        <div class="form-group mb-3" style="margin-top: 1rem;">
          <label class="form-label">API Endpoint del Matching IA</label>
          <input type="text" class="form-control" value="https://api.barita.cl/v1/match" readonly style="background: var(--bg-hover);">
        </div>

        <div class="form-group mb-3">
          <label class="form-label">Limite Mensual de Postulaciones</label>
          <input type="number" class="form-control" value="10000" readonly style="background: var(--bg-hover);">
        </div>

        <div class="form-group">
          <label class="form-label">Estado General de los Servidores</label>
          <div style="display: flex; align-items: center; gap: 0.5rem; font-weight: bold; color: #15803d; font-size: 0.9rem;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #22c55e;"></span> Operacional / Óptimo
          </div>
        </div>
      </div>
    `;
    const footer = `<button class="btn btn-secondary" onclick="App.closeModal()">Cerrar</button>`;
    App.openModal('Configuración Global de BARITA', html, footer);
  }
};

window.SuperAdminView = SuperAdminView;
})();
