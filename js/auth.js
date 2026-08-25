/* ================================================================
   auth.js — Lógica de Autenticación y Roles
   Maneja el login, logout y la obtención del rol del usuario.
   ================================================================ */

const Auth = (() => {
  const state = {
    currentUser: null,
    currentRole: null,
    userProfile: null,
    _activeClient: null,
    _geminiFailCount: 0,
    _geminiBlockedUntil: 0,
    authInitialized: false,
    isLoggingOut: false,
    _pendingTimeouts: []
  };

  function bindEvents() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleLogin();
      });
    }

    const linkForgot = document.getElementById('link-forgot-password');
    if (linkForgot) {
      linkForgot.addEventListener('click', (e) => {
        e.preventDefault();
        handleForgotPassword();
      });
    }

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        handleLogout();
      });
    }
  }

  async function init() {
    bindEvents();

    window.supabaseGestion.auth.onAuthStateChange(async (event, session) => {
      if (state.isLoggingOut) return;
      if (event === 'TOKEN_REFRESHED') {
        console.log("Ignorando TOKEN_REFRESHED para evitar re-suscripcion y parpadeo");
        return;
      }
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (session?.user) await _handleUserLoggedIn(session.user, window.supabaseGestion);
      } else if (event === 'SIGNED_OUT') {
        if (!state.currentUser || state._activeClient === window.supabaseGestion) _handleUserLoggedOut();
      }
    });

  }

  async function _handleUserLoggedIn(user, client) {
    if (state.isLoggingOut) return;
    if (user && user.id && !user.uid) user.uid = user.id;
    state.currentUser = user;
    state._activeClient = client;

    // Mostrar cargador estético mientras se inicializa el sync offline/asíncrono
    showLoadingState('Iniciando sesión...', 'Sincronizando base de datos local y preparando tu entorno.');

    try {
      await fetchUserRole(user.id);
      
      // Force setSchool to re-evaluate tenant isolation rules now that we have the role and profile
      if (typeof Storage !== 'undefined' && Storage.setSchool) {
        await Storage.setSchool(Storage.activeSchool || 'demo');
      }
      // BLOQUEO POR SUSCRIPCIÓN (aplica a sesión restaurada / Google OAuth)
      if(state.currentRole !== 'superadmin' && typeof Storage!=='undefined' && Storage.activeSchool){
        try{
          const chkClient = window.getSupabaseClient('gestion');
          const { data: colChk2 } = await chkClient.from('colegios').select('estado_suscripcion,suscripcion,motivo_bloqueo').eq('id', Storage.activeSchool).maybeSingle();
          const v2 = (colChk2?.estado_suscripcion || colChk2?.suscripcion || '').toString().toLowerCase();
          if(v2 === 'bloqueado' || v2 === 'suspendida'){
            App.showToast('Colegio bloqueado por falta de pago: ' + (colChk2.motivo_bloqueo||'Contacte administración'), 'danger');
            // Forzar logout suave y mostrar login
            setTimeout(()=>{ try{ handleLogout(); }catch(_e){} }, 800);
            // No continuar con showApp inmediato, dejar que logout maneje
            return;
          }
        }catch(_e){ console.warn('Check bloqueo en _handleUserLoggedIn:', _e); }
      }
    } catch (e) {
      console.error('Error obteniendo rol de usuario:', e);
    }

    try {
      await Storage.initRealtimeSync();
    } catch (e) {
      console.warn('Advertencia inicializando sync en tiempo real:', e);
    }

    const currentHash = window.location.hash || '';
    const isImpersonating = typeof sessionStorage !== 'undefined' && !!sessionStorage.getItem('superadmin_original');
    if (state.currentRole === 'superadmin' && !isImpersonating && !currentHash.startsWith('#/superadmin') && !currentHash.startsWith('#/postulantes')) {
      window.location.hash = '#/superadmin';
    }

    showApp();
  }

  function _handleUserLoggedOut() {
    state.currentUser = null;
    state.currentRole = null;
    state._activeClient = null;
    if (window.location.hash !== '#/') {
      window.location.hash = '#/';
    }
    showLogin();
  }

  async function handleLogout() {
    state.isLoggingOut = true;

    // Cancelar cualquier timeout pendiente para evitar redirecciones tardías
    try {
      state._pendingTimeouts.forEach(clearTimeout);
      state._pendingTimeouts = [];
    } catch (_e) {}

    if (typeof Storage !== 'undefined') {
      try { Storage.clearListeners(); } catch (_e) {}
      Storage.isReady = false;
    }

    // 1. Limpieza local inmediata de estados en memoria
    state.currentUser = null;
    state.currentRole = null;
    state.userProfile = null;

    // 2. Borrado explícito de tokens y roles
    try {
      localStorage.removeItem('barita-gestion-auth-token');
      localStorage.removeItem('barita_user_role');
      localStorage.removeItem('barita_pending_role');
    } catch (_e) {}

    // Limpiar localmente todas las demás claves de Supabase Auth en localStorage
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('auth-token') || key.includes('supabase.auth'))) {
          localStorage.removeItem(key);
        }
      }
    } catch (_e) {
      console.warn("Error limpiando localStorage:", _e);
    }

    // 3. Limpiar impersonación en sessionStorage
    try {
      const originalSession = sessionStorage.getItem('superadmin_original');
      if (originalSession) sessionStorage.removeItem('superadmin_original');
    } catch (_e) {}

    // 4. Actualizar la UI inmediatamente
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const loginOverlay = document.getElementById('login-overlay');

    if (sidebar) sidebar.style.display = 'none';
    if (mainContent) {
      mainContent.style.display = 'none';
      mainContent.style.marginLeft = '';
      mainContent.style.width = '';
      mainContent.style.maxWidth = '';
    }
    if (loginOverlay) loginOverlay.style.display = 'flex';

    const loginForm = document.getElementById('form-login');
    if (loginForm) loginForm.reset();
    const btnSubmit = document.getElementById('btn-submit-login');
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerText = 'Ingresar';
    }
    const loginFormContainer = document.getElementById('login-form');
    if (loginFormContainer) loginFormContainer.style.display = 'block';
    
    // Apagar cualquier spinner visible
    const loadingEl = document.getElementById('login-loading');
    if (loadingEl) loadingEl.style.display = 'none';

    // Mostrar las opciones de la landing principal al cerrar sesión
    const landingOptions = document.getElementById('landing-options-container');
    if (landingOptions) landingOptions.style.display = 'flex';
    const loginFormWrapper = document.getElementById('login-form-container');
    if (loginFormWrapper) loginFormWrapper.style.display = 'none';

    App.removeOfflineBanner && App.removeOfflineBanner();
    const banner = document.getElementById('offline-mode-banner');
    if (banner) banner.remove();
    const impBanner = document.getElementById('impersonation-banner');
    if (impBanner) impBanner.remove();

    // Actualizar URL a Hash limpio ANTES de llamar a signOut
    try { history.replaceState(null, '', window.location.pathname + '#/'); } catch (_e) {}

    // 5. Enviar señal de deslogueo a Supabase con timeout de 2 segundos
    try {
      if (window.supabaseGestion && window.supabaseGestion.auth) {
        await Promise.race([
          window.supabaseGestion.auth.signOut({ scope: 'local' }),
          new Promise(r => setTimeout(r, 2000))
        ]);
      }
    } catch (_e) {
      console.error("Error durante signOut:", _e);
    }

    try { window.location.hash = '#/'; } catch (_e) {}

    _handleUserLoggedOut();
    showLogin();

    setTimeout(() => {
      try {
        const hasToken = !!(localStorage.getItem('barita-gestion-auth-token') || localStorage.getItem('barita_user_role'));
        const stillLogged = !!state.currentUser;
        if (!hasToken && !stillLogged) state.isLoggingOut = false;
        else state.isLoggingOut = true;
      } catch (_e) { state.isLoggingOut = false; }
    }, 1500);
  }

  function logout() { return handleLogout(); }

  async function loginConGoogle() {
    const errorDiv = document.getElementById('login-error');
    if (errorDiv) errorDiv.style.display = 'none';

    try {
      const client = window.getSupabaseClient();
      const redirectUrl = window.location.origin + window.location.pathname;
      
      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl
        }
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error al iniciar sesión con Google:', error);
      if (errorDiv) {
        errorDiv.textContent = 'Error conectando con Google: ' + (error.message || error);
        errorDiv.style.display = 'block';
      }
    }
  }

  async function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    const btn = document.getElementById('btn-submit-login');

    errorDiv.style.display = 'none';
    btn.disabled = true;
    btn.innerText = 'Iniciando sesión...';

    // Mostrar estado de carga inicial en la landing
    showLoadingState('Validando credenciales...', 'Conectando con el servidor seguro de BARITA.');

    try {
      const client = window.getSupabaseClient('gestion');
      const { data, error } = await client.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) throw error;

      if (data && data.user) {
        state.currentUser = data.user;
        state._activeClient = client;
      }

      showLoadingState('Cargando sistema...', 'Sincronizando base de datos local y preparando tu entorno.');

      localStorage.removeItem('barita_active_year');
      if (typeof Storage !== 'undefined') Storage.activeYear = String(new Date().getFullYear());

      // Esperar rol antes de decidir hash (fix UTP/PIE/Dirección)
      await fetchUserRole(data.user.id);
      // BLOQUEO POR SUSCRIPCIÓN: si el colegio está bloqueado, impedir login (excepto superadmin)
      try{
        const activeSchoolForCheck = (typeof Storage!=='undefined' && Storage.activeSchool) ? Storage.activeSchool : (state.userProfile?.colegio_id || state.userProfile?.colegioId || '');
        if(activeSchoolForCheck && state.currentRole !== 'superadmin'){
          const clientChk = window.getSupabaseClient('gestion');
          const { data: colChk } = await clientChk.from('colegios').select('estado_suscripcion,suscripcion,motivo_bloqueo').eq('id', activeSchoolForCheck).maybeSingle();
          const v = (colChk?.estado_suscripcion || colChk?.suscripcion || '').toString().toLowerCase();
          const isBlocked = v === 'bloqueado' || v === 'suspendida';
          if(isBlocked){
            try{ await clientChk.auth.signOut({ scope: 'local' }); }catch(_e){}
            state.currentUser=null; state.currentRole=null; state.userProfile=null;
            throw new Error('Colegio bloqueado por falta de pago: ' + (colChk.motivo_bloqueo || 'Contacte a administración — suscripción suspendida.'));
          }
        }
      }catch(chkErr){
        if(chkErr && chkErr.message && chkErr.message.includes('Colegio bloqueado')) throw chkErr;
        // si falla el check por red, no bloquea y continúa (fail-open para no dejar fuera por error temporal)
        console.warn('Check bloqueo colegio falló:', chkErr);
      }
      try { localStorage.removeItem('barita_pending_role'); state.pendingRole = null; } catch(_e){}

      // Sincronización inmediata de interfaz
      const overlay = document.getElementById('login-overlay');
      if (overlay) overlay.style.display = 'none';

      const currentHash = window.location.hash || '';
      let targetDefault = '#/dashboard';
      if (state.currentRole === 'superadmin') targetDefault = '#/superadmin';

      if (currentHash === '' || currentHash === '#/' || currentHash.includes('login') || (state.currentRole === 'superadmin' && !currentHash.startsWith('#/superadmin'))) {
        window.location.hash = targetDefault;
      }

      _finishLogin();

      // Temporizador de respaldo rápido (300ms) por si el router o hash se atascan
      setTimeout(() => {
        const hash = window.location.hash || '';
        const currentOverlay = document.getElementById('login-overlay');
        const isOverlayVisible = currentOverlay && currentOverlay.style.display !== 'none';
        if (hash === '' || hash === '#/' || hash.includes('login') || isOverlayVisible) {
          if (currentOverlay) currentOverlay.style.display = 'none';
          if (typeof App !== 'undefined' && App.handleRoute) App.handleRoute();
          if (window.location.hash !== targetDefault) {
            window.location.href = window.location.origin + window.location.pathname + targetDefault;
          }
        }
      }, 300);

    } catch (error) {
      const loadingEl = document.getElementById('login-loading');
      if (loadingEl) loadingEl.style.display = 'none';
      const loginFormCont = document.getElementById('login-form-container');
      if (loginFormCont) loginFormCont.style.display = 'block';

      const isBlockedError = error && error.message && error.message.includes('Colegio bloqueado');
      const displayMsg = isBlockedError ? error.message : 'Error: Credenciales inválidas o cuenta no registrada.';
      // usar login-error (el que siempre existe) y también login-error-msg si existe
      try{
        const el1 = document.getElementById('login-error');
        const el2 = document.getElementById('login-error-msg');
        if(el1){ el1.textContent = displayMsg; el1.style.display='block'; }
        if(el2){ el2.textContent = displayMsg; el2.style.display='block'; }
        // compat con variable errorDiv del inicio
        if(errorDiv){ errorDiv.textContent = displayMsg; errorDiv.style.display='block'; }
      }catch(_e){
        if(errorDiv){ errorDiv.textContent = displayMsg; errorDiv.style.display='block'; }
      }
      // re-habilitar overlay login para que no quede pegado
      try{ document.getElementById('login-overlay').style.display='flex'; }catch(_e){}
      btn.disabled = false;
      btn.innerText = 'Ingresar';
    }
  }

  function _finishLogin() {
    try {
      const overlay = document.getElementById('login-overlay');
      if (overlay) overlay.style.display = 'none';
      const form = document.getElementById('login-form');
      if (form) form.style.display = 'none';
    } catch (_e) {}

    const loadingEl = document.getElementById('login-loading');
    if (loadingEl) loadingEl.style.display = 'none';

    if (state.currentUser) {
      showApp();
    }
  }

  function clearSessionCache() {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_e) {}
    window.location.hash = '#/';
    window.location.reload();
  }

  async function handleForgotPassword() {
    const emailInput = document.getElementById('login-email').value.trim();
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:99999;display:flex;justify-content:center;align-items:center;';
    overlay.innerHTML = `
      <div class="card" style="max-width:420px;width:92%;padding:1.25rem;background:white;">
        <h3 style="margin:0 0 0.5rem;color:var(--primary)">Recuperar contraseña</h3>
        <p style="margin:0 0 0.75rem;font-size:0.9rem;" class="text-secondary">Ingresa el correo asociado a tu cuenta para enviarte el enlace.</p>
        <input id="forgot-email" type="email" value="${emailInput.replace(/\"/g,'&quot;')}" class="form-control" placeholder="nombre@colegio.cl" style="width:100%;margin-bottom:0.75rem;">
        <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
          <button id="forgot-cancel" class="btn btn-secondary">Cancelar</button>
          <button id="forgot-send" class="btn btn-primary">Enviar enlace</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#forgot-cancel').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    document.addEventListener('keydown', function esc(e){ if (e.key === 'Escape'){ close(); document.removeEventListener('keydown', esc);} });

    overlay.querySelector('#forgot-send').onclick = async () => {
      const email = overlay.querySelector('#forgot-email').value.trim();
      if (!email) return;
      try {
        close();
        const client = window.getSupabaseClient();
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password.html' });
        if (error) throw error;
        App.showToast(`Se ha enviado un enlace a ${email}`, 'success');
      } catch (error) {
        App.showToast('Error al enviar el correo de recuperación: ' + error.message, 'danger');
      }
    };
  }

  async function fetchUserRole(uid) {
    if (state.isLoggingOut) return;
    try {
      if (!state.currentUser) return;

      const userEmail = ((state.currentUser.email || state.currentUser.user_metadata?.email) || '').trim().toLowerCase();

      // FIX: preservar impersonación al volver de pestaña — onAuthStateChange INITIAL_SESSION no debe pisar pie/utp
      const isImpSession = typeof sessionStorage !== 'undefined' && !!sessionStorage.getItem('superadmin_original');
      if (isImpSession) return;
      
      // Optimizacion critica y prevencion de cuelgues asincronos
      if (userEmail === 'itsotocadiz@gmail.com') {
        state.currentRole = 'superadmin';
        const currentHash = window.location.hash || '';
        const pending = (state.pendingRole || localStorage.getItem('barita_pending_role') || '').toLowerCase();
        const isPostulanteRoute = currentHash.startsWith('#/postulantes') || pending === 'postulante' || pending === 'directivo';
        
        if (isPostulanteRoute) {
          if (!state.isLoggingOut) {
            state._pendingTimeouts.push(setTimeout(() => {
              if (!state.isLoggingOut) window.location.hash = '#/superadmin/postulaciones';
            }, 10));
          }
        } else if (currentHash === '' || currentHash === '#/' || currentHash === '#/dashboard') {
          if (!state.isLoggingOut) {
            state._pendingTimeouts.push(setTimeout(() => {
              if (!state.isLoggingOut) window.location.hash = '#/superadmin';
            }, 10));
          }
        }
        return;
      }

      const currentHash = window.location.hash || '';
      
      // Si no estamos en una ruta de postulaciones, forzar limpieza de pending
      const isPostulanteHash = currentHash.startsWith('#/postulantes');
      if (!isPostulanteHash) {
        localStorage.removeItem('barita_pending_role');
        state.pendingRole = null;
      }

      const pending = (state.pendingRole || localStorage.getItem('barita_pending_role') || '').toLowerCase();
      const isPostulanteRoute = isPostulanteHash || pending === 'postulante' || pending === 'directivo';
      const clientGestion = window.getSupabaseClient('gestion');
      const clientPostulaciones = window.getSupabaseClient('postulaciones');

      // 1. SIEMPRE consultar primero public.usuarios en GESTIÓN para cuentas institucionales del colegio
      let { data, error } = await clientGestion.from('usuarios').select('*').eq('id', uid).maybeSingle();

      // Fallback por correo electrónico en GESTIÓN si id no retornó coincidencia directa
      if ((!data || error) && userEmail) {
        const { data: byEmail } = await clientGestion.from('usuarios').select('*').eq('email', userEmail).maybeSingle();
        if (byEmail) {
          data = byEmail;
          error = null;
        }
      }

      // 2. Si no se encontró en usuarios institucionales de GESTIÓN, y la ruta es de postulantes, buscar en POSTULACIONES
      if ((!data || error) && isPostulanteRoute) {
        let { data: postData } = await clientPostulaciones.from('postulantes').select('*').eq('id', uid).maybeSingle();
        if (!postData && userEmail) {
          const { data: postByEmail } = await clientPostulaciones.from('postulantes').select('*').eq('email', userEmail).maybeSingle();
          if (postByEmail) postData = postByEmail;
        }
        if (postData) {
          data = postData;
          data.role = 'postulante';
        }
      }

      if (data && data.role) {
        state._activeClient = clientGestion;
        if (userEmail !== 'itsotocadiz@gmail.com') {
          localStorage.removeItem('barita_pending_role');
          state.pendingRole = null;
        }
      }

      // 3. Role resolution — database-driven, school-agnostic
      // Superadmin hardcode solo si no está viendo como postulante/directivo (misma cuenta superadmin puede ver todo)
      if (userEmail === 'itsotocadiz@gmail.com') {
        state.currentRole = 'superadmin';
        if (isPostulanteRoute) {
          setTimeout(() => {
            window.location.hash = '#/superadmin/postulaciones';
          }, 10);
        } else if (currentHash === '' || currentHash === '#/' || currentHash === '#/dashboard') {
          setTimeout(() => {
            window.location.hash = '#/superadmin';
          }, 10);
        }
      } else if (data && (data.role || data.is_superadmin)) {
        if (data.is_superadmin === true || data.is_superadmin === 'true') {
          state.currentRole = 'superadmin';
          state.isSuperAdmin = true;
        } else {
          let r = (data.role || '').toString().trim().toLowerCase();
          if (r === 'director') r = 'directora';
          if (r === 'direccion' || r === 'dirección') r = 'directora';
          if (r === 'finanza') r = 'finanzas';
          if (r === 'administrador' || r === 'administrator') r = 'admin';
          if (r.includes('convivencia')) r = 'convivencia';
          // PIE may come as 'pie' or 'PIE'
          if (r.toLowerCase() === 'pie') r = 'PIE';
          state.currentRole = r;
        }
      } else if (state.currentUser.user_metadata && state.currentUser.user_metadata.role) {
        let r = state.currentUser.user_metadata.role.toString().trim().toLowerCase();
        if (r === 'director') r = 'directora';
        if (r === 'finanza') r = 'finanzas';
        if (r === 'administrador' || r === 'administrator') r = 'admin';
        if (r.includes('convivencia')) r = 'convivencia';
        state.currentRole = r;
      } else {
        state.currentRole = isPostulanteRoute ? (pending === 'directivo' ? 'directivo' : 'postulante') : 'admin';
      }

      try { localStorage.setItem('barita_user_role', state.currentRole); } catch (_e) {}

      if (data) {
        state.userProfile = data;
        // Tenant assignment: colegio_id comes strictly from the user's DB profile
        let userSchool = (data.colegio_id || data.colegioId || '').toString().trim();

        // AUTO-REPAIR: Si el usuario ya existía pero quedó sin colegio, tiene un UUID antiguo
        // o si es una cuenta de prueba @barita.cl
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userSchool);
        const isBaritaTestUser = userEmail.includes('@barita.cl');
        if ((!userSchool || isUUID || (isBaritaTestUser && userSchool === 'terra_di_bimbi')) && state.currentRole !== 'superadmin' && state.currentRole !== 'postulante') {
          userSchool = (userEmail.includes('terra') || userEmail.includes('italo') || userEmail.includes('itsotocadiz')) ? 'terra_di_bimbi' : 'demo';
          data.colegio_id = userSchool;
          state.userProfile.colegio_id = userSchool;
          try {
            await client.from('usuarios').update({ colegio_id: userSchool }).eq('id', uid);
          } catch(_err) {}
        }

        if (typeof Storage !== 'undefined' && Storage.setActiveSchool) {
          if (state.currentRole !== 'superadmin') {
            await Storage.setActiveSchool(userSchool || 'demo');
          } else if (!Storage.activeSchool || Storage.activeSchool === 'demo') {
            await Storage.setActiveSchool(userSchool || 'terra_di_bimbi');
          }
          if (Storage.loadSchoolProfileFromDB) {
            await Storage.loadSchoolProfileFromDB(Storage.activeSchool);
          }
        }
        if (typeof App !== 'undefined') {
          if (App.updateSidebarBranding) App.updateSidebarBranding();
          if (App.renderHeaderActions) App.renderHeaderActions();
        }
      } else {
        const isSuper = userEmail === 'itsotocadiz@gmail.com';
        const assignedName = isSuper ? 'Super Admin' : (state.currentUser.user_metadata?.full_name || 'Usuario');
        const defaultSchool = userEmail.includes('terra') ? 'terra_di_bimbi' : 'demo';

        state.userProfile = {
          email: userEmail || state.currentUser.email,
          role: state.currentRole,
          nombres: assignedName,
          colegio_id: defaultSchool,
          createdAt: new Date().toISOString()
        };

        if (typeof Storage !== 'undefined' && Storage.setActiveSchool) {
          if (state.currentRole !== 'superadmin') {
            await Storage.setActiveSchool(defaultSchool);
          } else if (!Storage.activeSchool || Storage.activeSchool === 'demo') {
            await Storage.setActiveSchool(defaultSchool || 'terra_di_bimbi');
          }
          if (Storage.loadSchoolProfileFromDB) {
            await Storage.loadSchoolProfileFromDB(Storage.activeSchool);
          }
        }

        if (typeof App !== 'undefined') {
          if (App.updateSidebarBranding) App.updateSidebarBranding();
          if (App.renderHeaderActions) App.renderHeaderActions();
        }

        if (state.currentRole !== 'postulante') {
          try {
            await client.from('usuarios').upsert([{
              id: uid,
              email: userEmail || state.currentUser.email,
              role: state.currentRole,
              nombres: assignedName,
              is_active: true,
              colegio_id: defaultSchool
            }]);
          } catch (_err) {}
        }
      }
    } catch (e) {
      console.error('Error al obtener rol:', e);
    }
  }

  function geminiCheck() {
    if (Date.now() < state._geminiBlockedUntil) {
      const wait = Math.ceil((state._geminiBlockedUntil - Date.now()) / 1000);
      throw new Error(`IA momentáneamente bloqueada por errores repetidos. Espera ${wait}s.`);
    }
    return true;
  }

  function geminiSuccess() {
    state._geminiFailCount = 0;
    state._geminiBlockedUntil = 0;
  }

  function geminiFail() {
    state._geminiFailCount++;
    if (state._geminiFailCount >= 3) {
      state._geminiBlockedUntil = Date.now() + 60 * 1000;
    }
  }

  function showLoadingState(title, text) {
    if (state.isLoggingOut) return;
    const options = document.getElementById('landing-options-container');
    const loginForm = document.getElementById('login-form-container');
    const postulLogin = document.getElementById('postulaciones-login-card');
    const loadingEl = document.getElementById('login-loading');
    const titleEl = document.getElementById('login-loading-title');
    const textEl = document.getElementById('login-loading-text');

    if (options) options.style.display = 'none';
    if (loginForm) loginForm.style.display = 'none';
    if (postulLogin) postulLogin.style.display = 'none';
    
    if (loadingEl) {
      loadingEl.style.display = 'block';
      if (titleEl && title) titleEl.textContent = title;
      if (textEl && text) textEl.textContent = text;
    }
  }

  function showLoginForm() {
    const overlay = document.getElementById('login-overlay');
    if (overlay) overlay.style.display = 'flex';
    const optionsCont = document.getElementById('landing-options-container');
    const loginFormCont = document.getElementById('login-form-container');
    const postulLoginCard = document.getElementById('postulaciones-login-card');
    if (optionsCont) optionsCont.style.display = 'none';
    if (postulLoginCard) postulLoginCard.style.display = 'none';
    if (loginFormCont) loginFormCont.style.display = 'block';
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.style.display = 'block';
  }

  function showLogin() {
    const hash = window.location.hash;
    if (hash.startsWith('#/postulantes')) {
      document.getElementById('login-overlay').style.display = 'none';
      const sidebar = document.querySelector('.sidebar');
      const mainContent = document.querySelector('.main-content');
      if (sidebar) sidebar.style.display = 'none';
      if (mainContent) {
        mainContent.style.display = 'block';
        mainContent.style.marginLeft = '0';
        mainContent.style.width = '100%';
        mainContent.style.maxWidth = '100%';
      }
      App.handleRoute();
      return;
    }

    document.getElementById('login-overlay').style.display = 'flex';
    const loadingEl = document.getElementById('login-loading');
    if (loadingEl) loadingEl.style.display = 'none';

    const optionsCont = document.getElementById('landing-options-container');
    const loginFormCont = document.getElementById('login-form-container');
    if (optionsCont) optionsCont.style.display = 'grid';
    if (loginFormCont) loginFormCont.style.display = 'none';

    document.getElementById('login-form').style.display = 'block';

    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    if (sidebar) sidebar.style.display = 'none';
    if (mainContent) mainContent.style.display = 'none';
  }

  function showApp() {
    if (state.isLoggingOut) return;
    document.getElementById('login-overlay').style.display = 'none';
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    
    const isImpersonating = typeof sessionStorage !== 'undefined' && !!sessionStorage.getItem('superadmin_original');
    const isSuperAdminNoImpersonate = state.currentRole === 'superadmin' && !isImpersonating;

    if (sidebar) {
      sidebar.style.display = isSuperAdminNoImpersonate ? 'none' : 'flex';
    }
    if (mainContent) {
      mainContent.style.display = 'block';
      if (isSuperAdminNoImpersonate) {
        mainContent.style.marginLeft = '0';
        mainContent.style.width = '100%';
        mainContent.style.maxWidth = '100%';
      } else {
        mainContent.style.marginLeft = '';
        mainContent.style.width = '';
        mainContent.style.maxWidth = '';
      }
    }

    checkImpersonationBanner();

    const currentHash = window.location.hash;
    const role = state.currentRole;

    if (currentHash === '' || currentHash === '#/' || currentHash === '#/login' || currentHash.startsWith('#/postulantes/registro')) {
      const config = (typeof window !== 'undefined' && window.ROLES && window.ROLES[role]) ? window.ROLES[role] : null;
      const defaultPage = config ? config.defaultPage : '#/dashboard';
      if (role === 'postulante') window.location.hash = '#/postulantes';
      else if (role === 'directivo') window.location.hash = '#/postulantes/directivos';
      else if (role === 'superadmin') window.location.hash = '#/superadmin';
      else if (defaultPage && defaultPage !== '#/superadmin') window.location.hash = defaultPage;
      else window.location.hash = '#/dashboard';
      return;
    }

    updateUIForRole();

    if (window.location.hash === '' || window.location.hash === '#/' || window.location.hash === '#/login') {
      const config = typeof window.ROLES !== 'undefined' ? window.ROLES[state.currentRole] : null;
      if (config && config.defaultPage) {
        window.location.hash = config.defaultPage;
        return;
      }
    }

    App.handleRoute();
  }

  function updateUIForRole() {
    const role = state.currentRole;

    if (typeof window.ROLES === 'undefined') return;

    let config = window.ROLES[role];
    if (!config) {
      if (role === 'directivo') config = window.ROLES.directivo;
      else if (role === 'postulante') config = window.ROLES.postulante;
      else config = window.ROLES.coordinadora;
    }

    const allowedMenus = config.menu || [];

    const navItems = document.querySelectorAll('.nav-item[data-view]');
    navItems.forEach(item => {
      const view = item.getAttribute('data-view');
      if (allowedMenus.includes(view)) {
        item.style.display = '';
      } else {
        item.style.display = 'none';
      }
    });

  }

  function canWriteEstudiantes() {
    if (!state.currentRole) return false;
    const r = state.currentRole.toLowerCase().trim();
    const ROLES_SIN_ACCESO = ['utp', 'pie', 'directora', 'convivencia', 'profesor', 'postulante', 'directivo'];
    if (ROLES_SIN_ACCESO.includes(r)) {
      return false;
    }
    const allowed = ['superadmin', 'admin', 'coordinadora', 'inspectoria', 'finanzas', 'finanza'];
    return allowed.includes(r) || r.includes('inspector');
  }

  function canManageSeguimiento() {
    if (!state.currentRole) return false;
    const r = state.currentRole.toLowerCase().trim();
    const allowed = ['superadmin', 'admin', 'inspectoria', 'convivencia'];
    return allowed.includes(r) || r.includes('inspector') || r.includes('convivencia');
  }

  function canWriteCasos() {
    if (!state.currentRole) return false;
    const r = state.currentRole.toLowerCase().trim();
    const allowed = ['superadmin', 'admin', 'coordinadora', 'directora', 'inspectoria', 'utp', 'pie', 'convivencia', 'finanzas', 'finanza'];
    return allowed.includes(r) || r.includes('inspector') || r.includes('convivencia');
  }

  function canWriteFuncionarios() {
    if (!state.currentRole) return false;
    const r = state.currentRole.toLowerCase().trim();
    return ['superadmin', 'admin', 'coordinadora', 'directora', 'utp', 'profesor'].includes(r);
  }

  function canCreateFuncionarios() {
    if (!state.currentRole) return false;
    const r = state.currentRole.toLowerCase().trim();
    return ['superadmin', 'admin', 'coordinadora'].includes(r);
  }

  function canManageFuncionarios() {
    if (!state.currentRole) return false;
    const r = state.currentRole.toLowerCase().trim();
    return ['superadmin', 'admin', 'coordinadora'].includes(r);
  }

  function canWriteAnotaciones(tipo) {
    if (state.currentRole === 'directora') return false;
    return true;
  }

  function canEditOrDelete(autorId) {
    if (state.currentRole === 'admin') return true;
    if (!autorId) return false;
    return state.currentUser && state.currentUser.uid === autorId;
  }

  function checkImpersonationBanner() {
    let banner = document.getElementById('impersonation-banner');
    const originalSession = sessionStorage.getItem('superadmin_original');

    if (originalSession) {
      let original;
      try {
        original = JSON.parse(originalSession);
      } catch (e) {
        sessionStorage.removeItem('superadmin_original');
        return;
      }
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'impersonation-banner';
        banner.style.cssText = `
          position: fixed; 
          top: 0; 
          left: 0; 
          right: 0; 
          background: #8b5cf6; 
          color: white; 
          padding: 0.5rem 1rem; 
          text-align: center; 
          font-weight: 600; 
          z-index: 100000; 
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); 
          display: flex; 
          justify-content: center; 
          align-items: center; 
          gap: 1rem;
          font-size: 0.9rem;
        `;
        document.body.appendChild(banner);

        const appRoot = document.getElementById('app-root');
        if (appRoot) {
          appRoot.style.marginTop = '38px';
          appRoot.style.height = 'calc(100vh - 38px)';
        }
      }
      const displayName = state.userProfile?.nombres 
        ? `${state.userProfile.nombres} ${state.userProfile.apellidos || ''}`
        : (state.currentUser?.email || 'Usuario');
      // Selector de rol en el mismo banner para cambiar sin volver atrás
      const rolesForBanner = ['admin','directora','utp','pie','convivencia','profesor','inspectoria','finanzas','coordinadora'];
      const optionsHtml = rolesForBanner.map(r=>`<option value="${r}" ${r===state.currentRole?'selected':''}>${r}</option>`).join('');
      banner.innerHTML = `
        <span> Modo Simulación: <b>${displayName}</b> (${state.currentRole})</span>
        <label style="display:flex;align-items:center;gap:.4rem;background:rgba(255,255,255,.15);padding:.2rem .6rem;border-radius:6px;font-weight:600;">Rol:
          <select onchange="Auth.impersonateUser(Auth.currentUser?.uid||Auth.currentUser?.id||'imp', this.value, {email: Auth.userProfile?.email||Auth.currentUser?.email, nombres: Auth.userProfile?.nombres||'Sim', apellidos: Auth.userProfile?.apellidos||'', colegio_id: Auth.userProfile?.colegio_id||Storage.activeSchool})" style="background:white;color:#6d28d9;border:none;border-radius:4px;padding:.15rem .4rem;font-weight:700;cursor:pointer;">${optionsHtml}</select>
        </label>
        <button onclick="Auth.stopImpersonating()" style="background: white; color: #8b5cf6; border: none; padding: 0.25rem 0.75rem; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
          Volver a Super Admin
        </button>
      `;
    } else {
      if (banner) {
        banner.remove();
        const appRoot = document.getElementById('app-root');
        if (appRoot) {
          appRoot.style.marginTop = '';
          appRoot.style.height = '';
        }
      }
    }
  }

  async function impersonateUser(targetUid, targetRole, targetProfile) {
    const allowedImpersonate = ['admin','coordinadora','directora','profesor','utp','pie','convivencia','inspectoria','finanzas','postulante','directivo'];
    if(targetRole === 'superadmin'){ App.showToast('No se puede emular superadmin','warning'); return; }
    if(!allowedImpersonate.includes(targetRole)){ App.showToast('Rol no permitido','danger'); return; }
    if (state.currentRole !== 'superadmin' && !sessionStorage.getItem('superadmin_original')) {
      App.showToast('Solo SUPER_ADMIN puede suplantar','danger'); return;
    }
    if (!sessionStorage.getItem('superadmin_original')) {
      const original = {
        uid: state.currentUser.uid,
        role: state.currentRole,
        profile: state.userProfile,
        colegio_id: (typeof Storage!=='undefined' && Storage.activeSchool) ? Storage.activeSchool : (state.userProfile?.colegio_id||''),
        ts: Date.now()
      };
      sessionStorage.setItem('superadmin_original', JSON.stringify(original));
    }
    // Enriquecer perfil con colegio objetivo si no viene
    const targetColegio = (targetProfile && (targetProfile.colegio_id||targetProfile.colegioId)) || (state.userProfile?.colegio_id) || (typeof Storage!=='undefined'?Storage.activeSchool:'demo');
    const enrichedProfile = { ...(targetProfile||{}), colegio_id: targetColegio, colegioId: targetColegio };

    state.currentRole = targetRole;
    state.userProfile = enrichedProfile;
    // FIX: sincronizar Storage para todos los roles (evita header Terra vs body DEMO)
    if (typeof Storage !== 'undefined' && Storage.setActiveSchool && Storage.activeSchool !== targetColegio) {
      try { await Storage.setActiveSchool(targetColegio); } catch (_e) { try { localStorage.setItem('barita_active_school', targetColegio); Storage.activeSchool = targetColegio; } catch(__e){} }
    }

    App.showToast(`Simulando rol: ${targetRole}`, 'info');
    try { localStorage.setItem('barita_user_role', targetRole); } catch(_e){}
    // FIX: forzar re-render aunque hash ya sea #/dashboard (evita _lastRouteHash duplicado tras Storage.setActiveSchool)
    if (typeof App !== 'undefined') App._lastRouteHash = null;

    if (targetRole === 'postulante') {
      window.location.hash = '#/postulantes';
    } else {
      window.location.hash = '#/dashboard';
    }

    checkImpersonationBanner();
    showApp();
    // fallback por si handleRoute fue ignorado como duplicado
    setTimeout(()=>{ if(typeof App!=='undefined' && App.handleRoute) { App._lastRouteHash=null; App.handleRoute(); } }, 50);
  }

  function stopImpersonating() {
    const originalSession = sessionStorage.getItem('superadmin_original');
    if (originalSession) {
      try {
        const original = JSON.parse(originalSession);
        if(original.role !== 'superadmin'){ sessionStorage.removeItem('superadmin_original'); App.showToast('Sesión corrupta','danger'); return; }
        if(original.ts && (Date.now() - original.ts > 8*60*60*1000)){ sessionStorage.removeItem('superadmin_original'); App.showToast('Sesión expirada','warning'); return; }
        state.currentRole = original.role;
        state.userProfile = original.profile;
        // Restaurar colegio original si estaba guardado
        if(original.colegio_id && typeof Storage!=='undefined' && Storage.setActiveSchool){
          try{ Storage.activeSchool = original.colegio_id; localStorage.setItem('barita_active_school', original.colegio_id); }catch(_e){}
        }
        sessionStorage.removeItem('superadmin_original');

        App.showToast('Sesión de Super Admin restaurada', 'success');
      } catch (e) {
        sessionStorage.removeItem('superadmin_original');
        App.showToast('Error al restaurar sesión', 'danger');
      }
    }
    checkImpersonationBanner();
    window.location.hash = '#/superadmin';
    showApp();
  }
  return {
    init,
    bindEvents,
    handleLogin,
    loginConGoogle,
    _finishLogin,
    handleLogout,
    handleForgotPassword,
    clearSessionCache,
    fetchUserRole,
    _handleUserLoggedIn,
    _handleUserLoggedOut,
    geminiCheck,
    geminiSuccess,
    geminiFail,
    showLogin,
    showLoginForm,
    showApp,
    updateUIForRole,
    impersonateUser,
    stopImpersonating,
    checkImpersonationBanner,
    canWriteEstudiantes,
    canManageSeguimiento,
    canWriteCasos,
    canWriteFuncionarios,
    canCreateFuncionarios,
    canManageFuncionarios,
    canWriteAnotaciones,
    canEditOrDelete,
    get currentUser() { return state.currentUser; },
    set currentUser(v) { state.currentUser = v; },
    get currentRole() { return state.currentRole; },
    set currentRole(v) { state.currentRole = v; },
    get userProfile() { return state.userProfile; },
    set userProfile(v) { state.userProfile = v; },
    get authInitialized() { return state.authInitialized; },
    set authInitialized(v) { state.authInitialized = v; },
    get _activeClient() { return state._activeClient; },
    set _activeClient(v) { state._activeClient = v; },
    get _geminiFailCount() { return state._geminiFailCount; },
    set _geminiFailCount(v) { state._geminiFailCount = v; },
    get _geminiBlockedUntil() { return state._geminiBlockedUntil; },
    set _geminiBlockedUntil(v) { state._geminiBlockedUntil = v; },
    get isLoggingOut() { return state.isLoggingOut; },
    set isLoggingOut(v) { state.isLoggingOut = v; },
    get _pendingTimeouts() { return state._pendingTimeouts; },
    logout
  };
})();

window.Auth = Auth;
