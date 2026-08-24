/* ================================================================
   alertas_asistencia.js — Módulo de Alertas de Asistencia
   Permite visualizar inasistencias, atrasos y justificados generales.
   ================================================================ */

(() => {
const AlertasAsistenciaView = {
  containerId: 'app-content',
  currentTab: 'inasistencias',

  init() {
    this.render();
  },

  render() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    let html = `
      <div class="header-actions">
        <div>
          <h2 style="display: inline-flex; align-items: center; gap: 0.5rem;">${Icons.get('alert-triangle', 24)} Alertas de Asistencia y Atrasos</h2>
          <p class="text-secondary">Gestión de inasistencias, listado de atrasos y estudiantes con atrasos autorizados/justificados.</p>
        </div>
      </div>
      
      <div class="tabs" style="margin-top: 1rem; border-bottom: 1px solid var(--border-color); display: flex; gap: 1rem;">
        <button class="tab-btn ${this.currentTab === 'inasistencias' ? 'active' : ''}" 
                onclick="AlertasAsistenciaView.switchTab('inasistencias')"
                style="background: none; border: none; padding: 0.5rem 1rem; cursor: pointer; border-bottom: 2px solid ${this.currentTab === 'inasistencias' ? 'var(--primary-color)' : 'transparent'}; color: ${this.currentTab === 'inasistencias' ? 'var(--primary-color)' : 'var(--text-color)'}; font-weight: 500;">
          Inasistencias
        </button>
        <button class="tab-btn ${this.currentTab === 'atrasos' ? 'active' : ''}" 
                onclick="AlertasAsistenciaView.switchTab('atrasos')"
                style="background: none; border: none; padding: 0.5rem 1rem; cursor: pointer; border-bottom: 2px solid ${this.currentTab === 'atrasos' ? 'var(--primary-color)' : 'transparent'}; color: ${this.currentTab === 'atrasos' ? 'var(--primary-color)' : 'var(--text-color)'}; font-weight: 500;">
          Atrasos Pendientes
        </button>
        <button class="tab-btn ${this.currentTab === 'justificados' ? 'active' : ''}" 
                onclick="AlertasAsistenciaView.switchTab('justificados')"
                style="background: none; border: none; padding: 0.5rem 1rem; cursor: pointer; border-bottom: 2px solid ${this.currentTab === 'justificados' ? 'var(--primary-color)' : 'transparent'}; color: ${this.currentTab === 'justificados' ? 'var(--primary-color)' : 'var(--text-color)'}; font-weight: 500;">
          <span style="display: inline-flex; align-items: center; gap: 0.35rem;">${Icons.get('check-circle-2', 14)} Estudiantes Justificados</span>
        </button>
      </div>

      <div class="card" style="margin-top: 1rem;">
        <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
          <button class="btn btn-primary" onclick="AlertasAsistenciaView.refrescar()">Refrescar</button>
        </div>
        
        <div class="table-responsive">
          <table class="table" id="tabla-alertas-asistencia">
            <thead>
              ${this.currentTab === 'inasistencias' ? `
                <tr>
                  <th>Estudiante</th>
                  <th>Curso</th>
                  <th>Inasistencias Acumuladas</th>
                  <th>Última Gestión</th>
                  <th>Acciones</th>
                </tr>
              ` : this.currentTab === 'atrasos' ? `
                <tr>
                  <th>Estudiante</th>
                  <th>Curso</th>
                  <th>Total Atrasos Registrados</th>
                  <th>Atrasos No Justificados</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              ` : `
                <tr>
                  <th>Estudiante</th>
                  <th>Curso</th>
                  <th>Total Atrasos Registrados</th>
                  <th>Estado / Permiso</th>
                  <th>Razón General de Justificación</th>
                  <th>Acciones</th>
                </tr>
              `}
            </thead>
            <tbody>
              <tr><td colspan="6" style="text-align:center;">Cargando...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    container.innerHTML = html;
    this.renderAlertas();
  },

  switchTab(tab) {
    this.currentTab = tab;
    this.render();
  },

  async refrescar() {
    await this.renderAlertas();
    if(App && App.showToast) App.showToast('Datos actualizados', 'success');
  },

  async renderAlertas() {
    const tbody = document.querySelector('#tabla-alertas-asistencia tbody');
    if (!tbody) return;

    const estudiantes = Storage.getEstudiantes ? Storage.getEstudiantes() : [];
    const inasistencias = Storage.cache?.inasistencias || [];
    const atrasos = Storage.cache?.atrasos || [];
    const gestiones = Storage.cache?.gestiones_asistencia || [];
    const allCursos = (typeof DATA !== 'undefined' && DATA.cursos) ? DATA.cursos : (Storage.cache?.cursos || []);

    const statsMap = {};

    estudiantes.forEach(est => {
      const cursoObj = allCursos.find(c => c.id === est.curso || c.id === est.cursoId);
      const nombreCompleto = est.nombre || `${est.nombres || ''} ${est.apellidos || ''}`.trim() || 'Estudiante';
      
      statsMap[est.id] = {
        estudiante: est,
        nombreCompleto: nombreCompleto,
        cursoNombre: cursoObj ? cursoObj.nombre : (est.curso || 'Sin curso'),
        inasistenciasTotales: 0,
        atrasosTotales: 0,
        atrasosNoJustificados: 0,
        atrasosJustificados: 0,
        esJustificadoGeneral: !!(est.atrasoJustificadoGeneral || est.justificadoGeneral),
        razonGeneral: est.razonJustificacionGeneral || est.razonJustificado || '',
        obsGeneral: est.obsJustificacionGeneral || '',
        ultimaGestionInasistencia: null,
        ultimaGestionAtraso: null
      };
    });

    inasistencias.forEach(i => {
      if (statsMap[i.estudianteId]) {
        statsMap[i.estudianteId].inasistenciasTotales++;
      }
    });

    atrasos.forEach(a => {
      if (statsMap[a.estudianteId]) {
        statsMap[a.estudianteId].atrasosTotales++;
        if (!a.justificado && !statsMap[a.estudianteId].esJustificadoGeneral) {
          statsMap[a.estudianteId].atrasosNoJustificados++;
        } else {
          statsMap[a.estudianteId].atrasosJustificados++;
        }
      }
    });

    // Ordenar gestiones por fecha
    const sortedGestiones = [...gestiones].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    sortedGestiones.forEach(g => {
      if (statsMap[g.estudianteId]) {
        if (g.tipo === 'inasistencia') {
          statsMap[g.estudianteId].ultimaGestionInasistencia = g;
        } else if (g.tipo === 'atraso') {
          statsMap[g.estudianteId].ultimaGestionAtraso = g;
        }
      }
    });

    let list = Object.values(statsMap);

    if (this.currentTab === 'inasistencias') {
      list = list.filter(item => item.inasistenciasTotales > 0);
      list.sort((a, b) => b.inasistenciasTotales - a.inasistenciasTotales);
      
      if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay inasistencias registradas.</td></tr>';
        return;
      }

      tbody.innerHTML = list.map(item => `
        <tr>
          <td>
            <div style="font-weight: 500;">${item.nombreCompleto}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${item.estudiante.rut || ''}</div>
          </td>
          <td>${item.cursoNombre}</td>
          <td><span class="badge ${item.inasistenciasTotales >= 3 ? 'badge-danger' : 'badge-warning'}">${item.inasistenciasTotales}</span></td>
          <td>
            ${item.ultimaGestionInasistencia ? 
              `<div style="font-size:0.85rem;">${item.ultimaGestionInasistencia.fecha}</div>
               <div style="font-size:0.75rem; color:var(--text-muted);">${item.ultimaGestionInasistencia.observaciones || ''}</div>` : 
              '-'
            }
          </td>
          <td>
            <a href="#/estudiantes/${item.estudiante.id}" class="btn btn-sm btn-primary" title="Ir al calendario de asistencia y ficha">
              📅 Ver Ficha / Calendario
            </a>
          </td>
        </tr>
      `).join('');

    } else if (this.currentTab === 'atrasos') {
      // Filtrar estudiantes con atrasos no justificados globalmente
      list = list.filter(item => item.atrasosTotales > 0 && !item.esJustificadoGeneral);
      list.sort((a, b) => b.atrasosTotales - a.atrasosTotales);

      if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No hay atrasos pendientes sin justificar.</td></tr>';
        return;
      }

      tbody.innerHTML = list.map(item => `
        <tr>
          <td>
            <div style="font-weight: 500;">${item.nombreCompleto}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${item.estudiante.rut || ''}</div>
          </td>
          <td>${item.cursoNombre}</td>
          <td><span class="badge badge-secondary">${item.atrasosTotales}</span></td>
          <td>
            <span class="badge ${item.atrasosNoJustificados >= 3 ? 'badge-danger' : 'badge-warning'}">${item.atrasosNoJustificados} Atrasos</span>
          </td>
          <td>
            <span class="badge badge-warning" style="font-size:0.75rem;">Sin justificación general</span>
          </td>
          <td style="display: flex; gap: 0.5rem; align-items: center;">
            <button class="btn btn-sm btn-secondary" onclick="AlertasAsistenciaView.abrirModalJustificarGeneral('${item.estudiante.id}')" title="Autorizar e ingresar razón de justificación general">
              📝 Justificar
            </button>
            <a href="#/estudiantes/${item.estudiante.id}" class="btn btn-sm btn-primary" title="Ir al calendario de atrasos y ficha">
              📅 Ver Ficha / Calendario
            </a>
          </td>
        </tr>
      `).join('');

    } else {
      // Tab: Justificados (Muestra estudiantes con justificación general o atrasos justificados)
      list = list.filter(item => item.esJustificadoGeneral || item.atrasosJustificados > 0);
      list.sort((a, b) => b.atrasosTotales - a.atrasosTotales);

      if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No hay estudiantes con justificación general registrada.</td></tr>';
        return;
      }

      tbody.innerHTML = list.map(item => `
        <tr>
          <td>
            <div style="font-weight: 500;">${item.nombreCompleto}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${item.estudiante.rut || ''}</div>
          </td>
          <td>${item.cursoNombre}</td>
          <td><span class="badge badge-secondary">${item.atrasosTotales} Registrados</span></td>
          <td>
            <span class="badge" style="background: var(--success); color: white; padding: 0.3rem 0.6rem;">🟢 Permiso Autorizado</span>
          </td>
          <td>
            <div style="font-size: 0.85rem; color: var(--text-primary);">
              <strong>📌 Razón:</strong> ${Storage.safeHtml(item.razonGeneral || 'Motivo institucional/médico')}
              ${item.obsGeneral ? `<br><small class="text-muted">${Storage.safeHtml(item.obsGeneral)}</small>` : ''}
            </div>
          </td>
          <td style="display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;">
            <button class="btn btn-sm btn-secondary" onclick="AlertasAsistenciaView.abrirModalJustificarGeneral('${item.estudiante.id}')" title="Editar razón de justificación">
              ✏️ Editar
            </button>
            <button class="btn btn-sm" style="background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5;" onclick="AlertasAsistenciaView.revertirJustificacionGeneral('${item.estudiante.id}')" title="Revertir y quitar permiso general">
              ✖️ Revertir
            </button>
            <a href="#/estudiantes/${item.estudiante.id}" class="btn btn-sm btn-primary" title="Ir al calendario del estudiante">
              📅 Ver Ficha / Calendario
            </a>
          </td>
        </tr>
      `).join('');
    }
  },

  abrirModalJustificarGeneral(estId) {
    const est = Storage.getEstudianteById(estId);
    if (!est) return;

    const nombreCompleto = est.nombre || `${est.nombres || ''} ${est.apellidos || ''}`.trim();
    const razonActual = est.razonJustificacionGeneral || est.razonJustificado || '';
    const obsActual = est.obsJustificacionGeneral || '';

    const html = `
      <form id="form-justificar-general" onsubmit="event.preventDefault(); AlertasAsistenciaView.guardarJustificacionGeneral('${estId}')">
        <div class="alert alert-info mb-3">
          <p style="margin: 0; font-size: 0.85rem;">
            Esta acción autoriza al estudiante <strong>${nombreCompleto}</strong> a llegar tarde por una razón justificada. 
            <strong>No se borran sus atrasos registrados</strong>; estos se mantienen en su historial pero el alumno se traslada a la lista de <strong>Justificados</strong>.
          </p>
        </div>

        <div class="form-group mb-3">
          <label class="form-label font-semibold">Razón o Motivo de Justificación General *</label>
          <input type="text" id="just-general-razon" class="form-control" value="${Storage.safeHtml(razonActual)}" placeholder="Ej: Tratamiento médico recurrente, Transporte rural lejano, Cuidado familiar..." required>
        </div>

        <div class="form-group mb-3">
          <label class="form-label">Observaciones / Detalle adicional (Opcional)</label>
          <textarea id="just-general-obs" class="form-control" rows="3" placeholder="Ej: Presenta certificado médico timbrado en Inspectoría...">${Storage.safeHtml(obsActual)}</textarea>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary inline-flex items-center gap-1.5" onclick="document.getElementById('form-justificar-general').requestSubmit()">${Icons.get('check-circle-2', 14)} Otorgar Justificación General</button>
    `;

    App.openModal(`Justificar Atrasos - ${nombreCompleto}`, html, footer);
  },

  async guardarJustificacionGeneral(estId) {
    const razon = document.getElementById('just-general-razon').value.trim();
    const obs = document.getElementById('just-general-obs').value.trim();

    if (!razon) {
      App.showToast('Debe ingresar la razón o motivo de la justificación', 'warning');
      return;
    }

    const est = Storage.getEstudianteById(estId);
    if (!est) return;

    // Actualizar ficha del estudiante con justificación general
    est.atrasoJustificadoGeneral = true;
    est.justificadoGeneral = true;
    est.razonJustificacionGeneral = razon;
    est.obsJustificacionGeneral = obs;

    // Marcar los atrasos existentes como justificados asociándoles la razón general
    const atrasos = Storage.cache?.atrasos || [];
    const atrasosEstudiante = atrasos.filter(a => (a.estudianteId || a.estudiante_id) === estId);
    for (const a of atrasosEstudiante) {
      a.justificado = true;
      a.razon = razon;
      a.motivo_justificacion = razon;
      a.justificacion = razon;
      if (Storage.saveAtraso) {
        await Storage.saveAtraso(a);
      }
    }

    await Storage.saveEstudiante(est);

    App.closeModal();
    App.showToast(`Justificación general registrada para ${est.nombres || est.nombre}. Estudiante trasladado a Justificados.`, 'success');
    this.switchTab('justificados');
  },

  revertirJustificacionGeneral(estId) {
    App.showConfirm('Revertir Justificación', '¿Estás seguro de desmarcar la justificación general? El estudiante volverá al listado de atrasos pendientes.', async () => {
      const est = Storage.getEstudianteById(estId);
      if (est) {
        est.atrasoJustificadoGeneral = false;
        est.justificadoGeneral = false;
        delete est.razonJustificacionGeneral;
        delete est.obsJustificacionGeneral;

        const atrasos = Storage.cache?.atrasos || [];
        const atrasosEst = atrasos.filter(a => (a.estudianteId || a.estudiante_id) === estId);
        for (const a of atrasosEst) {
          a.justificado = false;
          delete a.razon;
          delete a.motivo_justificacion;
          delete a.justificacion;
          if (Storage.saveAtraso) {
            await Storage.saveAtraso(a);
          }
        }

        await Storage.saveEstudiante(est);

        App.showToast('Justificación revertida. El estudiante ha vuelto a Atrasos Pendientes.', 'info');
        this.renderAlertas();
      }
    });
  }
};
window.AlertasAsistenciaView = AlertasAsistenciaView;
})();
