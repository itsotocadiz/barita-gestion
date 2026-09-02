/* ================================================================
   pie.js — Módulo PIE
   Muestra estudiantes con NEE, adaptaciones y progreso.
   Usa BaritaSkillsGestion.SkillPIE.
   ================================================================ */

const PieView = (() => {
  function render(container) {
    App.setBreadcrumb('PIE');
    const estudiantes = (typeof Storage !== 'undefined' && Storage.getEstudiantes) ? Storage.getEstudiantes() : [];
    
    // 1. Integración Automática: Todo estudiante con esEstudiantePIE = true o NEE/adaptaciones/paci
    const pieStudents = estudiantes.filter(e => {
      if (!e) return false;
      const necesidades = Array.isArray(e.necesidades) ? e.necesidades : [];
      const adaptaciones = Array.isArray(e.adaptaciones) ? e.adaptaciones : [];
      return e.esEstudiantePIE === true || e.medidasPie === true || necesidades.length > 0 || adaptaciones.length > 0 || (typeof e.paci === 'boolean' && e.paci);
    });

    // 2. Tarjeta de Alertas Conductuales PIE: Filtro esEstudiantePIE=true Y (Semáforo Amarillo o Rojo)
    const pieConAlerta = pieStudents.filter(e => {
      let color = 'verde';
      if (window.RICEEngine && typeof window.RICEEngine.evaluarEstudiante === 'function') {
        const evalRes = window.RICEEngine.evaluarEstudiante(e.id);
        color = evalRes ? evalRes.color : 'verde';
      }
      return color === 'amarillo' || color === 'rojo' || e.enSeguimiento || e.compromisoEstado === 'incumplido';
    });

    let alertasConductualesHtml = '';
    if (pieConAlerta.length > 0) {
      const itemsHtml = pieConAlerta.map(e => {
        const cursoObj = (typeof DATA !== 'undefined' && typeof DATA.getCurso === 'function') ? DATA.getCurso(e.curso) : null;
        const cursoNombre = cursoObj ? cursoObj.nombre : (e.curso || 'Sin curso');
        
        let evalRes = { badgeHtml: '<span class="badge" style="background:#10b981; color:white;">🟢 Semáforo Verde</span>' };
        if (window.RICEEngine && typeof window.RICEEngine.evaluarEstudiante === 'function') {
          evalRes = window.RICEEngine.evaluarEstudiante(e.id);
        }

        let ultimaFechaAlerta = e.fechaProximoSeguimiento || e.compromisoFechaTermino || 'Sin fecha';
        if (Array.isArray(e.bitacoraSeguimiento) && e.bitacoraSeguimiento.length > 0) {
          const ultBit = e.bitacoraSeguimiento[0];
          if (ultBit && ultBit.fecha) {
            const parts = ultBit.fecha.substring(0, 10).split('-');
            if (parts.length === 3) ultimaFechaAlerta = `${parts[2]}/${parts[1]}/${parts[0]}`;
          }
        }

        return `
          <div style="background: #fff; border: 2px solid #f59e0b; border-radius: 8px; padding: 0.85rem 1rem; margin-bottom: 0.75rem; box-shadow: 0 2px 4px rgba(245, 158, 11, 0.12); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div style="flex: 1; min-width: 240px;">
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                <strong style="color: #1e293b; font-size: 0.95rem;">${e.nombres} ${e.apellidos}</strong>
                <span class="badge inline-flex items-center gap-1" style="background: #0ea5e9; color: white; font-weight: 600; font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 10px;">${Icons.get('puzzle', 12)} PIE</span>
                <span style="font-size: 0.8rem; color: #64748b; background: #f1f5f9; padding: 0.1rem 0.4rem; border-radius: 4px;">${cursoNombre}</span>
              </div>
              <div style="font-size: 0.85rem; color: #475569; display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.2rem;">
                <span>Semáforo: ${evalRes.badgeHtml}</span>
                <span>Última Alerta: <b>${ultimaFechaAlerta}</b></span>
              </div>
            </div>
            <div>
              <a href="#/estudiantes/${e.id}" class="btn btn-sm btn-primary inline-flex items-center gap-1" style="font-weight: 600; padding: 0.4rem 0.85rem; font-size: 0.85rem;">${Icons.get('eye', 14)} Ver Ficha</a>
            </div>
          </div>
        `;
      }).join('');

      alertasConductualesHtml = `
        <details class="card mb-3" style="border: 1px solid #fde68a; border-left: 5px solid #f59e0b; background: #fffbeb; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.04); transition: all 0.3s ease;">
          <summary style="cursor: pointer; padding: 0.85rem 1.25rem; display: flex; align-items: center; justify-content: space-between; user-select: none; list-style: none;" class="card-header">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1rem; color: #b45309; font-weight: 700;">▶</span>
              <h3 style="margin: 0; color: #b45309; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">
                ${Icons.get('alert-triangle', 18)} Estudiantes PIE con Alerta Conductual / RICE
              </h3>
            </div>
            <span class="badge" style="background: #f59e0b; color: white; font-weight: 700; font-size: 0.8rem; padding: 0.25rem 0.6rem; border-radius: 12px;">
              ${pieConAlerta.length} ${pieConAlerta.length === 1 ? 'Estudiante' : 'Estudiantes'}
            </span>
          </summary>
          <div class="card-body" style="padding: 1rem 1.25rem 1.25rem; border-top: 1px solid #fde68a; background: #fff;">
            ${itemsHtml}
          </div>
        </details>
      `;
    }

    const rows = pieStudents.length === 0
      ? '<tr><td colspan="4" class="text-center text-muted py-4">No hay estudiantes con PIE registrados.</td></tr>'
      : pieStudents.map(e => {
          const skill = (typeof BaritaSkillsGestion !== 'undefined' && BaritaSkillsGestion.SkillPIE)
            ? BaritaSkillsGestion.SkillPIE.armarPerfilNEE(e)
            : null;
          const nombre = skill ? skill.nombre : `${e.nombres || ''} ${e.apellidos || ''}`.trim();
          const necesidades = (skill && skill.necesidades && skill.necesidades.length > 0) ? skill.necesidades.join(', ') : 'Apoyo Especializado PIE';
          let progresoVal = 0;
          if (typeof EstudiantesView !== 'undefined' && typeof EstudiantesView.calcularProgresoPACI === 'function') {
            progresoVal = EstudiantesView.calcularProgresoPACI(e);
          } else if (Array.isArray(e.metasPACI) && e.metasPACI.length > 0) {
            const comp = e.metasPACI.filter(m => m && m.completada).length;
            progresoVal = Math.round((comp / e.metasPACI.length) * 100);
          }

          let badgeBg = '#64748b';
          if (progresoVal === 100) badgeBg = '#10b981';
          else if (progresoVal >= 50) badgeBg = '#0ea5e9';
          else if (progresoVal > 0) badgeBg = '#f59e0b';

          const badgeProgresoHtml = `
            <div style="display: flex; align-items: center; gap: 0.5rem; justify-content: center;">
              <span class="badge" style="background: ${badgeBg}; color: white; font-weight: 700; font-size: 0.8rem; padding: 0.2rem 0.55rem; border-radius: 10px;">${progresoVal}%</span>
            </div>
          `;

          return `
            <tr>
              <td style="padding:1rem; vertical-align:middle;">
                <b>${nombre}</b>
                <span class="badge inline-flex items-center gap-1" style="background: #0ea5e9; color: white; margin-left: 0.35rem; font-size: 0.75rem;">${Icons.get('puzzle', 12)} PIE</span>
              </td>
              <td style="padding:1rem; vertical-align:middle;">${necesidades}</td>
              <td style="padding:1rem; vertical-align:middle; text-align:center;">${badgeProgresoHtml}</td>
              <td style="padding:1rem; vertical-align:middle; text-align:center;">
                <a href="#/estudiantes/${e.id}" class="btn btn-sm btn-secondary" style="font-weight: 600;">Ver Ficha</a>
              </td>
            </tr>
          `;
        }).join('');

    const estudiantesPsico = (typeof Storage !== 'undefined' && Storage.getEstudiantes) ? Storage.getEstudiantes() : [];
    const psicosocialStudents = estudiantesPsico.filter(e => e.requiereApoyoPsicosocial);
    
    let psicosocialHtml = '';
    if (psicosocialStudents.length > 0) {
      const rowsPsicosocial = psicosocialStudents.map(e => `
        <tr>
          <td style="padding:1rem; vertical-align:middle;">
            <b>${e.nombres} ${e.apellidos}</b>
            ${e.esEstudiantePIE ? `<span class="badge inline-flex items-center gap-1" style="background: #0ea5e9; color: white; margin-left: 0.35rem; font-size: 0.75rem;">${Icons.get('puzzle', 12)} PIE</span>` : ''}
          </td>
          <td style="padding:1rem; vertical-align:middle; text-align:center;">
            <a href="#/estudiantes/${e.id}" class="btn btn-sm btn-primary inline-flex items-center gap-1">${Icons.get('eye', 14)} Ir a Perfil</a>
          </td>
        </tr>
      `).join('');

      psicosocialHtml = `
        <details class="card mb-3" style="border: 1px solid #ddd6fe; border-left: 5px solid #8b5cf6; background: #f5f3ff; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.04); transition: all 0.3s ease;">
          <summary style="cursor: pointer; padding: 0.85rem 1.25rem; display: flex; align-items: center; justify-content: space-between; user-select: none; list-style: none;" class="card-header">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1rem; color: #7c3aed; font-weight: 700;">▶</span>
              <h3 style="margin: 0; color: #6d28d9; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">
                ${Icons.get('shield', 18)} Requieren Apoyo Psicosocial
              </h3>
            </div>
            <span class="badge" style="background: #8b5cf6; color: white; font-weight: 700; font-size: 0.8rem; padding: 0.25rem 0.6rem; border-radius: 12px;">
              ${psicosocialStudents.length} ${psicosocialStudents.length === 1 ? 'Estudiante' : 'Estudiantes'}
            </span>
          </summary>
          <div class="card-body" style="padding: 1rem 1.25rem 1.25rem; border-top: 1px solid #ddd6fe; background: #fff;">
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>Estudiante</th>
                    <th style="width:140px; text-align:center;">Acción</th>
                  </tr>
                </thead>
                <tbody>${rowsPsicosocial}</tbody>
              </table>
            </div>
          </div>
        </details>
      `;
    }

    container.innerHTML = `
      <div class="card mb-4" style="border-top: 4px solid var(--primary);">
        <div class="card-header">
          <h2 style="margin:0; color: var(--primary); display: inline-flex; align-items: center; gap: 0.5rem;">${Icons.get('graduation-cap', 22)} PIE - Estudiantes con Necesidades Educativas Especiales ${typeof BaritaHelp!=='undefined'?BaritaHelp.create('pie'):''}</h2>
        </div>
      </div>

      ${alertasConductualesHtml}

      <details class="card mb-4" style="border: 1px solid #bae6fd; border-left: 5px solid #0ea5e9; background: #f0f9ff; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.04); transition: all 0.3s ease;">
        <summary style="cursor: pointer; padding: 0.85rem 1.25rem; display: flex; align-items: center; justify-content: space-between; user-select: none; list-style: none;" class="card-header">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 1rem; color: #0284c7; font-weight: 700;">▶</span>
            <h3 style="margin: 0; color: #0369a1; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">
              ${Icons.get('puzzle', 18)} Listado Oficial de Estudiantes PIE
            </h3>
          </div>
          <span class="badge" style="background: #0ea5e9; color: white; font-weight: 700; font-size: 0.8rem; padding: 0.25rem 0.6rem; border-radius: 12px;">
            ${pieStudents.length} ${pieStudents.length === 1 ? 'Estudiante' : 'Estudiantes'}
          </span>
        </summary>
        <div class="card-body" style="padding: 1rem 1.25rem 1.25rem; border-top: 1px solid #bae6fd; background: #fff;">
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Necesidades / Adaptaciones</th>
                  <th style="width:120px; text-align:center;">Progreso</th>
                  <th style="width:140px; text-align:center;">Acción</th>
                </tr>
              </thead>
              <tbody id="tbody-pie">${rows}</tbody>
            </table>
          </div>
        </div>
      </details>

      ${psicosocialHtml}
    `;
  }

  function verFicha(id) {
    const e = (typeof Storage !== 'undefined' && Storage.getEstudianteById) ? Storage.getEstudianteById(id) : null;
    if (!e) return;
    const skill = (typeof BaritaSkillsGestion !== 'undefined' && BaritaSkillsGestion.SkillPIE)
      ? BaritaSkillsGestion.SkillPIE.armarPerfilNEE(e)
      : null;
    const nombre = skill ? skill.nombre : `${e.nombres || ''} ${e.apellidos || ''}`.trim();
    const necesidades = (skill && skill.necesidades) ? skill.necesidades.join('<br>- ') : '-';
    const adaptaciones = (skill && skill.adaptaciones) ? skill.adaptaciones.join('<br>- ') : '-';
    const progreso = (skill && typeof skill.progreso === 'number') ? `${skill.progreso}%` : '-';

    const body = `
      <div style="display:flex; flex-direction:column; gap:1rem;">
        <div><b>Nombre:</b> ${nombre}</div>
        <div><b>Necesidades:</b><br>- ${necesidades}</div>
        <div><b>Adaptaciones:</b><br>- ${adaptaciones}</div>
        <div><b>Progreso PIE:</b> ${progreso}</div>
      </div>
    `;
    App.openModal('Ficha PIE', body);
  }

  return {
    render,
    verFicha
  };
})();

window.PieView = PieView;
