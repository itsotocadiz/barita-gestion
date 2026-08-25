/* ================================================================
   asistencia.js - Módulo de Asistencia, Atrasos y Justificativos
   Maneja el control de puntualidad y ausencias con calendarios y buscador.
   ================================================================ */


(() => {
const AsistenciaView = (() => {
  return {
    currentTab: 'atrasos',
    selectedCursoId: '',
    selectedEstudianteId: '',
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    atrasosCache: [],
    inasistenciasCache: [],

    async render(container) {
      App.setBreadcrumb('Asistencia y Atrasos');
      
      // Cargar datos preliminares
      await this.fetchDatos();
      
      // Set default curso if not selected
      if (!this.selectedCursoId && DATA.cursos.length > 0) {
        this.selectedCursoId = DATA.cursos[0].id;
      }
      
      let html = `
        <div style="max-width: 1000px; margin: 0 auto;">
          
          <!-- Tabs Superiores -->
          <div class="flex gap-2 mb-4 border-b pb-2" style="border-bottom: 1px solid var(--border-color);">
            <button class="btn ${this.currentTab === 'atrasos' ? 'btn-primary' : 'btn-secondary'} inline-flex items-center gap-1" onclick="AsistenciaView.switchTab('atrasos')">${Icons.get('clock', 14)} Atrasos</button>
            <button class="btn ${this.currentTab === 'inasistencias' ? 'btn-primary' : 'btn-secondary'} inline-flex items-center gap-1" onclick="AsistenciaView.switchTab('inasistencias')">${Icons.get('alert-circle', 14)} Inasistencias</button>
            <button class="btn ${this.currentTab === 'justificativos' ? 'btn-primary' : 'btn-secondary'} inline-flex items-center gap-1" onclick="AsistenciaView.switchTab('justificativos')">${Icons.get('file-text', 14)} Justificativos</button>
          </div>

          <div style="display: grid; grid-template-columns: 320px 1fr; gap: 1.5rem; align-items: start;">
            
            <!-- PANEL IZQUIERDO: FILTROS Y ESTUDIANTES -->
            <div class="card" style="padding: 1.2rem;">
              <h4 style="margin-top: 0; margin-bottom: 1rem; color: var(--text-primary);">Estudiantes y Filtros</h4>
              
              <!-- Selector de Curso -->
              <div class="form-group mb-3">
                <label class="form-label" style="font-weight: 600;">Filtrar por Curso</label>
                <select class="form-control" id="asist-curso-select" onchange="AsistenciaView.changeCurso(this.value)">
                  ${DATA.cursos.map(c => `<option value="${c.id}" ${this.selectedCursoId === c.id ? 'selected' : ''}>${c.nombre}</option>`).join('')}
                </select>
              </div>

              <!-- Buscador Predictivo -->
              <div class="form-group mb-3" style="position: relative;">
                <label class="form-label" style="font-weight: 600;">Buscar Estudiante (Nombre/RUT)</label>
                <input type="text" id="asist-estudiante-search" class="form-control" placeholder="Escribe para buscar..." oninput="AsistenciaView.handlePredictiveSearch(this.value)" autocomplete="off">
                <div id="asist-autocomplete-results" style="position: absolute; width: 100%; max-height: 200px; overflow-y: auto; background: white; border: 1px solid var(--border-color); border-radius: 4px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 1000; display: none;"></div>
              </div>

              <!-- Listado Ordenado (Para Inasistencias y Justificativos) -->
              <div id="asist-student-list-container">
                ${this.renderStudentList()}
              </div>

            </div>

            <!-- PANEL DERECHO: INTERACCIONES Y CALENDARIO -->
            <div class="card" style="padding: 1.2rem; min-height: 480px;">
              ${this.renderRightPanel()}
            </div>

          </div>

        </div>
      `;
      
      container.innerHTML = html;
    },

    async fetchDatos(force = false) {
      if (this.isFetched && !force) {
        // Asegurar que si hay datos agregados en Storage.cache se sincronicen en el cache local
        if (Storage.cache?.atrasos) {
          Storage.cache.atrasos.forEach(a => {
            if (!this.atrasosCache.some(item => item.id === a.id)) {
              this.atrasosCache.push(a);
            }
          });
        }
        if (Storage.cache?.inasistencias) {
          Storage.cache.inasistencias.forEach(i => {
            if (!this.inasistenciasCache.some(item => item.id === i.id)) {
              this.inasistenciasCache.push(i);
            }
          });
        }
        return;
      }
      try {
        const { data: snapAtrasos } = await window.supabaseGestion.from('atrasos').select('*');
        const fetchedAtrasos = (snapAtrasos || []).map(a => {
          if (a.estudiante_id && !a.estudianteId) a.estudianteId = a.estudiante_id;
          if (a.estudianteId && !a.estudiante_id) a.estudiante_id = a.estudianteId;
          if (a.colegio_id && !a.colegioId) a.colegioId = a.colegio_id;
          return a;
        });

        const { data: snapInas } = await window.supabaseGestion.from('inasistencias').select('*');
        const fetchedInas = (snapInas || []).map(i => {
          if (i.estudiante_id && !i.estudianteId) i.estudianteId = i.estudiante_id;
          if (i.estudianteId && !i.estudiante_id) i.estudiante_id = i.estudianteId;
          if (i.colegio_id && !i.colegioId) i.colegioId = i.colegio_id;
          return i;
        });

        // Combinar con lo que esté en Storage.cache para no perder mutaciones recién hechas
        const localAtrasos = Storage.cache?.atrasos || [];
        localAtrasos.forEach(la => {
          if (!fetchedAtrasos.some(a => a.id === la.id)) {
            fetchedAtrasos.push(la);
          }
        });

        const localInas = Storage.cache?.inasistencias || [];
        localInas.forEach(li => {
          if (!fetchedInas.some(i => i.id === li.id)) {
            fetchedInas.push(li);
          }
        });

        this.atrasosCache = fetchedAtrasos;
        this.inasistenciasCache = fetchedInas;
        this.isFetched = true;
      } catch (e) {
        App.showToast('No se pudieron cargar los datos de asistencia. Se mostrarán datos locales.', 'warning');
      }
    },

    switchTab(tab) {
      this.currentTab = tab;
      this.render(document.getElementById('app-content'));
    },

    changeCurso(cursoId) {
      this.selectedCursoId = cursoId;
      this.selectedEstudianteId = '';
      const searchInput = document.getElementById('asist-estudiante-search');
      if (searchInput) searchInput.value = '';
      this.render(document.getElementById('app-content'));
    },

    handlePredictiveSearch(query) {
      const resultsContainer = document.getElementById('asist-autocomplete-results');
      if (!resultsContainer) return;

      if (!query.trim()) {
        resultsContainer.style.display = 'none';
        return;
      }

      const term = query.toLowerCase().trim();
      const estudiantes = Storage.getEstudiantes().filter(e => e.curso === this.selectedCursoId);
      
      const matches = estudiantes.filter(e => {
        const full = `${e.nombres} ${e.apellidos}`.toLowerCase();
        const rut = (e.rut || '').toLowerCase();
        return full.includes(term) || rut.includes(term) || e.id.toLowerCase().includes(term);
      });

      if (matches.length === 0) {
        resultsContainer.innerHTML = '<div style="padding: 0.5rem; color: #94a3b8; font-size: 0.85rem;">No se encontraron resultados</div>';
      } else {
        resultsContainer.innerHTML = matches.map(e => `
          <div style="padding: 0.5rem 0.75rem; cursor: pointer; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem;" class="autocomplete-item" onclick="AsistenciaView.selectEstudiante('${e.id}')">
            <strong>${e.nombres} ${e.apellidos}</strong><br>
            <span style="font-size: 0.75rem; color: #64748b;">RUT: ${e.rut || 'No registra'}</span>
          </div>
        `).join('');
      }
      resultsContainer.style.display = 'block';
    },

    selectEstudiante(estudianteId) {
      this.selectedEstudianteId = estudianteId;
      const est = Storage.getEstudianteById(estudianteId);
      if (!est) {
        App.showToast('Estudiante no encontrado en caché.', 'warning');
        return;
      }
      
      const searchInput = document.getElementById('asist-estudiante-search');
      if (searchInput && est) {
        searchInput.value = `${est.nombres} ${est.apellidos}`;
      }

      const resultsContainer = document.getElementById('asist-autocomplete-results');
      if (resultsContainer) resultsContainer.style.display = 'none';

      this.render(document.getElementById('app-content'));
    },

    renderStudentList() {
      const estudiantes = Storage.getEstudiantes().filter(e => e.curso === this.selectedCursoId);
      
      if (this.currentTab === 'atrasos') {
        estudiantes.sort((a,b) => `${a.nombres} ${a.apellidos}`.localeCompare(`${b.nombres} ${b.apellidos}`));
        return `
          <div style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 600; margin-bottom: 0.5rem;">Listado Curso</div>
          <div style="max-height: 250px; overflow-y: auto;">
            ${estudiantes.map(e => {
              const isSel = this.selectedEstudianteId === e.id;
              return `
                <div onclick="AsistenciaView.selectEstudiante('${e.id}')" style="padding: 0.5rem; cursor: pointer; border-radius: 4px; background: ${isSel ? 'var(--primary)' : 'transparent'}; color: ${isSel ? 'white' : 'inherit'}; font-size: 0.85rem; margin-bottom: 2px;">
                  ${e.nombres} ${e.apellidos}
                </div>
              `;
            }).join('')}
          </div>
        `;
      } else {
        const counts = estudiantes.map(e => {
          const totalAusencias = this.inasistenciasCache.filter(ins => ins.estudianteId === e.id).length;
          const totalJustificadas = this.inasistenciasCache.filter(ins => ins.estudianteId === e.id && ins.justificado).length;
          return {
            est: e,
            total: totalAusencias,
            justificadas: totalJustificadas
          };
        });

        counts.sort((a,b) => b.total - a.total);

        return `
          <div style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 600; margin-bottom: 0.5rem;">Mayor Inasistencia DESC</div>
          <div style="max-height: 250px; overflow-y: auto;">
            ${counts.map(item => {
              const isSel = this.selectedEstudianteId === item.est.id;
              const label = this.currentTab === 'inasistencias' 
                ? `${item.total} ausencias` 
                : `${item.justificadas} justificados`;
              
              return `
                <div onclick="AsistenciaView.selectEstudiante('${item.est.id}')" style="padding: 0.5rem; cursor: pointer; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; background: ${isSel ? 'var(--primary)' : 'transparent'}; color: ${isSel ? 'white' : 'inherit'}; font-size: 0.85rem; margin-bottom: 2px;">
                  <span style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 170px;">${item.est.nombres} ${item.est.apellidos}</span>
                  <span style="font-size: 0.75rem; font-weight: bold; background: ${isSel ? 'rgba(255,255,255,0.2)' : '#f1f5f9'}; color: ${isSel ? 'white' : '#ef4444'}; padding: 2px 6px; border-radius: 10px;">${label}</span>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }
    },

    renderRightPanel() {
      if (!this.selectedEstudianteId) {
        return `
          <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; text-align: center; color: #64748b; padding: 2rem;">
            <div style="font-size: 3rem; margin-bottom: 1rem; color: var(--text-secondary); display: inline-flex; align-items: center; justify-content: center;">${Icons.get('user', 48)}</div>
            <h3>Selecciona un Estudiante</h3>
            <p style="font-size: 0.9rem; max-width: 300px;">Elige a un alumno del listado o utiliza el buscador predictivo para comenzar a registrar o revisar su asistencia.</p>
          </div>
        `;
      }

      const est = Storage.getEstudianteById(this.selectedEstudianteId);
      if (!est) return '';

      const calendarHtml = this.renderCalendar();

      if (this.currentTab === 'atrasos') {
        const totalAtrasos = this.atrasosCache.filter(a => a.estudianteId === est.id).length;
        return `
          <div class="flex justify-between items-center mb-3">
            <div>
              <h3 style="margin: 0; color: var(--primary);">${est.nombres} ${est.apellidos}</h3>
              <span class="text-muted" style="font-size: 0.85rem;">Historial acumulado: <strong>${totalAtrasos} atrasos</strong></span>
            </div>
            <button class="btn btn-primary inline-flex items-center gap-1.5" onclick="AsistenciaView.registrarAccion('atraso')">${Icons.get('clock', 16)} Registrar Atraso Hoy</button>
          </div>
          <hr style="border: 0; border-top: 1px solid var(--border-color); margin-bottom: 1.5rem;">
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
            <div>
              <h4 style="margin: 0 0 1rem 0;">Calendario de Atrasos</h4>
              ${calendarHtml}
            </div>
            <div>
              <h4 style="margin: 0 0 1rem 0;">Historial de Fechas</h4>
              <div style="max-height: 280px; overflow-y: auto; background: var(--bg-hover); border-radius: var(--radius-md); padding: 1rem;">
                ${this.renderHistorialFechas('atrasos')}
              </div>
            </div>
          </div>
        `;
      } else {
        const totalAusencias = this.inasistenciasCache.filter(ins => ins.estudianteId === est.id).length;
        const totalJustificadas = this.inasistenciasCache.filter(ins => ins.estudianteId === est.id && ins.justificado).length;
        const noJustificadas = totalAusencias - totalJustificadas;

        return `
          <div class="flex justify-between items-center mb-3">
            <div>
              <h3 style="margin: 0; color: var(--primary);">${est.nombres} ${est.apellidos}</h3>
              <span class="text-muted" style="font-size: 0.85rem;">
                Ausencias: <strong style="color: #ef4444;">${noJustificadas} Injustificadas</strong> | 
                <strong style="color: #3b82f6;">${totalJustificadas} Justificadas</strong>
              </span>
            </div>
            <div class="flex gap-2">
              <!-- Botones removidos a petición del usuario -->
            </div>
          </div>
          <hr style="border: 0; border-top: 1px solid var(--border-color); margin-bottom: 1.5rem;">

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
            <div>
              <h4 style="margin: 0 0 1rem 0;">Calendario Unificado de Ausencia</h4>
              ${calendarHtml}
            </div>
            <div>
              <h4 style="margin: 0 0 1rem 0;">Historial de Ausencias</h4>
              <div style="max-height: 280px; overflow-y: auto; background: var(--bg-hover); border-radius: var(--radius-md); padding: 1rem;">
                ${this.renderHistorialFechas('inasistencias')}
              </div>
            </div>
          </div>
        `;
      }
    },

    renderCalendar() {
      const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
      const totalDias = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
      
      const primerDiaFecha = new Date(this.currentYear, this.currentMonth, 1);
      let primerDiaSemana = primerDiaFecha.getDay(); // 0 = Dom, 1 = Lun, ..., 6 = Sáb
      if (primerDiaSemana === 0 || primerDiaSemana === 6) {
        primerDiaSemana = 1;
      }
      const offset = primerDiaSemana - 1;

      const markedDates = {};
      
      if (this.currentTab === 'atrasos') {
        this.atrasosCache
          .filter(a => a.estudianteId === this.selectedEstudianteId)
          .forEach(a => {
            markedDates[a.fecha] = 'atraso';
          });
      } else {
        this.inasistenciasCache
          .filter(ins => ins.estudianteId === this.selectedEstudianteId)
          .forEach(ins => {
            markedDates[ins.fecha] = ins.justificado ? 'justificado' : 'ausencia';
          });
      }

      let cellsHtml = '';
      for (let i = 0; i < offset; i++) {
        cellsHtml += `<div></div>`;
      }

      for (let dia = 1; dia <= totalDias; dia++) {
        const fechaObj = new Date(this.currentYear, this.currentMonth, dia);
        const diaSemana = fechaObj.getDay();

        // Ocultar Fin de Semana (0 = Domingo, 6 = Sábado)
        if (diaSemana === 0 || diaSemana === 6) {
          continue;
        }

        const mesStr = String(this.currentMonth + 1).padStart(2, '0');
        const diaStr = String(dia).padStart(2, '0');
        const dateKey = `${this.currentYear}-${mesStr}-${diaStr}`;
        
        const tipo = markedDates[dateKey];
        let bgStyle = 'transparent';
        let textStyle = 'inherit';
        let border = '1px solid #f1f5f9';

        if (tipo === 'atraso') {
          bgStyle = '#f97316';
          textStyle = 'white';
        } else if (tipo === 'ausencia') {
          bgStyle = '#ef4444';
          textStyle = 'white';
        } else if (tipo === 'justificado') {
          bgStyle = '#3b82f6';
          textStyle = 'white';
        }

        cellsHtml += `
          <div onclick="AsistenciaView.toggleDiaCalendario('${dateKey}')" style="padding: 0.5rem; text-align: center; border: ${border}; background: ${bgStyle}; color: ${textStyle}; font-weight: 500; font-size: 0.85rem; border-radius: 4px; cursor: pointer;" title="Haga clic para registrar/eliminar">
            ${dia}
          </div>
        `;
      }

      return `
        <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden; background: white;">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-hover); border-bottom: 1px solid var(--border-color);">
            <button class="btn btn-sm btn-secondary" onclick="AsistenciaView.changeMonth(-1)" style="padding: 2px 8px;">&lt;</button>
            <strong style="font-size: 0.95rem;">${meses[this.currentMonth]} ${this.currentYear}</strong>
            <button class="btn btn-sm btn-secondary" onclick="AsistenciaView.changeMonth(1)" style="padding: 2px 8px;">&gt;</button>
          </div>
          <div style="display: grid; grid-template-columns: repeat(5, 1fr); padding: 0.5rem; font-size: 0.75rem; font-weight: bold; color: #64748b; text-align: center; border-bottom: 1px solid #f1f5f9;">
            <div>LU</div><div>MA</div><div>MI</div><div>JU</div><div>VI</div>
          </div>
          <div style="display: grid; grid-template-columns: repeat(5, 1fr); padding: 0.5rem; gap: 2px;">
            ${cellsHtml}
          </div>
        </div>
      `;
    },

    renderHistorialFechas(tipo) {
      const list = tipo === 'atrasos'
        ? this.atrasosCache.filter(a => a.estudianteId === this.selectedEstudianteId)
        : this.inasistenciasCache.filter(ins => ins.estudianteId === this.selectedEstudianteId);

      if (list.length === 0) {
        return `<p class="text-muted text-center" style="font-size: 0.85rem; margin: 1rem 0;">No registra historial en este módulo.</p>`;
      }

      list.sort((a,b) => b.fecha.localeCompare(a.fecha));

      return `
        <ul style="margin: 0; padding: 0; list-style: none;">
          ${list.map(item => {
            let badge = '';
            if (tipo === 'atrasos') {
              badge = `<span class="badge" style="background: #ffedd5; color: #ea580c; font-size: 0.75rem;">Atraso</span>`;
            } else {
              badge = item.justificado 
                ? `<span class="badge" style="background: #dbeafe; color: #2563eb; font-size: 0.75rem;">Justificado</span>`
                : `<span class="badge" style="background: #fee2e2; color: #dc2626; font-size: 0.75rem;">Ausente</span>`;
            }
            return `
              <li class="flex justify-between items-center py-2" style="border-bottom: 1px solid rgba(0,0,0,0.05);">
                <span style="font-size: 0.85rem; font-weight: 500;">📅 ${new Date(item.fecha + 'T12:00:00').toLocaleDateString('es-CL')}</span>
                <div class="flex gap-2 items-center">
                  ${badge}
                  ${this.currentTab === 'atrasos' ? `<button onclick="AsistenciaView.borrarRegistro('${tipo}', '${item.id}')" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 0.9rem;">&times;</button>` : ''}
                </div>
              </li>
            `;
          }).join('')}
        </ul>
      `;
    },

    changeMonth(dir) {
      this.currentMonth += dir;
      if (this.currentMonth > 11) {
        this.currentMonth = 0;
        this.currentYear += 1;
      } else if (this.currentMonth < 0) {
        this.currentMonth = 11;
        this.currentYear -= 1;
      }
      this.render(document.getElementById('app-content'));
    },

    async registrarAccion(tipo) {
      const hoyStr = BARITA_hoyChileISO();
      const estId = this.selectedEstudianteId;
      if (!estId) return;
      const currentUser = Auth.currentUser ? Auth.currentUser.uid : 'sistema';
      const currentName = Auth.userProfile ? (Auth.userProfile.nombre || Auth.userProfile.email) : 'Sistema';

      if (tipo === 'atraso') {
        const exists = this.atrasosCache.some(a => a.estudianteId === estId && a.fecha === hoyStr);
        if (exists) {
          App.showToast('Ya se registró un atraso para hoy', 'warning');
          return;
        }
        const record = {
          id: Date.now().toString(),
          estudianteId: estId,
          estudiante_id: estId,
          fecha: hoyStr,
          justificado: false,
          funcionarioId: currentUser,
          funcionarioNombre: currentName,
          colegio_id: Storage.activeSchool || 'demo',
          colegioId: Storage.activeSchool || 'demo',
          timestamp: Date.now()
        };
        const payload = (Storage.prepareAtrasoPayload) ? Storage.prepareAtrasoPayload(record) : record;
        await window.supabaseGestion.from('atrasos').upsert(payload);
        this.atrasosCache.push(record);
        if (typeof Storage !== 'undefined' && Storage.cache) Storage.cache.atrasos.push(record);
        App.showToast('Atraso registrado con éxito', 'success');
      } else if (tipo === 'ausencia') {
        const exists = this.inasistenciasCache.some(ins => ins.estudianteId === estId && ins.fecha === hoyStr);
        if (exists) {
          App.showToast('Ya se registró inasistencia hoy', 'warning');
          return;
        }
        const record = {
          id: Date.now().toString(),
          estudianteId: estId,
          estudiante_id: estId,
          fecha: hoyStr,
          justificado: false,
          funcionarioId: currentUser,
          funcionarioNombre: currentName,
          colegio_id: Storage.activeSchool || 'demo',
          colegioId: Storage.activeSchool || 'demo',
          timestamp: Date.now()
        };
        const inasPayload = { id: record.id, estudiante_id: estId, fecha: hoyStr, justificado: false, funcionario_id: currentUser, colegio_id: Storage.activeSchool || 'demo' };
        await window.supabaseGestion.from('inasistencias').upsert(inasPayload);
        this.inasistenciasCache.push(record);
        if (typeof Storage !== 'undefined' && Storage.cache) Storage.cache.inasistencias.push(record);
        App.showToast('Inasistencia registrada', 'danger');
      } else if (tipo === 'justificativo') {
        const insHoy = this.inasistenciasCache.find(ins => ins.estudianteId === estId && ins.fecha === hoyStr);
        if (insHoy) {
          insHoy.justificado = true;
          insHoy.justificadoPor = currentUser;
          insHoy.justificadoNombre = currentName;
          const { error } = await window.supabaseGestion.from('inasistencias').update({
            justificado: true,
            justificadoPor: currentUser,
            justificadoNombre: currentName
          }).eq('id', insHoy.id);
          if (error) throw error;
          
          const storageIns = Storage.cache?.inasistencias?.find(i => i.id === insHoy.id);
          if (storageIns) {
            storageIns.justificado = true;
            storageIns.justificadoPor = currentUser;
            storageIns.justificadoNombre = currentName;
          }
          
          App.showToast('Inasistencia justificada', 'success');
        } else {
          const record = {
            id: Date.now().toString(),
            estudianteId: estId,
            fecha: hoyStr,
            justificado: true,
            funcionarioId: currentUser,
            funcionarioNombre: currentName,
            timestamp: Date.now()
          };
          await window.supabaseGestion.from('inasistencias').upsert(record);
          this.inasistenciasCache.push(record);
          if (typeof Storage !== 'undefined' && Storage.cache) Storage.cache.inasistencias.push(record);
          App.showToast('Justificativo registrado con éxito', 'success');
        }
      }

      this.render(document.getElementById('app-content'));
    },

    async registrarInasistencia(estId, fecha) {
      fecha = fecha || BARITA_hoyChileISO();
      const est = Storage.getEstudianteById(estId);
      if (!est) return;
      
      const exists = this.inasistenciasCache.some(ins => ins.estudianteId === estId && ins.fecha === fecha);
      if (exists) {
        App.showToast('Ya existe un registro de inasistencia para esa fecha', 'warning');
        return;
      }

      const currentUser = Auth.currentUser ? Auth.currentUser.uid : 'sistema';
      const currentName = Auth.userProfile ? (Auth.userProfile.nombre || Auth.userProfile.email) : 'Sistema';
      
      const record = {
        id: Date.now().toString(),
        estudianteId: estId,
        fecha: fecha,
        justificado: false,
        funcionarioId: currentUser,
        funcionarioNombre: currentName,
        timestamp: Date.now()
      };

      await window.supabaseGestion.from('inasistencias').upsert(record);
      this.inasistenciasCache.push(record);
      if (typeof Storage !== 'undefined' && Storage.cache) Storage.cache.inasistencias.push(record);
      
      App.showToast('Inasistencia registrada correctamente', 'success');
      
      if (this.selectedEstudianteId === estId) {
        this.render(document.getElementById('app-content'));
      }
    },

    async justificarInasistencia(estId, fecha) {
      fecha = fecha || BARITA_hoyChileISO();
      const ins = this.inasistenciasCache.find(item => item.estudianteId === estId && item.fecha === fecha);
      if (!ins) {
        App.showToast('No se encontró inasistencia en esa fecha', 'warning');
        return;
      }

      const currentUser = Auth.currentUser ? Auth.currentUser.uid : 'sistema';
      const currentName = Auth.userProfile ? (Auth.userProfile.nombre || Auth.userProfile.email) : 'Sistema';
      const newVal = !ins.justificado;

      const { error } = await window.supabaseGestion.from('inasistencias').update({
        justificado: newVal,
        justificadoPor: newVal ? currentUser : null,
        justificadoNombre: newVal ? currentName : null
      }).eq('id', ins.id);
      if (error) throw error;
      ins.justificado = newVal;
      ins.justificadoPor = newVal ? currentUser : null;
      ins.justificadoNombre = newVal ? currentName : null;
      
      const storageIns = Storage.cache?.inasistencias?.find(i => i.id === ins.id);
      if (storageIns) {
        storageIns.justificado = newVal;
        storageIns.justificadoPor = newVal ? currentUser : null;
        storageIns.justificadoNombre = newVal ? currentName : null;
      }

      App.showToast(newVal ? 'Inasistencia justificada' : 'Justificación retirada', 'success');
      
      if (this.selectedEstudianteId === estId) {
        this.render(document.getElementById('app-content'));
      }
    },

    async borrarRegistro(tipo, id) {
      App.confirm('Eliminar registro', '¿Deseas remover este registro de la asistencia del alumno?', async () => {
        try {
          if (tipo === 'atrasos') {
            const { error } = await window.supabaseGestion.from('atrasos').delete().eq('id', id);
      if (error) throw error;
          } else {
            const { error } = await window.supabaseGestion.from('inasistencias').delete().eq('id', id);
      if (error) throw error;
          }
          App.closeModal();
          App.showToast('Registro eliminado con éxito', 'success');
          this.render(document.getElementById('app-content'));
        } catch (e) {
          App.showToast('Error al borrar: ' + e.message, 'danger');
        }
      });
    },

    async verificarEscalamiento(estId) {
      const est = Storage.getEstudianteById(estId);
      if (!est) return;

      // Atrasos no justificados (nota: justificado se controlará desde el nuevo módulo)
      const atrasosNoJustificados = this.atrasosCache.filter(a => a.estudianteId === estId && !a.justificado);
      
      if (atrasosNoJustificados.length >= 3) {
        const alertas = Storage.cache?.alertas_inspectoria || [];
        const existe = alertas.some(a => a.estudianteId === estId && a.estado !== 'desactivada' && a.estado !== 'revisada');
        if (!existe) {
          const record = {
            id: Date.now().toString(),
            estudianteId: estId,
            tipo: '3_atrasos',
            estado: 'pendiente',
            fecha_creacion: BARITA_hoyChileISO(),
            detalle: `Acumuló ${atrasosNoJustificados.length} atrasos no justificados`,
            timestamp: Date.now()
          };
          try {
            await window.supabaseGestion.from('alertas_inspectoria').upsert(record);
            if (typeof Storage !== 'undefined' && Storage.cache) {
              Storage.cache.alertas_inspectoria = Storage.cache.alertas_inspectoria || [];
              Storage.cache.alertas_inspectoria.push(record);
            }
            App.showToast('Alerta enviada a Inspectoría General (3 atrasos)', 'warning');
          } catch(e) {
            console.error("Error al guardar alerta_inspectoria:", e);
            App.showToast('Error de conexión al enviar alerta a Inspectoría', 'danger');
          }
        }
      }
    },

    async toggleDiaCalendario(dateKey) {
      const estId = this.selectedEstudianteId;
      if (!estId) return;

      const currentUser = Auth.currentUser ? Auth.currentUser.uid : 'sistema';
      const currentName = Auth.userProfile ? (Auth.userProfile.nombre || Auth.userProfile.email) : 'Sistema';

      if (this.currentTab === 'atrasos') {
        try {
          const existing = this.atrasosCache.find(a => a.estudianteId === estId && a.fecha === dateKey);
          if (existing) {
            const { error } = await window.supabaseGestion.from('atrasos').delete().eq('id', existing.id);
            if (error) throw error;
            this.atrasosCache = this.atrasosCache.filter(a => a.id !== existing.id);
            if (typeof Storage !== 'undefined' && Storage.cache) {
              Storage.cache.atrasos = Storage.cache.atrasos.filter(a => a.id !== existing.id);
            }
            App.showToast('Registro de atraso removido', 'success');
          } else {
            const record = {
              id: Date.now().toString(),
              estudianteId: estId,
              estudiante_id: estId,
              fecha: dateKey,
              justificado: false,
              funcionarioId: currentUser,
              funcionarioNombre: currentName,
              colegio_id: Storage.activeSchool || 'demo',
              colegioId: Storage.activeSchool || 'demo',
              timestamp: Date.now()
            };
            const calPayload = (Storage.prepareAtrasoPayload) ? Storage.prepareAtrasoPayload(record) : record;
            await window.supabaseGestion.from('atrasos').upsert(calPayload);
            this.atrasosCache.push(record);
            if (typeof Storage !== 'undefined' && Storage.cache) Storage.cache.atrasos.push(record);
            App.showToast('Atraso registrado para la fecha', 'success');
          }
        } catch(e) {
          console.error('Error al registrar atraso:', e);
          App.showToast('Error al registrar atraso: ' + e.message, 'danger');
        }
      } else if (this.currentTab === 'inasistencias') {
        const existing = this.inasistenciasCache.find(ins => ins.estudianteId === estId && ins.fecha === dateKey);
        if (existing) {
          const { error } = await window.supabaseGestion.from('inasistencias').delete().eq('id', existing.id);
          if (error) throw error;
          this.inasistenciasCache = this.inasistenciasCache.filter(ins => ins.id !== existing.id);
          if (typeof Storage !== 'undefined' && Storage.cache) {
            Storage.cache.inasistencias = Storage.cache.inasistencias.filter(i => i.id !== existing.id);
          }
          App.showToast('Inasistencia removida', 'success');
        } else {
          const record = {
            id: Date.now().toString(),
            estudianteId: estId,
            estudiante_id: estId,
            fecha: dateKey,
            justificado: false,
            funcionarioId: currentUser,
            funcionarioNombre: currentName,
            colegio_id: Storage.activeSchool || 'demo',
            colegioId: Storage.activeSchool || 'demo',
            timestamp: Date.now()
          };
          const calInasPayload = { id: record.id, estudiante_id: estId, fecha: dateKey, justificado: false, funcionario_id: currentUser, colegio_id: Storage.activeSchool || 'demo' };
          await window.supabaseGestion.from('inasistencias').upsert(calInasPayload);
          this.inasistenciasCache.push(record);
          if (typeof Storage !== 'undefined' && Storage.cache) Storage.cache.inasistencias.push(record);
          App.showToast('Ausencia registrada para la fecha', 'danger');
        }
      } else if (this.currentTab === 'justificativos') {
        const existing = this.inasistenciasCache.find(ins => ins.estudianteId === estId && ins.fecha === dateKey);
        if (existing) {
          const newVal = !existing.justificado;
          const { error } = await window.supabaseGestion.from('inasistencias').update({
            justificado: newVal,
            justificadoPor: newVal ? currentUser : null,
            justificadoNombre: newVal ? currentName : null
          }).eq('id', existing.id);
          if (error) throw error;
          existing.justificado = newVal;
          existing.justificadoPor = newVal ? currentUser : null;
          existing.justificadoNombre = newVal ? currentName : null;
          
          const storageIns = Storage.cache?.inasistencias?.find(i => i.id === existing.id);
          if (storageIns) {
            storageIns.justificado = newVal;
            storageIns.justificadoPor = newVal ? currentUser : null;
            storageIns.justificadoNombre = newVal ? currentName : null;
          }
          App.showToast(newVal ? 'Inasistencia justificada' : 'Justificación retirada', 'success');
        } else {
          const record = {
            id: Date.now().toString(),
            estudianteId: estId,
            estudiante_id: estId,
            fecha: dateKey,
            justificado: true,
            funcionarioId: currentUser,
            funcionarioNombre: currentName,
            colegio_id: Storage.activeSchool || 'demo',
            colegioId: Storage.activeSchool || 'demo',
            timestamp: Date.now()
          };
          const calJustPayload = { id: record.id, estudiante_id: estId, fecha: dateKey, justificado: true, funcionario_id: currentUser, colegio_id: Storage.activeSchool || 'demo' };
          await window.supabaseGestion.from('inasistencias').upsert(calJustPayload);
          this.inasistenciasCache.push(record);
          if (typeof Storage !== 'undefined' && Storage.cache) Storage.cache.inasistencias.push(record);
          App.showToast('Justificativo registrado para la fecha', 'success');
        }
      }

      const rightCol = document.querySelector('div[style*="display: grid; grid-template-columns: 320px 1fr"] > div:last-child');
      if (rightCol) {
        rightCol.innerHTML = this.renderRightPanel();
      }
      const leftCol = document.querySelector('div[style*="display: grid; grid-template-columns: 320px 1fr"] > div:first-child');
      if (leftCol) {
        leftCol.innerHTML = `
          <h4 style="margin-top: 0; margin-bottom: 1rem; color: var(--text-primary);">Estudiantes y Filtros</h4>
          <div class="form-group mb-3">
            <label class="form-label" style="font-weight: 600;">Filtrar por Curso</label>
            <select class="form-control" id="asist-curso-select" onchange="AsistenciaView.changeCurso(this.value)">
              ${DATA.cursos.map(c => `<option value="${c.id}" ${this.selectedCursoId === c.id ? 'selected' : ''}>${c.nombre}</option>`).join('')}
            </select>
          </div>
          <div class="form-group mb-3" style="position: relative;">
            <label class="form-label" style="font-weight: 600;">Buscar Estudiante (Nombre/RUT)</label>
            <input type="text" id="asist-estudiante-search" class="form-control" placeholder="Escribe para buscar..." oninput="AsistenciaView.handlePredictiveSearch(this.value)" autocomplete="off">
            <div id="asist-autocomplete-results" style="position: absolute; width: 100%; max-height: 200px; overflow-y: auto; background: white; border: 1px solid var(--border-color); border-radius: 4px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 1000; display: none;"></div>
          </div>
          ${this.renderStudentList()}
        `;
      }
    }
  };
})();

if (typeof window !== 'undefined') {
  window.AsistenciaView = AsistenciaView;
}
})();
