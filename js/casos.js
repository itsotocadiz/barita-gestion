/* ================================================================
   casos.js — Registro de Casos Graves
   ================================================================ */

(() => {
const CasosView = {
  renderList(container) {
    App.setBreadcrumb('Casos en Seguimiento');
    
    const casos = Storage.getCasos();
    const casosAbiertos = casos.filter(c => c.estado !== 'cerrado');
    const casosCerrados = casos.filter(c => c.estado === 'cerrado');
    
    const renderTabla = (listaCasos, titulo) => {
      if (listaCasos.length === 0) {
        return `<div class="text-muted text-center py-4">No hay casos registrados en esta categoría.</div>`;
      }
      
      const rowsHTML = listaCasos.map(caso => {
        let estudiantesHtml = '';
        let verFichaButtons = '';
        if (caso.estudiantesInvolucrados && caso.estudiantesInvolucrados.length > 0) {
          estudiantesHtml = caso.estudiantesInvolucrados.map(estId => {
            const e = Storage.getEstudianteById(estId);
            if (e) {
              const curso = e.curso ? DATA.getCurso(e.curso) : null;
              verFichaButtons += `<a href="#/estudiantes/${e.id}" class="btn btn-sm btn-secondary inline-flex items-center gap-1" style="font-size: 0.75rem; padding: 0.2rem 0.5rem; display: block; margin-bottom: 4px; text-align: center; font-weight: 600;">${Icons.get('external-link', 12)} Ficha ${e.nombres} ${e.apellidos.split(' ')[0]}</a>`;
              return `<div><b>${e.nombres} ${e.apellidos}</b> <span class="text-muted" style="font-size: 0.75rem;">(${curso ? curso.nombre : 'Sin curso'})</span></div>`;
            }
            return '';
          }).join('');
        } else {
          estudiantesHtml = '<span class="text-muted">Sin estudiantes asignados</span>';
          verFichaButtons = '<span class="text-muted">-</span>';
        }
        
        let tipoName = '';
        let badgeColor = '';
        if (caso.tipo === 'seguimiento') {
           tipoName = 'Seguimiento Leve';
           badgeColor = 'var(--primary)';
        } else if (caso.tipo === 'complejo') {
           tipoName = 'Caso Complejo';
           badgeColor = 'var(--danger)';
        } else if (caso.tipo === 'apoyo_psicosocial') {
           tipoName = 'Apoyo Psicosocial';
           badgeColor = '#d946ef'; // Fuchsia
        } else if (caso.tipo === 'plan_utp') {
           tipoName = 'Plan UTP';
           badgeColor = '#0ea5e9'; // Light Blue
        } else if (caso.tipo === 'medidas_pie') {
           tipoName = 'Medidas PIE';
           badgeColor = '#8b5cf6'; // Violet
        } else {
           const t = DATA.getTipoCaso(caso.tipo);
           tipoName = t ? t.nombre : 'Caso';
           badgeColor = 'var(--text-secondary)';
        }
        
        const descSnippet = caso.descripcion ? (caso.descripcion.length > 60 ? caso.descripcion.substring(0, 60) + '...' : caso.descripcion) : '';
        const motivoHtml = `
          <div>
            <span class="badge" style="background: ${badgeColor}; color: white; margin-bottom: 4px; display: inline-block;">${tipoName}</span>
            <div style="font-weight: 600;">${caso.titulo || ''}</div>
            <div class="text-muted" style="font-size: 0.75rem; max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${caso.descripcion || ''}">${descSnippet}</div>
            <div style="margin-top: 4px;"><a href="#/casos/${caso.id}" style="font-size: 0.75rem; text-decoration: underline; color: var(--primary); font-weight: 600;">Ver detalle</a></div>
          </div>
        `;
        
        let ultimoSegHtml = '<span class="text-muted" style="font-size: 0.8rem;">Sin seguimiento aún</span>';
        if (caso.seguimiento && caso.seguimiento.length > 0) {
          const segsSorted = [...caso.seguimiento].sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
          const lastSeg = segsSorted[0];
          const accion = DATA.getAccionPrevia(lastSeg.accionId);
          const accionName = accion ? accion.nombre : 'Acción';
          const fechaStr = new Date(lastSeg.fecha).toLocaleDateString();
          ultimoSegHtml = `
            <div style="font-size: 0.8rem;">
              <span class="badge" style="background: #f1f5f9; color: #334155; font-size: 0.7rem; border: 1px solid #cbd5e1; padding: 0.1rem 0.3rem;">${fechaStr}</span>
              <div style="font-weight: 600; color: var(--text-primary); margin-top: 2px;">${accionName}</div>
              ${lastSeg.texto ? `<div class="text-muted" style="font-size: 0.75rem; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;">${lastSeg.texto}</div>` : ''}
            </div>
          `;
        }
        
        return `
          <tr>
            <td style="padding: 0.75rem; vertical-align: middle;">${estudiantesHtml}</td>
            <td style="padding: 0.75rem; vertical-align: middle;">${motivoHtml}</td>
            <td style="padding: 0.75rem; vertical-align: middle;">${ultimoSegHtml}</td>
            <td style="padding: 0.75rem; vertical-align: middle; text-align: center;">${verFichaButtons}</td>
          </tr>
        `;
      }).join('');
      
      return `
        <div class="card mb-4" style="margin: 0; border: none; box-shadow: none;">
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th style="width: 30%;">Estudiante</th>
                  <th style="width: 30%;">Motivo del caso</th>
                  <th style="width: 25%;">Último seguimiento</th>
                  <th style="width: 15%; text-align: center;">Acción: Ver ficha</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHTML}
              </tbody>
            </table>
          </div>
        </div>
      `;
    };
    
    let html = `
      <!-- Buscador con Live Search -->
      <div style="margin-bottom: 1.5rem; position: relative;">
        <div style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-secondary); display: inline-flex; align-items: center; justify-content: center;">
          ${Icons.get('search', 16)}
        </div>
        <input type="text" id="buscador-casos" class="form-control" placeholder="Buscar estudiante por nombre..." 
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
              filterTable('tabla-seguimiento-body');
            filterTable('tabla-complejo-body');
            filterTable('tabla-compromisos-body');
            filterTable('tabla-cerrados-body');
          "
        >
      </div>
    `;
    
    // Tablas de Estudiantes en Seguimiento y Complejos
    const estudiantes = Storage.getEstudiantes() || [];
    
    // Obtener IDs de estudiantes que tienen casos abiertos de estos tipos
    const casosAbiertosSeguimiento = Storage.getCasos().filter(c => c.tipo === 'seguimiento' && c.estado !== 'cerrado');
    const idsSeguimiento = casosAbiertosSeguimiento.map(c => c.estudiantesInvolucrados && c.estudiantesInvolucrados[0]).filter(Boolean);
    
    const casosAbiertosComplejos = Storage.getCasos().filter(c => c.tipo === 'complejo' && c.estado !== 'cerrado');
    const idsComplejos = casosAbiertosComplejos.map(c => c.estudiantesInvolucrados && c.estudiantesInvolucrados[0]).filter(Boolean);

    const seguimientoStudents = estudiantes.filter(e => e.enSeguimiento || idsSeguimiento.includes(e.id));
    const complejoStudents = estudiantes.filter(e => e.esComplejo || idsComplejos.includes(e.id));

    // Monitoreo de Compromisos Conductuales Activos (Vigentes)
    const compromisosVigentes = [];
    estudiantes.forEach(est => {
      if (!est || !est.compromisoConductualActivo) return;
      let res = null;
      if (window.RICEEngine && typeof window.RICEEngine.evaluarCompromisoEstudiante === 'function') {
        res = window.RICEEngine.evaluarCompromisoEstudiante(est.id);
      } else {
        res = { estado: est.compromisoEstado || 'vigente' };
      }
      if (res && res.estado === 'vigente') {
        const fInicioFormated = est.compromisoFechaInicio ? new Date(`${est.compromisoFechaInicio}T12:00:00`).toLocaleDateString('es-CL') : 'Inicio';
        const fTerminoFormated = est.compromisoFechaTermino ? new Date(`${est.compromisoFechaTermino}T12:00:00`).toLocaleDateString('es-CL') : 'Término';
        compromisosVigentes.push({ est, fechaInicio: fInicioFormated, fechaTermino: fTerminoFormated });
      }
    });

    const rowsCompromisos = compromisosVigentes.length === 0
      ? '<tr><td colspan="2" class="text-center text-muted py-4">No hay compromisos conductuales vigentes activos.</td></tr>'
      : compromisosVigentes.map(item => `
          <tr>
            <td style="padding:1rem; vertical-align:middle;">
              <b>${item.est.nombres} ${item.est.apellidos}</b>
              <div style="font-size:0.8rem; color:#b45309; font-weight:500; margin-top:2px; display: inline-flex; align-items: center; gap: 4px;">${Icons.get('clock', 12)} Monitoreo de conducta activo: ${item.fechaInicio} al ${item.fechaTermino}</div>
            </td>
            <td style="padding:1rem; vertical-align:middle; text-align:center;">
              <a href="#/estudiantes" onclick="setTimeout(()=>EstudiantesView.renderDetalle(document.getElementById('app-content'), '${item.est.id}'), 100)" class="btn btn-sm btn-primary">Ir a Perfil</a>
            </td>
          </tr>
        `).join('');

    const rowsSeguimiento = seguimientoStudents.length === 0
      ? '<tr><td colspan="2" class="text-center text-muted py-4">No hay estudiantes en Seguimiento Institucional.</td></tr>'
      : seguimientoStudents.map(e => `
          <tr>
            <td style="padding:1rem; vertical-align:middle;"><b>${e.nombres} ${e.apellidos}</b></td>
            <td style="padding:1rem; vertical-align:middle; text-align:center;">
              <a href="#/estudiantes" onclick="setTimeout(()=>EstudiantesView.renderDetalle(document.getElementById('app-content'), '${e.id}'), 100)" class="btn btn-sm btn-primary">Ir a Perfil</a>
            </td>
          </tr>
        `).join('');

    const rowsComplejo = complejoStudents.length === 0
      ? '<tr><td colspan="2" class="text-center text-muted py-4">No hay estudiantes Complejos registrados.</td></tr>'
      : complejoStudents.map(e => `
          <tr>
            <td style="padding:1rem; vertical-align:middle;"><b>${e.nombres} ${e.apellidos}</b></td>
            <td style="padding:1rem; vertical-align:middle; text-align:center;">
              <a href="#/estudiantes" onclick="setTimeout(()=>EstudiantesView.renderDetalle(document.getElementById('app-content'), '${e.id}'), 100)" class="btn btn-sm btn-primary">Ir a Perfil</a>
            </td>
          </tr>
        `).join('');

    const historialCasosCerrados = Storage.getCasos().filter(c => c.estado === 'cerrado' && ['seguimiento', 'complejo', 'apoyo_psicosocial', 'plan_utp', 'medidas_pie'].includes(c.tipo));
    
    // Agrupar los casos cerrados por estudiante
    const estudiantesCerradosMap = new Map();
    historialCasosCerrados.forEach(c => {
      const eId = (c.estudiantesInvolucrados || [])[0] || c.estudiante_id || c.estudianteId;
      if (!eId) return;
      const key = String(eId).trim();
      if (!estudiantesCerradosMap.has(key)) {
        estudiantesCerradosMap.set(key, []);
      }
      estudiantesCerradosMap.get(key).push(c);
    });

    const rowsCerrados = estudiantesCerradosMap.size === 0
      ? '<tr><td colspan="3" class="text-center text-muted py-4">No hay casos cerrados.</td></tr>'
      : Array.from(estudiantesCerradosMap.entries()).map(([eId, casosEstudiante]) => {
          const est = Storage.getEstudianteById(eId);
          const nom = est ? `${est.nombres} ${est.apellidos}` : 'Estudiante Desconocido';
          
          const casosSublist = casosEstudiante.map(c => {
            let bCol = 'var(--primary)', bTxt = 'Leve';
            if (c.tipo === 'complejo') { bCol = 'var(--danger)'; bTxt = 'Complejo'; }
            else if (c.tipo === 'apoyo_psicosocial') { bCol = '#d946ef'; bTxt = 'Psicosocial'; }
            else if (c.tipo === 'plan_utp') { bCol = '#0ea5e9'; bTxt = 'UTP'; }
            else if (c.tipo === 'medidas_pie') { bCol = '#8b5cf6'; bTxt = 'PIE'; }

            const tituloLimpio = Storage.safeHtml(c.titulo || 'Sin motivo').replace(/^Protocolo\s*\d+\s*[\u2014\-]\s*/gi, '');
            const badge = `<span class="badge" style="background-color: ${bCol}; color:white; padding: 2px 6px; border-radius:4px; font-size:0.75rem; display: inline-block; min-width: 65px; text-align: center;">${bTxt}</span>`;
            return `
              <div style="margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                ${badge}
                <span style="font-size: 0.9rem; color: #1e293b;">${tituloLimpio}</span>
              </div>
            `;
          }).join('');

          return `
            <tr>
              <td style="padding:1rem; vertical-align:top; font-weight: 700; color: #0f172a;">${nom}</td>
              <td style="padding:1rem; vertical-align:top;">${casosSublist}</td>
              <td style="padding:1rem; vertical-align:top; text-align:center;">
                ${est ? `<a href="#/estudiantes" onclick="setTimeout(()=>EstudiantesView.renderDetalle(document.getElementById('app-content'), '${est.id}'), 100)" class="btn btn-sm btn-outline-secondary" style="font-weight: 600;">Ver Ficha</a>` : ''}
              </td>
            </tr>
          `;
        }).join('');

    let seccionesHtml = '';

    if (compromisosVigentes.length > 0) {
      seccionesHtml += `
        <details class="card mb-3" style="border: 1px solid #fde68a; border-left: 5px solid #f59e0b; background: #fffbeb; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.04); transition: all 0.3s ease;">
          <summary style="cursor: pointer; padding: 0.85rem 1.25rem; display: flex; align-items: center; justify-content: space-between; user-select: none; list-style: none;" class="card-header">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <h3 style="margin: 0; color: #b45309; font-size: 1.05rem; display: inline-flex; align-items: center; gap: 0.5rem;">
                ${Icons.get('hourglass', 18)} Compromisos Conductuales Vigentes (Casos Activos)
              </h3>
            </div>
            <span class="badge" style="background: #f59e0b; color: white; font-weight: 700; font-size: 0.8rem; padding: 0.25rem 0.6rem; border-radius: 12px;">
              ${compromisosVigentes.length} ${compromisosVigentes.length === 1 ? 'Registro' : 'Registros'}
            </span>
          </summary>
          <div class="card-body" style="padding: 1rem 1.25rem 1.25rem; border-top: 1px solid #fde68a; background: #fff;">
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>Estudiante</th>
                    <th style="width:140px; text-align:center;">Acción</th>
                  </tr>
                </thead>
                <tbody id="tabla-compromisos-body">${rowsCompromisos}</tbody>
              </table>
            </div>
          </div>
        </details>
      `;
    }

    if (seguimientoStudents.length > 0) {
      seccionesHtml += `
        <details class="card mb-3" style="border: 1px solid #bfdbfe; border-left: 5px solid #2563eb; background: #eff6ff; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.04); transition: all 0.3s ease;">
          <summary style="cursor: pointer; padding: 0.85rem 1.25rem; display: flex; align-items: center; justify-content: space-between; user-select: none; list-style: none;" class="card-header">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <h3 style="margin: 0; color: #2563eb; font-size: 1.05rem; display: inline-flex; align-items: center; gap: 0.5rem;">
                ${Icons.get('eye', 18)} Estudiantes en Seguimiento (Casos Activos)
              </h3>
            </div>
            <span class="badge" style="background: #2563eb; color: white; font-weight: 700; font-size: 0.8rem; padding: 0.25rem 0.6rem; border-radius: 12px;">
              ${seguimientoStudents.length} ${seguimientoStudents.length === 1 ? 'Registro' : 'Registros'}
            </span>
          </summary>
          <div class="card-body" style="padding: 1rem 1.25rem 1.25rem; border-top: 1px solid #bfdbfe; background: #fff;">
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>Estudiante</th>
                    <th style="width:140px; text-align:center;">Acción</th>
                  </tr>
                </thead>
                <tbody id="tabla-seguimiento-body">${rowsSeguimiento}</tbody>
              </table>
            </div>
          </div>
        </details>
      `;
    }

    if (complejoStudents.length > 0) {
      seccionesHtml += `
        <details class="card mb-3" style="border: 1px solid #fecaca; border-left: 5px solid #dc2626; background: #fef2f2; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.04); transition: all 0.3s ease;">
          <summary style="cursor: pointer; padding: 0.85rem 1.25rem; display: flex; align-items: center; justify-content: space-between; user-select: none; list-style: none;" class="card-header">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1rem; color: #dc2626; font-weight: 700;">▶</span>
              <h3 style="margin: 0; color: #dc2626; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">
                <span>🚨</span> Estudiantes Complejos (Casos en Seguimiento)
              </h3>
            </div>
            <span class="badge" style="background: #dc2626; color: white; font-weight: 700; font-size: 0.8rem; padding: 0.25rem 0.6rem; border-radius: 12px;">
              ${complejoStudents.length} ${complejoStudents.length === 1 ? 'Registro' : 'Registros'}
            </span>
          </summary>
          <div class="card-body" style="padding: 1rem 1.25rem 1.25rem; border-top: 1px solid #fecaca; background: #fff;">
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>Estudiante</th>
                    <th style="width:140px; text-align:center;">Acción</th>
                  </tr>
                </thead>
                <tbody id="tabla-complejo-body">${rowsComplejo}</tbody>
              </table>
            </div>
          </div>
        </details>
      `;
    }

    if (estudiantesCerradosMap.size > 0) {
      seccionesHtml += `
        <details class="card mb-3" style="border: 1px solid #cbd5e1; border-left: 5px solid #64748b; background: #f8fafc; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.04); transition: all 0.3s ease;">
          <summary style="cursor: pointer; padding: 0.85rem 1.25rem; display: flex; align-items: center; justify-content: space-between; user-select: none; list-style: none;" class="card-header">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1rem; color: #475569; font-weight: 700;">▶</span>
              <h3 style="margin: 0; color: #334155; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">
                <span>📁</span> Historial de Seguimientos Finalizados (Cerrados)
              </h3>
            </div>
            <span class="badge" style="background: #64748b; color: white; font-weight: 700; font-size: 0.8rem; padding: 0.25rem 0.6rem; border-radius: 12px;">
              ${estudiantesCerradosMap.size} ${estudiantesCerradosMap.size === 1 ? 'Estudiante' : 'Estudiantes'}
            </span>
          </summary>
          <div class="card-body" style="padding: 1rem 1.25rem 1.25rem; border-top: 1px solid #cbd5e1; background: #fff;">
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>Estudiante</th>
                    <th>Motivo del Seguimiento</th>
                    <th style="width:150px; text-align:center;">Acción</th>
                  </tr>
                </thead>
                <tbody id="tabla-cerrados-body">${rowsCerrados}</tbody>
              </table>
            </div>
          </div>
        </details>
      `;
    }

    html += `<div class="mt-4">${seccionesHtml}</div>`;

    container.innerHTML = html;
  },

  renderDetalle(container, id) {
    const caso = Storage.getCasoById(id);
    if (!caso) {
      if (!Storage.isReady) {
        container.innerHTML = `
          <div class="text-center" style="padding: 3rem 1rem; margin-top: 2rem;">
            <div style="display: inline-block; width: 2.5rem; height: 2.5rem; border: 4px solid var(--primary); border-radius: 50%; border-top-color: transparent; animation: spin 1s linear infinite;"></div>
            <p class="text-secondary" style="margin-top: 1rem;">Sincronizando con el servidor...</p>
            <style>
              @keyframes spin { to { transform: rotate(360deg); } }
            </style>
          </div>
        `;
        return;
      }
      window.location.hash = '#/casos';
      return;
    }
    
    const tipo = DATA.getTipoCaso(caso.tipo);
    const estado = DATA.getEstadoCaso(caso.estado);
    const protocolo = caso.protocoloId ? Storage.getProtocoloActivoById(caso.protocoloId) : null;
    
    App.setBreadcrumb(`<a href="#/casos">Casos Graves</a> / Detalle del Caso`);
    
    let html = `
      <div class="card mb-4">
        <div class="card-header flex justify-between items-start">
          <div>
            <span class="badge mb-2" style="background: ${estado.bgColor}; color: ${estado.color}; border: 1px solid ${estado.color};">${estado.nombre}</span>
            <h2 style="margin: 0; font-size: 1.5rem; color: var(--danger);">${tipo ? tipo.nombre : 'Caso'}</h2>
            <div class="text-muted mt-2 text-sm">
              Registrado el ${new Date(caso.fecha).toLocaleDateString()}
            </div>
          </div>
          ${caso.estado !== 'cerrado' && Auth.canWriteCasos() ? `
            <div>
              <button class="btn btn-secondary text-danger" onclick="CasosView.cerrarCaso('${caso.id}')">
                🛑 Cerrar Caso
              </button>
            </div>
          ` : ''}
        </div>
        <div class="card-body">
          <div class="flex justify-between items-center mb-2">
            <h4 class="m-0">Descripción de la Situación</h4>
            ${Auth.canWriteCasos() ? `
              <button class="btn btn-sm btn-secondary" id="btn-edit-desc" onclick="document.getElementById('desc-view').style.display='none'; document.getElementById('desc-edit').style.display='block'; this.style.display='none';">✏️ Editar</button>
            ` : ''}
          </div>
          
          <div id="desc-view">
            <p id="p-desc-view" style="background: var(--bg-hover); padding: 1.5rem; border-radius: var(--radius-md); font-size: 1rem; white-space: pre-wrap; border-left: 4px solid var(--danger); margin: 0;"></p>
          </div>
          
          <div id="desc-edit" style="display: none;">
            <textarea id="textarea-desc" class="form-control mb-2" style="background: var(--bg-hover); padding: 1rem; border-radius: var(--radius-md); font-size: 1rem; border: 1px solid var(--border-color); border-left: 4px solid var(--danger); width: 100%; min-height: 120px; resize: vertical;">${Storage.escapeHtml(caso.descripcion)}</textarea>
            <div class="flex gap-2">
              <button class="btn btn-sm btn-primary" onclick="CasosView.guardarDescripcion('${caso.id}')">Guardar</button>
              <button class="btn btn-sm btn-secondary" onclick="document.getElementById('desc-edit').style.display='none'; document.getElementById('desc-view').style.display='block'; document.getElementById('btn-edit-desc').style.display='inline-block';">Cancelar</button>
            </div>
          </div>
          
          <div class="dashboard-grid mt-4">
            <div>
              <h4 class="mb-2">Estudiantes Involucrados</h4>
              <div class="flex gap-2 flex-wrap">
                ${(caso.estudiantesInvolucrados || []).map(estId => {
                  const e = Storage.getEstudianteById(estId);
                  if(!e) return '';
                  return `<a href="#/estudiantes/${e.id}" class="badge" style="background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-primary); font-size:0.875rem; padding: 0.5rem;">👤 ${e.nombres} ${e.apellidos}</a>`;
                }).join('') || '<span class="text-muted">Ninguno especificado</span>'}
              </div>
            </div>
            
            <div>
              <h4 class="mb-2">Motivo Principal</h4>
              <select class="form-control" onchange="CasosView.vincularMotivo('${caso.id}', this.value)" style="max-width: 100%;">
                <option value="">-- Sin motivo especificado --</option>
                ${DATA.motivosGraves.map(m => `
                  <option value="${m.id}" ${caso.motivoGraveId === m.id ? 'selected' : ''}>${m.nombre}</option>
                `).join('')}
              </select>
            </div>
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="card-header flex justify-between items-center">
          <h3 class="card-title">Seguimiento Institucional</h3>
            ${Auth.canWriteCasos() ? `
              <button class="btn btn-primary btn-sm" onclick="CasosView.agregarSeguimiento('${caso.id}')">
                + Añadir Actualización
              </button>
            ` : ''}
        </div>
        <div class="card-body">
          ${(caso.seguimiento || []).length === 0 ? 
            '<div class="text-center py-4 text-muted">No hay registro de seguimiento para este caso.</div>' :
            `<div class="timeline flex-col gap-4 relative" style="padding-left: 1rem; border-left: 2px solid var(--border-color); margin-left: 0.5rem;">
              ${caso.seguimiento.sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)).map(s => {
                return `
                  <div class="timeline-item relative">
                    <div class="absolute" style="left: -1.4rem; top: 0.25rem; width: 12px; height: 12px; border-radius: 50%; background: var(--text-secondary); border: 2px solid var(--bg-card);"></div>
                    <div style="background: var(--bg-card); border: 1px solid var(--border-color); padding: 1rem; border-radius: var(--radius-md);">
                      <div class="flex justify-between items-start mb-2">
                        <span class="text-muted" style="font-size: 0.85rem; font-weight: 600;">${new Date(s.fecha).toLocaleDateString()}</span>
                        ${Auth.canWriteCasos() ? `
                          <div>
                            <button class="btn btn-sm" style="background: transparent; color: ${s.adjunto ? 'var(--primary)' : 'var(--text-secondary)'}; border: none; font-size: 1.1rem; padding: 0.2rem; ${s.adjunto ? 'opacity: 0.4; cursor: not-allowed; pointer-events: none;' : ''}" onclick="CasosView.subirAdjuntoSeguimiento('${caso.id}', '${s.id}')" title="${s.adjunto ? 'Archivo adjunto (No puedes adjuntar más, usa el botón de editar)' : 'Adjuntar archivo'}" ${s.adjunto ? 'disabled' : ''}>📎</button>
                            <button class="btn btn-sm" style="background: transparent; color: var(--text-secondary); border: none; font-size: 1.1rem; padding: 0.2rem;" onclick="CasosView.editarTextoSeguimiento('${caso.id}', '${s.id}')" title="Editar registro">✏️</button>
                          </div>
                        ` : ''}
                      </div>
                      ${s.accionId ? `<div style="font-weight: 600; font-size: 0.95rem; color: var(--primary); margin-bottom: 0;">▶ ${DATA.getAccionPrevia(s.accionId)?.nombre || 'Acción'}</div>` : ''}
                      ${s.texto ? `<p id="seg-texto-${s.id}" style="font-size: 0.875rem; white-space: pre-wrap; margin-top: 0.5rem; margin-bottom: 0;"></p>` : ''}
                      ${s.adjunto ? `<div class="mt-2" style="font-size: 0.8rem; color: var(--success); font-weight: 600; display: flex; align-items: center; gap: 4px;">📎 Documento adjunto: ${s.adjunto} <button class="btn btn-sm p-0" style="color: var(--primary); font-size: 1.1rem; border: none; background: transparent; cursor: pointer; margin-left: 4px;" onclick="App.showToast('Descargando archivo...', 'info')" title="Descargar archivo">📥</button></div>` : ''}
                      <div class="text-muted mt-2" style="font-size: 0.725rem; border-top: 1px dashed #e2e8f0; padding-top: 4px;">
                        Registrado por: <b>${s.registradoPor || 'Sistema'}</b>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>`
          }
        </div>
      </div>
    `;
    
    container.innerHTML = html;
    const pDesc = document.getElementById('p-desc-view');
    if (pDesc && caso && caso.descripcion) {
      Storage.textNode(pDesc, caso.descripcion);
    }
    if (caso && caso.seguimiento) {
      caso.seguimiento.forEach(s => {
        const el = document.getElementById(`seg-texto-${s.id}`);
        if (el && s.texto) Storage.textNode(el, s.texto);
      });
    }
  },

  nuevoCaso() {
    const estudiantes = Storage.getEstudiantes().filter(e => e.activo !== false);
    const protocolos = Storage.getProtocolosActivos();
    
    const html = `
      <form id="form-caso" onsubmit="event.preventDefault(); CasosView.guardarCaso()">
        <div class="form-group">
          <label class="form-label">Tipo de Caso *</label>
          <select id="caso-tipo" class="form-control" required>
            <option value="">Seleccione...</option>
            ${DATA.tiposCaso.map(t => `<option value="${t.id}">${t.nombre}</option>`).join('')}
          </select>
        </div>
        
        <div class="form-group">
          <label class="form-label">Descripción de la Situación *</label>
          <textarea id="caso-desc" class="form-control" required rows="4" placeholder="Describa el hecho grave detalladamente..."></textarea>
        </div>
        
        <div class="form-group">
          <label class="form-label">Estudiantes Involucrados (Opcional, Ctrl+Click)</label>
          <select id="caso-ests" class="form-control" multiple size="3">
            ${estudiantes.sort((a,b)=>a.apellidos.localeCompare(b.apellidos)).map(e => `<option value="${e.id}">${e.apellidos}, ${e.nombres} (${DATA.getCurso(e.curso)?.nombre})</option>`).join('')}
          </select>
        </div>
        
        <div class="form-group">
          <label class="form-label">Vincular a Protocolo Existente (Opcional)</label>
          <select id="caso-prot" class="form-control">
            <option value="">-- No vincular --</option>
            ${protocolos.map(p => {
              const nombre = DATA.getProtocolo(p.tipoProtocolo)?.nombre;
              return `<option value="${p.id}">${new Date(p.fechaActivacion).toLocaleDateString()} - ${nombre}</option>`;
            }).join('')}
          </select>
        </div>
      </form>
    `;
    
    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-danger" onclick="document.getElementById('form-caso').requestSubmit()">Guardar Caso</button>
    `;
    
    App.openModal('Registrar Caso Grave', html, footer);
  },

  guardarCaso() {
    const selectEsts = document.getElementById('caso-ests');
    const involucrados = Array.from(selectEsts.selectedOptions).map(opt => opt.value);
    
    const loggedUser = Auth.userProfile?.nombres 
      ? `${Auth.userProfile.nombres} ${Auth.userProfile.apellidos || ''}` 
      : (Auth.currentUser?.email || 'Sistema');

    const caso = {
      tipo: document.getElementById('caso-tipo').value,
      descripcion: document.getElementById('caso-desc').value,
      estudiantesInvolucrados: involucrados,
      protocoloId: document.getElementById('caso-prot').value || null,
      estado: 'abierto',
      registradoPor: loggedUser
    };
    
    const c = Storage.saveCaso(caso);
    App.closeModal();
    App.showToast('Caso grave registrado', 'danger');
    App.updateBadges();
    window.location.hash = `#/casos/${c.id}`;
  },

  vincularMotivo(id, mId) {
    const caso = Storage.getCasoById(id);
    if(caso) {
      caso.motivoGraveId = mId || null;
      Storage.saveCaso(caso);
      App.showToast('Motivo vinculado exitosamente.', 'success');
      this.renderDetalle(document.getElementById('app-content'), id);
    }
  },

  guardarDescripcion(id) {
    const caso = Storage.getCasoById(id);
    const textarea = document.getElementById('textarea-desc');
    if(caso && textarea) {
      caso.descripcion = textarea.value;
      Storage.saveCaso(caso);
      App.showToast('Descripción guardada exitosamente.', 'success');
      this.renderDetalle(document.getElementById('app-content'), id);
    }
  },

  agregarSeguimiento(casoId) {
    const html = `
      <form id="form-seg" onsubmit="event.preventDefault(); CasosView.guardarSeguimiento('${casoId}')">
        <div class="form-group mb-3">
          <label class="form-label">Fecha de la Acción *</label>
          <input type="date" id="seg-fecha" class="form-control" required value="${BARITA_hoyChileISO()}">
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Acción Previa / Tipo de Seguimiento *</label>
          <select id="seg-accion" class="form-control" required>
            <option value="">-- Seleccione una acción --</option>
            ${DATA.accionesPrevias.map(a => `<option value="${a.id}">${a.nombre}</option>`).join('')}
          </select>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Detalle del seguimiento *</label>
          <textarea id="seg-texto" class="form-control" rows="3" placeholder="Describe la acción realizada..." required></textarea>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Fecha Próximo Seguimiento</label>
          <input type="date" id="seg-proximo" class="form-control">
          <small class="text-muted">Establece alerta para el próximo seguimiento en dashboard.</small>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Archivo adjunto</label>
          <input type="file" id="seg-archivo" class="form-control" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg">
        </div>
      </form>
    `;
    
    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="document.getElementById('form-seg').requestSubmit()">Añadir</button>
    `;
    
    App.openModal('Añadir Seguimiento', html, footer);
  },

  async guardarSeguimiento(casoId) {
    const fechaInput = document.getElementById('seg-fecha').value;
    let fechaFormat = new Date().toISOString();
    if (fechaInput) {
      const parts = fechaInput.split('-');
      const now = new Date();
      fechaFormat = new Date(parts[0], parts[1] - 1, parts[2], now.getHours(), now.getMinutes(), now.getSeconds()).toISOString();
    }
    const textoVal = (document.getElementById('seg-texto')?.value || '').trim();
    const proximoVal = document.getElementById('seg-proximo')?.value || null;
    const fileInput = document.getElementById('seg-archivo');
    if (!textoVal) { App.showToast('Ingresa detalle del seguimiento','warning'); return; }
    if (!document.getElementById('seg-accion').value) { App.showToast('Selecciona tipo de seguimiento','warning'); return; }
    let fileUrl = null;
    if (fileInput && fileInput.files.length>0) {
      try { if (typeof EstudiantesView !== 'undefined' && EstudiantesView.subirArchivoMock) fileUrl = await EstudiantesView.subirArchivoMock(fileInput.files[0]); } catch(_e){}
    }
    const loggedUser = Auth.userProfile?.nombres 
      ? `${Auth.userProfile.nombres} ${Auth.userProfile.apellidos || ''}` 
      : (Auth.currentUser?.email || 'Sistema');
    const accionSel = document.getElementById('seg-accion').value;
    const accionPrevia = DATA.getAccionPrevia(accionSel);
    const nombreAccion = accionPrevia ? accionPrevia.nombre : 'Seguimiento';
    const textoFinal = textoVal ? `${nombreAccion}: ${textoVal}` : nombreAccion;
    const seguimiento = {
      id: Date.now().toString(),
      accionId: accionSel,
      fecha: fechaFormat,
      fechaProximoSeguimiento: proximoVal,
      texto: textoFinal,
      registradoPor: loggedUser,
      adjunto: fileUrl
    };
    
    const c = Storage.getCasoById(casoId);
    if(c) {
      if (!c.seguimiento) c.seguimiento = [];
      c.seguimiento.unshift(seguimiento);
      if (proximoVal) c.proximoSeguimiento = proximoVal;
      if(c.estado === 'abierto') {
        c.estado = 'en_proceso';
      }
      await Storage.saveCaso(c);
      
      if (c.estudiantesInvolucrados && c.estudiantesInvolucrados.length > 0) {
        for (const estId of c.estudiantesInvolucrados) {
          const est = Storage.getEstudianteById(estId);
          if (est) {
            if (!est.bitacoraSeguimiento) est.bitacoraSeguimiento = [];
            est.bitacoraSeguimiento.unshift({
              id: Date.now().toString() + estId.substring(0,4),
              fecha: fechaFormat,
              texto: textoFinal,
              fechaProximoSeguimiento: proximoVal,
              adjunto: fileUrl,
              trackingId: est.currentTrackingId,
              registradoPor: loggedUser
            });
            if (proximoVal) est.fechaProximoSeguimiento = proximoVal;
            // activa flag según tipo de caso
            const tipoCaso = c.tipo || 'seguimiento';
            if (tipoCaso==='seguimiento') est.enSeguimiento=true;
            else if (tipoCaso==='complejo') est.esComplejo=true;
            else if (tipoCaso==='apoyo_psicosocial') est.requiereApoyoPsicosocial=true;
            else if (tipoCaso==='plan_utp') est.planUtpActivo=true;
            else if (tipoCaso==='medidas_pie' || tipoCaso==='pie') { est.medidasPie=true; est.esEstudiantePIE=true; }
            await Storage.saveEstudiante(est, true);
          }
        }
      }
    }
    
    App.closeModal();
    App.showToast('Seguimiento añadido', 'success');
    this.renderDetalle(document.getElementById('app-content'), casoId);
  },
  
  subirAdjuntoSeguimiento(casoId, segId) {
    const caso = Storage.getCasoById(casoId);
    if (!caso) return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.png,.jpg,.jpeg';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const seg = caso.seguimiento.find(s => s.id === segId);
        if (seg) {
          seg.adjunto = file.name;
          Storage.saveCaso(caso);
          this.renderDetalle(document.getElementById('app-content'), casoId);
          App.showToast('Documento adjuntado con éxito.', 'success');
        }
      }
    };
    input.click();
  },

  editarTextoSeguimiento(casoId, segId) {
    const caso = Storage.getCasoById(casoId);
    if (!caso) return;
    const seg = caso.seguimiento.find(s => s.id === segId);
    if (!seg) return;
    
    const fechaDate = new Date(seg.fecha);
    const fechaStr = BARITA_toChileDateKey(fechaDate);
    
    const html = `
      <form id="form-editar-seg" onsubmit="event.preventDefault(); CasosView.guardarEdicionSeguimiento('${casoId}', '${segId}')">
        <div class="form-group mb-3">
          <label class="form-label">Fecha del registro</label>
          <input type="date" id="edit-seg-fecha" class="form-control" value="${fechaStr}" required>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Detalle del registro</label>
          <textarea id="edit-seg-texto" class="form-control" rows="4" required>${seg.texto ? seg.texto.replace(/<br>/g, '\\n') : ''}</textarea>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Archivo adjunto</label>
          <div id="edit-seg-archivo-container" style="display: flex; align-items: center; gap: 8px; padding: 0.5rem; background: var(--bg-light, #f8fafc); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
            <div id="edit-seg-archivo-nombre" style="flex: 1; font-size: 0.85rem; color: ${seg.adjunto ? 'var(--text-primary)' : 'var(--text-secondary)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${seg.adjunto ? `<strong>${seg.adjunto}</strong>` : 'No hay archivo seleccionado'}
            </div>
            <button type="button" class="btn btn-sm btn-secondary" onclick="document.getElementById('edit-seg-archivo').click()" title="Reemplazar/Subir archivo">📂 Reemplazar</button>
            <button type="button" id="edit-seg-btn-eliminar" class="btn btn-sm text-danger" style="display: ${seg.adjunto ? 'inline-block' : 'none'}; padding: 0.2rem 0.5rem; background: #fee2e2; border: 1px solid #fca5a5;" onclick="CasosView.eliminarArchivoModalSeguimiento()" title="Eliminar archivo">🗑️</button>
          </div>
          <input type="file" id="edit-seg-archivo" class="form-control" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" style="display: none;" onchange="CasosView.cambiarArchivoModalSeguimiento(this)">
          <input type="hidden" id="edit-seg-archivo-eliminado" value="false">
        </div>
      </form>
    `;
    
    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="document.getElementById('form-editar-seg').requestSubmit()">Guardar Cambios</button>
    `;
    
    App.openModal('Editar Registro', html, footer);
  },
  
  eliminarArchivoModalSeguimiento() {
    App.showConfirm('Confirmar', '¿Estás seguro de que deseas eliminar este archivo?', () => {
      document.getElementById('edit-seg-archivo').value = '';
      document.getElementById('edit-seg-archivo-eliminado').value = 'true';
      const nombreDiv = document.getElementById('edit-seg-archivo-nombre');
      nombreDiv.innerHTML = 'No hay archivo seleccionado';
      nombreDiv.style.color = 'var(--text-secondary)';
      document.getElementById('edit-seg-btn-eliminar').style.display = 'none';
    });
  },
  
  cambiarArchivoModalSeguimiento(input) {
    if (input.files && input.files.length > 0) {
      document.getElementById('edit-seg-archivo-eliminado').value = 'false';
      const nombreDiv = document.getElementById('edit-seg-archivo-nombre');
      nombreDiv.innerHTML = `<strong>${input.files[0].name}</strong>`;
      nombreDiv.style.color = 'var(--text-primary)';
      document.getElementById('edit-seg-btn-eliminar').style.display = 'inline-block';
    }
  },

  guardarEdicionSeguimiento(casoId, segId) {
    const nuevaFecha = document.getElementById('edit-seg-fecha').value;
    const nuevoTexto = document.getElementById('edit-seg-texto').value.trim();
    const fileInput = document.getElementById('edit-seg-archivo');
    const eliminado = document.getElementById('edit-seg-archivo-eliminado').value === 'true';
    
    if (!nuevaFecha || !nuevoTexto) return;
    
    const caso = Storage.getCasoById(casoId);
    if (!caso) return;
    
    const seg = caso.seguimiento.find(s => s.id === segId);
    if (seg) {
      const fechaOriginal = new Date(seg.fecha);
      const partesFecha = nuevaFecha.split('-');
      
      const fechaActualizada = new Date(
        parseInt(partesFecha[0]), 
        parseInt(partesFecha[1]) - 1, 
        parseInt(partesFecha[2]),
        fechaOriginal.getHours(),
        fechaOriginal.getMinutes(),
        fechaOriginal.getSeconds()
      );
      
      seg.fecha = fechaActualizada.toISOString();
      seg.texto = nuevoTexto;
      
      if (eliminado) {
        delete seg.adjunto;
      } else if (fileInput && fileInput.files.length > 0) {
        seg.adjunto = fileInput.files[0].name;
      }
      
      Storage.saveCaso(caso);
      App.closeModal();
      this.renderDetalle(document.getElementById('app-content'), casoId);
      App.showToast('Registro actualizado.', 'success');
    }
  },

  eliminarSeguimiento(casoId, segId) {
    App.confirm('Eliminar Registro', '¿Está seguro que desea eliminar este registro de la bitácora?', () => {
      const caso = Storage.getCasoById(casoId);
      if (caso) {
        caso.seguimiento = caso.seguimiento.filter(s => s.id !== segId);
        Storage.saveCaso(caso);
        App.showToast('Registro eliminado', 'success');
        this.renderDetalle(document.getElementById('app-content'), casoId);
      }
    });
  },
  
  cerrarCaso(casoId) {
    App.confirm('Cerrar Caso', '¿Está seguro que desea dar por concluido y cerrar este caso?', () => {
      const modal = document.createElement('div');
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:99999;display:flex;justify-content:center;align-items:center;';
      modal.innerHTML = `
        <div class="card" style="max-width:420px;width:92%;padding:1.25rem;background:white;">
          <h3 style="margin:0 0 0.5rem;color:var(--primary)">Cerrar caso</h3>
          <p style="margin:0 0 0.75rem;font-size:0.9rem;" class="text-secondary">Ingrese la razón de cierre.</p>
          <input id="cierre-razon" type="text" class="form-control" placeholder="Razón del cierre" style="width:100%;margin-bottom:0.75rem;">
          <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
            <button id="cierre-cancel" class="btn btn-secondary">Cancelar</button>
            <button id="cierre-ok" class="btn btn-primary">Cerrar</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      const close = () => modal.remove();
      modal.querySelector('#cierre-cancel').onclick = close;
      modal.onclick = (e) => { if (e.target === modal) close(); };
      document.addEventListener('keydown', function esc(e){ if (e.key === 'Escape'){ close(); document.removeEventListener('keydown', esc);} });

      modal.querySelector('#cierre-ok').onclick = async () => {
        const razon = modal.querySelector('#cierre-razon').value.trim();
        close();
        const c = Storage.getCasoById(casoId);
        if(c) {
          c.estado = 'cerrado';
          if (!c.seguimiento) c.seguimiento = [];
          const cierreTexto = `🏁 Cierre del caso${razon ? '\nRazon: ' + razon : ''}`;
          c.seguimiento.unshift({
            id: Date.now().toString(),
            fecha: new Date().toISOString(),
            texto: cierreTexto,
            registradoPor: Auth.userProfile?.nombres ? `${Auth.userProfile.nombres} ${Auth.userProfile.apellidos||''}` : (Auth.currentUser?.email||'Sistema')
          });
          if (c.proximoSeguimiento) c.proximoSeguimiento = null;
          await Storage.saveCaso(c);

          if (c.estudiantesInvolucrados) {
            for (const estId of c.estudiantesInvolucrados) {
              const est = Storage.getEstudianteById(estId);
              if (!est) continue;
              if (!est.bitacoraSeguimiento) est.bitacoraSeguimiento = [];
              est.bitacoraSeguimiento.unshift({
                id: Date.now().toString()+estId.substring(0,4),
                fecha: new Date().toISOString(),
                texto: cierreTexto,
                registradoPor: Auth.userProfile?.nombres ? `${Auth.userProfile.nombres} ${Auth.userProfile.apellidos||''}` : (Auth.currentUser?.email||'Sistema')
              });
              // Desmarcar check según tipo (para todos)
              const tipo = c.tipo || 'seguimiento';
              if (tipo==='seguimiento') est.enSeguimiento=false;
              else if (tipo==='complejo') est.esComplejo=false;
              else if (tipo==='apoyo_psicosocial') est.requiereApoyoPsicosocial=false;
              else if (tipo==='plan_utp') est.planUtpActivo=false;
              else if (tipo==='medidas_pie' || tipo==='pie') { est.medidasPie=false; est.esEstudiantePIE=false; }
              else { est.enSeguimiento=false; }
              if (est.fechaProximoSeguimiento) est.fechaProximoSeguimiento = null;
              await Storage.saveEstudiante(est, true);
            }
          }

          App.showToast('Caso cerrado — bitácora actualizada y seguimiento desmarcado', 'success');
          App.updateBadges();
          this.renderDetalle(document.getElementById('app-content'), casoId);
        }
      };
    });
  }
};
window.CasosView = CasosView;
})();
