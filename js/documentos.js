/* ================================================================
   documentos.js - Módulo de Documentos Institucionales (RAG)
   Permite subir PDF y DOCX, extrayendo texto en cliente.
   ================================================================ */

const DocumentosView = (() => {
  function render(container) {
    const role = (typeof Auth !== 'undefined' && Auth.currentRole) ? Auth.currentRole : '';
    const allowedRoles = ['superadmin', 'admin', 'directora', 'utp'];
    if (!allowedRoles.includes(role)) {
      if (!container) return;
      container.innerHTML = `<div class="card text-danger">No tienes permisos para ver esta sección. Permisos requeridos: Administrador o Equipo Directivo.</div>`;
      return;
    }

    App.setBreadcrumb(`Documentos Institucionales ${typeof BaritaHelp!=='undefined'?BaritaHelp.create('documentos'):''}`);

    let html = `
      <div class="card mb-4">
        <div class="card-header">
          <h3 class="card-title">Subir Documento (PDF o DOCX)</h3>
        </div>
        <div class="card-body">
          <p class="text-muted mb-4">El sistema extraerá inteligentemente el texto del documento para que la Inteligencia Artificial pueda consultarlo al generar informes.</p>
          <form id="form-upload-doc" onsubmit="event.preventDefault(); window.DocumentosView.procesarDocumento()">
            <div class="dashboard-grid" style="grid-template-columns: 1fr 1fr;">
              <div class="form-group">
                <label class="form-label">Nombre del Documento</label>
                <input type="text" id="doc-nombre" class="form-control" required placeholder="Ej: RICE 2026">
              </div>
              <div class="form-group">
                <label class="form-label">Categoría *</label>
                <select id="doc-categoria" class="form-control" required>
                  <option value="">Seleccione Categoría Oficial...</option>
                  <option value="RICE">RICE (Reglamento Interno de Convivencia Escolar)</option>
                  <option value="HIGIENE">Reglamento de Higiene y Seguridad</option>
                  <option value="EVALUACION">Reglamento de Evaluación</option>
                </select>
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label">Archivo</label>
              <input type="file" id="doc-file" class="form-control" accept=".pdf,.docx" required>
            </div>
            
            <button type="submit" id="btn-upload-doc" class="btn btn-primary">Extraer y Guardar Documento</button>
            <div id="upload-status" class="mt-2 text-muted" style="display:none;"></div>
          </form>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Documentos Cargados en el Sistema</h3>
        </div>
        <div class="card-body">
          <div id="docs-list" class="flex-col gap-2"></div>
        </div>
      </div>
    `;

    if (!container) return;
    container.innerHTML = html;
    renderLista();
  }

  function renderLista() {
    const list = document.getElementById('docs-list');
    if (!list) return;

    const docs = Storage.getDocumentos().sort((a, b) => new Date(b.ultimaActualizacion) - new Date(a.ultimaActualizacion));
    
    if (docs.length === 0) {
      list.innerHTML = `<div class="text-muted text-center py-4">No hay documentos institucionales cargados.</div>`;
      return;
    }

    list.innerHTML = docs.map(d => `
      <div style="border: 1px solid var(--border-color); padding: 1rem; border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h4 style="margin: 0; display: flex; align-items: center; gap: 0.5rem;">
            📄 ${d.nombre}
            <span class="badge" style="background: var(--bg-hover); border: 1px solid var(--border-color);">${getNombreCategoria(d.categoria)}</span>
          </h4>
          <div class="text-muted text-sm mt-1">Última actualización: ${new Date(d.ultimaActualizacion).toLocaleString()} | ${((d.texto?.length || 0) / 1024).toFixed(1)} KB de texto extraído</div>
        </div>
        <div>
          <button class="btn btn-sm btn-secondary text-danger" onclick="window.DocumentosView.eliminar('${d.id}')">Eliminar</button>
        </div>
      </div>
    `).join('');
  }

  function getNombreCategoria(cat) {
    const catMap = {
      'RICE': 'RICE (Reglamento Interno)',
      'HIGIENE': 'Reglamento de Higiene y Seguridad',
      'EVALUACION': 'Reglamento de Evaluación'
    };
    return catMap[cat] || cat;
  }

  function procesarDocumento() {
    const fileInput = document.getElementById('doc-file');
    if (!fileInput.files.length) return;
    
    const categoria = document.getElementById('doc-categoria').value;
    const categoriasValidas = ['RICE', 'HIGIENE', 'EVALUACION'];

    if (!categoria || !categoriasValidas.includes(categoria)) {
      App.showToast('Por favor selecciona una categoría oficial válida (RICE, Higiene y Seguridad o Reglamento de Evaluación).', 'warning');
      return;
    }

    const existentes = Storage.getDocumentos();
    const previo = existentes.find(d => d.categoria === categoria);
    
    if (previo) {
      App.confirm('Reemplazar documento', `Ya existe un documento para la categoría seleccionada (${getNombreCategoria(categoria)}). ¿Deseas reemplazarlo por este nuevo archivo?`, () => {
        _ejecutarProcesamiento(previo.id);
      });
    } else {
      _ejecutarProcesamiento(null);
    }
  }

  async function _ejecutarProcesamiento(previoId) {
    const nombre = document.getElementById('doc-nombre').value;
    const categoria = document.getElementById('doc-categoria').value;
    const categoriasValidas = ['RICE', 'HIGIENE', 'EVALUACION'];

    if (!categoria || !categoriasValidas.includes(categoria)) {
      App.showToast('Categoría no permitida para la carga.', 'danger');
      return;
    }
    const fileInput = document.getElementById('doc-file');
    const btn = document.getElementById('btn-upload-doc');
    const status = document.getElementById('upload-status');
    const file = fileInput.files[0];

    btn.disabled = true;
    status.style.display = 'block';
    status.innerText = `Leyendo archivo ${file.name}...`;

    try {
      let textoExtraido = '';

      if (file.name.toLowerCase().endsWith('.pdf')) {
        textoExtraido = await extraerTextoPDF(file);
      } else if (file.name.toLowerCase().endsWith('.docx')) {
        textoExtraido = await extraerTextoDOCX(file);
      } else {
        throw new Error('Formato no soportado. Sube un PDF o DOCX.');
      }

      if (!textoExtraido || textoExtraido.trim().length === 0) {
        throw new Error('No se pudo extraer texto del documento. Asegúrate de que no sea una imagen escaneada sin texto seleccionable.');
      }

      status.innerText = 'Texto extraído. Generando resumen inteligente...';

      const apiKey = '';
      let resumen = '';
      let tags = [];
      if (apiKey) {
        try {
          const resumenData = await generarResumenIA(textoExtraido, categoria);
          resumen = resumenData.resumen || '';
          tags = resumenData.tags || [];
        } catch (e) {

        }
      }

      if (!resumen) {
        resumen = textoExtraido.slice(0, 900);
        tags = inferirTags(textoExtraido, categoria);
      }

      status.innerText = 'Guardando documento y preparando índice para consultas rápidas...';
      
      const docData = {
        id: previoId || ('doc_' + Date.now()),
        nombre: nombre,
        categoria: categoria,
        texto: textoExtraido,
        resumen: resumen,
        tags: tags,
        fileName: file.name,
        colegioId: Storage.activeSchool || 'demo',
        colegio_id: Storage.activeSchool || 'demo',
        ultimaActualizacion: new Date().toISOString()
      };

      await Storage.saveDocumento(docData);
      
      // Context Flush / Purga de Memoria al actualizar/reemplazar documentos
      try {
        sessionStorage.removeItem('barita_chat_history_html');
        sessionStorage.removeItem('barita_selected_chat_doc');
      } catch (_e) {}

      App.showToast('Documento guardado y listo para consultas IA', 'success');
      status.innerText = '✅ Documento cargado e indexado correctamente.';
      document.getElementById('form-upload-doc').reset();
      renderLista();
      setTimeout(() => { status.style.display = 'none'; }, 3000);
    } catch (error) {

      App.showToast('Error procesando: ' + error.message, 'danger');
    } finally {
      btn.disabled = false;
      status.style.display = 'none';
    }
  }

  function eliminar(id) {
    App.confirm('Eliminar Documento', '¿Estás seguro de que deseas eliminar este documento institucional? La IA ya no lo tendrá en cuenta.', async () => {
      await Storage.deleteDocumento(id);
      
      // Context Flush / Purga de Memoria al eliminar documentos
      try {
        sessionStorage.removeItem('barita_chat_history_html');
        sessionStorage.removeItem('barita_selected_chat_doc');
      } catch (_e) {}

      App.showToast('Documento eliminado y memoria purgada', 'success');
      renderLista();
    });
  }

  async function extraerTextoPDF(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async function() {
        try {
          const typedarray = new Uint8Array(this.result);
          const pdf = await pdfjsLib.getDocument(typedarray).promise;
          let text = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const strings = content.items.map(item => item.str);
            text += strings.join(' ') + '\n';
          }
          resolve(text);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  async function extraerTextoDOCX(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async function(e) {
        try {
          const arrayBuffer = e.target.result;
          const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
          resolve(result.value);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  function generarResumenIA(texto, categoria) {
    if (!texto.trim()) return Promise.resolve({ resumen: '', tags: [] });
    const prompt = `Resume ESTE TEXTO en hasta 10 renglones y devuelve JSON compacto {resumen, tags lista}. Texto:\n\n${texto.slice(0, 7000)}`;
    return AIClient.call('Eres un resumidor preciso.', prompt, { timeout: 30000 })
      .then(raw => {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        let parsed = {};
        try { parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {}; } catch (_e) {}
        return { resumen: parsed.resumen || raw.slice(0, 900), tags: Array.isArray(parsed.tags) ? parsed.tags : [] };
      })
      .catch(err => {
        return { resumen: texto.slice(0, 900), tags: inferirTags(texto, categoria) };
      });
  }

  function inferirTags(texto, categoria) {
    const tags = [categoria];
    const t = texto.toLowerCase();
    if (t.includes('protocolo') || t.includes('procedimiento')) tags.push('protocolo');
    if (t.includes('convivencia') || t.includes('reglamento')) tags.push('convivencia');
    if (t.includes('evaluacion') || t.includes('nota') || t.includes('calificación')) tags.push('evaluacion');
    if (t.includes('pie') || t.includes('necesidades')) tags.push('inclusion');
    return tags.slice(0, 6);
  }

  function obtenerResumenCacheado(docId) {
    try {
      const data = localStorage.getItem('doc_resumen_cache');
      if (!data) return null;
      const obj = JSON.parse(data);
      if (obj && obj.id === docId) return obj;
    } catch {}
    return null;
  }

  function guardarResumenCacheado(doc) {
    try {
      localStorage.setItem('doc_resumen_cache', JSON.stringify({ id: doc.id, resumen: doc.resumen, tags: doc.tags, ts: Date.now() }));
    } catch {}
  }

  return {
    render,
    renderLista,
    procesarDocumento,
    eliminar,
    extraerTextoPDF,
    extraerTextoDOCX,
    generarResumenIA,
    inferirTags,
    obtenerResumenCacheado,
    guardarResumenCacheado
  };
})();

window.DocumentosView = DocumentosView;
