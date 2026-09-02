/* ================================================================
   utp.js — Módulo UTP (Unidad Técnico Pedagógica)
   1. Planificación de clases asistida por Inteligencia Artificial (Inicio, Desarrollo, Cierre)
   2. Monitoreo e Historial de Trabajo Pedagógico (Vinculado a Bitácora de Fiscalización)
   ================================================================ */

const UtpView = (() => {
  let currentTab = 'trabajo_pedagogico';

  function render(container) {
    App.setBreadcrumb(`UTP - Unidad Técnico Pedagógica ${typeof BaritaHelp!=='undefined'?BaritaHelp.create('utp'):''}`);

    // 1. Persistencia de Pestaña Activa
    try {
      const savedTab = localStorage.getItem('barita_active_utp_tab');
      if (savedTab && ['trabajo_pedagogico', 'planificacion_ia'].includes(savedTab)) {
        currentTab = savedTab;
      }
    } catch (_e) {}

    let html = `
      <div class="card mb-4" style="border-top: 4px solid var(--primary);">
        <div class="card-header flex justify-between items-center" style="flex-wrap: wrap; gap: 1rem;">
          <div>
            <h2 style="margin:0; color: var(--primary); display: inline-flex; align-items: center; gap: 0.5rem;">${Icons.get('graduation-cap', 24)} UTP - Unidad Técnico Pedagógica</h2>
            <p class="text-secondary" style="margin: 0.25rem 0 0 0; font-size: 0.9rem;">Gestión de Trabajo Pedagógico y Bitácora de Fiscalización Docente.</p>
          </div>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-sm ${currentTab === 'trabajo_pedagogico' ? 'btn-primary' : 'btn-secondary'}" onclick="window.UtpView.switchTab('trabajo_pedagogico')">Bitácora Docente</button>
            <button class="btn btn-sm ${currentTab === 'planificacion_ia' ? 'btn-primary' : 'btn-secondary'}" onclick="window.UtpView.switchTab('planificacion_ia')">Planificación con IA</button>
          </div>
        </div>
      </div>
    `;

    html += currentTab === 'planificacion_ia' ? renderPlanificacionIA() : renderTrabajoPedagogico();

    if (!container) return;
    container.innerHTML = html;

    if (currentTab === 'planificacion_ia') {
      setTimeout(() => {
        restaurarBorradorYPlan();
      }, 50);
    }
  }

  function switchTab(tab) {
    currentTab = tab;
    try {
      localStorage.setItem('barita_active_utp_tab', tab);
    } catch (_e) {}
    render(document.getElementById('app-content'));
  }

  function renderPlanificacionIA() {
    const cursos = typeof DATA !== 'undefined' ? DATA.cursos || [] : [];

    return `
      <div class="dashboard-grid" style="grid-template-columns: 1fr 1fr; gap: 1.5rem;">
        
        <!-- Formulario de Parámetros Pedagógicos -->
        <div class="card" style="padding: 1.5rem;">
          <div class="flex justify-between items-center mb-3">
            <h3 style="margin:0; color: var(--primary); font-size: 1.15rem; display: inline-flex; align-items: center; gap: 0.4rem;">${Icons.get('file-text', 18)} Parámetros de la Clase</h3>
            <button type="button" class="btn btn-sm btn-secondary inline-flex items-center gap-1" onclick="window.UtpView.limpiarFormularioYPlan()" title="Borrar datos y empezar de cero">
              ${Icons.get('trash-2', 14)} Limpiar / Nueva Planificación
            </button>
          </div>
          <form id="form-plan-ia" onsubmit="event.preventDefault(); window.UtpView.generarPlanificacionIA();" oninput="window.UtpView.guardarBorradorFormulario()">
            
            <div class="grid grid-2 gap-3 mb-3">
              <div class="form-group mb-0">
                <label class="form-label" style="font-weight: 600;">Curso / Nivel</label>
                <select id="plan-curso" class="form-control" required onchange="window.UtpView.guardarBorradorFormulario()">
                  <option value="">-- Seleccionar Curso --</option>
                  ${cursos.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('')}
                </select>
              </div>

              <div class="form-group mb-0">
                <label class="form-label" style="font-weight: 600;">Asignatura</label>
                <select id="plan-asignatura" class="form-control" required onchange="window.UtpView.guardarBorradorFormulario()">
                  <option value="">-- Seleccionar Asignatura --</option>
                  <option value="Lenguaje y Comunicación">Lenguaje y Comunicación</option>
                  <option value="Matemática">Matemática</option>
                  <option value="Historia, Geografía y Cs. Sociales">Historia, Geografía y Cs. Sociales</option>
                  <option value="Ciencias Naturales">Ciencias Naturales</option>
                  <option value="Inglés">Inglés</option>
                  <option value="Artes Visuales">Artes Visuales</option>
                  <option value="Educación Física y Salud">Educación Física y Salud</option>
                  <option value="Música">Música</option>
                  <option value="Tecnología">Tecnología</option>
                  <option value="Orientación">Orientación</option>
                </select>
              </div>
            </div>

            <div class="grid grid-2 gap-3 mb-3">
              <div class="form-group mb-0">
                <label class="form-label" style="font-weight: 600;">Duración de la Clase</label>
                <select id="plan-duracion" class="form-control" required onchange="window.UtpView.guardarBorradorFormulario()">
                  <option value="45">45 min [1 Hora Pedagógica]</option>
                  <option value="90" selected>90 min [2 Horas Pedagógicas]</option>
                </select>
              </div>

            </div>



            <div class="form-group mb-3">
              <label class="form-label" style="font-weight: 600;">Objetivo de Aprendizaje (OA)</label>
              <textarea id="plan-oa-actual" class="form-control" rows="2" placeholder="Ej: OA 04 - Mostrar que comprenden..." required oninput="window.UtpView.guardarBorradorFormulario()"></textarea>
            </div>
            
            <div class="form-group mb-3">
              <label class="form-label" style="font-weight: 600;">Estrategia de Cierre & Evaluación</label>
              <select id="plan-cierre" class="form-control" required onchange="window.UtpView.guardarBorradorFormulario()">
                <option value="Ticket de Salida impreso / proyectado (3 preguntas clave)" selected>Ticket de Salida impreso / proyectado (3 preguntas clave)</option>
                <option value="Preguntas de Metacognición (¿Qué paso me costó más y cómo lo resolví?)">Preguntas de Metacognición ("¿Qué paso me costó más y cómo lo resolví?")</option>
                <option value="Pauta de Cotejo / Escala de Apreciación rápida">Pauta de Cotejo / Escala de Apreciación rápida</option>
                <option value="Rúbrica analítica breve">Rúbrica analítica breve</option>
                <option value="Plenario de síntesis guiado por estudiantes">Plenario de síntesis guiado por estudiantes</option>
                <option value="3-2-1 de Cierre (3 ideas aprendidas, 2 dudas, 1 aplicación real)">3-2-1 de Cierre (3 ideas aprendidas, 2 dudas, 1 aplicación real)</option>
              </select>
            </div>



            <button type="submit" id="btn-generar-plan" class="btn btn-primary inline-flex items-center justify-center gap-2" style="width: 100%; padding: 0.75rem; font-weight: bold; font-size: 1rem;">
              ${Icons.get('sparkles', 18)} Generar Prompt Maestro de Clase
            </button>
          </form>
        </div>

        <!-- Resultado Generado para Copiar y Pegar -->
        <div class="card" style="padding: 1.5rem; display: flex; flex-direction: column;">
          <div class="flex justify-between items-center mb-3">
            <h3 style="margin:0; color: var(--primary); font-size: 1.15rem; display: inline-flex; align-items: center; gap: 0.4rem;">${Icons.get('file-text', 18)} Prompt Maestro de Clase</h3>
            <div style="display: flex; gap: 0.5rem;">
              <button id="btn-copiar-plan" class="btn btn-primary btn-sm inline-flex items-center gap-1" onclick="window.UtpView.copiarPlanificacion()" style="display: none; font-weight: 600; padding: 0.4rem 0.8rem; background-color: #2563eb;">
                ${Icons.get('file-text', 14)} Copiar Prompt Maestro para ChatGPT / Claude
              </button>
            </div>
          </div>
          
          <div id="container-resultado-ia" style="flex: 1; min-height: 380px; background: #f8fafc; border: 1px dashed var(--border-color); border-radius: var(--radius-md); padding: 1.25rem; font-size: 0.95rem; color: #334155; overflow-y: auto;">
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; color: #64748b;">
              <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🪄</div>
              <p>Completa los parámetros pedagógicos y presiona <b>Generar Prompt Maestro de Clase</b> para obtener la estructura para tu IA.</p>
            </div>
          </div>
        </div>

      </div>
    `;
  }

  async function generarPlanificacionIA() {
    const curso = document.getElementById('plan-curso').value;
    const asignatura = document.getElementById('plan-asignatura').value;
    const duracion = document.getElementById('plan-duracion').value || '90';
    const oaActual = document.getElementById('plan-oa-actual').value.trim();
    const cierre = document.getElementById('plan-cierre').value;

    if (!curso || !asignatura || !oaActual) {
      App.showToast('Por favor completa los campos requeridos', 'warning');
      return;
    }

    const container = document.getElementById('container-resultado-ia');
    const btnCopiar = document.getElementById('btn-copiar-plan');

    const promptText = `Actúa como un Experto Diseñador Curricular, Mentor Pedagógico (Mineduc Chile) y Asesor de Aula de Excelencia.

Diseña una PLANIFICACIÓN DE CLASE Y GUIÓN DOCENTE PASO A PASO (Extensión Máxima: 3 Páginas), con la siguiente arquitectura pedagógica:

📌 PARÁMETROS Y ALINEACIÓN CURRICULAR:
- Curso: ${curso} | Asignatura: ${asignatura} | Duración: ${duracion} min
- Contexto: Escenario y realidad escolar de Chile.
- Objetivo de Aprendizaje (OA): ${oaActual}
- Coherencia Triádica: Alineación estricta entre OA -> Actividades del Desarrollo -> Ticket de Salida.
- Estrategia Metodológica: Enseñanza Directa (Mandatorio).
- Estrategia de Cierre: ${cierre}

⛔ REGLAS STRICTAS DE FORMATO Y CONTENIDO:
1. PROHIBIDO usar código o símbolos de LaTeX (NO usar \\begin{array}, \\hspace, $$, etc.). El texto debe ser 100% limpio y fácil de leer.
2. RIGOR ACADÉMICO: Jamás entregues información falsa o inventada.
3. CONTEXTO REAL: Los problemas matemáticos o casos prácticos deben basarse en situaciones reales del contexto chileno.
4. ANONIMATO ESTUDIANTIL: No utilices nombres ficticios de niños en los ejemplos. Usa siempre la palabra **Estudiante**.
5. PROFESOR REEMPLAZANTE Y CERO IMPROVISACIÓN: El docente NO SABE del contenido. Todo el contenido, explicaciones paso a paso y respuestas exactas DEBEN estar escritas en el guion. No dejes absolutamente NADA a la creatividad o improvisación de quien hace la clase.
6. MATERIAL DE LECTURA ÍNTEGRO: Si la clase requiere que los alumnos lean un cuento, poema, artículo o texto de estudio, ESTÁS OBLIGADO a redactarlo e incluirlo de forma íntegra. No le pidas al profesor que busque material extra.
7. IMÁGENES REFERENCIALES: En los momentos donde se deba proyectar o mostrar algo visual, deja una referencia clara en el texto. Ejemplo: [Proyectar imagen de una boleta de supermercado chileno].

🎯 ESTRUCTURA OBLIGATORIA DEL TEXTO GENERADO:

1. RESUMEN BREVE (Para leer 2 minutos antes de entrar):
   - Objetivo (OA), la ruta de la clase ultra resumida, elementos críticos a tener en cuenta y la respuesta esperada del Ticket de Salida.

2. GUIÓN DE CLASE PASO A PASO (El libreto del profesor):
   - Inicio (15 min): Gancho motivacional y presentación del OA.
   - Desarrollo (${Math.max(15, parseInt(duracion) - 30)} min): Secuencia "Yo hago (Modelaje), Nosotros hacemos (Práctica Guiada), Tú haces (Práctica Independiente)". Con los ejercicios resueltos paso a paso y las preguntas exactas que debe hacer el profesor.
   - Cierre (15 min): Ticket de Salida y metacognición.

[INSTRUCCIÓN FINAL AL MODELO: Al final de tu respuesta, debes escribir EXACTAMENTE la siguiente pregunta en negrita: "¿Te gustaría modificar algún detalle de esta clase o prefieres que genere de inmediato el archivo Word descargable?"]`;

    const displayHtml = `
      <pre id="texto-planificacion-final" style="white-space: pre-wrap; word-wrap: break-word; font-family: monospace; font-size: 0.85rem; color: #334155; line-height: 1.5; background: #fff; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 4px;">${S(promptText)}</pre>
    `;

    container.innerHTML = displayHtml;
    btnCopiar.style.display = 'inline-block';

    try {
      localStorage.setItem('barita_utp_generated_plan_v5', displayHtml);
    } catch (_e) {}

    App.showToast('Prompt Maestro de Clase generado con éxito', 'success');
  }

  function guardarBorradorFormulario() {
    try {
      const draft = {
        curso: document.getElementById('plan-curso')?.value || '',
        asignatura: document.getElementById('plan-asignatura')?.value || '',
        duracion: document.getElementById('plan-duracion')?.value || '90',
        oaActual: document.getElementById('plan-oa-actual')?.value || '',
        cierre: document.getElementById('plan-cierre')?.value || 'Ticket de Salida impreso / proyectado (3 preguntas clave)'
      };
      localStorage.setItem('barita_utp_form_draft_v5', JSON.stringify(draft));
    } catch (_e) {}
  }

  function restaurarBorradorYPlan() {
    try {
      const draftRaw = localStorage.getItem('barita_utp_form_draft_v5');
      if (draftRaw) {
        const draft = JSON.parse(draftRaw);
        if (draft.curso && document.getElementById('plan-curso')) document.getElementById('plan-curso').value = draft.curso;
        if (draft.asignatura && document.getElementById('plan-asignatura')) document.getElementById('plan-asignatura').value = draft.asignatura;
        if (draft.duracion && document.getElementById('plan-duracion')) document.getElementById('plan-duracion').value = draft.duracion;
        if (draft.oaActual && document.getElementById('plan-oa-actual')) document.getElementById('plan-oa-actual').value = draft.oaActual;
        if (draft.cierre && document.getElementById('plan-cierre')) document.getElementById('plan-cierre').value = draft.cierre;
      }

      const planGenerado = localStorage.getItem('barita_utp_generated_plan_v5');
      const container = document.getElementById('container-resultado-ia');
      const btnCopiar = document.getElementById('btn-copiar-plan');

      if (planGenerado && container) {
        container.innerHTML = planGenerado;
        if (btnCopiar) btnCopiar.style.display = 'inline-block';
      }
    } catch (_e) {}
  }

  function limpiarFormularioYPlan() {
    try {
      localStorage.removeItem('barita_utp_form_draft_v5');
      localStorage.removeItem('barita_utp_generated_plan_v5');
    } catch (_e) {}

    const form = document.getElementById('form-plan-ia');
    if (form) form.reset();

    const btnCopiar = document.getElementById('btn-copiar-plan');
    if (btnCopiar) btnCopiar.style.display = 'none';

    const container = document.getElementById('container-resultado-ia');
    if (container) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; color: #64748b;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🪄</div>
          <p>Completa los parámetros pedagógicos y presiona <b>Generar Prompt Maestro de Clase</b> para obtener la estructura para tu IA.</p>
        </div>
      `;
    }

    App.showToast('Formulario y borrador limpiados correctamente', 'info');
  }

  function copiarPlanificacion() {
    const el = document.getElementById('texto-planificacion-final');
    if (!el) return;

    const texto = el.textContent || el.innerText;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(texto).then(() => {
        App.showToast('¡Prompt Maestro de Clase copiado con éxito! Pégalo en tu IA de preferencia para generar la planificación y descargables.', 'success');
      }).catch(err => {
        console.error('Error al copiar:', err);
        fallbackCopyTextToClipboard(texto);
      });
    } else {
      fallbackCopyTextToClipboard(texto);
    }
  }

  function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        App.showToast('¡Prompt Maestro de Clase copiado con éxito! Pégalo en tu IA de preferencia para generar la planificación y descargables.', 'success');
      } else {
        App.showToast('No se pudo copiar el texto.', 'error');
      }
    } catch (err) {
      console.error('Fallback: Oops, unable to copy', err);
      App.showToast('Error al copiar el texto.', 'error');
    }

    document.body.removeChild(textArea);
  }

  function renderTrabajoPedagogico() {
    const funcionarios = typeof Storage !== 'undefined' && Storage.getFuncionarios ? Storage.getFuncionarios() : [];
    const docentes = funcionarios.filter(f => (f.cargo || f.rol || '').toLowerCase().includes('docente') || (f.cargo || f.rol || '').toLowerCase().includes('profesor'));
    const listaParaEvaluar = docentes.length > 0 ? docentes : funcionarios;

    const acciones = typeof Storage !== 'undefined' && Storage.getAllAcciones ? Storage.getAllAcciones() : [];
    const tiposFiscalizacion = (typeof Storage !== 'undefined' && typeof Storage.getTiposFiscalizacion === 'function') ? Storage.getTiposFiscalizacion() : [];
    const idsUtp = tiposFiscalizacion.filter(t => t.vincularUtp).map(t => t.id);
    const tiposUtpValidos = idsUtp.length > 0 ? idsUtp : ['rutina_leccionario', 'rutina_planificacion', 'rutina_evaluacion'];

    const docentesConPendientes = [];
    const docentesAlDia = [];

    listaParaEvaluar.forEach(doc => {
      const fechaCorte = doc.fechaCorteAlDia ? new Date(doc.fechaCorteAlDia).getTime() : 0;

      const historial = acciones.filter(a => {
        const targetId = String(a.funcionarioId || a.funcionario_id || '').trim();
        if (targetId !== String(doc.id).trim()) return false;
        // Solo reporta a UTP si el tipo de evento tiene vincularUtp = true
        if (!tiposUtpValidos.includes(a.tipo)) return false;
        const fechaAccion = new Date(a.fecha).getTime();
        return fechaAccion > fechaCorte;
      });

      const totalFaltasAcumuladas = historial.length;

      const item = {
        docente: doc,
        historial: historial,
        totalFaltas: totalFaltasAcumuladas,
        ultimaFecha: historial.length > 0 ? new Date(historial[historial.length - 1].fecha).toLocaleDateString() : 'Sin observaciones UTP'
      };

      if (totalFaltasAcumuladas > 0) {
        docentesConPendientes.push(item);
      } else {
        docentesAlDia.push(item);
      }
    });

    const escapeHtml = (value) => {
      if (value == null) return '';
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    const rowPendientes = docentesConPendientes.length
      ? docentesConPendientes.map(item => `
          <tr>
            <td><strong>${escapeHtml(item.docente.nombres || '')} ${escapeHtml(item.docente.apellidos || '')}</strong></td>
            <td><span class="badge badge-danger" style="font-size:0.85rem; padding:0.25rem 0.6rem;">${item.totalFaltas} observación(es) UTP</span></td>
            <td>${escapeHtml(item.ultimaFecha)}</td>
            <td>
              <div style="display: flex; gap: 0.35rem;">
                <button class="btn btn-sm btn-outline-secondary" onclick="window.location.hash='#/funcionarios/${item.docente.id}'">Ver Ficha</button>
                <button class="btn btn-sm btn-success" onclick="window.UtpView.marcarDocenteAlDia('${item.docente.id}')" style="background-color: #10b981; border: none; font-weight: 600; color: white;">Marcar Al Día</button>
              </div>
            </td>
          </tr>
        `).join('')
      : `<tr><td colspan="4" class="text-center text-muted" style="padding: 1.5rem;">No hay docentes con observaciones de planificación o evaluación pendientes.</td></tr>`;

    return `
      <div class="flex-col gap-4">

        <!-- RESUMEN GENERAL DE MONITOREO UTP -->
        <div class="grid gap-3 mb-2" style="grid-template-columns: 1fr 1fr;">
          <div class="card" style="padding: 1.25rem; border-left: 4px solid var(--primary);">
            <span class="text-muted" style="font-size: 0.85rem; font-weight: 600;">TOTAL DOCENTES REGISTRADOS</span>
            <h2 style="margin: 0.25rem 0 0 0; color: var(--primary);">${listaParaEvaluar.length}</h2>
          </div>

          <div class="card" style="padding: 1.25rem; border-left: 4px solid var(--danger);">
            <span class="text-muted" style="font-size: 0.85rem; font-weight: 600;">DOCENTES CON OBSERVACIONES PEDAGÓGICAS (UTP)</span>
            <h2 style="margin: 0.25rem 0 0 0; color: var(--danger);">${docentesConPendientes.length}</h2>
          </div>
        </div>

        <!-- TABLA: DOCENTES CON REGISTRO DE FALTAS PEDAGÓGICAS / PENDIENTES UTP -->
        <div class="card" style="padding: 1.25rem; border-top: 3px solid var(--danger);">
          <div class="flex justify-between items-center mb-3">
            <div>
              <h3 style="margin:0; color: var(--text-primary); display: inline-flex; align-items: center; gap: 0.5rem;">${Icons.get('clipboard', 20)} Docentes con Observaciones</h3>
              <span class="text-secondary" style="font-size: 0.85rem;">Monitoreo de Sin Planificación y Sin Evaluaciones</span>
            </div>
          </div>
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f1f5f9; text-align: left;">
                  <th style="padding: 0.6rem; border-bottom: 1px solid #e2e8f0;">Docente</th>
                  <th style="padding: 0.6rem; border-bottom: 1px solid #e2e8f0;">Faltas Pedagógicas UTP</th>
                  <th style="padding: 0.6rem; border-bottom: 1px solid #e2e8f0;">Última fecha</th>
                  <th style="padding: 0.6rem; border-bottom: 1px solid #e2e8f0;">Acción</th>
                </tr>
              </thead>
              <tbody>
                ${rowPendientes}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;
  }

  async function marcarDocenteAlDia(docenteId) {
    if (!docenteId) return;

    App.showConfirm(
      'Marcar Docente al Día',
      '¿Estás seguro de que deseas marcar a este docente como "Al Día"? Esto reseteará el conteo de sus observaciones pendientes en el leccionario, planificaciones y evaluaciones.',
      async () => {
        try {
          const docente = typeof Storage !== 'undefined' && Storage.getFuncionarioById ? Storage.getFuncionarioById(docenteId) : null;
          if (!docente) {
            App.showToast('Docente no encontrado en la base de datos local', 'danger');
            return;
          }

          // Fijar la fecha de corte al dia
          docente.fechaCorteAlDia = new Date().toISOString();
          docente.fecha_corte_al_dia = docente.fechaCorteAlDia;

          if (typeof Storage !== 'undefined' && Storage.saveFuncionario) {
            const success = await Storage.saveFuncionario(docente, true); // bypassPermission = true
            if (success) {
              App.showToast('Docente marcado como "Al Día" con éxito.', 'success');
              // Recargar la vista actual para refrescar las listas
              render(document.getElementById('app-content'));
            } else {
              App.showToast('Error al guardar los cambios en base de datos', 'danger');
            }
          }
        } catch (err) {
          console.error('Error en marcarDocenteAlDia:', err);
          App.showToast('Error interno al procesar la acción', 'danger');
        }
      }
    );
  }

  return {
    render,
    switchTab,
    generarPlanificacionIA,
    copiarPlanificacion,
    guardarBorradorFormulario,
    restaurarBorradorYPlan,
    limpiarFormularioYPlan,
    renderPlanificacionIA,
    renderTrabajoPedagogico,
    marcarDocenteAlDia
  };
})();

window.UtpView = UtpView;
