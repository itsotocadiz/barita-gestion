// FLAG GLOBAL MODO PRUEBAS: solo localhost, nunca en producción - inmutable
const BARITA_ALLOW_ALL = (typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1') && typeof localStorage !== 'undefined' && localStorage.getItem('barita_dev_bypass') === '1');
Object.defineProperty(window, 'ALLOW_ALL_ROLES_FULL_ACCESS', { get() { return !!BARITA_ALLOW_ALL; }, set() {}, configurable: false });

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
      return false;
    }
    if (typeof Auth !== 'undefined' && !Auth.authInitialized) {
      // Durante init, permite superadmin para no dejar #/superadmin en blanco (Auth.currentRole ya es superadmin)
      const earlyRole = (typeof Auth !== 'undefined' && Auth.currentRole) ? Auth.currentRole.toLowerCase() : '';
      if (route === 'superadmin' && earlyRole === 'superadmin') return true;
      return false;
    }

    const isLoggedIn = !!(typeof Auth !== 'undefined' && Auth.currentUser);
    let role = (typeof Auth !== 'undefined' && Auth.currentRole) ? Auth.currentRole.toLowerCase() : null;
    // Normalizar alias de rol
    if (role === 'direccion' || role === 'dirección') role = 'directora';
    if (role === 'pie') role = 'pie'; // keep case-insensitive

    // Fallback: rol solo desde DB, no hardcode email ni localStorage
    if (!role && isLoggedIn) {
      return false;
    }

    if (BARITA_ALLOW_ALL) return true;

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

    if (BARITA_ALLOW_ALL) return true;
    
    const isImpersonating = typeof sessionStorage !== 'undefined' && !!sessionStorage.getItem('superadmin_original');
    const isSuperAdminReal = (role === 'superadmin') && !isImpersonating;

    if (isSuperAdminReal && route !== 'superadmin') {
      window.location.hash = '#/superadmin';
      return false;
    }

    if (isSuperAdminReal) return true;
    // admin ya no bypass total, cae a roleMap
    const allowedRaw = roleMap[route];
    if (!allowedRaw) return true;
    const allowed = allowedRaw.map(r => r.toLowerCase());

    if (!role && isLoggedIn) {
      return false;
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
