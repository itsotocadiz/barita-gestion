/* ================================================================
   finanzas.js — Módulo de Finanzas
   Panel de pagos de apoderados y morosidad.
   Usa BaritaSkillsGestion.SkillFinanzas.
   ================================================================ */

const FinanzasView = (() => {
  const state = {
    currentTab: 'pagos',
    pagos: []
  };

  function render(container) {
    App.setBreadcrumb('Finanzas');
    state.pagos = Array.isArray((Storage && Storage.cache && Storage.cache.finanzasPagos)) ? Storage.cache.finanzasPagos.slice() : [];
    renderPagos(container, state.pagos);
  }

  function renderPagos(container, pagos) {
    const morosidad = (typeof BaritaSkillsGestion !== 'undefined' && BaritaSkillsGestion.SkillFinanzas)
      ? BaritaSkillsGestion.SkillFinanzas.calcularMorosidad(pagos)
      : 0;

    const rows = pagos.length === 0
      ? '<tr><td colspan="5" class="text-center text-muted py-4">Sin registros de pago.</td></tr>'
      : pagos.map(p => {
          const estado = (p.estado || '').toLowerCase();
          const clase = estado === 'pagado'
            ? 'badge badge-success'
            : estado === 'parcial'
            ? 'badge badge-warning'
            : 'badge badge-danger';
          return `
            <tr>
              <td style="padding:1rem; vertical-align:middle;">${p.apoderado || '-'}</td>
              <td style="padding:1rem; vertical-align:middle;">${p.estudiante || '-'}</td>
              <td style="padding:1rem; vertical-align:middle;">${p.monto != null ? '$' + p.monto : '-'}</td>
              <td style="padding:1rem; vertical-align:middle; text-align:center;"><span class="${clase}">${p.estado || '-'}</span></td>
              <td style="padding:1rem; vertical-align:middle; text-align:center;">${p.fecha || '-'}</td>
            </tr>
          `;
        }).join('');

    container.innerHTML = `
      <div class="dashboard-grid" style="grid-template-columns: 1fr 3fr; gap: 1.5rem;">
        <div class="card">
          <div class="card-header"><h3 class="card-title">Morosidad</h3></div>
          <div class="card-body">
            <div style="font-size: 2.5rem; font-weight: bold; color: ${morosidad > 20 ? '#ef4444' : morosidad > 0 ? '#f59e0b' : '#15803d'};">
              ${morosidad}%
            </div>
            <p class="text-muted">Porcentaje de pagos pendientes.</p>
          </div>
        </div>
        <div class="card">
          <div class="card-header flex justify-between items-center">
            <h3 class="card-title">Pagos de Apoderados</h3>
          </div>
          <div class="card-body">
            <div class="table-responsive">
              <table class="table">
                <thead><tr><th>Apoderado</th><th>Estudiante</th><th>Monto</th><th style="text-align:center;">Estado</th><th style="text-align:center;">Fecha</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  return {
    render,
    get currentTab() { return state.currentTab; },
    set currentTab(value) { state.currentTab = value; },
    get pagos() { return state.pagos; },
    set pagos(value) { state.pagos = value; }
  };
})();

window.FinanzasView = FinanzasView;
