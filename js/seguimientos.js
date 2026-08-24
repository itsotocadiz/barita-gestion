(() => {
const SeguimientosView = (() => {
  function render(container) {
    App.setBreadcrumb('Seguimientos Activos');
    const casosActivos = renderCasosEnSeguimiento();
    const casosCompletados = renderSeguimientosCompletados();
    let html = `
      <div style="margin-bottom: 1.5rem; position: relative;">
        <div style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-secondary);">
          🔍
        </div>
        <input type="text" id="buscador-estudiantes" class="form-control" placeholder="Buscar estudiante por nombre..."
          style="width: 100%; padding-left: 2.5rem; font-size: 1rem; border-radius: var(--radius-md); box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
          oninput="
            const query = this.value.toLowerCase().trim();
            const filterTable = (containerId) => {
              const body = document.getElementById(containerId);
              if (!body) return;
              const rows = body.querySelectorAll('table tbody tr');
              rows.forEach(row => {
                const nameCell = row.querySelector('td:first-child');
                if (nameCell) {
                  const text = nameCell.textContent.toLowerCase();
                  row.style.display = text.includes(query) ? '' : 'none';
                }
              });
            };
            filterTable('estudiantes-activos-body');
            filterTable('estudiantes-historial-body');
          "
        >
      </div>
      <div class="mt-4">
        <div class="card" style="border-left: 4px solid var(--primary);">
          <div class="card-header" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;"
               onclick="toggleSection('estudiantes-activos-body','icon-activos')">
            <h3 class="card-title" style="margin: 0;">🔍 Estudiantes en Seguimiento Activo</h3>
            <span id="icon-activos" style="color: var(--text-secondary); font-size: 0.9rem;">▼</span>
          </div>
          <div class="card-body" id="estudiantes-activos-body" style="display: block;">
            ${casosActivos}
          </div>
        </div>
      </div>
      <div class="mt-4">
        <div class="card" style="border-left: 4px solid var(--success);">
          <div class="card-header" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;"
               onclick="toggleSection('estudiantes-historial-body','icon-historial')">
            <h3 class="card-title" style="margin: 0;">✅ Seguimientos Cerrados / Históricos</h3>
            <span id="icon-historial" style="color: var(--text-secondary); font-size: 0.9rem;">▶</span>
          </div>
          <div class="card-body" id="estudiantes-historial-body" style="display: none;">
            ${casosCompletados}
          </div>
        </div>
      </div>
    `;
    container.innerHTML = html;
    App.setBreadcrumb('Seguimientos Activos');
  }

  function renderCasosEnSeguimiento() {
    const estudiantesEnSeguimiento = (typeof Storage !== 'undefined' && Storage.getEstudiantes) ? Storage.getEstudiantes().filter(e => e.enSeguimiento) : [];
    if (estudiantesEnSeguimiento.length === 0) return '<p class="text-muted text-center py-4">No hay estudiantes en seguimiento actualmente.</p>';

    let html = `
      <div class="table-responsive">
        <table class="table table-hover">
          <thead>
            <tr>
              <th>Estudiante</th>
              <th>Curso</th>
              <th>Progreso</th>
              <th>Estado de Plazos</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
    `;

    const hoy = new Date();
    estudiantesEnSeguimiento.forEach(est => {
      const curso = (typeof DATA !== 'undefined' && DATA.getCurso) ? (DATA.getCurso(est.curso)?.nombre || 'Sin curso') : 'Sin curso';
      const totalPasos = 5;
      const completados = est.pasosSeguimiento ? est.pasosSeguimiento.filter(p => p).length : 0;
      const pct = Math.round((completados / totalPasos) * 100);

      let fechaBase = est.fechaInicioSeguimiento ? new Date(est.fechaInicioSeguimiento) : new Date();
      if (completados > 0 && est.fechasPasos && est.fechasPasos[completados - 1]) {
        fechaBase = new Date(est.fechasPasos[completados - 1]);
      }
      const fechaVenc = new Date(fechaBase);
      fechaVenc.setDate(fechaVenc.getDate() + 15);
      const diffMs = fechaVenc - hoy;
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      let statusHtml = '';
      let isVencido = false;
      let diffDaysText = '';

      if (est.fechaProximoSeguimiento || est.fechaProximo) {
        const nextDate = new Date(est.fechaProximoSeguimiento || est.fechaProximo);
        const diffMs = nextDate - hoy;
        const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (days <= 0) {
          isVencido = true;
          diffDaysText = `${Math.abs(days)}d`;
        }
      } else {
        // Fallback al cálculo clásico de 15 días por paso
        let fechaBase = est.fechaInicioSeguimiento ? new Date(est.fechaInicioSeguimiento) : new Date();
        if (completados > 0 && est.fechasPasos && est.fechasPasos[completados - 1]) {
          fechaBase = new Date(est.fechasPasos[completados - 1]);
        }
        const fechaVenc = new Date(fechaBase);
        fechaVenc.setDate(fechaVenc.getDate() + 15);
        const diffMs = fechaVenc - hoy;
        const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (days <= 0) {
          isVencido = true;
          diffDaysText = `${Math.abs(days)}d`;
        }
      }

      if (completados >= totalPasos) {
        statusHtml = '<span class="badge badge-success">Completado</span>';
      } else if (isVencido) {
        statusHtml = `<span class="badge badge-danger">Seguimiento Vencido (${diffDaysText} de retraso)</span>`;
      } else {
        // Calcular para la visualización del plazo normal
        let fechaBase = est.fechaInicioSeguimiento ? new Date(est.fechaInicioSeguimiento) : new Date();
        if (completados > 0 && est.fechasPasos && est.fechasPasos[completados - 1]) {
          fechaBase = new Date(est.fechasPasos[completados - 1]);
        }
        const fechaVenc = new Date(fechaBase);
        fechaVenc.setDate(fechaVenc.getDate() + 15);
        const diffMs = fechaVenc - hoy;
        const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (days <= 5) {
          statusHtml = `<span class="badge badge-warning">Vence en ${days} días</span>`;
        } else {
          statusHtml = `<span class="badge badge-info">Al día (${days} días restantes)</span>`;
        }
      }

      html += `
        <tr>
          <td><strong>${est.nombres} ${est.apellidos}</strong></td>
          <td>${curso}</td>
          <td>
            <div class="flex items-center gap-2">
              <div class="progress" style="width: 80px; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                <div class="progress-bar" style="width: ${pct}%; height: 100%; background: var(--primary);"></div>
              </div>
              <span style="font-size: 0.8rem; font-weight: 600;">${completados}/${totalPasos}</span>
            </div>
          </td>
          <td>${statusHtml}</td>
          <td>
            <a href="#/estudiantes/${est.id}" class="btn btn-sm btn-secondary">Ver Ficha</a>
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;
    return html;
  }

  function renderSeguimientosCompletados() {
    const estudiantes = (typeof Storage !== 'undefined' && Storage.getEstudiantes) ? Storage.getEstudiantes() : [];
    const completados = estudiantes.filter(e => {
      const complCount = e.pasosSeguimiento ? e.pasosSeguimiento.filter(p => p).length : 0;
      return complCount === 5 || (e.historialSeguimientos && e.historialSeguimientos.length > 0);
    });

    if (completados.length === 0) return '<p class="text-muted text-center py-4">No hay registros históricos de seguimientos.</p>';

    let html = `
      <div class="table-responsive">
        <table class="table table-hover">
          <thead>
            <tr>
              <th>Estudiante</th>
              <th>Curso</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
    `;

    completados.forEach(est => {
      const curso = (typeof DATA !== 'undefined' && DATA.getCurso) ? (DATA.getCurso(est.curso)?.nombre || 'Sin curso') : 'Sin curso';
      html += `
        <tr>
          <td><strong>${est.nombres} ${est.apellidos}</strong></td>
          <td>${curso}</td>
          <td><span class="badge badge-success">Cerrado / Completado</span></td>
          <td>
            <a href="#/estudiantes/${est.id}" class="btn btn-sm btn-secondary">Ver Ficha</a>
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;
    return html;
  }

  return { render };
})();

window.SeguimientosView = SeguimientosView;
})();
