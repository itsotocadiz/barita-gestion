/* ================================================================
   route-registry.js — Registry centralizado de rutas
   Devuelve handlers por vista; cada handler llama a la vista loader.
   ================================================================ */

const RouteRegistry = (() => {
  const registry = {
    'dashboard': (contentBody, id) => {
      if (typeof DashboardView !== 'undefined') DashboardView.render(contentBody);
    },
    'cursos': (contentBody, id) => {
      if (typeof CursosView !== 'undefined') id ? CursosView.renderCurso(contentBody, id) : CursosView.renderList(contentBody);
    },
    'directora': (contentBody) => {
      if (typeof DirectoraView !== 'undefined') DirectoraView.render(contentBody);
    },
    'profesor': (contentBody) => {
      if (typeof ProfesorView !== 'undefined') ProfesorView.render(contentBody);
    },
    'utp': (contentBody) => {
      if (typeof UtpView !== 'undefined') UtpView.render(contentBody);
    },
    'convivencia': (contentBody) => {
      if (typeof ConvivenciaView !== 'undefined') ConvivenciaView.render(contentBody);
    },
    'estudiantes': (contentBody, id) => {
      if (typeof EstudiantesView !== 'undefined') id ? EstudiantesView.renderDetalle(contentBody, id) : (window.location.hash = '#/cursos');
    },
    'pie': (contentBody, id) => {
      if (typeof EstudiantesView !== 'undefined' && typeof PieView !== 'undefined') id ? EstudiantesView.renderFichaPIE(contentBody, id) : PieView.render(contentBody);
    },
    'funcionarios': (contentBody, id) => {
      if (typeof FuncionariosView !== 'undefined') id ? FuncionariosView.renderDetalle(contentBody, id) : FuncionariosView.renderList(contentBody);
    },
    'casos': (contentBody, id) => {
      try {
        if (typeof CasosView !== 'undefined') id ? CasosView.renderDetalle(contentBody, id) : CasosView.renderList(contentBody);
      } catch (e) {
        contentBody.innerHTML = `<div class="card"><h2 class="text-danger">Error cargando Casos Graves</h2><p>${e.message}</p></div>`;
      }
    },
    'consultas': (contentBody) => {
      if (typeof ConsultasProfesoresView !== 'undefined') ConsultasProfesoresView.render(contentBody);
    },
    'asistencia': (contentBody) => {
      if (typeof AsistenciaView !== 'undefined') AsistenciaView.render(contentBody);
    },
    'alertas_asistencia': (contentBody) => {
      if (typeof AlertasAsistenciaView !== 'undefined') AlertasAsistenciaView.render(contentBody);
    },
    'agenda': (contentBody) => {
      if (typeof AgendaView !== 'undefined') AgendaView.render(contentBody);
    },
    'notas': (contentBody, id) => {
      if (typeof NotasView !== 'undefined') NotasView.render(contentBody, id);
    },
    'documentos': (contentBody) => {
      if (typeof DocumentosView !== 'undefined') DocumentosView.render(contentBody);
    },
    'seguimientos': (contentBody) => {
      if (typeof SeguimientosView !== 'undefined') SeguimientosView.render(contentBody);
    },
    'pise': (contentBody) => {
      if (typeof PiseView !== 'undefined') PiseView.render(contentBody);
    },
    'finanzas': (contentBody) => FinanzasView.render(contentBody),
    'inspectoria': (contentBody) => InspectoriaView.render(contentBody),
    'admin': (contentBody) => {
      if (typeof AdminLocalView !== 'undefined') AdminLocalView.render(contentBody);
    },
    'superadmin': (contentBody) => {
      if (typeof SuperAdminView === 'undefined') throw new ReferenceError('SuperAdminView');
      const hash = window.location.hash || '';
      if (hash === '#/superadmin' || hash === '#/superadmin/' || hash === '#/superadmin/index.html') {
        SuperAdminView.currentSystem = 'gestion';
        if (typeof SuperAdminView.renderSystemSelector === 'function') SuperAdminView.renderSystemSelector(contentBody);
        else SuperAdminView.render(contentBody);
      } else if (hash.startsWith('#/superadmin/gestion')) {
        SuperAdminView.currentSystem = 'gestion';
        SuperAdminView.render(contentBody);
      } else {
        SuperAdminView.render(contentBody);
      }
    }
  };

  function get(view) {
    return registry[view] || null;
  }

  function has(view) {
    return Object.prototype.hasOwnProperty.call(registry, view);
  }

  function list() {
    return Object.keys(registry);
  }

  return {
    get,
    has,
    list
  };
})();

window.RouteRegistry = RouteRegistry;
