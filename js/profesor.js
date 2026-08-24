/* ================================================================
   profesor.js — Módulo Profesor
   ================================================================ */

(() => {
const ProfesorView = {
  currentSort: 'ausencias', // 'ausencias' | 'permisos'

  setSort(sortType) {
    this.currentSort = sortType;
    this.render(document.getElementById('app-content'));
  },

  obtenerMetricasFuncionario(funcId) {
    const acciones = (Storage.cache && Storage.cache.acciones) ? Storage.cache.acciones : [];

    let ausencias = 0;
    let permisos = 0;

    acciones.forEach(a => {
      if (!a) return;
      const targetId = String(a.funcionarioId || a.funcionario_id || '').trim();
      if (targetId !== String(funcId).trim()) return;

      const d = new Date(a.fecha);
      if (isNaN(d.getTime())) return;

      if (a.tipo === 'ausencia') ausencias++;
      else if (a.tipo === 'permiso') permisos++;
    });

    return { ausencias, permisos };
  },

  render(container) {
    App.setBreadcrumb('Módulo Docente / Inducción Institucional');

    const funcionarios = Storage.getFuncionariosActivos();
    
    // Mapear métricas
    const funcConMetricas = funcionarios.map(f => {
      const metricas = this.obtenerMetricasFuncionario(f.id);
      return {
        ...f,
        metricas
      };
    });

    // Ordenamiento dinámico DESC (Mayor a menor)
    const sortKey = this.currentSort || 'ausencias';
    funcConMetricas.sort((a, b) => (b.metricas[sortKey] || 0) - (a.metricas[sortKey] || 0));

    const funcPendientes = funcConMetricas.filter(f => !f.induccion || f.induccion.estado !== 'completado');
    const funcCompletados = funcConMetricas.filter(f => f.induccion && f.induccion.estado === 'completado');
    
    const renderBadges = (m) => `
      <div style="display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.35rem;">
        <span class="badge inline-flex items-center gap-1" style="background: #fee2e2; color: #991b1b; font-size: 0.72rem; padding: 0.15rem 0.45rem; border-radius: 4px; border: 1px solid #fca5a5;">
          ${Icons.get('alert-triangle', 12)} Ausencias: <strong>${m.ausencias}</strong>
        </span>
        <span class="badge inline-flex items-center gap-1" style="background: #fef3c7; color: #92400e; font-size: 0.72rem; padding: 0.15rem 0.45rem; border-radius: 4px; border: 1px solid #fde68a;">
          ${Icons.get('file-text', 12)} Permisos: <strong>${m.permisos}</strong>
        </span>
      </div>
    `;

    const rowsPendientes = funcPendientes.length === 0 
      ? '<tr><td colspan="2" class="text-center text-muted py-4">No hay inducciones pendientes.</td></tr>'
      : funcPendientes.map(f => `
          <tr>
            <td style="padding:0.85rem 1rem; vertical-align:middle;">
              <b style="font-size: 0.95rem;">${f.apellidos}, ${f.nombres}</b>
              <small class="text-muted" style="display:block;">${f.cargo || 'Docente'}</small>
              ${renderBadges(f.metricas)}
            </td>
            <td style="padding:0.85rem 1rem; vertical-align:middle; text-align:center;">
              <button class="btn btn-sm btn-primary" style="font-weight:600;" onclick="ProfesorView.abrirInduccion('${f.id}')">Inducción</button>
            </td>
          </tr>
        `).join('');

    const rowsCompletadas = funcCompletados.length === 0 
      ? '<tr><td colspan="2" class="text-center text-muted py-4">No hay inducciones completadas.</td></tr>'
      : funcCompletados.map(f => `
          <tr>
            <td style="padding:0.85rem 1rem; vertical-align:middle;">
              <b style="font-size: 0.95rem;">${f.apellidos}, ${f.nombres}</b>
              <small class="text-muted" style="display:block;">${f.cargo || 'Docente'}</small>
              ${renderBadges(f.metricas)}
            </td>
            <td style="padding:0.85rem 1rem; vertical-align:middle; text-align:center;">
              <a href="#/funcionarios/${f.id}" class="btn btn-sm btn-outline-secondary" style="font-weight:600;">Ver Ficha</a>
            </td>
          </tr>
        `).join('');
        
    container.innerHTML = `
      <div style="max-width: 1200px; margin: 0 auto;">
        <div class="flex justify-between items-center mb-4" style="flex-wrap: wrap; gap: 1rem;">
          <div>
            <h2 style="margin:0; color:var(--text-primary); display: inline-flex; align-items: center; gap: 0.5rem;">${Icons.get('graduation-cap', 22)} Módulo Docente - Inducción Institucional</h2>
            <p class="text-secondary" style="margin: 0.25rem 0 0 0; font-size: 0.875rem;">Progreso de inducción y contabilización mensual de ausencias y permisos.</p>
          </div>

          <!-- Controles de Reorganización / Filtros DESC -->
          <div style="display: flex; align-items: center; gap: 0.5rem; background: white; border: 1px solid var(--border-color); border-radius: 8px; padding: 0.4rem 0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
            <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">Ordenar por (DESC):</span>
            <button class="btn btn-sm ${sortKey === 'ausencias' ? 'btn-danger' : 'btn-outline-secondary'} inline-flex items-center gap-1" style="font-size: 0.75rem; padding: 0.25rem 0.6rem; font-weight: 600;" onclick="ProfesorView.setSort('ausencias')">
              ${Icons.get('alert-triangle', 14)} Ausencias
            </button>
            <button class="btn btn-sm ${sortKey === 'permisos' ? 'btn-warning' : 'btn-outline-secondary'} inline-flex items-center gap-1" style="font-size: 0.75rem; padding: 0.25rem 0.6rem; font-weight: 600;" onclick="ProfesorView.setSort('permisos')">
              ${Icons.get('file-text', 14)} Permisos
            </button>
          </div>
        </div>
        
        <div class="dashboard-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; align-items: start;">
          <div class="card">
            <div class="card-header" style="background: var(--warning); color: #fff;">
              <h3 class="card-title inline-flex items-center gap-1" style="margin: 0;">${Icons.get('clock', 16)} Inducción Pendiente (${funcPendientes.length})</h3>
            </div>
            <div class="card-body">
              <div class="table-responsive">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Funcionario y Registro Asistencia</th>
                      <th style="width:100px; text-align:center;">Acción</th>
                    </tr>
                  </thead>
                  <tbody>${rowsPendientes}</tbody>
                </table>
              </div>
            </div>
          </div>
          
          <div class="card">
            <div class="card-header" style="background: var(--success); color: #fff;">
              <h3 class="card-title inline-flex items-center gap-1" style="margin: 0;">${Icons.get('check-circle-2', 16)} Inducción Completa (${funcCompletados.length})</h3>
            </div>
            <div class="card-body">
              <div class="table-responsive">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Funcionario y Registro Asistencia</th>
                      <th style="width:100px; text-align:center;">Acción</th>
                    </tr>
                  </thead>
                  <tbody>${rowsCompletadas}</tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },
  
  abrirInduccion(funcId) {
    const f = Storage.getFuncionarioById(funcId);
    if (!f) return;
    
    if (!f.induccion) {
      f.induccion = {
        estado: 'pendiente',
        checks: {
          leccionario: false,
          planificacion: false,
          reglamento: false
        }
      };
    }
    
    this.renderModalInduccion(f);
  },
  
  renderModalInduccion(f) {
    if (!f.induccion) f.induccion = { checks: {}, fecha_completo: null };
    const checks = f.induccion.checks;
    const items = (typeof Storage !== 'undefined' && typeof Storage.getInduccionChecklist === 'function')
      ? Storage.getInduccionChecklist()
      : [
          { id: 'leccionario', label: 'Llenado de Leccionario' },
          { id: 'planificacion', label: 'Planificación' },
          { id: 'reglamento', label: 'Reglamento Interno' }
        ];
    
    let completados = 0;
    let checksHtml = '';
    let completadosHtml = '';
    
    items.forEach(item => {
      const isChecked = checks[item.id];
      if (isChecked) completados++;
      
      const cardHtml = `
        <div class="card mb-3" style="opacity: ${isChecked ? '0.6' : '1'}; transition: opacity 0.3s;">
          <div class="card-body" style="padding: 1rem;">
            <div class="flex items-center gap-3">
              <input type="checkbox" ${isChecked ? 'checked' : ''} 
                     onchange="ProfesorView.toggleCheckInduccion('${f.id}', '${item.id}', this.checked)"
                     style="width: 1.5rem; height: 1.5rem; accent-color: var(--primary);">
              <div style="flex: 1; font-weight: 600; font-size: 1.1rem; ${isChecked ? 'text-decoration: line-through; color: var(--text-secondary);' : ''}">
                ${item.label}
              </div>
            </div>
          </div>
        </div>
      `;
      
      if (isChecked) completadosHtml += cardHtml;
      else checksHtml += cardHtml;
    });
    
    const porcentaje = Math.round((completados / items.length) * 100);
    const progressColor = porcentaje === 100 ? 'var(--success)' : 'var(--primary)';
    
    const html = `
      <div class="mb-4">
        <h4 style="margin-top:0; color:var(--text-secondary);">Progreso de Inducción - ${f.nombres} ${f.apellidos}</h4>
        <div style="background: #e2e8f0; border-radius: 8px; height: 12px; overflow: hidden; margin-top: 0.5rem;">
          <div style="background: ${progressColor}; height: 100%; width: ${porcentaje}%; transition: width 0.3s ease, background 0.3s ease;"></div>
        </div>
        <div class="text-right mt-1 text-sm font-bold" style="color: ${progressColor};">${completados}/${items.length} (${porcentaje}%)</div>
      </div>
      
      <div style="max-height: 50vh; overflow-y: auto; padding-right: 0.5rem;" id="induccion-checklist-container">
        ${checksHtml}
        
        ${completados > 0 ? `
          <details style="margin-top: 1rem;">
            <summary style="cursor: pointer; font-weight: 600; color: var(--text-secondary); margin-bottom: 1rem;">
              Ver pasos completados (${completados})
            </summary>
            ${completadosHtml}
          </details>
        ` : ''}
      </div>
    `;
    
    const footer = porcentaje === 100 
      ? `<button class="btn btn-success inline-flex items-center justify-center gap-1" style="width: 100%;" onclick="ProfesorView.completarInduccion('${f.id}')">${Icons.get('check-circle-2', 16)} Finalizar Inducción</button>`
      : `<button class="btn btn-secondary" style="width: 100%;" onclick="App.closeModal()">Cerrar</button>`;
      
    App.openModal('Inducción Institucional', html, footer);
  },
  
  toggleCheckInduccion(funcId, itemId, isChecked) {
    const f = Storage.getFuncionarioById(funcId);
    if (!f) return;
    
    f.induccion.checks[itemId] = isChecked;
    Storage.saveFuncionario(f).then(() => {
      this.renderModalInduccion(f);
    });
  },
  
  completarInduccion(funcId) {
    const f = Storage.getFuncionarioById(funcId);
    if (!f) return;
    
    f.induccion.estado = 'completado';
    Storage.saveFuncionario(f).then(() => {
      App.closeModal();
      App.showToast('Inducción completada con éxito', 'success');
      this.render(document.getElementById('app-content'));
    });
  }
};
window.ProfesorView = ProfesorView;
})();

