/* ================================================================
   agenda.js — Módulo de Agenda Personal del Funcionario - Trigger
   ================================================================ */

(() => {
const AgendaView = (() => {
  let containerId = 'app-content';
  let isFormOpen = false;
  let tempFecha = '';
  let tempTitulo = '';
  let tempDesc = '';
  let tempInvitados = [];
  let editEventId = '';
  let tempDuracion = 60;

  let activeTab = 'semana'; // 'semana' or 'lista'
  let currentWeekStart = getMonday(new Date());

  function getMonday(d) {
    d = new Date(d);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  function getDaysOfWeek(monday) {
    const days = [];
    for (let i = 0; i < 5; i++) {
      const nextDay = new Date(monday);
      nextDay.setDate(monday.getDate() + i);
      days.push(nextDay);
    }
    return days;
  }

  function shiftWeek(weeks) {
    if (weeks === 0) {
      currentWeekStart = getMonday(new Date());
    } else {
      currentWeekStart.setDate(currentWeekStart.getDate() + (weeks * 7));
    }
    render();
  }

  function setTab(tab) {
    activeTab = tab;
    render();
  }

  function abrirFormularioConFecha(fechaStr) {
    isFormOpen = true;
    editEventId = '';
    tempFecha = fechaStr;
    tempTitulo = '';
    tempDesc = '';
    tempInvitados = [];
    tempDuracion = 60;
    render();
  }

  function editarEvento(id) {
    const ev = (Storage.cache?.eventos_agenda || []).find(e => e.id === id);
    if (!ev) return;

    isFormOpen = true;
    editEventId = ev.id;
    
    // Format to YYYY-MM-DDTHH:mm
    const d = new Date(ev.fechaHora);
    const offsetMs = d.getTimezoneOffset() * 60 * 1000;
    tempFecha = new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
    
    tempTitulo = ev.titulo;
    tempDesc = ev.descripcion || '';
    tempInvitados = (ev.invitados || []).map(i => i.id);
    tempDuracion = ev.duracionMinutos || ev.duracion_minutos || 60;
    
    App.closeModal(); // Close detail modal if open
    render();
  }

  function setTemp(field, val) {
    if (field === 'fecha') tempFecha = val;
    if (field === 'titulo') tempTitulo = val;
    if (field === 'desc') tempDesc = val;
    if (field === 'duracion') tempDuracion = val;
  }

  function handleResizeStart(e, ev, card, evDate) {
    const startY = e.clientY;
    const initialDuration = ev.duracionMinutos || ev.duracion_minutos || 60;
    
    const PX_PER_MINUTE = 80 / 60;
    const STEP_MINUTES = 15;

    const onMouseMove = (moveEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const deltaMinutes = deltaY / PX_PER_MINUTE;
      
      const roundedDeltaMinutes = Math.round(deltaMinutes / STEP_MINUTES) * STEP_MINUTES;
      const newDuration = Math.max(15, initialDuration + roundedDeltaMinutes);
      
      const newHeight = (newDuration * PX_PER_MINUTE) - 8;
      card.style.height = `${newHeight}px`;

      const evEndDate = new Date(evDate.getTime() + newDuration * 60 * 1000);
      const formattedStartTime = evDate.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
      const formattedEndTime = evEndDate.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
      
      const timeSpan = card.querySelector('.calendar-event-time');
      if (timeSpan) {
        timeSpan.innerText = `${formattedStartTime} - ${formattedEndTime}`;
      }
    };

    const onMouseUp = async () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      const finalHeight = parseFloat(card.style.height) + 8;
      const finalDuration = Math.max(15, Math.round(finalHeight / (80 / 60) / STEP_MINUTES) * STEP_MINUTES);

      if (finalDuration !== initialDuration) {
        ev.duracionMinutos = finalDuration;
        ev.duracion_minutos = finalDuration;
        
        if (typeof Storage !== 'undefined' && Storage.cache && Storage.cache.eventos_agenda) {
          const cached = Storage.cache.eventos_agenda.find(x => x.id === ev.id);
          if (cached) {
            cached.duracionMinutos = finalDuration;
            cached.duracion_minutos = finalDuration;
          }
        }

        try {
          const payload = Storage.injectColegioId(ev);
          const dbPayload = { ...payload };
          delete dbPayload.funcionarioId;
          delete dbPayload.organizadorEmail;
          delete dbPayload.organizadorNombre;
          dbPayload.fecha_hora = ev.fechaHora || ev.fecha_hora;
          delete dbPayload.fechaHora;
          delete dbPayload.colegioId;
          delete dbPayload.timestamp;

          dbPayload.duracion_minutos = finalDuration;
          delete dbPayload.duracionMinutos;

          const { error } = await window.supabaseGestion.from('eventos_agenda').upsert(dbPayload);
          if (error) throw error;
          
          App.showToast('Duración del evento actualizada.', 'success');
        } catch (err) {
          console.error('Error saving updated duration:', err);
          App.showToast('No se pudo guardar la nueva duración en la base de datos.', 'danger');
        }
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function updateFechaSeparada() {
    const dia = document.getElementById('agenda-fecha-dia').value;
    const hora = document.getElementById('agenda-fecha-hora').value;
    if (dia && hora) {
      tempFecha = `${dia}T${hora}`;
      const inputHidden = document.getElementById('agenda-fecha');
      if (inputHidden) inputHidden.value = tempFecha;
    } else {
      tempFecha = '';
      const inputHidden = document.getElementById('agenda-fecha');
      if (inputHidden) inputHidden.value = '';
    }
  }

  function toggleInvitado(id) {
    const idx = tempInvitados.indexOf(id);
    if (idx >= 0) {
      tempInvitados.splice(idx, 1);
    } else {
      tempInvitados.push(id);
    }
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

  function init() {
    render();
  }

  function render() {
    App.setBreadcrumb(`Mi Agenda Personal ${typeof BaritaHelp!=='undefined'?BaritaHelp.create('agenda'):''}`);
    const container = document.getElementById(containerId);
    if (!container) return;

    let datePart = '';
    let timePart = '';
    if (tempFecha && tempFecha.includes('T')) {
      const parts = tempFecha.split('T');
      datePart = parts[0];
      timePart = parts[1];
    }

    let html = `
      <!-- VISTA PRINCIPAL (LISTA O SEMANA) -->
      <div id="agenda-main-view" style="display: ${isFormOpen ? 'none' : 'block'};">
        <div class="header-actions">
          <div>
            <h2 style="display: inline-flex; align-items: center; gap: 0.5rem;">${Icons.get('calendar', 24)} Mi Agenda Personal</h2>
            <p class="text-secondary">Tus reuniones, entrevistas y compromisos.</p>
          </div>
        </div>

        <div class="calendar-views-tabs">
          <button class="calendar-tab-btn ${activeTab === 'semana' ? 'active' : ''}" onclick="window.AgendaView.setTab('semana')">Vista Semanal</button>
          <button class="calendar-tab-btn ${activeTab === 'lista' ? 'active' : ''}" onclick="window.AgendaView.setTab('lista')">Vista Lista</button>
        </div>
    `;

    if (activeTab === 'semana') {
      const days = getDaysOfWeek(currentWeekStart);
      const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const weekRangeLabel = `Semana del ${days[0].getDate()} de ${months[days[0].getMonth()]} al ${days[4].getDate()} de ${months[days[4].getMonth()]} (${days[0].getFullYear()})`;

      html += `
        <div class="calendar-navigator">
          <button class="btn btn-sm btn-secondary" onclick="window.AgendaView.shiftWeek(-1)">◀ Anterior</button>
          <button class="btn btn-sm btn-outline-secondary" onclick="window.AgendaView.shiftWeek(0)">Hoy</button>
          <button class="btn btn-sm btn-secondary" onclick="window.AgendaView.shiftWeek(1)">Siguiente ▶</button>
          <h3>${weekRangeLabel}</h3>
        </div>

        <div class="calendar-week-container">
          <div class="calendar-week-header">
            <div class="calendar-header-day">Hora</div>
            ${days.map(d => {
              const dayNames = ['Dom', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
              const isToday = new Date().toDateString() === d.toDateString();
              const style = isToday ? 'background: #eff6ff; color: var(--primary); font-weight:800;' : '';
              return `<div class="calendar-header-day" style="${style}">${dayNames[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}</div>`;
            }).join('')}
          </div>

          <div class="calendar-week-grid">
            <div class="calendar-time-label-col">
              ${Array.from({length: 10}).map((_, i) => {
                const hour = 8 + i;
                const padded = hour.toString().padStart(2, '0');
                return `<div class="calendar-time-label-cell">${padded}:00</div>`;
              }).join('')}
            </div>

            ${days.map((d, dayIndex) => {
              return `
                <div class="calendar-day-col" data-day="${dayIndex}">
                  ${Array.from({length: 20}).map((_, i) => {
                    const slotHour = 8 + Math.floor(i / 2);
                    const slotMin = (i % 2) * 30;
                    
                    const clickDate = new Date(d);
                    clickDate.setHours(slotHour, slotMin, 0, 0);
                    const offsetMs = clickDate.getTimezoneOffset() * 60 * 1000;
                    const localISOTime = new Date(clickDate.getTime() - offsetMs).toISOString().slice(0, 16);
                    
                    const label = `${slotHour.toString().padStart(2, '0')}:${slotMin.toString().padStart(2, '0')}`;
                    return `<div class="calendar-grid-hour-slot" title="Crear evento el ${d.getDate()}/${d.getMonth()+1} a las ${label}" onclick="window.AgendaView.abrirFormularioConFecha('${localISOTime}')"></div>`;
                  }).join('')}
                  <div class="calendar-events-layer" id="events-day-${dayIndex}"></div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="card" style="margin-top: 1rem;">
          <div class="table-responsive">
            <table class="table" id="tabla-agenda">
              <thead>
                <tr>
                  <th>Fecha y Hora</th>
                  <th>Título</th>
                  <th>Descripción</th>
                  <th>Vinculado a (Opcional)</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr><td colspan="5" style="text-align:center;">Cargando tu agenda...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    html += `
      </div>

      <!-- VISTA FORMULARIO (NUEVA PANTALLA) -->
      <div id="agenda-form-view" style="display: ${isFormOpen ? 'block' : 'none'};">
        <div class="header-actions">
          <div>
            <h2 style="display: inline-flex; align-items: center; gap: 0.5rem;">${editEventId ? `${Icons.get('pencil', 22)} Editar Evento en Agenda` : `${Icons.get('plus', 22)} Nuevo Evento en Agenda`}</h2>
            <p class="text-secondary">${editEventId ? 'Modifica los detalles de tu reunión o compromiso.' : 'Programa un nuevo compromiso o reunión.'}</p>
          </div>
          <button class="btn btn-secondary" onclick="window.AgendaView.cerrarFormulario()">← Volver a la Agenda</button>
        </div>

        <div class="card" style="margin-top: 1rem; max-width: 800px;">
          <div class="card-body">
            <div class="form-group">
              <label class="form-label"><b>Fecha y Hora:</b></label>
              <div style="display: flex; gap: 1rem; align-items: center;">
                <div style="flex: 2;">
                  <label class="text-secondary" style="font-size: 0.8rem; display: block; margin-bottom: 0.2rem;">Fecha</label>
                  <input type="date" id="agenda-fecha-dia" class="form-control" value="${datePart}" oninput="window.AgendaView.updateFechaSeparada()">
                </div>
                <div style="flex: 1;">
                  <label class="text-secondary" style="font-size: 0.8rem; display: block; margin-bottom: 0.2rem;">Hora</label>
                  <input type="time" id="agenda-fecha-hora" class="form-control" value="${timePart}" oninput="window.AgendaView.updateFechaSeparada()">
                </div>
              </div>
              <input type="hidden" id="agenda-fecha" value="${tempFecha}">
            </div>
            <div class="form-group">
              <label class="form-label"><b>Duración:</b></label>
              <select id="agenda-duracion" class="form-control" onchange="window.AgendaView.setTemp('duracion', parseInt(this.value))">
                <option value="15" ${tempDuracion === 15 ? 'selected' : ''}>15 minutos</option>
                <option value="30" ${tempDuracion === 30 ? 'selected' : ''}>30 minutos</option>
                <option value="45" ${tempDuracion === 45 ? 'selected' : ''}>45 minutos</option>
                <option value="60" ${tempDuracion === 60 ? 'selected' : ''}>1 hora</option>
                <option value="90" ${tempDuracion === 90 ? 'selected' : ''}>1 hora 30 minutos</option>
                <option value="120" ${tempDuracion === 120 ? 'selected' : ''}>2 horas</option>
                <option value="180" ${tempDuracion === 180 ? 'selected' : ''}>3 horas</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Título</label>
              <input type="text" id="agenda-titulo" class="form-control" placeholder="Ej: Reunión apoderado, Entrevista, etc." value="${tempTitulo}" oninput="window.AgendaView.setTemp('titulo', this.value)">
            </div>
            <div class="form-group">
              <label class="form-label">Descripción / Detalles</label>
              <textarea id="agenda-desc" class="form-control" rows="3" oninput="window.AgendaView.setTemp('desc', this.value)">${tempDesc}</textarea>
            </div>
            
            ${!editEventId ? `
            <div class="form-group mb-4">
              <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; font-weight:600; margin:0; padding: 0.5rem; background: var(--bg-hover); border-radius: var(--radius-md); border: 1px solid var(--border-color); width: fit-content; color: var(--text-primary);">
                <input type="checkbox" id="agenda-repeat-semana" style="width:18px; height:18px; accent-color: var(--primary);">
                <span>🔁 Repetir todas las semanas el mismo día (Fijar para las próximas 10 semanas)</span>
              </label>
            </div>
            ` : ''}

            <div class="form-group">
              <label class="form-label"><b>Invitar Colegas (Equipo de Gestión):</b></label>
              <p class="text-secondary" style="font-size:0.8rem; margin-top:-0.25rem; margin-bottom:0.5rem;">Selecciona los colegas que participarán de la reunión para que se agende en sus calendarios.</p>
              <div id="agenda-invitados-checklist" style="max-height: 200px; overflow-y: auto; border: 1px solid var(--border-color); padding: 0.75rem; border-radius: var(--radius-md); background: var(--bg-hover); display: flex; flex-direction: column; gap: 0.4rem;">
                ${(() => {
                  const activeSchool = (typeof Storage !== 'undefined' && Storage.activeSchool) ? Storage.activeSchool : 'demo';
                  const currentUserEmail = getCurrentUserEmail();
                  
                  const roleLabels = {
                    superadmin: 'SUPER ADMIN',
                    admin: 'INSPECTOR GENERAL',
                    administrador: 'INSPECTOR GENERAL',
                    directora: 'DIRECTORA',
                    director: 'DIRECTORA',
                    utp: 'UTP',
                    inspectoria: 'INSPECTORÍA GENERAL',
                    profesor: 'PROFESOR',
                    convivencia: 'CONVIVENCIA ESCOLAR',
                    pie: 'PIE',
                    finanzas: 'FINANZAS',
                    coordinadora: 'COORDINADORA'
                  };

                  const colegas = (Storage.getUsuarios ? Storage.getUsuarios() : [])
                    .filter(u => {
                      const userSchool = u.colegio_id || u.colegioId || '';
                      const nombreCompleto = `${u.nombres || ''} ${u.apellidos || ''}`.toLowerCase();
                      return String(userSchool).trim() === String(activeSchool).trim() && 
                             u.email && u.email.trim().toLowerCase() !== currentUserEmail &&
                             !nombreCompleto.includes('nuevo usuario');
                    });
                  
                  if (colegas.length === 0) return '<div class="text-muted" style="font-size:0.85rem;">No hay otros colegas registrados en el establecimiento.</div>';
                  return colegas.map(u => {
                    const cargoLabel = roleLabels[String(u.role || '').toLowerCase()] || String(u.role || 'Funcionario').toUpperCase();
                    return `
                      <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.9rem; cursor:pointer; font-weight:500; margin:0; color: var(--text-primary);">
                        <input type="checkbox" name="agenda-invitado" value="${u.id}" data-nombre="${u.nombres} ${u.apellidos || ''}" data-email="${u.email || ''}" style="width:16px; height:16px;" ${tempInvitados.includes(u.id) ? 'checked' : ''} onchange="window.AgendaView.toggleInvitado('${u.id}')">
                        <span>${u.nombres} ${u.apellidos || ''} <span style="font-size:0.75rem; color:var(--text-secondary);">(${cargoLabel})</span></span>
                      </label>
                    `;
                  }).join('');
                })()}
              </div>
            </div>

            <div style="margin-top: 2rem; text-align: right;">
              <button class="btn btn-secondary" style="margin-right: 0.5rem;" onclick="window.AgendaView.cerrarFormulario()">Cancelar</button>
              <button class="btn btn-primary" onclick="window.AgendaView.guardarEvento()">${editEventId ? 'Actualizar Evento' : 'Guardar Evento'}</button>
            </div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
    if (activeTab === 'semana') {
      renderSemana();
    } else {
      renderLista();
    }
  }

  function cambiarTipoTarget() {
    const type = document.querySelector('input[name="agenda-target-type"]:checked').value;
    document.getElementById('agenda-container-estudiante').style.display = type === 'estudiante' ? 'flex' : 'none';
    document.getElementById('agenda-container-funcionario').style.display = type === 'funcionario' ? 'block' : 'none';
  }

  function renderSemana() {
    if (activeTab !== 'semana') return;

    const currentUid = getCurrentUserUid();
    const currentUserEmail = getCurrentUserEmail();

    const start = new Date(currentWeekStart);
    start.setHours(0,0,0,0);
    const end = new Date(start);
    end.setDate(start.getDate() + 5);

    const eventos = (Storage.cache?.eventos_agenda || []).filter(e => {
      const evDate = new Date(e.fechaHora);
      if (evDate < start || evDate >= end) return false;

      const isOrganizer = e.funcionarioId === currentUid || (e.organizadorEmail && e.organizadorEmail.trim().toLowerCase() === currentUserEmail);
      if (isOrganizer) return true;
      
      if (e.invitados && Array.isArray(e.invitados)) {
        return e.invitados.some(inv => inv.email && inv.email.trim().toLowerCase() === currentUserEmail);
      }
      return false;
    });

    // Clear event layers
    for (let i = 0; i < 5; i++) {
      const layer = document.getElementById(`events-day-${i}`);
      if (layer) layer.innerHTML = '';
    }

    eventos.forEach(ev => {
      const evDate = new Date(ev.fechaHora);
      const dayOfWeek = evDate.getDay();
      const dayIndex = dayOfWeek - 1;
      if (dayIndex < 0 || dayIndex > 4) return;

      const layer = document.getElementById(`events-day-${dayIndex}`);
      if (!layer) return;

      const hours = evDate.getHours();
      const minutes = evDate.getMinutes();

      if (hours < 8 || hours >= 19) return;

      const offsetHours = (hours - 8) + (minutes / 60);
      const topPos = offsetHours * 80;
      
      const durationMinutes = ev.duracionMinutos || ev.duracion_minutos || 60;
      const cardHeight = (durationMinutes * (80 / 60)) - 8;

      const isOrganizer = ev.funcionarioId === currentUid || (ev.organizadorEmail && ev.organizadorEmail.trim().toLowerCase() === currentUserEmail);
      
      const evEndDate = new Date(evDate.getTime() + durationMinutes * 60 * 1000);
      const formattedStartTime = evDate.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
      const formattedEndTime = evEndDate.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
      const timeRangeText = `${formattedStartTime} - ${formattedEndTime}`;

      let tooltipText = `${ev.titulo}\nHora: ${timeRangeText}\nDescripción: ${ev.descripcion || 'Sin descripción'}`;
      if (ev.invitados && ev.invitados.length > 0) {
        tooltipText += `\nInvitados: ${ev.invitados.map(i => i.nombre).join(', ')}`;
      }

      const card = document.createElement('div');
      card.className = `calendar-event-card ${!isOrganizer ? 'is-invited' : ''}`;
      card.style.top = `${topPos}px`;
      card.style.height = `${cardHeight}px`;
      card.title = tooltipText;

      card.innerHTML = `
        <div class="calendar-event-title">${Storage.safeHtml(ev.titulo)}</div>
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          <span class="calendar-event-time">${timeRangeText}</span>
          ${isOrganizer ? `
            <span onclick="event.stopPropagation(); window.AgendaView.eliminarEvento('${ev.id}')" style="cursor:pointer; font-size:0.8rem; color:var(--danger); font-weight:bold;" title="Eliminar Evento">🗑️</span>
          ` : ''}
        </div>
      `;

      if (isOrganizer) {
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle-bottom';
        card.appendChild(resizeHandle);

        resizeHandle.onmousedown = (e) => {
          e.stopPropagation();
          e.preventDefault();
          window.AgendaView.handleResizeStart(e, ev, card, evDate);
        };
      }

      card.onclick = () => {
        let details = `<strong>Título:</strong> ${ev.titulo}<br>`;
        details += `<strong>Fecha y Hora:</strong> ${evDate.toLocaleString('es-CL')}<br>`;
        details += `<strong>Organizador:</strong> ${ev.organizadorNombre || ev.organizadorEmail || 'Sistema'}<br>`;
        if (ev.descripcion) details += `<strong>Detalles:</strong> ${ev.descripcion}<br>`;
        if (ev.invitados && ev.invitados.length > 0) {
          details += `<strong>Invitados:</strong> ${ev.invitados.map(i => i.nombre).join(', ')}<br>`;
        }

        const editBtn = isOrganizer
          ? `<button class="btn btn-primary" onclick="window.AgendaView.editarEvento('${ev.id}')">✏️ Editar</button>`
          : '';
        const deleteBtn = isOrganizer 
          ? `<button class="btn btn-danger" onclick="App.closeModal(); window.AgendaView.eliminarEvento('${ev.id}')">🗑️ Eliminar</button>`
          : '';

        App.openModal('Detalles del Evento', `<div style="line-height:1.6;">${details}</div>`, `
          <div style="display:flex; gap:0.5rem; justify-content:flex-end; width:100%;">
            <button class="btn btn-secondary" onclick="App.closeModal()">Cerrar</button>
            ${editBtn}
            ${deleteBtn}
          </div>
        `);
      };

      layer.appendChild(card);
    });
  }

  async function renderLista() {
    const tbody = document.querySelector('#tabla-agenda tbody');
    if (!tbody) return;

    const currentUid = getCurrentUserUid();
    const currentUserEmail = getCurrentUserEmail();
    
    // Filtrar: Eventos creados por mí O donde soy un invitado listado
    const eventos = (Storage.cache?.eventos_agenda || []).filter(e => {
      const isOrganizer = e.funcionarioId === currentUid || (e.organizadorEmail && e.organizadorEmail.trim().toLowerCase() === currentUserEmail);
      if (isOrganizer) return true;
      
      if (e.invitados && Array.isArray(e.invitados)) {
        return e.invitados.some(inv => inv.email && inv.email.trim().toLowerCase() === currentUserEmail);
      }
      return false;
    });
    
    eventos.sort((a, b) => new Date(a.fechaHora) - new Date(b.fechaHora));

    if (eventos.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No tienes eventos programados en tu agenda.</td></tr>`;
      return;
    }

    let rows = '';
    eventos.forEach(ev => {
      const isOrganizer = ev.funcionarioId === currentUid || (ev.organizadorEmail && ev.organizadorEmail.trim().toLowerCase() === currentUserEmail);
      let participantesHtml = '';
      
      if (isOrganizer) {
        participantesHtml = `<span class="badge" style="background:#ede9fe; color:#6d28d9; border:1px solid #c084fc; font-size:0.75rem; font-weight:700; padding:2px 6px; border-radius:4px;">👑 Creador</span>`;
        if (ev.invitados && Array.isArray(ev.invitados) && ev.invitados.length > 0) {
          const nombresInvitados = ev.invitados.map(i => i.nombre).join(', ');
          participantesHtml += `<div style="font-size:0.8rem; margin-top:4px; color:var(--text-secondary);"><b>Invitados:</b> ${nombresInvitados}</div>`;
        } else {
          participantesHtml += `<div style="font-size:0.8rem; margin-top:4px; color:var(--text-secondary);">Sin invitados</div>`;
        }
      } else {
        const orgName = ev.organizadorNombre || ev.organizadorEmail || 'Colega';
        participantesHtml = `<span class="badge" style="background:#e0f2fe; color:#0369a1; border:1px solid #7dd3fc; font-size:0.75rem; font-weight:700; padding:2px 6px; border-radius:4px;">👥 Invitado</span>`;
        participantesHtml += `<div style="font-size:0.8rem; margin-top:4px; color:var(--text-secondary);"><b>Organiza:</b> ${orgName}</div>`;
      }
      
      const fecha = new Date(ev.fechaHora).toLocaleString('es-CL');
      const accionesHtml = isOrganizer 
        ? `<button class="btn btn-sm btn-danger" onclick="window.AgendaView.eliminarEvento('${ev.id}')">Eliminar</button>`
        : `<span class="text-muted" style="font-size:0.8rem; font-style:italic;">Solo lectura</span>`;

      rows += `
        <tr>
          <td><strong>${fecha}</strong></td>
          <td>${ev.titulo}</td>
          <td>${ev.descripcion || '-'}</td>
          <td>${participantesHtml}</td>
          <td>${accionesHtml}</td>
        </tr>
      `;
    });

    tbody.innerHTML = rows;
  }

  function abrirModalEvento() {
    abrirFormulario();
  }

  function abrirFormulario() {
    isFormOpen = true;
    tempFecha = '';
    tempTitulo = '';
    tempDesc = '';
    tempInvitados = [];
    editEventId = '';
    tempDuracion = 60;
    render();
  }

  function cerrarFormulario() {
    isFormOpen = false;
    tempFecha = '';
    tempTitulo = '';
    tempDesc = '';
    tempInvitados = [];
    editEventId = '';
    tempDuracion = 60;
    render();
  }

  function actualizarEstudiantes() {
    const cursoId = document.getElementById('agenda-curso').value;
    const selectEstudiante = document.getElementById('agenda-estudiante');
    let estudiantes = Storage.getEstudiantes ? Storage.getEstudiantes() : [];
    
    if (cursoId) {
      const cursoObj = typeof DATA !== 'undefined' && DATA.cursos ? DATA.cursos.find(c => c.id === cursoId) : null;
      const cursoNombre = cursoObj ? cursoObj.nombre : cursoId;
      estudiantes = estudiantes.filter(e => e.curso === cursoId || e.curso === cursoNombre || e.cursoId === cursoId);
    }
    
    selectEstudiante.innerHTML = '<option value="">-- Seleccione un estudiante --</option>' + 
      estudiantes.map(e => `<option value="${e.id}">${e.nombres} ${e.apellidos}</option>`).join('');
  }

  async function guardarEvento() {
    const fecha = document.getElementById('agenda-fecha').value;
    const titulo = document.getElementById('agenda-titulo').value;
    const desc = document.getElementById('agenda-desc').value;
    const repeatWeek = document.getElementById('agenda-repeat-semana')?.checked || false;
    
    if (!fecha || !titulo) {
      App.showToast('Debe ingresar la fecha y el título del evento.', 'warning');
      return;
    }

    const invitados = [];
    document.querySelectorAll('input[name="agenda-invitado"]:checked').forEach(cb => {
      invitados.push({
        id: cb.value,
        nombre: cb.getAttribute('data-nombre'),
        email: cb.getAttribute('data-email')
      });
    });

    const currentUid = getCurrentUserUid();
    const currentUserEmail = getCurrentUserEmail();
    const userProfile = Auth.userProfile || {};
    let organizadorNombre = (userProfile.nombres || userProfile.nombre) ? `${userProfile.nombres || userProfile.nombre} ${userProfile.apellidos || ''}` : Auth.currentUser.email;
    
    if (Auth.currentUser && Auth.currentUser.email && Auth.currentUser.email.trim().toLowerCase() === 'itsotocadiz@gmail.com' && Auth.currentRole !== 'superadmin') {
      const activeSchool = (typeof Storage !== 'undefined' && Storage.activeSchool) ? Storage.activeSchool : 'demo';
      const realUser = (Storage.getUsuarios ? Storage.getUsuarios() : [])
        .find(u => {
          const userSchool = u.colegio_id || u.colegioId || '';
          return String(userSchool).trim() === String(activeSchool).trim() && 
                 u.email && u.email.trim().toLowerCase() === currentUserEmail;
        });
      if (realUser) {
        organizadorNombre = `${realUser.nombres} ${realUser.apellidos || ''}`;
      }
    }

    const eventsToSave = [];
    if (!editEventId && repeatWeek) {
      // Repetir todas las semanas el mismo día por las próximas 10 semanas
      const targetDate = new Date(fecha);
      
      for (let i = 0; i < 10; i++) {
        const curDate = new Date(targetDate);
        curDate.setDate(targetDate.getDate() + (i * 7));

        const localOffset = curDate.getTimezoneOffset() * 60 * 1000;
        const curFechaStr = new Date(curDate.getTime() - localOffset).toISOString().slice(0, 16);

        const record = {
          id: `${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
          funcionarioId: currentUid,
          organizadorEmail: currentUserEmail,
          organizadorNombre: organizadorNombre,
          fechaHora: curFechaStr,
          titulo: titulo,
          descripcion: desc,
          invitados: invitados,
          timestamp: Date.now(),
          duracionMinutos: tempDuracion
        };
        eventsToSave.push(record);
      }
    } else {
      const record = {
        id: editEventId || Date.now().toString(),
        funcionarioId: currentUid,
        organizadorEmail: currentUserEmail,
        organizadorNombre: organizadorNombre,
        fechaHora: fecha,
        titulo: titulo,
        descripcion: desc,
        invitados: invitados,
        timestamp: Date.now(),
        duracionMinutos: tempDuracion
      };
      eventsToSave.push(record);
    }

    for (const record of eventsToSave) {
      const payload = Storage.injectColegioId(record);

      const dbPayload = { ...payload };
      delete dbPayload.funcionarioId;
      delete dbPayload.organizadorEmail;
      delete dbPayload.organizadorNombre;
      dbPayload.fecha_hora = record.fechaHora || record.fecha_para_orden;
      delete dbPayload.fechaHora;
      delete dbPayload.colegioId;
      delete dbPayload.timestamp;

      dbPayload.duracion_minutos = record.duracionMinutos || 60;
      delete dbPayload.duracionMinutos;

      const { error: saveError } = await window.supabaseGestion.from('eventos_agenda').upsert(dbPayload);
      if (saveError) {
        console.error("Error al guardar en Supabase:", saveError);
        App.showToast('Error al guardar el evento: ' + saveError.message, 'danger');
        return;
      }
      
      if (typeof Storage !== 'undefined' && Storage.cache) {
        if (!Storage.cache.eventos_agenda) Storage.cache.eventos_agenda = [];
        if (editEventId) {
          Storage.cache.eventos_agenda = Storage.cache.eventos_agenda.filter(e => e.id !== editEventId);
        }
        Storage.cache.eventos_agenda.push(record);
      }
    }
    
    App.showToast(editEventId ? 'Evento actualizado exitosamente.' : 'Evento agendado exitosamente.', 'success');
    cerrarFormulario();
    render();
  }

  async function eliminarEvento(id) {
    try {
      const { error } = await window.supabaseGestion.from('eventos_agenda').delete().eq('id', id);
      if (error) throw error;
      if (typeof Storage !== 'undefined' && Storage.cache) {
        Storage.cache.eventos_agenda = Storage.cache.eventos_agenda.filter(e => e.id !== id);
      }
      
      App.showToast('Evento eliminado.', 'success');
      render();
    } catch (e) {
      console.error(e);
      App.showToast('No se pudo eliminar el evento.', 'danger');
    }
  }

  return {
    init,
    render,
    cambiarTipoTarget,
    abrirModalEvento,
    abrirFormulario,
    cerrarFormulario,
    actualizarEstudiantes,
    guardarEvento,
    eliminarEvento,
    renderLista,
    setTemp,
    toggleInvitado,
    shiftWeek,
    setTab,
    abrirFormularioConFecha,
    editarEvento,
    updateFechaSeparada,
    handleResizeStart
  };
})();

window.AgendaView = AgendaView;
})();
