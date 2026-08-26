/* ================================================================
   estudiantes.js — Ficha del Estudiante
   Gestión de perfil, anotaciones, faltas, y protocolos vinculados.
   ================================================================ */

(() => {
const EstudiantesView = {
  _filtroActual: 'todas',
  _chatHistory: [],
  _currentEstudianteId: null,
  _mostrarTodas: false,

  renderPACITemplate(est) {
    if (!est.paci) {
      est.paci = [false, false, false, false, false, false];
    }
    const pasosNombres = [
      "Recopilación de antecedentes (Diagnóstico, informe médico, informe de aula).",
      "Reunión de planificación colaborativa (Citación a padres y equipo docente).",
      "Definición de adecuaciones (Selección de apoyos de acceso o curriculares).",
      "Redacción formal del documento PACI (Carga de información en el formulario oficial).",
      "Aprobación y firma del documento (Firma de padres, dirección y UTP).",
      "Carga en el sistema de seguimiento (Activación de la ficha del estudiante)."
    ];
    
    const completados = est.paci.filter(p => p).length;
    const porcentaje = Math.round((completados / 6) * 100);
    
    let colorBarra = 'var(--primary)';
    if (porcentaje === 100) colorBarra = 'var(--success)';
    
    let pasosHtml = '';
    for (let i = 0; i < 6; i++) {
      const isChecked = est.paci[i];
      const isEnabled = i === 0 || est.paci[i - 1];
      
      pasosHtml += `
        <label class="flex items-center gap-2 mt-3" style="cursor: ${isEnabled ? 'pointer' : 'not-allowed'}; opacity: ${isEnabled ? '1' : '0.5'}; padding: 0.5rem; background: ${isEnabled ? (isChecked ? '#f0fdf4' : '#fff') : '#f8fafc'}; border: 1px solid ${isEnabled ? (isChecked ? '#bbf7d0' : '#e2e8f0') : '#e2e8f0'}; border-radius: 6px;">
          <input type="checkbox" ${isChecked ? 'checked' : ''} ${isEnabled ? '' : 'disabled'} onchange="EstudiantesView.togglePACI('${est.id}', ${i}, this.checked)" style="width: 1.2rem; height: 1.2rem; accent-color: var(--success);">
          <span style="font-size: 0.9rem; color: ${isEnabled ? 'var(--text-primary)' : 'var(--text-secondary)'}; line-height: 1.2;">${pasosNombres[i]}</span>
        </label>
      `;
    }

    return `
      <div class="card card-tracking mt-3" style="border-top: 4px solid #0ea5e9;">
        <div class="card-header pb-2">
          <h3 class="card-title inline-flex items-center gap-2">${Icons.get('puzzle', 18)} Proceso PACI</h3>
        </div>
        <div class="card-body pt-0 mt-3">
          <div style="font-size: 0.85rem; margin-bottom: 8px; display: flex; justify-content: space-between; color: var(--text-secondary);">
            <strong style="color: var(--text-primary);">Progreso de Implementación</strong>
            <span style="font-weight: 600; color: ${colorBarra};">${completados} de 6 pasos (${porcentaje}%)</span>
          </div>
          <div style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
            <div style="height: 100%; width: ${porcentaje}%; background: ${colorBarra}; border-radius: 4px; transition: width 0.3s ease;"></div>
          </div>
          ${completados === 6 ? `<div style="margin-top: 10px; font-size: 0.85rem; color: var(--success); font-weight: 600; text-align: center; display: inline-flex; align-items: center; gap: 0.25rem;">${Icons.get('check-circle-2', 16)} ¡PACI completado con éxito!</div>` : ''}
          <div class="mt-4">
            ${pasosHtml}
          </div>
        </div>
      </div>
    `;
  },
  
  togglePACI(id, stepIndex, state) {
    const est = Storage.getEstudianteById(id);
    if (!est) return;
    
    if (!est.paci) est.paci = [false, false, false, false, false, false];
    
    if (!state) {
      for (let i = stepIndex; i < 6; i++) est.paci[i] = false;
    } else {
      est.paci[stepIndex] = true;
    }
    
    Storage.saveEstudiante(est);
    
    if (state && stepIndex === 5) {
      App.showToast('¡PACI completado con éxito!', 'success');
      setTimeout(() => App.showToast('¡Proceso PACI completado con éxito para este estudiante!', 'success'), 100);
    }
    
    this.renderDetalle(document.getElementById('app-content'), id, true);
  },

  renderSeguimientosTemplate(est) {
    const casos = Storage.getCasosByEstudiante ? Storage.getCasosByEstudiante(est.id) : [];
    const activos = casos.filter(c => c.estado !== 'cerrado' && (c.tipo === 'seguimiento' || c.tipo === 'complejo'));
    
    if (activos.length === 0) return '';
    
    let html = '';
    activos.forEach(caso => {
      const isComplejo = caso.tipo === 'complejo';
      const colorBarra = isComplejo ? 'var(--danger)' : 'var(--primary)';
      const eventos = caso.seguimiento || [];
      const completados = eventos.length;
      
      html += `
        <div class="card card-tracking mt-3" style="border-top: 4px solid ${colorBarra};">
          <div class="card-header card-tracking-header pb-2 flex justify-between items-center">
            <div>
              <h3 class="card-title" style="margin: 0;">${isComplejo ? '🔴' : '🔵'} Seguimiento: ${caso.titulo || 'Sin motivo'}</h3>
              <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">Tipo: ${isComplejo ? 'Caso Complejo' : 'Situación Leve'}</div>
            </div>
          </div>
          <div class="card-body pt-0 mt-3">
            <div style="font-size: 0.85rem; margin-bottom: 8px; color: var(--text-secondary);">
              <strong style="color: var(--text-primary);">Eventos en bitácora:</strong> ${completados}
            </div>
            <div class="text-right mt-2">
              <button class="btn btn-sm" style="background-color: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; font-weight: 600;" onclick="EstudiantesView.finalizarSeguimientoCaso('${est.id}', '${caso.id}')">
                🏁 Finalizar Seguimiento
              </button>
            </div>
          </div>
        </div>
      `;
    });
    return html;
  },


  sanitizeId(str) {
    try { return String(str).replace(/[^a-zA-Z0-9-_]/g, '_'); } catch (_e) { return String(str || ''); }
  },

  renderBitacoraTemplate(est) {
    let registros = [];
    const targetYear = String(this.selectedFichaYear || Storage.getActiveYear());

    // 1. Registros directos del estudiante
    if (est && Array.isArray(est.bitacoraSeguimiento)) {
      let updated = false;
      est.bitacoraSeguimiento.forEach((b, idx) => {
        if (b && (b.texto || b.descripcion)) {
          const bFecha = b.fecha || '';
          if (bFecha && !bFecha.startsWith(targetYear)) return;
          if (!b.id) {
            b.id = `bit_${idx}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
            updated = true;
          }
          registros.push({
            id: b.id,
            index: idx,
            fecha: b.fecha,
            texto: b.texto || b.descripcion,
            registradoPor: b.registradoPor || 'Sistema',
            adjunto: b.adjunto || null,
            source: 'bitacora_estudiante'
          });
        }
      });
      if (updated) Storage.saveEstudiante(est);
    }

    // 3. Casos de seguimiento
    const casos = Storage.getCasosByEstudianteAndYear ? Storage.getCasosByEstudianteAndYear(est.id, targetYear) : [];
    casos.forEach(c => {
      if (c && c.seguimiento && Array.isArray(c.seguimiento)) {
        c.seguimiento.forEach((s, idx) => {
          if (s && (s.texto || s.descripcion)) {
            registros.push({
              ...s,
              id: s.id || `caso_seg_${c.id}_${idx}`,
              casoId: c.id,
              fecha: s.fecha || c.fecha,
              texto: s.texto || s.descripcion,
              registradoPor: s.registradoPor || c.registradoPor || 'Sistema',
              isCasoEvent: true,
              casoTipo: c.tipo,
              casoTitulo: c.titulo,
              source: 'casos'
            });
          }
        });
      }
    });

    // 4. Filtro anti-registros vacíos y confirmaciones de "leído"
    registros = registros.filter(r => {
      if (!r || !r.texto || !r.texto.trim()) return false;
      if (r.is_seen_confirm || (r.id && String(r.id).startsWith('seen_log_'))) return false;
      return true;
    });

    // Deduplicación: si un registro propio de bitacora_estudiante tiene el mismo texto y una fecha similar a uno de casos, preferir el de casos
    let filteredRegistros = [];
    registros.forEach(r => {
      if (r.source === 'bitacora_estudiante') {
        const dateR = new Date(r.fecha).getTime();
        const isDuplicate = registros.some(other => 
          other.source === 'casos' && 
          other.texto === r.texto && 
          !isNaN(dateR) && 
          !isNaN(new Date(other.fecha).getTime()) &&
          Math.abs(new Date(other.fecha).getTime() - dateR) < 300000 // Ventana de 5 minutos
        );
        if (!isDuplicate) {
          filteredRegistros.push(r);
        }
      } else {
        filteredRegistros.push(r);
      }
    });
    registros = filteredRegistros;

    registros.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    const mostrarCantidad = this._mostrarTodasBitacora ? registros.length : 3;
    const visibles = registros.slice(0, mostrarCantidad);
    const quedan = registros.length - visibles.length;

    let listaHtml = visibles.map(b => {
          const safeId = this.sanitizeId(b.id || b.fecha);
          const fechaFormatted = isNaN(new Date(b.fecha).getTime()) ? new Date().toLocaleString() : new Date(b.fecha).toLocaleString();
          
          let headerText = `${fechaFormatted}${b.registradoPor ? ' | Registrado por: ' + Storage.safeHtml(b.registradoPor) : ''}`;
          if (b.isCasoEvent && b.casoTitulo) {
            const badgeColor = (b.casoTipo === 'complejo' || String(b.texto).includes('Caso Complejo') || String(b.texto).includes('🔴')) ? 'var(--danger)' : 'var(--primary)';
            headerText += ` | <span style="color: ${badgeColor}; font-weight: bold;">[Caso: ${Storage.safeHtml(b.casoTitulo)}]</span>`;
          }

          // Formateo de viñeta y color según tipo
          let textoHtml = Storage.safeHtml(b.texto);
          // Limpiar caracteres corruptos iniciales (/ o comillas sueltas o simbolos)
          textoHtml = textoHtml.replace(/^[\/\\?\s"':;\.-]+/g, '');
          // Eliminar explicaciones entre paréntesis en "Inicio de Caso Complejo (...):"
          textoHtml = textoHtml.replace(/\s*\([^)]*\)\s*:/g, ':');
          // Eliminar numeración de protocolos "Protocolo X —" o "Protocolo X -"
          textoHtml = textoHtml.replace(/Protocolo\s*\d+\s*[\u2014\-]\s*/gi, '');

          if (textoHtml.includes('🔴') || textoHtml.includes('Caso Complejo')) {
            textoHtml = `<span style="color: var(--danger); font-weight: 600; display: inline-flex; align-items: center; vertical-align: middle; margin-right: 4px;">${Icons.get('alert-circle', 14)}</span> ${textoHtml.replace(/^[🔴🟢🔵🟣]\s*/, '')}`;
          } else if (textoHtml.includes('🔵') || textoHtml.includes('Seguimiento Leve')) {
            textoHtml = `<span style="color: #0ea5e9; font-weight: 600; display: inline-flex; align-items: center; vertical-align: middle; margin-right: 4px;">${Icons.get('info', 14)}</span> ${textoHtml.replace(/^[🔴🟢🔵🟣]\s*/, '')}`;
          } else if (textoHtml.includes('🟢') || textoHtml.includes('Medidas PIE')) {
            textoHtml = `<span style="color: var(--success); font-weight: 600; display: inline-flex; align-items: center; vertical-align: middle; margin-right: 4px;">${Icons.get('check-circle-2', 14)}</span> ${textoHtml.replace(/^[🔴🟢🔵🟣]\s*/, '')}`;
          } else if (textoHtml.includes('🟣') || textoHtml.includes('Apoyo Psicosocial')) {
            textoHtml = `<span style="color: #8b5cf6; font-weight: 600; display: inline-flex; align-items: center; vertical-align: middle; margin-right: 4px;">${Icons.get('shield', 14)}</span> ${textoHtml.replace(/^[🔴🟢🔵🟣]\s*/, '')}`;
          }

          return `
            <div class="bitacora-item" style="position: relative; padding-bottom: 2.5rem; border-bottom: 1px solid #e2e8f0; margin-bottom: 1rem;">
              <div>
                <div id="bitacora-reg-${safeId}" style="font-weight: 600; color: var(--primary); font-size: 0.75rem;">${headerText}</div>
                <div id="bitacora-texto-${safeId}" style="margin-top: 4px; font-size: 0.9rem;">${textoHtml}</div>
                ${(b.fechaProximoSeguimiento || b.fechaProximo) ? `<div class="mt-2" style="font-size: 0.8rem; color: #0284c7; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; background: #e0f2fe; padding: 0.25rem 0.6rem; border-radius: 6px; border: 1px solid #bae6fd;">${Icons.get('calendar', 12)} Próximo Seguimiento: ${new Date(b.fechaProximoSeguimiento || b.fechaProximo).toLocaleDateString()}</div>` : ''}
                ${b.adjunto ? `<div class="mt-2" style="font-size: 0.8rem; color: var(--success); font-weight: 600; display: flex; align-items: center; gap: 4px;">${Icons.get('paperclip', 12)} Documento adjunto: ${Storage.safeHtml(b.adjunto)} <button class="btn btn-sm p-0" style="color: var(--primary); display: inline-flex; align-items: center; border: none; background: transparent; cursor: pointer; margin-left: 4px;" onclick="App.showToast('Descargando archivo...', 'info')" title="Descargar archivo">${Icons.get('inbox', 12)}</button></div>` : ''}
              </div>
              ${Auth.canWriteCasos() ? `
              <div style="position: absolute; bottom: 0.5rem; right: 0.5rem; display: flex; gap: 0.5rem; align-items: center;">
                <button class="btn btn-sm inline-flex items-center" style="background: transparent; color: ${b.adjunto ? 'var(--primary)' : 'var(--text-secondary)'}; border: none; padding: 0.2rem; ${b.adjunto ? 'opacity: 0.4; cursor: not-allowed; pointer-events: none;' : ''}" onclick="EstudiantesView.subirAdjuntoBitacora('${est.id}', '${b.id || b.fecha}')" title="${b.adjunto ? 'Archivo adjunto' : 'Adjuntar archivo'}" ${b.adjunto ? 'disabled' : ''}>${Icons.get('paperclip', 16)}</button>
                <button class="btn btn-sm inline-flex items-center" style="background: transparent; color: var(--text-secondary); border: none; padding: 0.2rem;" onclick="EstudiantesView.editarBitacoraSeguimiento('${est.id}', '${b.id || b.fecha}', '${b.casoId || ''}')" title="Editar registro">${Icons.get('pencil', 16)}</button>
              </div>
              ` : ''}
            </div>
          `;
        }).join('');

    if (registros.length === 0) {
      listaHtml = '<p class="text-muted text-center" style="font-size: 0.85rem;">No hay registros en la bitácora aún.</p>';
    } else {
      if (quedan > 0) {
        listaHtml += `
          <div class="text-center mt-2">
            <button class="btn btn-secondary btn-sm" onclick="window.EstudiantesView.toggleMostrarTodasBitacora('${est.id}')">Ver más registros (${quedan})</button>
          </div>
        `;
      } else if (this._mostrarTodasBitacora && registros.length > 3) {
        listaHtml += `
          <div class="text-center mt-2">
            <button class="btn btn-secondary btn-sm" onclick="window.EstudiantesView.toggleMostrarTodasBitacora('${est.id}')">Ocultar registros</button>
          </div>
        `;
      }
    }

    const html = `
      <div class="card mt-4">
        <div class="card-header flex justify-between items-center">
          <h3 class="card-title" style="display: inline-flex; align-items: center; gap: 0.5rem;">${Icons.get('book-open', 20)} Bitácora</h3>
          ${(est.enSeguimiento || est.esComplejo || est.requiereApoyoPsicosocial || est.planUtpActivo || est.medidasPie || est.esEstudiantePIE || est.compromisoConductualActivo) && Auth.canManageSeguimiento() ? `
          <button class="btn btn-sm btn-primary" onclick="EstudiantesView.nuevaBitacoraSeguimiento('${est.id}')">
            + Añadir
          </button>
          ` : ''}
        </div>
        <div class="card-body">
          <div class="bitacora-container">
            ${listaHtml}
          </div>
        </div>
      </div>
    `;

    return html;
  },

  applyBitacoraText(container, est) {
    // Ya no sobrescribe el HTML previamente renderizado de forma directa
    return;
  },

  async finalizarSeguimientoCaso(estId, casoId) {
    App.showConfirm('Confirmar', '¿Está seguro de que desea finalizar este seguimiento?', async () => {
      const caso = Storage.getCasoById ? Storage.getCasoById(casoId) : null;
      if (!caso) return;
      
      caso.estado = 'cerrado';
      if (!caso.seguimiento) caso.seguimiento = [];
      caso.seguimiento.push({
        id: Date.now().toString(),
        fecha: new Date().toISOString(),
        texto: '🏁 Seguimiento Finalizado',
        registradoPor: Auth.currentUser?.email || 'Sistema'
      });
      caso.seguimiento.sort((a,b) => new Date(a.fecha) - new Date(b.fecha));
      
      try {
        await Storage.saveCaso(caso);
        
        // Revisar si quedan casos activos de ese tipo para el estudiante
        const casos = Storage.getCasosByEstudiante ? Storage.getCasosByEstudiante(estId) : [];
        const tipo = caso.tipo;
        const quedanActivos = casos.filter(c => c.estado !== 'cerrado' && c.tipo === tipo).length > 0;
        
        const est = Storage.getEstudianteById(estId);
        if (est && !quedanActivos) {
          if (tipo === 'seguimiento') est.enSeguimiento = false;
          if (tipo === 'complejo') est.esComplejo = false;
          if (tipo === 'apoyo_psicosocial') est.requiereApoyoPsicosocial = false;
          if (tipo === 'plan_utp') est.planUtpActivo = false;
          if (tipo === 'medidas_pie') est.medidasPie = false;
          await Storage.saveEstudiante(est);
        }
        
        App.showToast('Seguimiento finalizado exitosamente.', 'success');
        this.renderDetalle(document.getElementById('app-content'), estId, true);
      } catch(e) {
        App.showToast('Error al finalizar seguimiento: ' + e.message, 'danger');
      }
    });
  },


  renderDetalle(container, id, keepState = false) {
    console.log("DEBUG renderDetalle - id:", id, "isReady:", Storage.isReady, "school:", Storage.activeSchool, "year:", Storage.getActiveYear(), "cached count:", Storage.cache.estudiantes.length);
    console.log("DEBUG search student:", id, "found in cache:", Storage.cache.estudiantes.find(e => e.id === id), "all ids in cache:", Storage.cache.estudiantes.map(e => e.id));
    const isPIEView = window.location.hash.startsWith('#/pie');
    if (!keepState) {
      this.selectedFichaYear = Storage.getActiveYear();
      try {
        const savedFiltro = localStorage.getItem(`estudiante_timeline_filtro_${id}`);
        this._filtroActual = savedFiltro || 'todas';
      } catch (e) {
        this._filtroActual = 'todas';
      }
      this._mostrarTodas = false;
      this._mostrarTodasBitacora = false;
    }
    
    const est = Storage.getEstudianteById(id);



    if (!est) {
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
      container.innerHTML = `
        <div class="card text-center" style="padding: 3rem 1rem; margin-top: 2rem;">
          <h2 style="color: var(--danger); margin-bottom: 1rem;">⚠️ Estudiante No Encontrado</h2>
          <p class="text-secondary" style="margin-bottom: 2rem;">El estudiante que intentas visualizar ya no existe en el sistema o los datos de prueba fueron limpiados recientemente.</p>
          <div style="display: flex; gap: 1rem; justify-content: center;">
            <button class="btn btn-secondary" onclick="window.history.back()">⬅️ Volver Atrás</button>
            <a href="#/cursos" class="btn btn-primary">Ir a Lista de Cursos</a>
          </div>
        </div>
      `;
      App.setBreadcrumb(`<a href="#/cursos">Cursos</a> / Error`);
      return;
    }
    
    const curso = DATA.getCurso(est.curso);
    App.setBreadcrumb(`<a href="#/cursos">Cursos</a> / <a href="#/cursos/${curso?.id || est.curso || ''}">${curso?.nombre || est.curso || 'Sin curso'}</a> / Ficha`);
    
    const targetYear = String(this.selectedFichaYear || Storage.getActiveYear());
    const anotaciones = Storage.getAnotacionesByEstudianteAndYear ? Storage.getAnotacionesByEstudianteAndYear(est.id, targetYear) : [];
    
    let eventos = (Storage.cache.eventos || []).filter(e => {
      const eId = String(e.estudianteId || e.estudiante_id || '').trim();
      if (eId !== String(est.id)) return false;
      const fecha = String(e.fecha || e.fechaCreacion || '');
      return (fecha.startsWith(targetYear) || fecha.endsWith(targetYear) || fecha.includes('-' + targetYear) || fecha.includes('/' + targetYear));
    });
    
    // Merge anotaciones / bitacora into events timeline
    anotaciones.forEach(a => {
      eventos.push({
        id: a.id,
        fecha: a.fecha,
        tipo: a.tipo || 'observacion',
        descripcion: a.descripcion || '',
        responsable: a.registradoPor || a.funcionarioNombre || 'Sistema',
        autorId: a.autorId || a.autor_id,
        isAnotacion: true
      });
    });
    
    // Merge atrasos
    const atrasos = (Storage.cache.atrasos || []).filter(a => {
      const eId = String(a.estudianteId || a.estudiante_id || '').trim();
      const fecha = String(a.fecha || '');
      return eId === String(est.id) && (fecha.startsWith(targetYear) || fecha.endsWith(targetYear) || fecha.includes('-' + targetYear) || fecha.includes('/' + targetYear));
    });
    atrasos.forEach(a => {
      eventos.push({
        id: 'atraso_' + a.id,
        fecha: a.fecha,
        tipo: 'atraso',
        descripcion: 'Atraso registrado en control de asistencia.',
        responsable: a.funcionarioNombre || a.funcionarioId || 'sistema'
      });
    });

    // Merge inasistencias
    const inasistencias = (Storage.cache.inasistencias || []).filter(i => {
      const eId = String(i.estudianteId || i.estudiante_id || '').trim();
      const fecha = String(i.fecha || '');
      return eId === String(est.id) && (fecha.startsWith(targetYear) || fecha.endsWith(targetYear) || fecha.includes('-' + targetYear) || fecha.includes('/' + targetYear));
    });
    inasistencias.forEach(i => {
      const tipoLabel = i.justificado ? 'ausencia justificada' : 'ausencia';
      const justifText = i.justificado ? ' (Justificada)' : '';
      eventos.push({
        id: 'inasistencia_' + i.id,
        fecha: i.fecha,
        tipo: tipoLabel,
        descripcion: 'Inasistencia registrada en control de asistencia.' + justifText,
        responsable: (i.justificado && i.justificadoNombre) ? i.justificadoNombre : (i.funcionarioNombre || i.funcionarioId || 'sistema')
      });
    });

    const protocolos = Storage.getProtocolosByEstudiante ? Storage.getProtocolosByEstudiante(est.id) : [];
    const casos = Storage.getCasosByEstudianteAndYear ? Storage.getCasosByEstudianteAndYear(est.id, targetYear) : [];
    
    // Semáforo Visual (Riesgo Combinado)
    let riesgoScore = 0;
    if (casos.length > 0) riesgoScore += 2;
    if (est.esComplejo || protocolos.length > 0) riesgoScore += 2;
    if (est.apoyoPsicosocial) riesgoScore += 1;
    
    const countNegativos = (typeof Storage.getEventosByEstudiante === 'function' ? Storage.getEventosByEstudiante(est.id) : []).filter(e => e.tipo === 'conflicto_leve').length + atrasos.length;
    if (countNegativos >= 3) riesgoScore += 1;
    
    // Asistencia Real (asumiendo 180 días)
    const diasAsistidos = 180 - inasistencias.length;
    const asistenciaReal = Math.round((diasAsistidos / 180) * 100);
    if (asistenciaReal < 85) riesgoScore += 2;
    
    let colorActivo = 'green';
    let estadoTexto = 'Bajo Riesgo';
    if (riesgoScore >= 4) {
      colorActivo = 'red';
      estadoTexto = 'Riesgo Alto';
    } else if (riesgoScore >= 2) {
      colorActivo = 'yellow';
      estadoTexto = 'Riesgo Medio';
    }

    const riesgoHtml = `
      <div class="flex items-center gap-2" title="${estadoTexto} (Score: ${riesgoScore})">
        <div style="display:flex; background:#333; padding:4px; border-radius:12px; gap:4px;">
          <div style="width:14px; height:14px; border-radius:50%; background: ${colorActivo==='red'?'#ef4444':'#555'}; box-shadow: ${colorActivo==='red'?'0 0 8px #ef4444':'none'};"></div>
          <div style="width:14px; height:14px; border-radius:50%; background: ${colorActivo==='yellow'?'#f59e0b':'#555'}; box-shadow: ${colorActivo==='yellow'?'0 0 8px #f59e0b':'none'};"></div>
          <div style="width:14px; height:14px; border-radius:50%; background: ${colorActivo==='green'?'#10b981':'#555'}; box-shadow: ${colorActivo==='green'?'0 0 8px #10b981':'none'};"></div>
        </div>
        <span style="font-weight:600; font-size:0.875rem;">${estadoTexto}</span>
      </div>
    `;

    let html = `
      <div class="dashboard-grid">
        <!-- Columna Izquierda: Perfil -->
        <div class="col-perfil flex-col gap-4">
          <div class="card">
            <div class="card-header flex justify-between items-start gap-4" style="border:none; padding-bottom:0; flex-wrap: wrap;">
              <div style="flex: 1; min-width: 250px;">
                <h2 style="margin: 0; font-size: 1.5rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                  <span>${est.nombres} ${est.apellidos}</span>
                  ${(est.esEstudiantePIE || isPIEView) ? `<span class="badge inline-flex items-center gap-1" style="background: #0ea5e9; color: white; font-size: 0.85rem; padding: 0.25rem 0.5rem; border-radius: 12px; font-weight: 600;">${Icons.get('puzzle', 16)} PIE</span>` : ''}
                </h2>
                <div class="text-muted mt-1 mb-2">${curso ? curso.nombre : 'Sin curso'}</div>
                <div class="flex items-center gap-2 mb-3" style="flex-wrap: wrap;">
                  <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary);">Año Historial Ficha:</span>
                  <select class="form-control form-control-sm" style="width: auto; padding: 0.2rem 0.5rem; display: inline-block; font-size: 0.8rem; background: var(--bg-hover); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px;" onchange="window.EstudiantesView.cambiarFichaYear('${est.id}', this.value)">
                    <option value="2024" ${targetYear === '2024' ? 'selected' : ''}>2024</option>
                    <option value="2025" ${targetYear === '2025' ? 'selected' : ''}>2025</option>
                    <option value="2026" ${targetYear === '2026' ? 'selected' : ''}>2026</option>
                  </select>
                </div>
                <div class="flex-col gap-1">
                  <label class="flex items-center gap-2" style="cursor: ${Auth.canManageSeguimiento() ? 'pointer' : 'default'}; margin-bottom: 0.25rem;">
                    <input type="checkbox" ${est.enSeguimiento ? 'checked' : ''} onchange="EstudiantesView.toggleAtributo('${est.id}', 'enSeguimiento', this.checked)" style="width: 1rem; height: 1rem; accent-color: var(--primary);" ${Auth.canManageSeguimiento() ? '' : 'disabled'}>
                    <span style="font-weight: 600; font-size: 0.8rem; color: ${est.enSeguimiento ? 'var(--primary)' : 'var(--text-secondary)'};">Estudiante en Seguimiento</span>
                  </label>
                  <label class="flex items-center gap-2" style="cursor: ${Auth.canManageSeguimiento() ? 'pointer' : 'default'}; margin-bottom: 0.25rem;">
                    <input type="checkbox" ${est.esComplejo ? 'checked' : ''} onchange="EstudiantesView.toggleAtributo('${est.id}', 'esComplejo', this.checked)" style="width: 1rem; height: 1rem; accent-color: var(--danger);" ${Auth.canManageSeguimiento() ? '' : 'disabled'}>
                    <span style="font-weight: 600; font-size: 0.8rem; color: ${est.esComplejo ? 'var(--danger)' : 'var(--text-secondary)'};">Estudiante Complejo (Protocolos Aplicados)</span>
                  </label>
                  <label class="flex items-center gap-2" style="cursor: ${Auth.canManageSeguimiento() ? 'pointer' : 'default'}; margin-bottom: 0.25rem;">
                    <input type="checkbox" ${est.requiereApoyoPsicosocial ? 'checked' : ''} onchange="EstudiantesView.toggleAtributo('${est.id}', 'requiereApoyoPsicosocial', this.checked)" style="width: 1rem; height: 1rem; accent-color: var(--chart-warning);" ${Auth.canManageSeguimiento() ? '' : 'disabled'}>
                    <span style="font-weight: 600; font-size: 0.8rem; color: ${est.requiereApoyoPsicosocial ? 'var(--badge-warning-text)' : 'var(--text-secondary)'};">Requiere Apoyo Psicosocial</span>
                  </label>
                  <label class="flex items-center gap-2" style="cursor: ${Auth.canManageSeguimiento() ? 'pointer' : 'default'}; margin-bottom: 0.25rem;">
                    <input type="checkbox" ${est.planUtpActivo ? 'checked' : ''} onchange="EstudiantesView.toggleAtributo('${est.id}', 'planUtpActivo', this.checked)" style="width: 1rem; height: 1rem; accent-color: var(--chart-positive-green);" ${Auth.canManageSeguimiento() ? '' : 'disabled'}>
                    <span style="font-weight: 600; font-size: 0.8rem; color: ${est.planUtpActivo ? 'var(--badge-success-text)' : 'var(--text-secondary)'};">Plan UTP Activo</span>
                  </label>
                </div>

                <!-- Bloque Inferior Aislado: Compromiso Activo + Estudiante PIE -->
                <div style="margin-top: 1rem; padding-top: 0.65rem; border-top: 1px dashed #cbd5e1;" class="flex-col gap-2">
                  <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                    <label class="flex items-center gap-2" style="cursor: ${Auth.canManageSeguimiento() ? 'pointer' : 'default'}; margin: 0;">
                      <input type="checkbox" ${est.compromisoConductualActivo ? 'checked' : ''} onchange="EstudiantesView.toggleCompromisoConductual('${est.id}', this.checked)" style="width: 1rem; height: 1rem; accent-color: var(--chart-warning);" ${Auth.canManageSeguimiento() ? '' : 'disabled'}>
                        <span style="font-weight: 600; font-size: 0.8rem; color: ${est.compromisoConductualActivo ? 'var(--badge-warning-text)' : 'var(--text-secondary)'};">Compromiso Activo de Anotaciones</span>
                    </label>
                    <label class="flex items-center gap-2" style="cursor: ${Auth.canManageSeguimiento() ? 'pointer' : 'default'}; margin: 0;">
                      <input type="checkbox" ${est.esEstudiantePIE ? 'checked' : ''} onchange="EstudiantesView.toggleAtributo('${est.id}', 'esEstudiantePIE', this.checked)" style="width: 1rem; height: 1rem; accent-color: var(--chart-positive-green);" ${Auth.canManageSeguimiento() ? '' : 'disabled'}>
                      <span class="inline-flex items-center gap-1" style="font-weight: 600; font-size: 0.8rem; color: ${est.esEstudiantePIE ? 'var(--badge-success-text)' : 'var(--text-secondary)'};">${Icons.get('puzzle', 16)} Estudiante PIE</span>
                    </label>
                  </div>
                  ${est.compromisoConductualActivo ? `
                    <div style="margin-top: 0.25rem; padding: 0.4rem 0.65rem; background: var(--badge-warning-bg); border: 1px solid var(--badge-warning-border); border-radius: 6px; font-size: 0.78rem; color: var(--badge-warning-text);">
                      <strong>Vigencia:</strong> ${est.compromisoFechaInicio || 'Hoy'} al ${est.compromisoFechaTermino || 'Sin fecha'}<br>
                      <strong>Estado:</strong> ${(() => {
                        let res = null;
                        if (window.RICEEngine && typeof window.RICEEngine.evaluarCompromisoEstudiante === 'function') {
                          res = window.RICEEngine.evaluarCompromisoEstudiante(est.id);
                        }
                        const estado = (res && res.estado) || est.compromisoEstado || 'vigente';
                        if (estado === 'incumplido') {
                          return `<span class="badge inline-flex items-center gap-1" style="background:var(--badge-danger-bg); color:var(--badge-danger-text); border:1px solid var(--badge-danger-border);">🚨 Incumplido</span>`;
                        } else if (estado === 'cumplido') {
                          return `<span class="badge inline-flex items-center gap-1" style="background:var(--badge-success-bg); color:var(--badge-success-text); border:1px solid var(--badge-success-border);">${Icons.get('check-circle-2', 14)} Cumplido</span>`;
                        } else if (estado === 'cumplido_pendiente') {
                          return `<span class="badge inline-flex items-center gap-1" style="background:var(--badge-warning-bg); color:var(--badge-warning-text); border:1px solid var(--badge-warning-border);">⏳ Finalizado (Pendiente de Alta)</span>`;
                        } else {
                          return `<span class="badge inline-flex items-center gap-1" style="background:var(--badge-warning-bg); color:var(--badge-warning-text); border:1px solid var(--badge-warning-border);">⏳ Vigente</span>`;
                        }
                      })()}
                    </div>
                  ` : ''}
                </div>
              </div>
              <div class="text-right">
                <div class="mb-2">Semáforo RICE: ${window.RICEEngine ? window.RICEEngine.evaluarEstudiante(est.id).badgeHtml : riesgoHtml}</div>
                ${Auth.canWriteEstudiantes() ? `
                <button class="btn btn-sm btn-secondary inline-flex items-center gap-1" onclick="EstudiantesView.editar('${est.id}')">${Icons.get('pencil', 16)} Editar Datos</button>
                ` : ''}
              </div>
            </div>
          </div>
          
          ${this.renderBitacoraTemplate(est)}
          ${this.renderComparativaAnualTemplate(est)}
          ${(isPIEView || est.esEstudiantePIE) ? this.renderPACITemplate(est) : ''}
        </div>
        
        <!-- Columna Derecha: Anotaciones y Faltas -->
        <div class="col-registros flex-col gap-4">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title inline-flex items-center gap-2">${Icons.get('bar-chart-2', 18)} Comportamiento Mensual</h3>
            </div>
            <div class="card-body">
              <canvas id="chart-comportamiento-container" style="width:100%; height:250px;"></canvas>
            </div>
          </div>
          <div class="card" style="height: 100%;">
            <div class="card-header flex justify-between items-center">
              <h3 class="card-title">Línea de Tiempo de Eventos</h3>
              <div class="flex gap-2 flex-wrap">
                <button class="btn btn-primary btn-sm inline-flex items-center gap-2" onclick="EstudiantesView.abrirModalCargarPDFHojaVida('${est.id}')" title="Cargar e Ingestar Hoja de Vida en Excel">
                  ${Icons.get('file-spreadsheet', 18)} Cargar Hoja de Vida (Excel)
                </button>
              </div>
            </div>
            
            <div class="card-body" style="padding-bottom: 0;">
               <div class="flex gap-2 mb-3 flex-wrap">
                  <button class="btn btn-sm ${this._filtroActual === 'todas' ? 'btn-primary' : 'btn-secondary'}" onclick="EstudiantesView.setFiltro('${est.id}', 'todas')">Todos</button>
                  <button class="btn btn-sm ${this._filtroActual === 'observacion' ? 'btn-primary' : 'btn-secondary'}" onclick="EstudiantesView.setFiltro('${est.id}', 'observacion')">Observaciones</button>
                  <button class="btn btn-sm ${this._filtroActual === 'entrevista' ? 'btn-primary' : 'btn-secondary'}" onclick="EstudiantesView.setFiltro('${est.id}', 'entrevista')">Entrevistas</button>
                  <button class="btn btn-sm ${this._filtroActual === 'positiva' ? 'btn-primary' : 'btn-secondary'}" onclick="EstudiantesView.setFiltro('${est.id}', 'positiva')">Positivas</button>
                  <button class="btn btn-sm ${this._filtroActual === 'negativa' ? 'btn-primary' : 'btn-secondary'}" onclick="EstudiantesView.setFiltro('${est.id}', 'negativa')">Negativas</button>
               </div>
            </div>

            <div class="card-body" style="padding-top: 0;">
              ${(() => {
                let filtradas = eventos;
                if (this._filtroActual !== 'todas') {
                  if (this._filtroActual === 'positiva') {
                    filtradas = eventos.filter(e => e.tipo === 'positiva' || e.tipo === 'felicitacion');
                  } else if (this._filtroActual === 'negativa') {
                    filtradas = eventos.filter(e => e.tipo === 'negativa' || e.tipo === 'falta' || e.categoriaFalta);
                  } else {
                    filtradas = eventos.filter(e => e.tipo === this._filtroActual);
                  }
                }
                
                if (filtradas.length === 0) {
                   return '<div class="text-center py-4 text-muted">No hay eventos registrados en esta categoría.</div>';
                }
                
                filtradas.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
                
                const mostrarCantidad = this._mostrarTodas ? filtradas.length : 4;
                const visibles = filtradas.slice(0, mostrarCantidad);
                const quedan = filtradas.length - visibles.length;
                
                let h = '<div class="timeline flex-col gap-4">';
                h += visibles.map(e => {
                  const canEdit = Auth.currentRole === 'admin' || Auth.canEditOrDelete(e.autorId || e.autor_id);
                  let descClean = Storage.safeHtml(e.descripcion || '')
                    .replace(/^[\/\\?\s"':;\.-]+/g, '')
                    .replace(/\s*\([^)]*\)\s*:/g, ':')
                    .replace(/Protocolo\s*\d+\s*[\u2014\-]\s*/gi, '');

                  return `
                    <div class="timeline-item" style="padding-bottom: 0.75rem;">
                      <div class="timeline-marker" style="background: var(--primary);"></div>
                      <div class="timeline-content" style="padding: 0.65rem 0.85rem;">
                        <div class="flex justify-between items-center mb-1">
                          <span class="font-bold" style="text-transform: capitalize; font-size: 0.85rem;">${e.tipo}</span>
                          <div class="flex items-center gap-2">
                            <span class="text-xs text-muted" style="font-size: 0.72rem;">${new Date(e.fecha).toLocaleDateString()}</span>
                            ${canEdit ? `
                              <button class="btn btn-sm btn-secondary inline-flex items-center gap-1" onclick="EstudiantesView.editarAnotacion('${e.id}', '${est.id}')" style="padding: 0.15rem 0.4rem; font-size: 0.7rem;" title="Editar anotación">${Icons.get('pencil', 12)} Editar</button>
                            ` : ''}
                          </div>
                        </div>
                        <p class="mt-1" style="font-size: 0.825rem; margin: 0.25rem 0; line-height: 1.35; color: var(--text-primary);">${descClean}</p>
                        <div class="text-muted" style="font-size: 0.7rem; margin-top: 0.25rem;">Registrado por: ${e.registradoPor || e.responsable || 'Sistema'}</div>
                      </div>
                    </div>
                  `;
                }).join('');
                h += '</div>';
                
                if (quedan > 0) {
                   h += `<div class="mt-4 text-center">
                           <button class="btn btn-secondary btn-sm" onclick="EstudiantesView.toggleMostrarTodas('${est.id}')">Ver más (${quedan})</button>
                         </div>`;
                } else if (this._mostrarTodas && filtradas.length > 4) {
                   h += `<div class="mt-4 text-center">
                           <button class="btn btn-secondary btn-sm" onclick="EstudiantesView.toggleMostrarTodas('${est.id}')">Ocultar</button>
                         </div>`;
                }
                
                return h;
              })()}
            </div>
          </div>
        </div>
      </div>
    `;
    
    container.innerHTML = html;
    this.applyBitacoraText(container, est);
    
    // Renderizado síncrono del gráfico para evitar que el canvas se muestre vacío y parpadee al cargarse
    this.renderComportamientoChart(anotaciones, 'chart-comportamiento-container', est.id);
  },
  
  renderComportamientoChart(anotaciones, canvasId, estudianteId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;

    if (window.estudianteChartInstance) {
      window.estudianteChartInstance.destroy();
    }

    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const dataPositivas = new Array(12).fill(0);
    const dataNegativas = new Array(12).fill(0);
    const dataAtrasos = new Array(12).fill(0);
    const dataInasistencias = new Array(12).fill(0);

    anotaciones.forEach(a => {
      const d = new Date(a.fecha);
      if (isNaN(d.getTime())) return;
      const m = d.getMonth();
      if (a.tipo === 'positiva' || a.tipo === 'felicitacion') {
        dataPositivas[m]++;
      } else if (a.tipo === 'negativa' || a.tipo === 'falta' || a.categoriaFalta) {
        dataNegativas[m]++;
      }
    });

    if (estudianteId) {
      const targetId = String(estudianteId).trim();
      const atrasos = (Storage.cache.atrasos || []).filter(a => a && String(a.estudianteId || a.estudiante_id || '').trim() === targetId);
      atrasos.forEach(a => {
        let fStr = String(a.fecha || '').trim();
        if (fStr.includes('/')) {
          const p = fStr.split('/');
          if (p.length === 3) fStr = `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
        }
        const d = new Date(fStr);
        if (!isNaN(d.getTime())) dataAtrasos[d.getMonth()]++;
      });

      const inasistencias = (Storage.cache.inasistencias || []).filter(i => i && String(i.estudianteId || i.estudiante_id || '').trim() === targetId);
      inasistencias.forEach(i => {
        let fStr = String(i.fecha || '').trim();
        if (fStr.includes('/')) {
          const p = fStr.split('/');
          if (p.length === 3) fStr = `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
        }
        const d = new Date(fStr);
        if (!isNaN(d.getTime())) dataInasistencias[d.getMonth()]++;
      });
    }

    const ctx = canvas.getContext('2d');
    window.estudianteChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: meses,
        datasets: [
          {
            label: 'Positivas',
            data: dataPositivas,
            backgroundColor: 'rgba(5, 150, 105, 0.7)',
            borderColor: '#059669',
            borderWidth: 1
          },
          {
            label: 'Negativas',
            data: dataNegativas,
            backgroundColor: 'rgba(225, 29, 72, 0.7)',
            borderColor: '#E11D48',
            borderWidth: 1
          },
          {
            label: 'Atrasos',
            data: dataAtrasos,
            backgroundColor: 'rgba(245, 158, 11, 0.7)',
            borderColor: '#F59E0B',
            borderWidth: 1
          },
          {
            label: 'Inasistencias',
            data: dataInasistencias,
            backgroundColor: 'rgba(14, 165, 233, 0.7)',
            borderColor: '#0ea5e9',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 0
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0 }
          }
        },
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  },
  
  setFiltro(id, filtro) {
    this._filtroActual = filtro;
    try {
      localStorage.setItem(`estudiante_timeline_filtro_${id}`, filtro);
    } catch (e) {}
    this._mostrarTodas = false;
    this.renderDetalle(document.getElementById('app-content'), id, true);
  },
  
  renderFichaPIE(container, id) {
    App.setBreadcrumb('Cursos / PIE / Ficha');
    this.renderDetalle(container, id, false);
  },

  toggleMostrarTodas(id) {
    this._mostrarTodas = !this._mostrarTodas;
    this.renderDetalle(document.getElementById('app-content'), id, true);
  },
  
  toggleAtributo(id, atributo, estado) {
    if (!Auth.canWriteEstudiantes() && !Auth.canManageSeguimiento()) {
      App.showToast("No tienes permisos para esto", "danger");
      return;
    }
    
    const triggerAttributes = ['enSeguimiento', 'esComplejo', 'requiereApoyoPsicosocial', 'planUtpActivo'];
    
    if (estado && triggerAttributes.includes(atributo)) {
      let title = 'Iniciar Seguimiento';
      if (atributo === 'esComplejo') title = 'Iniciar Caso Complejo';
      if (atributo === 'requiereApoyoPsicosocial') title = 'Iniciar Apoyo Psicosocial';
      if (atributo === 'planUtpActivo') title = 'Iniciar Plan UTP';

      const hoy = new Date().toISOString().split('T')[0];
      const proximo = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // +3 días por defecto
      
      let motivoHtml = `
          <div class="form-group mb-3">
            <label class="form-label">Motivo del seguimiento *</label>
            <input type="text" id="inicio-seguimiento-motivo" class="form-control" placeholder="Ingrese la razón principal" required>
          </div>
      `;

      if (atributo === 'esComplejo') {
        let opcionesProtocolos = '';
        if (typeof DATA !== 'undefined' && DATA.protocolos_checklists) {
          for (let key in DATA.protocolos_checklists) {
            opcionesProtocolos += `<option value="${key}">${DATA.protocolos_checklists[key].titulo}</option>`;
          }
        }
        opcionesProtocolos += `<option value="otro">Otro Protocolo / Caso Especial</option>`;
        
        motivoHtml = `
          <div class="form-group mb-3">
            <label class="form-label">Seleccione el Protocolo a Aplicar *</label>
            <select id="inicio-seguimiento-motivo" class="form-control" onchange="if(this.value==='otro'){document.getElementById('otro-protocolo-container').style.display='block';document.getElementById('otro-protocolo-text').setAttribute('required','required');}else{document.getElementById('otro-protocolo-container').style.display='none';document.getElementById('otro-protocolo-text').removeAttribute('required');}" required>
              <option value="" disabled selected>Seleccione...</option>
              ${opcionesProtocolos}
            </select>
          </div>
          <div class="form-group mb-3" id="otro-protocolo-container" style="display: none;">
            <label class="form-label">Especifique el Protocolo o Caso *</label>
            <input type="text" id="otro-protocolo-text" class="form-control" placeholder="Escriba el nombre del protocolo o motivo personalizado">
          </div>
        `;
      }

      const html = `
        <form id="form-inicio-seguimiento" onsubmit="event.preventDefault(); EstudiantesView.confirmarToggleAtributo('${id}', '${atributo}', true)">
          ${motivoHtml}
          <div class="form-group mb-3">
            <label class="form-label">Fecha de próximo seguimiento *</label>
            <input type="date" id="inicio-seguimiento-fecha" class="form-control" value="${proximo}" required>
            <small class="text-muted">Aparecerá como alerta en el Dashboard.</small>
          </div>
        </form>
      `;
      
      const footer = `
        <button class="btn btn-secondary" onclick="App.closeModal(); EstudiantesView._isToggling = false; EstudiantesView.renderDetalle(document.getElementById('app-content'), '${id}', true)">Cancelar</button>
        <button class="btn btn-primary" onclick="if(document.getElementById('form-inicio-seguimiento').reportValidity()) EstudiantesView.confirmarToggleAtributo('${id}', '${atributo}', true)">Guardar e Iniciar</button>
      `;
      
      App.openModal(title, html, footer);
    } else if (!estado && triggerAttributes.includes(atributo)) {
      let title = 'Cerrar Seguimiento';
      if (atributo === 'esComplejo') title = 'Cerrar Caso Complejo';
      else if (atributo === 'requiereApoyoPsicosocial') title = 'Cerrar Apoyo Psicosocial';
      else if (atributo === 'planUtpActivo') title = 'Cerrar Plan UTP';
      else if (atributo === 'medidasPie') title = 'Cerrar Medidas PIE';

      const html = `
        <form id="form-cierre-seguimiento" onsubmit="event.preventDefault(); EstudiantesView.confirmarCierreSeguimiento('${id}', '${atributo}')">
          <div class="form-group mb-3">
            <label class="form-label">Motivo o Resumen de Cierre *</label>
            <textarea id="cierre-seguimiento-motivo" class="form-control" rows="3" placeholder="Ingrese las conclusiones o motivo por el cual se cierra el seguimiento..." required></textarea>
          </div>
        </form>
      `;

      const footer = `
        <button class="btn btn-secondary" onclick="App.closeModal(); EstudiantesView._isToggling = false; EstudiantesView.renderDetalle(document.getElementById('app-content'), '${id}', true)">Cancelar</button>
        <button class="btn btn-primary" onclick="if(document.getElementById('form-cierre-seguimiento').reportValidity()) EstudiantesView.confirmarCierreSeguimiento('${id}', '${atributo}')">Cerrar Seguimiento</button>
      `;

      App.openModal(title, html, footer);
    } else {
      this.confirmarToggleAtributo(id, atributo, estado, null, null);
    }
  },

  toggleCompromisoConductual(id, estado) {
    if (!Auth.canWriteEstudiantes() && !Auth.canManageSeguimiento()) {
      App.showToast("No tienes permisos para esto", "danger");
      return;
    }
    const est = Storage.getEstudianteById(id);
    if (!est) return;

    if (estado) {
      const hoyStr = new Date().toISOString().split('T')[0];
      const futuroStr = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // +14 días por defecto

      const html = `
        <form id="form-compromiso-conductual" onsubmit="event.preventDefault(); EstudiantesView.guardarCompromisoConductual('${id}')">
          <div class="form-group mb-3">
            <label class="form-label">Fecha de Inicio del Compromiso *</label>
            <input type="date" id="compromiso-fecha-inicio" class="form-control" value="${hoyStr}" required>
          </div>
          <div class="form-group mb-3">
            <label class="form-label">Fecha de Término del Compromiso *</label>
            <input type="date" id="compromiso-fecha-termino" class="form-control" value="${futuroStr}" required>
            <small class="text-muted">Durante este período el estudiante no debe registrar anotaciones negativas.</small>
          </div>
        </form>
      `;

      const footer = `
        <button class="btn btn-secondary" onclick="App.closeModal(); EstudiantesView.renderDetalle(document.getElementById('app-content'), '${id}', true)">Cancelar</button>
        <button class="btn btn-primary" onclick="if(document.getElementById('form-compromiso-conductual').reportValidity()) EstudiantesView.guardarCompromisoConductual('${id}')">Activar Compromiso</button>
      `;

      App.openModal('🤝 Activar Compromiso Conductual de Anotaciones', html, footer);
    } else {
      App.showConfirm('Desactivar Compromiso', '¿Está seguro de desactivar el compromiso conductual de este estudiante?', async () => {
        est.compromisoConductualActivo = false;
        est.compromisoFechaInicio = null;
        est.compromisoFechaTermino = null;
        est.compromisoEstado = null;
        await Storage.saveEstudiante(est);
        App.showToast('Compromiso conductual desactivado', 'info');
        this.renderDetalle(document.getElementById('app-content'), id, true);
      }, () => {
        this.renderDetalle(document.getElementById('app-content'), id, true);
      });
    }
  },

  async guardarCompromisoConductual(id) {
    const est = Storage.getEstudianteById(id);
    if (!est) return;

    const fechaInicio = document.getElementById('compromiso-fecha-inicio').value;
    const fechaTermino = document.getElementById('compromiso-fecha-termino').value;

    if (!fechaInicio || !fechaTermino) return;
    if (fechaTermino < fechaInicio) {
      App.showToast('La fecha de término no puede ser anterior a la fecha de inicio', 'warning');
      return;
    }

    App.closeModal();

    est.compromisoConductualActivo = true;
    est.compromisoFechaInicio = fechaInicio;
    est.compromisoFechaTermino = fechaTermino;
    est.compromisoEstado = 'vigente';
    est.compromisoCreadoAt = new Date().toISOString();

    // Registrar automáticamente en Bitácora el inicio del compromiso conductual
    if (!Array.isArray(est.bitacoraSeguimiento)) est.bitacoraSeguimiento = [];
    
    // Formatear fechas para la bitácora
    const fInicioFormated = new Date(`${fechaInicio}T12:00:00`).toLocaleDateString('es-CL');
    const fTerminoFormated = new Date(`${fechaTermino}T12:00:00`).toLocaleDateString('es-CL');
    const textoBitacora = `🔵 Inicio de Compromiso Conductual: Se establece periodo de compromiso de anotaciones desde el ${fInicioFormated} hasta el ${fTerminoFormated}.`;

    const yaExisteCompromisoBit = est.bitacoraSeguimiento.some(b => b && b.texto && b.texto.includes(`desde el ${fInicioFormated} hasta el ${fTerminoFormated}`));
    if (!yaExisteCompromisoBit) {
      est.bitacoraSeguimiento.unshift({
        id: 'bit_comp_' + Date.now(),
        fecha: new Date().toISOString(),
        texto: textoBitacora,
        registradoPor: (Auth && Auth.userProfile?.nombres) ? `${Auth.userProfile.nombres} ${Auth.userProfile.apellidos || ''}` : 'Sistema'
      });
    }

    await Storage.saveEstudiante(est);

    // Verificar inmediatamente si ya existen anotaciones negativas dentro del rango
    if (window.RICEEngine && typeof window.RICEEngine.evaluarCompromisoEstudiante === 'function') {
      window.RICEEngine.evaluarCompromisoEstudiante(id);
    }

    App.showToast('🤝 Compromiso conductual activado exitosamente', 'success');
    this.renderDetalle(document.getElementById('app-content'), id, true);
  },

  async confirmarCierreSeguimiento(id, atributo, motivoOpt) {
    this._isToggling = false;
    const est = Storage.getEstudianteById(id);
    if (!est) return;

    const motivoInput = document.getElementById('cierre-seguimiento-motivo');
    const motivo = motivoInput ? motivoInput.value.trim() : 'Seguimiento finalizado';
    if (!motivo) return;

    // Verificar si es un cierre anticipado (fecha de próximo seguimiento futura)
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const fechaProximo = est.fechaProximoSeguimiento || est.proximoSeguimiento;

    if (fechaProximo && fechaProximo > todayStr) {
      App.closeModal();
      App.showConfirm(
        'Confirmar Cierre Anticipado',
        'Atención: Estás cerrando este seguimiento antes de la fecha programada. ¿Deseas continuar?',
        async () => {
          await this.ejecutarCierreSeguimiento(est, atributo, motivo);
        },
        () => {
          this.renderDetalle(document.getElementById('app-content'), id, true);
        }
      );
      return;
    }

    App.closeModal();
    await this.ejecutarCierreSeguimiento(est, atributo, motivo);
  },

  async ejecutarCierreSeguimiento(est, atributo, motivo) {
    const id = est.id;
    est[atributo] = false;
    est.cierreRestaurativo = true;
    est.fechaProximoSeguimiento = null;
    est.proximoSeguimiento = null;
    await Storage.saveEstudiante(est);

    let icono = '🔵';
    let desc = 'Seguimiento Leve';
    if (atributo === 'esComplejo') {
      icono = '🔴';
      desc = 'Caso Complejo';
    } else if (atributo === 'requiereApoyoPsicosocial') {
      icono = '🟣';
      desc = 'Apoyo Psicosocial';
    } else if (atributo === 'planUtpActivo') {
      icono = '🔵';
      desc = 'Plan UTP';
    } else if (atributo === 'medidasPie') {
      icono = '🟢';
      desc = 'Medidas PIE';
    }

    const loggedUser = Auth.userProfile?.nombres ? `${Auth.userProfile.nombres} ${Auth.userProfile.apellidos || ''}` : (Auth.currentUser?.email || 'Sistema');
    const textoFin = `${icono} Fin de ${desc}: ${motivo}`;
    const nowIso = new Date().toISOString();
    const pairId = 'pair_fin_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

    const anotacionBitacora = {
      estudianteId: id,
      estudiante_id: id,
      pairId: pairId,
      tipo: 'observacion',
      descripcion: textoFin,
      registradoPor: loggedUser,
      fecha: nowIso
    };

    if (Storage.saveAnotacion) await Storage.saveAnotacion(anotacionBitacora);

    if (!est.bitacoraSeguimiento) est.bitacoraSeguimiento = [];
    est.bitacoraSeguimiento.push({
      id: 'seg_fin_' + Date.now(),
      pairId: pairId,
      fecha: nowIso,
      texto: textoFin,
      registradoPor: loggedUser
    });
    await Storage.saveEstudiante(est);

    const casos = Storage.getCasosByEstudiante ? Storage.getCasosByEstudiante(id) : [];
    for (const c of casos) {
      if (c.estado === 'abierto') {
        c.estado = 'cerrado';
        c.fechaCierre = nowIso;
        c.proximoSeguimiento = null;
        c.seguimiento = c.seguimiento || [];
        c.seguimiento.push({
          id: 'seg_fin_c_' + Date.now(),
          fecha: new Date().toISOString(),
          texto: textoFin,
          registradoPor: loggedUser
        });
        if (Storage.saveCaso) await Storage.saveCaso(c);
      }
    }

    if (atributo === 'esComplejo') {
      if (!Storage.cache.protocolos_activos) Storage.cache.protocolos_activos = [];
      const protosEst = Storage.cache.protocolos_activos.filter(p => String(p.estudiante_id || p.estudianteId) === String(id) && p.estado === 'en_proceso');
      if (protosEst.length > 0) {
        for (const p of protosEst) {
          p.estado = 'completado';
          p.fecha_cierre = nowIso;
          if (Storage.saveProtocoloActivo) await Storage.saveProtocoloActivo(p);
        }
      } else {
        const protoCompletado = {
          id: 'PROT_COMP_' + Date.now(),
          estudiante_id: id,
          tipo_protocolo: est.motivoComplejo || 'Caso Complejo',
          creado_por: loggedUser,
          fecha_creacion: nowIso,
          fecha_cierre: nowIso,
          estado: 'completado',
          checklist: {}
        };
        if (Storage.saveProtocoloActivo) await Storage.saveProtocoloActivo(protoCompletado);
      }
    }

    if (window.RICEEngine && typeof window.RICEEngine.evaluarEstudiante === 'function') {
      window.RICEEngine.evaluarEstudiante(id);
    }

    App.showToast(`Cierre de ${desc} registrado correctamente. Alerta removida del Dashboard.`, 'success');
    this.renderDetalle(document.getElementById('app-content'), id, true);
  },

  async confirmarToggleAtributo(id, atributo, estado, motivoOpt, fechaOpt) {
    this._isToggling = false;
    const est = Storage.getEstudianteById(id);
    if (!est) return;
    
    let motivo = motivoOpt;
    let fechaProximo = fechaOpt;

    const triggerAttributes = ['enSeguimiento', 'esComplejo', 'requiereApoyoPsicosocial', 'planUtpActivo'];

    if (estado && triggerAttributes.includes(atributo)) {
      const motivoInput = document.getElementById('inicio-seguimiento-motivo');
      const fechaInput = document.getElementById('inicio-seguimiento-fecha');
      
      if (motivoInput) {
        motivo = motivoInput.value.trim();
        if (motivo === 'otro') {
          const otroInput = document.getElementById('otro-protocolo-text');
          if (otroInput && otroInput.value.trim()) {
            motivo = otroInput.value.trim();
          } else {
            motivo = 'Otro Protocolo / Caso Especial';
          }
        }
      }
      if (fechaInput) fechaProximo = fechaInput.value;
      
      if (!motivo) {
        if (atributo === 'planUtpActivo') motivo = 'Activación de Plan UTP';
        else if (atributo === 'requiereApoyoPsicosocial') motivo = 'Solicitud de Apoyo Psicosocial';
        else if (atributo === 'enSeguimiento') motivo = 'Inicio de Seguimiento Leve';
        else if (atributo === 'esComplejo') motivo = 'Caso Complejo Activado';
      }
      App.closeModal();
    }

    est[atributo] = estado;
    try {
      if (estado && triggerAttributes.includes(atributo)) {
        let tipo = 'seguimiento';
        let icono = '🔵';
        let desc = 'Seguimiento Leve (Azul)';
        let protoTitulo = motivo;
        
        if (atributo === 'esComplejo') {
          tipo = 'complejo';
          icono = '🔴';
          if (typeof DATA !== 'undefined' && DATA.protocolos_checklists && DATA.protocolos_checklists[motivo]) {
            protoTitulo = DATA.protocolos_checklists[motivo].titulo;
          }
          if (protoTitulo) {
            protoTitulo = protoTitulo.replace(/^Protocolo\s*\d+\s*[\u2014\-]\s*/i, '').trim();
          }
          desc = 'Caso Complejo';
        }
        else if (atributo === 'requiereApoyoPsicosocial') { tipo = 'apoyo_psicosocial'; icono = '🟣'; desc = 'Apoyo Psicosocial'; }
        else if (atributo === 'planUtpActivo') { tipo = 'plan_utp'; icono = '🔵'; desc = 'Plan UTP Activo'; }
        else if (atributo === 'enSeguimiento') { tipo = 'seguimiento'; icono = '🔵'; desc = 'Seguimiento Leve'; }

        const loggedUser = Auth.userProfile?.nombres ? `${Auth.userProfile.nombres} ${Auth.userProfile.apellidos || ''}` : (Auth.currentUser?.email || 'Sistema');
        
        let textoBitacora = `${icono} Inicio de ${desc}: ${motivo || protoTitulo}`;

        const nowIso = new Date().toISOString();
        const pairId = 'pair_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

        if (!est.bitacoraSeguimiento) est.bitacoraSeguimiento = [];
        est.bitacoraSeguimiento.unshift({
          id: 'seg_' + Date.now(),
          pairId: pairId,
          fecha: nowIso,
          fechaProximoSeguimiento: fechaProximo || null,
          fechaProximo: fechaProximo || null,
          texto: textoBitacora,
          registradoPor: loggedUser
        });
        if (fechaProximo) {
          est.fechaProximoSeguimiento = fechaProximo;
        }

        await Storage.saveEstudiante(est);

        if (atributo === 'esComplejo') {
          const nuevoProtocolo = {
            id: 'PROT-' + Date.now(),
            estudiante_id: id,
            tipo_protocolo: motivo, 
            creado_por: loggedUser,
            fecha_creacion: nowIso,
            fecha_proximo: fechaProximo || null,
            estado: 'en_proceso',
            checklist: {}
          };
          
          if (!Storage.cache.protocolos_activos) Storage.cache.protocolos_activos = [];
          Storage.cache.protocolos_activos.push(nuevoProtocolo);
          if (Storage.saveProtocoloActivo) {
            Storage.saveProtocoloActivo(nuevoProtocolo);
          }
        }

        const cursoObj = (typeof DATA !== 'undefined' && typeof DATA.getCurso === 'function') ? DATA.getCurso(est.curso) : null;
        const cursoNombreEst = cursoObj ? cursoObj.nombre : (est.curso || 'Sin curso');
        const estNombreCompleto = `${est.nombres} ${est.apellidos}`;

        const casosExistentes = Storage.getCasosByEstudiante ? Storage.getCasosByEstudiante(id) : [];
        const casoAbiertoExistente = casosExistentes.find(c => c.tipo === tipo && c.estado === 'abierto');

        if (!casoAbiertoExistente) {
          const nuevoCaso = {
            titulo: protoTitulo,
            tipo: tipo,
            descripcion: desc,
            estado: 'abierto',
            creado_por_id: Auth.currentUser?.id || Auth.currentUser?.uid || '00000000-0000-0000-0000-000000000000',
            estudiantesInvolucrados: [id],
            estudiante_id: id,
            estudianteId: id,
            estudianteNombre: estNombreCompleto,
            curso: cursoNombreEst,
            fecha: nowIso,
            proximoSeguimiento: fechaProximo || null,
            fechaProximoSeguimiento: fechaProximo || null,
            seguimiento: [{
              id: pairId,
              fecha: nowIso,
              fechaProximoSeguimiento: fechaProximo || null,
              fechaProximo: fechaProximo || null,
              texto: textoBitacora,
              registradoPor: loggedUser
            }]
          };
          if (Storage.saveCaso) await Storage.saveCaso(nuevoCaso);
        } else {
          // Si ya existe un caso abierto de este tipo, agregamos el hito de seguimiento en lugar de duplicar el caso completo
          casoAbiertoExistente.proximoSeguimiento = fechaProximo || null;
          casoAbiertoExistente.fechaProximoSeguimiento = fechaProximo || null;
          casoAbiertoExistente.seguimiento = casoAbiertoExistente.seguimiento || [];
          casoAbiertoExistente.seguimiento.push({
            id: pairId,
            fecha: nowIso,
            fechaProximoSeguimiento: fechaProximo || null,
            fechaProximo: fechaProximo || null,
            texto: textoBitacora,
            registradoPor: loggedUser
          });
          if (Storage.saveCaso) await Storage.saveCaso(casoAbiertoExistente);
        }

        const anotacionBitacora = {
          estudianteId: id,
          estudiante_id: id,
          pairId: pairId,
          tipo: 'observacion',
          descripcion: textoBitacora,
          registradoPor: loggedUser,
          fecha: nowIso
        };
        
        if (Storage.saveAnotacion) {
           await Storage.saveAnotacion(anotacionBitacora);
        }

        App.showToast(atributo === 'esComplejo' ? 'Caso Complejo y Protocolo iniciado.' : 'Seguimiento iniciado.', 'success');
        this.renderDetalle(document.getElementById('app-content'), id, true);
      } else {
        await Storage.saveEstudiante(est);
        this.renderDetalle(document.getElementById('app-content'), id, true);
      }
    } catch (e) {
      console.error(e);
      App.showToast('Error actualizando estado', 'danger');
    }
  },



  nuevaBitacoraSeguimiento(estudianteId) {
    const est = Storage.getEstudianteById(estudianteId);
    const casos = Storage.getCasosByEstudiante ? Storage.getCasosByEstudiante(estudianteId) : [];
    const activos = casos.filter(c => c.estado !== 'cerrado' && ['seguimiento', 'complejo', 'apoyo_psicosocial', 'plan_utp', 'medidas_pie'].includes(c.tipo));
    
    let opciones = '';
    if (est) {
      if (est.enSeguimiento) opciones += '<option value="general_seguimiento">Estudiante en Seguimiento (General)</option>';
      if (est.esComplejo) opciones += '<option value="general_complejo">Estudiante Complejo (Protocolos)</option>';
      if (est.requiereApoyoPsicosocial) opciones += '<option value="general_psicosocial">Apoyo Psicosocial</option>';
      if (est.planUtpActivo) opciones += '<option value="general_utp">Plan UTP</option>';
      if (est.compromisoConductualActivo) opciones += '<option value="general_compromiso">Compromiso de Anotaciones</option>';
      if (est.esEstudiantePIE) opciones += '<option value="general_pie">Estudiante PIE</option>';
    }
    
    if (!opciones) {
      opciones = '<option value="general">Bitácora General (Otro motivo, sin caso)</option>';
    }

    if (activos.length > 0) {
      opciones += activos.map(c => {
         let tipoText = 'Situación Leve';
         if (c.tipo === 'complejo') tipoText = 'Caso Complejo';
         if (c.tipo === 'apoyo_psicosocial') tipoText = 'Apoyo Psicosocial';
         if (c.tipo === 'plan_utp') tipoText = 'Plan UTP';
         if (c.tipo === 'medidas_pie') tipoText = 'Medidas PIE';
         
         return `<option value="${c.id}">${tipoText}: ${c.titulo}</option>`;
      }).join('');
    }

    const hoy = new Date().toISOString().split('T')[0];
    const html = `
      <form id="form-nueva-bitacora" onsubmit="event.preventDefault(); EstudiantesView.guardarNuevaBitacoraSeguimiento('${estudianteId}')">
        <div class="form-group mb-3">
          <label class="form-label">Seleccionar Destino *</label>
          <select id="nueva-bitacora-caso-id" class="form-control" required>
            ${opciones}
          </select>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Tipo de Registro *</label>
          <select id="nueva-bitacora-tipo" class="form-control" required>
            <option value="general">Seguimiento General</option>
            <option value="entrevista_observador">Entrevista (Como Observador)</option>
          </select>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Fecha del registro *</label>
          <input type="date" id="nueva-bitacora-fecha" class="form-control" value="${hoy}" required>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Detalle del registro *</label>
          <textarea id="nueva-bitacora-texto" class="form-control" rows="4" placeholder="Ingrese el detalle..." required></textarea>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Fecha de Próximo Seguimiento (Opcional)</label>
          <input type="date" id="nueva-bitacora-proximo" class="form-control">
          <small class="text-muted">Establece la fecha para la próxima revisión/alerta de seguimiento.</small>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Archivo adjunto</label>
          <input type="file" id="nueva-bitacora-archivo" class="form-control" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg">
        </div>
      </form>
    `;
    
    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="if(document.getElementById('form-nueva-bitacora').reportValidity()) EstudiantesView.guardarNuevaBitacoraSeguimiento('${estudianteId}')">Guardar</button>
    `;
    
    App.openModal('Agregar Registro de Bitácora', html, footer);
  },

  async guardarNuevaBitacoraSeguimiento(estId) {
    try {
      const casoId = document.getElementById('nueva-bitacora-caso-id').value;
      const tipoVal = document.getElementById('nueva-bitacora-tipo').value;
      const fechaVal = document.getElementById('nueva-bitacora-fecha').value;
      const fechaProximoVal = document.getElementById('nueva-bitacora-proximo')?.value || null;
      const textoBase = document.getElementById('nueva-bitacora-texto').value.trim();
      const fileInput = document.getElementById('nueva-bitacora-archivo');
      
      if (!fechaVal || !textoBase || !casoId) return;

      let fecha = new Date();
      if (fechaVal) {
        const parts = fechaVal.split('-');
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            // YYYY-MM-DD
            fecha = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), new Date().getHours(), new Date().getMinutes());
          } else if (parts[2].length === 4) {
            // DD-MM-YYYY
            fecha = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]), new Date().getHours(), new Date().getMinutes());
          }
        }
      }

      const loggedUser = Auth.userProfile?.nombres ? `${Auth.userProfile.nombres} ${Auth.userProfile.apellidos || ''}` : (Auth.currentUser?.email || 'Sistema');
      
      let finalTexto = textoBase;
      if (tipoVal === 'entrevista_observador') {
        finalTexto = `Entrevista (Observador): ${textoBase}`;
      }
      
      // Prepend tag based on selection
      if (casoId === 'general_complejo') {
        finalTexto = `🔴 [Caso Complejo] ${finalTexto}`;
      } else if (casoId === 'general_psicosocial') {
        finalTexto = `🧠 [Apoyo Psicosocial] ${finalTexto}`;
      } else if (casoId === 'general_utp') {
        finalTexto = `📚 [Plan UTP] ${finalTexto}`;
      } else if (casoId === 'general_compromiso') {
        finalTexto = `⏳ [Compromiso Conductual] ${finalTexto}`;
      } else if (casoId === 'general_pie') {
        finalTexto = `🧩 [Estudiante PIE] ${finalTexto}`;
      } else if (casoId === 'general_seguimiento' || casoId === 'general') {
        finalTexto = `💼 [Seguimiento General] ${finalTexto}`;
      }
      
      let fileUrl = null;
      if (fileInput && fileInput.files.length > 0) {
        fileUrl = await this.subirArchivoMock(fileInput.files[0]);
      }

      const entry = {
        id: Date.now().toString(),
        fecha: fecha.toISOString(),
        fechaProximoSeguimiento: fechaProximoVal,
        texto: finalTexto,
        registradoPor: loggedUser,
        adjunto: fileUrl
      };

      const est = Storage.getEstudianteById(estId);
      if (est && fechaProximoVal) {
        est.fechaProximoSeguimiento = fechaProximoVal;
      }
      if (est && casoId) {
        if (casoId === 'general_seguimiento' || casoId === 'general') {
          est.enSeguimiento = true;
        } else if (casoId === 'general_complejo') {
          est.esComplejo = true;
        } else if (casoId === 'general_psicosocial') {
          est.requiereApoyoPsicosocial = true;
        } else if (casoId === 'general_utp') {
          est.planUtpActivo = true;
        } else if (casoId === 'general_pie') {
          est.medidasPie = true;
          est.esEstudiantePIE = true;
        } else if (!casoId.startsWith('general')) {
          const caso = Storage.getCasoById ? Storage.getCasoById(casoId) : null;
          if (caso) {
            const tipo = caso.tipo || 'seguimiento';
            if (tipo === 'seguimiento') est.enSeguimiento = true;
            else if (tipo === 'complejo') est.esComplejo = true;
            else if (tipo === 'apoyo_psicosocial') est.requiereApoyoPsicosocial = true;
            else if (tipo === 'plan_utp') est.planUtpActivo = true;
            else if (tipo === 'medidas_pie' || tipo === 'pie') {
              est.medidasPie = true;
              est.esEstudiantePIE = true;
            }
          }
        }
      }

      if (casoId.startsWith('general')) {
        // Guardar en bitacora general del estudiante
        if (!est) return;
        if (!est.bitacoraSeguimiento) est.bitacoraSeguimiento = [];
        est.bitacoraSeguimiento.unshift(entry);
        
        await Storage.saveEstudiante(est, true);
        try{ if(typeof DashboardView!=='undefined' && DashboardView.limpiarVistoParaNuevoSeguimiento) DashboardView.limpiarVistoParaNuevoSeguimiento(null, estId); }catch(_e){}
      } else {
        // Guardar en seguimiento de caso
        const caso = Storage.getCasoById ? Storage.getCasoById(casoId) : null;
        if (!caso) return;
        
        if (!caso.seguimiento) caso.seguimiento = [];
        caso.seguimiento.unshift(entry);
        if (fechaProximoVal) caso.proximoSeguimiento = fechaProximoVal;
        
        await Storage.saveCaso(caso);
        if (est) await Storage.saveEstudiante(est, true);
        try{ if(typeof DashboardView!=='undefined' && DashboardView.limpiarVistoParaNuevoSeguimiento) DashboardView.limpiarVistoParaNuevoSeguimiento(caso ? caso.id : casoId, estId); }catch(_e){}
      }
      
      App.closeModal();
      this.renderDetalle(document.getElementById('app-content'), estId, true);
      App.showToast('Registro añadido a la bitácora', 'success');
    } catch (error) {
      console.error('Error al guardar bitácora:', error);
      App.showToast('Error al guardar el registro', 'danger');
    }
  },

  agregarBitacoraSeguimiento(id) {
    const input = document.getElementById(`nueva-bitacora-seg-${id}`);
    const dateInput = document.getElementById(`fecha-bitacora-seg-${id}`);
    const texto = input.value.trim();
    if (!texto) return;
    
    let fecha = new Date();
    if (dateInput && dateInput.value) {
      const parts = dateInput.value.split('-');
      fecha = new Date(parts[0], parts[1] - 1, parts[2], new Date().getHours(), new Date().getMinutes());
    }
    
    const est = Storage.getEstudianteById(id);
    if (est) {
      if (!est.bitacoraSeguimiento) est.bitacoraSeguimiento = [];
      const loggedUser = Auth.userProfile?.nombres 
        ? `${Auth.userProfile.nombres} ${Auth.userProfile.apellidos || ''}` 
        : (Auth.currentUser?.email || 'Sistema');

      est.bitacoraSeguimiento.push({ 
        id: Date.now().toString(), 
        fecha: fecha.toISOString(), 
        texto: texto,
        trackingId: est.currentTrackingId || '',
        registradoPor: loggedUser
      });
      
      est.bitacoraSeguimiento.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
      
      Storage.saveEstudiante(est);
      this.renderDetalle(document.getElementById('app-content'), id, true);
    }
  },

  eliminarBitacoraSeguimiento(estId, bitacoraId) {
    App.showConfirm('Confirmar', '¿Está seguro de eliminar este registro de la bitácora?', () => {
      const est = Storage.getEstudianteById(estId);
      if (est && est.bitacoraSeguimiento) {
        est.bitacoraSeguimiento = est.bitacoraSeguimiento.filter(b => (b.id || b.fecha) !== bitacoraId);
        Storage.saveEstudiante(est);
        this.renderDetalle(document.getElementById('app-content'), estId, true);
      }
    });
  },

  subirAdjuntoBitacora(estId, bitacoraId) {
    const est = Storage.getEstudianteById(estId);
    if (!est) return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.png,.jpg,.jpeg';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const bitacoraIndex = est.bitacoraSeguimiento.findIndex(b => (b.id || b.fecha) === bitacoraId);
        if (bitacoraIndex !== -1) {
          est.bitacoraSeguimiento[bitacoraIndex].adjunto = file.name;
          Storage.saveEstudiante(est);
          this.renderDetalle(document.getElementById('app-content'), estId, true);
          App.showToast('Documento adjuntado con éxito.', 'success');
        }
      }
    };
    input.click();
  },

  editarBitacoraSeguimiento(estId, bitacoraId, casoId) {
    const est = Storage.getEstudianteById(estId);
    if (!est) return;
    
    let bitacora = null;
    let caso = null;
    
    if (casoId) {
      caso = Storage.getCasoById(casoId);
      if (caso && caso.seguimiento) {
        bitacora = caso.seguimiento.find((s, idx) => (s.id || `caso_seg_${caso.id}_${idx}`) === bitacoraId || (s.id || s.fecha) === bitacoraId);
      }
    }
    
    if (!bitacora && est.bitacoraSeguimiento) {
      bitacora = est.bitacoraSeguimiento.find(b => (b.id || b.fecha) === bitacoraId);
    }
    
    if (!bitacora) {
      // Fallback: buscar a través de todos los casos del estudiante si no se paso casoId pero id empieza con caso_seg_
      if (bitacoraId && String(bitacoraId).startsWith('caso_seg_')) {
        const casos = Storage.getCasosByEstudiante ? Storage.getCasosByEstudiante(estId) : [];
        for (const c of casos) {
          if (c && c.seguimiento) {
            const found = c.seguimiento.find((s, idx) => (s.id || `caso_seg_${c.id}_${idx}`) === bitacoraId || (s.id || s.fecha) === bitacoraId);
            if (found) {
              bitacora = found;
              caso = c;
              casoId = c.id;
              break;
            }
          }
        }
      }
    }
    
    if (!bitacora) return;

    const fechaDate = new Date(bitacora.fecha || Date.now());
    const fechaStr = isNaN(fechaDate.getTime()) ? new Date().toISOString().split('T')[0] : fechaDate.toISOString().split('T')[0];
    const fechaProximoStr = bitacora.fechaProximoSeguimiento || bitacora.fechaProximo || '';
    
    const html = `
      <form id="form-editar-bitacora" onsubmit="event.preventDefault(); EstudiantesView.guardarEdicionBitacora('${estId}', '${bitacoraId}', '${casoId || ''}')">
        <div class="form-group mb-3">
          <label class="form-label">Fecha del registro</label>
          <input type="date" id="edit-bitacora-fecha" class="form-control" value="${fechaStr}" required>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Fecha de Próximo Seguimiento (Opcional)</label>
          <input type="date" id="edit-bitacora-proximo" class="form-control" value="${fechaProximoStr}">
          <small class="text-muted">Establece la fecha para la próxima revisión/alerta de seguimiento.</small>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Detalle del registro</label>
          <textarea id="edit-bitacora-texto" class="form-control" rows="4" required>${bitacora.texto.replace(/<br>/g, '\n')}</textarea>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Archivo adjunto</label>
          <div id="edit-bitacora-archivo-container" style="display: flex; align-items: center; gap: 8px; padding: 0.5rem; background: var(--bg-light, #f8fafc); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
            <div id="edit-bitacora-archivo-nombre" style="flex: 1; font-size: 0.85rem; color: ${bitacora.adjunto ? 'var(--text-primary)' : 'var(--text-secondary)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${bitacora.adjunto ? `<strong>${bitacora.adjunto}</strong>` : 'No hay archivo seleccionado'}
            </div>
            ${!bitacora.isCasoEvent ? `
            <button type="button" class="btn btn-sm btn-secondary" onclick="document.getElementById('edit-bitacora-archivo').click()" title="Reemplazar/Subir archivo">📂 Reemplazar</button>
            <button type="button" id="edit-bitacora-btn-eliminar" class="btn btn-sm text-danger" style="display: ${bitacora.adjunto ? 'inline-block' : 'none'}; padding: 0.2rem 0.5rem; background: #fee2e2; border: 1px solid #fca5a5;" onclick="EstudiantesView.eliminarArchivoModalBitacora()" title="Eliminar archivo">🗑️</button>
            ` : ''}
          </div>
          <input type="file" id="edit-bitacora-archivo" class="form-control" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" style="display: none;" onchange="EstudiantesView.cambiarArchivoModalBitacora(this)">
          <input type="hidden" id="edit-bitacora-archivo-eliminado" value="false">
        </div>
      </form>
    `;
    
    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="document.getElementById('form-editar-bitacora').requestSubmit()">Guardar Cambios</button>
    `;
    
    App.openModal('Editar Registro de Bitácora', html, footer);
  },
  
  eliminarArchivoModalBitacora() {
    App.showConfirm('Confirmar', '¿Estás seguro de que deseas eliminar este archivo?', () => {
      document.getElementById('edit-bitacora-archivo').value = '';
      document.getElementById('edit-bitacora-archivo-eliminado').value = 'true';
      const nombreDiv = document.getElementById('edit-bitacora-archivo-nombre');
      nombreDiv.innerHTML = 'No hay archivo seleccionado';
      nombreDiv.style.color = 'var(--text-secondary)';
      document.getElementById('edit-bitacora-btn-eliminar').style.display = 'none';
    });
  },
  
  cambiarArchivoModalBitacora(input) {
    if (input.files && input.files.length > 0) {
      document.getElementById('edit-bitacora-archivo-removed')?.value === 'false'; // keep aligned
      const nombreDiv = document.getElementById('edit-bitacora-archivo-nombre');
      nombreDiv.innerHTML = `<strong>${typeof S === 'function' ? S(input.files[0].name) : String(input.files[0].name).replace(/[<>&"']/g, c=>({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#039;' }[c]))}</strong>`;
      nombreDiv.style.color = 'var(--text-primary)';
      document.getElementById('edit-bitacora-btn-eliminar').style.display = 'inline-block';
    }
  },

  async guardarEdicionBitacora(estId, bitacoraId, casoId) {
    const nuevaFecha = document.getElementById('edit-bitacora-fecha').value;
    const nuevaFechaProximo = document.getElementById('edit-bitacora-proximo')?.value || null;
    const nuevoTexto = document.getElementById('edit-bitacora-texto').value.trim();
    const fileInput = document.getElementById('edit-bitacora-archivo');
    const eliminado = document.getElementById('edit-bitacora-archivo-eliminado').value === 'true';
    
    if (!nuevaFecha || !nuevoTexto) return;
    
    const est = Storage.getEstudianteById(estId);
    if (!est) return;
    
    let caso = null;
    let bitacoraIndex = -1;
    
    if (casoId) {
      caso = Storage.getCasoById(casoId);
    }
    
    if (!caso && bitacoraId && String(bitacoraId).startsWith('caso_seg_')) {
      const casos = Storage.getCasosByEstudiante ? Storage.getCasosByEstudiante(estId) : [];
      for (const c of casos) {
        if (c && c.seguimiento) {
          const idx = c.seguimiento.findIndex((s, i) => (s.id || `caso_seg_${c.id}_${i}`) === bitacoraId || (s.id || s.fecha) === bitacoraId);
          if (idx !== -1) {
            caso = c;
            bitacoraIndex = idx;
            casoId = c.id;
            break;
          }
        }
      }
    }
    
    if (caso) {
      if (bitacoraIndex === -1 && caso.seguimiento) {
        bitacoraIndex = caso.seguimiento.findIndex((s, i) => (s.id || `caso_seg_${caso.id}_${i}`) === bitacoraId || (s.id || s.fecha) === bitacoraId);
      }
      
      if (bitacoraIndex !== -1) {
        const fechaOriginal = new Date(caso.seguimiento[bitacoraIndex].fecha || Date.now());
        const partesFecha = nuevaFecha.split('-');
        const fechaActualizada = isNaN(fechaOriginal.getTime()) ? new Date() : new Date(
          parseInt(partesFecha[0]), 
          parseInt(partesFecha[1]) - 1, 
          parseInt(partesFecha[2]),
          fechaOriginal.getHours(),
          fechaOriginal.getMinutes()
        );
        
        caso.seguimiento[bitacoraIndex].fecha = fechaActualizada.toISOString();
        caso.seguimiento[bitacoraIndex].fechaProximoSeguimiento = nuevaFechaProximo;
        caso.seguimiento[bitacoraIndex].fechaProximo = nuevaFechaProximo;
        caso.seguimiento[bitacoraIndex].texto = nuevoTexto;
        
        if (nuevaFechaProximo) {
          caso.proximoSeguimiento = nuevaFechaProximo;
          caso.fechaProximoSeguimiento = nuevaFechaProximo;
        }
        
        if (eliminado) {
          delete caso.seguimiento[bitacoraIndex].adjunto;
        } else if (fileInput && fileInput.files.length > 0) {
          caso.seguimiento[bitacoraIndex].adjunto = fileInput.files[0].name;
        }
        
        if (nuevaFechaProximo) {
          est.fechaProximoSeguimiento = nuevaFechaProximo;
          est.proximoSeguimiento = nuevaFechaProximo;
        }
        
        if (est.bitacoraSeguimiento) {
          const dupIdx = est.bitacoraSeguimiento.findIndex(b => b.texto === nuevoTexto || Math.abs(new Date(b.fecha) - fechaOriginal) < 60000);
          if (dupIdx !== -1) {
            est.bitacoraSeguimiento[dupIdx].fecha = fechaActualizada.toISOString();
            est.bitacoraSeguimiento[dupIdx].fechaProximoSeguimiento = nuevaFechaProximo;
            est.bitacoraSeguimiento[dupIdx].texto = nuevoTexto;
            if (eliminado) {
              delete est.bitacoraSeguimiento[dupIdx].adjunto;
            } else if (fileInput && fileInput.files.length > 0) {
              est.bitacoraSeguimiento[dupIdx].adjunto = fileInput.files[0].name;
            }
          }
        }
        
        await Storage.saveEstudiante(est);
        await Storage.saveCaso(caso);
        
        App.closeModal();
        App.showToast('Seguimiento del caso y próximo seguimiento actualizados', 'success');
        this.renderDetalle(document.getElementById('app-content'), estId, true);
        return;
      }
    }
    
    if (est.bitacoraSeguimiento) {
      const idx = est.bitacoraSeguimiento.findIndex(b => (b.id || b.fecha) === bitacoraId);
      if (idx !== -1) {
        const fechaOriginal = new Date(est.bitacoraSeguimiento[idx].fecha || Date.now());
        const partesFecha = nuevaFecha.split('-');
        const fechaActualizada = isNaN(fechaOriginal.getTime()) ? new Date() : new Date(
          parseInt(partesFecha[0]), 
          parseInt(partesFecha[1]) - 1, 
          parseInt(partesFecha[2]),
          fechaOriginal.getHours(),
          fechaOriginal.getMinutes()
        );
        
        est.bitacoraSeguimiento[idx].fecha = fechaActualizada.toISOString();
        est.bitacoraSeguimiento[idx].fechaProximoSeguimiento = nuevaFechaProximo;
        est.bitacoraSeguimiento[idx].texto = nuevoTexto;
        
        if (nuevaFechaProximo) {
          est.fechaProximoSeguimiento = nuevaFechaProximo;
          est.proximoSeguimiento = nuevaFechaProximo;
        }
        
        if (eliminado) {
          delete est.bitacoraSeguimiento[idx].adjunto;
        } else if (fileInput && fileInput.files.length > 0) {
          est.bitacoraSeguimiento[idx].adjunto = fileInput.files[0].name;
        }
        
        est.bitacoraSeguimiento.sort((a,b) => new Date(a.fecha) - new Date(b.fecha));
        
        await Storage.saveEstudiante(est);
        App.closeModal();
        App.showToast('Registro de Bitácora y próximo seguimiento actualizados', 'success');
        this.renderDetalle(document.getElementById('app-content'), estId, true);
      }
    }
  },

  togglePasoSeguimiento(id, pasoIndex, estado) {
    const est = Storage.getEstudianteById(id);
    if(est) {
      if (!est.pasosSeguimiento) est.pasosSeguimiento = [false, false, false, false, false];
      if (!est.fechasPasos) est.fechasPasos = [];
      
      est.pasosSeguimiento[pasoIndex] = estado;
      if (estado) {
        est.fechasPasos[pasoIndex] = new Date().toISOString();
      } else {
        est.fechasPasos[pasoIndex] = null; // Borrar fecha si se desmarca
      }
      
      if (est.pasosSeguimiento.every(p => p === true)) {
        est.enSeguimiento = false;
        if (!est.bitacoraSeguimiento) est.bitacoraSeguimiento = [];
        est.bitacoraSeguimiento.push({
          id: Date.now().toString(),
          fecha: new Date().toISOString(),
          texto: `✅ Seguimiento Completado - Razón inicial: ${est.razonSeguimiento || 'No especificada'}`
        });
      }
      
      Storage.saveEstudiante(est);
      this.renderDetalle(document.getElementById('app-content'), id, true);
    }
  },
  
  copiarAnalisis() {
    const panel = document.getElementById('protocolos-content-panel');
    if (panel) {
      const text = panel.innerText;
      if (text.includes('Sin protocolos activos') || text.trim() === '') {
        App.showToast('No hay ningún análisis generado para copiar.', 'warning');
        return;
      }
      navigator.clipboard.writeText(text).then(() => {
        App.showToast('📝 Análisis copiado al portapapeles', 'success');
      }).catch(err => {

        App.showToast('No se pudo copiar el texto.', 'danger');
      });
    }
  },
  
  renderAnotacionItem(anotacion, estudianteId) {
    let tipo = DATA.getTipoAnotacion(anotacion.tipo);
    let falta = anotacion.categoriaFalta ? DATA.getTipoFalta(anotacion.categoriaFalta) : null;
    const funcionario = Storage.getFuncionarioById(anotacion.funcionarioId);
    const nombreFuncionario = funcionario ? `${funcionario.nombres} ${funcionario.apellidos}` : (anotacion.funcionarioNombre || 'Sistema');

    const isTrackingEvent = anotacion.descripcion && (anotacion.descripcion.includes('Inicio de') || anotacion.descripcion.includes('Fin de') || anotacion.tipo === 'observacion');
    if (isTrackingEvent) {
      tipo = { icono: '📋', nombre: 'Observación', bgColor: '#f1f5f9', color: '#475569' };
      falta = null;
    }
    
    let badgetHtml = `<span class="badge" style="background: ${tipo.bgColor}; color: ${tipo.color};">${tipo.icono} ${tipo.nombre}</span>`;
    if (falta) {
      badgetHtml += ` <span class="badge" style="background: ${falta.bgColor}; color: ${falta.color}; margin-left: 0.5rem;">Falta ${falta.nombre}</span>`;
    }
    
    const displayUser = anotacion.registradoPor || nombreFuncionario;
    const canEdit = Auth.currentRole === 'admin' || Auth.canEditOrDelete(anotacion.autorId);

    return `
      <div class="anotacion-item mb-3" style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem; border-left: 4px solid ${falta ? falta.color : tipo.color};">
        <div class="flex justify-between items-start mb-2">
          <div>${badgetHtml}</div>
          <div class="flex items-center gap-2">
            <span class="text-muted" style="font-size: 0.75rem;">${new Date(anotacion.fecha).toLocaleString()}</span>
            ${canEdit && estudianteId ? `
              <button class="btn btn-sm btn-secondary inline-flex items-center gap-1" onclick="EstudiantesView.editarAnotacion('${anotacion.id}', '${estudianteId}')" title="Editar anotación">${Icons.get('pencil', 14)} Editar</button>
            ` : ''}
          </div>
        </div>
        <p style="margin: 0.5rem 0; font-size: 0.875rem; white-space: pre-wrap;">${anotacion.descripcion}</p>
        <div class="flex justify-between items-center mt-2" style="border-top: 1px dashed #e2e8f0; padding-top: 4px;">
          <span class="text-muted" style="font-size: 0.75rem;">Funcionario: <b>${nombreFuncionario}</b> | Registrado por: <b>${displayUser}</b></span>
        </div>
      </div>
    `;
  },

  /* ═══ Menú 1: Exclusivo para Registro de Bitácora ═══ */
  editarBitacoraSeguimiento(estudianteId, bitacoraId) {
    const est = Storage.getEstudianteById(estudianteId);
    let item = null;
    let source = 'bitacora_estudiante';

    // 1. Buscar en est.bitacoraSeguimiento
    if (est && Array.isArray(est.bitacoraSeguimiento)) {
      item = est.bitacoraSeguimiento.find(b => b && (String(b.id) === String(bitacoraId) || String(b.fecha) === String(bitacoraId)));
    }

    // 2. Buscar en anotaciones si no se encontró
    if (!item && Storage.cache.anotaciones) {
      const anot = Storage.cache.anotaciones.find(a => a && (String(a.id) === String(bitacoraId) || String(a.fecha) === String(bitacoraId)));
      if (anot) {
        item = { id: anot.id, fecha: anot.fecha, texto: anot.descripcion };
        source = 'anotaciones';
      }
    }

    // 3. Buscar en casos de seguimiento si no se encontró
    if (!item) {
      const casos = Storage.getCasosByEstudiante ? Storage.getCasosByEstudiante(estudianteId) : [];
      for (const c of casos) {
        if (c && c.seguimiento && Array.isArray(c.seguimiento)) {
          const seg = c.seguimiento.find((s, idx) => s && (String(s.id) === String(bitacoraId) || String(s.fecha) === String(bitacoraId) || `caso_seg_${c.id}_${idx}` === String(bitacoraId)));
          if (seg) {
            item = { id: seg.id || `caso_seg_${c.id}`, fecha: seg.fecha || c.fecha, texto: seg.texto };
            source = 'casos';
            break;
          }
        }
      }
    }

    if (!item) {
      App.showToast('No se encontró el registro en la bitácora', 'warning');
      return;
    }

    const d = new Date(item.fecha || Date.now());
    const fechaStr = isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0];
    const fechaProximoStr = item.fechaProximoSeguimiento || item.fechaProximo || (est ? est.fechaProximoSeguimiento : '') || '';

    const html = `
      <form id="form-edit-bitacora" onsubmit="event.preventDefault(); EstudiantesView.guardarEdicionBitacora('${estudianteId}', '${item.id || bitacoraId}', '${source}')">
        <div class="form-group mb-3">
          <label class="form-label">Fecha del Registro *</label>
          <input type="date" id="edit-bitacora-fecha" class="form-control" value="${fechaStr}" required>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Fecha de Próximo Seguimiento (Opcional)</label>
          <input type="date" id="edit-bitacora-proximo" class="form-control" value="${fechaProximoStr}">
          <small class="text-muted">Establece la fecha para la próxima revisión/alerta del caso.</small>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Detalle o Texto del Registro *</label>
          <textarea id="edit-bitacora-texto" class="form-control" rows="4" required placeholder="Texto o descripción del registro...">${item.texto || item.descripcion || ''}</textarea>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-secondary text-danger mr-auto" onclick="EstudiantesView.eliminarRegistroBitacora('${estudianteId}', '${item.id || bitacoraId}', '${source}')" style="margin-right: auto;">🗑️ Eliminar de Bitácora</button>
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="document.getElementById('form-edit-bitacora').requestSubmit()">Guardar Cambios</button>
    `;

    App.openModal('Editar Registro de Bitácora', html, footer);
  },

  async guardarEdicionBitacora(estudianteId, bitacoraId, source = 'bitacora_estudiante') {
    const est = Storage.getEstudianteById(estudianteId);
    const nuevoTexto = document.getElementById('edit-bitacora-texto').value.trim();
    const fechaSeleccionada = document.getElementById('edit-bitacora-fecha').value;
    const fechaProximo = document.getElementById('edit-bitacora-proximo')?.value || null;

    const dateObj = new Date(fechaSeleccionada);
    dateObj.setMinutes(dateObj.getMinutes() + dateObj.getTimezoneOffset());
    const nuevaFecha = dateObj.toISOString();

    if (est) {
      if (fechaProximo) {
        est.fechaProximoSeguimiento = fechaProximo;
      }
      if (Array.isArray(est.bitacoraSeguimiento)) {
        const item = est.bitacoraSeguimiento.find(b => b && (String(b.id) === String(bitacoraId) || String(b.fecha) === String(bitacoraId)));
        if (item) {
          item.texto = nuevoTexto;
          item.fecha = nuevaFecha;
          item.fechaProximoSeguimiento = fechaProximo;
          item.fechaProximo = fechaProximo;
        }
      }
      await Storage.saveEstudiante(est);
    }

    if (Storage.cache.anotaciones) {
      const anot = Storage.cache.anotaciones.find(a => a && (String(a.id) === String(bitacoraId) || String(a.fecha) === String(bitacoraId)));
      if (anot) {
        anot.descripcion = nuevoTexto;
        anot.fecha = nuevaFecha;
        if (fechaProximo) {
          anot.fechaProximoSeguimiento = fechaProximo;
        }
        await Storage.saveAnotacion(anot);
      }
    }

    App.closeModal();
    App.showToast('Registro de bitácora actualizado', 'success');
    this.renderDetalle(document.getElementById('app-content'), estudianteId, true);
  },

  async eliminarRegistroCompleto(estudianteId, targetId) {
    App.showConfirm('Eliminar Registro', '¿Estás seguro de eliminar este registro?', async () => {
      const est = Storage.getEstudianteById(estudianteId);
      let targetText = '';
      let targetFecha = '';
      let targetPairId = '';

      const getCleanText = (s) => (s || '').replace(/^[🔴🟢🔵🟣]\s*/, '').trim().toLowerCase();

      // 1. Obtener datos del registro en est.bitacoraSeguimiento
      if (est && Array.isArray(est.bitacoraSeguimiento)) {
        const itemBit = est.bitacoraSeguimiento.find(b => b && (String(b.id) === String(targetId) || String(b.fecha) === String(targetId)));
        if (itemBit) {
          targetText = itemBit.texto || itemBit.descripcion || '';
          targetFecha = itemBit.fecha || '';
          targetPairId = itemBit.pairId || itemBit.id || '';
        }
      }

      // 2. Obtener datos del registro en anotaciones
      if (!targetText && Storage.cache.anotaciones) {
        const anot = (Storage.cache.anotaciones || []).find(a => a && (String(a.id) === String(targetId) || String(a.fecha) === String(targetId)));
        if (anot) {
          targetText = anot.descripcion || '';
          targetFecha = targetFecha || anot.fecha || '';
          targetPairId = targetPairId || anot.pairId || anot.id || '';
        }
      }

      // 3. Obtener datos del registro en casos
      if (!targetText) {
        const casos = Storage.getCasosByEstudiante ? Storage.getCasosByEstudiante(estudianteId) : [];
        for (const c of casos) {
          if (c && (String(c.id) === String(targetId) || String(c.fecha) === String(targetId))) {
            targetText = c.titulo || c.descripcion || '';
            targetFecha = targetFecha || c.fecha || '';
          }
          if (c && Array.isArray(c.seguimiento)) {
            const seg = c.seguimiento.find((s, idx) => s && (String(s.id) === String(targetId) || String(s.fecha) === String(targetId) || `caso_seg_${c.id}_${idx}` === String(targetId)));
            if (seg) {
              targetText = seg.texto || '';
              targetFecha = targetFecha || seg.fecha || '';
            }
          }
        }
      }

      const cleanTargetText = getCleanText(targetText);
      const targetTime = targetFecha ? new Date(targetFecha).getTime() : 0;
      const targetIsInicio = cleanTargetText.includes('inicio');
      const targetIsFin = cleanTargetText.includes('fin');

      const isExactMatch = (item) => {
        if (!item) return false;
        const itemText = (item.texto || item.descripcion || item.titulo || '').toLowerCase();

        // 🛑 Regla Estricta: Un evento de 'Inicio' JAMÁS borra un evento de 'Fin'
        if (targetIsInicio && itemText.includes('fin')) return false;
        // 🛑 Regla Estricta: Un evento de 'Fin' JAMÁS borra un evento de 'Inicio'
        if (targetIsFin && itemText.includes('inicio')) return false;

        if (String(item.id) === String(targetId) || String(item.fecha) === String(targetId)) return true;
        if (targetPairId && item.pairId && String(item.pairId) === String(targetPairId)) return true;
        if (targetFecha && item.fecha && String(item.fecha) === String(targetFecha)) return true;
        if (targetTime && item.fecha && Math.abs(new Date(item.fecha).getTime() - targetTime) <= 5000) return true;
        if (cleanTargetText) {
          const itemClean = getCleanText(item.texto || item.descripcion || item.titulo);
          if (itemClean && itemClean === cleanTargetText) return true;
        }
        return false;
      };

      // A. BORRAR DE BITÁCORA DEL ESTUDIANTE (est.bitacoraSeguimiento)
      if (est && Array.isArray(est.bitacoraSeguimiento)) {
        const prevLen = est.bitacoraSeguimiento.length;
        est.bitacoraSeguimiento = est.bitacoraSeguimiento.filter(b => !isExactMatch(b));
        if (est.bitacoraSeguimiento.length !== prevLen) {
          await Storage.saveEstudiante(est);
        }
      }

      // B. BORRAR DE LÍNEA DE TIEMPO (Storage.cache.anotaciones & Supabase DB)
      if (Storage.cache.anotaciones) {
        const matchingAnots = Storage.cache.anotaciones.filter(a => isExactMatch(a));
        for (const ma of matchingAnots) {
          await Storage.deleteAnotacion(ma.id);
        }
      }

      // C. BORRAR DE CASOS DE SEGUIMIENTO Y SUB-EVENTOS
      const casos = Storage.getCasosByEstudiante ? Storage.getCasosByEstudiante(estudianteId) : [];
      for (const c of casos) {
        if (isExactMatch(c)) {
          if (Storage.deleteCaso) await Storage.deleteCaso(c.id);
        }
        if (c && Array.isArray(c.seguimiento)) {
          const prevLen = c.seguimiento.length;
          c.seguimiento = c.seguimiento.filter(s => !isExactMatch(s));
          if (c.seguimiento.length !== prevLen) {
            await Storage.saveCaso(c);
          }
        }
      }

      // D. BORRAR DE ACCIONES Y EVENTOS
      if (Storage.cache.acciones) {
        const accs = Storage.cache.acciones.filter(ac => isExactMatch(ac));
        for (const ac of accs) await Storage.deleteAccion(ac.id);
      }
      if (Storage.cache.eventos) {
        const evs = Storage.cache.eventos.filter(ev => isExactMatch(ev));
        for (const ev of evs) await Storage.deleteEvento(ev.id);
      }

      App.closeModal();
      App.showToast('Registro eliminado de ambas tablas correctamente', 'success');
      this.renderDetalle(document.getElementById('app-content'), estudianteId, true);
    });
  },

  async eliminarRegistroBitacora(estudianteId, bitacoraId, source = '') {
    return this.eliminarRegistroCompleto(estudianteId, bitacoraId);
  },

  async eliminarAnotacionTimeline(id, estudianteId, collection = 'anotaciones') {
    return this.eliminarRegistroCompleto(estudianteId, id);
  },

  /* ═══ Menú 2: Exclusivo para Línea de Tiempo de Eventos / Anotaciones ═══ */
  editarAnotacion(id, estudianteId, casoId = '') {
    let anotacion = (Storage.cache.anotaciones || []).find(a => a.id === id);
    let collection = 'anotaciones';

    if (!anotacion) {
      anotacion = (Storage.cache.acciones || []).find(a => a.id === id);
      if (anotacion) collection = 'acciones';
    }
    if (!anotacion) {
      anotacion = (Storage.cache.eventos || []).find(e => e.id === id);
      if (anotacion) collection = 'eventos';
    }
    if (!anotacion && String(id).startsWith('atraso_')) {
      const realId = String(id).replace('atraso_', '');
      anotacion = (Storage.cache.atrasos || []).find(a => a.id === realId);
      if (anotacion) {
        collection = 'atrasos';
        anotacion = { id: id, tipo: 'atraso', fecha: anotacion.fecha, descripcion: 'Atraso registrado en control de asistencia.' };
      }
    }
    if (!anotacion && String(id).startsWith('inasistencia_')) {
      const realId = String(id).replace('inasistencia_', '');
      anotacion = (Storage.cache.inasistencias || []).find(i => i.id === realId);
      if (anotacion) {
        collection = 'inasistencias';
        anotacion = { id: id, tipo: anotacion.justificado ? 'ausencia justificada' : 'ausencia', fecha: anotacion.fecha, descripcion: 'Inasistencia registrada en control de asistencia.' };
      }
    }
    if (!anotacion) {
      const casos = Storage.getCasosByEstudiante ? Storage.getCasosByEstudiante(estudianteId) : [];
      for (const c of casos) {
        if (c.id === id || (casoId && c.id === casoId)) {
          anotacion = { id: c.id, tipo: 'observacion', fecha: c.fecha, descripcion: c.titulo || c.descripcion || 'Caso registrado' };
          collection = 'casos';
          break;
        }
      }
    }

    if (!anotacion) {
      App.showToast('No se encontró la anotación a editar', 'warning');
      return;
    }

    const d = new Date(anotacion.fecha || anotacion.fechaCreacion || Date.now());
    const fechaStr = isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0];

    const html = `
      <form id="form-edit-anotacion" onsubmit="event.preventDefault(); EstudiantesView.guardarEdicionAnotacion('${id}', '${estudianteId}', '${collection}')">
        <div class="form-group mb-3">
          <label class="form-label">Asunto / Tipo *</label>
          <select id="edit-anot-tipo" class="form-control" required>
            <option value="entrevista" ${anotacion.tipo === 'entrevista' ? 'selected' : ''}>🏷️ Entrevista</option>
            <option value="observacion" ${anotacion.tipo === 'observacion' ? 'selected' : ''}>📋 Observación</option>
            <option value="positiva" ${anotacion.tipo === 'positiva' || anotacion.tipo === 'felicitacion' ? 'selected' : ''}>✨ Positiva / Felicitación</option>
            <option value="negativa" ${anotacion.tipo === 'negativa' || anotacion.tipo === 'falta' || anotacion.tipo === 'atraso' || anotacion.tipo === 'ausencia' ? 'selected' : ''}>⚠️ Falta / Negativa</option>
          </select>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Categoría de Falta (opcional)</label>
          <select id="edit-anot-falta" class="form-control">
            <option value="">Sin gravedad específica</option>
            <option value="leve" ${anotacion.categoriaFalta === 'leve' ? 'selected' : ''}>Leve</option>
            <option value="grave" ${anotacion.categoriaFalta === 'grave' ? 'selected' : ''}>Grave</option>
            <option value="gravisima" ${anotacion.categoriaFalta === 'gravisima' ? 'selected' : ''}>Gravísima</option>
          </select>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Fecha del Registro *</label>
          <input type="date" id="edit-anot-fecha" class="form-control" value="${fechaStr}" required>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Motivo / Descripción de la observación *</label>
          <textarea id="edit-anot-desc" class="form-control" rows="4" required placeholder="Detalle o motivo de la observación...">${anotacion.descripcion || ''}</textarea>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-secondary text-danger mr-auto" onclick="EstudiantesView.eliminarAnotacionTimeline('${id}', '${estudianteId}', '${collection}')" style="margin-right: auto;">🗑️ Eliminar Anotación</button>
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="document.getElementById('form-edit-anotacion').requestSubmit()">Guardar Cambios</button>
    `;

    App.openModal('Editar Anotación / Evento', html, footer);
  },

  async guardarEdicionAnotacion(id, estudianteId, collection = 'anotaciones') {
    let item = null;
    if (collection === 'anotaciones') item = (Storage.cache.anotaciones || []).find(a => a.id === id);
    else if (collection === 'acciones') item = (Storage.cache.acciones || []).find(a => a.id === id);
    else if (collection === 'eventos') item = (Storage.cache.eventos || []).find(e => e.id === id);
    else if (collection === 'casos') item = (Storage.cache.casos || []).find(c => c.id === id);
    else if (collection === 'atrasos') {
      const realId = String(id).replace('atraso_', '');
      item = (Storage.cache.atrasos || []).find(a => a.id === realId);
    } else if (collection === 'inasistencias') {
      const realId = String(id).replace('inasistencia_', '');
      item = (Storage.cache.inasistencias || []).find(i => i.id === realId);
    }

    if (!item) {
      App.closeModal();
      return;
    }

    const fechaSeleccionada = document.getElementById('edit-anot-fecha').value;
    const dateObj = new Date(fechaSeleccionada);
    dateObj.setMinutes(dateObj.getMinutes() + dateObj.getTimezoneOffset());

    item.tipo = document.getElementById('edit-anot-tipo').value;
    item.categoriaFalta = document.getElementById('edit-anot-falta').value || null;
    item.fecha = dateObj.toISOString();
    item.descripcion = document.getElementById('edit-anot-desc').value.trim();

    if (collection === 'acciones') {
      await Storage.saveAccion(item);
    } else if (collection === 'eventos') {
      await Storage.saveEvento(item);
    } else if (collection === 'casos') {
      if (Storage.saveCaso) await Storage.saveCaso(item);
    } else if (collection === 'atrasos') {
      if (Storage.saveAtraso) await Storage.saveAtraso(item);
    } else if (collection === 'inasistencias') {
      if (Storage.saveInasistencia) await Storage.saveInasistencia(item);
    } else {
      await Storage.saveAnotacion(item);
    }

    App.closeModal();
    App.showToast('Anotación actualizada correctamente', 'success');
    this.renderDetalle(document.getElementById('app-content'), estudianteId, true);
  },

  async eliminarAnotacionTimeline(id, estudianteId, collection = 'anotaciones') {
    App.showConfirm('Eliminar Anotación', '¿Estás seguro de eliminar esta anotación de la línea de tiempo?', async () => {
      if (collection === 'acciones') {
        await Storage.deleteAccion(id);
      } else if (collection === 'eventos') {
        await Storage.deleteEvento(id);
      } else if (collection === 'casos') {
        if (Storage.deleteCaso) await Storage.deleteCaso(id);
      } else {
        await Storage.deleteAnotacion(id);
      }

      App.closeModal();
      App.showToast('Anotación eliminada correctamente', 'success');
      this.renderDetalle(document.getElementById('app-content'), estudianteId, true);
    });
  },

  subirAdjuntoBitacora(estudianteId, id) {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      let anotacion = (Storage.cache.anotaciones || []).find(a => a.id === id);
      if (anotacion) {
        anotacion.adjunto = file.name;
        await Storage.saveAnotacion(anotacion);
        App.showToast(`Archivo "${file.name}" adjuntado con éxito`, 'success');
        this.renderDetalle(document.getElementById('app-content'), estudianteId);
      } else {
        App.showToast('No se encontró el registro para adjuntar archivo', 'warning');
      }
    };
    input.click();
  },

  editar(id) {
    const est = Storage.getEstudianteById(id);
    if(!est) return;
    
    const html = `
      <form id="form-edit-estudiante" onsubmit="event.preventDefault(); EstudiantesView.guardarEdicion('${id}')">
        <div class="form-group">
          <label class="form-label">Nombres *</label>
          <input type="text" id="edit-nombres" class="form-control" value="${est.nombres}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Apellidos *</label>
          <input type="text" id="edit-apellidos" class="form-control" value="${est.apellidos}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Fecha de Cumpleaños</label>
          <input type="date" id="edit-cumpleanos" class="form-control" value="${est.fechaCumpleanos || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Nombre del Apoderado</label>
          <input type="text" id="edit-apoderado" class="form-control" value="${est.apoderado || ''}">
        </div>
      </form>
    `;
    
    const footer = `
      <button class="btn btn-secondary text-danger mr-auto" onclick="EstudiantesView.eliminar('${id}')" style="margin-right: auto;">Eliminar Registro</button>
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="document.getElementById('form-edit-estudiante').requestSubmit()">Guardar Cambios</button>
    `;
    
    App.openModal('Editar Estudiante', html, footer);
  },
  
  guardarEdicion(id) {
    const est = Storage.getEstudianteById(id);
    if (!est) return;
    const fechaVal = document.getElementById('edit-cumpleanos').value;
    est.nombres = document.getElementById('edit-nombres').value;
    est.apellidos = document.getElementById('edit-apellidos').value;
    est.fechaCumpleanos = fechaVal;
    est.fechaNacimiento = fechaVal;
    est.fecha_nacimiento = fechaVal;
    est.apoderado = document.getElementById('edit-apoderado').value.trim();
    
    Storage.saveEstudiante(est);
    App.closeModal();
    App.showToast('Estudiante actualizado', 'success');
    this.renderDetalle(document.getElementById('app-content'), id);
  },
  
  eliminar(id) {
    const est = Storage.getEstudianteById(id);
    const cursoId = est ? est.curso : null;
    
    App.confirm('Eliminar Estudiante', '¿Estás seguro? Esta acción no se puede deshacer.', () => {
      Storage.deleteEstudiante(id);
      App.closeModal();
      App.showToast('Estudiante eliminado', 'success');
      
      if (window.location.hash.startsWith('#/estudiantes/')) {
        if (cursoId) {
          window.location.hash = '#/cursos/' + cursoId;
        } else {
          window.location.hash = '#/cursos';
        }
      } else {
        App.handleRoute();
      }
    });
  },
  
  abrirModalRegistroEvento(estudianteId) {
    this.nuevaAnotacion(estudianteId);
  },

  nuevaAnotacion(estudianteId) {
    const funcionarios = Storage.getFuncionariosActivos();
    
    let funcOptions = funcionarios.map(f => `<option value="${f.id}">${f.nombres} ${f.apellidos}</option>`).join('');
    if (funcOptions === '') funcOptions = '<option value="">No hay funcionarios registrados</option>';
    
    const html = `
      <form id="form-anotacion" onsubmit="event.preventDefault(); EstudiantesView.guardarAnotacion('${estudianteId}')">
        <div class="form-group">
          <label class="form-label">Tipo de Anotación *</label>
          <select id="anot-tipo" class="form-control" required onchange="EstudiantesView.toggleFalta(this.value)">
            ${DATA.tiposAnotacion.map(t => `<option value="${t.id}">${t.icono} ${t.nombre}</option>`).join('')}
          </select>
        </div>
        
        <div class="form-group hidden" id="div-falta" style="display: none;">
          <label class="form-label" style="color: var(--danger);">Clasificación de Falta (Según RICE) *</label>
          <select id="anot-falta" class="form-control">
            <option value="">Seleccione...</option>
            ${DATA.tiposFalta.map(t => `<option value="${t.id}">${t.nombre}</option>`).join('')}
          </select>
          <small class="text-muted mt-1 block" id="falta-desc"></small>
        </div>
        
        <div class="form-group">
          <label class="form-label">Descripción del Hecho *</label>
          <textarea id="anot-desc" class="form-control" required rows="4" placeholder="Describa objetivamente lo sucedido..."></textarea>
        </div>
        
        <div class="form-group">
          <label class="form-label">Funcionario que registra *</label>
          <select id="anot-func" class="form-control" required>
            <option value="">Seleccione funcionario...</option>
            ${funcOptions}
          </select>
        </div>
      </form>
    `;
    
    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="document.getElementById('form-anotacion').requestSubmit()">Guardar Anotación</button>
    `;
    
    App.openModal('Nueva Anotación / Falta', html, footer);
    
    // Setup listener for description of fault
    setTimeout(() => {
      const selectFalta = document.getElementById('anot-falta');
      const descFalta = document.getElementById('falta-desc');
      if(selectFalta && descFalta) {
        selectFalta.addEventListener('change', (e) => {
          if(!e.target.value) { descFalta.textContent = ''; return; }
          const falta = DATA.getTipoFalta(e.target.value);
          descFalta.textContent = falta ? falta.descripcion : '';
        });
      }
    }, 100);
  },
  
  toggleFalta(tipo) {
    const divFalta = document.getElementById('div-falta');
    const selectFalta = document.getElementById('anot-falta');
    if (tipo === 'negativa') {
      divFalta.style.display = 'block';
      selectFalta.setAttribute('required', 'true');
    } else {
      divFalta.style.display = 'none';
      selectFalta.removeAttribute('required');
      selectFalta.value = '';
    }
  },
  
  async guardarAnotacion(estudianteId) {
    try {
      const tipo = document.getElementById('anot-tipo').value;
      const funcionarioId = document.getElementById('anot-func').value;
      const funcionario = Storage.getFuncionarioById(funcionarioId);
      const funcionarioNombre = funcionario ? `${funcionario.nombres} ${funcionario.apellidos}` : '';
      
      const loggedUser = Auth.userProfile?.nombres 
        ? `${Auth.userProfile.nombres} ${Auth.userProfile.apellidos || ''}` 
        : (Auth.currentUser?.email || 'Sistema');

      const anotacion = {
        estudianteId: estudianteId,
        tipo: tipo,
        categoriaFalta: tipo === 'negativa' ? document.getElementById('anot-falta').value : null,
        descripcion: document.getElementById('anot-desc').value,
        funcionarioId: funcionarioId,
        funcionarioNombre: funcionarioNombre,
        registradoPor: loggedUser
      };
      
      const success = await Storage.saveAnotacion(anotacion);
      if (success) {
        App.closeModal();
        App.showToast('Anotación registrada', 'success');
        this.renderDetalle(document.getElementById('app-content'), estudianteId);
      }
    } catch (e) {

      App.showToast("Error al guardar anotación: " + e.message, "danger");
    }
  },

  eliminarAnotacion(id, estudianteId) {
    App.confirm('Eliminar Anotación', '¿Estás seguro de eliminar este registro?', async () => {
      const success = await Storage.deleteAnotacion(id);
      if (success) {
        App.closeModal();
        App.showToast('Anotación eliminada', 'success');
        this.renderDetalle(document.getElementById('app-content'), estudianteId);
      }
    });
  },

  importarExcel(estudianteId) {
    if (typeof XLSX === 'undefined') {
      App.showToast('La librería de Excel aún no ha cargado. Reintente en unos segundos.', 'warning');
      return;
    }

    // Crear input file dinámico
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx, .xls';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, {type: 'array'});
          
          // Leer todas las hojas y juntar las filas
          let allRows = [];
          workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet);
            allRows = allRows.concat(rows);
          });
          
          if (allRows.length === 0) {
            App.showToast('El archivo Excel está vacío o no tiene datos válidos', 'warning');
            return;
          }
          
          let importados = 0;
          allRows.forEach(row => {
            // Normalizar keys (minúsculas, sin acentos)
            const rowData = {};
            for (const key in row) {
              const cleanKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
              rowData[cleanKey] = row[key];
            }
            
            // Mapeo adaptado al Excel del usuario
            const descripcion = rowData.motivo || rowData.descripcion;
            
            // Requerimos al menos descripcion para guardar
            if (descripcion) {
              let tipoAnotacion = 'observacion'; // default
              const tipoStr = rowData['tipo de registro'] || rowData.tipo || '';
              if (tipoStr) {
                const t = tipoStr.toLowerCase();
                if (t.includes('positiva')) tipoAnotacion = 'positiva';
                if (t.includes('negativa')) tipoAnotacion = 'negativa';
              }
              
              let tipoFalta = null;
              const faltaStr = rowData.categoria || rowData.falta || '';
              if (tipoAnotacion === 'negativa' && faltaStr) {
                const f = faltaStr.toLowerCase();
                if (f.includes('gravisima') || f.includes('gravísima')) tipoFalta = 'gravisima';
                else if (f.includes('mediana grav') || f.includes('grave')) tipoFalta = 'grave';
                else if (f.includes('leve')) tipoFalta = 'leve';
              }
              
              // Intentar parsear la fecha o usar fecha actual
              let fecha = new Date().toISOString();
              if (rowData.fecha) {
                if (typeof rowData.fecha === 'number') {
                  // Serial excel
                  const d = new Date((rowData.fecha - (25567 + 2)) * 86400 * 1000);
                  fecha = d.toISOString();
                } else {
                  // String YYYY-MM-DD o DD/MM/YYYY
                  const str = String(rowData.fecha).trim();
                  if (str.includes('-')) {
                    // YYYY-MM-DD
                    const d = new Date(str + 'T12:00:00Z');
                    if (!isNaN(d.getTime())) fecha = d.toISOString();
                  } else if (str.includes('/')) {
                    // DD/MM/YYYY
                    const parts = str.split('/');
                    if (parts.length === 3) {
                      const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00Z`);
                      if (!isNaN(d.getTime())) fecha = d.toISOString();
                    }
                  }
                }
              }

              const anotacion = {
                estudianteId: estudianteId,
                tipo: tipoAnotacion,
                categoriaFalta: tipoFalta,
                descripcion: descripcion,
                funcionarioId: null,
                funcionarioNombre: rowData.funcionario || 'Importación Excel',
                fecha: fecha
              };
              
              Storage.saveAnotacion(anotacion);
              importados++;
            }
          });
          
          App.showToast(`Se importaron ${importados} anotaciones correctamente`, 'success');
          this.renderDetalle(document.getElementById('app-content'), estudianteId);
          
        } catch (error) {

          App.showToast('Error al procesar el archivo Excel. Verifique el formato.', 'danger');
        }
      };
      
      reader.readAsArrayBuffer(file);
    };
    
    input.click();
  },

  async loadContextDocuments() {
    try {
      const docs = Storage.getDocumentos();
      if (docs.length === 0) return '';
      let context = 'DOCUMENTOS NORMATIVOS INSTITUCIONALES (Para ser usados como base legal del análisis):\n';
      for (const doc of docs) {
        if (doc.categoria === 'RICE' || doc.categoria.startsWith('PROT_')) {
          context += `\n\n--- Documento: ${doc.nombre} (${doc.categoria}) ---\n${doc.texto}`;
        }
      }
      return context;
    } catch (e) {

      return '';
    }
  },

  async generarAnalisisIA(estudianteId) {
    App.showToast('Flujo IA Backend: usa el panel de asistencia IA.', 'info');

    if (!Auth.geminiCheck()) {
      App.showToast('IA temporalmente bloqueada por errores repetidos. Espera 60s.', 'warning');
      return;
    }

    this._currentEstudianteId = estudianteId;
    this._chatHistory = [];
    
    const est = Storage.getEstudianteById(estudianteId);
    const curso = DATA.getCurso(est.curso);
    const anotaciones = Storage.getAnotacionesByEstudiante(est.id);
    
    // Load contextual documents
    const documentosContexto = await this.loadContextDocuments();
    
    // Preparar el prompt con las nuevas directrices
    let promptText = `Actúa como un Especialista en Convivencia Escolar y Apoyo Psicosocial de BARITA.
Genera un Informe de Seguimiento Psicosocial y Convivencia. Tu respuesta debe tener un máximo de 170 palabras.
Omite o sintetiza registros incoherentes o de prueba (como "registros procedimentales" o textos sin sentido).
Evita citar leyes específicas (como Ley 20.536, etc.).

Estructura obligatoria exacta:
# Informe de Seguimiento Psicosocial y Convivencia
**Estudiante:** ${est.nombres} ${est.apellidos} | **Curso:** ${curso ? curso.nombre : 'Sin curso'}
**Categorización:** [Determinar categoría de apoyo] | **Estado:** [Determinar gravedad: Leve / Moderado / Grave]

### 1. Estado del Caso y Diagnóstico General
* **Resumen de condición:** [Perfil resumido y razón del caso]
* **Trazabilidad de la bitácora:** [Acciones clave e hitos del estudiante]

### 2. Vinculación Normativa y Pedagógica (Sin citar leyes específicas)
* **Reglamento Interno (RICE) / Protocolos:** [Etapas de abordaje y derivación]
* **Marco para la Buena Enseñanza / Gestión Educativa:** [Apoyos pedagógicos y socioemocionales requeridos]

### 3. Riesgo e Impacto
* **Impacto Individual/Aula:** [Vulnerabilidad y efectos en la convivencia del aula]

### 4. Sugerencia de Acción Directiva / Equipo Multidisciplinario
* [Pasos concretos a seguir: citación, derivación o cierre de caso]

Documentos de Contexto:
${documentosContexto}

Historial Conductual del Estudiante:
`;

    if (anotaciones.length === 0) {
      promptText += "El estudiante no registra anotaciones.\n";
    } else {
      anotaciones.sort((a,b) => new Date(b.fecha) - new Date(a.fecha)).forEach(a => {
        const tipo = DATA.getTipoAnotacion(a.tipo);
        const falta = a.categoriaFalta ? DATA.getTipoFalta(a.categoriaFalta) : null;
        promptText += `- Fecha: ${new Date(a.fecha).toLocaleDateString()}\n`;
        promptText += `  Tipo: ${tipo.nombre} ${falta ? '(Falta ' + falta.nombre + ')' : ''}\n`;
        promptText += `  Descripción: ${a.descripcion}\n\n`;
      });
    }

    // Guardamos el primer prompt en el historial
    this._chatHistory.push({
      role: 'user',
      parts: [{ text: promptText }]
    });

    // Mostrar estado de carga en el panel de IA (Drawer)
    const drawerOverlay = document.getElementById('ai-drawer-overlay');
    const drawerContent = document.getElementById('ai-drawer-content');
    
    // Deshabilitar interactividad de chat (Hacer el panel solo lectura)
    const drawerFooter = document.querySelector('.drawer-footer');
    if (drawerFooter) {
      drawerFooter.style.display = 'none';
    }
    
    if (drawerOverlay && drawerContent) {
      drawerOverlay.classList.remove('hidden');
      drawerContent.innerHTML = `
        <div style="text-align: center; padding: 2rem; flex-grow: 1; display: flex; flex-direction: column; justify-content: center; height: 100%;">
          <div style="font-size: 2.5rem; margin-bottom: 1rem; animation: pulse 1.5s infinite;">⏳</div>
          <h4 style="color: var(--primary); margin-bottom: 0.5rem;">Analizando comportamiento...</h4>
          <p style="color: var(--text-secondary); font-size: 0.875rem;">Leyendo contexto y formateando matriz de solo lectura</p>
        </div>
      `;
    }

    try {
      const aiResponse = await AIClient.call(
        'Eres un generador de informes institucionales.',
        this._chatHistory.map(m => `${m.role}: ${m.parts.map(p => p.text).join('\n')}`).join('\n\n'),
        { timeout: 60000 }
      );

      this._chatHistory.push({
        role: 'model',
        parts: [{ text: aiResponse }]
      });

      if (drawerContent) {
        drawerContent.innerHTML = '';
        this._renderMensajeIA(aiResponse, drawerContent);
      }
      
      App.showToast('✅ Informe generado exitosamente.', 'success');
      Auth.geminiSuccess();
    } catch (err) {

      Auth.geminiFail();
      App.showToast(err.message, 'danger');
      if (err.message.includes("API Key inválida")) {

      }
      if (drawerOverlay) {
        drawerOverlay.classList.add('hidden');
      }
    }
  },

  async enviarMensajeIA() {
    const input = document.getElementById('ai-chat-input');
    const drawerContent = document.getElementById('ai-drawer-content');
    const apiKey = '';
    
    if (!input || !input.value.trim() || !apiKey) return;
    
    const userText = input.value.trim();
    input.value = '';
    
    // Add user message to UI
    drawerContent.insertAdjacentHTML('beforeend', `
      <div style="margin: 1rem 0; padding: 1rem; background: #e0e7ff; border-radius: 8px; align-self: flex-end; border-right: 4px solid #4338ca;">
        <strong>Tú:</strong> ${userText}
      </div>
    `);
    drawerContent.scrollTop = drawerContent.scrollHeight;

    // Add to history
    this._chatHistory.push({
      role: 'user',
      parts: [{ text: userText }]
    });

    // Loader
    const loaderId = 'loader-' + Date.now();
    drawerContent.insertAdjacentHTML('beforeend', `
      <div id="${loaderId}" style="text-align: center; padding: 1rem; color: #6b7280; font-style: italic;">
        Generando respuesta... ⏳
      </div>
    `);
    drawerContent.scrollTop = drawerContent.scrollHeight;

    try {
      const aiResponse = await AIClient.call(
        'Eres un asistente conversacional para psicología/convivencia escolar.',
        this._chatHistory.map(m => `${m.role}: ${m.parts.map(p => p.text).join('\n')}`).join('\n\n'),
        { timeout: 60000 }
      );

      document.getElementById(loaderId)?.remove();

      if (!aiResponse || !aiResponse.trim()) throw new Error("La IA devolvió una respuesta vacía.");

      this._chatHistory.push({
        role: 'model',
        parts: [{ text: aiResponse }]
      });

      this._renderMensajeIA(aiResponse, drawerContent);
      drawerContent.scrollTop = drawerContent.scrollHeight;

    } catch (err) {

      document.getElementById(loaderId)?.remove();
      App.showToast('Error al obtener respuesta de la IA.', 'danger');
    }
  },

  _renderMensajeIA(text, container) {
    // Generate a unique ID for the text to copy
    const textId = 'text-' + Date.now();
    container.insertAdjacentHTML('beforeend', `
      <div class="ai-message" style="position: relative; margin-bottom: 1rem;">
        <button onclick="navigator.clipboard.writeText(document.getElementById('${textId}').innerText); App.showToast('¡Copiado!', 'success')" 
                style="position: absolute; top: 0.5rem; right: 0.5rem; background: #fff; border: 1px solid #cbd5e1; padding: 0.2rem 0.5rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; gap: 4px; z-index: 10;">
          📋 Copiar
        </button>
        <div id="${textId}" class="markdown-content" style="font-size: 0.9rem; line-height: 1.6; margin-top: 1.5rem;">
          ${marked.parse(text)}
        </div>
      </div>
    `);
  },

  /* ════════════════════════════════════════════
     Fase 4: Carga e Ingesta de Hoja de Vida PDF
     ════════════════════════════════════════════ */
  abrirModalCargarPDFHojaVida(estudianteId) {
    const est = Storage.getEstudianteById(estudianteId);
    if (!est) return;

    const html = `
      <div class="p-2">
        <p class="text-sm text-muted mb-3">
          Sube la <b>Hoja de Vida (PDF o Excel)</b> del estudiante <b>${Storage.safeHtml(est.nombres)} ${Storage.safeHtml(est.apellidos)}</b>.
          El sistema analizará el archivo y distribuirá automáticamente las anotaciones en la Línea de Tiempo (*Positivas, Negativas, Observaciones, Entrevistas*).
        </p>
        
        <div class="form-group mb-3">
          <label class="form-label">Seleccionar Archivo (PDF o Excel) *</label>
          <input type="file" id="input-pdf-hoja-vida" class="form-control" accept=".pdf,.xlsx,.xls,.csv" required>
        </div>

        <div id="pdf-preview-container" class="mt-3" style="display: none; background: #f8fafc; border: 1px solid #e2e8f0; padding: 1rem; border-radius: 8px;">
          <div id="pdf-preview-status" class="text-sm font-semibold mb-2">Analizando documento...</div>
          <div id="pdf-preview-stats" class="text-xs text-muted"></div>
        </div>
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button id="btn-procesar-pdf" class="btn btn-primary" onclick="EstudiantesView.procesarCargaPDFHojaVida('${estudianteId}')">🔍 Analizar e Ingestar Documento</button>
    `;

    App.openModal('📄 Cargar e Ingestar Hoja de Vida (PDF / Excel)', html, footer);
  },

  async procesarCargaPDFHojaVida(estudianteId) {
    const input = document.getElementById('input-pdf-hoja-vida');
    if (!input || !input.files || input.files.length === 0) {
      App.showToast('Por favor selecciona un archivo PDF o Excel', 'warning');
      return;
    }

    const file = input.files[0];
    const btn = document.getElementById('btn-procesar-pdf');
    const previewContainer = document.getElementById('pdf-preview-container');
    const previewStatus = document.getElementById('pdf-preview-status');
    const previewStats = document.getElementById('pdf-preview-stats');

    if (btn) { btn.disabled = true; btn.innerText = '⏳ Procesando Documento...'; }
    if (previewContainer) previewContainer.style.display = 'block';

    try {
      await window.PDFHojaVidaParser.limpiarAnotacionesBloque(estudianteId);
      
      let extraidas = [];
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
        extraidas = await window.PDFHojaVidaParser.parsearExcel(file);
      } else {
        const texto = await window.PDFHojaVidaParser.extraerTextoDePDF(file);
        extraidas = window.PDFHojaVidaParser.parsearAnotacionesTexto(texto);
      }

      if (extraidas.length === 0) {
        if (previewStatus) previewStatus.innerHTML = '⚠️ No se detectaron anotaciones con formato de fecha válido en este PDF.';
        if (btn) { btn.disabled = false; btn.innerText = 'Intentar de Nuevo'; }
        return;
      }

      const { incorporadas, omitidas } = window.PDFHojaVidaParser.desduplicarYProcesar(estudianteId, extraidas);

      if (previewStatus) {
        previewStatus.innerHTML = `✅ Análisis Completado: <b>${extraidas.length}</b> anotaciones detectadas.`;
      }
      if (previewStats) {
        previewStats.innerHTML = `
          <ul style="padding-left: 1.2rem; margin-top: 0.5rem;" class="text-xs">
            <li class="text-success font-semibold">✨ Nuevas a ingresar: ${incorporadas.length}</li>
            <li class="text-muted">⏭️ Omitidas por ya existir en plataforma: ${omitidas.length}</li>
          </ul>
        `;
      }

      if (incorporadas.length > 0) {
        await window.PDFHojaVidaParser.guardarAnotacionesNuevas(estudianteId, incorporadas);
        App.showToast(`✨ Se ingestaron ${incorporadas.length} anotaciones nuevas. (${omitidas.length} omitidas por duplicidad)`, 'success');
      } else {
        App.showToast('Todos los registros del PDF ya existían previamente en la ficha. Ninguno fue duplicado.', 'info');
      }

      setTimeout(() => {
        App.closeModal();
        this.renderDetalle(document.getElementById('app-content'), estudianteId, true);
      }, 1500);

    } catch (e) {
      console.error('Error en procesarCargaPDFHojaVida:', e);
      if (previewStatus) previewStatus.innerHTML = '❌ Error al procesar: ' + Storage.safeHtml(e.message || String(e));
      if (btn) { btn.disabled = false; btn.innerText = 'Reintentar'; }
      App.showToast('Error al leer el archivo PDF', 'danger');
    }
  },

  /* ════════════════════════════════════════════
     Fase 4: Flujo Operativo - Registrar Evento
     ════════════════════════════════════════════ */
  abrirModalRegistroEvento(estudianteId) {
    const html = `
      <form id="form-registro-evento" onsubmit="event.preventDefault(); EstudiantesView.guardarEvento('${estudianteId}')">
        <div class="form-group mb-3">
          <label class="form-label">Tipo de Evento / Asunto *</label>
          <select id="evento-tipo" class="form-control" required>
            <option value="entrevista">🏷️ Entrevista</option>
            <option value="observacion">📋 Observación</option>
            <option value="positiva">✨ Positiva / Felicitación</option>
            <option value="negativa">⚠️ Falta / Negativa</option>
          </select>
        </div>
        
        <div class="form-group mb-3">
          <label class="form-label">Participantes (Ej: Apoderado, Especialista)</label>
          <input type="text" id="evento-participantes" class="form-control" placeholder="Opcional">
        </div>

        <div class="form-group mb-3">
          <label class="form-label">Descripción del Evento *</label>
          <textarea id="evento-descripcion" class="form-control" rows="4" required placeholder="Detalles del evento..."></textarea>
        </div>
        
        <div class="form-group mb-3">
          <label class="flex items-center gap-2" style="cursor: pointer;">
            <input type="checkbox" id="evento-acta" style="width: 1rem; height: 1rem;">
            <span>Generar Acta (PDF registrado)</span>
          </label>
        </div>
        
        <div class="form-group mb-3">
          <label class="flex items-center gap-2" style="cursor: pointer;">
            <input type="checkbox" id="evento-notificar" style="width: 1rem; height: 1rem;" checked>
            <span>Notificar por Correo / Drive</span>
          </label>
        </div>
      </form>
    `;

    const footer = `
      <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button type="button" class="btn btn-primary" onclick="document.getElementById('form-registro-evento').requestSubmit()">Registrar Evento</button>
    `;

    App.openModal('📝 Registrar Evento / Entrevista', html, footer);
  },

  async guardarEvento(estudianteId) {
    try {
      const tipo = document.getElementById('evento-tipo').value;
      const participantes = document.getElementById('evento-participantes').value.trim();
      let descripcion = document.getElementById('evento-descripcion').value.trim();
      const acta = document.getElementById('evento-acta').checked;
      const notificar = document.getElementById('evento-notificar').checked;

      const est = Storage.getEstudianteById(estudianteId);
      if (!est) return;

      if (acta) descripcion += '\n\n[📄 Acta Generada]';
      if (participantes) descripcion = 'Participantes: ' + participantes + '\n' + descripcion;

      const loggedUser = Auth.userProfile?.nombres ? `${Auth.userProfile.nombres} ${Auth.userProfile.apellidos || ''}` : (Auth.currentUser?.email || 'Sistema');

      const evento = {
        id: Date.now().toString(),
        estudianteId: est.id,
        estudiante_id: est.id,
        estudianteNombre: `${est.nombres} ${est.apellidos}`,
        fecha: new Date().toISOString(),
        tipo: tipo,
        descripcion: descripcion,
        registradoPor: loggedUser,
        responsable: loggedUser,
        estado: 'abierto',
        tags: []
      };
      
      if (acta) evento.tags.push('acta_generada');
      if (notificar) evento.tags.push('notificado_correo');

      await Storage.saveEvento(evento);

      const anotacionEquiv = {
        id: evento.id,
        estudianteId: est.id,
        estudiante_id: est.id,
        fecha: evento.fecha,
        tipo: tipo,
        descripcion: descripcion,
        registradoPor: loggedUser
      };
      if (Storage.saveAnotacion) {
        await Storage.saveAnotacion(anotacionEquiv);
      }

      App.closeModal();
      App.showToast('Evento registrado y vinculado exitosamente', 'success');
      this.renderDetalle(document.getElementById('app-content'), estudianteId, true);
    } catch (e) {
      App.showToast('Error al registrar evento', 'danger');
    }
  },

  /* ═══ PACI / PASOS Y OBSERVACIONES DE INSPECTORÍA ═══ */
  getPACIPasosDefinicion() {
    return [
      {
        paso: 1,
        titulo: 'PASO 1: Recepción de Antecedentes y Diagnóstico',
        hitos: [
          { id: 'paso1_1', texto: 'Entrevista de Ingreso / Acogida y firma de autorización apoderado.' },
          { id: 'paso1_2', texto: 'Recopilación de informes médicos, clínicos y diagnósticos externos.' },
          { id: 'paso1_3', texto: 'Aplicación de Anamnesis por equipo psicosocial/diferencial.' }
        ]
      },
      {
        paso: 2,
        titulo: 'PASO 2: Evaluación Multidisciplinaria y Entorno',
        hitos: [
          { id: 'paso2_1', texto: 'Evaluación psicopedagógica integral e informe de competencia curricular.' },
          { id: 'paso2_2', texto: 'Evaluación e informes de especialistas (Psicología / Fonoaudiología).' },
          { id: 'paso2_3', texto: 'Definición de necesidades de acceso (tiempo extra, asiento preferencial, apoyos visuales).' }
        ]
      },
      {
        paso: 3,
        titulo: 'PASO 3: Diseño e Ingreso de Adaptaciones',
        hitos: [
          { id: 'paso3_1', texto: 'Definición de adecuaciones de acceso y evaluaciones diferenciadas.' },
          { id: 'paso3_2', texto: 'Priorización y desglose de Objetivos de Aprendizaje (OA).' },
          { id: 'paso3_3', texto: 'Asignación de apoyos especializados (Aula de Recursos, Educadora Diferencial, PAEC).' }
        ]
      },
      {
        paso: 4,
        titulo: 'PASO 4: Socialización y Firma de Compromisos',
        hitos: [
          { id: 'paso4_1', texto: 'Presentación formal del Plan PACI al apoderado y firma de compromiso.' },
          { id: 'paso4_2', texto: 'Entrega y coordinación de criterios PACI con profesores de asignatura.' },
          { id: 'paso4_3', texto: 'Monitoreo de avances y marcaje de progreso continuo.' }
        ]
      }
    ];
  },

  calcularProgresoPACI(est) {
    if (!est) return 0;
    const marcados = est.paciHitosMarcados || {};
    const totalHitos = 12;
    let marcadosCount = 0;

    const pasosDef = this.getPACIPasosDefinicion();
    pasosDef.forEach(p => {
      p.hitos.forEach(h => {
        if (marcados[h.id] === true) marcadosCount++;
      });
    });

    return Math.round((marcadosCount / totalHitos) * 100);
  },

  renderPACITemplate(est) {
    if (!est) return '';
    if (!est.paciHitosMarcados || typeof est.paciHitosMarcados !== 'object') {
      est.paciHitosMarcados = {};
    }

    const progreso = this.calcularProgresoPACI(est);
    const pasosDef = this.getPACIPasosDefinicion();

    const pasosHtml = pasosDef.map(p => {
      const hitosPendientes = p.hitos.filter(h => est.paciHitosMarcados[h.id] !== true);
      
      if (hitosPendientes.length === 0) {
        return `
          <div style="margin-bottom: 0.75rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 0.65rem 0.75rem; display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 0.85rem; font-weight: 700; color: #15803d; display: flex; align-items: center; gap: 0.4rem;">
              <span>✅</span> ${p.titulo}
            </span>
            <span style="font-size: 0.75rem; color: #166534; font-weight: 600; background: #dcfce7; padding: 0.15rem 0.5rem; border-radius: 10px;">Paso Completado</span>
          </div>
        `;
      }

      const hitosHtml = hitosPendientes.map(h => {
        return `
          <label style="display: flex; align-items: flex-start; gap: 0.6rem; padding: 0.4rem 0.6rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 0.35rem; cursor: pointer;">
            <input type="checkbox" onchange="EstudiantesView.toggleHitoPACI('${est.id}', '${h.id}', this.checked)" style="width: 1.1rem; height: 1.1rem; accent-color: #0ea5e9; margin-top: 2px;">
            <span style="font-size: 0.85rem; font-weight: 500; color: var(--text-primary); line-height: 1.35;">${h.texto}</span>
          </label>
        `;
      }).join('');

      return `
        <div style="margin-bottom: 1rem; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0.75rem;">
          <h5 style="margin: 0 0 0.5rem 0; font-size: 0.9rem; font-weight: 700; color: #0369a1; display: flex; align-items: center; gap: 0.4rem;">
            <span>📋</span> ${p.titulo}
          </h5>
          <div>${hitosHtml}</div>
        </div>
      `;
    }).join('');

    const obs = est.observacionesInspectoria || {};
    const isOpen = est._paciAbierto === true ? 'open' : '';

    return `
      <details class="card mt-3" ${isOpen} ontoggle="EstudiantesView.onPACIToggle('${est.id}', this.open)" style="border-top: 4px solid #0ea5e9; transition: all 0.3s ease;">
        <summary style="cursor: pointer; padding: 0.85rem 1.25rem; display: flex; align-items: center; justify-content: space-between; user-select: none; list-style: none;" class="card-header">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 1.1rem; transition: transform 0.2s ease;" class="paci-arrow">▶</span>
            <h3 class="card-title" style="color: #0284c7; margin: 0; font-size: 1.05rem; display: flex; align-items: center; gap: 0.4rem;">
              <span>🧩</span> Plan PACI
            </h3>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="badge" style="background: #0ea5e9; color: white; font-size: 0.8rem; font-weight: 700; padding: 0.2rem 0.55rem; border-radius: 12px;">
              Progreso: ${progreso}%
            </span>
          </div>
        </summary>
        
        <div class="card-body" style="border-top: 1px solid #e2e8f0; padding-top: 1rem;">
          <div style="background: #e0f2fe; border-radius: 10px; height: 10px; overflow: hidden; margin-bottom: 1rem; border: 1px solid #bae6fd;">
            <div style="background: linear-gradient(90deg, #0ea5e9, #10b981); height: 100%; width: ${progreso}%; transition: width 0.4s ease;"></div>
          </div>
          
          <div>
            ${pasosHtml}
          </div>

          <!-- Nueva Sección: Observaciones para Inspectoría -->
          <div style="margin-top: 1.25rem; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 1rem;">
            <h4 style="margin: 0 0 0.75rem 0; color: #b45309; font-size: 0.95rem; font-weight: 700; display: flex; align-items: center; gap: 0.4rem;">
              <span>ℹ️</span> Observaciones y Consideraciones para Inspectoría
            </h4>
            
            <div class="form-group mb-2">
              <label class="form-label" style="font-weight: 600; font-size: 0.8rem; color: #78350f;">Adulto de Confianza / Vínculo Significativo</label>
              <input type="text" id="paci-obs-adulto" class="form-control form-control-sm" value="${Storage.safeHtml(obs.adultoConfianza || '')}" placeholder="Nombre del docente/funcionario de referencia..." style="font-size: 0.85rem;">
            </div>

            <div class="form-group mb-2">
              <label class="form-label" style="font-weight: 600; font-size: 0.8rem; color: #78350f;">Consideraciones de Diagnóstico / Disparadores Sensoriales</label>
              <textarea id="paci-obs-disparadores" class="form-control form-control-sm" rows="2" placeholder="Estímulos o situaciones a evitar (ruidos fuertes, sobrecarga sensorial)..." style="font-size: 0.85rem;">${Storage.safeHtml(obs.disparadoresSensoriales || '')}</textarea>
            </div>

            <div class="form-group mb-3">
              <label class="form-label" style="font-weight: 600; font-size: 0.8rem; color: #78350f;">Estrategia Recomendada de Contención</label>
              <textarea id="paci-obs-estrategia" class="form-control form-control-sm" rows="2" placeholder="Pasos para autorregulación y contención emocional en patio/aula..." style="font-size: 0.85rem;">${Storage.safeHtml(obs.estrategiaContencion || '')}</textarea>
            </div>

            <div style="text-align: right;">
              <button class="btn btn-sm btn-warning" onclick="EstudiantesView.guardarObservacionesInspectoria('${est.id}')" style="background: #f59e0b; border: none; color: white; font-weight: 700; font-size: 0.85rem; padding: 0.35rem 0.85rem;">
                💾 Guardar Observaciones
              </button>
            </div>
          </div>
        </div>
      </details>
    `;
  },

  onPACIToggle(estId, isOpen) {
    const est = Storage.getEstudianteById(estId);
    if (est) {
      est._paciAbierto = isOpen;
    }
  },

  async toggleHitoPACI(estId, hitoId, marcado) {
    const est = Storage.getEstudianteById(estId);
    if (!est) return;
    if (!est.paciHitosMarcados || typeof est.paciHitosMarcados !== 'object') {
      est.paciHitosMarcados = {};
    }
    
    est._paciAbierto = true;
    est.paciHitosMarcados[hitoId] = marcado;
    await Storage.saveEstudiante(est);
    this.renderDetalle(document.getElementById('app-content'), estId, true);
  },

  async guardarObservacionesInspectoria(estId) {
    const est = Storage.getEstudianteById(estId);
    if (!est) return;

    const adulto = document.getElementById('paci-obs-adulto')?.value.trim() || '';
    const disparadores = document.getElementById('paci-obs-disparadores')?.value.trim() || '';
    const estrategia = document.getElementById('paci-obs-estrategia')?.value.trim() || '';

    est.observacionesInspectoria = {
      adultoConfianza: adulto,
      disparadoresSensoriales: disparadores,
      estrategiaContencion: estrategia
    };

    await Storage.saveEstudiante(est);
    App.showToast('ℹ️ Observaciones para Inspectoría guardadas correctamente', 'success');
  },

  cambiarFichaYear(studentId, year) {
    this.selectedFichaYear = String(year);
    this.renderDetalle(document.getElementById('app-content'), studentId, true);
  },

  renderComparativaAnualTemplate(est) {
    const years = ['2024', '2025', '2026'];
    const metrics = years.map(yr => {
      // 1. Anotaciones Positivas count — busca en anotaciones Y eventos
      const _matchYear = (fecha) => {
        const f = String(fecha || '');
        return (f.startsWith(yr) || f.endsWith(yr) || f.includes('-' + yr) || f.includes('/' + yr));
      };
      const _isPosType = (tipo) => {
        const t = String(tipo || '').toLowerCase().trim();
        return t === 'positiva' || t === 'felicitacion';
      };
      const posFromAnotaciones = (Storage.cache.anotaciones || []).filter(a => {
        const eId = String(a.estudianteId || a.estudiante_id || '').trim();
        return eId === String(est.id) && _isPosType(a.tipo) && _matchYear(a.fecha);
      }).length;
      const posFromEventos = (Storage.cache.eventos || []).filter(e => {
        const eId = String(e.estudianteId || e.estudiante_id || '').trim();
        const fecha = e.fecha || e.fechaCreacion || '';
        return eId === String(est.id) && _isPosType(e.tipo) && _matchYear(fecha);
      }).length;
      const posCount = posFromAnotaciones + posFromEventos;
      
      // 2. Anotaciones Negativas count — solo tipo === 'negativa'
      const negCount = (Storage.cache.anotaciones || []).filter(a => {
        const eId = String(a.estudianteId || a.estudiante_id || '').trim();
        const fecha = String(a.fecha || '');
        const tipo = String(a.tipo || '').toLowerCase().trim();
        const matchesYear = (fecha.startsWith(yr) || fecha.endsWith(yr) || fecha.includes('-' + yr) || fecha.includes('/' + yr));
        return eId === String(est.id) && matchesYear && tipo === 'negativa';
      }).length;
      
      // 3. Atrasos count (Robust date match)
      const atrasosCount = (Storage.cache.atrasos || []).filter(a => {
        const eId = String(a.estudianteId || a.estudiante_id || '').trim();
        const fecha = String(a.fecha || '');
        const matchesYear = (fecha.startsWith(yr) || fecha.endsWith(yr) || fecha.includes('-' + yr) || fecha.includes('/' + yr));
        return eId === String(est.id) && matchesYear;
      }).length;
      
      // 4. Inasistencias count (Robust date match)
      const absenceCount = (Storage.cache.inasistencias || []).filter(i => {
        const eId = String(i.estudianteId || i.estudiante_id || '').trim();
        const fecha = String(i.fecha || '');
        const matchesYear = (fecha.startsWith(yr) || fecha.endsWith(yr) || fecha.includes('-' + yr) || fecha.includes('/' + yr));
        return eId === String(est.id) && matchesYear;
      }).length;
      
      const diasAsistidos = 180 - absenceCount;
      const asistenciaReal = Math.round((diasAsistidos / 180) * 100);
      
      // 5. Casos count (Robust date match)
      const casosCount = (Storage.cache.casos || []).filter(c => {
        if (c.estudiante_id && String(c.estudiante_id).trim() === est.id) return true;
        if (c.estudianteId && String(c.estudianteId).trim() === est.id) return true;
        if (Array.isArray(c.estudiantesInvolucrados) && c.estudiantesInvolucrados.map(String).includes(est.id)) return true;
        return false;
      }).filter(c => {
        const fecha = String(c.fecha || c.fechaCreacion || '');
        return (fecha.startsWith(yr) || fecha.endsWith(yr) || fecha.includes('-' + yr) || fecha.includes('/' + yr));
      }).length;
      
      return {
        year: yr,
        posCount,
        negCount,
        atrasosCount,
        asistenciaReal,
        casosCount
      };
    });

    return `
      <div class="card mt-4">
        <div class="card-header">
          <h3 class="card-title" style="display: inline-flex; align-items: center; gap: 0.5rem;">${Icons.get('trending-up', 20)} Comparativa y Contraste Anual</h3>
        </div>
        <div class="card-body" style="padding: 0;">
          <table class="table" style="width: 100%; font-size: 0.85rem; border-collapse: collapse; margin: 0;">
            <thead>
              <tr style="background: var(--bg-hover); border-bottom: 1px solid var(--border-color);">
                <th style="padding: 0.75rem 1rem; text-align: left; color: var(--text-secondary);">Indicador</th>
                <th style="padding: 0.75rem 1rem; text-align: center; color: var(--text-secondary);">2024</th>
                <th style="padding: 0.75rem 1rem; text-align: center; color: var(--text-secondary);">2025</th>
                <th style="padding: 0.75rem 1rem; text-align: center; color: var(--text-secondary);">2026</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 0.75rem 1rem; text-align: center; color: var(--success);"><span style="display: inline-flex; align-items: center; justify-content: center;">${Icons.get('thumbs-up', 18)}</span></td>
                <td style="padding: 0.75rem 1rem; text-align: center; font-weight: 500; color: var(--success);">${metrics[0].posCount}</td>
                <td style="padding: 0.75rem 1rem; text-align: center; font-weight: 500; color: var(--success);">${metrics[1].posCount}</td>
                <td style="padding: 0.75rem 1rem; text-align: center; font-weight: 500; color: var(--success);">${metrics[2].posCount}</td>
              </tr>
              <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 0.75rem 1rem; text-align: center; color: var(--danger);"><span style="display: inline-flex; align-items: center; justify-content: center;">${Icons.get('thumbs-down', 18)}</span></td>
                <td style="padding: 0.75rem 1rem; text-align: center; font-weight: 500; color: var(--danger);">${metrics[0].negCount}</td>
                <td style="padding: 0.75rem 1rem; text-align: center; font-weight: 500; color: var(--danger);">${metrics[1].negCount}</td>
                <td style="padding: 0.75rem 1rem; text-align: center; font-weight: 500; color: var(--danger);">${metrics[2].negCount}</td>
              </tr>
              <tr>
                <td style="padding: 0.75rem 1rem; text-align: center; color: var(--primary);"><span style="display: inline-flex; align-items: center; justify-content: center;">${Icons.get('calendar', 18)}</span></td>
                <td style="padding: 0.75rem 1rem; text-align: center; font-weight: bold; color: ${metrics[0].asistenciaReal < 85 ? 'var(--danger)' : 'var(--primary)'};">${metrics[0].asistenciaReal}%</td>
                <td style="padding: 0.75rem 1rem; text-align: center; font-weight: bold; color: ${metrics[1].asistenciaReal < 85 ? 'var(--danger)' : 'var(--primary)'};">${metrics[1].asistenciaReal}%</td>
                <td style="padding: 0.75rem 1rem; text-align: center; font-weight: bold; color: ${metrics[2].asistenciaReal < 85 ? 'var(--danger)' : 'var(--primary)'};">${metrics[2].asistenciaReal}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  toggleMostrarTodasBitacora(estId) {
    this._mostrarTodasBitacora = !this._mostrarTodasBitacora;
    this.renderDetalle(document.getElementById('app-content'), estId, true);
  }
};

window.EstudiantesView = EstudiantesView;
})();
