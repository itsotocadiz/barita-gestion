/* ================================================================
   document_rag_engine.js — Motor de Búsqueda RAG Ultra-Rápido en Cliente
   Filtra en 5ms las secciones relevantes de los documentos del colegio
   para inyectarlas a la llamada de Gemini 1.5 Flash.
   ================================================================ */

const DocumentRAGEngine = (() => {

  /**
   * Extrae los párrafos o secciones más relevantes de un documento o lista de documentos
   * según la consulta del usuario.
   */
  function buscarExtractos(query, { docId = null, categoria = null, maxChunks = 3, maxCharsPerChunk = 1500 } = {}) {
    if (!query || typeof query !== 'string' || !query.trim()) return [];

    let documentos = (typeof Storage !== 'undefined' && Storage.getDocumentos) ? Storage.getDocumentos() : [];
    
    // 1. Aislamiento Multi-Colegio Estricto por colegioId
    const activeSchool = (typeof Storage !== 'undefined' && Storage.activeSchool) ? Storage.activeSchool : 'demo';
    documentos = documentos.filter(d => {
      const docSchool = d.colegioId || d.colegio_id || 'demo';
      return String(docSchool).trim() === String(activeSchool).trim();
    });

    // 2. Context Flush: Si se selecciona un docId específico, restringir EXCLUSIVAMENTE a ese documento
    if (docId && docId !== 'TODOS') {
      documentos = documentos.filter(d => String(d.id) === String(docId));
    } else if (categoria && categoria !== 'TODOS') {
      documentos = documentos.filter(d => d.categoria === categoria);
    }

    if (documentos.length === 0) return [];

    // Palabras relevantes (longitud > 2)
    const queryWords = query.toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
      .split(/\s+/)
      .filter(w => w.length >= 3);

    const candidates = [];

    documentos.forEach(doc => {
      const fullText = doc.texto || doc.resumen || '';
      if (!fullText) return;

      let blocks = fullText.split(/\n\s*\n/).filter(b => b.trim().length > 20);
      if (blocks.length <= 1) {
        blocks = fullText.split('\n').filter(b => b.trim().length > 20);
      }

      blocks.forEach((block, idx) => {
        const blockLower = block.toLowerCase();
        let score = 0;

        queryWords.forEach(word => {
          if (blockLower.includes(word)) {
            score += 3;
          }
        });

        const qLower = query.toLowerCase();
        if (queryLowerContains(qLower, ['roba', 'hurto', 'perdio', 'sustraccion', 'pertenencia', 'objeto'])) {
          if (blockLower.includes('hurto') || blockLower.includes('robo') || blockLower.includes('pertenencia') || blockLower.includes('objeto') || blockLower.includes('sustracción') || blockLower.includes('falta')) {
            score += 4;
          }
        }
        if (queryLowerContains(qLower, ['material', 'materiales', 'util', 'utiles', 'cuaderno', 'libro', 'tarea', 'trae', 'traiga'])) {
          if (blockLower.includes('material') || blockLower.includes('útil') || blockLower.includes('cuaderno') || blockLower.includes('responsabilidad') || blockLower.includes('deber') || blockLower.includes('incumplimiento') || blockLower.includes('falta')) {
            score += 4;
          }
        }

        if (score > 0) {
          candidates.push({
            docNombre: doc.nombre || 'Documento Institucional',
            categoria: doc.categoria || 'GENERAL',
            seccionNum: idx + 1,
            contenido: block.trim().slice(0, maxCharsPerChunk),
            score: score
          });
        }
      });

      if (candidates.length === 0 && blocks.length > 0) {
        candidates.push({
          docNombre: doc.nombre || 'Documento Institucional',
          categoria: doc.categoria || 'GENERAL',
          seccionNum: 1,
          contenido: blocks[0].trim().slice(0, maxCharsPerChunk),
          score: 1
        });
      }
    });

    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, maxChunks);
  }

  function queryLowerContains(q, terms) {
    return terms.some(t => q.includes(t));
  }

  /**
   * Obtiene la lista aislada de documentos del colegio activo
   */
  function getDocumentosColegioActivo() {
    let documentos = (typeof Storage !== 'undefined' && Storage.getDocumentos) ? Storage.getDocumentos() : [];
    const activeSchool = (typeof Storage !== 'undefined' && Storage.activeSchool) ? Storage.activeSchool : 'demo';
    return documentos.filter(d => {
      const docSchool = d.colegioId || d.colegio_id || 'demo';
      return String(docSchool).trim() === String(activeSchool).trim();
    });
  }

  /**
   * Construye un prompt contextualizado con los extractos del documento encontrado
   */
  function prepararPromptConContexto(userQuery, { docId = null, categoria = null } = {}) {
    const docsColegio = getDocumentosColegioActivo();
    const schoolProfile = (typeof Storage !== 'undefined' && Storage.getSchoolProfile) ? Storage.getSchoolProfile() : { nombre: 'tu Colegio' };
    const colegioNombre = schoolProfile.nombre || 'tu Colegio';

    // 3. Dinamismo y Control si Documentos Cargados == 0
    if (docsColegio.length === 0) {
      return {
        hasDocuments: false,
        totalDocs: 0,
        colegioNombre: colegioNombre,
        noDocsMessage: `Actualmente no hay documentos institucionales cargados para ${colegioNombre}. Por favor, sube el RICE o PEI en la sección Documentos para poder ayudarte con las normativas de tu establecimiento.`,
        prompt: userQuery,
        citasInfo: []
      };
    }

    const extractos = buscarExtractos(userQuery, { docId, categoria });

    let contextText = `DOCUMENTOS Y NORMATIVAS OFICIALES DE ${colegioNombre.toUpperCase()}:\n`;
    if (extractos.length > 0) {
      extractos.forEach((ex, idx) => {
        contextText += `=== EXTRACTO OFICIAL ${idx + 1} [Fuente consultada: ${ex.docNombre}] ===\n${ex.contenido}\n\n`;
      });
    } else {
      contextText += `(Documentos disponibles en el colegio: ${docsColegio.map(d => d.nombre).join(', ')})\n\n`;
    }

    const finalPrompt = `${contextText}\n[CONSULTA DEL PROFESOR / USUARIO]:\n${userQuery}`;

    return {
      hasDocuments: true,
      totalDocs: docsColegio.length,
      colegioNombre: colegioNombre,
      hasContext: extractos.length > 0,
      prompt: finalPrompt,
      citasInfo: extractos.map(e => `Fuente consultada: ${e.docNombre}`)
    };
  }

  return {
    buscarExtractos,
    prepararPromptConContexto
  };
})();

window.DocumentRAGEngine = DocumentRAGEngine;
