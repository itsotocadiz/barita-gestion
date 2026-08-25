/* ================================================================
   app.js — Orquestador de la Aplicación
   Manejo de navegación (router), modales, notificaciones,
   y funciones globales como import/export.
   ================================================================ */

const App = {
  currentView: 'dashboard',
  initialized: false,
  
  init() {
    this.setupNavigation();
    this.setupModals();
    
    // Check theme
    if (localStorage.getItem('tdb_theme') === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    
    window.addEventListener('hashchange', () => this.handleRoute());
    
    // Process OAuth hashes (#access_token=...) or initial route on app load
    this.handleRoute();

    // Iniciar Autenticación, que a su vez iniciará Storage y las rutas
    if (typeof Auth !== 'undefined') {
      Auth.init();
    }
    
    // Global error handlers removed to prevent annoying popups for harmless cross-origin errors

    this.initialized = true;
  },

  /* ── Navegación ── */
  setupNavigation() {
    const btnLanding = document.getElementById('btn-landing-ingreso');
    const cardLanding = document.getElementById('card-landing-ingreso');
    const handler = (e) => {
      if (e) e.stopPropagation();
      if (typeof Auth !== 'undefined' && Auth.showLoginForm) {
        Auth.showLoginForm();
      } else {
        const formCont = document.getElementById('login-form-container');
        const optCont = document.getElementById('landing-options-container');
        if (formCont) formCont.style.display = 'block';
        if (optCont) optCont.style.display = 'none';
      }
    };
    if (btnLanding) btnLanding.addEventListener('click', handler);
    if (cardLanding) cardLanding.addEventListener('click', handler);

    // Mobile/Desktop menu toggle and initialization
    const btnMenu = document.getElementById('btn-menu');
    const sidebar = document.getElementById('sidebar');
    
    // Restaurar preferencia de colapsado en escritorio al cargar la app
    const isCollapsed = localStorage.getItem('barita_sidebar_collapsed') === 'true';
    if (isCollapsed && window.innerWidth > 768) {
      document.body.classList.add('sidebar-collapsed');
    }

    if (btnMenu && sidebar) {
      btnMenu.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          sidebar.classList.toggle('open');
        } else {
          document.body.classList.toggle('sidebar-collapsed');
          const nowCollapsed = document.body.classList.contains('sidebar-collapsed');
          localStorage.setItem('barita_sidebar_collapsed', nowCollapsed ? 'true' : 'false');
        }
      });
    }
    
    this.renderHeaderActions();
  },

  renderHeaderActions() {
    const headerActions = document.getElementById('header-actions');
    if (!headerActions) return;

    const S = (str) => String(str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const user = (typeof Auth !== 'undefined' && Auth.currentUser) ? Auth.currentUser : null;
    const rawRole = (typeof Auth !== 'undefined' && Auth.currentRole) ? Auth.currentRole : 'sin_rol';
    const userProfile = (typeof Auth !== 'undefined' && Auth.userProfile) ? Auth.userProfile : null;
    const rawName = (userProfile && (userProfile.nombres || userProfile.nombre || userProfile.nombre_completo)) ||
                    (user && user.user_metadata && user.user_metadata.full_name) ||
                    (user ? (user.email || user.id) : 'Invitado');

    const roleLabels = {
      superadmin: 'SUPER ADMIN',
      admin: 'INSPECTOR GENERAL',
      administrador: 'INSPECTOR GENERAL',
      directora: 'DIRECTORA',
      director: 'DIRECTORA',
      utp: 'UTP',
      inspectoria: 'INSPECTORÍA GENERAL',
      profesor: 'PROFESOR',
      convivencia: 'CONVIVENCIA ESCOLAR',
      pie: 'PIE',
      finanzas: 'FINANZAS',
      coordinadora: 'COORDINADORA',
      postulante: 'POSTULANTE'
    };
    const userEmail = (typeof Auth !== 'undefined' && Auth.currentUser ? Auth.currentUser.email : '').trim().toLowerCase();
    const isRealSuperAdmin = userEmail === 'itsotocadiz@gmail.com' || (typeof sessionStorage !== 'undefined' && !!sessionStorage.getItem('superadmin_original'));

    let displayRole = roleLabels[rawRole.toLowerCase()] || rawRole.toUpperCase();
    if (isRealSuperAdmin && rawRole.toLowerCase() !== 'superadmin') {
      displayRole = `${displayRole} (SUPER ADMIN)`;
    }

    const testModeBadge = window.ALLOW_ALL_ROLES_FULL_ACCESS 
      ? '<span style="background:#fef3c7; color:#b45309; padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:700; margin-left:4px;">⚡ MODO PRUEBAS</span>' 
      : '';

    // SuperAdmin School Switcher (Gestión puro)
    const isSuperAdmin = (rawRole.toLowerCase() === 'superadmin' || isRealSuperAdmin);
    const rawSchool = (typeof Storage !== 'undefined' && Storage.activeSchool) ? Storage.activeSchool : 'demo';
    const currentSchool = rawSchool === 'escuela_demo' ? 'demo' : rawSchool;
    const schoolSwitcherHTML = isSuperAdmin ? `
      <div style="background: linear-gradient(135deg, #ede9fe, #e0e7ff); border: 1px solid #a5b4fc; padding: 0.3rem 0.65rem; border-radius: 8px; font-size: 0.8rem; color: #3730a3; display: flex; align-items: center; gap: 0.4rem; font-weight: 600;">
        ${Icons.get('school', 18)}
        <span style="font-weight: 700;">Escuela Activa:</span>
        <select id="global-school-switcher" onchange="App.switchSchoolContext(this.value)" style="background: transparent; border: none; font-weight: 800; color: #4338ca; cursor: pointer; font-size: 0.8rem; padding: 0.15rem 0.25rem;">
          <option value="terra_di_bimbi" ${currentSchool === 'terra_di_bimbi' ? 'selected' : ''}>Terra Di Bimbi</option>
          <option value="demo" ${currentSchool === 'demo' ? 'selected' : ''}>Escuela Demo</option>
        </select>
      </div>
    ` : '';

    headerActions.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
        ${schoolSwitcherHTML}
        <div style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 0.35rem 0.75rem; border-radius: 8px; font-size: 0.825rem; color: #1e293b; display: flex; align-items: center; gap: 0.4rem; font-weight: 500;">
          ${Icons.get('user', 18)}
          <span><b>${S(rawName)}</b></span>
          <span style="color: #94a3b8;">|</span>
          <span>Rol: <strong style="color: var(--primary);">${S(displayRole)}</strong></span>
          ${testModeBadge}
        </div>
        <button class="btn btn-secondary btn-sm inline-flex items-center gap-2" onclick="
          const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
          if (isDark) {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('tdb_theme', 'light');
          } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('tdb_theme', 'dark');
          }
        " title="Cambiar tema">${Icons.get('sun-moon', 18)} Tema</button>
      </div>
    `;
  },

  async switchSchoolContext(schoolId) {
    if (!schoolId) return;
    try {
      if (typeof Storage !== 'undefined' && Storage.setActiveSchool) {
        await Storage.setActiveSchool(schoolId);
      } else {
        localStorage.setItem('barita_active_school', schoolId);
      }

      // Update sidebar branding to reflect the new school
      if (this.updateSidebarBranding) this.updateSidebarBranding();
      
      // Re-render header to update the switcher selection
      if (this.renderHeaderActions) this.renderHeaderActions();
      
      // Re-render current route to show data from the new school
      if (this.handleRoute) this.handleRoute(true);

      const normId = schoolId === 'escuela_demo' ? 'demo' : schoolId;
      const schoolLabel = normId === 'terra_di_bimbi' ? 'Terra Di Bimbi' : 'Escuela Demo';
      if (this.showToast) this.showToast(`${Icons.get('school', 16)} Contexto cambiado a: ${schoolLabel}`, 'success');
    } catch (err) {
      console.error('Error al cambiar contexto de escuela:', err);
      if (this.showToast) this.showToast('Error al cambiar de escuela: ' + err.message, 'danger');
    }
  },

  updateSidebarBranding() {
    const sidebarLogo = document.querySelector('.sidebar-logo');
    if (!sidebarLogo) return;

    const schoolProfile = (typeof Storage !== 'undefined' && Storage.getSchoolProfile) ? Storage.getSchoolProfile() : { nombre: 'BARITA', logo: '' };

    const logoHtml = schoolProfile.logo 
      ? `<img src="${schoolProfile.logo}" alt="Logo ${schoolProfile.nombre}" style="width: 36px; height: 36px; object-fit: contain; border-radius: 6px;">`
      : `<div class="logo-icon" style="color: var(--primary); display: flex; align-items: center; justify-content: center;">${Icons.get('sparkles', 22)}</div>`;

    sidebarLogo.innerHTML = `
      ${logoHtml}
      <div class="logo-text">
        <h1 style="font-size: 1.15rem; margin: 0; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 155px;" title="${schoolProfile.nombre}">${schoolProfile.nombre}</h1>
      </div>
    `;
  },

  renderSidebar() {
    this.updateSidebarBranding();
    this.renderHeaderActions();

    const container = document.getElementById('sidebar-nav-container');
    if (!container) return;

    if (typeof Auth === 'undefined' || !Auth.currentUser) {
      container.innerHTML = '';
      return;
    }

    const isTestingMode = !!window.ALLOW_ALL_ROLES_FULL_ACCESS;
    const menuConfig = (typeof Storage !== 'undefined' && Storage.getMenuConfig) ? Storage.getMenuConfig() : {};
    let myRole = (Auth.currentRole || 'usuario').toLowerCase();
    if (myRole === 'finanza') myRole = 'finanzas';

    let myViews = (menuConfig && menuConfig[myRole]) ? menuConfig[myRole] : [];

    const ALL_ITEMS = [
      { id: 'dashboard', icon: Icons.get('layout-dashboard', 20), label: 'Dashboard', group: null },
      { id: 'agenda', icon: Icons.get('calendar', 20), label: 'Mi Agenda', group: null },
      { id: 'notas', icon: Icons.get('file-text', 20), label: 'Muro de Notas', group: null },

      { id: 'cursos', icon: Icons.get('graduation-cap', 20), label: 'Cursos / Estudiantes', group: 'GESTIÓN ESCOLAR' },
      { id: 'funcionarios', icon: Icons.get('user-check', 20), label: 'Funcionarios', group: 'GESTIÓN ESCOLAR' },
      { id: 'asistencia', icon: Icons.get('clock', 20), label: 'Asistencia / Atrasos', group: 'GESTIÓN ESCOLAR' },

      { id: 'casos', icon: Icons.get('alert-triangle', 20), label: 'Casos en Seguimiento', group: 'SEGUIMIENTO Y ALERTAS' },
      { id: 'alertas_asistencia', icon: Icons.get('alert-triangle', 20), label: 'Alertas de Asistencia', group: 'SEGUIMIENTO Y ALERTAS' },

      { id: 'convivencia', icon: Icons.get('handshake', 20), label: 'Convivencia Escolar', group: 'ÁREAS INSTITUCIONALES' },
      { id: 'utp', icon: Icons.get('book-open', 20), label: 'UTP', group: 'ÁREAS INSTITUCIONALES' },
      { id: 'pie', icon: Icons.get('puzzle', 20), label: 'PIE', group: 'ÁREAS INSTITUCIONALES' },
      { id: 'profesor', icon: Icons.get('briefcase', 20), label: 'Portal Profesores', group: 'ÁREAS INSTITUCIONALES' },
      { id: 'finanzas', icon: Icons.get('dollar-sign', 20), label: 'Finanzas', group: 'ÁREAS INSTITUCIONALES' },

      { id: 'consultas', icon: Icons.get('message-square', 20), label: 'Asistencia IA', group: 'ASISTENTE VIRTUAL IA' },

      { id: 'documentos', icon: Icons.get('folder', 20), label: 'Documentos', group: 'SISTEMA Y CONFIGURACIÓN' },
      { id: 'admin', icon: Icons.get('settings', 20), label: 'Panel de Control', group: 'SISTEMA Y CONFIGURACIÓN' },
      { id: 'superadmin', icon: Icons.get('crown', 20), label: 'Super Admin', group: 'SISTEMA Y CONFIGURACIÓN' }
    ];

    const isSuperAdmin = myRole === 'superadmin';
    const isAdmin = ['superadmin', 'admin', 'administrador', 'administrator'].includes(myRole);
    const isDirector = myRole === 'directora' || myRole === 'director';
    const isPIE = myRole === 'pie';
    const tieneSesionOriginalSa = !!sessionStorage.getItem('superadmin_original');

    let html = '';
    let currentGroup = null;

    ALL_ITEMS.forEach(item => {
      // Restricción para roles UTP, PIE, DIRECCIÓN y CONVIVENCIA: Ocultar documentos, finanzas, alertas_asistencia y asistencia
      const restrictedRoles = ['utp', 'pie', 'directora', 'director', 'convivencia'];
      if (restrictedRoles.includes(myRole)) {
        if (item.id === 'documentos' || item.id === 'finanzas' || item.id === 'alertas_asistencia' || item.id === 'asistencia') {
          return;
        }
      }

      // Restricción para rol PIE: Ocultar Finanzas, Documentos, Panel de Control y SuperAdmin
      if (isPIE && (item.id === 'finanzas' || item.id === 'documentos' || item.id === 'admin' || item.id === 'superadmin')) return;

      // Documentos: Oculto para Director, visible para UTP, Admin y SuperAdmin
      if (item.id === 'documentos' && isDirector) return;

      // Panel de Control: Oculto para Director y UTP, visible solo para Admin y SuperAdmin
      if (item.id === 'admin' && !isAdmin) return;

      // Super Admin: Exclusivo para SuperAdmin o si posee sesión original de Super Admin (retorno de simulación)
      if (item.id === 'superadmin' && !isSuperAdmin && !tieneSesionOriginalSa) return;

      if (!isTestingMode && !isSuperAdmin) {
        if (myViews.length > 0 && !myViews.includes(item.id)) return;
        if (item.roleOnly && Auth.currentRole !== item.roleOnly) return;
      }

      if (item.group && item.group !== currentGroup) {
        html += `<div class="nav-separator"><span>${item.group}</span></div>`;
        currentGroup = item.group;
      }

      html += `
        <a href="#/${item.id}" class="nav-item" data-view="${item.id}">
          <span class="nav-icon">${item.icon}</span>
          <span class="nav-label">${item.label}</span>
        </a>
      `;
    });

    container.innerHTML = html;
  },

  async handleAuthHashCallback() {
    const rawHash = window.location.hash || '';
    const rawSearch = window.location.search || '';

    if (!rawHash.includes('access_token') && !rawHash.includes('provider_token') && !rawSearch.includes('code=')) {
      return false;
    }

    try {
      const client = (typeof window.getSupabaseClient === 'function')
        ? window.getSupabaseClient()
        : (window.supabaseGestion || window.supabasePostulaciones);

      if (rawHash.includes('access_token')) {
        const hashContent = rawHash.replace(/^#\/?/, '');
        const params = new URLSearchParams(hashContent);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token') || '';

        if (accessToken && client && client.auth && typeof client.auth.setSession === 'function') {
          await client.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
        }
      }

      if (rawSearch.includes('code=')) {
        const searchParams = new URLSearchParams(rawSearch);
        const code = searchParams.get('code');
        if (code && client && client.auth && typeof client.auth.exchangeCodeForSession === 'function') {
          await client.auth.exchangeCodeForSession(code);
        }
      }
    } catch (err) {
      console.error('Error al procesar tokens OAuth/Supabase:', err);
    } finally {
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, document.title, window.location.pathname);
      }
      const overlay = document.getElementById('login-overlay');
      if (overlay) overlay.style.display = 'none';
      
      const targetHash = '#/dashboard';
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      } else {
        this.handleRoute();
      }
    }
    return true;
  },

  async handleRoute(isSilentSync = false) {
    const rawHash = window.location.hash || '';
    
    // Evitar llamadas duplicadas idénticas si ya se renderizó con datos listos
    const ahora = Date.now();
    const isReady = typeof Storage !== 'undefined' && Storage.isReady;
    if (this._lastRouteHash === rawHash && this._lastRouteReady && !isSilentSync) {
      console.log("DEBUG handleRoute - Ignorando llamada duplicada ya renderizada con datos listos para hash:", rawHash);
      return;
    }
    this._lastRouteHash = rawHash;
    this._lastRouteTime = ahora;
    this._lastRouteReady = isReady;

    const rawSearch = window.location.search || '';
    if (rawHash.includes('access_token') || rawHash.includes('provider_token') || rawSearch.includes('code=')) {
      const intercepted = await this.handleAuthHashCallback();
      if (intercepted) return;
    }

    let defaultView = '/dashboard';
    if (typeof Auth !== 'undefined' && Auth.currentUser) {
      const email = (Auth.currentUser.email || '').trim().toLowerCase();
      if (email === 'itsotocadiz@gmail.com') {
        defaultView = '/superadmin';
      }
    }
    if (typeof Auth !== 'undefined' && Auth.isLoggingOut) {
      defaultView = '/';
    }
    const hash = window.location.hash.substring(1) || defaultView;
    const parts = hash.split('/').filter(Boolean);
    const view = parts[0] || 'dashboard';
    const id = parts[1] || null;
    
    // Save scroll position for silent syncs
    let savedScroll = 0;
    const scrollContainer = document.querySelector('.main-content');
    if (isSilentSync && scrollContainer) {
      savedScroll = scrollContainer.scrollTop;
      // Do not re-render admin view on silent sync to prevent form reset and jumping
      if (view === 'admin') {
        this.renderSidebar();
        return;
      }
    }
    
    // Offline/local fallback: if Firestore/sync is not ready, still render local agents
    if (!Storage.isReady) {
      this.renderOfflineBanner();
    } else {
      this.removeOfflineBanner();
    }
    
    this.currentView = view;
    
    const yearSel = document.getElementById('sidebar-year-select');
    if (yearSel) yearSel.value = Storage.getActiveYear();
    
    const isImpersonating = typeof sessionStorage !== 'undefined' && !!sessionStorage.getItem('superadmin_original');
    const isSuperAdminNoImpersonate = Auth.currentRole === 'superadmin' && !isImpersonating;
    
    // Validacion sincrona preventiva por email por si el rol aun esta resolviendose asincronamente
    const userEmail = Auth.currentUser ? ((Auth.currentUser.email || Auth.currentUser.user_metadata?.email || '').trim().toLowerCase()) : '';
    const isSuperEmail = userEmail === 'itsotocadiz@gmail.com';
    const isSuperAdminReal = isSuperAdminNoImpersonate || (isSuperEmail && !isImpersonating);

    let shouldHideSidebar = view === 'superadmin' || 
                              isSuperAdminReal ||
                              !Auth.currentUser;

    if (typeof Auth !== 'undefined' && Auth.isLoggingOut) {
      shouldHideSidebar = true;
      const loadingEl = document.getElementById('login-loading');
      if (loadingEl) loadingEl.style.display = 'none';
      this._lastRouteHash = null;
    }

    const sidebarEl = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');

    if (shouldHideSidebar) {
      if (sidebarEl) sidebarEl.style.display = 'none';
      if (mainContent) {
        mainContent.style.marginLeft = '0';
        mainContent.style.width = '100%';
        mainContent.style.maxWidth = '100%';
      }
    } else {
      if (sidebarEl) sidebarEl.style.display = 'flex';
      if (mainContent) {
        mainContent.style.marginLeft = '';
        mainContent.style.width = '';
        mainContent.style.maxWidth = '';
      }
    }
    
    // Render sidebar before applying active class
    this.renderSidebar();

    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.remove('active');
      if (el.getAttribute('data-view') === view) {
        el.classList.add('active');
      }
    });

    // Close mobile sidebar on navigate
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');

    // Route to corresponding module
    if (typeof Auth !== 'undefined' && Auth.isLoggingOut) {
      // Ignorar verificaciones de RouteGuard durante el logout
    } else {
      if (typeof RouteGuard !== 'undefined' && !RouteGuard.requireRole(view)) return;
    }
    const contentBody = document.getElementById('app-content');
    contentBody.innerHTML = '<div class="text-center mt-4">Cargando...</div>';
    try {
      const routeRegistry = {
        'dashboard': () => DashboardView.render(contentBody),
        'cursos': (id) => id ? CursosView.renderCurso(contentBody, id) : CursosView.renderList(contentBody),
        'directora': () => DirectoraView.render(contentBody),
        'profesor': () => ProfesorView.render(contentBody),
        'utp': () => UtpView.render(contentBody),
        'convivencia': () => ConvivenciaView.render(contentBody),
        'estudiantes': (id) => id ? EstudiantesView.renderDetalle(contentBody, id) : (window.location.hash = '#/cursos'),
        'pie': (id) => id ? EstudiantesView.renderFichaPIE(contentBody, id) : PieView.render(contentBody),
        'funcionarios': (id) => id ? FuncionariosView.renderDetalle(contentBody, id) : FuncionariosView.renderList(contentBody),

        'casos': (id) => { 
          try { 
            id ? CasosView.renderDetalle(contentBody, id) : CasosView.renderList(contentBody); 
          } catch(e) { 
            contentBody.innerHTML = '<div class="card"><h2 class="text-danger">Error cargando Casos Graves</h2><p>' + e.message + '</p></div>'; 
          } 
        },

        'consultas': () => ConsultasProfesoresView.render(contentBody),
        'postulantes': () => PostulantesView.render(contentBody),
        'asistencia': () => AsistenciaView.render(contentBody),
        'alertas_asistencia': () => AlertasAsistenciaView.render(contentBody),
        'agenda': () => AgendaView.render(contentBody),
        'notas': (id) => (typeof NotasView !== 'undefined' ? NotasView : window.NotasView).render(contentBody, id),
        'documentos': () => DocumentosView.render(contentBody),

        'seguimientos': () => SeguimientosView.render(contentBody),
        'pise': () => PiseView.render(contentBody),
        'finanzas': () => FinanzasView.render(contentBody),
        'inspectoria': () => InspectoriaView.render(contentBody),

        'admin': () => AdminLocalView.render(contentBody),
        'superadmin': () => {
          if (typeof SuperAdminView === 'undefined') throw new ReferenceError('SuperAdminView');
          const hash = window.location.hash || '';
          if (hash.startsWith('#/superadmin/postulaciones')) {
            SuperAdminView.currentSystem = 'postulaciones';
            SuperAdminView.currentTab = 'postulaciones';
            SuperAdminView.render(contentBody);
          } else {
            SuperAdminView.currentSystem = 'gestion';
            SuperAdminView.currentTab = 'colegios';
            SuperAdminView.render(contentBody);
          }
        }
      };

      if (routeRegistry[view]) {
        try {
          routeRegistry[view](id);
        } catch (err) {
          console.error(`Error renderizando modulo ${view}:`, err);
          contentBody.innerHTML = `
            <div class="card text-danger" style="padding: 1.5rem; border-top: 4px solid var(--danger);">
              <h2>⚠️ Error al cargar el módulo "${view}"</h2>
              <p><b>Detalle técnico del error:</b> ${S(err.message)}</p>
              <pre style="background: #f8fafc; padding: 1rem; border-radius: 6px; font-size: 0.8rem; overflow-x: auto; color: #dc2626;">${S(err.stack || err.toString())}</pre>
            </div>
          `;
        }
      } else {
        console.warn(`[Router Fallback] Ruta o vista no reconocida ("${view}"). Redirigiendo automáticamente a /#/dashboard.`);
        window.location.hash = '#/dashboard';
        return;
      }
    } catch (e) {
      contentBody.innerHTML = `<div class="card text-danger"><h2>Error del sistema</h2><p>${e.message}</p></div>`;
    }
    
    if (isSilentSync && scrollContainer && savedScroll > 0) {
      // Use setTimeout to ensure DOM has updated before scrolling
      setTimeout(() => {
        scrollContainer.scrollTop = savedScroll;
      }, 50);
    }
  },

  setBreadcrumb(html) {
    const el = document.getElementById('breadcrumb');
    if (el) el.innerHTML = html;
  },

  /* ── Modales ── */
  setupModals() {
    let overlay = document.getElementById('modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'modal-overlay';
      overlay.className = 'modal-overlay hidden';
      overlay.innerHTML = '<div class="modal-container" id="modal-container"></div>';
      document.body.appendChild(overlay);
    }
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeModal();
    });
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
        const aiDrawer = document.getElementById('ai-drawer-overlay');
        if (aiDrawer) aiDrawer.classList.add('hidden');
        const funcDrawer = document.getElementById('funcionario-informe-drawer');
        if (funcDrawer) funcDrawer.remove();
      }
    });
  },
  openModal(title, bodyHtml, footerHtml = '') {
    let overlay = document.getElementById('modal-overlay');
    if (!overlay) {
      this.setupModals();
      overlay = document.getElementById('modal-overlay');
    }
    const container = document.getElementById('modal-container');
    
    container.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
    `;
    
    overlay.classList.remove('hidden');
  },

  closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.add('hidden');
  },

  /* ── Notificaciones (Toasts) ── */
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-message">${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  },

  /* ── Confirmaciones ── */
  confirm(title, message, onConfirm) {
    return this.showConfirm(title, message, onConfirm);
  },

  showConfirm(title, message, onConfirm) {
    if (window.UIComponents && typeof window.UIComponents.showConfirm === 'function') {
      return window.UIComponents.showConfirm(title, message, onConfirm);
    }
    
    let overlay = document.getElementById('confirm-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'confirm-overlay';
      overlay.className = 'modal-overlay open';
      overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:99999;';
      overlay.innerHTML = '<div id="confirm-dialog" class="modal-content" style="background:#fff; padding:1.5rem; border-radius:12px; max-width:400px; width:90%; box-shadow:0 10px 25px rgba(0,0,0,0.2);"></div>';
      document.body.appendChild(overlay);
    }
    
    const dialog = document.getElementById('confirm-dialog');
    if (dialog) {
      dialog.innerHTML = `
        <h3 class="confirm-title" style="margin-top:0; font-size:1.1rem; color:var(--text-main);">${title}</h3>
        <p class="confirm-message" style="margin:1rem 0; color:var(--text-secondary); font-size:0.9rem;">${message}</p>
        <div class="confirm-actions" style="display:flex; justify-content:flex-end; gap:0.5rem;">
          <button class="btn btn-secondary" id="confirm-cancel">Cancelar</button>
          <button class="btn btn-danger" id="confirm-ok">Eliminar</button>
        </div>
      `;
    }
    
    overlay.style.display = 'flex';
    overlay.classList.remove('hidden');
    
    const btnCancel = document.getElementById('confirm-cancel');
    if (btnCancel) {
      btnCancel.onclick = () => {
        overlay.style.display = 'none';
        overlay.classList.add('hidden');
      };
    }
    
    const btnOk = document.getElementById('confirm-ok');
    if (btnOk) {
      btnOk.onclick = () => {
        overlay.style.display = 'none';
        overlay.classList.add('hidden');
        if (typeof onConfirm === 'function') onConfirm();
      };
    }
  },

  /* ── Badges Update ── */
  updateBadges() {
    const stats = Storage.getStats();
    
    const badgeProt = document.getElementById('badge-protocolos');
    if (badgeProt) {
      badgeProt.textContent = stats.protocolosActivos;
      badgeProt.style.display = stats.protocolosActivos > 0 ? 'inline-block' : 'none';
    }
    
    const badgeCasos = document.getElementById('badge-casos');
    if (badgeCasos) {
      badgeCasos.textContent = stats.casosAbiertos;
      badgeCasos.style.display = stats.casosAbiertos > 0 ? 'inline-block' : 'none';
    }
  },

  /* ── Offline/local fallback banner ── */
  renderOfflineBanner() {
    this.removeOfflineBanner();
    const banner = document.createElement('div');
    banner.id = 'offline-mode-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#f59e0b;color:#000;padding:0.5rem 1rem;text-align:center;font-weight:600;z-index:99999;font-size:0.85rem;box-shadow:0 2px 6px rgba(0,0,0,0.15);';
    banner.innerHTML = '⚠️ Modo offline/sincronización pendiente: estás visualizando datos locales.';
    document.body.appendChild(banner);
    const appRoot = document.getElementById('app-root');
    if (appRoot) {
      appRoot.style.marginTop = '38px';
      appRoot.style.height = 'calc(100vh - 38px)';
    }
  },

  updateRoleNav() {
    const role = Auth.currentRole || 'coordinadora';
    const configured = window.ROLES ? window.ROLES[role] : null;
    const rolesToMenu = Array.isArray(configured) ? configured : (configured && configured.menu ? configured.menu : []);
    const roleToLabel = window.ROUTES || {};
    const allowedViews = new Set(rolesToMenu.map(key => {
      if (roleToLabel[key]) {
        const val = String(roleToLabel[key]);
        return val.replace('#/', '').split('/')[0];
      }
      return key;
    }));

    document.querySelectorAll('.sidebar .nav-item').forEach(el => {
      const view = el.getAttribute('data-view');
      if (!view) return;
      const isAllowed = allowedViews.has(view) || view === 'dashboard';
      el.style.display = isAllowed ? '' : 'none';
    });
  },

  removeOfflineBanner() {
    const banner = document.getElementById('offline-mode-banner');
    if (banner) {
      banner.remove();
      const appRoot = document.getElementById('app-root');
      if (appRoot) {
        appRoot.style.marginTop = '';
        appRoot.style.height = '';
      }
    }
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
