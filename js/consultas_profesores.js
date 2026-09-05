/* ================================================================
   consultas_profesores.js - Chatbot RAG para Profesores
   Usa AIClient para centralizar llamadas a Gemini.
   ================================================================ */

const ConsultasProfesoresView = (() => {
  let documentosCacheHash = "";
  let contextoGeneralCached = "";

  function render(container) {
    App.currentView = 'consultas';
    App.setBreadcrumb('Asistencia IA - Bambino');

    let savedTab = 'tab-chatbot';
    try {
      savedTab = localStorage.getItem('barita_active_ia_tab') || 'tab-chatbot';
    } catch (_e) {}

    let html = `
      <div style="max-width: 1000px; margin: 0 auto;">
        <!-- Pestañas del Módulo Asistencia IA -->
        <div class="dashboard-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; border-bottom: 2px solid #e2e8f0; overflow-x: auto; padding-bottom: 0.5rem;">
          <button class="tab-btn ${savedTab === 'tab-chatbot' ? 'active' : ''}" onclick="window.ConsultasProfesoresView.switchTab('tab-chatbot', this)" style="border: none; background: transparent; font-weight: 600; font-size: 1.05rem; padding: 0.5rem 1rem; border-bottom: 3px solid ${savedTab === 'tab-chatbot' ? 'var(--primary)' : 'transparent'}; color: ${savedTab === 'tab-chatbot' ? 'var(--primary)' : 'var(--text-secondary)'}; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem;">${Icons.get('bot', 18)} Chatbot (Bambino)</button>
          <button class="tab-btn ${savedTab === 'tab-correos' ? 'active' : ''}" onclick="window.ConsultasProfesoresView.switchTab('tab-correos', this)" style="border: none; background: transparent; font-weight: 600; font-size: 1.05rem; padding: 0.5rem 1rem; border-bottom: 3px solid ${savedTab === 'tab-correos' ? 'var(--primary)' : 'transparent'}; color: ${savedTab === 'tab-correos' ? 'var(--primary)' : 'var(--text-secondary)'}; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem;">${Icons.get('mail', 18)} Redactor de Correos</button>
          <button class="tab-btn ${savedTab === 'tab-entrevistas' ? 'active' : ''}" onclick="window.ConsultasProfesoresView.switchTab('tab-entrevistas', this)" style="border: none; background: transparent; font-weight: 600; font-size: 1.05rem; padding: 0.5rem 1rem; border-bottom: 3px solid ${savedTab === 'tab-entrevistas' ? 'var(--primary)' : 'transparent'}; color: ${savedTab === 'tab-entrevistas' ? 'var(--primary)' : 'var(--text-secondary)'}; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem;">${Icons.get('clipboard', 18)} Entrevistas con IA</button>
          <button class="tab-btn ${savedTab === 'tab-reporte-estudiante' ? 'active' : ''}" onclick="window.ConsultasProfesoresView.switchTab('tab-reporte-estudiante', this)" style="border: none; background: transparent; font-weight: 600; font-size: 1.05rem; padding: 0.5rem 1rem; border-bottom: 3px solid ${savedTab === 'tab-reporte-estudiante' ? 'var(--primary)' : 'transparent'}; color: ${savedTab === 'tab-reporte-estudiante' ? 'var(--primary)' : 'var(--text-secondary)'}; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem;">${Icons.get('bar-chart-3', 18)} Reporte Estudiante IA</button>
          <button class="tab-btn ${savedTab === 'tab-reporte-funcionario' ? 'active' : ''}" onclick="window.ConsultasProfesoresView.switchTab('tab-reporte-funcionario', this)" style="border: none; background: transparent; font-weight: 600; font-size: 1.05rem; padding: 0.5rem 1rem; border-bottom: 3px solid ${savedTab === 'tab-reporte-funcionario' ? 'var(--primary)' : 'transparent'}; color: ${savedTab === 'tab-reporte-funcionario' ? 'var(--primary)' : 'var(--text-secondary)'}; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem;">${Icons.get('briefcase', 18)} Reporte Funcionario IA</button>
        </div>

        <!-- Pestaña 1: Chatbot Bambino -->
        <div id="tab-chatbot" class="ia-tab-content" style="display: ${savedTab === 'tab-chatbot' ? 'block' : 'none'};">
          <div class="card" style="display: flex; flex-direction: column; height: 68vh;">
            <div class="card-header" style="background: var(--primary); color: white; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; padding: 1rem 1.25rem;">
              <div>
                <h3 class="card-title" style="margin: 0; display: flex; align-items: center; gap: 8px;">👦 Bambino - Asistente Virtual</h3>
                <p style="margin: 0; font-size: 0.85rem; opacity: 0.9;">Pregúntame sobre el RICE, PEI o protocolos institucionales.</p>
              </div>
              
              <div style="display: flex; align-items: center; gap: 0.5rem; background: rgba(255,255,255,0.15); padding: 0.25rem 0.75rem; border-radius: 20px;">
                <span style="font-size: 0.8rem; font-weight: 600;">📚 Documento:</span>
                <select id="chat-doc-selector" class="form-control form-control-sm" style="width: auto; background: white; color: var(--primary); font-weight: 700; border: none; cursor: pointer;" onchange="window.ConsultasProfesoresView.onDocumentChange(this.value)">
                  <option value="TODOS">Todos los Documentos del Colegio</option>
                </select>
              </div>
            </div>
            
            <div id="chat-history" class="card-body" style="flex: 1; overflow-y: auto; background: var(--bg-hover); display: flex; flex-direction: column; gap: 1rem; padding: 1.5rem; font-size: 0.9rem;">
              <div style="align-self: flex-start; max-width: 80%; background: white; padding: 1rem; border-radius: 12px; border-top-left-radius: 2px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                <strong>👦 Bambino</strong><br>
                ¡Hola! He preparado los reglamentos y protocolos oficiales de tu escuela. ¿En qué procedimiento puedo orientarte hoy?
              </div>
            </div>

            <div class="card-body" style="border-top: 1px solid var(--border-color); display: flex; gap: 0.5rem; background: white;">
              <input type="text" id="chat-input" class="form-control" placeholder="Ej: ¿Cuál es el procedimiento ante una falta grave o un atraso?" style="flex: 1;" onkeypress="if(event.key === 'Enter') window.ConsultasProfesoresView.enviarPregunta()">
              <button class="btn btn-primary" onclick="window.ConsultasProfesoresView.enviarPregunta()" id="btn-enviar-chat">Enviar</button>
            </div>
          </div>
        </div>

        <!-- Pestaña 2: Correos IA -->
        <div id="tab-correos" class="ia-tab-content" style="display: ${savedTab === 'tab-correos' ? 'block' : 'none'};">
          <div class="card p-4">
            <h3 style="margin-top:0;">✉️ Redactor Profesional de Correos e Citaciones</h3>
            <p class="text-secondary">Pega o escribe la idea borrador de tu correo. La IA mejorará la redacción, ortografía y tono institucional en función de la visión y misión del colegio.</p>

            <div class="form-group mb-3">
              <label class="form-label" style="font-weight:600;">Escribe o pega el borrador de tu correo aquí:</label>
              <textarea id="correo-borrador" class="form-control" rows="5" placeholder="Ej: Estimado apoderado necesito citarlo para el jueves a las 10 porque el alumno ha llegado atrasado 3 veces y no trae la tarea de matemática..."></textarea>
            </div>

            <button class="btn btn-primary mb-3" onclick="window.ConsultasProfesoresView.generarCorreoIA()">✨ Perfeccionar y Redactar Correo con IA</button>

            <div id="correo-resultado" style="display:none; margin-top: 1rem; background: #f8fafc; border: 1px solid #cbd5e1; padding: 1.5rem; border-radius: 8px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.5rem;">
                <h4 style="margin:0;">Correo Mejorado y Estructurado:</h4>
                <button class="btn btn-sm btn-outline-secondary" onclick="window.ConsultasProfesoresView.copiarCorreoFormateado('correo-texto-res')">📋 Copiar Correo</button>
              </div>
              <div id="correo-texto-res" style="background:white; border: 1px solid #cbd5e1; padding: 1rem; border-radius: 6px; font-family: inherit; font-size: 0.95rem; line-height: 1.6; color: var(--text-primary); min-height: 150px; white-space: pre-wrap;"></div>
            </div>
          </div>
        </div>

        <!-- Pestaña 3: Entrevistas IA -->
        <div id="tab-entrevistas" class="ia-tab-content" style="display: ${savedTab === 'tab-entrevistas' ? 'block' : 'none'};">
          <div class="card p-4">
            <h3 style="margin-top:0;">📋 Registro de Entrevista y Bitácora IA</h3>
            <p class="text-secondary">Pega los apuntes en bruto de tu entrevista. La IA formateará y estructurará el acta oficial con Motivo, Desarrollo y Acuerdos RICE proporcionales.</p>

            <!-- Nivel 1: Tipo de Participante -->
            <div class="form-group mb-3">
              <label class="form-label" style="font-weight:600;">Participante Entrevistado</label>
              <select id="entrevista-categoria" class="form-control" onchange="window.ConsultasProfesoresView.onCategoriaEntrevistaChange(this.value)">
                <option value="escolar">Comunidad Escolar (Estudiante / Apoderado)</option>
                <option value="funcionario">Funcionario / Docente del Colegio</option>
              </select>
            </div>

            <!-- Nivel 2.A: Si es Escolar -> Subtipo Escolar -->
            <div id="entrevista-group-escolar-tipo" class="form-group mb-3">
              <label class="form-label" style="font-weight:600;">Rol del Entrevistado</label>
              <select id="entrevista-subtipo-escolar" class="form-control" onchange="window.ConsultasProfesoresView.onSubtipoEscolarChange()">
                <option value="estudiante">Estudiante</option>
                <option value="apoderado">Apoderado / Tutor Legal</option>
              </select>
            </div>

            <!-- Nivel 2.B: Selección de Curso (para Escolar) -->
            <div id="entrevista-group-curso" class="form-group mb-3">
              <label class="form-label" style="font-weight:600;">Seleccionar Curso</label>
              <select id="entrevista-curso" class="form-control" onchange="window.ConsultasProfesoresView.cargarParticipantesEntrevista()">
                <option value="">-- Selecciona un curso --</option>
              </select>
            </div>

            <!-- Nivel 3.A: Selección de Estudiante / Apoderado -->
            <div id="entrevista-group-persona-escolar" class="form-group mb-3">
              <label id="entrevista-label-persona" class="form-label" style="font-weight:600;">Estudiante / Apoderado</label>
              <select id="entrevista-persona-escolar" class="form-control">
                <option value="">-- Primero selecciona un curso --</option>
              </select>
            </div>

            <!-- Nivel 3.B: Selección de Funcionario -->
            <div id="entrevista-group-funcionario" class="form-group mb-3" style="display:none;">
              <label class="form-label" style="font-weight:600;">Seleccionar Funcionario / Docente</label>
              <select id="entrevista-funcionario" class="form-control">
                <option value="">-- Cargando funcionarios --</option>
              </select>
            </div>

            <!-- Motivo de la entrevista -->
            <div class="form-group mb-3">
              <label class="form-label" style="font-weight:600;">Motivo de la Entrevista</label>
              <input type="text" id="entrevista-motivo" class="form-control" placeholder="Ej: Citación por faltas a la convivencia escolar / Entrevista de orientación pedagógica">
            </div>

            <!-- Apuntes en bruto / Desarrollo -->
            <div class="form-group mb-3">
              <label class="form-label" style="font-weight:600;">Apuntes / Notas de la Entrevista</label>
              <textarea id="entrevista-apuntes" class="form-control" rows="5" placeholder="Pega o escribe los apuntes tomados durante la reunión (temas conversados, descargos del entrevistado, observaciones del profesor)..."></textarea>
            </div>

            <button class="btn btn-primary mb-3" onclick="window.ConsultasProfesoresView.generarActaEntrevistaIA()">📋 Generar y Redactar Acta de Entrevista con IA</button>

            <div id="entrevista-resultado" style="display:none; margin-top: 1rem; background: #f8fafc; border: 1px solid #cbd5e1; padding: 1.5rem; border-radius: 8px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.5rem;">
                <h4 style="margin:0;">Acta Oficial de Entrevista:</h4>
                <button class="btn btn-sm btn-outline-secondary" onclick="window.ConsultasProfesoresView.copiarCorreoFormateado('entrevista-texto-res')">📋 Copiar Acta</button>
              </div>
              <div id="entrevista-texto-res" style="background:white; border: 1px solid #cbd5e1; padding: 1rem; border-radius: 6px; font-family: inherit; font-size: 0.95rem; line-height: 1.6; color: var(--text-primary); min-height: 200px; white-space: pre-wrap;"></div>
            </div>
          </div>
        </div>

        <!-- Pestaña 4: Reporte Estudiante IA -->
        <div id="tab-reporte-estudiante" class="ia-tab-content" style="display: ${savedTab === 'tab-reporte-estudiante' ? 'block' : 'none'};">
          <div class="card p-4">
            <h3 style="margin-top:0; color: var(--primary); display: inline-flex; align-items: center; gap: 0.5rem;">${Icons.get('bar-chart-3', 20)} Reporte de Trayectoria Escolar con IA</h3>
            <p class="text-secondary" style="margin-bottom: 1.5rem;">Genera un reporte cualitativo consolidado sobre la conducta, asistencia y compromisos del alumno.</p>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
              <div>
                <label class="form-label" style="font-weight:600;">Selecciona Curso:</label>
                <select id="rep-estudiante-curso" class="form-control" onchange="window.ConsultasProfesoresView.onCursoReporteChange(this.value)">
                  <option value="">-- Todos los Cursos --</option>
                </select>
              </div>
              <div>
                <label class="form-label" style="font-weight:600;">Selecciona Estudiante:</label>
                <select id="rep-estudiante-select" class="form-control" onchange="window.ConsultasProfesoresView.onEstudianteReporteChange(this.value)">
                  <option value="">-- Primero selecciona un curso --</option>
                </select>
              </div>
              <div>
                <label class="form-label" style="font-weight:600;">Alcance del Reporte:</label>
                <select id="rep-estudiante-alcance" class="form-control" onchange="document.getElementById('rep-estudiante-anios-custom').style.display = (this.value === 'seleccionados' ? 'block' : 'none');">
                  <option value="actual" selected>Año Escolar Actual (${Storage.getActiveYear()})</option>
                  <option value="seleccionados">Años Específicos...</option>
                  <option value="completo">Trayectoria Completa (Todos los Años)</option>
                </select>
              </div>
            </div>

            <div id="rep-estudiante-anios-custom" style="display: none; margin-bottom: 1.5rem; background: var(--bg-hover); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color);">
              <label class="form-label" style="font-weight:600; display: block; margin-bottom: 0.5rem;">Selecciona los Años a Incluir:</label>
              <div style="display: flex; gap: 1.5rem;">
                <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: 500;"><input type="checkbox" class="rep-est-anio-chk" value="2024"> 2024</label>
                <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: 500;"><input type="checkbox" class="rep-est-anio-chk" value="2025" checked> 2025</label>
                <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: 500;"><input type="checkbox" class="rep-est-anio-chk" value="2026" checked> 2026</label>
              </div>
            </div>

            <button class="btn btn-primary" onclick="window.ConsultasProfesoresView.generarReporteEstudianteIA()" style="font-weight:700; display: inline-flex; align-items: center; gap: 0.5rem;">${Icons.get('sparkles', 16)} Generar Reporte con IA</button>

            <!-- Contenedor del Resultado -->
            <div id="rep-estudiante-resultado" style="display:none; margin-top: 1.5rem; background: var(--bg-hover); border: 1px solid var(--border-color); padding: 1.5rem; border-radius: 8px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                <h4 style="margin:0; color: var(--primary);">Informe de Trayectoria Escolar IA:</h4>
                <button class="btn btn-sm btn-outline-secondary" onclick="window.ConsultasProfesoresView.copiarAlPortapapeles('rep-estudiante-texto-res')">📋 Copiar Reporte</button>
              </div>
              <div id="rep-estudiante-texto-res" style="background:white; color: var(--text-primary); border: 1px solid var(--border-color); padding: 1.25rem; border-radius: 6px; font-family: inherit; font-size: 0.95rem; line-height: 1.6; min-height: 250px; white-space: pre-wrap;"></div>
            </div>
          </div>
        </div>

        <!-- Pestaña 5: Reporte Funcionario IA -->
        <div id="tab-reporte-funcionario" class="ia-tab-content" style="display: ${savedTab === 'tab-reporte-funcionario' ? 'block' : 'none'};">
          <div class="card p-4">
            <h3 style="margin-top:0; color: var(--primary); display: inline-flex; align-items: center; gap: 0.5rem;">${Icons.get('briefcase', 20)} Reporte de Desempeño del Funcionario con IA</h3>
            <p class="text-secondary" style="margin-bottom: 1.5rem;">Genera un consolidado analítico de la labor del docente, permisos, jefaturas y registros históricos en la plataforma.</p>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
              <div>
                <label class="form-label" style="font-weight:600;">Selecciona Funcionario:</label>
                <select id="rep-funcionario-select" class="form-control" onchange="window.ConsultasProfesoresView.onFuncionarioReporteChange(this.value)">
                  <option value="">-- Selecciona Funcionario --</option>
                </select>
              </div>
              <div>
                <label class="form-label" style="font-weight:600;">Alcance del Reporte:</label>
                <select id="rep-funcionario-alcance" class="form-control" onchange="document.getElementById('rep-funcionario-anios-custom').style.display = (this.value === 'seleccionados' ? 'block' : 'none');">
                  <option value="actual" selected>Año Escolar Actual (${Storage.getActiveYear()})</option>
                  <option value="seleccionados">Años Específicos...</option>
                  <option value="completo">Historial Completo (Todos los Años)</option>
                </select>
              </div>
            </div>

            <div id="rep-funcionario-anios-custom" style="display: none; margin-bottom: 1.5rem; background: var(--bg-hover); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color);">
              <label class="form-label" style="font-weight:600; display: block; margin-bottom: 0.5rem;">Selecciona los Años a Incluir:</label>
              <div style="display: flex; gap: 1.5rem;">
                <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: 500;"><input type="checkbox" class="rep-func-anio-chk" value="2024"> 2024</label>
                <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: 500;"><input type="checkbox" class="rep-func-anio-chk" value="2025" checked> 2025</label>
                <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: 500;"><input type="checkbox" class="rep-func-anio-chk" value="2026" checked> 2026</label>
              </div>
            </div>

            <button class="btn btn-primary" onclick="window.ConsultasProfesoresView.generarReporteFuncionarioIA()" style="font-weight:700; display: inline-flex; align-items: center; gap: 0.5rem;">${Icons.get('sparkles', 16)} Generar Reporte con IA</button>

            <!-- Contenedor del Resultado -->
            <div id="rep-funcionario-resultado" style="display:none; margin-top: 1.5rem; background: var(--bg-hover); border: 1px solid var(--border-color); padding: 1.5rem; border-radius: 8px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                <h4 style="margin:0; color: var(--primary);">Informe de Desempeño IA:</h4>
                <button class="btn btn-sm btn-outline-secondary" onclick="window.ConsultasProfesoresView.copiarAlPortapapeles('rep-funcionario-texto-res')">📋 Copiar Reporte</button>
              </div>
              <div id="rep-funcionario-texto-res" style="background:white; color: var(--text-primary); border: 1px solid var(--border-color); padding: 1.25rem; border-radius: 6px; font-family: inherit; font-size: 0.95rem; line-height: 1.6; min-height: 250px; white-space: pre-wrap;"></div>
            </div>
          </div>
        </div>

      </div>
    `;

    if (!container) return;
    container.innerHTML = html;
    
    setTimeout(() => {
      this.cargarOpcionesDocumentos();
      this.cargarCursosEntrevista();
      this.cargarCursosReporte();
      this.cargarEstudiantesReporte();
      this.cargarFuncionariosReporte();
      restaurarHistorialChat();
      _restaurarReporteEstudiante();
      _restaurarReporteFuncionario();
      
      let savedTab = '';
      try {
        savedTab = localStorage.getItem('barita_active_ia_tab');
      } catch (_e) {}

      if (savedTab && ['tab-chatbot', 'tab-correos', 'tab-entrevistas', 'tab-reporte-estudiante', 'tab-reporte-funcionario'].includes(savedTab)) {
        switchTab(savedTab);
      }

      const input = document.getElementById('chat-input');
      if (input) input.focus();
    }, 100);
  }

  function cargarOpcionesDocumentos() {
    const selector = document.getElementById('chat-doc-selector');
    if (!selector) return;

    const documentos = (typeof Storage !== 'undefined' && Storage.getDocumentos) ? Storage.getDocumentos() : [];
    const activeSchool = (typeof Storage !== 'undefined' && Storage.activeSchool) ? Storage.activeSchool : 'demo';
    const docsColegio = documentos.filter(d => (d.colegioId || d.colegio_id || 'demo') === activeSchool);

    let html = `<option value="TODOS">Todos los Documentos del Colegio (${docsColegio.length})</option>`;
    docsColegio.forEach(d => {
      html += `<option value="${d.id}">📄 ${d.nombre}</option>`;
    });

    selector.innerHTML = html;

    const savedDoc = sessionStorage.getItem('barita_selected_chat_doc');
    if (savedDoc && (savedDoc === 'TODOS' || docsColegio.some(d => String(d.id) === String(savedDoc)))) {
      selector.value = savedDoc;
    }
  }

  function onDocumentChange(val) {
    try { sessionStorage.setItem('barita_selected_chat_doc', val); } catch (_e) {}
    App.showToast(`Contexto fijado en: ${val === 'TODOS' ? 'Todos los documentos del colegio' : 'Documento seleccionado'}`, 'info');
  }

  let historialConversacionMemory = [];
  let timerInactividadCierre = null;

  function reiniciarTimerInactividad() {
    if (timerInactividadCierre) clearTimeout(timerInactividadCierre);
  }

  async function ejecutarCierreInactividad() {
    // Desactivado según reglas de Bambino: eliminar mensajes automáticos de inactividad
    return;
  }

  async function enviarPregunta() {
    reiniciarTimerInactividad();
    const input = document.getElementById('chat-input');
    const btn = document.getElementById('btn-enviar-chat');
    const history = document.getElementById('chat-history');
    const docSelector = document.getElementById('chat-doc-selector');
    const pregunta = input.value.trim();
    if (!pregunta) return;

    // Fase 3: permitir proxy con GEMINI_API_KEY en Vercel Env o temp sessionStorage
    const hasTemp = (()=>{ try{ return !!sessionStorage.getItem('barita_gemini_key_temp'); } catch(_e){ return false; } })();
    if (!hasTemp) { /* proxy Vercel Env se encarga */ }

    input.value = '';
    input.disabled = true;
    btn.disabled = true;

    history.innerHTML += `
      <div style="align-self: flex-end; max-width: 80%; background: var(--primary); color: white; padding: 1rem; border-radius: 12px; border-top-right-radius: 2px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
        ${_escapeHtml(pregunta)}
      </div>
    `;
    scrollToBottom();

    const loaderId = 'loader-' + Date.now();
    history.innerHTML += `
      <div id="${loaderId}" style="align-self: flex-start; max-width: 80%; background: white; padding: 1rem; border-radius: 12px; border-top-left-radius: 2px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); font-style: italic; color: var(--primary); display: flex; align-items: center; gap: 8px;">
        <span style="display: inline-block; animation: spin 1s linear infinite;">⚡</span> 👦 Consultando RICE 2026...
      </div>
    `;
    scrollToBottom();

    try {
      const docSelected = docSelector ? docSelector.value : 'TODOS';
      let promptFinal = pregunta;
      let citasInfo = [];
      let ragRes = null;

      if (typeof DocumentRAGEngine !== 'undefined') {
        ragRes = DocumentRAGEngine.prepararPromptConContexto(pregunta, {
          docId: docSelected !== 'TODOS' ? docSelected : null
        });
      }

      // 3. Si Documentos Cargados del Colegio == 0
      if (ragRes && ragRes.hasDocuments === false) {
        const loaderDiv = document.getElementById(loaderId);
        if (loaderDiv) {
          loaderDiv.innerHTML = `<strong>👦 Bambino</strong><br>${_escapeHtml(ragRes.noDocsMessage)}`;
          loaderDiv.style.fontStyle = 'normal';
          loaderDiv.style.color = 'inherit';
          persistirHistorialChat();
        }
        return;
      }

      if (ragRes) {
        promptFinal = ragRes.prompt;
        citasInfo = ragRes.citasInfo || [];
      }

      // Cache de sesión rápido para preguntas idénticas
      const cacheKey = `bambino_cache_${hashPregunta(pregunta.trim().toLowerCase())}_${docSelected}`;
      let respuestaRaw = '';
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) respuestaRaw = cached;
      } catch (_e) {}

      if (!respuestaRaw) {
        // Incluir memoria previa del diálogo si existe
        let memoriaPrevias = '';
        if (historialConversacionMemory.length > 0) {
          memoriaPrevias = `\n[HISTORIAL DE DIÁLOGO EN ESTA SESIÓN]:\n` + 
            historialConversacionMemory.slice(-6).map(m => `${m.role === 'user' ? 'Usuario' : 'Bambino'}: ${m.content}`).join('\n') + '\n\n';
        }

        const schoolName = (ragRes && ragRes.colegioNombre) ? ragRes.colegioNombre : 'el establecimiento';

        respuestaRaw = await AIClient.call(
          `Eres Bambino, el asistente oficial de convivencia y normativas para ${schoolName}. Responde basándote en los documentos cargados para este colegio. 
          
          REGLAS DE VELOCIDAD Y CONCISIÓN:
          - Sé directo, formal, empático y estructurado. Entrega de inmediato los pasos o la norma sin introducciones largas ni rodeos.
          
          REGLAS DE INTERACCIÓN Y CONTRA-PREGUNTAS:
          - Si la consulta original es amplia, vaga o ambigua y requieres de mayor contexto (por ejemplo: si es básica o media, el nivel de gravedad, la implicancia de un protocolo RICE específico, etc.) para responder correctamente, haz una o dos contrapreguntas breves, muy claras y amigables.
          - LIMITANTE DE TURNOS: Puedes hacer contrapreguntas aclaratorias un MÁXIMO DE 4 VECES en total durante la conversación. Si ya has hecho 4 preguntas (revisa el historial de diálogo) o si ya cuentas con el contexto suficiente antes de ese límite, debes obligatoriamente entregar la respuesta completa y estructurada basada en los reglamentos y protocolos oficiales.
          - REGLA DE NO-METANARRATIVA: Nunca expliques al usuario que has alcanzado el límite de preguntas, ni des introducciones aclaratorias sobre los límites del sistema (por ejemplo, omitir frases como "Como hemos alcanzado el límite de preguntas..."). Entrega la respuesta directamente y de forma fluida.
          - FORMATO DE RESPUESTA: Separa cada punto numerado (ej. 1., 2., 3.) con un salto de línea adicional doble (dejando un renglón en blanco entre puntos) para que la lectura sea limpia y espaciada.`,
          memoriaPrevias + promptFinal
        );

        try {
          if (respuestaRaw) sessionStorage.setItem(cacheKey, respuestaRaw);
        } catch (_e) {}
      }

      historialConversacionMemory.push({ role: 'user', content: pregunta });
      historialConversacionMemory.push({ role: 'assistant', content: respuestaRaw });

      const loaderDiv = document.getElementById(loaderId);
      if (loaderDiv) {
        let textFormatted = _escapeHtml(respuestaRaw)
          .replace(/\n\n/g, '<br><br>')
          .replace(/\n/g, '<br>')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>');

        let footerCitas = '';
        if (citasInfo.length > 0 && !textFormatted.toLowerCase().includes('fuente consultada')) {
          footerCitas = `<div style="margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px dashed var(--border-color); font-size: 0.75rem; color: var(--text-secondary);">📌 <b>${citasInfo.join(', ')}</b></div>`;
        }

        loaderDiv.innerHTML = `<strong>👦 Bambino</strong><br>${textFormatted}${footerCitas}`;
        loaderDiv.style.fontStyle = 'normal';
        loaderDiv.style.color = 'inherit';

        persistirHistorialChat();
      }
    } catch (err) {
      const loaderDiv = document.getElementById(loaderId);
      if (loaderDiv) {
        loaderDiv.innerHTML = `<span style="color: var(--danger);">⚠️ ${err.message || 'Error al conectar con Bambino.'}</span>`;
        loaderDiv.style.fontStyle = 'normal';
      }
    } finally {
      input.disabled = false;
      btn.disabled = false;
      input.focus();
      scrollToBottom();
    }
  }

  function persistirHistorialChat() {
    const history = document.getElementById('chat-history');
    if (history) {
      try { sessionStorage.setItem('barita_chat_history_html', history.innerHTML); } catch (_e) {}
    }
  }

  function restaurarHistorialChat() {
    const history = document.getElementById('chat-history');
    if (history) {
      try {
        const saved = sessionStorage.getItem('barita_chat_history_html');
        if (saved) {
          history.innerHTML = saved;
          scrollToBottom();
        }
      } catch (_e) {}
    }
  }

  function scrollToBottom() {
    const history = document.getElementById('chat-history');
    if (history) {
      history.scrollTop = history.scrollHeight;
    }
  }

  function hashPregunta(texto) {
    let h = 0;
    for (let i = 0; i < texto.length; i++) h = ((h << 5) - h) + texto.charCodeAt(i);
    return Math.abs(h).toString(16);
  }

  function switchTab(tabId, btnElement) {
    document.querySelectorAll('.ia-tab-content').forEach(el => el.style.display = 'none');
    const target = document.getElementById(tabId);
    if (target) target.style.display = 'block';

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.style.borderBottom = '3px solid transparent';
      btn.style.color = 'var(--text-secondary)';
      btn.classList.remove('active');
    });

    let btnToActivate = btnElement;
    if (!btnToActivate && target) {
      btnToActivate = document.querySelector(`button[onclick*="${tabId}"]`);
    }

    if (btnToActivate) {
      btnToActivate.style.borderBottom = '3px solid var(--primary)';
      btnToActivate.style.color = 'var(--primary)';
      btnToActivate.classList.add('active');
    }

    try {
      localStorage.setItem('barita_active_ia_tab', tabId);
    } catch (_e) {}
  }

  async function generarCorreoIA() {
    const borrador = document.getElementById('correo-borrador').value.trim();
    const resBox = document.getElementById('correo-resultado');
    const txtRes = document.getElementById('correo-texto-res');

    if (!borrador) {
      App.showToast('Por favor escribe o pega el borrador de tu correo.', 'warning');
      return;
    }

    txtRes.innerHTML = '✍️ Perfeccionando redacción e inyectando misión/visión del colegio con IA...';
    resBox.style.display = 'block';

    let contextoInstitucional = '';
    if (typeof DocumentRAGEngine !== 'undefined') {
      const ragMision = DocumentRAGEngine.buscarExtractos('misión visión valores institucionales convivencia', { maxChunks: 2 });
      if (ragMision && ragMision.length > 0) {
        contextoInstitucional = ragMision.map(m => m.contenido).join('\n');
      }
    }

    // Obtener datos del usuario activo para la firma dinámica
    let userName = 'Docente / Funcionario';
    let userRole = 'Equipo Docente';
    if (typeof Auth !== 'undefined' && Auth.currentUser) {
      userName = Auth.currentUser.displayName || Auth.currentUser.nombre || Auth.currentUser.email || userName;
      userRole = Auth.currentUser.rol || Auth.currentUser.cargo || userRole;
    } else if (typeof Storage !== 'undefined' && Storage.cache && Storage.cache.config && Storage.cache.config.userProfile) {
      userName = Storage.cache.config.userProfile.nombre || userName;
      userRole = Storage.cache.config.userProfile.cargo || userRole;
    }

    const systemPrompt = `ROL Y OBJETIVO:
Eres el Redactor Profesional de Correos de la Escuela Terra di Bimbi. Tu función es transformar borradores en comunicados breves, cálidos, empáticos y respetuosos, alineados con los valores de Sabiduría, Verdad y Amor.

REGLAS DE REDACCIÓN:
1. BREVEDAD Y CERCANÍA:
   - Mantén un tono directo, cercano, familiar y amable, evitando rodeos innecesarios o un lenguaje excesivamente burocrático.
   - Ve al grano con empatía y respeto.

2. RESTRICCIÓN DE DATOS DE CONTACTO Y TÉRMINOS ESPECÍFICOS:
   - NO incluyas números telefónicos, direcciones físicas ni correos electrónicos específicos dentro del cuerpo del mensaje.
   - NO uses la palabra "libreta" ni "libreta de comunicaciones".
   - Referirse SIEMPRE a la coordinación o contacto mediante "canales institucionales oficiales" o "vías institucionales habituales".
   - NO inventes fechas u horas si el borrador no las especifica; usa marcas entre corchetes en negrita (ej: **[indicar fecha] a las [indicar hora] hrs**).

3. ESTRUCTURA Y DATOS CLAVE EN NEGRITA:
   - Línea 1: Asunto: **[Asunto claro y profesional]**
   - Línea 2: [Línea en blanco]
   - Mensaje y datos clave resaltados en **negrita**.

4. FIRMA DINÁMICA DE LA SESIÓN:
   - Finaliza obligatoriamente el comunicado con la siguiente estructura de firma:
     ${userName}
     ${userRole}
     Escuela Terra di Bimbi`;

    const userPrompt = `${contextoInstitucional ? 'VALORES Y VISIÓN DEL COLEGIO:\n' + contextoInstitucional + '\n\n' : ''}BORRADOR DEL USUARIO:\n${borrador}\n\nINSTRUCCIÓN: Transforma el borrador en un comunicado cálido, breve y respetuoso según las reglas. Incluye la firma dinámica de ${userName} (${userRole}).`;

    try {
      const res = await AIClient.call(systemPrompt, userPrompt);
      
      let htmlFormatted = _escapeHtml(res)
        .replace(/&lt;strong&gt;(.*?)&lt;\/strong&gt;/gi, '<strong>$1</strong>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>');

      txtRes.innerHTML = htmlFormatted;
    } catch (err) {
      txtRes.innerHTML = "<span style='color:red;'>Error al generar el correo: " + err.message + "</span>";
    }
  }

  function copiarCorreoFormateado(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const textToCopy = el.innerText || el.textContent;
    navigator.clipboard.writeText(textToCopy).then(() => {
      App.showToast('Correo copiado al portapapeles con formato', 'success');
    }).catch(() => {
      App.showToast('No se pudo copiar el texto', 'danger');
    });
  }

  // === LÓGICA DE DINÁMICA DE SELECCIÓN DE ENTREVISTAS (Funcionario vs Escolar) ===
  function onCategoriaEntrevistaChange(cat) {
    const groupEscolarTipo = document.getElementById('entrevista-group-escolar-tipo');
    const groupCurso = document.getElementById('entrevista-group-curso');
    const groupPersonaEscolar = document.getElementById('entrevista-group-persona-escolar');
    const groupFuncionario = document.getElementById('entrevista-group-funcionario');

    if (cat === 'funcionario') {
      if (groupEscolarTipo) groupEscolarTipo.style.display = 'none';
      if (groupCurso) groupCurso.style.display = 'none';
      if (groupPersonaEscolar) groupPersonaEscolar.style.display = 'none';
      if (groupFuncionario) groupFuncionario.style.display = 'block';
      cargarFuncionariosEntrevista();
    } else {
      if (groupEscolarTipo) groupEscolarTipo.style.display = 'block';
      if (groupCurso) groupCurso.style.display = 'block';
      if (groupPersonaEscolar) groupPersonaEscolar.style.display = 'block';
      if (groupFuncionario) groupFuncionario.style.display = 'none';
      cargarCursosEntrevista();
    }
  }

  function onSubtipoEscolarChange() {
    const subtipo = document.getElementById('entrevista-subtipo-escolar')?.value || 'estudiante';
    const label = document.getElementById('entrevista-label-persona');
    if (label) {
      label.innerText = subtipo === 'apoderado' ? 'Seleccionar Apoderado' : 'Seleccionar Estudiante';
    }
    cargarParticipantesEntrevista();
  }

  function cargarCursosEntrevista() {
    const selectCurso = document.getElementById('entrevista-curso');
    if (!selectCurso) return;

    let cursos = (typeof Storage !== 'undefined' && Storage.getCursos) ? Storage.getCursos() : [];
    if (cursos.length === 0) {
      // Fallback desde lista de estudiantes
      const ests = (typeof Storage !== 'undefined' && Storage.getEstudiantes) ? Storage.getEstudiantes() : [];
      cursos = [...new Set(ests.map(e => e.curso).filter(Boolean))].map(c => ({ id: c, nombre: c }));
    }

    let html = '<option value="">-- Selecciona un curso --</option>';
    cursos.forEach(c => {
      const val = c.nombre || c.id || c;
      html += `<option value="${_escapeHtml(val)}">${_escapeHtml(val)}</option>`;
    });
    selectCurso.innerHTML = html;
  }

  function cargarParticipantesEntrevista() {
    const selectCurso = document.getElementById('entrevista-curso');
    const selectPersona = document.getElementById('entrevista-persona-escolar');
    const subtipo = document.getElementById('entrevista-subtipo-escolar')?.value || 'estudiante';
    if (!selectCurso || !selectPersona) return;

    const curso = selectCurso.value;
    if (!curso) {
      selectPersona.innerHTML = '<option value="">-- Primero selecciona un curso --</option>';
      return;
    }

    let estudiantes = (typeof Storage !== 'undefined' && Storage.getEstudiantes) ? Storage.getEstudiantes() : [];
    estudiantes = estudiantes.filter(e => String(e.curso).toLowerCase() === String(curso).toLowerCase());

    if (estudiantes.length === 0) {
      selectPersona.innerHTML = '<option value="">No hay registros en este curso</option>';
      return;
    }

    let html = '<option value="">-- Seleccionar --</option>';
    estudiantes.forEach(e => {
      if (subtipo === 'apoderado') {
        const apoNombre = e.apoderado || e.apoderado_nombre || `Apoderado/a de ${e.nombres} ${e.apellidos}`;
        html += `<option value="${_escapeHtml(apoNombre)} (${_escapeHtml(e.nombres)} ${_escapeHtml(e.apellidos)})">${_escapeHtml(apoNombre)} (Apoderado/a de ${_escapeHtml(e.nombres)} ${_escapeHtml(e.apellidos)})</option>`;
      } else {
        const estNombre = `${e.nombres} ${e.apellidos}`;
        html += `<option value="${_escapeHtml(estNombre)}">${_escapeHtml(estNombre)}</option>`;
      }
    });
    selectPersona.innerHTML = html;
  }

  function cargarFuncionariosEntrevista() {
    const selectFunc = document.getElementById('entrevista-funcionario');
    if (!selectFunc) return;

    let funcs = (typeof Storage !== 'undefined' && Storage.getFuncionarios) ? Storage.getFuncionarios() : [];
    if (funcs.length === 0) {
      selectFunc.innerHTML = '<option value="Funcionario / Docente">Funcionario / Docente del Colegio</option>';
      return;
    }

    let html = '<option value="">-- Seleccionar funcionario --</option>';
    funcs.forEach(f => {
      const nombre = f.nombre || `${f.nombres || ''} ${f.apellidos || ''}`.trim() || f.email;
      const cargo = f.cargo || f.rol || 'Funcionario';
      html += `<option value="${_escapeHtml(nombre)} (${_escapeHtml(cargo)})">${_escapeHtml(nombre)} - ${_escapeHtml(cargo)}</option>`;
    });
    selectFunc.innerHTML = html;
  }

  async function generarActaEntrevistaIA() {
    const cat = document.getElementById('entrevista-categoria')?.value || 'escolar';
    const subtipo = document.getElementById('entrevista-subtipo-escolar')?.value || 'estudiante';
    const curso = document.getElementById('entrevista-curso')?.value || '';
    const personaEscolar = document.getElementById('entrevista-persona-escolar')?.value || '';
    const funcionario = document.getElementById('entrevista-funcionario')?.value || '';
    const motivo = document.getElementById('entrevista-motivo')?.value.trim() || '';
    const apuntes = document.getElementById('entrevista-apuntes')?.value.trim() || '';

    const resBox = document.getElementById('entrevista-resultado');
    const txtRes = document.getElementById('entrevista-texto-res');

    if (!motivo && !apuntes) {
      App.showToast('Por favor ingresa el motivo o los apuntes de la entrevista.', 'warning');
      return;
    }

    txtRes.innerHTML = '📋 Generando y perfeccionando el Acta de Entrevista con RICE e IA...';
    resBox.style.display = 'block';

    // Obtener fecha y hora exacta del sistema en el momento de generar
    const ahora = new Date();
    const fechaHoraStr = ahora.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + ' a las ' + ahora.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) + ' hrs';

    // Identificar entrevistado
    let entrevistadoStr = '';
    if (cat === 'funcionario') {
      entrevistadoStr = funcionario || 'Funcionario / Docente del Establecimiento';
    } else {
      if (personaEscolar) {
        entrevistadoStr = `${personaEscolar} ${curso ? '(Curso: ' + curso + ')' : ''}`;
      } else {
        entrevistadoStr = `${subtipo === 'apoderado' ? 'Apoderado' : 'Estudiante'} ${curso ? '(Curso: ' + curso + ')' : ''}`;
      }
    }

    // Consultar extractos del RICE para acuerdos proporcionales
    let extractosRice = '';
    if (typeof DocumentRAGEngine !== 'undefined') {
      const ragRice = DocumentRAGEngine.buscarExtractos(motivo + ' ' + apuntes, { maxChunks: 2 });
      if (ragRice && ragRice.length > 0) {
        extractosRice = ragRice.map(r => r.contenido).join('\n');
      }
    }

    const systemPrompt = `Eres el Ministro de Fe y Asistente Técnico de Convivencia Escolar.
REGLAS STRICTAS DE GENERACIÓN DE ACTA DE ENTREVISTA:
1. FORMATO OBLIGATORIO DE SALIDA (Usa saltos de línea normales sin escribir códigos HTML como <br>):
   ACTA OFICIAL DE ENTREVISTA INSTITUCIONAL

   Fecha y Hora: ${fechaHoraStr}
   Entrevistado/a: ${entrevistadoStr}
   Motivo: ${motivo || 'Entrevista de seguimiento / orientación'}

   Desarrollo de la Entrevista:
   [Mejora la redacción de los apuntes del usuario de forma profesional, clara, objetiva y sin faltas de ortografía]

   Acuerdos y Compromisos RICE:
   [Formula de 2 a 4 acuerdos concretos, proporcionales y fundamentados en la convivencia escolar y RICE del colegio]

2. Usa marcas de asteriscos marcando en negrita **títulos y datos clave** (ej: **Fecha y Hora:**).
3. TONO FORMAL, IMPARCIAL Y PEDAGÓGICO.`;

    const userPrompt = `${extractosRice ? 'MARCO NORMATIVO RICE DEL COLEGIO:\n' + extractosRice + '\n\n' : ''}APUNTES EN BRUTO DE LA ENTREVISTA:\n${apuntes || 'Sin apuntes detallados, generar desarrollo en base al motivo.'}\n\nINSTRUCCIÓN: Redacta el Acta Oficial de Entrevista siguiendo estrictamente el formato, usando negritas **asteriscos** para datos clave y proponiendo acuerdos proporcionales al RICE.`;

    try {
      const res = await AIClient.call(systemPrompt, userPrompt);
      
      let htmlFormatted = _escapeHtml(res)
        .replace(/&lt;br\s*\/?&gt;/gi, '<br>')
        .replace(/&lt;strong&gt;(.*?)&lt;\/strong&gt;/gi, '<strong>$1</strong>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>');

      txtRes.innerHTML = htmlFormatted;
    } catch (err) {
      txtRes.innerHTML = "<span style='color:red;'>Error al generar el acta de entrevista: " + err.message + "</span>";
    }
  }

  async function generarPlanClaseIA() {
    const curso = document.getElementById('plan-curso').value.trim();
    const oaAnterior = document.getElementById('plan-oa-anterior').value.trim();
    const oaHoy = document.getElementById('plan-oa-hoy').value.trim();
    const sugerencias = document.getElementById('plan-sugerencias').value.trim();
    const resBox = document.getElementById('plan-resultado');
    const txtRes = document.getElementById('plan-texto-res');

    if (!oaHoy) {
      App.showToast('Por favor indica el Objetivo de Aprendizaje a trabajar hoy.', 'warning');
      return;
    }

    txtRes.value = '🚀 Diseñando clase con IA...';
    resBox.style.display = 'block';

    const prompt = `Diseña una planificación de clase estructurada para:
    Curso / Asignatura: ${curso || 'Educación General'}
    Objetivo Clase Anterior: ${oaAnterior || 'Continuidad temática'}
    Objetivo de Hoy (OA): ${oaHoy}
    Sugerencias / Adaptaciones: ${sugerencias || 'Sin sugerencias específicas'}

    Estructura la respuesta exactamente en:
    1. INICIO (15 min): Motivación, activación de conocimientos previos y presentación del objetivo.
    2. DESARROLLO (60 min): Actividades centrales paso a paso y monitoreo.
    3. CIERRE (15 min): Síntesis, evaluación formativa o ticket de salida.
    4. SUGERENCIAS PEDAGÓGICAS Y ADAPTACIONES DIVERSIFICADAS.`;

    try {
      const res = await AIClient.call("Eres un asesor técnico pedagógico (UTP) experto en currículum escolar chileno.", prompt);
      txtRes.value = res;
    } catch (err) {
      txtRes.value = "Error al generar la planificación: " + err.message;
    }
  }

  function copiarAlPortapapeles(idElemento) {
    const el = document.getElementById(idElemento);
    if (!el) return;
    const textToCopy = el.value !== undefined ? el.value : (el.innerText || el.textContent);
    navigator.clipboard.writeText(textToCopy).then(() => {
      App.showToast('Copiado al portapapeles exitosamente', 'success');
    }).catch(() => {
      if (el.select) el.select();
      else {
        const range = document.createRange();
        range.selectNode(el);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
      }
      document.execCommand('copy');
      App.showToast('Copiado al portapapeles exitosamente', 'success');
    });
  }

  function cargarEstudiantesReporte(cursoId = '') {
    const selector = document.getElementById('rep-estudiante-select');
    if (!selector) return;

    let estudiantes = (typeof Storage !== 'undefined' && Storage.getEstudiantes) ? Storage.getEstudiantes() : [];
    if (cursoId) {
      estudiantes = estudiantes.filter(e => String(e.curso).toLowerCase() === String(cursoId).toLowerCase());
    }
    
    // Sort students by names/apellidos
    estudiantes.sort((a, b) => `${a.apellidos} ${a.nombres}`.localeCompare(`${b.apellidos} ${b.nombres}`));

    let html = '<option value="">-- Selecciona Estudiante --</option>';
    if (estudiantes.length === 0) {
      html = '<option value="">No hay estudiantes en este curso</option>';
    } else {
      estudiantes.forEach(e => {
        const curso = DATA.getCurso(e.curso);
        const cursoNombre = curso ? curso.nombre : (e.curso || 'Sin curso');
        html += `<option value="${e.id}">${e.apellidos}, ${e.nombres} (${cursoNombre})</option>`;
      });
    }

    selector.innerHTML = html;
  }

  function cargarCursosReporte() {
    const selector = document.getElementById('rep-estudiante-curso');
    if (!selector) return;

    let cursos = (typeof Storage !== 'undefined' && Storage.getCursos) ? Storage.getCursos() : [];
    if (cursos.length === 0) {
      const ests = (typeof Storage !== 'undefined' && Storage.getEstudiantes) ? Storage.getEstudiantes() : [];
      cursos = [...new Set(ests.map(e => e.curso).filter(Boolean))].map(c => ({ id: c, nombre: c }));
    }

    let html = '<option value="">-- Todos los Cursos --</option>';
    cursos.forEach(c => {
      const val = c.nombre || c.id || c;
      const id = c.id || c.nombre || c;
      html += `<option value="${id}">${val}</option>`;
    });
    selector.innerHTML = html;
  }

  function onCursoReporteChange(cursoId) {
    try {
      localStorage.setItem('barita_rep_est_curso_id', cursoId);
    } catch (_e) {}
    cargarEstudiantesReporte(cursoId);
  }

  function onEstudianteReporteChange(estId) {
    try {
      localStorage.setItem('barita_rep_est_id', estId);
    } catch (_e) {}
  }

  function onFuncionarioReporteChange(funcId) {
    try {
      localStorage.setItem('barita_rep_func_id', funcId);
    } catch (_e) {}
  }

  function cargarFuncionariosReporte() {
    const selector = document.getElementById('rep-funcionario-select');
    if (!selector) return;

    const funcionarios = (typeof Storage !== 'undefined' && Storage.getFuncionarios) ? Storage.getFuncionarios() : [];
    funcionarios.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

    let html = '<option value="">-- Selecciona Funcionario --</option>';
    funcionarios.forEach(f => {
      const nombre = f.nombre || `${f.nombres || ''} ${f.apellidos || ''}`.trim() || f.email;
      const cargo = f.cargo || f.rol || 'Funcionario';
      html += `<option value="${f.id}">${nombre} (${cargo})</option>`;
    });

    selector.innerHTML = html;
  }

  async function generarReporteEstudianteIA() {
    const estId = document.getElementById('rep-estudiante-select').value;
    const alcance = document.getElementById('rep-estudiante-alcance').value;
    const resBox = document.getElementById('rep-estudiante-resultado');
    const txtRes = document.getElementById('rep-estudiante-texto-res');

    if (!estId) {
      App.showToast('Por favor selecciona un estudiante', 'warning');
      return;
    }

    // Fase 3: permitir proxy con GEMINI_API_KEY en Vercel Env o temp sessionStorage
    const hasTemp = (()=>{ try{ return !!sessionStorage.getItem('barita_gemini_key_temp'); } catch(_e){ return false; } })();
    if (!hasTemp) { /* proxy Vercel Env se encarga */ }

    txtRes.innerHTML = '📊 Consolidando historial multianual y estructurando reporte con IA...';
    resBox.style.display = 'block';

    const est = Storage.getEstudianteById(estId);
    if (!est) {
      txtRes.innerHTML = 'Error: No se encontró al estudiante.';
      return;
    }

    // Determine target years
    let targetYears = [];
    if (alcance === 'actual') {
      targetYears = [Storage.getActiveYear()];
    } else if (alcance === 'completo') {
      targetYears = ['2024', '2025', '2026'];
    } else {
      const chks = document.querySelectorAll('.rep-est-anio-chk:checked');
      targetYears = Array.from(chks).map(c => c.value);
    }

    if (targetYears.length === 0) {
      txtRes.innerHTML = 'Error: Por favor selecciona al menos un año escolar.';
      return;
    }

    // Gather history across years
    let historyText = `HISTORIAL DE TRAYECTORIA ESCOLAR:
Estudiante: ${est.nombres} ${est.apellidos}
RUT: ${est.rut || 'No registra'}
PIE: ${est.esEstudiantePIE ? 'Sí' : 'No'}
`;

    targetYears.forEach(yr => {
      const yearInt = parseInt(yr);
      const matricula = (Storage.cache.matriculas_anuales || []).find(m => m.estudiante_id === est.id && parseInt(m.anio_escolar) === yearInt);
      let cursoEst = est.curso;
      if (matricula) {
        const cObj = DATA.getCurso(matricula.curso_id);
        cursoEst = cObj ? cObj.nombre : matricula.curso_id;
      } else if (yearInt !== 2026) {
        cursoEst = 'No matriculado';
      } else {
        const cObj = DATA.getCurso(est.curso);
        cursoEst = cObj ? cObj.nombre : est.curso;
      }

      const anotaciones = Storage.getAnotacionesByEstudianteAndYear ? Storage.getAnotacionesByEstudianteAndYear(est.id, yr) : [];
      const eventos = (Storage.cache.eventos || []).filter(e => {
        const eId = String(e.estudianteId || e.estudiante_id || '').trim();
        return eId === String(est.id) && (e.fecha || '').startsWith(yr);
      });
      const atrasos = (Storage.cache.atrasos || []).filter(a => {
        const eId = String(a.estudianteId || a.estudiante_id || '').trim();
        return eId === String(est.id) && (a.fecha || '').startsWith(yr);
      });
      const absences = (Storage.cache.inasistencias || []).filter(i => {
        const eId = String(i.estudianteId || i.estudiante_id || '').trim();
        return eId === String(est.id) && (i.fecha || '').startsWith(yr);
      });
      const casos = Storage.getCasosByEstudianteAndYear ? Storage.getCasosByEstudianteAndYear(est.id, yr) : [];

      historyText += `\n--- AÑO ESCOLAR ${yr} ---
Curso: ${cursoEst}
• Inasistencias: ${absences.length}
• Atrasos: ${atrasos.length}
• Felicitaciones / Positivas: ${eventos.filter(e => e.tipo === 'positiva' || e.tipo === 'felicitacion').length}
• Anotaciones de Convivencia: ${anotaciones.length}
`;
      if (anotaciones.length > 0) {
        historyText += `  Detalle de anotaciones:\n` + anotaciones.map(a => `  - [${a.fecha}] ${a.descripcion} (Registrado por: ${a.funcionarioNombre || 'Sistema'})`).join('\n') + '\n';
      }
      if (casos.length > 0) {
        historyText += `  Casos graves registrados:\n` + casos.map(c => `  - [${c.fecha}] Motivo: ${c.motivo || c.descripcion || 'Caso grave'} (RICE Medidas Aplicadas: ${c.medidasAplicadas || 'No registra'})`).join('\n') + '\n';
      }
    });

    const systemPrompt = `ROL Y OBJETIVO:
Eres el Analista de Trayectoria Escolar con Inteligencia Artificial de la Escuela Terra di Bimbi. Tu tarea es generar un informe cualitativo, profesional, detallado y constructivo a partir de los datos históricos proporcionados del alumno.

REGLAS PARA EL REPORTE:
1. ESTRUCTURA:
   - Resumen de la Ficha del Alumno.
   - Análisis de Convivencia y Conducta (Felicitaciones vs. Anotaciones).
   - Análisis de Asistencia y Puntualidad.
   - Evaluación RICE (Si tiene casos graves, su nivel de riesgo y la pertinencia de los apoyos).
   - Recomendaciones Pedagógicas y de Acompañamiento.
2. TONO:
   - Debe ser sumamente profesional, objetivo pero empático y orientado a la mejora del estudiante (enfoque formativo).
3. FORMATO:
   - Separa secciones de forma clara con títulos.
   - NO utilices marcas temporales vacías ni inventes información. Si no hay datos negativos o positivos en algún año, indícalo de forma positiva (ej: "Sin incidentes registrados en convivencia").`;

    try {
      const res = await AIClient.call(systemPrompt, historyText);
      let htmlFormatted = _escapeHtml(res)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>');

      txtRes.innerHTML = htmlFormatted;
      // Persistir en localStorage para restaurar al volver
      try {
        localStorage.setItem('barita_rep_est_html', htmlFormatted);
        localStorage.setItem('barita_rep_est_id', estId);
        localStorage.setItem('barita_rep_est_alcance', alcance);
      } catch (_e) {}
    } catch (err) {
      txtRes.innerHTML = "<span style='color:red;'>Error al generar el reporte: " + err.message + "</span>";
    }
  }

  async function generarReporteFuncionarioIA() {
    const funcId = document.getElementById('rep-funcionario-select').value;
    const alcance = document.getElementById('rep-funcionario-alcance').value;
    const resBox = document.getElementById('rep-funcionario-resultado');
    const txtRes = document.getElementById('rep-funcionario-texto-res');

    if (!funcId) {
      App.showToast('Por favor selecciona un funcionario', 'warning');
      return;
    }

    // Fase 3: permitir proxy con GEMINI_API_KEY en Vercel Env o temp sessionStorage
    const hasTemp = (()=>{ try{ return !!sessionStorage.getItem('barita_gemini_key_temp'); } catch(_e){ return false; } })();
    if (!hasTemp) { /* proxy Vercel Env se encarga */ }

    txtRes.innerHTML = '📊 Consolidando registros históricos y estructurando reporte del funcionario...';
    resBox.style.display = 'block';

    const func = (Storage.cache.funcionarios || []).find(f => f.id === funcId);
    if (!func) {
      txtRes.innerHTML = 'Error: No se encontró al funcionario.';
      return;
    }

    // Determine target years
    let targetYears = [];
    if (alcance === 'actual') {
      targetYears = [Storage.getActiveYear()];
    } else if (alcance === 'completo') {
      targetYears = ['2024', '2025', '2026'];
    } else {
      const chks = document.querySelectorAll('.rep-func-anio-chk:checked');
      targetYears = Array.from(chks).map(c => c.value);
    }

    if (targetYears.length === 0) {
      txtRes.innerHTML = 'Error: Por favor selecciona al menos un año escolar.';
      return;
    }

    const funcionarioEmail = String(func.email || func.correo || '').toLowerCase().trim();

    // Gather history of actions registered by this official
    let historyText = `HISTORIAL DE LABOR DEL FUNCIONARIO:
Funcionario: ${func.nombre || `${func.nombres || ''} ${func.apellidos || ''}`.trim()}
Cargo/Rol: ${func.cargo || func.rol || 'No registra'}
Correo: ${funcionarioEmail || 'No registra'}
`;

    targetYears.forEach(yr => {
      const anotaciones = (Storage.cache.anotaciones || []).filter(a => {
        const aAutor = String(a.autorId || a.autor_id || a.registradoPor || '').toLowerCase().trim();
        return (aAutor === funcionarioEmail || aAutor === funcId) && String(a.fecha).startsWith(yr);
      });

      const atrasos = (Storage.cache.atrasos || []).filter(a => {
        const aAutor = String(a.funcionarioId || a.funcionarioNombre || '').toLowerCase().trim();
        return (aAutor === funcionarioEmail || aAutor === funcId) && String(a.fecha).startsWith(yr);
      });

      const cases = (Storage.cache.casos || []).filter(c => {
        const cAutor = String(c.creadoPor || c.autorId || c.funcionarioId || '').toLowerCase().trim();
        return (cAutor === funcionarioEmail || cAutor === funcId) && String(c.fecha).startsWith(yr);
      });

      historyText += `\n--- REGISTROS EN AÑO ESCOLAR ${yr} ---
• Anotaciones de Convivencia Ingresadas: ${anotaciones.length}
• Controles de Atrasos Registrados: ${atrasos.length}
• Casos Graves Derivados / Iniciados: ${cases.length}
`;
      if (anotaciones.length > 0) {
        historyText += `  Muestra de descripciones ingresadas:\n` + anotaciones.slice(0, 5).map(a => `  - [${a.fecha}] ${a.descripcion}`).join('\n') + '\n';
      }
    });

    const systemPrompt = `ROL Y OBJETIVO:
Eres el Evaluador de Desempeño y Gestión con Inteligencia Artificial de la Escuela Terra di Bimbi. Tu tarea es generar un reporte cualitativo sobre la labor registrada por el docente o funcionario en la plataforma, basado en los registros históricos proporcionados.

REGLAS PARA EL REPORTE:
1. ESTRUCTURA:
   - Resumen del Perfil del Funcionario.
   - Análisis cuantitativo y cualitativo de su participación (anotaciones registradas, atrasos controlados, derivaciones de casos).
   - Identificación de Liderazgo y Foco de Gestión (ej: si se orienta a registrar alertas, a la contención de casos graves, etc.).
   - Recomendaciones de Gestión y Apoyo de Liderazgo para el Docente.
2. TONO:
   - Profesional, propositivo, objetivo, reconociendo el esfuerzo del docente en el uso de la plataforma y el acompañamiento formativo.
3. FORMATO:
   - Limpio, estructurado, separando los temas principales con saltos de línea claros.`;

    try {
      const res = await AIClient.call(systemPrompt, historyText);
      let htmlFormatted = _escapeHtml(res)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>');

      txtRes.innerHTML = htmlFormatted;
      // Persistir en localStorage para restaurar al volver
      try {
        localStorage.setItem('barita_rep_func_html', htmlFormatted);
        localStorage.setItem('barita_rep_func_id', funcId);
        localStorage.setItem('barita_rep_func_alcance', alcance);
      } catch (_e) {}
    } catch (err) {
      txtRes.innerHTML = "<span style='color:red;'>Error al generar el reporte: " + err.message + "</span>";
    }
  }

  function _restaurarReporteEstudiante() {
    try {
      const html = localStorage.getItem('barita_rep_est_html');
      const cursoId = localStorage.getItem('barita_rep_est_curso_id') || '';
      const estId = localStorage.getItem('barita_rep_est_id');
      const alcance = localStorage.getItem('barita_rep_est_alcance');

      const selCurso = document.getElementById('rep-estudiante-curso');
      const selEst = document.getElementById('rep-estudiante-select');
      const selAlcance = document.getElementById('rep-estudiante-alcance');
      const resBox = document.getElementById('rep-estudiante-resultado');
      const txtRes = document.getElementById('rep-estudiante-texto-res');

      if (selCurso && cursoId) {
        selCurso.value = cursoId;
      }
      
      // Cargar los estudiantes filtrados por el curso antes de restaurar el valor
      cargarEstudiantesReporte(cursoId);

      if (selEst && estId) {
        selEst.value = estId;
      }
      if (selAlcance && alcance) {
        selAlcance.value = alcance;
      }

      if (html && resBox && txtRes) {
        txtRes.innerHTML = html;
        resBox.style.display = 'block';
      }
    } catch (_e) {}
  }

  function _restaurarReporteFuncionario() {
    try {
      const html = localStorage.getItem('barita_rep_func_html');
      const funcId = localStorage.getItem('barita_rep_func_id');
      const alcance = localStorage.getItem('barita_rep_func_alcance');

      const selFunc = document.getElementById('rep-funcionario-select');
      const selAlcance = document.getElementById('rep-funcionario-alcance');
      const resBox = document.getElementById('rep-funcionario-resultado');
      const txtRes = document.getElementById('rep-funcionario-texto-res');

      if (selFunc && funcId) {
        selFunc.value = funcId;
      }
      if (selAlcance && alcance) {
        selAlcance.value = alcance;
      }

      if (html && resBox && txtRes) {
        txtRes.innerHTML = html;
        resBox.style.display = 'block';
      }
    } catch (_e) {}
  }

  function _escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function _escapeForChat(text) {
    return _escapeHtml(text).replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
  }

  return {
    render,
    switchTab,
    cargarOpcionesDocumentos,
    onDocumentChange,
    enviarPregunta,
    generarCorreoIA,
    generarActaEntrevistaIA,
    onCategoriaEntrevistaChange,
    onSubtipoEscolarChange,
    cargarCursosEntrevista,
    cargarParticipantesEntrevista,
    cargarFuncionariosEntrevista,
    copiarCorreoFormateado,
    generarPlanClaseIA,
    copiarAlPortapapeles,
    scrollToBottom,
    hashPregunta,
    _escapeHtml,
    _escapeForChat,
    cargarEstudiantesReporte,
    cargarFuncionariosReporte,
    generarReporteEstudianteIA,
    generarReporteFuncionarioIA,
    cargarCursosReporte,
    onCursoReporteChange,
    onEstudianteReporteChange,
    onFuncionarioReporteChange
  };
})();

window.ConsultasProfesoresView = ConsultasProfesoresView;
