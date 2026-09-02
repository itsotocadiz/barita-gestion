/* ================================================================
   funcionarios.js — Gestión de Funcionarios
   Listado, perfiles y registro de acciones realizadas.
   ================================================================ */

(() => {
const FuncionariosView = {
  renderList(container) {
    App.setBreadcrumb('Funcionarios');
    
    const funcionarios = Storage.getFuncionariosActivos();
    
    let html = `
      <div class="card mb-4">
        <div class="card-header flex justify-between items-center">
          <h2 class="card-title" style="margin:0;">Personal del Establecimiento</h2>
          ${Auth.canCreateFuncionarios() ? `
          <button class="btn btn-primary" onclick="FuncionariosView.nuevoFuncionario()">
            + Añadir Funcionario
          </button>
          ` : ''}
        </div>
      </div>
      
      <div class="card">
        ${funcionarios.length === 0 ? 
          '<div class="text-center py-4 text-muted">No hay funcionarios registrados en el sistema.</div>' :
          `<div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Apellidos, Nombres</th>
                  <th>Categoría</th>
                  <th>Cargo / Rol principal</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${funcionarios.sort((a,b) => a.apellidos.localeCompare(b.apellidos)).map(f => {
                  const cat = DATA.getCategoriaFuncionario(f.categoria);
                  return `
                    <tr>
                      <td style="font-weight: 500;">
                        <a href="#/funcionarios/${f.id}" style="color: var(--text-primary); text-decoration: underline;">
                          ${f.apellidos}, ${f.nombres}
                        </a>
                      </td>
                      <td><span class="badge" style="background: var(--bg-hover); color: var(--text-primary); border: 1px solid var(--border-color);">${cat ? cat.nombre : '-'}</span></td>
                      <td>${f.cargo || '-'}</td>
                      <td>
                        <a href="#/funcionarios/${f.id}" class="btn btn-sm btn-secondary">Ver Ficha</a>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>`
        }
      </div>
    `;
    
    container.innerHTML = html;
  },
  
  renderDetalle(container, id) {
    const f = Storage.getFuncionarioById(id);

    // Sync in background to update actions/events cache from Supabase and show entries in real-time
    if (f) {
      setTimeout(async () => {
        try {
          const client = window.getSupabaseClient();
          if (client) {
            // Fetch actions
            const { data: actionsData, error: actionsErr } = await client.from('acciones').select('*').eq('funcionario_id', id);
            if (actionsData && !actionsErr) {
              const unpackedActions = actionsData.map(a => Storage.injectColegioId(a));
              Storage.cache.acciones = Storage.cache.acciones.filter(a => a.funcionarioId !== id && a.funcionario_id !== id);
              Storage.cache.acciones.push(...unpackedActions);
            }

            // Fetch events
            const { data: eventsData, error: eventsErr } = await client.from('eventos').select('*');
            if (eventsData && !eventsErr) {
              const unpackedEvents = eventsData.map(e => Storage.injectColegioId(e));
              Storage.cache.eventos = unpackedEvents;
            }

            // Fetch employee
            const { data: funcData, error: funcErr } = await client.from('funcionarios').select('*').eq('id', id).single();
            if (funcData && !funcErr) {
              const unpackedFunc = Storage.injectColegioId(funcData);
              const idx = Storage.cache.funcionarios.findIndex(x => x.id === id);
              if (idx >= 0) Storage.cache.funcionarios[idx] = unpackedFunc;
            }

            const currentHash = window.location.hash;
            if (currentHash.includes(id)) {
              // Compare action lengths to prevent endless loops
              const freshAcciones = Storage.getAccionesFuncionario(id);
              const cacheAccionesStr = JSON.stringify(Storage.cache.acciones.filter(a => a.funcionarioId === id));
              const freshAccionesStr = JSON.stringify(freshAcciones);
              
              if (cacheAccionesStr !== freshAccionesStr || unpackedFunc.induccion?.estado !== f.induccion?.estado) {
                console.log("Realtime Funcionarios Detalle Refresh");
                FuncionariosView.renderDetalle(container, id);
              }
            }
          }
        } catch (e) {
          console.warn("Background funcionario refresh error:", e);
        }
      }, 200);
    }

    if (!f) {
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
      App.showToast('Funcionario no encontrado', 'danger');
      window.location.hash = '#/funcionarios';
      return;
    }
    
    App.setBreadcrumb(`<a href="#/funcionarios">Funcionarios</a> / Ficha`);
    
    const cat = DATA.getCategoriaFuncionario(f.categoria);
    const acciones = Storage.getAccionesFuncionario(f.id).sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
    const eventos = typeof Storage.getEventosByFuncionario === 'function' ? Storage.getEventosByFuncionario(f.id) : [];
    
    // Sistema de Alertas
    const eventosRecientes = eventos.filter(e => {
       const dias = (new Date() - new Date(e.fecha)) / (1000 * 60 * 60 * 24);
       return dias <= 30;
    });
    let alertaHtml = '';
    if (eventosRecientes.length >= 3) {
      alertaHtml = `
        <div class="alert alert-danger mb-4" style="background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 1rem; border-radius: 6px; display: flex; align-items: flex-start; gap: 0.75rem;">
          <div style="font-size: 1.25rem;">⚠️</div>
          <div>
            <strong style="display: block; margin-bottom: 0.25rem;">Alerta de Recurrencia</strong>
            <span>Este funcionario está asociado a ${eventosRecientes.length} eventos en los últimos 30 días. Se sugiere revisión o acompañamiento.</span>
          </div>
        </div>
      `;
    }

    let html = `
      <div class="dashboard-grid">
        <div class="col-perfil flex-col gap-4">
          <div class="card">
            <div class="card-header flex justify-between items-center" style="border:none; padding-bottom:0;">
              <div>
                <h2 style="margin: 0; font-size: 1.5rem;">${f.nombres} ${f.apellidos}</h2>
                <div class="text-muted mt-1 mb-2">${cat ? cat.nombre : ''} • ${f.cargo || 'Sin cargo'} ${typeof BaritaHelp!=='undefined'?BaritaHelp.create('ficha_funcionario'):''}</div>
                ${(()=>{ const hist=(typeof Storage!=='undefined'&&Storage.getHistorialDotacion)?Storage.getHistorialDotacion(f.id):[]; if(hist.length===0) return ''; return `<div style="margin:0.5rem 0; padding:0.5rem; background:var(--bg-hover); border:1px solid var(--border-color); border-radius:6px; font-size:0.8rem;"><b>Continuidad ${hist.map(h=> `${h.anio}: ${Storage.escapeHtml(h.cargo||'—')} ${h.horas?`(${h.horas}h)`:''} <small>${S(h.tipo_contrato||'')}</small>`).join(' → ')}</b> <small class="text-muted">· paridad demo+terra</small></div>`; })()}
                <div style="display: flex; align-items: center; gap: 0.5rem; background: var(--bg-hover); padding: 0.5rem; border-radius: 6px; border: 1px solid var(--border-color); width: fit-content; cursor: pointer;" onclick="window.location.hash = '#/profesor'">
                  <input type="checkbox" disabled ${f.induccion && f.induccion.estado === 'completado' ? 'checked' : ''} style="width: 1.1rem; height: 1.1rem; accent-color: var(--primary);">
                  <span style="font-weight: 600; color: ${f.induccion && f.induccion.estado === 'completado' ? 'var(--primary)' : 'var(--text-secondary)'}">Inducción Institucional</span>
                </div>
              </div>
              <div class="text-right">
                <button class="btn btn-sm btn-secondary inline-flex items-center gap-1" onclick="FuncionariosView.editar('${f.id}')">${Icons.get('pencil', 14)} Editar</button>
              </div>
            </div>
            <div class="card-body">
              ${alertaHtml}
            </div>
          </div>
          
          <div class="card">
            <div class="card-header flex justify-between items-center">
              <h3 class="card-title" style="display: inline-flex; align-items: center; gap: 0.5rem;">${Icons.get('bar-chart-3', 20)} Resumen de Faltas de Rutina</h3>
              <select class="form-control" style="width: auto; padding: 0.2rem 1.5rem 0.2rem 0.5rem; font-size: 0.8rem;" onchange="FuncionariosView.cambiarMesChart(this.value, '${f.id}')">
                ${['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, i) => 
                  `<option value="${i}" ${i === (this.currentCalendarMonth !== undefined ? this.currentCalendarMonth : new Date().getMonth()) ? 'selected' : ''}>${m}</option>`
                ).join('')}
              </select>
            </div>
            <div class="card-body">
              <div style="position: relative; height: 220px; max-height: 220px; width: 100%;">
                <canvas id="chart-func-container"></canvas>
              </div>
            </div>
          </div>
        </div>
        
        <div class="col-registros flex-col gap-4">

          <div class="card">
            <div class="card-header">
              <h3 class="card-title" style="display: inline-flex; align-items: center; gap: 0.5rem;">${Icons.get('calendar', 20)} Calendario de Registro (Mes Actual)</h3>
            </div>
            <div class="card-body">
              <div id="calendar-func-container"></div>
            </div>
          </div>
          
          <div class="card" style="height: 100%;">
            <div class="card-header flex justify-between items-center">
              <h3 class="card-title">Eventos Asociados</h3>
              <button class="btn btn-primary btn-sm" onclick="FuncionariosView.vincularEvento('${f.id}')">
                + Vincular Evento
              </button>
            </div>
            <div class="card-body">
              ${eventos.length === 0 ? 
                '<div class="text-center py-4 text-muted">No hay eventos asociados a este funcionario.</div>' :
                `<div class="timeline flex-col gap-4">
                  ${eventos.map(e => `
                    <div class="timeline-item">
                      <div class="timeline-marker" style="background: var(--primary);"></div>
                      <div class="timeline-content">
                        <div class="flex justify-between items-center">
                          <span class="font-bold" style="text-transform: capitalize;">${e.titulo || e.tipo || 'Acontecimiento'}</span>
                          <div class="flex items-center gap-2">
                            <span class="text-sm text-muted">${new Date(e.fecha || e.fechaHora).toLocaleDateString()}</span>
                            ${(typeof Auth.canManageFuncionarios === 'function' ? Auth.canManageFuncionarios() : (Auth.canWriteFuncionarios ? Auth.canWriteFuncionarios() : true)) ? `
                              <button class="btn btn-sm btn-secondary" onclick="FuncionariosView.editarEventoAsociado('${e.id}', '${f.id}')" style="padding: 0.15rem 0.4rem; font-size: 0.7rem; border-radius: 4px;">Editar</button>
                            ` : ''}
                          </div>
                        </div>
                        <p class="text-sm mt-1">${Storage.safeHtml(e.descripcion)}</p>
                        <div class="text-xs text-muted mt-2" style="font-size: 0.72rem; color: #64748b;">
                          Registrado por: ${Storage.safeHtml(e.registradoPor || e.registrado_por || e.autorNombre || 'Administrador Principal')}
                          ${(e.estudianteNombre || e.estudianteId) ? ` | Estudiante: ${Storage.safeHtml(e.estudianteNombre || e.estudianteId)}` : ''}
                        </div>
                      </div>
                    </div>
                  `).join('')}
                </div>`
              }
            </div>
          </div>

          <div class="card">
            <div class="card-header flex justify-between items-center">
              <h3 class="card-title">Bitácora de Fiscalización y Desempeño</h3>
              <button class="btn btn-secondary btn-sm" onclick="FuncionariosView.nuevaAccion('${f.id}')">
                + Registrar Fiscalización
              </button>
            </div>
            <div class="card-body">
              ${(() => {
                const accionesRutina = acciones
                  .filter(a => !['ausencia', 'licencia', 'permiso'].includes(a.tipo))
                  .sort((a, b) => new Date(b.fecha || b.fechaHora || 0) - new Date(a.fecha || a.fechaHora || 0));
                
                if (accionesRutina.length === 0) {
                  return '<div class="text-center py-4 text-muted">No hay acciones registradas.</div>';
                }

                const tiposFiscalizacion = (typeof Storage !== 'undefined' && typeof Storage.getTiposFiscalizacion === 'function')
                  ? Storage.getTiposFiscalizacion()
                  : [];

                return `<div style="position: relative; padding-left: 1.5rem; border-left: 2px solid var(--border-color); display: flex; flex-direction: column; gap: 1.5rem; margin-left: 0.5rem; margin-top: 1rem;">
                  ${accionesRutina.map(a => {
                    const obligacion = DATA.getObligacionFuncionario(a.tipo);
                    const tf = tiposFiscalizacion.find(t => t.id === a.tipo);
                    const tituloExacto = a.tipoNombre || (tf ? tf.nombre : (obligacion ? obligacion.nombre : (a.tipo || 'Fiscalización')));
                    
                    return `
                      <div style="position: relative;">
                        <span style="position: absolute; left: -1.9rem; top: 0.3rem; background: var(--primary); width: 10px; height: 10px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 0 2px var(--primary);"></span>
                        <div style="background: white; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                          <div class="flex justify-between items-center mb-2">
                            <span class="badge" style="background: #f1f5f9; color: #334155; font-weight: 600; font-size: 0.8rem; padding: 0.25rem 0.6rem; border-radius: 4px; border: 1px solid #cbd5e1;">
                              ${Storage.safeHtml(tituloExacto)}
                            </span>
                            <div class="flex items-center gap-2">
                              <span class="text-muted" style="font-size: 0.75rem;">${new Date(a.fecha).toLocaleString()}</span>
                              ${(typeof Auth.canManageFuncionarios === 'function' ? Auth.canManageFuncionarios() : (Auth.canWriteFuncionarios ? Auth.canWriteFuncionarios() : true)) ? `
                                <button class="btn btn-sm btn-secondary" onclick="FuncionariosView.editarAccion('${a.id}', '${a.funcionarioId}')" style="padding: 0.15rem 0.4rem; font-size: 0.7rem; border-radius: 4px;">Editar</button>
                              ` : ''}
                            </div>
                          </div>
                          ${a.descripcion ? `<p style="margin: 0.5rem 0 0 0; font-size: 0.875rem; color: var(--text-primary); line-height: 1.4; white-space: pre-wrap;">${Storage.safeHtml(a.descripcion)}</p>` : ''}
                          <div class="text-xs text-muted mt-2" style="font-size: 0.72rem; color: #64748b;">
                            Registrado por: ${Storage.safeHtml(a.registradoPor || a.registrado_por || a.autorNombre || 'Administrador Principal')}
                          </div>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>`
              })()}
            </div>
          </div>
        </div>
      </div>
    `;
    
    container.innerHTML = html;

    setTimeout(() => {
      this.renderFuncionarioChart(acciones, 'chart-func-container');
      this.renderFuncionarioCalendar(acciones, 'calendar-func-container', f.id);
    }, 100);
  },
  
  renderFuncionarioChart(acciones, canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;

    if (window.funcionarioChartInstance) {
      window.funcionarioChartInstance.destroy();
    }

    const tiposFiscalizacion = (typeof Storage !== 'undefined' && typeof Storage.getTiposFiscalizacion === 'function')
      ? Storage.getTiposFiscalizacion()
      : [
          { id: 'rutina_tarde', nombre: 'Llegada tarde al aula', vincularUtp: false },
          { id: 'rutina_leccionario', nombre: 'Sin leccionario', vincularUtp: true },
          { id: 'rutina_planificacion', nombre: 'Sin planificación', vincularUtp: true },
          { id: 'rutina_evaluacion', nombre: 'Sin evaluación', vincularUtp: true }
        ];

    const counts = {};
    tiposFiscalizacion.forEach(t => { counts[t.id] = 0; });

    const currentYear = this.currentCalendarYear !== undefined ? this.currentCalendarYear : new Date().getFullYear();
    const currentMonth = this.currentCalendarMonth !== undefined ? this.currentCalendarMonth : new Date().getMonth();

    acciones.forEach(a => {
      const d = new Date(a.fecha);
      if (isNaN(d.getTime())) return;
      
      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
        if (counts[a.tipo] !== undefined) {
          counts[a.tipo]++;
        }
      }
    });

    const shortLabels = tiposFiscalizacion.map((_, i) => `#${i + 1}`);
    const fullNames = tiposFiscalizacion.map(t => t.nombre);
    const dataValues = tiposFiscalizacion.map(t => counts[t.id] || 0);

    const colors = [
      'rgba(239, 68, 68, 0.85)',
      'rgba(245, 158, 11, 0.85)',
      'rgba(59, 130, 246, 0.85)',
      'rgba(139, 92, 246, 0.85)',
      'rgba(16, 185, 129, 0.85)',
      'rgba(236, 72, 153, 0.85)',
      'rgba(99, 102, 241, 0.85)'
    ];
    const borderColors = [
      '#ef4444',
      '#f59e0b',
      '#3b82f6',
      '#8b5cf6',
      '#10b981',
      '#ec4899',
      '#6366f1'
    ];

    const ctx = canvas.getContext('2d');
    window.funcionarioChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: fullNames,
        datasets: [
          {
            label: 'Registros',
            data: dataValues,
            backgroundColor: fullNames.map((_, i) => colors[i % colors.length]),
            borderColor: fullNames.map((_, i) => borderColors[i % borderColors.length]),
            borderWidth: 1.5,
            borderRadius: 6,
            borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            top: 10,
            bottom: 5,
            left: 5,
            right: 5
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              display: false
            }
          },
          y: {
            beginAtZero: true,
            min: 0,
            suggestedMax: Math.max(3, ...dataValues) + 1,
            ticks: { precision: 0, font: { size: 11 }, color: '#64748b' },
            grid: { color: '#f1f5f9' }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            titleFont: { size: 13, weight: 'bold' },
            bodyFont: { size: 12 },
            padding: 10,
            cornerRadius: 6,
            callbacks: {
              title: (items) => {
                const idx = items[0].dataIndex;
                return fullNames[idx];
              },
              label: (item) => ` Total eventos: ${item.raw}`
            }
          }
        }
      }
    });

    // Renderizar Cuadro de Leyenda Inferior Explicativo Limpio
    let legendContainer = document.getElementById(canvasId + '-legend');
    if (!legendContainer) {
      legendContainer = document.createElement('div');
      legendContainer.id = canvasId + '-legend';
      canvas.parentNode.appendChild(legendContainer);
    }

    legendContainer.innerHTML = `
      <div style="margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 0.4rem;">
        <span style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.2rem;">📌 Referencia de Eventos (Leyenda):</span>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.5rem;">
          ${tiposFiscalizacion.map((t, idx) => `
            <div style="display: flex; align-items: center; gap: 0.5rem; background: #f8fafc; padding: 0.4rem 0.65rem; border-radius: 6px; border: 1px solid var(--border-color); font-size: 0.82rem;">
              <span style="width: 12px; height: 12px; border-radius: 3px; background-color: ${borderColors[idx % borderColors.length]}; display: inline-block; flex-shrink: 0;"></span>
              <span style="color: #334155; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${Storage.safeHtml(t.nombre)}">${Storage.safeHtml(t.nombre)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  renderFuncionarioCalendar(acciones, containerId, funcionarioId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const hoy = new Date();
    if (this.currentCalendarYear === undefined) {
      this.currentCalendarYear = hoy.getFullYear();
      this.currentCalendarMonth = hoy.getMonth();
    }
    
    if (!this.currentCalendarPaintMode) {
      this.currentCalendarPaintMode = 'ausencia';
    }
    
    const mes = this.currentCalendarMonth;
    const anio = this.currentCalendarYear;
    const diasEnMes = new Date(anio, mes + 1, 0).getDate();
    
    const mesesNombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    let html = `
      <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center; font-weight: bold;">
          <button class="btn btn-sm btn-outline-secondary" onclick="FuncionariosView.cambiarMesCalendario(-1, '${funcionarioId}')">&lt;</button>
          <span>${mesesNombres[mes]} ${anio}</span>
          <button class="btn btn-sm btn-outline-secondary" onclick="FuncionariosView.cambiarMesCalendario(1, '${funcionarioId}')">&gt;</button>
        </div>
        <div style="display: flex; gap: 5px; flex-wrap: wrap; justify-content: center; font-size: 0.8rem;">
          <strong>Pincel:</strong>
          <label><input type="radio" name="paintMode" value="ausencia" ${this.currentCalendarPaintMode === 'ausencia' ? 'checked' : ''} onchange="FuncionariosView.currentCalendarPaintMode = this.value"> Ausencia</label>
          <label><input type="radio" name="paintMode" value="licencia" ${this.currentCalendarPaintMode === 'licencia' ? 'checked' : ''} onchange="FuncionariosView.currentCalendarPaintMode = this.value"> Licencia</label>
          <label><input type="radio" name="paintMode" value="permiso" ${this.currentCalendarPaintMode === 'permiso' ? 'checked' : ''} onchange="FuncionariosView.currentCalendarPaintMode = this.value"> Permiso</label>
          <label style="display: inline-flex; align-items: center; gap: 0.25rem;"><input type="radio" name="paintMode" value="none" ${this.currentCalendarPaintMode === 'none' ? 'checked' : ''} onchange="FuncionariosView.currentCalendarPaintMode = this.value"> <span style="display: inline-flex; align-items: center; gap: 0.15rem;">${Icons.get('eraser', 12)} Limpiar</span></label>
        </div>
      </div>
    `;
    
    html += '<div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; text-align: center;">';
    
    const diasSemana = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi'];
    diasSemana.forEach(d => {
      html += `<div style="font-size: 0.8rem; font-weight: bold; color: var(--text-muted); padding-bottom: 4px;">${d}</div>`;
    });

    const primerDiaFecha = new Date(anio, mes, 1);
    let primerDiaSemana = primerDiaFecha.getDay(); // 0 = Dom, 1 = Lun, ..., 6 = Sáb
    
    // Si cae en fin de semana, alinear el inicio al lunes
    if (primerDiaSemana === 0 || primerDiaSemana === 6) {
      primerDiaSemana = 1;
    }
    
    // Rellenar espacios vacíos antes del primer día laboral del mes (1 = Lun -> 0 espacios, 2 = Mar -> 1 espacio, etc.)
    const offsetInicial = primerDiaSemana - 1;
    for (let i = 0; i < offsetInicial; i++) {
      html += '<div></div>';
    }

    for (let d = 1; d <= diasEnMes; d++) {
      const fechaObj = new Date(anio, mes, d);
      const diaSemana = fechaObj.getDay();

      // Ocultar Fin de Semana (0 = Domingo, 6 = Sábado)
      if (diaSemana === 0 || diaSemana === 6) {
        continue;
      }

      const eventosDia = acciones.filter(a => {
        const ad = new Date(a.fecha);
        return ad.getFullYear() === anio && ad.getMonth() === mes && ad.getDate() === d && ['ausencia', 'licencia', 'permiso'].includes(a.tipo);
      });

      let bg = '#f8fafc';
      let border = '1px solid #e2e8f0';
      let title = '';

      if (eventosDia.length > 0) {
        const hasAusencia = eventosDia.some(e => e.tipo === 'ausencia');
        const hasLicencia = eventosDia.some(e => e.tipo === 'licencia');
        const hasPermiso = eventosDia.some(e => e.tipo === 'permiso');
        
        if (hasAusencia) { bg = '#fecaca'; border = '1px solid #ef4444'; }
        else if (hasLicencia) { bg = '#bfdbfe'; border = '1px solid #3b82f6'; }
        else if (hasPermiso) { bg = '#fef08a'; border = '1px solid #f59e0b'; }
        else { bg = '#e2e8f0'; border = '1px solid #94a3b8'; }
        
        title = eventosDia.map(e => DATA.getObligacionFuncionario(e.tipo)?.nombre || 'Evento').join(', ');
      }

      const isHoy = (d === hoy.getDate() && mes === hoy.getMonth() && anio === hoy.getFullYear()) ? 'font-weight: bold; text-decoration: underline;' : '';

      html += `<div title="${title}" style="padding: 0.45rem 0; border-radius: 4px; background: ${bg}; border: ${border}; cursor: pointer; font-size: 0.85rem; ${isHoy}" onclick="FuncionariosView.pintarAsistencia('${funcionarioId}', ${anio}, ${mes}, ${d})">${d}</div>`;
    }

    html += '</div>';
    html += `
      <div style="display: flex; flex-wrap: wrap; gap: 8px; font-size: 0.75rem; margin-top: 12px; justify-content: center;">
        <span style="display: flex; align-items: center; gap: 4px;"><span style="width:10px;height:10px;background:#fecaca;border:1px solid #ef4444;border-radius:2px;"></span> Ausencia</span>
        <span style="display: flex; align-items: center; gap: 4px;"><span style="width:10px;height:10px;background:#bfdbfe;border:1px solid #3b82f6;border-radius:2px;"></span> Licencia</span>
        <span style="display: flex; align-items: center; gap: 4px;"><span style="width:10px;height:10px;background:#fef08a;border:1px solid #f59e0b;border-radius:2px;"></span> Permiso</span>
      </div>
    `;
    container.innerHTML = html;
  },
  
  cambiarMesCalendario(delta, funcionarioId) {
    this.currentCalendarMonth += delta;
    if (this.currentCalendarMonth > 11) {
      this.currentCalendarMonth = 0;
      this.currentCalendarYear++;
    } else if (this.currentCalendarMonth < 0) {
      this.currentCalendarMonth = 11;
      this.currentCalendarYear--;
    }
    const acciones = Storage.getAccionesFuncionario(funcionarioId);
    this.renderFuncionarioCalendar(acciones, 'calendar-func-container', funcionarioId);
  },

  cambiarMesChart(mes, funcionarioId) {
    this.currentCalendarMonth = parseInt(mes, 10);
    const acciones = Storage.getAccionesFuncionario(funcionarioId);
    this.renderFuncionarioChart(acciones, 'chart-func-container');
    this.renderFuncionarioCalendar(acciones, 'calendar-func-container', funcionarioId);
  },

  async pintarAsistencia(funcionarioId, anio, mes, dia) {
    const acciones = Storage.getAccionesFuncionario(funcionarioId);
    const record = acciones.find(a => {
      const ad = new Date(a.fecha);
      return ad.getFullYear() === anio && ad.getMonth() === mes && ad.getDate() === dia && ['ausencia', 'licencia', 'permiso'].includes(a.tipo);
    });

    const tipo = this.currentCalendarPaintMode || 'ausencia';

    if (record) {
      await Storage.deleteAccionFuncionario(record.id);
    }

    if (tipo !== 'none') {
      const loggedUser = Auth.userProfile?.nombres 
        ? `${Auth.userProfile.nombres} ${Auth.userProfile.apellidos || ''}` 
        : (Auth.currentUser?.email || 'Sistema');
      
      const dateObj = new Date(anio, mes, dia, 12, 0, 0);
      
      const accion = {
        funcionarioId: funcionarioId,
        tipo: tipo,
        fecha: dateObj.toISOString(),
        descripcion: 'Registro rápido desde calendario',
        autorId: Auth.currentUser ? Auth.currentUser.uid : 'anon',
        registradoPor: loggedUser
      };
      await Storage.saveAccionFuncionario(accion);
    }
    
    this.renderDetalle(document.getElementById('app-content'), funcionarioId);
  },

  vincularEvento(funcionarioId) {
    const html = `
      <form id="form-vincular-evento" onsubmit="event.preventDefault(); FuncionariosView.guardarEventoPositivo('${funcionarioId}')">
        <div class="form-group mb-3">
          <label class="form-label">Motivo (Ej: Felicitación, Proyecto, Innovación) *</label>
          <input type="text" id="ev-motivo" class="form-control" required placeholder="Motivo del acontecimiento">
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Descripción *</label>
          <textarea id="ev-desc" class="form-control" rows="4" required placeholder="Detalle del acontecimiento..."></textarea>
        </div>
      </form>
    `;
    
    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="document.getElementById('form-vincular-evento').requestSubmit()">Guardar Acontecimiento</button>
    `;
    
    App.openModal('Vincular Acontecimiento Positivo', html, footer);
  },

  async guardarEventoPositivo(funcionarioId) {
    const motivo = document.getElementById('ev-motivo').value;
    const descripcion = document.getElementById('ev-desc').value;
    const loggedUser = Auth.userProfile?.nombres 
      ? `${Auth.userProfile.nombres} ${Auth.userProfile.apellidos || ''}` 
      : (Auth.currentUser?.email || 'Administrador Principal');
    
    const evento = {
      funcionarioId: funcionarioId,
      titulo: motivo,
      descripcion: descripcion,
      fecha: new Date().toISOString(),
      targetType: 'funcionario',
      tipo: 'positiva',
      registradoPor: loggedUser
    };
    
    await Storage.saveEvento(evento);
    App.closeModal();
    App.showToast('Acontecimiento registrado exitosamente', 'success');
    this.renderDetalle(document.getElementById('app-content'), funcionarioId);
  },

  editarEventoAsociado(eventoId, funcionarioId) {
    const eventos = typeof Storage.getEventosByFuncionario === 'function' ? Storage.getEventosByFuncionario(funcionarioId) : [];
    let evento = eventos.find(e => e.id === eventoId);
    if (!evento && Storage.cache && Storage.cache.eventos) {
      evento = Storage.cache.eventos.find(e => e.id === eventoId);
    }
    if (!evento) {
      App.showToast('Evento asociado no encontrado', 'warning');
      return;
    }

    const html = `
      <form id="form-edit-evento-asociado" onsubmit="event.preventDefault(); FuncionariosView.guardarEdicionEventoAsociado('${eventoId}', '${funcionarioId}')">
        <div class="form-group mb-3">
          <label class="form-label">Motivo / Título del Acontecimiento *</label>
          <input type="text" id="edit-ev-motivo" class="form-control" value="${evento.titulo || evento.tipo || ''}" required placeholder="Motivo del acontecimiento">
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Descripción *</label>
          <textarea id="edit-ev-desc" class="form-control" rows="4" required placeholder="Detalle del acontecimiento...">${evento.descripcion || ''}</textarea>
        </div>
      </form>
    `;
    
    const footer = `
      <button class="btn btn-secondary text-danger mr-auto" onclick="FuncionariosView.eliminarEventoAsociado('${eventoId}', '${funcionarioId}')" style="margin-right: auto;">🗑️ Eliminar</button>
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="document.getElementById('form-edit-evento-asociado').requestSubmit()">Guardar Cambios</button>
    `;
    
    App.openModal('Editar Acontecimiento / Evento Asociado', html, footer);
  },

  async guardarEdicionEventoAsociado(eventoId, funcionarioId) {
    const eventos = typeof Storage.getEventosByFuncionario === 'function' ? Storage.getEventosByFuncionario(funcionarioId) : [];
    let evento = eventos.find(e => e.id === eventoId);
    if (!evento && Storage.cache && Storage.cache.eventos) {
      evento = Storage.cache.eventos.find(e => e.id === eventoId);
    }
    if (!evento) {
      App.closeModal();
      return;
    }

    evento.titulo = document.getElementById('edit-ev-motivo').value.trim();
    evento.descripcion = document.getElementById('edit-ev-desc').value.trim();

    await Storage.saveEvento(evento);
    App.closeModal();
    App.showToast('Evento actualizado exitosamente', 'success');
    this.renderDetalle(document.getElementById('app-content'), funcionarioId);
  },

  eliminarEventoAsociado(eventoId, funcionarioId) {
    App.showConfirm('Eliminar Evento Asociado', '¿Estás seguro de que deseas eliminar este evento asociado?', async () => {
      await Storage.deleteEvento(eventoId);
      if (Storage.cache && Storage.cache.eventos) {
        Storage.cache.eventos = Storage.cache.eventos.filter(e => e.id !== eventoId && String(e.id) !== String(eventoId));
      }
      if (Storage.localMutations && Storage.localMutations.eventos) {
        delete Storage.localMutations.eventos[eventoId];
        delete Storage.localMutations.eventos[String(eventoId)];
        Storage.persistLocalMutations();
      }
      App.closeModal();
      App.showToast('Evento eliminado con éxito', 'success');
      this.renderDetalle(document.getElementById('app-content'), funcionarioId);
    });
  },

  renderAccionItem(accion) {
    const obligacion = DATA.getObligacionFuncionario(accion.tipo);
    
    return `
      <div class="anotacion-item" style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem; border-left: 4px solid ${accion.tipo === 'positiva' ? 'var(--success)' : 'var(--primary)'};">
        <div class="flex justify-between items-start mb-2">
          <div>
            <span class="badge" style="background: var(--bg-hover); color: var(--text-primary); border: 1px solid var(--border-color);">
              ${obligacion ? obligacion.nombre : 'Acción General'}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-muted" style="font-size: 0.75rem;">${new Date(accion.fecha).toLocaleString()}</span>
            ${Auth.currentRole === 'admin' || accion.autorId === Auth.currentUser.uid ? `
            <button class="btn btn-sm btn-secondary" onclick="FuncionariosView.editarAccion('${accion.id}', '${accion.funcionarioId}')" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">Editar</button>
            ` : ''}
          </div>
        </div>
        ${accion.descripcion ? `<p style="margin: 0.5rem 0; font-size: 0.875rem; white-space: pre-wrap;">${accion.descripcion}</p>` : ''}
        <div class="text-muted" style="font-size: 0.725rem; margin-top: 4px; border-top: 1px dashed #e2e8f0; padding-top: 4px;">
          Registrado por: <b>${accion.registradoPor || 'Sistema'}</b>
        </div>
      </div>
    `;
  },
  
  nuevoFuncionario() {
    const html = `
      <form id="form-funcionario" onsubmit="event.preventDefault(); FuncionariosView.guardarFuncionario()">
        <div class="form-group">
          <label class="form-label">Nombres *</label>
          <input type="text" id="func-nombres" class="form-control" required>
        </div>
        <div class="form-group">
          <label class="form-label">Apellidos *</label>
          <input type="text" id="func-apellidos" class="form-control" required>
        </div>
        <div class="form-group">
          <label class="form-label">RUT * (Sin puntos, ej: 12345678-9)</label>
          <input type="text" id="func-rut" class="form-control" placeholder="12345678-9" required autocomplete="off">
          <div id="func-rut-feedback" class="mt-1"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Fecha de Nacimiento *</label>
          <input type="date" id="func-fecha-nacimiento" class="form-control" required>
        </div>
        <div class="form-group">
          <label class="form-label">Categoría *</label>
          <select id="func-cat" class="form-control" required>
            <option value="">Seleccione...</option>
            ${DATA.categoriasFuncionario.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Cargo / Rol principal</label>
          <input type="text" id="func-cargo" class="form-control" placeholder="Ej: Profesor Jefe 4° Básico, Psicólogo, etc.">
        </div>
      </form>
    `;
    
    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="document.getElementById('form-funcionario').requestSubmit()">Guardar</button>
    `;
    
    App.openModal('Añadir Funcionario', html, footer);
    setTimeout(() => {
      Validator.attachRutInputHandler('func-rut', 'func-rut-feedback');
    }, 50);
  },
  
  async guardarFuncionario() {
    const rawRut = document.getElementById('func-rut').value;
    const formattedRut = Validator.formatRutWithoutDots(rawRut);
    if (!Validator.isValidRut(formattedRut)) {
      App.showToast('El RUT ingresado no es válido (ejemplo correcto: 12345678-5).', 'error');
      return;
    }
    
    const existe = (Storage.getFuncionarios() || []).some(f => f.rut === formattedRut);
    if (existe) {
      App.showToast('El RUT ingresado ya se encuentra registrado para otro funcionario.', 'danger');
      return;
    }

    const func = {
      nombres: document.getElementById('func-nombres').value,
      apellidos: document.getElementById('func-apellidos').value,
      rut: formattedRut,
      fechaNacimiento: document.getElementById('func-fecha-nacimiento').value,
      categoria: document.getElementById('func-cat').value,
      cargo: document.getElementById('func-cargo').value
    };
    
    await Storage.saveFuncionario(func);
    App.closeModal();
    App.showToast('Funcionario añadido', 'success');
    this.renderList(document.getElementById('app-content'));
  },

  editar(id) {
    const f = Storage.getFuncionarioById(id);
    if(!f) return;
    
    const html = `
      <form id="form-edit-func" onsubmit="event.preventDefault(); FuncionariosView.guardarEdicion('${id}')">
        <div class="form-group">
          <label class="form-label">Nombres *</label>
          <input type="text" id="edit-f-nombres" class="form-control" value="${f.nombres}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Apellidos *</label>
          <input type="text" id="edit-f-apellidos" class="form-control" value="${f.apellidos}" required>
        </div>
        <div class="form-group">
          <label class="form-label">RUT * (Sin puntos, ej: 12345678-9)</label>
          <input type="text" id="edit-f-rut" class="form-control" value="${f.rut || ''}" placeholder="12345678-9" required autocomplete="off">
          <div id="edit-f-rut-feedback" class="mt-1"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Fecha de Nacimiento *</label>
          <input type="date" id="edit-f-fecha-nacimiento" class="form-control" value="${f.fechaNacimiento || ''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Categoría *</label>
          <select id="edit-f-cat" class="form-control" required>
            ${DATA.categoriasFuncionario.map(c => `<option value="${c.id}" ${f.categoria===c.id?'selected':''}>${c.nombre}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Cargo / Rol principal</label>
          <input type="text" id="edit-f-cargo" class="form-control" value="${f.cargo || ''}">
        </div>
      </form>
    `;
    
    const footer = `
      <button class="btn btn-secondary text-danger mr-auto" onclick="FuncionariosView.eliminar('${id}')" style="margin-right: auto;">Eliminar</button>
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="document.getElementById('form-edit-func').requestSubmit()">Guardar Cambios</button>
    `;
    
    App.openModal('Editar Funcionario', html, footer);
    setTimeout(() => {
      Validator.attachRutInputHandler('edit-f-rut', 'edit-f-rut-feedback');
    }, 50);
  },

  guardarEdicion(id) {
    const f = Storage.getFuncionarioById(id);
    const rawRut = document.getElementById('edit-f-rut').value;
    const formattedRut = Validator.formatRutWithoutDots(rawRut);
    if (!Validator.isValidRut(formattedRut)) {
      App.showToast('El RUT ingresado no es válido (ejemplo correcto: 12345678-5).', 'error');
      return;
    }

    const existe = (Storage.getFuncionarios() || []).some(item => item.id !== id && item.rut === formattedRut);
    if (existe) {
      App.showToast('El RUT ingresado ya se encuentra registrado para otro funcionario.', 'danger');
      return;
    }

    f.nombres = document.getElementById('edit-f-nombres').value;
    f.apellidos = document.getElementById('edit-f-apellidos').value;
    f.rut = formattedRut;
    f.fechaNacimiento = document.getElementById('edit-f-fecha-nacimiento').value;
    f.categoria = document.getElementById('edit-f-cat').value;
    f.cargo = document.getElementById('edit-f-cargo').value;
    
    Storage.saveFuncionario(f);
    App.closeModal();
    App.showToast('Datos actualizados', 'success');
    this.renderDetalle(document.getElementById('app-content'), id);
  },

  eliminar(id) {
    App.confirm('Eliminar Funcionario', '¿Está seguro de eliminar este registro?', () => {
      Storage.deleteFuncionario(id);
      App.closeModal();
      App.showToast('Funcionario eliminado', 'success');
      window.location.hash = '#/funcionarios';
    });
  },

  nuevaAccion(funcionarioId) {
    const hoy = new Date().toISOString().split('T')[0];
    const tiposFiscalizacion = (typeof Storage !== 'undefined' && typeof Storage.getTiposFiscalizacion === 'function')
      ? Storage.getTiposFiscalizacion()
      : [
          { id: 'rutina_tarde', nombre: 'Llegada tarde al aula / Inasistencia a clase' },
          { id: 'rutina_leccionario', nombre: 'No posee o no llena leccionario' },
          { id: 'rutina_planificacion', nombre: 'No posee o no entrega planificaciones (UTP)' },
          { id: 'rutina_evaluacion', nombre: 'No envía o entrega evaluaciones a tiempo' }
        ];

    const html = `
      <form id="form-accion" onsubmit="event.preventDefault(); FuncionariosView.guardarAccion('${funcionarioId}')">
        <div class="form-group mb-3">
          <label class="form-label">Tipo de Evento *</label>
          <select id="acc-tipo" class="form-control" required>
            <option value="">Seleccione...</option>
            ${tiposFiscalizacion.map(t => `<option value="${t.id}">${t.nombre}${t.vincularUtp ? ' (UTP)' : ''}</option>`).join('')}
          </select>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Fecha del Evento *</label>
          <input type="date" id="acc-fecha" class="form-control" value="${hoy}" required>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Detalle o Observación</label>
          <textarea id="acc-desc" class="form-control" rows="3" placeholder="Detalle la situación..."></textarea>
        </div>
      </form>
    `;
    
    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="document.getElementById('form-accion').requestSubmit()">Guardar</button>
    `;
    
    App.openModal('Registrar Fiscalización', html, footer);
  },

  async guardarAccion(funcionarioId) {
    const loggedUser = Auth.userProfile?.nombres 
      ? `${Auth.userProfile.nombres} ${Auth.userProfile.apellidos || ''}` 
      : (Auth.currentUser?.email || 'Sistema');

    const fechaSeleccionada = document.getElementById('acc-fecha').value;
    const dateObj = new Date(fechaSeleccionada);
    const ahora = new Date();
    dateObj.setHours(ahora.getHours(), ahora.getMinutes(), ahora.getSeconds(), ahora.getMilliseconds());

    const selectEl = document.getElementById('acc-tipo');
    const tipoVal = selectEl ? selectEl.value : '';
    const selectedOptionText = selectEl && selectEl.selectedIndex >= 0 ? selectEl.options[selectEl.selectedIndex].text : '';

    const tiposFiscalizacion = (typeof Storage !== 'undefined' && typeof Storage.getTiposFiscalizacion === 'function')
      ? Storage.getTiposFiscalizacion()
      : [];
    const tf = tiposFiscalizacion.find(t => t.id === tipoVal);
    const obligacion = DATA.getObligacionFuncionario(tipoVal);
    const tipoNombreExacto = tf ? tf.nombre : (selectedOptionText || (obligacion ? obligacion.nombre : tipoVal));

    const accion = {
      funcionarioId: funcionarioId,
      tipo: tipoVal,
      tipoNombre: tipoNombreExacto,
      fecha: dateObj.toISOString(),
      descripcion: document.getElementById('acc-desc').value.trim(),
      autorId: Auth.currentUser ? Auth.currentUser.uid : 'admin',
      registradoPor: loggedUser
    };
    
    const saved = await Storage.saveAccionFuncionario(accion);
    if (saved) {
      App.closeModal();
      App.showToast('Fiscalización registrada', 'success');
      this.renderDetalle(document.getElementById('app-content'), funcionarioId);
    }
  },

  editarAccion(accionId, funcionarioId) {
    const acciones = Storage.getAccionesFuncionario(funcionarioId);
    const accion = acciones.find(a => a.id === accionId);
    if (!accion) {
      App.showToast('Registro de fiscalización no encontrado', 'warning');
      return;
    }

    const d = new Date(accion.fecha || Date.now());
    const fechaStr = isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0];

    const tiposFiscalizacion = (typeof Storage !== 'undefined' && typeof Storage.getTiposFiscalizacion === 'function')
      ? Storage.getTiposFiscalizacion()
      : [];

    let opciones = tiposFiscalizacion;
    if (opciones.length === 0) {
      opciones = [
        { id: 'rutina_tarde', nombre: 'Llegada tarde al aula / Inasistencia a clase' },
        { id: 'rutina_leccionario', nombre: 'No posee o no llena leccionario' },
        { id: 'rutina_planificacion', nombre: 'No posee o no entrega planificaciones (UTP)' },
        { id: 'rutina_evaluacion', nombre: 'No envía o entrega evaluaciones a tiempo' }
      ];
    }

    // Asegurar que si la acción tiene un id personalizado no presente en la lista por defecto, se incluya
    if (accion.tipo && !opciones.some(o => o.id === accion.tipo)) {
      opciones.unshift({ id: accion.tipo, nombre: accion.tipoNombre || accion.tipo });
    }

    const html = `
      <form id="form-edit-accion" onsubmit="event.preventDefault(); FuncionariosView.guardarEdicionAccion('${accionId}', '${funcionarioId}')">
        <div class="form-group mb-3">
          <label class="form-label">Tipo de Evento *</label>
          <select id="edit-acc-tipo" class="form-control" required>
            <option value="">Seleccione...</option>
            ${opciones.map(t => `<option value="${t.id}" ${accion.tipo === t.id ? 'selected' : ''}>${t.nombre}${t.vincularUtp ? ' (UTP)' : ''}</option>`).join('')}
          </select>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Fecha del Evento *</label>
          <input type="date" id="edit-acc-fecha" class="form-control" value="${fechaStr}" required>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Detalle u Observación</label>
          <textarea id="edit-acc-desc" class="form-control" rows="3" placeholder="Detalle la situación...">${accion.descripcion || ''}</textarea>
        </div>
      </form>
    `;
    
    const footer = `
      <button class="btn btn-secondary text-danger mr-auto" onclick="FuncionariosView.eliminarAccion('${accionId}', '${funcionarioId}')" style="margin-right: auto;">🗑️ Eliminar</button>
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="document.getElementById('form-edit-accion').requestSubmit()">Guardar Cambios</button>
    `;
    
    App.openModal('Editar Fiscalización / Registro', html, footer);
  },

  async guardarEdicionAccion(accionId, funcionarioId) {
    const acciones = Storage.getAccionesFuncionario(funcionarioId);
    let accion = acciones.find(a => a.id === accionId);
    if (!accion) {
      accion = Storage.getAccionFuncionarioById ? Storage.getAccionFuncionarioById(accionId) : null;
    }
    if (!accion) {
      App.closeModal();
      return;
    }

    const fechaSeleccionada = document.getElementById('edit-acc-fecha').value;
    const dateObj = new Date(fechaSeleccionada);
    const ahora = new Date();
    dateObj.setHours(ahora.getHours(), ahora.getMinutes(), ahora.getSeconds());

    const selectEl = document.getElementById('edit-acc-tipo');
    const tipoVal = selectEl ? selectEl.value : '';
    const selectedOptionText = selectEl && selectEl.selectedIndex >= 0 ? selectEl.options[selectEl.selectedIndex].text : '';

    const tiposFiscalizacion = (typeof Storage !== 'undefined' && typeof Storage.getTiposFiscalizacion === 'function')
      ? Storage.getTiposFiscalizacion()
      : [];
    const tf = tiposFiscalizacion.find(t => t.id === tipoVal);
    const obligacion = DATA.getObligacionFuncionario(tipoVal);
    const tipoNombreExacto = tf ? tf.nombre : (selectedOptionText || (obligacion ? obligacion.nombre : tipoVal));

    accion.tipo = tipoVal;
    accion.tipoNombre = tipoNombreExacto;
    accion.fecha = dateObj.toISOString();
    accion.descripcion = document.getElementById('edit-acc-desc').value.trim();

    await Storage.saveAccion(accion);
    App.closeModal();
    App.showToast('Registro de fiscalización actualizado', 'success');
    this.renderDetalle(document.getElementById('app-content'), funcionarioId);
  },

  eliminarAccion(accionId, funcionarioId) {
    App.showConfirm('Eliminar Fiscalización', '¿Estás seguro de que deseas eliminar este registro de fiscalización?', async () => {
      if (Storage.deleteAccion) await Storage.deleteAccion(accionId);
      if (Storage.deleteAccionFuncionario) await Storage.deleteAccionFuncionario(accionId);

      if (Storage.cache && Storage.cache.acciones) {
        Storage.cache.acciones = Storage.cache.acciones.filter(a => a.id !== accionId && String(a.id) !== String(accionId));
      }

      App.closeModal();
      App.showToast('Registro eliminado con éxito', 'success');
      this.renderDetalle(document.getElementById('app-content'), funcionarioId);
    });
  },
  async generarInformeIA(funcionarioId, event) {
    const f = Storage.getFuncionarioById(funcionarioId);
    if (!f) return;
    
    App.showToast('Flujo IA Backend: usa el panel de asistencia IA.', 'info');

    if (!Auth.geminiCheck()) {
      App.showToast('IA temporalmente bloqueada por errores repetidos. Espera 60s.', 'warning');
      return;
    }

    const btn = event.currentTarget;
    const acciones = Storage.getAccionesFuncionario(funcionarioId);
    
    if (acciones.length === 0) {
      App.showToast('No hay registros en la bitácora para analizar.', 'warning');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '🤖 Analizando...';
    
    try {
      const docs = Storage.getDocumentos();
      let context = 'DOCUMENTOS NORMATIVOS INSTITUCIONALES:\n';
      const categoriaFunc = DATA.categoriasFuncionario.find(c => c.id === f.categoria);
      const esDirectivo = categoriaFunc?.nombre?.toLowerCase().includes('directivo') || false;
      const docRelevantes = docs.filter(d => {
        if (d.categoria === 'RICE' || d.categoria === 'HIGIENE' || d.categoria === 'PEI') return true;
        if (esDirectivo && d.categoria === 'MBD') return true;
        if (!esDirectivo && d.categoria === 'MBE') return true;
        return false;
      });
      
      for (const doc of docRelevantes) {
        context += `\n\n--- Documento: ${doc.nombre} (${doc.categoria}) ---\n${doc.texto || doc.textoExtraido || ''}`;
      }

      let promptText = `Actúa como mi Asesor Directivo Escolar experto en gestión de personas y normativas RICE/MBE/MBD.
Genera un Informe de Desempeño Ejecutivo. Tu respuesta no debe superar las 160 palabras. Debes usar negritas obligatoriamente en los conceptos clave.
Evita citar leyes específicas (como Ley 20.536, etc.).

Estructura obligatoria exacta:
# Informe Ejecutivo de Desempeño
**Funcionario:** ${f.nombres} ${f.apellidos} - ${categoriaFunc ? categoriaFunc.nombre : 'Sin cargo'}

### 1. Hallazgos Principales
* **Fortalezas:** [Escribir puntos positivos del funcionario y su labor]
* **Faltas operativas:** [Escribir fallas, atrasos o incidencias de la bitácora]

### 2. Impacto Clave (Sin citar leyes específicas)
* **RICE:** [Faltas a deberes, convivencia o normas internas]
* **Higiene y Seguridad:** [Riesgos, descuidos o vulneración del deber de cuidado]
* **Marco para la Buena Enseñanza / Dirección:** [Contraste entre su nivel de cumplimiento esperado y su compromiso real]

### 3. Impacto Institucional
* [Escribir de forma resumida el impacto que causan estas faltas en la seguridad o clima del colegio]

### 4. Acción Sugerida para Dirección
* [Escribir recomendación de medida concreta con un plazo de seguimiento]

Contexto de la Institución:
${context}

Datos del Funcionario:
Nombre: ${f.nombres} ${f.apellidos}
Cargo: ${categoriaFunc ? categoriaFunc.nombre : 'Sin cargo'}

Bitácora de Fiscalización:
`;
      acciones.sort((a,b) => new Date(b.fecha) - new Date(a.fecha)).forEach(a => {
        const obsObj = DATA.getObligacionFuncionario(a.tipo);
        promptText += `- ${new Date(a.fecha).toLocaleDateString()}: ${obsObj ? obsObj.nombre : 'Falta'}. Detalle: ${a.descripcion || ''}\n`;
      });

      promptText += "\nObservaciones / Anotaciones al funcionario:\n";
      if (!f.observaciones || f.observaciones.length === 0) {
        promptText += "Sin observaciones adicionales.\n";
      } else {
        f.observaciones.forEach(o => {
          promptText += `- ${new Date(o.fecha).toLocaleDateString()}: ${o.texto}\n`;
        });
      }

      const aiResponse = await AIClient.call(
        'Eres un generador de informes de desempeño ejecutivo.',
        promptText,
        { timeout: 60000 }
      );

      this.mostrarDrawerInforme(`Informe Desempeño IA`, aiResponse);
      App.showToast('Informe IA cargado en el panel lateral', 'success');
      Auth.geminiSuccess();
    } catch (error) {

      Auth.geminiFail();
      App.showToast(`Error al generar informe: ${error.message}`, 'danger');

    } finally {
      btn.disabled = false;
      btn.innerHTML = '🤖 Generar Informe';
    }
  },

  mostrarDrawerInforme(title, markdownText) {
    const old = document.getElementById('funcionario-informe-drawer');
    if (old) old.remove();
    
    const parsedHtml = typeof marked !== 'undefined' ? marked.parse(markdownText) : markdownText.replace(/\n/g, '<br>');
    
    const drawer = document.createElement('div');
    drawer.id = 'funcionario-informe-drawer';
    drawer.style.position = 'fixed';
    drawer.style.top = '0';
    drawer.style.right = '0';
    drawer.style.width = '460px';
    drawer.style.maxWidth = '100vw';
    drawer.style.height = '100vh';
    drawer.style.background = 'white';
    drawer.style.boxShadow = '-5px 0 25px rgba(0,0,0,0.15)';
    drawer.style.zIndex = '10000';
    drawer.style.display = 'flex';
    drawer.style.flexDirection = 'column';
    
    drawer.innerHTML = `
      <div style="padding: 1.2rem; display: flex; justify-content: space-between; align-items: center; background: var(--primary); color: white;">
        <h3 style="margin: 0; font-size: 1.1rem; color: white;">🤖 ${title}</h3>
        <button onclick="document.getElementById('funcionario-informe-drawer').remove()" style="background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer;">&times;</button>
      </div>
      <div style="padding: 1.5rem; flex: 1; overflow-y: auto; font-size: 0.9rem; line-height: 1.5; color: var(--text-primary);">
        ${parsedHtml}
      </div>
      <div style="padding: 1rem; border-top: 1px solid var(--border-color); display: flex; gap: 0.5rem; background: #f8fafc;">
        <button class="btn btn-primary" onclick="FuncionariosView.copiarAlPortapapeles()" style="width: 100%;">📋 Copiar Información</button>
        <button class="btn btn-secondary" onclick="document.getElementById('funcionario-informe-drawer').remove()" style="width: 100%;">Cerrar</button>
      </div>
    `;
    
    drawer.setAttribute('data-markdown', markdownText);
    document.body.appendChild(drawer);
  },
  
  copiarAlPortapapeles() {
    const drawer = document.getElementById('funcionario-informe-drawer');
    if (!drawer) return;
    const text = drawer.getAttribute('data-markdown');
    navigator.clipboard.writeText(text).then(() => {
      App.showToast('¡Copiado al portapapeles con éxito!', 'success');
    }).catch(err => {

      App.showToast('Error al copiar al portapapeles', 'error');
    });
  },

  async guardarObservacionFuncionario(id) {
    const texto = document.getElementById('nueva-obs-func').value.trim();
    if (!texto) return;
    const f = Storage.getFuncionarioById(id);
    if (!f) return;
    
    const loggedUser = Auth.userProfile?.nombres 
      ? `${Auth.userProfile.nombres} ${Auth.userProfile.apellidos || ''}` 
      : (Auth.currentUser?.email || 'Sistema');

    f.observaciones = f.observaciones || [];
    f.observaciones.push({
      id: Date.now().toString(),
      fecha: new Date().toISOString(),
      texto: texto,
      autorId: Auth.currentUser.uid,
      registradoPor: loggedUser
    });
    const saved = await Storage.saveFuncionario(f);
    if (saved) {
      App.showToast('Observación añadida', 'success');
      this.renderDetalle(document.getElementById('app-content'), id);
    }
  },

  eliminarObservacionFuncionario(funcId, obsId) {
    App.confirm('Eliminar Observación', '¿Estás seguro de eliminar esta observación?', async () => {
      const f = Storage.getFuncionarioById(funcId);
      if (!f || !f.observaciones) return;
      
      // Validar permiso
      const obs = f.observaciones.find(o => o.id === obsId);
      if (obs && !Auth.canEditOrDelete(obs.autorId)) {
        App.showToast("No tienes permiso para eliminar esta observación", "danger");
        return;
      }
      
      f.observaciones = f.observaciones.filter(o => o.id !== obsId);
      const saved = await Storage.saveFuncionario(f);
      if (saved) {
        App.closeModal();
        App.showToast('Observación eliminada', 'success');
        this.renderDetalle(document.getElementById('app-content'), funcId);
      }
    });
  }
};
window.FuncionariosView = FuncionariosView;
})();
