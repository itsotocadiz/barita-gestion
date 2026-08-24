// roles.js — Matriz de acceso por rol y rutas/constantes centralizadas para BARITA
// Menú unificado: TODOS los roles ven exactamente lo mismo (independiente de la escuela).
// Solo 'admin' agrega Panel de Control, y 'superadmin' agrega Super Admin.

const STAFF_MENU = ['dashboard','agenda','notas','seguimientos','casos','alertas_asistencia','cursos','estudiantes','funcionarios','asistencia','consultas','pise','directora','convivencia','utp','pie','profesor','inspectoria','finanzas','documentos'];

window.ROLES = {
  superadmin: {
    label: 'Super Administrador',
    defaultPage: '#/dashboard',
    menu: [...STAFF_MENU, 'admin', 'superadmin']
  },
  admin: {
    label: 'Administrador',
    defaultPage: '#/dashboard',
    menu: [...STAFF_MENU, 'admin']
  },
  directora: {
    label: 'Directora',
    defaultPage: '#/dashboard',
    menu: [...STAFF_MENU]
  },
  profesor: {
    label: 'Profesor',
    defaultPage: '#/dashboard',
    menu: [...STAFF_MENU]
  },
  utp: {
    label: 'UTP',
    defaultPage: '#/dashboard',
    menu: [...STAFF_MENU]
  },
  PIE: {
    label: 'PIE',
    defaultPage: '#/dashboard',
    menu: [...STAFF_MENU]
  },
  pie: {
    label: 'PIE',
    defaultPage: '#/dashboard',
    menu: [...STAFF_MENU]
  },
  inspectoria: {
    label: 'Inspectoría',
    defaultPage: '#/dashboard',
    menu: [...STAFF_MENU]
  },
  finanza: {
    label: 'Finanzas',
    defaultPage: '#/dashboard',
    menu: [...STAFF_MENU]
  },
  finanzas: {
    label: 'Finanzas',
    defaultPage: '#/dashboard',
    menu: [...STAFF_MENU]
  },
  convivencia: {
    label: 'Convivencia',
    defaultPage: '#/dashboard',
    menu: [...STAFF_MENU]
  },
  coordinadora: {
    label: 'Coordinadora',
    defaultPage: '#/dashboard',
    menu: [...STAFF_MENU]
  }
};

window.ROUTES = {
  dashboard: '#/dashboard',
  notas: '#/notas',
  cursos: '#/cursos',
  estudiantes: '#/cursos',
  directora: '#/directora',
  profesor: '#/profesor',
  utp: '#/utp',
  convivencia: '#/convivencia',
  funcionarios: '#/funcionarios',
  protocolos: '#/protocolos',
  casos: '#/casos',
  consultas: '#/consultas',
  asistencia: '#/asistencia',
  documentos: '#/documentos',
  psicosocial: '#/psicosocial',
  seguimientos: '#/seguimientos',
  pise: '#/pise',
  finanzas: '#/finanzas',
  pie: '#/pie',
  inspectoria: '#/inspectoria',
  planificacion: '#/planificacion',
  informes: '#/informes',
  admin: '#/admin',
  superadmin: '#/superadmin'
};

window.BaritaHelpers = {
  getRoleConfig(role) {
    return window.ROLES[role] || window.ROLES.coordinadora;
  },
  isPublicRoute(view) {
    return false;
  },
  isSuperadminRoute(view) {
    return view === 'superadmin';
  },
  shouldHideSidebarForRole(role) {
    return role === 'superadmin';
  }
};
