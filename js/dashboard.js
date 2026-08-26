/* ================================================================
   dashboard.js — Motor de Dashboards Simplificado
   Renderiza tabs por menú configurado, sin widgets complejos
   ================================================================ */

const DashboardView = (() => {
  const CATEGORIAS_ALERTAS = [
    { key: 'seguimiento', titulo: 'Estudiante en Seguimiento', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', icon: Icons.get('search', 18) },
    { key: 'complejo', titulo: 'Estudiante Complejo (Protocolos Aplicados)', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: Icons.get('alert-triangle', 18) },
    { key: 'apoyo_psicosocial', titulo: 'Requiere Apoyo Psicosocial', color: '#c026d3', bg: '#fdf4ff', border: '#f5d0fe', icon: Icons.get('shield', 18) },
    { key: 'plan_utp', titulo: 'Plan UTP Activo', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd', icon: Icons.get('book-open', 18) },
    { key: 'pie', titulo: 'Estudiantes PIE', color: '#0ea5e9', bg: '#f0f9ff', border: '#bae6fd', icon: Icons.get('puzzle', 18) }
  ];

  function obtenerAlertasSeguimiento() {
    const casos = (typeof Storage !== 'undefined' && typeof Storage.getCasos === 'function') ? Storage.getCasos() : [];
    const estudiantes = (typeof Storage !== 'undefined' && typeof Storage.getEstudiantes === 'function') ? Storage.getEstudiantes() : [];

    const todayStr = (typeof BARITA_hoyChileISO !== 'undefined' ? BARITA_hoyChileISO() : (()=>{ const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; })());
    // Usar rol de APLICACIÓN (userProfile.role / currentRole), NO el JWT de Supabase
    // Auth.currentUser.role siempre es 'authenticated' en Supabase → causa falsos positivos en yaLeido
    const role = (Auth.userProfile && Auth.userProfile.role) || Auth.currentRole || (Auth.currentUser && Auth.currentUser.role) || 'profesor';
    const cleanRole = role.toLowerCase().trim();
    // FIX: alertas de seguimiento visibles para todo el equipo de gestión (no solo creador)
    const rolesConAlerta = ['superadmin','admin','inspectoria','utp','pie','convivencia','directora','coordinadora','profesor'];

    const alertasPorCategoria = {};
    CATEGORIAS_ALERTAS.forEach(c => alertasPorCategoria[c.key] = []);

    // 1. Procesar Casos de Seguimiento
    casos.forEach(caso => {
      if (!caso || caso.estado === 'cerrado') return;

      // Omitir si ya fue marcado como leído por el rol actual (local por rol, no bitácora)
      const primerEstIdTmp = (caso.estudiantesInvolucrados && caso.estudiantesInvolucrados[0]) ? caso.estudiantesInvolucrados[0] : (caso.estudianteId || caso.estudiante_id || '');
      const keyTmp = `barita_alerta_leida_${caso.id}_${primerEstIdTmp}_${cleanRole}`;
      let yaLeidoLocal = false; try{ yaLeidoLocal = localStorage.getItem(keyTmp)==='true'; }catch(_e){}
      const yaLeidoLegacy = Array.isArray(caso.seguimiento) && caso.seguimiento.some(s => s && s.is_seen_confirm && String(s.role).toLowerCase().trim() === cleanRole);
      if (yaLeidoLocal || yaLeidoLegacy) return;

      let tipoKey = caso.tipo || 'seguimiento';
      if (!alertasPorCategoria[tipoKey]) tipoKey = 'seguimiento';

      const seguimientos = Array.isArray(caso.seguimiento) ? caso.seguimiento : [];
      
      // Determinar la fecha agendada para la alerta (prioridad a fechaProximoSeguimiento / proximoSeguimiento)
      const fechasAProcesar = [];

      seguimientos.forEach(seg => {
        if (seg && seg.is_seen_confirm) return;
        const rawDate = seg.fechaProximoSeguimiento || seg.fechaProximo || caso.proximoSeguimiento || caso.fechaProximoSeguimiento || seg.fecha;
        if (rawDate) {
          fechasAProcesar.push({
            rawDate,
            segTexto: seg.texto || seg.observacion || ''
          });
        }
      });

      if (fechasAProcesar.length === 0 && (caso.proximoSeguimiento || caso.fechaProximoSeguimiento || caso.fecha)) {
        fechasAProcesar.push({
          rawDate: caso.proximoSeguimiento || caso.fechaProximoSeguimiento || caso.fecha,
          segTexto: caso.descripcion || caso.titulo || ''
        });
      }

      fechasAProcesar.forEach(item => {
        let segDateObj = null;
        if (typeof item.rawDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(item.rawDate.trim())) {
          const parts = item.rawDate.trim().substring(0, 10).split('-').map(Number);
          segDateObj = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
        } else {
          segDateObj = new Date(item.rawDate);
        }
        if (isNaN(segDateObj.getTime())) {
          // Intentar parsear YYYY-MM-DD local
          const parts = String(item.rawDate).split('-');
          if (parts.length === 3) {
            segDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          }
        }
        if (isNaN(segDateObj.getTime())) return;
        const segDateStr = `${segDateObj.getFullYear()}-${String(segDateObj.getMonth() + 1).padStart(2, '0')}-${String(segDateObj.getDate()).padStart(2, '0')}`;
        if (segDateStr > todayStr) return;

        const isToday = segDateStr === todayStr;
        const isOverdue = segDateStr < todayStr;

        let listaEsts = [];
        if (Array.isArray(caso.estudiantesInvolucrados) && caso.estudiantesInvolucrados.length > 0) {
          listaEsts = caso.estudiantesInvolucrados.map(id => Storage.getEstudianteById(id)).filter(Boolean);
        }
        if (listaEsts.length === 0 && (caso.estudianteId || caso.estudiante_id || caso.estudiante_id_ref)) {
          const e = Storage.getEstudianteById(caso.estudianteId || caso.estudiante_id || caso.estudiante_id_ref);
          if (e) listaEsts.push(e);
          // Filtro de consistencia relajado: Si el caso existe físicamente en la BD, se muestra independientemente del cache del estudiante
          if (listaEsts.length > 0) {
            listaEsts = listaEsts.filter(e => {
              // Si el caso está activo, no lo ocultamos por retraso de caché del flag local del estudiante
              return true;
            });
            if (listaEsts.length === 0) return;
          }
        }

        let estNombre = 'Estudiante asignado';
        let cursoNombre = 'Sin curso';

        if (listaEsts.length > 0) {
          estNombre = listaEsts.map(e => `${e.nombres} ${e.apellidos}`).join(', ');
          cursoNombre = listaEsts.map(e => {
            const c = (typeof DATA !== 'undefined' && typeof DATA.getCurso === 'function') ? DATA.getCurso(e.curso) : null;
            return c ? c.nombre : (e.curso || 'Sin curso');
          }).join(', ');
        } else if (caso.estudianteNombre || caso.estudiante_nombre || caso.nombreEstudiante) {
          estNombre = caso.estudianteNombre || caso.estudiante_nombre || caso.nombreEstudiante;
          cursoNombre = caso.curso || caso.cursoNombre || 'Sin curso';
        }

        const horaStr = (segDateObj.getHours() !== 0 || segDateObj.getMinutes() !== 0) 
          ? segDateObj.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) 
          : 'Horario Escolar';
        const fechaFormateada = segDateObj.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

        const primerEstId = listaEsts.length > 0 ? listaEsts[0].id : (caso.estudianteId || caso.estudiante_id || null);

        alertasPorCategoria[tipoKey].push({
          casoId: caso.id,
          estudianteId: primerEstId,
          tituloCaso: caso.titulo || 'Caso en Seguimiento',
          estNombre,
          cursoNombre,
          fechaStr: segDateStr,
          fechaFormateada,
          horaStr,
          isToday,
          isOverdue,
          textoSeguimiento: item.segTexto,
          timestamp: segDateObj.getTime()
        });
      });
    });

    // 2. Procesar Estudiantes con flags directos y fechaProximoSeguimiento
    estudiantes.forEach(est => {
      if (!est) return;
      
      // Omitir si ya fue marcado como leído por el rol actual (local, no bitácora)
      const keyEst = `barita_alerta_leida_est_${est.id}_${est.id}_${cleanRole}`;
      let yaLeidoLocalEst = false; try{ yaLeidoLocalEst = localStorage.getItem(keyEst)==='true'; }catch(_e){}
      const yaLeidoLegacyEst = Array.isArray(est.bitacoraSeguimiento) && est.bitacoraSeguimiento.some(b => b && b.is_seen_confirm && String(b.role).toLowerCase().trim() === cleanRole);
      if (yaLeidoLocalEst || yaLeidoLegacyEst) return;

      const categorias = [];
      if (est.enSeguimiento) categorias.push('seguimiento');
      if (est.esComplejo) categorias.push('complejo');
      if (est.requiereApoyoPsicosocial) categorias.push('apoyo_psicosocial');
      if (est.planUtpActivo) categorias.push('plan_utp');
      if (est.esEstudiantePIE || est.medidasPie) categorias.push('pie');
      
      if (categorias.length === 0) return;

      // Solo fecha directa del estudiante (no bitácora antigua) — evita que cierre vuelva a aparecer por registro viejo
      let proximaFecha = est.fechaProximoSeguimiento || est.fechaProximo || null;

      if (!proximaFecha || proximaFecha === 'null' || proximaFecha === 'undefined') return;
      const parsedTime = new Date(proximaFecha).getTime();
      if (isNaN(parsedTime) || parsedTime === 0) return;

      // Normalizar proximaFecha evitando desfasaje por zona horaria UTC
      let ymdProximo = '';
      if (typeof proximaFecha === 'string' && /^\d{4}-\d{2}-\d{2}/.test(proximaFecha)) {
        ymdProximo = proximaFecha.substring(0, 10);
      } else {
        const dTmp = new Date(proximaFecha);
        if (!isNaN(dTmp.getTime())) {
          ymdProximo = `${dTmp.getFullYear()}-${String(dTmp.getMonth() + 1).padStart(2, '0')}-${String(dTmp.getDate()).padStart(2, '0')}`;
        }
      }

      if (!ymdProximo || ymdProximo > todayStr) return;

      const parts = ymdProximo.split('-').map(Number);
      const segDateObj = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);

      const segDateStr = ymdProximo;
      const isToday = segDateStr === todayStr;
      const isOverdue = segDateStr < todayStr;
      const cursoObj = (typeof DATA !== 'undefined' && typeof DATA.getCurso === 'function') ? DATA.getCurso(est.curso) : null;
      const cursoNombre = cursoObj ? cursoObj.nombre : (est.curso || 'Sin curso');
      const estNombre = `${est.nombres} ${est.apellidos}`;
      const fechaFormateada = segDateObj.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

      categorias.forEach(tipoKey => {
        if (!alertasPorCategoria[tipoKey]) alertasPorCategoria[tipoKey] = [];
        // Evitar duplicados si ya fue añadido por un caso activo
        const yaExiste = alertasPorCategoria[tipoKey].some(a => a.estudianteId === est.id && a.fechaStr === segDateStr);
        if (!yaExiste) {
          alertasPorCategoria[tipoKey].push({
            casoId: 'est_' + est.id,
            estudianteId: est.id,
            tituloCaso: 'Seguimiento Programado',
            estNombre,
            cursoNombre,
            fechaStr: segDateStr,
            fechaFormateada,
            horaStr: 'Horario Escolar',
            isToday,
            isOverdue,
            textoSeguimiento: 'Fecha de próximo seguimiento agendada en la ficha.',
            timestamp: segDateObj.getTime()
          });
        }
      });
    });

    CATEGORIAS_ALERTAS.forEach(c => {
      alertasPorCategoria[c.key].sort((a, b) => {
        if (a.isToday && !b.isToday) return -1;
        if (!a.isToday && b.isToday) return 1;
        return a.timestamp - b.timestamp;
      });
    });
    return alertasPorCategoria;
  }

  function renderAlertasSeguimientoVencidasHTML() {
    const alertas = obtenerAlertasSeguimiento();
    let totalVencidos = [];
    CATEGORIAS_ALERTAS.forEach(cat => {
      const items = alertas[cat.key] || [];
      const vencidos = items.filter(i => i.isOverdue);
      vencidos.forEach(item => {
        totalVencidos.push({ ...item, categoryColor: cat.color, categoryIcon: cat.icon, categoryTitle: cat.titulo });
      });
    });

    if (totalVencidos.length === 0) return '';

    totalVencidos.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    let html = `
      <div class="card mb-3" style="border: 2px solid var(--badge-danger-border); border-left: 6px solid var(--badge-danger-text); background: var(--badge-danger-bg); border-radius: var(--radius-lg); padding: 1rem 1.25rem; box-shadow: var(--shadow-card); margin-bottom: 1.25rem;">
        <div style="display: flex; align-items: center; gap: 0.85rem; margin-bottom: 0.75rem;">
          <div style="display: flex; align-items: center; justify-content: center; background: var(--badge-danger-bg); padding: 0.5rem; border-radius: var(--radius-md); border: 1px solid var(--badge-danger-border); color: var(--badge-danger-text);">${Icons.get('alert-triangle', 22)}</div>
          <div>
            <h4 style="margin: 0; color: var(--badge-danger-text); font-size: 1.1rem; font-weight: var(--font-weight-title); display: flex; align-items: center; gap: 0.5rem;">
              Seguimientos Vencidos (Pendientes de días anteriores)
              <span class="badge" style="background: var(--badge-danger-text); color: var(--text-inverse); font-weight: 700; font-size: 0.8rem; padding: 0.2rem 0.55rem; border-radius: 4px;">${totalVencidos.length} Pendiente${totalVencidos.length === 1 ? '' : 's'}</span>
            </h4>
            <p style="margin: 2px 0 0 0; color: var(--badge-danger-text); font-size: 0.85rem;">Por favor, realiza el seguimiento o cierra estos casos para ponerte al día.</p>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
    `;

    totalVencidos.forEach(item => {
      const targetUrl = item.estudianteId ? `#/estudiantes/${item.estudianteId}` : `#/casos/${item.casoId}`;
      const uniqueDomId = `alerta-vencido-${item.casoId}-${item.estudianteId || ''}`;
      html += `
        <div id="${uniqueDomId}" style="background: var(--bg-card); border: 1px solid var(--badge-danger-border); border-radius: var(--radius-md); padding: 0.75rem 1rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; transition: all 0.35s ease;">
          <div>
            <div style="display: flex; align-items: center; flex-wrap: wrap;">
              <span class="badge" style="background: var(--badge-danger-bg); color: var(--badge-danger-text); border: 1px solid var(--badge-danger-border); font-size: 0.75rem; font-weight: 700; padding: 1px 5px; border-radius: 3px; margin-right: 0.5rem;">VENCIDO • ${item.fechaFormateada}</span>
              <strong style="color: var(--text-primary); font-size: 0.95rem;">${item.estNombre}</strong>
              <span style="font-size: 0.8rem; color: var(--text-secondary); background: var(--bg-hover); padding: 0.1rem 0.4rem; border-radius: 4px; margin-left: 0.5rem;">${item.cursoNombre}</span>
            </div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 600; margin-top: 4px;">
              <span>${item.categoryIcon}</span> [${item.categoryTitle}] ${item.tituloCaso}
            </div>
            ${item.textoSeguimiento ? `<div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.2rem; font-style: italic;">"${item.textoSeguimiento}"</div>` : ''}
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            ${canExecuteAlta() ? `
              <button class="btn btn-sm" onclick="window.DashboardView.abrirQuickSeguimiento('${item.casoId}', '${item.estudianteId}', '${item.tituloCaso.replace(/'/g, "\\'")}', '${item.estNombre.replace(/'/g, "\\'")}')" style="font-weight: 600; padding: 0.45rem 0.95rem; font-size: 0.85rem; background: var(--badge-success-text); color: var(--text-inverse); border: 1px solid var(--badge-success-border);">${Icons.get('check', 14)} Registrar Seguimiento</button>
            ` : ''}
            <button class="btn btn-sm btn-info inline-flex items-center gap-1" onclick="window.DashboardView.marcarAlertaComoLeida('${item.casoId}', '${item.estudianteId}', 'seguimiento')" style="font-weight: 600; padding: 0.45rem 0.95rem; font-size: 0.85rem; border: none; background: var(--primary); color: white;">${Icons.get('eye', 14)} Marcar como Leído</button>
            <a href="${targetUrl}" class="btn btn-sm btn-secondary" style="font-weight: 600; padding: 0.45rem 0.95rem; font-size: 0.85rem; text-decoration: none;">Ficha</a>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
    return html;
  }

  function renderAlertasSeguimientoHTML() {
    const alertas = obtenerAlertasSeguimiento();
    let htmlTotal = '';

    CATEGORIAS_ALERTAS.forEach(cat => {
      const items = alertas[cat.key] || [];
      const hoyItems = items.filter(i => i.isToday);
      if (hoyItems.length === 0) return;

      hoyItems.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

      let itemsHtml = '';

      itemsHtml += `
        <div style="background: #ef4444; color: white; padding: 0.4rem 0.75rem; border-radius: 6px; font-weight: 700; font-size: 0.825rem; display: inline-flex; align-items: center; gap: 0.4rem; margin-bottom: 0.75rem; animation: pulse 2s infinite;">
          <span style="display: inline-flex; align-items: center; gap: 0.35rem;">${Icons.get('bell', 14)} SEGUIMIENTOS PROGRAMADOS PARA HOY (${hoyItems.length})</span>
        </div>
      `;

      hoyItems.forEach(item => {
        const targetUrl = item.estudianteId ? `#/estudiantes/${item.estudianteId}` : `#/casos/${item.casoId}`;
        const uniqueDomId = `alerta-hoy-${item.casoId}-${item.estudianteId || ''}`;
        itemsHtml += `
          <div id="${uniqueDomId}" style="background: #fff; border: 2px solid #ef4444; border-radius: 8px; padding: 0.85rem 1rem; margin-bottom: 0.75rem; box-shadow: 0 2px 4px rgba(239, 68, 68, 0.15); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; transition: all 0.35s ease;">
            <div style="flex: 1; min-width: 240px;">
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                <span class="badge" style="background: #ef4444; color: white; font-weight: 700; font-size: 0.75rem; padding: 0.2rem 0.5rem;">HOY • ${item.horaStr}</span>
                <strong style="color: #1e293b; font-size: 0.95rem;">${item.estNombre}</strong>
                <span style="font-size: 0.8rem; color: #64748b; background: #f1f5f9; padding: 0.1rem 0.4rem; border-radius: 4px;">${item.cursoNombre}</span>
              </div>
              <div style="font-size: 0.85rem; color: #334155; font-weight: 600;">📋 ${item.tituloCaso}</div>
              ${item.textoSeguimiento ? `<div style="font-size: 0.8rem; color: #64748b; margin-top: 0.2rem; font-style: italic;">"${item.textoSeguimiento}"</div>` : ''}
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              ${canExecuteAlta() ? `
                <button class="btn btn-sm btn-success inline-flex items-center gap-1" onclick="window.DashboardView.abrirQuickSeguimiento('${item.casoId}', '${item.estudianteId}', '${item.tituloCaso.replace(/'/g, "\\'")}', '${item.estNombre.replace(/'/g, "\\'")}')" style="font-weight: 600; padding: 0.45rem 0.95rem; font-size: 0.85rem; border: none; background: #10b981; color: white;">${Icons.get('check', 14)} Registrar Seguimiento</button>
              ` : ''}
              <button class="btn btn-sm btn-info inline-flex items-center gap-1" onclick="window.DashboardView.marcarAlertaComoLeida('${item.casoId}', '${item.estudianteId}', 'seguimiento')" style="font-weight: 600; padding: 0.45rem 0.95rem; font-size: 0.85rem; border: none; background: var(--primary); color: white;">${Icons.get('eye', 14)} Marcar como Leído</button>
              <a href="${targetUrl}" class="btn btn-sm btn-outline-secondary" style="font-weight: 600; padding: 0.45rem 0.95rem; font-size: 0.85rem; text-decoration: none;">Ficha</a>
            </div>
          </div>
        `;
      });

      htmlTotal += `
        <details class="card mb-3" style="border: 1px solid ${cat.border}; border-left: 5px solid ${cat.color}; background: ${cat.bg}; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.04); transition: all 0.3s ease;">
          <summary style="cursor: pointer; padding: 0.85rem 1.25rem; display: flex; align-items: center; justify-content: space-between; user-select: none; list-style: none;" class="card-header">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              ${cat.key === 'plan_utp' ? '' : `<span style="font-size: 1rem; color: ${cat.color}; font-weight: 700;">▶</span>`}
              <h3 style="margin: 0; color: ${cat.color}; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">
                <span>${cat.icon}</span> ${cat.titulo} (Hoy)
              </h3>
            </div>
            <span class="badge" style="background: ${cat.color}; color: white; font-weight: 700; font-size: 0.8rem; padding: 0.25rem 0.6rem; border-radius: 12px;">
              ${hoyItems.length} ${hoyItems.length === 1 ? 'Registro' : 'Registros'}
            </span>
          </summary>
          <div class="card-body" style="padding: 1rem 1.25rem 1.25rem; border-top: 1px solid ${cat.border}; background: #fff;">
            ${itemsHtml}
          </div>
        </details>
      `;
    });

    return htmlTotal;
  }

  function obtenerAlertasPermisosFuncionarios() {
    const acciones = (typeof Storage !== 'undefined' && typeof Storage.getAcciones === 'function') ? Storage.getAcciones() : [];
    const funcionarios = (typeof Storage !== 'undefined' && Storage.cache && Storage.cache.funcionarios) ? Storage.cache.funcionarios : [];

    if (acciones.length === 0) return [];

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const permisosList = [];

    acciones.forEach(acc => {
      if (!acc || acc.tipo !== 'permiso' || !acc.fecha) return;

      let dateObj = null;
      if (typeof acc.fecha === 'string' && /^\d{4}-\d{2}-\d{2}/.test(acc.fecha.trim())) {
        const parts = acc.fecha.trim().substring(0, 10).split('-').map(Number);
        dateObj = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
      } else {
        dateObj = new Date(acc.fecha);
      }
      if (isNaN(dateObj.getTime())) {
        const parts = String(acc.fecha).split('-');
        if (parts.length === 3) {
          dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }
      }
      if (isNaN(dateObj.getTime())) return;

      const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      if (dateStr !== todayStr) return;

      const funcId = acc.funcionarioId || acc.funcionario_id;
      const func = funcionarios.find(f => String(f.id) === String(funcId));

      const funcNombre = func ? `${func.nombres} ${func.apellidos}` : (acc.funcionarioNombre || 'Funcionario');
      const cargoArea = func ? (func.cargo || func.categoria || 'Funcionario') : 'Personal Escolar';
      const fechaFormateada = dateObj.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

      let descLimpia = (acc.descripcion || '').trim();
      if (!descLimpia || descLimpia.toLowerCase().includes('registro rápido desde calendario')) {
        descLimpia = '';
      }

      permisosList.push({
        accionId: acc.id,
        funcionarioId: funcId,
        funcNombre,
        cargoArea,
        fechaStr: dateStr,
        fechaFormateada,
        isToday: true,
        descripcion: descLimpia,
        timestamp: dateObj.getTime()
      });
    });

    return permisosList;
  }

  function renderAlertasPermisosFuncionariosHTML() {
    const permisos = obtenerAlertasPermisosFuncionarios();
    if (permisos.length === 0) return '';

    const hoyItems = permisos.filter(p => p.isToday);
    if (hoyItems.length === 0) return '';

    let itemsHtml = '';

    itemsHtml += `
      <div style="background: #f59e0b; color: #78350f; padding: 0.4rem 0.75rem; border-radius: 6px; font-weight: 700; font-size: 0.825rem; display: inline-flex; align-items: center; gap: 0.4rem; margin-bottom: 0.75rem;">
        <span>${Icons.get('calendar', 16)} FUNCIONARIOS CON PERMISO HOY (${hoyItems.length})</span>
      </div>
    `;
    hoyItems.forEach(item => {
      itemsHtml += `
        <div style="background: #fff; border: 2px solid #f59e0b; border-radius: 8px; padding: 0.85rem 1rem; margin-bottom: 0.75rem; box-shadow: 0 2px 4px rgba(245, 158, 11, 0.15); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <div style="flex: 1; min-width: 240px;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
              <span class="badge" style="background: #f59e0b; color: white; font-weight: 700; font-size: 0.75rem; padding: 0.2rem 0.5rem;">HOY • PERMISO</span>
              <strong style="color: #1e293b; font-size: 0.95rem;">${item.funcNombre}</strong>
              <span style="font-size: 0.8rem; color: #64748b; background: #f1f5f9; padding: 0.1rem 0.4rem; border-radius: 4px;">${item.cargoArea}</span>
            </div>
            ${item.descripcion ? `<div style="font-size: 0.85rem; color: #475569; font-weight: 500;">📋 ${item.descripcion}</div>` : ''}
          </div>
          <div>
            <a href="#/funcionarios/${item.funcionarioId}" class="btn btn-sm btn-warning" style="font-weight: 600; padding: 0.4rem 0.85rem; font-size: 0.85rem; background: #f59e0b; border: none; color: white;">🔍 Ver Funcionario</a>
          </div>
        </div>
      `;
    });

    return `
      <details class="card mb-3" style="border: 1px solid #fef08a; border-left: 5px solid #f59e0b; background: #fffbeb; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.04); transition: all 0.3s ease;">
        <summary style="cursor: pointer; padding: 0.85rem 1.25rem; display: flex; align-items: center; justify-content: space-between; user-select: none; list-style: none;" class="card-header">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <h3 style="margin: 0; color: #b45309; font-size: 1.05rem; display: inline-flex; align-items: center; gap: 0.5rem;">
              ${Icons.get('file-text', 18)} Permisos de Funcionarios (Hoy)
            </h3>
          </div>
          <span class="badge" style="background: #f59e0b; color: white; font-weight: 700; font-size: 0.8rem; padding: 0.25rem 0.6rem; border-radius: 12px;">
            ${hoyItems.length} ${hoyItems.length === 1 ? 'Permiso' : 'Permisos'}
          </span>
        </summary>
        <div class="card-body" style="padding: 1rem 1.25rem 1.25rem; border-top: 1px solid #fef08a; background: #fff;">
          ${itemsHtml}
        </div>
      </details>
    `;
  }

  function renderAlertasCompromisosConductualesHTML() {
    const estudiantes = (typeof Storage !== 'undefined' && typeof Storage.getEstudiantes === 'function') ? Storage.getEstudiantes() : [];
    if (!estudiantes || estudiantes.length === 0) return '';

    // Usar rol de APLICACIÓN primero, no el JWT 'authenticated' de Supabase
    const role = (Auth.userProfile && Auth.userProfile.role) || Auth.currentRole || (Auth.currentUser && Auth.currentUser.role) || 'profesor';
    const cleanRole = role.toLowerCase().trim();

    const compromisosIncumplidos = [];
    const compromisosCumplidos = [];

    const todayStr = BARITA_hoyChileISO();

    estudiantes.forEach(est => {
      if (!est || !est.compromisoConductualActivo) return;
      
      let res = null;
      if (window.RICEEngine && typeof window.RICEEngine.evaluarCompromisoEstudiante === 'function') {
        res = window.RICEEngine.evaluarCompromisoEstudiante(est.id);
      } else {
        res = { estado: est.compromisoEstado || 'vigente' };
      }

      if (!res) return;

      const cursoObj = (typeof DATA !== 'undefined' && typeof DATA.getCurso === 'function') ? DATA.getCurso(est.curso) : null;
      const cursoNombre = cursoObj ? cursoObj.nombre : (est.curso || 'Sin curso');
      const estNombre = `${est.nombres} ${est.apellidos}`;

      if (res.estado === 'incumplido' && !est.compromisoDescartado) {
        const isToday = res.infraccionFecha === todayStr;
        if (isToday) {
          compromisosIncumplidos.push({ est, estNombre, cursoNombre, infraccionFecha: res.infraccionFecha || est.compromisoFechaTermino, infraccionDesc: res.infraccionDesc || 'Anotación negativa registrada', isToday: true });
        }
      } else if ((res.estado === 'cumplido' || res.estado === 'cumplido_pendiente') && !est.compromisoDescartado) {
        // Omitir si ya fue marcado como leído por el rol actual
        const yaLeido = Array.isArray(est.bitacoraSeguimiento) && est.bitacoraSeguimiento.some(b => b && b.is_seen_confirm && String(b.role).toLowerCase().trim() === cleanRole);
        if (yaLeido) return;

        compromisosCumplidos.push({ est, estNombre, cursoNombre, fechaTermino: est.compromisoFechaTermino, isToday: est.compromisoFechaTermino === todayStr });
      }
    });

    let html = '';

    const sortCompromisos = (list) => {
      return list.sort((a, b) => {
        return String(a.infraccionFecha || a.fechaTermino || '').localeCompare(String(b.infraccionFecha || b.fechaTermino || ''));
      });
    };

    if (compromisosIncumplidos.length > 0) {
      sortCompromisos(compromisosIncumplidos);
      const itemsIncumplidosHtml = compromisosIncumplidos.map(item => `
        <div id="alerta-compromiso-${item.est.id}" style="background: #fff; border: 2px solid #ef4444; border-radius: 8px; padding: 0.85rem 1rem; margin-bottom: 0.75rem; box-shadow: 0 2px 4px rgba(239, 68, 68, 0.15); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <div style="flex: 1; min-width: 240px;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
              <span class="badge" style="background: #ef4444; color: white; font-weight: 700; font-size: 0.75rem; padding: 0.2rem 0.5rem;">INCUMPLIDO HOY</span>
              <strong style="color: #1e293b; font-size: 0.95rem;">${item.estNombre}</strong>
              <span style="font-size: 0.8rem; color: #64748b; background: #f1f5f9; padding: 0.1rem 0.4rem; border-radius: 4px;">${item.cursoNombre}</span>
            </div>
            <div style="font-size: 0.85rem; color: #991b1b; font-weight: 600; display: inline-flex; align-items: center; gap: 0.25rem;">${Icons.get('alert-triangle', 14)} Infracción registrada: ${item.infraccionFecha}</div>
          </div>
          <div>
            <a href="#/estudiantes/${item.est.id}" class="btn btn-sm btn-danger inline-flex items-center gap-1" style="font-weight: 600; padding: 0.4rem 0.85rem; font-size: 0.85rem;">${Icons.get('eye', 14)} Ver Ficha</a>
            <button class="btn btn-sm btn-outline-secondary" onclick="window.DashboardView.descartarAlertaCompromiso('${item.est.id}')" style="padding: 0.35rem 0.6rem; font-size: 0.8rem; border-color: #cbd5e1;">✕</button>
          </div>
        </div>
      `).join('');

      html += `
        <details class="card mb-3" style="border: 1px solid #fca5a5; border-left: 5px solid #ef4444; background: #fef2f2; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.04); transition: all 0.3s ease;">
          <summary style="cursor: pointer; padding: 0.85rem 1.25rem; display: flex; align-items: center; justify-content: space-between; user-select: none; list-style: none;" class="card-header">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1rem; color: #991b1b; font-weight: 700;">▶</span>
              <h3 style="margin: 0; color: #991b1b; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">
                ${Icons.get('alert-triangle', 18)} Compromisos Incumplidos Hoy
              </h3>
            </div>
            <span class="badge" style="background: #ef4444; color: white; font-weight: 700; font-size: 0.8rem; padding: 0.25rem 0.6rem; border-radius: 12px;">
              ${compromisosIncumplidos.length} ${compromisosIncumplidos.length === 1 ? 'Alerta' : 'Alertas'}
            </span>
          </summary>
          <div class="card-body" style="padding: 1rem 1.25rem 1.25rem; border-top: 1px solid #fca5a5; background: #fff;">
            ${itemsIncumplidosHtml}
          </div>
        </details>
      `;
    }

    if (compromisosCumplidos.length > 0) {
      sortCompromisos(compromisosCumplidos);
      const itemsCumplidosHtml = compromisosCumplidos.map(item => {
        const badgeLabel = item.isToday ? 'CUMPLIDO HOY' : 'CUMPLIDO PENDIENTE DE ALTA';
        const descText = item.isToday ? 'Compromiso finalizado con éxito hoy.' : `Periodo de compromiso finalizado el ${item.fechaTermino || 'sin fecha'}.`;
        const uniqueDomId = `alerta-compromiso-${item.est.id}`;
        return `
          <div id="${uniqueDomId}" style="background: #fff; border: 2px solid #10b981; border-radius: 8px; padding: 0.85rem 1rem; margin-bottom: 0.75rem; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.15); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; transition: all 0.35s ease;">
            <div style="flex: 1; min-width: 240px;">
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                <span class="badge" style="background: #10b981; color: white; font-weight: 700; font-size: 0.75rem; padding: 0.2rem 0.5rem;">${badgeLabel}</span>
                <strong style="color: #1e293b; font-size: 0.95rem;">${item.estNombre}</strong>
                <span style="font-size: 0.8rem; color: #64748b; background: #f1f5f9; padding: 0.1rem 0.4rem; border-radius: 4px;">${item.cursoNombre}</span>
              </div>
              <div style="font-size: 0.85rem; color: #065f46; font-weight: 600; display: inline-flex; align-items: center; gap: 0.25rem;">${Icons.get('check-circle-2', 14)} ${descText}</div>
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              ${canExecuteAlta() ? `
                <button class="btn btn-sm btn-success inline-flex items-center gap-1" onclick="window.DashboardView.abrirModalAlta('${item.est.id}', '${item.estNombre.replace(/'/g, "\\'")}')" style="font-weight: 600; padding: 0.4rem 0.85rem; font-size: 0.85rem; border: none; background: #10b981; color: white;">${Icons.get('check', 14)} Registrar Alta</button>
              ` : ''}
              <button class="btn btn-sm btn-info inline-flex items-center gap-1" onclick="window.DashboardView.marcarAlertaComoLeida('', '${item.est.id}', 'compromiso')" style="font-weight: 600; padding: 0.4rem 0.85rem; font-size: 0.85rem; border: none; background: var(--primary); color: white;">${Icons.get('eye', 14)} Marcar como Leído</button>
              <a href="#/estudiantes/${item.est.id}" class="btn btn-sm btn-outline-secondary" style="font-weight: 600; padding: 0.4rem 0.85rem; font-size: 0.85rem; text-decoration: none;">Ficha</a>
              <button class="btn btn-sm btn-outline-secondary" onclick="window.DashboardView.descartarAlertaCompromiso('${item.est.id}')" style="padding: 0.35rem 0.6rem; font-size: 0.8rem; border-color: #cbd5e1;">✕</button>
            </div>
          </div>
        `;
      }).join('');

      html += `
        <details class="card mb-3" style="border: 1px solid #6ee7b7; border-left: 5px solid #10b981; background: #ecfdf5; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.04); transition: all 0.3s ease;" open>
          <summary style="cursor: pointer; padding: 0.85rem 1.25rem; display: flex; align-items: center; justify-content: space-between; user-select: none; list-style: none;" class="card-header">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1rem; color: #065f46; font-weight: 700;">▶</span>
              <h3 style="margin: 0; color: #065f46; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">
                <span>🎉</span> Compromisos Cumplidos (Pendientes de Alta)
              </h3>
            </div>
            <span class="badge" style="background: #10b981; color: white; font-weight: 700; font-size: 0.8rem; padding: 0.25rem 0.6rem; border-radius: 12px;">
              ${compromisosCumplidos.length} ${compromisosCumplidos.length === 1 ? 'Estudiante' : 'Estudiantes'}
            </span>
          </summary>
          <div class="card-body" style="padding: 1rem 1.25rem 1.25rem; border-top: 1px solid #6ee7b7; background: #fff;">
            ${itemsCumplidosHtml}
          </div>
        </details>
      `;
    }

    return html;
  }

  async function descartarAlertaCompromiso(estudianteId) {
    const est = (typeof Storage !== 'undefined' && typeof Storage.getEstudianteById === 'function') ? Storage.getEstudianteById(estudianteId) : null;
    if (est) {
      est.compromisoDescartado = true;
      if (typeof Storage.saveEstudiante === 'function') {
        await Storage.saveEstudiante(est);
      }
    }

    const el = document.getElementById(`alerta-compromiso-${estudianteId}`);
    if (el) {
      el.style.transition = 'all 0.3s ease';
      el.style.opacity = '0';
      el.style.transform = 'translateY(-10px)';
    }

    App.showToast('Alerta marcada como vista. Redirigiendo a la ficha del estudiante...', 'info');

    setTimeout(() => {
      window.location.hash = `#/estudiantes/${estudianteId}`;
    }, 400);
  }

  function getCurrentUserEmail() {
    let email = (Auth.currentUser && Auth.currentUser.email) ? Auth.currentUser.email.trim().toLowerCase() : '';
    const activeRole = Auth.currentRole;
    if (email === 'itsotocadiz@gmail.com' && activeRole && activeRole !== 'superadmin') {
      const activeSchool = (typeof Storage !== 'undefined' && Storage.activeSchool) ? Storage.activeSchool : 'demo';
      const realUser = (Storage.getUsuarios ? Storage.getUsuarios() : [])
        .find(u => {
          const userSchool = u.colegio_id || u.colegioId || '';
          return String(userSchool).trim() === String(activeSchool).trim() && 
                 String(u.role || '').toLowerCase() === activeRole.toLowerCase();
        });
      if (realUser && realUser.email) {
        email = realUser.email.trim().toLowerCase();
      }
    }
    return email;
  }

  function getCurrentUserUid() {
    let uid = Auth.currentUser ? Auth.currentUser.uid : 'demo';
    const email = getCurrentUserEmail();
    if (Auth.currentUser && Auth.currentUser.email && Auth.currentUser.email.trim().toLowerCase() === 'itsotocadiz@gmail.com' && Auth.currentRole !== 'superadmin') {
      const activeSchool = (typeof Storage !== 'undefined' && Storage.activeSchool) ? Storage.activeSchool : 'demo';
      const realUser = (Storage.getUsuarios ? Storage.getUsuarios() : [])
        .find(u => {
          const userSchool = u.colegio_id || u.colegioId || '';
          return String(userSchool).trim() === String(activeSchool).trim() && 
                 u.email && u.email.trim().toLowerCase() === email;
        });
      if (realUser && realUser.id) {
        uid = realUser.id;
      }
    }
    return uid;
  }

  function renderAlertasAgendaHoyHTML() {
    const currentUid = getCurrentUserUid();
    const currentUserEmail = getCurrentUserEmail();
    
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const eventosHoy = (Storage.cache?.eventos_agenda || []).filter(e => {
      if (!e.fechaHora) return false;
      const evDateStr = e.fechaHora.split('T')[0];
      if (evDateStr !== todayStr) return false;

      const isOrganizer = e.funcionarioId === currentUid || (e.organizadorEmail && e.organizadorEmail.trim().toLowerCase() === currentUserEmail);
      if (isOrganizer) return true;
      
      if (e.invitados && Array.isArray(e.invitados)) {
        return e.invitados.some(inv => inv.email && inv.email.trim().toLowerCase() === currentUserEmail);
      }
      return false;
    });

    if (eventosHoy.length === 0) return '';

    eventosHoy.sort((a, b) => new Date(a.fechaHora) - new Date(b.fechaHora));

    let html = `
      <div class="card mb-3" style="border: 2px solid #6d28d9; border-left: 6px solid #8b5cf6; background: #faf5ff; border-radius: 12px; padding: 1rem 1.25rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); margin-bottom: 1.25rem;">
        <div style="display: flex; align-items: center; gap: 0.85rem; margin-bottom: 0.75rem;">
          <div style="display: flex; align-items: center; justify-content: center; background: #f3e8ff; padding: 0.5rem; border-radius: 8px; border: 1px solid #e9d5ff; color: #8b5cf6;">${Icons.get('calendar', 22)}</div>
          <div>
            <h4 style="margin: 0; color: #5b21b6; font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; gap: 0.5rem;">
              Compromisos de tu Agenda para Hoy
              <span class="badge" style="background: #8b5cf6; color: white; font-weight: 700; font-size: 0.8rem; padding: 0.2rem 0.55rem; border-radius: 4px;">${eventosHoy.length} Reunión${eventosHoy.length === 1 ? '' : 'es'}</span>
            </h4>
            <p style="margin: 2px 0 0 0; color: #6d28d9; font-size: 0.85rem;">Eventos agendados programados para la jornada de hoy.</p>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
    `;

    eventosHoy.forEach(ev => {
      const isOrganizer = ev.funcionarioId === currentUid || (ev.organizadorEmail && ev.organizadorEmail.trim().toLowerCase() === currentUserEmail);
      const timeStr = ev.fechaHora.split('T')[1] || '';
      const formattedTime = timeStr ? `${timeStr} hrs` : 'Todo el día';
      
      let badgeHtml = '';
      if (isOrganizer) {
        badgeHtml = `<span class="badge" style="background:#ede9fe; color:#6d28d9; border:1px solid #c084fc; font-size:0.75rem; font-weight:700; padding:1px 5px; border-radius:3px; margin-left: 0.5rem;">Organizador</span>`;
      } else {
        const orgName = ev.organizadorNombre || ev.organizadorEmail || 'Colega';
        badgeHtml = `<span class="badge" style="background:#e0f2fe; color:#0369a1; border:1px solid #7dd3fc; font-size:0.75rem; font-weight:700; padding:1px 5px; border-radius:3px; margin-left: 0.5rem;">Invitado por ${orgName}</span>`;
      }

      html += `
        <div style="background: white; border: 1px solid #f3e8ff; border-radius: 8px; padding: 0.75rem 1rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <div style="display: flex; align-items: center; flex-wrap: wrap;">
              <strong style="color: #4c1d95; font-size: 0.95rem; display: inline-flex; align-items: center; gap: 0.25rem;">${Icons.get('clock', 14)} ${formattedTime}</strong>
              <span style="margin: 0 0.5rem; color: #c084fc;">•</span>
              <span style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem;">${ev.titulo}</span>
              ${badgeHtml}
            </div>
            ${ev.descripcion ? `<div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">${ev.descripcion}</div>` : ''}
          </div>
          <a href="#/agenda" class="btn btn-sm" style="background: #8b5cf6; color: white; font-weight: 600; font-size: 0.8rem; padding: 0.35rem 0.75rem; border-radius: 6px; text-decoration: none; border: none;">Ir a Agenda</a>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
    return html;
  }

  function renderAlertasNotasPendientesHTML() {
    const count = (typeof Storage !== 'undefined' && Storage.getNotasPendientesCountForCurrentUser) 
      ? Storage.getNotasPendientesCountForCurrentUser() 
      : 0;

    // Strict conditional rendering: if count === 0, return empty string so container stays completely hidden
    if (count <= 0) return '';

    const notas = (typeof Storage !== 'undefined' && Storage.getNotasColaborativas) ? Storage.getNotasColaborativas() : [];
    const user = (typeof Auth !== 'undefined' && Auth.currentUser) ? Auth.currentUser : null;
    const role = (typeof Auth !== 'undefined' && Auth.currentRole) ? Auth.currentRole.toLowerCase() : '';
    const userId = user ? (user.id || user.uid) : null;

    const pendingNota = notas.find(n => {
      if (n.leido) return false;
      const receptor = (n.receptor_id || '').toLowerCase();
      if (receptor === 'todos' || receptor === 'todo el equipo') return true;
      if (receptor === 'utp' && (role === 'utp' || role === 'coordinadora')) return true;
      if (receptor === 'direccion' && (role === 'directora' || role === 'admin' || role === 'superadmin')) return true;
      if (userId && receptor === userId.toLowerCase()) return true;
      if (role && receptor === role) return true;
      return false;
    });

    const targetId = pendingNota ? pendingNota.id : '';
    const targetUrl = targetId ? `#/notas?id=${targetId}` : '#/notas';

    return `
      <div class="card mb-3" style="border: 2px solid #ca8a04; border-left: 6px solid #eab308; background: #fefce8; border-radius: 12px; padding: 1rem 1.25rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem;">
        <div style="display: flex; align-items: center; gap: 0.85rem;">
          <div style="font-size: 1.8rem; background: #fef08a; padding: 0.4rem 0.6rem; border-radius: 10px; border: 1px solid #fde047;">📌</div>
          <div>
            <h4 style="margin: 0 0 0.2rem 0; color: #854d0e; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">
              Notas y Feedback Pendiente de Lectura
              <span class="badge badge-warning" style="background: #eab308; color: white; font-weight: 700; font-size: 0.8rem; padding: 0.2rem 0.55rem;">${count} Pendiente${count === 1 ? '' : 's'}</span>
            </h4>
            <p style="margin: 0; color: #a16207; font-size: 0.9rem;">
              Tienes ${count} nota${count === 1 ? '' : 's'} o comentarios colaborativos pendientes por revisar en el Muro de Notas.
            </p>
          </div>
        </div>

        <a href="${targetUrl}" class="btn btn-warning" style="font-weight: 700; background: #eab308; color: white; border: none; padding: 0.55rem 1.2rem; border-radius: 8px; display: inline-flex; align-items: center; gap: 0.4rem; text-decoration: none; box-shadow: 0 2px 4px rgba(234, 179, 8, 0.3);">
          <span>🔍 Ir al Muro de Notas</span>
        </a>
      </div>
    `;
  }

  function render(container) {
    App.setBreadcrumb('Dashboard Principal');
    const role = Auth.currentRole;

    if (role === 'postulante' || role === 'directivo') {
      window.location.hash = role === 'postulante' ? '#/postulantes' : '#/postulantes/directivos';
      return;
    }

    const menuConfigRaw = (typeof Storage !== 'undefined' && typeof Storage.getMenuConfig === 'function')
      ? Storage.getMenuConfig()
      : ((typeof window !== 'undefined' && window.ROLES && window.ROLES[role]) ? window.ROLES[role].menu : []);
    const menuConfig = Array.isArray(menuConfigRaw) ? menuConfigRaw : [];

    const tabs = [
      { id: 'tab-inspectoria', label: `${Icons.get('school', 18)} Inspectoría General`, titleText: 'Inspectoría General', key: 'inspectoria' },
      { id: 'tab-convivencia', label: `${Icons.get('handshake', 18)} Convivencia Escolar`, titleText: 'Convivencia Escolar', key: 'convivencia' },
      { id: 'tab-utp', label: `${Icons.get('book-open', 18)} UTP`, titleText: 'UTP', key: 'utp' },
      { id: 'tab-pie', label: `${Icons.get('puzzle', 18)} PIE`, titleText: 'PIE', key: 'pie' },
      { id: 'tab-profesores', label: `${Icons.get('graduation-cap', 18)} Profesores`, titleText: 'Profesores', key: 'profesor' },
      { id: 'tab-finanzas', label: `${Icons.get('dollar-sign', 18)} Finanzas`, titleText: 'Finanzas', key: 'finanzas' }
    ];

    const visibles = tabs.filter(t => menuConfig.includes(t.key));

    // Determinar tab activo por defecto según el rol institucional
    let defaultTabId = '';
    const userRoleLower = (role || '').toLowerCase();
    if (userRoleLower === 'inspectoria') defaultTabId = 'tab-inspectoria';
    else if (userRoleLower === 'convivencia') defaultTabId = 'tab-convivencia';
    else if (userRoleLower === 'utp') defaultTabId = 'tab-utp';
    else if (userRoleLower === 'pie') defaultTabId = 'tab-pie';
    else if (userRoleLower === 'profesor') defaultTabId = 'tab-profesores';
    else if (userRoleLower === 'finanzas' || userRoleLower === 'finanza') defaultTabId = 'tab-finanzas';

    const isTabVisible = visibles.some(t => t.id === defaultTabId);
    if (!isTabVisible && visibles.length > 0) {
      defaultTabId = visibles[0].id;
    }

    const tabsHtml = visibles.map((t, i) => {
      const isActive = t.id === defaultTabId;
      const activeClass = isActive ? 'active' : '';
      return `<button class="tab-btn ${activeClass} inline-flex items-center gap-2" onclick="window.DashboardView.switchTab('${t.id}', this)" style="border: none; background: transparent; font-weight: 600; font-size: 1.05rem; padding: 0.5rem 1rem; border-bottom: 3px solid ${isActive?'var(--primary)':'transparent'}; color: ${isActive?'var(--primary)':'var(--text-secondary)'}; cursor: pointer;">${t.label}</button>`;
    }).join('');

    const alertasAgendaHoyHTML = renderAlertasAgendaHoyHTML();
    const alertasSeguimientoVencidasHTML = renderAlertasSeguimientoVencidasHTML();
    const alertasNotasHTML = renderAlertasNotasPendientesHTML();
    const alertasHTML = renderAlertasSeguimientoHTML();
    const alertasPermisosHTML = renderAlertasPermisosFuncionariosHTML();
    const alertasCompromisosHTML = renderAlertasCompromisosConductualesHTML();

    const contentHtml = visibles.length > 0 ? visibles.map((t, i) => {
      const display = t.id === defaultTabId ? 'block' : 'none';
      const titulo = t.titleText;
      return `<div id="${t.id}" class="dashboard-tab-content" style="display: ${display};">
        <div class="card p-4 text-center text-muted">
          <h4 style="margin-top:0">${titulo}</h4>
          <p style="margin-bottom:0;">Sección limpia. Configura tus widgets desde el Panel de Control.</p>
        </div>
      </div>`;
    }).join('') : '';

    const html = `
      <div style="max-width: 1200px; margin: 0 auto; padding: 1rem 0;">
        <div class="flex justify-between items-center mb-4">
          <div style="display:flex; align-items:center;">
            <h2 style="margin: 0; color: var(--text-primary); text-transform: capitalize;">Dashboard: ${role}</h2>
          </div>
          ${Auth.currentRole === 'admin' ? `<button class="btn btn-primary btn-sm inline-flex items-center gap-1" onclick="App.showToast('Editor de Dashboards en el Panel de Control', 'info')">${Icons.get('settings', 16)} Configurado desde Panel de Control</button>` : ''}
        </div>

        <!-- Módulo Dinámico de Seguimientos Vencidos -->
        <div id="seccion-seguimientos-vencidos">
          ${alertasSeguimientoVencidasHTML}
        </div>

        <!-- Módulo Dinámico de Alertas de Compromisos Conductuales -->
        <div id="seccion-alertas-compromisos">
          ${alertasCompromisosHTML}
        </div>

        <!-- Módulo Dinámico de Alertas de Seguimiento (Diferenciado por Categoría) -->
        <div id="seccion-alertas-seguimiento">
          ${alertasHTML}
        </div>

        <!-- Módulo Dinámico de Alertas de Agenda de Hoy -->
        <div id="seccion-alertas-agenda-hoy">
          ${alertasAgendaHoyHTML}
        </div>

        <!-- Módulo Dinámico de Alertas de Notas Pendientes -->
        <div id="seccion-alertas-notas">
          ${alertasNotasHTML}
        </div>

        <!-- Módulo Dinámico de Alertas de Permisos de Funcionarios -->
        <div id="seccion-alertas-permisos">
          ${alertasPermisosHTML}
        </div>

        ${visibles.length > 0 ? `
        <div class="dashboard-tabs" style="display: flex; gap: 1rem; margin-bottom: 1.5rem; border-bottom: 2px solid #e2e8f0; overflow-x: auto; padding-bottom: 0.5rem; margin-top: 1rem;">
          ${tabsHtml}
        </div>
        ` : ''}
        ${contentHtml}
      </div>

      <!-- MODAL DE ACCION RAPIDA SEGUIMIENTO -->
      <div id="quick-seguimiento-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1050; align-items: center; justify-content: center;">
        <div class="card" style="width: 100%; max-width: 500px; margin: 1rem; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); overflow: hidden; background: white;">
          <div class="card-header" style="background: #1e293b; color: white; padding: 1rem 1.25rem; display: flex; justify-content: space-between; align-items: center;">
            <h4 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: white;" id="quick-modal-titulo">Registrar Seguimiento</h4>
            <button onclick="window.DashboardView.cerrarQuickSeguimiento()" style="background:transparent; border:none; color:white; font-size:1.25rem; cursor:pointer;">✕</button>
          </div>
          <div class="card-body" style="padding: 1.25rem;">
            <input type="hidden" id="quick-modal-caso-id">
            <input type="hidden" id="quick-modal-est-id">
            
            <div style="font-size: 0.9rem; margin-bottom: 1rem; color: #475569; background: #f1f5f9; padding: 0.75rem; border-radius: 6px; border-left: 4px solid #10b981;">
              <strong>Estudiante:</strong> <span id="quick-modal-est-nombre">-</span><br>
              <strong>Caso / Alerta:</strong> <span id="quick-modal-caso-titulo">-</span>
            </div>

            <div class="form-group" style="margin-bottom: 1rem;">
              <label class="form-label" style="font-weight: 600; display: block; margin-bottom: 0.4rem; color: var(--text-primary);">Acción a realizar:</label>
              <select id="quick-modal-accion" class="form-control" style="width: 100%;" onchange="window.DashboardView.onQuickAccionChange()">
                <option value="registrar">Registrar Seguimiento en Bitácora (Seguir activo)</option>
                <option value="cerrar_caso">Cerrar Caso Permanentemente</option>
                <option value="cerrar_compromiso">Finalizar Compromiso Conductual (Dar de alta)</option>
              </select>
            </div>

            <div id="quick-modal-campos-registro">
              <div class="form-group" style="margin-bottom: 1rem;">
                <label class="form-label" style="font-weight: 600; display: block; margin-bottom: 0.4rem; color: var(--text-primary);">Observación / Comentario:</label>
                <textarea id="quick-modal-texto" class="form-control" rows="3" placeholder="Describe brevemente el resultado del seguimiento..." style="width: 100%; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.5rem;"></textarea>
              </div>

              <div class="form-group" style="margin-bottom: 1rem;">
                <label class="form-label" style="font-weight: 600; display: block; margin-bottom: 0.4rem; color: var(--text-primary);">Próximo Seguimiento (Opcional):</label>
                <input type="date" id="quick-modal-proximo-fecha" class="form-control" style="width: 100%; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.5rem;">
                <p class="text-secondary" style="font-size: 0.75rem; margin-top: 0.25rem; margin-bottom: 0;">Agenda una nueva fecha de alerta en el Dashboard.</p>
              </div>
            </div>
          </div>
          <div style="background: #f8fafc; padding: 0.75rem 1.25rem; text-align: right; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 0.5rem;">
            <button class="btn btn-secondary" onclick="window.DashboardView.cerrarQuickSeguimiento()" style="padding: 0.45rem 1rem; border-radius: 6px;">Cancelar</button>
            <button class="btn btn-primary" onclick="window.DashboardView.guardarQuickSeguimiento()" style="padding: 0.45rem 1rem; border-radius: 6px; background: #10b981; border: none; color: white;" id="quick-modal-guardar-btn">Guardar</button>
          </div>
        </div>
      </div>
    `;

    if (!container) return;
    container.innerHTML = html;
  }

  function switchTab(tabId, btnElement) {
    document.querySelectorAll('.dashboard-tab-content').forEach(el => el.style.display = 'none');
    const target = document.getElementById(tabId);
    if (target) target.style.display = 'block';

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.style.borderBottom = '3px solid transparent';
      btn.style.color = 'var(--text-secondary)';
    });
    if (btnElement) {
      btnElement.style.borderBottom = '3px solid var(--primary)';
      btnElement.style.color = 'var(--primary)';
    }
  }

  function abrirQuickSeguimiento(casoId, estudianteId, tituloCaso, estNombre) {
    const modal = document.getElementById('quick-seguimiento-modal');
    if (!modal) return;

    document.getElementById('quick-modal-caso-id').value = casoId || '';
    document.getElementById('quick-modal-est-id').value = estudianteId || '';
    document.getElementById('quick-modal-est-nombre').innerText = estNombre || '';
    document.getElementById('quick-modal-caso-titulo').innerText = tituloCaso || '';

    // Reset fields
    document.getElementById('quick-modal-texto').value = '';
    document.getElementById('quick-modal-proximo-fecha').value = '';
    document.getElementById('quick-modal-accion').value = 'registrar';

    // Show/hide options depending on if it's a case or student or commitment
    const isCaso = casoId && !casoId.startsWith('est_');
    const select = document.getElementById('quick-modal-accion');
    
    // Reset options
    Array.from(select.options).forEach(opt => opt.style.display = 'block');
    
    if (isCaso) {
      // Hide close commitment option
      const opt = select.querySelector('option[value="cerrar_compromiso"]');
      if (opt) opt.style.display = 'none';
    } else {
      // Hide close case option
      const opt = select.querySelector('option[value="cerrar_caso"]');
      if (opt) opt.style.display = 'none';
    }

    onQuickAccionChange();
    modal.style.display = 'flex';
  }

  function abrirModalAlta(estId, estNombre) {
    // Crear e inyectar el modal de Alta si no existe
    let modal = document.getElementById('modal-alta-compromiso');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-alta-compromiso';
      modal.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);z-index:1060;align-items:center;justify-content:center;';
      modal.innerHTML = `
        <div style="width:100%;max-width:480px;margin:1rem;border-radius:14px;box-shadow:0 20px 40px -10px rgba(0,0,0,0.25);overflow:hidden;background:white;">
          <div style="background:linear-gradient(135deg,#065f46,#10b981);color:white;padding:1.1rem 1.4rem;display:flex;justify-content:space-between;align-items:center;">
            <h4 style="margin:0;font-size:1.15rem;font-weight:700;">✅ Registrar Alta del Compromiso</h4>
            <button onclick="window.DashboardView.cerrarModalAlta()" style="background:transparent;border:none;color:white;font-size:1.3rem;cursor:pointer;line-height:1;">✕</button>
          </div>
          <div style="padding:1.25rem;">
            <input type="hidden" id="alta-modal-est-id">
            <div style="font-size:0.9rem;color:#475569;background:#f0fdf4;padding:0.8rem 1rem;border-radius:8px;border-left:4px solid #10b981;margin-bottom:1.1rem;">
              <div><strong>Estudiante:</strong> <span id="alta-modal-est-nombre" style="color:#065f46;font-weight:700;">-</span></div>
              <div style="margin-top:0.25rem;font-size:0.82rem;">El período de compromiso conductual ha sido completado exitosamente.</div>
            </div>

            <div style="margin-bottom:1.1rem;">
              <label style="font-weight:700;display:block;margin-bottom:0.4rem;color:#1e293b;">Resolución del Alta:</label>
              <select id="alta-modal-resolucion" class="form-control" style="width:100%;" onchange="window.DashboardView.onAltaResolucionChange()">
                <option value="aprobada">✅ Alta Aprobada — Compromiso cumplido satisfactoriamente</option>
                <option value="no_revisar">⏭️ No revisar ahora — Mantener activo, recordar después</option>
              </select>
            </div>

            <div id="alta-modal-obs-section">
              <div style="margin-bottom:1rem;">
                <label style="font-weight:700;display:block;margin-bottom:0.4rem;color:#1e293b;">Observación (Opcional):</label>
                <textarea id="alta-modal-obs" class="form-control" rows="3" placeholder="Ej: El estudiante mantuvo su conducta durante todo el período..." style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:0.5rem;"></textarea>
              </div>
            </div>

            <div id="alta-modal-no-revisar-section" style="display:none;">
              <div style="font-size:0.85rem;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:0.75rem;">
                ⚠️ La alerta seguirá apareciendo en próximas sesiones hasta que se registre el Alta.
              </div>
            </div>
          </div>
          <div style="background:#f8fafc;padding:0.75rem 1.25rem;text-align:right;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;gap:0.5rem;">
            <button class="btn btn-secondary" onclick="window.DashboardView.cerrarModalAlta()" style="padding:0.45rem 1rem;border-radius:6px;">Cancelar</button>
            <button class="btn btn-primary" onclick="window.DashboardView.guardarAltaCompromiso()" id="alta-modal-guardar-btn" style="padding:0.45rem 1.2rem;border-radius:6px;background:#10b981;border:none;color:white;font-weight:700;">✅ Confirmar Alta</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    document.getElementById('alta-modal-est-id').value = estId || '';
    document.getElementById('alta-modal-est-nombre').innerText = estNombre || '';
    document.getElementById('alta-modal-obs').value = '';
    document.getElementById('alta-modal-resolucion').value = 'aprobada';
    document.getElementById('alta-modal-obs-section').style.display = 'block';
    document.getElementById('alta-modal-no-revisar-section').style.display = 'none';
    const btn = document.getElementById('alta-modal-guardar-btn');
    if (btn) { btn.innerHTML = '✅ Confirmar Alta'; btn.style.background = '#10b981'; }

    modal.style.display = 'flex';
  }

  function cerrarModalAlta() {
    const modal = document.getElementById('modal-alta-compromiso');
    if (modal) modal.style.display = 'none';
  }

  function onAltaResolucionChange() {
    const val = document.getElementById('alta-modal-resolucion').value;
    const obsSection = document.getElementById('alta-modal-obs-section');
    const noRevisarSection = document.getElementById('alta-modal-no-revisar-section');
    const btn = document.getElementById('alta-modal-guardar-btn');
    if (val === 'aprobada') {
      obsSection.style.display = 'block';
      noRevisarSection.style.display = 'none';
      if (btn) { btn.innerHTML = '✅ Confirmar Alta'; btn.style.background = '#10b981'; }
    } else {
      obsSection.style.display = 'none';
      noRevisarSection.style.display = 'block';
      if (btn) { btn.innerHTML = '⏭️ Cerrar sin registrar Alta'; btn.style.background = '#f59e0b'; }
    }
  }

  async function guardarAltaCompromiso() {
    const estId = document.getElementById('alta-modal-est-id').value;
    const resolucion = document.getElementById('alta-modal-resolucion').value;
    const obs = document.getElementById('alta-modal-obs')?.value.trim() || '';

    if (!estId) return;

    const est = Storage.getEstudianteById ? Storage.getEstudianteById(estId) : (Storage.getEstudiantes ? Storage.getEstudiantes() : []).find(e => e.id === estId);
    if (!est) {
      App.showToast('No se encontró el estudiante.', 'danger');
      return;
    }

    try {
      if (resolucion === 'aprobada') {
        // --- ALTA APROBADA: desactivar compromiso + registrar en bitácora ---
        est.compromisoConductualActivo = false;
        est.compromisoEstado = 'dado_de_alta';
        est.compromisoFechaAlta = BARITA_hoyChileISO();

        if (!Array.isArray(est.bitacoraSeguimiento)) est.bitacoraSeguimiento = [];

        const textoAlta = `✅ Alta Aprobada — Compromiso Conductual dado de alta. ${obs ? 'Observación: ' + obs : 'El estudiante completó satisfactoriamente el período de compromiso.'}`;
        const yaExiste = est.bitacoraSeguimiento.some(b => b && b.texto && b.texto.includes('Alta Aprobada'));
        if (!yaExiste) {
          est.bitacoraSeguimiento.unshift({
            id: 'bit_alta_' + Date.now(),
            fecha: new Date().toISOString(),
            texto: textoAlta,
            registradoPor: Auth.currentUser ? (Auth.currentUser.nombres || Auth.currentUser.email) : 'Sistema'
          });
        }

        // Evaluar otros casos activos del estudiante para limpiar banderas correctamente
        const activeCases = (Storage.getCasos ? Storage.getCasos() : [])
          .filter(c => c.estado !== 'cerrado' && (c.estudianteId === estId || c.estudiante_id === estId || c.estudiante_id_ref === estId));
        const hasActiveSeguimiento = activeCases.some(c => c.tipo === 'seguimiento');
        const hasActiveComplejo = activeCases.some(c => c.tipo === 'complejo');
        const hasActiveApoyo = activeCases.some(c => c.tipo === 'apoyo_psicosocial');
        const hasActiveUtp = activeCases.some(c => c.tipo === 'plan_utp');
        if (!hasActiveSeguimiento) est.enSeguimiento = false;
        if (!hasActiveComplejo) est.esComplejo = false;
        if (!hasActiveApoyo) est.requiereApoyoPsicosocial = false;
        if (!hasActiveUtp) est.planUtpActivo = false;

        // Si ya no tiene seguimientos ni compromiso activo, limpiar fechas de alerta
        if (!est.enSeguimiento && !est.compromisoConductualActivo) {
          est.fechaProximoSeguimiento = null;
          est.fechaProximo = null;
        }

        await Storage.saveEstudiante(est, true);
        App.showToast('✅ Alta registrada. El compromiso ha sido dado de alta exitosamente.', 'success');

      } else {
        // --- NO REVISAR AHORA: solo marcar como leído para esta sesión ---
        const loggedUser = Auth.currentUser ? (Auth.currentUser.nombres || Auth.currentUser.email) : 'Funcionario';
        const role = (Auth.userProfile?.role || Auth.currentRole || Auth.currentUser?.role || 'profesor').toLowerCase().trim();
        if (!Array.isArray(est.bitacoraSeguimiento)) est.bitacoraSeguimiento = [];
        const yaLeido = est.bitacoraSeguimiento.some(b => b && b.is_seen_confirm && String(b.role).toLowerCase().trim() === role);
        if (!yaLeido) {
          est.bitacoraSeguimiento.push({
            id: 'seen_log_' + Date.now(),
            fecha: new Date().toISOString(),
            texto: '',
            is_seen_confirm: true,
            role: role,
            registradoPor: loggedUser
          });
          await Storage.saveEstudiante(est, true);
        }
        App.showToast('Alerta pospuesta. Seguirá apareciendo en la próxima sesión.', 'info');
      }

      cerrarModalAlta();
      if (typeof App.handleRoute === 'function') App.handleRoute(true);
      else location.reload();
    } catch (e) {
      console.error(e);
      App.showToast('No se pudo registrar el alta.', 'danger');
    }
  }

  function cerrarQuickSeguimiento() {
    const modal = document.getElementById('quick-seguimiento-modal');
    if (modal) modal.style.display = 'none';
  }

  function onQuickAccionChange() {
    const val = document.getElementById('quick-modal-accion').value;
    const campos = document.getElementById('quick-modal-campos-registro');
    const btn = document.getElementById('quick-modal-guardar-btn');

    if (val === 'registrar') {
      campos.style.display = 'block';
      btn.innerHTML = `${Icons.get('check', 16)} Guardar`;
      btn.style.background = '#10b981';
    } else if (val === 'cerrar_caso') {
      campos.style.display = 'none';
      btn.innerHTML = `${Icons.get('trash-2', 16)} Confirmar y Cerrar Caso`;
      btn.style.background = '#dc2626';
    } else if (val === 'cerrar_compromiso') {
      campos.style.display = 'none';
      btn.innerHTML = `${Icons.get('check-circle-2', 16)} Confirmar y Dar de Alta`;
      btn.style.background = '#10b981';
    }
  }

  async function guardarQuickSeguimiento() {
    const casoId = document.getElementById('quick-modal-caso-id').value;
    const estId = document.getElementById('quick-modal-est-id').value;
    const accion = document.getElementById('quick-modal-accion').value;
    const comentario = document.getElementById('quick-modal-texto').value;
    const proximaFecha = document.getElementById('quick-modal-proximo-fecha').value || null;

    const client = (typeof window.getSupabaseClient === 'function') ? window.getSupabaseClient() : window.supabaseGestion;
    if (!client) {
      App.showToast('Error de conexión con la base de datos.', 'danger');
      return;
    }

    try {
      App.showToast('Guardando cambios...', 'info');

      if (accion === 'registrar') {
        const entry = {
          id: Date.now().toString(),
          fecha: BARITA_hoyChileISO(),
          texto: comentario || 'Seguimiento registrado desde Dashboard',
          fechaProximoSeguimiento: proximaFecha,
          fechaProximo: proximaFecha,
          registradoPor: (Auth.currentUser ? (Auth.currentUser.nombres || Auth.currentUser.email) : 'Funcionario')
        };

        if (casoId && !casoId.startsWith('est_')) {
          // 1. Guardar en Bitácora del Caso
          const caso = (Storage.getCasos ? Storage.getCasos() : []).find(c => c.id === casoId);
          if (caso) {
            if (!Array.isArray(caso.seguimiento)) caso.seguimiento = [];
            caso.seguimiento.push(entry);
            caso.proximoSeguimiento = proximaFecha;
            caso.fechaProximoSeguimiento = proximaFecha;

            // FIX: payload limpio solo columnas reales
            const cleanPayload = {
              id: caso.id,
              colegio_id: caso.colegio_id || caso.colegioId || (typeof Storage!=='undefined'?Storage.activeSchool:'demo'),
              estudiante_id: caso.estudiante_id || caso.estudianteId || caso.estudiante_id_ref || null,
              titulo: caso.titulo || '',
              descripcion: caso.descripcion || '',
              estado: caso.estado || 'en_proceso',
              tipo: caso.tipo || 'seguimiento',
              fecha: caso.fecha || new Date().toISOString(),
              creado_por_id: caso.creado_por_id || caso.creadoPorId || null,
              seguimiento: Array.isArray(caso.seguimiento) ? caso.seguimiento : [],
              estudiantesInvolucrados: Array.isArray(caso.estudiantesInvolucrados) ? caso.estudiantesInvolucrados : (Array.isArray(caso.estudiantes_involucrados) ? caso.estudiantes_involucrados : [])
            };
            const { error } = await client.from('casos').upsert(cleanPayload);
            if (error) throw error;

            // Sincronizar fecha y bandera de seguimiento en el estudiante asociado
            const assocEstId = caso.estudianteId || caso.estudiante_id || caso.estudiante_id_ref;
            if (assocEstId) {
              const est = (Storage.getEstudiantes ? Storage.getEstudiantes() : []).find(e => e.id === assocEstId);
              if (est) {
                est.fechaProximoSeguimiento = proximaFecha;
                est.fechaProximo = proximaFecha;
                
                // Activar bandera según tipo
                const tipo = caso.tipo || 'seguimiento';
                if (tipo === 'seguimiento') est.enSeguimiento = true;
                if (tipo === 'complejo') est.esComplejo = true;
                if (tipo === 'apoyo_psicosocial') est.requiereApoyoPsicosocial = true;
                if (tipo === 'plan_utp') est.planUtpActivo = true;
                if (tipo === 'medidas_pie') est.medidasPie = true;

                await Storage.saveEstudiante(est, true);
              }
            }
          }
        } else if (estId) {
          // 2. Guardar en Bitácora del Estudiante
          const est = (Storage.getEstudiantes ? Storage.getEstudiantes() : []).find(e => e.id === estId);
          if (est) {
            if (!Array.isArray(est.bitacoraSeguimiento)) est.bitacoraSeguimiento = [];
            est.bitacoraSeguimiento.push(entry);
            est.fechaProximoSeguimiento = proximaFecha;
            est.fechaProximo = proximaFecha;

            // Asegurar que el estudiante sigue estando en seguimiento
            est.enSeguimiento = true;

            await Storage.saveEstudiante(est, true); // bypassPermission = true to allow all profiles to save tracking logs
          }
          try{ DashboardView.limpiarVistoParaNuevoSeguimiento(casoId, estId); }catch(_e){}
        }
        try{ DashboardView.limpiarVistoParaNuevoSeguimiento(casoId, null); if(estId) DashboardView.limpiarVistoParaNuevoSeguimiento(null, estId); }catch(_e){}
      } else if (accion === 'cerrar_caso') {
        // Cerrar Caso - si viene de alerta directa de estudiante (est_...), cerrar bandera del estudiante y sus casos
        if (casoId && String(casoId).startsWith('est_')) {
          const estDirect = (Storage.getEstudiantes ? Storage.getEstudiantes() : []).find(e => e.id === estId);
          if (estDirect) {
            const tipo = 'seguimiento';
            estDirect.enSeguimiento = false; estDirect.esComplejo = false; estDirect.requiereApoyoPsicosocial = false; estDirect.planUtpActivo = false; estDirect.medidasPie = false; estDirect.esEstudiantePIE = false;
            estDirect.fechaProximoSeguimiento = null; estDirect.fechaProximo = null;
            if (!Array.isArray(estDirect.bitacoraSeguimiento)) estDirect.bitacoraSeguimiento = [];
            estDirect.bitacoraSeguimiento.unshift({ id: Date.now().toString(), fecha: new Date().toISOString(), texto: `🏁 Seguimiento cerrado desde Dashboard${comentario ? ': '+comentario : ''}`, registradoPor: (Auth.currentUser ? (Auth.currentUser.email||'Sistema') : 'Sistema') });
            await Storage.saveEstudiante(estDirect, true);
          }
          // Cerrar también todos los casos activos de ese estudiante (evita que alerta vuelva)
          const casosDelEst = (Storage.getCasos ? Storage.getCasos() : []).filter(c => c.estado !== 'cerrado' && (c.estudianteId === estId || c.estudiante_id === estId || c.estudiante_id_ref === estId || (Array.isArray(c.estudiantesInvolucrados) && c.estudiantesInvolucrados.includes(estId))));
          for (const casoEst of casosDelEst) {
            casoEst.estado = 'cerrado';
            if (!Array.isArray(casoEst.seguimiento)) casoEst.seguimiento = [];
            casoEst.seguimiento.unshift({ id: Date.now().toString()+casoEst.id.substring(0,4), fecha: new Date().toISOString(), texto: `🏁 Seguimiento cerrado desde Dashboard${comentario ? ': '+comentario : ''}`, registradoPor: (Auth.currentUser ? (Auth.currentUser.email||'Sistema') : 'Sistema') });
            const cleanPayloadEst = {
              id: casoEst.id,
              colegio_id: casoEst.colegio_id || casoEst.colegioId || (typeof Storage!=='undefined'?Storage.activeSchool:'demo'),
              estudiante_id: casoEst.estudiante_id || casoEst.estudianteId || casoEst.estudiante_id_ref || null,
              titulo: casoEst.titulo || '',
              descripcion: casoEst.descripcion || '',
              estado: casoEst.estado || 'cerrado',
              tipo: casoEst.tipo || 'seguimiento',
              fecha: casoEst.fecha || new Date().toISOString(),
              creado_por_id: casoEst.creado_por_id || casoEst.creadoPorId || null,
              seguimiento: Array.isArray(casoEst.seguimiento) ? casoEst.seguimiento : [],
              estudiantesInvolucrados: Array.isArray(casoEst.estudiantesInvolucrados) ? casoEst.estudiantesInvolucrados : (Array.isArray(casoEst.estudiantes_involucrados) ? casoEst.estudiantes_involucrados : [])
            };
            const { error: errEstCaso } = await client.from('casos').upsert(cleanPayloadEst);
            if (errEstCaso) console.warn('close casoEst warn:', errEstCaso.message);
          }
        }
        const caso = (Storage.getCasos ? Storage.getCasos() : []).find(c => c.id === casoId);
        if (caso) {
          caso.estado = 'cerrado';
          // FIX: payload limpio solo columnas reales
          const cleanPayload = {
            id: caso.id,
            colegio_id: caso.colegio_id || caso.colegioId || (typeof Storage!=='undefined'?Storage.activeSchool:'demo'),
            estudiante_id: caso.estudiante_id || caso.estudianteId || caso.estudiante_id_ref || null,
            titulo: caso.titulo || '',
            descripcion: caso.descripcion || '',
            estado: caso.estado || 'cerrado',
            tipo: caso.tipo || 'seguimiento',
            fecha: caso.fecha || new Date().toISOString(),
            creado_por_id: caso.creado_por_id || caso.creadoPorId || null,
            seguimiento: Array.isArray(caso.seguimiento) ? caso.seguimiento : [],
            estudiantesInvolucrados: Array.isArray(caso.estudiantesInvolucrados) ? caso.estudiantesInvolucrados : (Array.isArray(caso.estudiantes_involucrados) ? caso.estudiantes_involucrados : [])
          };
          const { error } = await client.from('casos').upsert(cleanPayload);
          if (error) throw error;

          // También actualizar el/los estudiante(s) asociado(s) para quitar la bandera
          const allEstIds = new Set();
          const singleId = caso.estudianteId || caso.estudiante_id || caso.estudiante_id_ref;
          if (singleId) allEstIds.add(String(singleId));
          if (Array.isArray(caso.estudiantesInvolucrados)) caso.estudiantesInvolucrados.forEach(id=> allEstIds.add(String(id)));
          // fallback: si el alert vino con estId param, también incluir
          if (estId) allEstIds.add(String(estId));
          for (const assocEstId of allEstIds) {
            const est = (Storage.getEstudiantes ? Storage.getEstudiantes() : []).find(e => String(e.id)===String(assocEstId));
            if (!est) continue;
            const tipo = caso.tipo || 'seguimiento';
            // Cierre explícito: desmarca siempre (no espera a que no queden activos)
            if (tipo === 'seguimiento') est.enSeguimiento = false;
            if (tipo === 'complejo') est.esComplejo = false;
            if (tipo === 'apoyo_psicosocial') est.requiereApoyoPsicosocial = false;
            if (tipo === 'plan_utp') est.planUtpActivo = false;
            if (tipo === 'medidas_pie') est.medidasPie = false;
            if (!est.enSeguimiento && !est.compromisoConductualActivo) {
              est.fechaProximoSeguimiento = null; est.fechaProximo = null;
            }
            await Storage.saveEstudiante(est, true);
          }
        }
      } else if (accion === 'cerrar_compromiso') {
        // Cerrar Compromiso
        const est = (Storage.getEstudiantes ? Storage.getEstudiantes() : []).find(e => e.id === estId);
        if (est) {
          est.compromisoConductualActivo = false;
          est.compromisoEstado = 'cumplido';
          est.compromisoFechaTermino = BARITA_hoyChileISO();

          // Evaluar otros casos activos de seguimiento y banderas del estudiante
          const activeCases = (Storage.getCasos ? Storage.getCasos() : [])
            .filter(c => c.estado !== 'cerrado' && (c.estudianteId === estId || c.estudiante_id === estId || c.estudiante_id_ref === estId));
          
          const hasActiveSeguimiento = activeCases.some(c => c.tipo === 'seguimiento');
          const hasActiveComplejo = activeCases.some(c => c.tipo === 'complejo');
          const hasActiveApoyo = activeCases.some(c => c.tipo === 'apoyo_psicosocial');
          const hasActiveUtp = activeCases.some(c => c.tipo === 'plan_utp');

          if (!hasActiveSeguimiento) {
            est.enSeguimiento = false;
          }
          if (!hasActiveComplejo) {
            est.esComplejo = false;
          }
          if (!hasActiveApoyo) {
            est.requiereApoyoPsicosocial = false;
          }
          if (!hasActiveUtp) {
            est.planUtpActivo = false;
          }

          // Si el estudiante ya no está en seguimiento activo y no tiene compromisos conductuales, limpiamos fechas agendadas
          if (!est.enSeguimiento && !est.compromisoConductualActivo) {
            est.fechaProximoSeguimiento = null;
            est.fechaProximo = null;
          }
          
          // Registrar en bitácora el alta del compromiso
          if (!Array.isArray(est.bitacoraSeguimiento)) est.bitacoraSeguimiento = [];
          const textoCumplido = `🟢 Compromiso Cumplido: El estudiante ha finalizado el periodo de compromiso sin registrar anotaciones negativas.`;
          const yaExisteCumplidoBit = est.bitacoraSeguimiento.some(b => b && b.texto && b.texto.includes('El estudiante ha finalizado el periodo de compromiso'));
          if (!yaExisteCumplidoBit) {
            est.bitacoraSeguimiento.unshift({
              id: 'bit_comp_cump_' + Date.now(),
              fecha: new Date().toISOString(),
              texto: textoCumplido,
              registradoPor: (Auth.currentUser ? (Auth.currentUser.nombres || Auth.currentUser.email) : 'Sistema')
            });
          }
          
          await Storage.saveEstudiante(est, true); // bypassPermission = true to allow all profiles to close compromiso
        }
      }

      App.showToast('Acción realizada exitosamente.', 'success');
      cerrarQuickSeguimiento();
      
      // Recargar la vista
      if (typeof App.handleRoute === 'function') {
        App.handleRoute(true);
      } else {
        location.reload();
      }
    } catch (e) {
      console.error('guardarQuickSeguimiento error:', e);
      const msg = (e && e.message) ? e.message : (e && e.error_description) ? e.error_description : String(e);
      App.showToast('No se pudo guardar la acción: ' + msg.substring(0,120), 'danger');
    } finally {
      cerrarQuickSeguimiento();
    }
  }

  function canExecuteAlta() {
    if (!Auth.currentUser) return false;
    // Usar rol de APLICACIÓN primero
    const r = (Auth.userProfile?.role || Auth.currentRole || Auth.currentUser?.role || 'profesor').toLowerCase().trim();
    // Permitir registrar seguimiento/dar de alta a todos los perfiles de gestión y administración (excluyendo solo a profesores y postulantes)
    const allowedStaff = ['superadmin', 'admin', 'administrador', 'directora', 'director', 'utp', 'coordinadora', 'inspectoria', 'pie', 'convivencia'];
    return allowedStaff.includes(r) || r.includes('inspector');
  }

  async function marcarAlertaComoLeida(casoId, estudianteId, tipoAlerta) {
    if (!Auth.currentUser) return;
    const role = (Auth.userProfile?.role || Auth.currentRole || Auth.currentUser?.role || 'profesor').toLowerCase().trim();

    // 1. Animación visual instantánea en el DOM
    const targetIds = [
      `alerta-vencido-${casoId}-${estudianteId || ''}`,
      `alerta-hoy-${casoId}-${estudianteId || ''}`,
      `alerta-compromiso-${estudianteId || ''}`,
      `alerta-compromiso-${casoId || ''}`
    ];

    targetIds.forEach(domId => {
      const el = document.getElementById(domId);
      if (el) {
        // Encontrar el botón del ojo y reemplazarlo por un check animado
        const button = el.querySelector('button[onclick*="marcarAlertaComoLeida"]');
        if (button) {
          button.style.background = '#10b981';
          button.style.borderColor = '#10b981';
          button.style.color = '#fff';
          button.innerHTML = '✓ Leído';
        }
        
        // Animación de fadeout
        setTimeout(() => {
          el.style.opacity = '0';
          el.style.transform = 'scale(0.95)';
          el.style.maxHeight = el.offsetHeight + 'px';
          
          setTimeout(() => {
            el.style.maxHeight = '0px';
            el.style.paddingTop = '0px';
            el.style.paddingBottom = '0px';
            el.style.marginTop = '0px';
            el.style.marginBottom = '0px';
            el.style.overflow = 'hidden';
            el.style.border = 'none';
            
            // Eliminar físicamente del DOM al terminar la animación para garantizar que desaparezca
            setTimeout(() => {
              el.remove();
            }, 350);
          }, 150);
        }, 300);
      }
    });

    // 2. Guardado local por rol (no bitácora) - solo quien marca deja de ver
    try {
      const key = `barita_alerta_leida_${casoId||''}_${estudianteId||''}_${role}`;
      try { localStorage.setItem(key, 'true'); } catch(_e){}
      App.showToast('Alerta marcada como leída.', 'success');
      // No recargar dashboard: el DOM ya se ocultó con animación, y el próximo F5 filtrará por localStorage
    } catch (e) {
      console.error(e);
      App.showToast('No se pudo marcar como leído.', 'danger');
    }
  }

  function limpiarVistoParaNuevoSeguimiento(casoId, estudianteId){
    const ids=[casoId, estudianteId].filter(Boolean).map(String);
    Object.keys(localStorage).forEach(k=>{
      if(k.startsWith('barita_alerta_leida_') && ids.some(id=>k.includes(id))){
        localStorage.removeItem(k);
      }
    });
    try{
      const casos=Storage.getCasos?.()||[]; const ests=Storage.getEstudiantes?.()||[];
      casos.forEach(c=>{ if(ids.includes(String(c.id))) c.seguimiento?.forEach(s=> delete s.is_seen_confirm); });
      ests.forEach(e=>{ if(ids.includes(String(e.id))) e.bitacoraSeguimiento?.forEach(b=> delete b.is_seen_confirm); });
    }catch(_e){}
  }

  return { render, switchTab, descartarAlertaCompromiso, abrirQuickSeguimiento, cerrarQuickSeguimiento, onQuickAccionChange, guardarQuickSeguimiento, canExecuteAlta, marcarAlertaComoLeida, limpiarVistoParaNuevoSeguimiento, abrirModalAlta, cerrarModalAlta, onAltaResolucionChange, guardarAltaCompromiso };
})();

window.DashboardView = DashboardView;
