// FLAG GLOBAL MODO PRUEBAS: solo localhost, nunca en producción
window.ALLOW_ALL_ROLES_FULL_ACCESS = false;
if (typeof window !== 'undefined' && window.ALLOW_ALL_ROLES_FULL_ACCESS && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
  window.ALLOW_ALL_ROLES_FULL_ACCESS = false;
}

const RouteGuard = (() => {
  const roleMap = {
    dashboard: ['superadmin','admin','directora','utp','coordinadora','inspectoria','finanza','PIE','convivencia','profesor'],
    director: ['superadmin','admin','directora'],
    cursos: ['superadmin','admin','directora','utp','coordinadora','inspectoria','finanza','PIE','convivencia','profesor'],
    estudiantes: ['superadmin','admin','directora','utp','coordinadora','inspectoria','finanza','PIE','convivencia','profesor'],
    funcionarios: ['superadmin','admin','directora','utp','coordinadora','inspectoria','finanza','PIE','convivencia','profesor'],
    casos: ['superadmin','admin','directora','utp','coordinadora','inspectoria','finanza','PIE','convivencia','profesor'],
    consultas: ['superadmin','admin','profesor'],
    asistencia: ['superadmin','admin','directora','utp','coordinadora','inspectoria','finanza','convivencia','profesor'],
    agenda: ['superadmin','admin','directora','utp','coordinadora','inspectoria','finanza','PIE','convivencia','profesor'],
    notas: ['superadmin','admin','directora','utp','coordinadora','inspectoria','finanza','PIE','convivencia','profesor'],
    documentos: ['superadmin','admin','directora','utp','coordinadora','inspectoria','finanza','PIE','convivencia','profesor'],
    seguimientos: ['superadmin','admin','directora','utp','coordinadora','inspectoria','finanza','PIE','convivencia','profesor'],
    pie: ['superadmin','admin','utp','coordinadora','inspectoria','finanza','PIE','convivencia','profesor'],
    pise: ['superadmin','admin','PIE'],
    finanzas: ['superadmin','admin','finanza'],
    inspectoria: ['superadmin','admin','inspectoria'],
    admin: ['superadmin','admin'],
    superadmin: ['superadmin'],
    convivencia: ['superadmin','admin','convivencia'],
    utp: ['superadmin','admin','utp']
  };

  function requireRole(route) {
    if (typeof Auth !== 'undefined' && Auth.isLoggingOut) {
      return true;
    }
    if (typeof Auth !== 'undefined' && !Auth.authInitialized) {
      return true;
    }

    const isLoggedIn = !!(typeof Auth !== 'undefined' && Auth.currentUser);
    let role = (typeof Auth !== 'undefined' && Auth.currentRole) ? Auth.currentRole.toLowerCase() : null;
    // Normalizar alias de rol
    if (role === 'direccion' || role === 'dirección') role = 'directora';
    if (role === 'pie') role = 'pie'; // keep case-insensitive

    // Fallback inmediato si Auth.currentRole aun esta cargando asincronicamente de Supabase
    if (!role && isLoggedIn) {
      const email = ((Auth.currentUser.email || Auth.currentUser.user_metadata?.email) || '').trim().toLowerCase();
      if (email === 'itsotocadiz@gmail.com') {
        role = 'superadmin';
      } else if (email === 'admin@terra.cl') {
        role = 'admin';
      } else if (email === 'utp@terra.cl') {
        role = 'utp';
      } else if (email.startsWith('dire') && email.includes('terra')) {
        role = 'directora';
      } else if (email === 'conv@terra.cl') {
        role = 'convivencia';
      } else if (email === 'pie@terra.cl') {
        role = 'PIE'.toLowerCase();
      } else {
        try {
          const cachedRole = localStorage.getItem('barita_user_role');
          if (cachedRole) {
            role = cachedRole.toLowerCase();
            if (role === 'direccion' || role === 'dirección') role = 'directora';
          }
        } catch (_e) {}
      }
    }

    if (window.ALLOW_ALL_ROLES_FULL_ACCESS) return true;

    // 2. Restricciones estrictas por matriz de roles

    // Panel de Control (admin): Solo ADMIN, ADMINISTRADOR y SUPERADMIN
    if (route === 'admin') {
      const allowedAdminPanel = ['superadmin', 'admin', 'administrador', 'administrator'];
      if (!allowedAdminPanel.includes(role)) {
        window.location.hash = '#/dashboard';
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast('Acceso Denegado: Panel de Control exclusivo para Administradores.', 'danger');
        }
        return false;
      }
    }

    // Super Admin: Exclusivo para SUPERADMIN
    if (route === 'superadmin') {
      if (role !== 'superadmin') {
        window.location.hash = '#/dashboard';
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast('Acceso Denegado: Exclusivo para Super Administrador.', 'danger');
        }
        return false;
      }
    }

    // Documentos: Director NO incluido, PIE NO incluido, UTP SÍ incluido
    if (route === 'documentos') {
      if (role === 'directora' || role === 'director' || role === 'pie') {
        window.location.hash = '#/dashboard';
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast('Acceso Denegado: Módulo Documentos no disponible para este rol.', 'danger');
        }
        return false;
      }
    }

    // Restricción específica para el Rol PIE (no puede acceder a finanzas, documentos ni admin)
    if (role === 'pie') {
      if (route === 'finanzas' || route === 'admin' || route === 'superadmin' || route === 'documentos') {
        window.location.hash = '#/dashboard';
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast('Acceso Denegado: Este módulo no está disponible para el rol PIE.', 'danger');
        }
        return false;
      }
    }

    if (window.ALLOW_ALL_ROLES_FULL_ACCESS) return true;
    
    const userEmail = Auth.currentUser ? ((Auth.currentUser.email || Auth.currentUser.user_metadata?.email || '').trim().toLowerCase()) : '';
    const isSuperEmail = userEmail === 'itsotocadiz@gmail.com';
    const isImpersonating = typeof sessionStorage !== 'undefined' && !!sessionStorage.getItem('superadmin_original');
    const isSuperAdminReal = (role === 'superadmin') || (isSuperEmail && !isImpersonating);

    if (isSuperAdminReal && route !== 'superadmin') {
      window.location.hash = '#/superadmin';
      return false;
    }

    if (isSuperAdminReal || role === 'admin') return true;
    const allowedRaw = roleMap[route];
    if (!allowedRaw) return true;
    const allowed = allowedRaw.map(r => r.toLowerCase());

    if (!role && isLoggedIn) {
      return true;
    }

    if (!role || !allowed.includes(role)) {
      window.location.hash = '#/dashboard';
      return false;
    }
    return true;
  }

  return { requireRole };
})();

window.RouteGuard = RouteGuard;
