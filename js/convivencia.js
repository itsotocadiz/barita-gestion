/* ================================================================
   convivencia.js — Módulo Convivencia Escolar
   ================================================================ */

const ConvivenciaView = (() => {
  function render(container) {
    App.setBreadcrumb('Convivencia Escolar / Listado Estudiantes Complejos');
    
    const estudiantes = typeof Storage !== 'undefined' && Storage.getEstudiantes ? Storage.getEstudiantes() : [];
    const protocolosCache = (Storage.cache && Storage.cache.protocolos_activos) || [];
    
    // Unificar protocolos desde la memoria de protocolos_activos y desde las marcas activas en los estudiantes
    const listaProtocolos = [...protocolosCache];

    estudiantes.forEach(est => {
      const estIdStr = String(est.id);
      if (est.esComplejo) {
        const yaExiste = listaProtocolos.some(p => p && String(p.estudiante_id || p.estudianteId) === estIdStr && p.estado === 'en_proceso');
        if (!yaExiste) {
          listaProtocolos.push({
            id: 'PROT_EST_' + est.id,
            estudiante_id: est.id,
            tipo_protocolo: est.motivoComplejo || 'Caso Complejo',
            estado: 'en_proceso',
            fecha_creacion: new Date().toISOString()
          });
        }
      }

      // Revisa si el estudiante tiene registros de cierre de caso complejo en su bitácora o casos cerrados
      if (Array.isArray(est.bitacoraSeguimiento)) {
        const finComplejo = est.bitacoraSeguimiento.find(b => b && (String(b.texto).includes('Fin de Caso Complejo') || String(b.texto).includes('Caso Complejo')));
        if (finComplejo) {
          const yaExisteComp = listaProtocolos.some(p => p && String(p.estudiante_id || p.estudianteId) === estIdStr && p.estado === 'completado');
          if (!yaExisteComp) {
            listaProtocolos.push({
              id: 'PROT_COMP_FALLBACK_' + est.id,
              estudiante_id: est.id,
              tipo_protocolo: 'Caso Complejo Finalizado',
              estado: 'completado',
              fecha_cierre: finComplejo.fecha || new Date().toISOString()
            });
          }
        }
      }
    });

    // Inspección adicional de casos cerrados complejos
    const casos = typeof Storage !== 'undefined' && Storage.getCasos ? Storage.getCasos() : [];
    casos.forEach(c => {
      if (c && c.estado === 'cerrado' && (c.tipo === 'complejo' || String(c.descripcion).includes('Caso Complejo'))) {
        const ids = c.estudiantesInvolucrados || [c.estudiante_id || c.estudianteId];
        ids.forEach(estId => {
          if (!estId) return;
          const estIdStr = String(estId);
          const yaExisteComp = listaProtocolos.some(p => p && String(p.estudiante_id || p.estudianteId) === estIdStr && p.estado === 'completado');
          if (!yaExisteComp) {
            listaProtocolos.push({
              id: 'PROT_COMP_CASO_' + c.id + '_' + estIdStr,
              estudiante_id: estId,
              tipo_protocolo: c.titulo || 'Caso Complejo Finalizado',
              estado: 'completado',
              fecha_cierre: c.fechaCierre || c.fecha_cierre || (c.seguimiento && c.seguimiento.length ? c.seguimiento[c.seguimiento.length - 1].fecha : new Date().toISOString())
            });
          }
        });
      }
    });

    const protocolosEnProceso = listaProtocolos.filter(p => p && p.estado === 'en_proceso');
    const protocolosCompletados = listaProtocolos.filter(p => p && p.estado === 'completado');

    let html = `
      <div class="card mb-4">
        <div class="card-header" style="background: var(--danger); color: white;">
          <h3 class="card-title" style="margin: 0; display: inline-flex; align-items: center; gap: 0.5rem;">${Icons.get('alert-circle', 18)} Protocolos en Ejecución</h3>
        </div>
        <div class="card-body">
          <p class="text-secondary mb-4">Estudiantes que actualmente tienen un protocolo activo sin finalizar.</p>
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Estudiante</th>
                  <th>Curso</th>
                  <th>Protocolo Activo</th>
                  <th style="text-align: right;">Acciones</th>
                </tr>
              </thead>
              <tbody>
    `;

    if (protocolosEnProceso.length === 0) {
      html += `<tr><td colspan="4" class="text-center py-4 text-muted">No hay protocolos en ejecución actualmente.</td></tr>`;
    } else {
      protocolosEnProceso.forEach(p => {
        const e = estudiantes.find(est => est.id === p.estudiante_id);
        if(!e) return;
        const curso = (typeof DATA !== 'undefined' && DATA.getCurso ? DATA.getCurso(e.curso) : null) ? DATA.getCurso(e.curso).nombre : 'Sin curso';
        let conf = (typeof DATA !== 'undefined' && DATA.protocolos_checklists ? DATA.protocolos_checklists[p.tipo_protocolo] : undefined);
        let protoNombre = conf ? conf.titulo : (p.tipo_protocolo || 'Protocolo Complejo');
        protoNombre = protoNombre.replace(/^Protocolo\s*\d+\s*[\u2014\-]\s*/i, '').split('—')[0].trim();

        const badgeProtocolo = `<span class="badge badge-warning" style="background: var(--danger); color: white;">${Storage.safeHtml(protoNombre)}</span>`;
        
        html += `
          <tr>
            <td style="font-weight: bold; text-transform: capitalize;">${e.nombres} ${e.apellidos}</td>
            <td><span class="badge badge-primary">${curso}</span></td>
            <td>${badgeProtocolo}</td>
            <td style="text-align: right; white-space: nowrap;">
              <a href="#/estudiantes/${e.id}" class="btn btn-sm" style="background: var(--bg-hover); color: var(--text-primary); border: 1px solid var(--border-color);">
                🔍 Ver Ficha
              </a>
            </td>
          </tr>
        `;
      });
    }

    html += `
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    html += `
      <div class="card">
        <div class="card-header" style="background: var(--success); color: white;">
          <h3 class="card-title" style="margin: 0; display: inline-flex; align-items: center; gap: 0.5rem;">${Icons.get('check-circle-2', 18)} Protocolos Completados</h3>
        </div>
        <div class="card-body">
          <p class="text-secondary mb-4">Protocolos finalizados (Casos Graves generados).</p>
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Estudiante</th>
                  <th>Curso</th>
                  <th>Protocolo Finalizado</th>
                  <th>Fecha Cierre</th>
                </tr>
              </thead>
              <tbody>
    `;

    if (protocolosCompletados.length === 0) {
      html += `<tr><td colspan="4" class="text-center py-4 text-muted">No hay protocolos completados aún.</td></tr>`;
    } else {
      protocolosCompletados.forEach(p => {
        const e = estudiantes.find(est => est.id === p.estudiante_id);
        if(!e) return;
        const curso = (typeof DATA !== 'undefined' && DATA.getCurso ? DATA.getCurso(e.curso) : null) ? DATA.getCurso(e.curso).nombre : 'Sin curso';
        let conf = (typeof DATA !== 'undefined' && DATA.protocolos_checklists ? DATA.protocolos_checklists[p.tipo_protocolo] : undefined);
        let protoNombre = conf ? conf.titulo : (p.tipo_protocolo || 'Protocolo Complejo');
        protoNombre = protoNombre.replace(/^Protocolo\s*\d+\s*[\u2014\-]\s*/i, '').split('—')[0].trim();

        const badgeProtocolo = `<span class="badge badge-success" style="background: var(--success); color: white;">${Storage.safeHtml(protoNombre)}</span>`;
        const fecha = p.fecha_cierre ? new Date(p.fecha_cierre).toLocaleDateString('es-CL') : 'N/A';
        html += `
          <tr>
            <td style="font-weight: bold; text-transform: capitalize;">${e.nombres} ${e.apellidos}</td>
            <td><span class="badge badge-primary">${curso}</span></td>
            <td>${badgeProtocolo}</td>
            <td>${fecha}</td>
          </tr>
        `;
      });
    }

    html += `
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    if (!container) return;
    container.innerHTML = html;
  }

  return {
    render
  };
})();

window.ConvivenciaView = ConvivenciaView;
