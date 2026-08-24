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
          <p class="text-muted">Selecciona el sistema que deseas administrar:</p>
          <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 1rem;">
            <button class="btn btn-primary inline-flex items-center justify-center gap-2" onclick="SuperAdminView.switchSystem('gestion')" style="flex: 1; min-width: 220px; padding: 1.5rem; font-size: 1.1rem; font-weight: 700;">
              ${Icons.get('school', 20)} Sistema de Gestión
            </button>
            <button class="btn btn-secondary inline-flex items-center justify-center gap-2" onclick="SuperAdminView.switchSystem('postulaciones')" style="flex: 1; min-width: 220px; padding: 1.5rem; font-size: 1.1rem; font-weight: 700;">
              ${Icons.get('target', 20)} Sistema de Postulaciones
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

  async changeActiveSchool(schoolId) {
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
    this.changeActiveSchool(schoolId);
  },

  async impersonateFromRoleSwitcher(uid, role, profile) {
    if (!sessionStorage.getItem('superadmin_original')) {
      sessionStorage.setItem('superadmin_original', JSON.stringify({
        uid: Auth.currentUser.uid,
        role: Auth.currentRole,
        profile: Auth.userProfile
      }));
    }
    Auth.currentRole = role;
    Auth.userProfile = profile;
    Auth.currentUser = { uid, email: profile.email };
    App.showToast(`Simulando rol: ${role}`, 'info');
    if (typeof Auth !== 'undefined' && Auth.checkImpersonationBanner) Auth.checkImpersonationBanner();
    window.location.hash = '#/dashboard';
    this.showAppForImpersonation();
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
      Auth.currentRole = data.role;
      Auth.userProfile = data.profile;
      Auth.currentUser = { uid: data.uid, email: data.profile.email };
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
    const system = this.currentSystem === 'postulaciones' ? 'postulaciones' : 'gestion';
    if (system === 'postulaciones') {
      if (name === 'postulantes') return window.supabasePostulaciones.from('postulantes');
      if (name === 'postulaciones') return window.supabasePostulaciones.from('postulaciones');
      return window.supabasePostulaciones.from(name);
    }
    if (name === 'colegios') return window.supabaseGestion.from('colegios');
    if (name === 'usuarios') return window.supabaseGestion.from('usuarios');
    if (name === 'funcionarios') return window.supabaseGestion.from('funcionarios');
    return window.supabaseGestion.from(name);
  },
  clientForSystem(system) {
    return window.getSupabaseClient(system === 'postulaciones' ? 'postulaciones' : 'gestion');
  },
  safeClient() {
    return this.clientForSystem(this.currentSystem);
  },

  async loadData() {
    // Cargar colegios
    const { data: snapColegios } = await this.table('colegios').select('*');
    this.colegiosList = snapColegios || [];

    if (this.currentSystem === 'postulaciones') {
      const { data: snapPostulantes } = await this.table('postulantes').select('*');
      this.docentesList = snapPostulantes || [];
      this.directoresList = [];
      const { data: snapUsuarios } = await this.table('usuarios').select('*');
      this.usersList = snapUsuarios || [];
    } else {
      const { data: snapFuncionarios } = await this.table('funcionarios').select('*');
      this.docentesList = snapFuncionarios || [];
      this.directoresList = [];
      const { data: snapUsers } = await this.table('usuarios').select('*');
      this.usersList = snapUsers || [];
    }
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
          <select id="sa-role-switcher" class="form-control" style="width: auto; padding: 0.25rem 0.5rem; font-weight: 800; color: var(--primary); background: transparent; border: none; cursor: pointer;" onchange="SuperAdminView.impersonateFromRoleSwitcher('${Auth.currentUser.uid}', this.value, { email: '${Auth.currentUser.email}', nombres: '${(Auth.userProfile && Auth.userProfile.nombres) || 'Super' }', apellidos: '${(Auth.userProfile && Auth.userProfile.apellidos) || 'Admin'}' })">
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
    const colegio = this.colegiosList.find(c => c.id === id);
    if (!colegio) return;
    const nuevoEstado = colegio.suscripcion === 'activa' ? 'suspendida' : 'activa';
    await this.table('colegios').update({ suscripcion: nuevoEstado }).eq('id', id);
    this.colegiosList = this.colegiosList.map(c => c.id === id ? { ...c, suscripcion: nuevoEstado } : c);
    App.showToast(`Suscripción ${nuevoEstado === 'activa' ? 'activada' : 'cancelada'} para ${colegio.nombre}`, 'success');
    this.renderLayout(document.getElementById('app-content'));
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
  renderColegios() {
    let rows = this.colegiosList.map(c => `
      <tr>
        <td style="padding: 1rem; vertical-align: middle;"><b>${c.nombre}</b></td>
        <td style="padding: 1rem; vertical-align: middle;">${c.rbd || ''}</td>
        <td style="padding: 1rem; vertical-align: middle; text-align: right; display: flex; gap: 0.5rem; justify-content: flex-end;">
          <button class="btn btn-sm btn-primary inline-flex items-center gap-1" onclick="SuperAdminView.ingresarAColegio('${c.id}')">${Icons.get('school', 14)} Ingresar</button>
          <button class="btn btn-sm btn-secondary inline-flex items-center gap-1" onclick="SuperAdminView.editarColegio('${c.id}')">${Icons.get('pencil', 14)} Editar</button>
        </td>
      </tr>
    `).join('');

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
      <form id="form-nuevo-colegio" onsubmit="event.preventDefault(); SuperAdminView.guardarColegio()">
        <div class="form-group mb-3">
          <label class="form-label">Nombre del Colegio *</label>
          <input type="text" id="col-nombre" class="form-control" required placeholder="Ej: Colegio San Agustín">
        </div>
        <div class="form-group mb-3">
          <label class="form-label">RBD</label>
          <input type="text" id="col-rbd" class="form-control" placeholder="Ej: 1234-56">
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Email o Teléfono de Contacto *</label>
          <input type="text" id="col-contacto" class="form-control" required placeholder="Ej: contacto@sanagustin.cl">
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Estado de Suscripción</label>
          <select id="col-suscripcion" class="form-control">
            <option value="activa">Activa</option>
            <option value="suspendida">Suspendida</option>
          </select>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="document.getElementById('form-nuevo-colegio').requestSubmit()">Crear Colegio</button>
    `;

    App.openModal('Agregar Nuevo Colegio', html, footer);
  },

  editarColegio(id) {
    const c = this.colegiosList.find(col => col.id === id);
    if (!c) return;

    const html = `
      <form id="form-edit-colegio" onsubmit="event.preventDefault(); SuperAdminView.actualizarColegio('${id}')">
        <div class="form-group mb-3">
          <label class="form-label">Nombre del Colegio *</label>
          <input type="text" id="col-nombre-edit" class="form-control" value="${c.nombre}" required>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Email o Teléfono de Contacto *</label>
          <input type="text" id="col-contacto-edit" class="form-control" value="${c.contacto || ''}" required>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">RBD</label>
          <input type="text" id="col-rbd-edit" class="form-control" value="${(c.rbd || '').toString()}">
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Estado de Suscripción</label>
          <select id="col-suscripcion-edit" class="form-control">
            <option value="activa" ${c.suscripcion === 'activa' ? 'selected' : ''}>Activa</option>
            <option value="suspendida" ${c.suscripcion === 'suspendida' ? 'selected' : ''}>Suspendida</option>
          </select>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="document.getElementById('form-edit-colegio').requestSubmit()">Guardar Cambios</button>
      <button class="btn btn-danger" onclick="SuperAdminView.eliminarColegio('${id}'); App.closeModal();" style="margin-left: 0.5rem; ">Eliminar</button>
    `;

    App.openModal('Editar Colegio', html, footer);
  },

  async guardarColegio() {
    const nombre = document.getElementById('col-nombre').value.trim();
    const rbd = document.getElementById('col-rbd') ? document.getElementById('col-rbd').value.trim() : '';
    const contacto = document.getElementById('col-contacto').value.trim();
    const suscripcion = document.getElementById('col-suscripcion').value;

    try {
      const docId = Date.now().toString();
      const { error } = await this.table('colegios').insert({
        id: docId,
        nombre,
        rbd,
        contacto,
        suscripcion,
        createdAt: new Date().toISOString()
      });
      if (error) throw error;

      App.closeModal();
      App.showToast('Colegio registrado exitosamente', 'success');
      this.render(document.getElementById('app-content'));
    } catch (e) {

      App.showToast('Error al crear colegio: ' + e.message, 'danger');
    }
  },

  async actualizarColegio(id) {
    const nombre = document.getElementById('col-nombre-edit').value.trim();
    const contacto = document.getElementById('col-contacto-edit').value.trim();
    const rbd = document.getElementById('col-rbd-edit') ? document.getElementById('col-rbd-edit').value.trim() : '';
    const suscripcion = document.getElementById('col-suscripcion-edit').value;

    try {
      const { error } = await this.table('colegios').update({
        nombre,
        contacto,
        rbd,
        suscripcion
      }).eq('id', id);
      if (error) throw error;

      App.closeModal();
      App.showToast('Colegio actualizado correctamente', 'success');
      this.render(document.getElementById('app-content'));
    } catch (e) {

      App.showToast('Error al actualizar colegio: ' + e.message, 'danger');
    }
  },

  async eliminarColegio(id) {
    App.confirm('¿Eliminar Colegio?', 'Esta acción borrará al colegio de los registros generales.', async () => {
      try {
        const { error } = await this.table('colegios').delete().eq('id', id);
        if (error) throw error;
        
        App.showToast('Colegio eliminado', 'success');
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
