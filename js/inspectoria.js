/* ================================================================
   inspectoria.js — Módulo Inspectoría
   Revisión de anotaciones, contador y acciones rápidas.
   ================================================================ */

const InspectoriaView = (() => {
  return {
  render(container) {
    App.setBreadcrumb('Inspectoría');
    const anotaciones = Storage.getAnotacionesByEstudiante();
    const graves = anotaciones.filter(a => a && a.tipo === 'grave');
    const leves = anotaciones.filter(a => a && a.tipo === 'leve');

    container.innerHTML = `
      <div class="dashboard-grid" style="grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
        <div class="card">
          <div class="card-header"><h3 class="card-title">Anotaciones Totales</h3></div>
          <div class="card-body">
            <div style="font-size: 2.5rem; font-weight: bold; color: var(--primary);">${anotaciones.length}</div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3 class="card-title">Leves</h3></div>
          <div class="card-body">
            <div style="font-size: 2.5rem; font-weight: bold; color: #f59e0b;">${leves.length}</div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3 class="card-title">Graves</h3></div>
          <div class="card-body">
            <div style="font-size: 2.5rem; font-weight: bold; color: #ef4444;">${graves.length}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3 class="card-title">Herramientas</h3></div>
        <div class="card-body">
          <p class="text-muted">Desde aquí la dirección y UTP acceden a informes institucionales con cruce de convivencia y asistencia.</p>
          <a href="#/informes" class="btn btn-secondary">Ver Informes</a>
        </div>
      </div>
    `;
  }
};
})();
window.InspectoriaView = InspectoriaView;
