/* ================================================================
   pise.js — Plan Integral de Seguridad Escolar (PISE)
   Bitácora de seguridad y Obligaciones Normativas.
   ================================================================ */

const PiseView = (() => {
  let bitacoraListener = null;
  let obligacionesListener = null;
  let bitacoraData = [];
  let obligacionesData = {};

  function render(container) {
    App.setBreadcrumb('PISE (Seguridad Escolar)');

    container.innerHTML = `
      <div style="text-align: center; padding: 3rem;">
        <p class="text-secondary">Cargando datos del PISE...</p>
      </div>
    `;

    if (bitacoraListener) bitacoraListener();
    if (obligacionesListener) obligacionesListener();

    const fallbackTimer = setTimeout(() => {
      obligacionesData = { sismo: false, infraestructura: false, comite: false, primeros_auxilios: false, tableros_red: false, mapa_riesgos: false };
      bitacoraData = [];
      updateUI(container);
    }, 3000);

    const keys = ['sismo', 'infraestructura', 'comite', 'primeros_auxilios', 'tableros_red', 'mapa_riesgos'];

    obligacionesListener = window.supabaseGestion.from('pise_obligaciones').select('*').eq('id', 'checklist').on('change', payload => {
      clearTimeout(fallbackTimer);
      const doc = payload.new;
      if (doc) {
        obligacionesData = { sismo: doc.sismo, infraestructura: doc.infraestructura, comite: doc.comite, primeros_auxilios: doc.primeros_auxilios, tableros_red: doc.tableros_red, mapa_riesgos: doc.mapa_riesgos };
      } else {
        obligacionesData = { sismo: false, infraestructura: false, comite: false, primeros_auxilios: false, tableros_red: false, mapa_riesgos: false };
      }
      updateUI(container);
    }, err => {
      clearTimeout(fallbackTimer);
      updateUI(container);
    });

    bitacoraListener = window.supabaseGestion.from('pise_bitacora').select('*').order('fecha', { ascending: false }).on('change', payload => {
      bitacoraData = [];
      const rows = payload.new || [];
      rows.forEach(doc => {
        const item = doc;
        bitacoraData.push(item);
      });
      updateUI(container);
    }, err => {
      updateUI(container);
    });
  }

  function updateUI(container) {
    const keys = ['sismo', 'infraestructura', 'comite', 'primeros_auxilios', 'tableros_red', 'mapa_riesgos'];
    const completedCount = keys.filter(k => obligacionesData[k]).length;
    const progressPercent = Math.round((completedCount / keys.length) * 100);

    const checklistLabels = {
      sismo: 'Simulacro de Sismo / Evacuación (1 por semestre)',
      infraestructura: 'Revisión de Infraestructura, Extintores y Vías de Evacuación',
      comite: 'Constitución y Reuniones del Comité de Seguridad Escolar',
      primeros_auxilios: 'Capacitación en Primeros Auxilios y Uso de Extintores',
      tableros_red: 'Inspección de Tableros Eléctricos y Red Húmeda/Seca',
      mapa_riesgos: 'Actualización Anual del Plan PISE y Mapa de Riesgos'
    };

    let bitacoraHtml = '';
    if (bitacoraData.length === 0) {
      bitacoraHtml = `
        <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🛡️</div>
          <p style="margin: 0; font-size: 0.9rem;">No hay registros en la bitácora de seguridad.</p>
        </div>
      `;
    } else {
      bitacoraHtml = `
        <div style="position: relative; padding-left: 1.5rem; border-left: 2px solid var(--border-color); display: flex; flex-direction: column; gap: 1.2rem; margin-left: 0.5rem; margin-top: 1rem;">
          ${bitacoraData.map(item => {
            let colorBadge = '#475569';
            let bgBadge = '#f1f5f9';
            if (item.categoria === 'Accidente') { colorBadge = '#b91c1c'; bgBadge = '#fef2f2'; }
            else if (item.categoria === 'Mantenimiento') { colorBadge = '#2563eb'; bgBadge = '#eff6ff'; }
            else if (item.categoria === 'Simulacro') { colorBadge = '#d97706'; bgBadge = '#fffbeb'; }
            else if (item.categoria === 'Capacitación') { colorBadge = '#059669'; bgBadge = '#ecfdf5'; }

            return `
              <div style="position: relative;">
                <span style="position: absolute; left: -1.9rem; top: 0.35rem; background: ${colorBadge}; width: 8px; height: 8px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 0 2px ${colorBadge};"></span>
                <div style="background: white; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.01);">
                  <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
                    <span class="badge" style="background: ${bgBadge}; color: ${colorBadge}; font-weight: 600; font-size: 0.7rem; padding: 0.2rem 0.4rem; border-radius: 4px;">
                      ${item.categoria}
                    </span>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                      <span class="text-muted" style="font-size: 0.75rem;">${new Date(item.fecha).toLocaleString()}</span>
                      ${Auth.currentRole === 'admin' ? `
                        <button class="btn btn-sm btn-secondary text-danger" onclick="window.PiseView.eliminarAccion('${item.id}')" style="padding: 0.1rem 0.3rem; font-size: 0.65rem; border: none; background: transparent;" title="Eliminar registro">🗑</button>
                      ` : ''}
                    </div>
                  </div>
                  <h4 style="margin: 0.25rem 0; font-size: 0.9rem; color: var(--text-primary); font-weight: 600;">${item.titulo}</h4>
                  ${item.descripcion ? `<p style="margin: 0.35rem 0 0 0; font-size: 0.85rem; color: #475569; line-height: 1.4; white-space: pre-wrap;">${item.descripcion}</p>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    container.innerHTML = `
      <div style="max-width: 1200px; margin: 0 auto; padding: 1rem 0;">
        <div style="margin-bottom: 2rem;">
          <h2 style="margin: 0; color: var(--text-primary); font-size: 1.75rem;">Plan Integral de Seguridad Escolar (PISE)</h2>
          <p class="text-secondary">Monitoreo de obligaciones normativas y bitácora preventiva de seguridad.</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 2rem;">
          
          <div class="card" style="background: white; border-radius: var(--radius-md); box-shadow: var(--shadow-sm);">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
              <h3 class="card-title" style="margin: 0; font-size: 1.1rem;">🛡️ Bitácora de Seguridad Escolar</h3>
              <button class="btn btn-primary btn-sm" onclick="window.PiseView.abrirModalRegistro()">+ Registrar Registro</button>
            </div>
            <div class="card-body" style="padding: 1.25rem 1rem;">
              ${bitacoraHtml}
            </div>
          </div>

          <div class="card" style="background: white; border-radius: var(--radius-md); box-shadow: var(--shadow-sm); height: fit-content;">
            <div class="card-header">
              <h3 class="card-title" style="margin: 0; font-size: 1.1rem;">📋 Obligaciones Normativas (MINEDUC/SENAPRED)</h3>
            </div>
            <div class="card-body" style="padding: 1.25rem 1.5rem;">
              <div style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                  <span style="font-size: 0.85rem; font-weight: 600; color: #475569;">Progreso Anual de Cumplimiento</span>
                  <span style="font-size: 0.9rem; font-weight: 700; color: var(--primary);">${progressPercent}%</span>
                </div>
                <div style="background: #e2e8f0; border-radius: 10px; height: 10px; width: 100%; overflow: hidden;">
                  <div style="background: var(--primary); height: 100%; width: ${progressPercent}%; transition: width 0.3s ease;"></div>
                </div>
              </div>

              <div style="display: flex; flex-direction: column; gap: 1rem;">
                ${keys.map(key => `
                  <label style="display: flex; align-items: start; gap: 0.75rem; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); cursor: pointer; transition: background 0.2s;" 
                         class="hover-bg-light">
                    <input type="checkbox" style="margin-top: 0.2rem; transform: scale(1.1);" 
                           ${obligacionesData[key] ? 'checked' : ''} 
                           onclick="window.PiseView.toggleObligacion('${key}', this.checked)">
                    <span style="font-size: 0.875rem; color: var(--text-primary); font-weight: 500; line-height: 1.3;">
                      ${checklistLabels[key]}
                    </span>
                  </label>
                `).join('')}
              </div>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  async function toggleObligacion(key, val) {
    obligacionesData[key] = val;
    try {
      await window.supabaseGestion.from('pise_obligaciones').upsert({ id: 'checklist', [key]: val });
      App.showToast('Estado de obligación actualizado', 'success');
    } catch (e) {
      obligacionesData[key] = !val;
      updateUI(document.getElementById('app-content'));
      App.showToast('Error al guardar cambios: ' + e.message, 'error');
    }
  }

  function abrirModalRegistro() {
    const html = `
      <form id="form-pise-registro" onsubmit="event.preventDefault(); window.PiseView.guardarRegistro()">
        <div class="form-group">
          <label class="form-label">Título / Asunto *</label>
          <input type="text" id="pise-titulo" class="form-control" placeholder="Ej: Recarga de Extintores Edificio A" required>
        </div>
        <div class="form-group">
          <label class="form-label">Categoría *</label>
          <select id="pise-categoria" class="form-control" required>
            <option value="">Seleccione...</option>
            <option value="Mantenimiento">Mantenimiento / Infraestructura</option>
            <option value="Simulacro">Simulacro / Evacuación</option>
            <option value="Reunión Comité">Reunión de Comité</option>
            <option value="Capacitación">Capacitación / Charla</option>
            <option value="Accidente">Accidente / Incidente</option>
            <option value="Otro">Otro Acto Preventivo</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Descripción detallada</label>
          <textarea id="pise-descripcion" class="form-control" rows="4" placeholder="Detalle las acciones realizadas, participantes o hallazgos..."></textarea>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="document.getElementById('form-pise-registro').requestSubmit()">Guardar Registro</button>
    `;

    App.openModal('Registrar Actividad PISE', html, footer);
  }

  async function guardarRegistro() {
    const titulo = document.getElementById('pise-titulo').value.trim();
    const categoria = document.getElementById('pise-categoria').value;
    const descripcion = document.getElementById('pise-descripcion').value.trim();
    
    if (!titulo || !categoria || !descripcion) {
      App.showToast('Complete título, categoría y descripción.', 'warning');
      return;
    }
    
    const registro = {
      titulo: titulo,
      categoria: categoria,
      descripcion: descripcion,
      fecha: new Date().toISOString(),
      autor: typeof Auth !== 'undefined' && Auth.currentUser && Auth.currentUser.email ? Auth.currentUser.email : 'Usuario'
    };

    try {
      const { error } = await window.supabaseGestion.from('pise_bitacora').insert(registro);
      if (error) throw error;
      App.closeModal();
      App.showToast('Registro de seguridad guardado', 'success');
    } catch (e) {
      App.showToast('Error al guardar el registro', 'error');
    }
  }

  async function eliminarAccion(id) {
    App.confirm('Eliminar Registro PISE', '¿Está seguro de eliminar este registro de seguridad?', async () => {
      try {
        const { error } = await window.supabaseGestion.from('pise_bitacora').delete().eq('id', id);
        if (error) throw error;
        App.showToast('Registro eliminado', 'success');
      } catch (e) {
        App.showToast('Error al eliminar el registro', 'error');
      }
    });
  }

  return {
    render,
    toggleObligacion,
    abrirModalRegistro,
    guardarRegistro,
    eliminarAccion,
    updateUI
  };
})();

window.PiseView = PiseView;
