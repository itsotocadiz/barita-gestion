/**
 * ═══ PARSER Y EXTRACTOR DE HOJAS DE VIDA EN PDF ═══
 * Extrae fechas, tipos y descripciones de anotaciones desde archivos PDF
 * Omite registros duplicados (por fecha y texto sanitizado)
 */

const PDFHojaVidaParser = {
  /**
   * Extrae el texto completo de un archivo PDF subido utilizando pdfjsLib o Lector Nativo de Texto
   * @param {File} file 
   * @returns {Promise<string>} Texto extraído del PDF
   */
  async extraerTextoDePDF(file) {
    if (!file) return '';

    // Intento 1: Uso de pdfjsLib con arrayBuffer nativo
    if (typeof pdfjsLib !== 'undefined') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const typedarray = new Uint8Array(arrayBuffer);
        const loadingTask = pdfjsLib.getDocument({ data: typedarray });
        const pdf = await loadingTask.promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += pageText + '\n';
        }
        if (fullText.trim().length > 0) {
          return fullText;
        }
      } catch (err) {
        console.warn('pdfjsLib extraction fallback to FileReader:', err);
      }
    }

    // Intento 2: Fallback por FileReader como texto
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result || '');
      reader.onerror = () => resolve('');
      reader.readAsText(file);
    });
  },

  /**
   * Limpia anotaciones corruptas o bloques gigantes cargados anteriormente por error.
   */
  async limpiarAnotacionesBloque(estudianteId) {
    try {
      if (!Storage.cache.anotaciones) return;
      const corruptas = Storage.cache.anotaciones.filter(a => {
        if (!a || (a.estudianteId !== estudianteId && a.estudiante_id !== estudianteId)) return false;
        const desc = a.descripcion || '';
        return desc.includes('Fecha Tipo de registro') || desc.includes('Autor Asignatura') || (desc.includes('Motivo') && desc.length > 600);
      });

      for (const c of corruptas) {
        try {
          if (Storage.deleteAnotacion) await Storage.deleteAnotacion(c.id);
        } catch (err) {
          console.warn('Error deleting corrupt annotation:', err);
        }
      }
    } catch (e) {
      console.warn('limpiarAnotacionesBloque error:', e);
    }
  },

  /**
   * Analiza el texto del PDF y extrae de forma individual cada tarjeta de anotación Lirmi.
   * Utiliza anclaje por la palabra "Motivo" y "Descripción" para garantizar la separación estricta.
   * @param {string} texto 
   * @returns {Array<object>} [{ fecha: string (ISO), tipo: string, categoriaFalta: string, descripcion: string }]
   */
  parsearAnotacionesTexto(texto) {
    if (!texto || typeof texto !== 'string') return [];

    let cleanText = texto
      .replace(/©\s*20\d{2}[\s\S]*?Lirmi Chile SpA/gi, '')
      .replace(/Todos los derechos reservados.*/gi, '')
      .replace(/Registrado por:.*/gi, '')
      .replace(/Página\s+\d+\s+de\s+\d+/gi, '');

    const regexFecha = /(?:(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2}))|(?:(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4}))|(?:(\d{1,2})\s+de\s+([a-zA-ZáéíóúÁÉÍÓÚ]+)\s+de\s+(\d{4}))/i;
    const mesesMap = {
      'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04', 'mayo': '05', 'junio': '06',
      'julio': '07', 'agosto': '08', 'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
    };

    // Buscar todas las apariciones de "Motivo" en el texto
    const motivoRegex = /\bMotivo\b/gi;
    const indicesMotivo = [];
    let match;
    while ((match = motivoRegex.exec(cleanText)) !== null) {
      indicesMotivo.push(match.index);
    }

    if (indicesMotivo.length === 0) {
      // Fallback si el PDF no usa la estructura Lirmi estándar con "Motivo"
      return this.parsearPorLineasFallback(cleanText);
    }

    const anotacionesExtraidas = [];
    let lastKnownDate = new Date().toISOString();

    for (let i = 0; i < indicesMotivo.length; i++) {
      const idxMotivoActual = indicesMotivo[i];
      const idxMotivoSiguiente = (i + 1 < indicesMotivo.length) ? indicesMotivo[i + 1] : cleanText.length;
      const idxEncabezadoAnterior = (i === 0) ? 0 : indicesMotivo[i - 1];

      // Texto de la cabecera (entre el motivo anterior y este motivo)
      const cabeceraText = cleanText.substring(idxEncabezadoAnterior, idxMotivoActual);

      // Texto del cuerpo del motivo y descripción (entre este motivo y el siguiente)
      const cuerpoText = cleanText.substring(idxMotivoActual, idxMotivoSiguiente);

      // 1. Extraer Fecha (buscar en cabecera o en cuerpo)
      const dateMatch = (cabeceraText + ' ' + cuerpoText).match(regexFecha);
      if (dateMatch) {
        if (dateMatch[1] && dateMatch[2] && dateMatch[3]) { // YYYY-MM-DD
          lastKnownDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}T12:00:00.000Z`;
        } else if (dateMatch[4] && dateMatch[5] && dateMatch[6]) { // DD-MM-YYYY
          lastKnownDate = `${dateMatch[6]}-${dateMatch[5].padStart(2, '0')}-${dateMatch[4].padStart(2, '0')}T12:00:00.000Z`;
        } else if (dateMatch[7] && dateMatch[8] && dateMatch[9]) { // DD de Mes de YYYY
          const dia = dateMatch[7].padStart(2, '0');
          const mesStr = dateMatch[8].toLowerCase();
          const mes = mesesMap[mesStr] || '01';
          const anio = dateMatch[9];
          lastKnownDate = `${anio}-${mes}-${dia}T12:00:00.000Z`;
        }
      }

      // 2. Extraer Autor y Asignatura de la cabecera
      let autorStr = '';
      let asignaturaStr = '';
      const autorMatch = cabeceraText.match(/Autor\s*([^\n\r\t]+?)(?=Asignatura|Motivo|Descripción|\n|$)/i);
      if (autorMatch) autorStr = autorMatch[1].trim();

      const asigMatch = cabeceraText.match(/Asignatura\s*([^\n\r\t]+?)(?=Motivo|Descripción|\n|$)/i);
      if (asigMatch) asignaturaStr = asigMatch[1].trim();

      // 3. Extraer Motivo y Descripción del cuerpo
      let motivoText = '';
      let descripcionText = '';

      const descIdx = cuerpoText.search(/\bDescripción\b/i);
      if (descIdx !== -1) {
        motivoText = cuerpoText.substring(6, descIdx).trim(); // después de "Motivo" y antes de "Descripción"
        descripcionText = cuerpoText.substring(descIdx + 11).trim(); // después de "Descripción"
      } else {
        motivoText = cuerpoText.substring(6).trim();
        descripcionText = motivoText;
      }

      // Limpiar cola de la descripción si se traslapó el encabezado de la siguiente tarjeta
      const idxProximaFecha = descripcionText.search(/\bFecha\b/i);
      if (idxProximaFecha !== -1) {
        descripcionText = descripcionText.substring(0, idxProximaFecha).trim();
      }

      // 4. Clasificar Tipo basándonos en la expresión del bloque del PDF
      let tipo = 'observacion';
      const blockLower = (cabeceraText + ' ' + cuerpoText).toLowerCase();

      if (blockLower.includes('anotación negativa') || blockLower.includes('anotacion negativa') || blockLower.includes('negativa')) {
        tipo = 'negativa';
      } else if (blockLower.includes('anotación positiva') || blockLower.includes('anotacion positiva') || blockLower.includes('positiva') || blockLower.includes('felicitación') || blockLower.includes('reconocimiento')) {
        tipo = 'positiva';
      } else if (blockLower.includes('entrevista')) {
        tipo = 'entrevista';
      } else if (blockLower.includes('observación') || blockLower.includes('observacion') || blockLower.includes('justificativo')) {
        tipo = 'observacion';
      }

      // 5. Clasificar Gravedad RICE para el cálculo de semáforo
      const clasif = window.RICEEngine ? window.RICEEngine.clasificarTexto(motivoText + ' ' + descripcionText) : { categoria: 'LEVE' };

      // Limpiar Motivo
      let cleanMotivo = motivoText.trim();
      const parenMatch = cleanMotivo.match(/\((Falta[^\)]+)\)/i);
      if (parenMatch) {
        cleanMotivo = parenMatch[1]; // ej. "Falta de mediana gravedad" o "Falta Leve"
      }

      // Limpiar Descripción eliminando residuos de cabeceras de Lirmi
      let cleanDesc = descripcionText.trim();
      const idxGarbage = cleanDesc.search(/\bFecha\b|\bTipo de registro\b|\bAutor\b|\bAsignatura\b/i);
      if (idxGarbage !== -1) {
        cleanDesc = cleanDesc.substring(0, idxGarbage).trim();
      }

      // Formato simplificado:
      // Para anotaciones NEGATIVAS: Incluir (Tipo de Falta) + Registro de la anotación
      // Para Positivas, Observaciones y Entrevistas: Mostrar únicamente la Descripción limpia
      let fullDesc = cleanDesc;
      if (tipo === 'negativa' && cleanMotivo) {
        fullDesc = `<b>${cleanMotivo}</b>\n${cleanDesc}`;
      }

      anotacionesExtraidas.push({
        fecha: lastKnownDate,
        tipo: tipo,
        categoriaFalta: clasif.categoria ? clasif.categoria.toLowerCase() : null,
        descripcion: fullDesc.trim(),
        autor: autorStr,
        asignatura: asignaturaStr,
        motivo: cleanMotivo
      });
    }

    return anotacionesExtraidas;
  },

  /**
   * Fallback por líneas simples si no se encuentra la palabra Motivo
   */
  parsearPorLineasFallback(texto) {
    const anotacionesExtraidas = [];
    const lineas = texto.split('\n');
    const regexFecha = /(?:(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2}))|(?:(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4}))/i;
    let actual = null;

    lineas.forEach(l => {
      const line = l.trim();
      if (!line) return;
      const dateMatch = line.match(regexFecha);
      if (dateMatch) {
        if (actual && actual.descripcion) anotacionesExtraidas.push(actual);
        actual = {
          fecha: new Date().toISOString(),
          tipo: line.toLowerCase().includes('positiv') ? 'positiva' : 'negativa',
          categoriaFalta: 'leve',
          descripcion: line
        };
      } else if (actual) {
        actual.descripcion += ' ' + line;
      }
    });
    if (actual && actual.descripcion) anotacionesExtraidas.push(actual);
    return anotacionesExtraidas;
  },

  /**
   * Extrae filas estructuradas desde una planilla Excel (.xlsx / .xls / .csv)
   * Leyendo de forma exacta:
   * - Columna F (Índice 5): Fecha
   * - Columna H (Índice 7): Tipo de registro (Positiva, Negativa, Observación, Entrevista)
   * - Columna K (Índice 10): Detalle / Descripción de la anotación
   * Clasifica automáticamente mediante RICEEngine las faltas negativas para el Semáforo.
   */
  async parsearExcel(file) {
    if (typeof XLSX === 'undefined') return [];
    
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    
    // Seleccionar Hoja 2 si existe (índice 1), de lo contrario la Hoja 1 (índice 0)
    const sheetName = workbook.SheetNames[1] || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Leer como matriz por posición de columnas (header: 1)
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });

    const anotacionesExtraidas = [];
    const regexFecha = /(?:(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2}))|(?:(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4}))/i;

    rawRows.forEach((row) => {
      if (!row || !Array.isArray(row) || row.length === 0) return;

      // Columna F es índice 5 (A=0, B=1, C=2, D=3, E=4, F=5)
      const fechaVal = String(row[5] || '').trim();

      // Columna H es índice 7 (G=6, H=7)
      const tipoVal = String(row[7] || '').trim();

      // Columna K es índice 10 (I=8, J=9, K=10)
      const detalleVal = String(row[10] || '').trim();

      // Si no hay detalle en Columna K ni tipo en H, ignorar fila vacía o de encabezado
      if (!detalleVal && !tipoVal) return;
      if (fechaVal.toLowerCase().includes('fecha') || tipoVal.toLowerCase().includes('tipo')) return;

      // 1. Extraer Fecha de Columna F
      let isoDate = new Date().toISOString();
      const dateMatch = fechaVal.match(regexFecha);
      if (dateMatch) {
        if (dateMatch[1] && dateMatch[2] && dateMatch[3]) { // YYYY-MM-DD
          isoDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}T12:00:00.000Z`;
        } else if (dateMatch[4] && dateMatch[5] && dateMatch[6]) { // DD-MM-YYYY
          isoDate = `${dateMatch[6]}-${dateMatch[5].padStart(2, '0')}-${dateMatch[4].padStart(2, '0')}T12:00:00.000Z`;
        }
      }

      // 2. Extraer Tipo de Registro de Columna H
      let tipo = 'observacion';
      const tLower = tipoVal.toLowerCase();
      if (tLower.includes('negativ') || tLower.includes('falta')) {
        tipo = 'negativa';
      } else if (tLower.includes('positiv') || tLower.includes('felicita') || tLower.includes('reconocimiento')) {
        tipo = 'positiva';
      } else if (tLower.includes('entrevista')) {
        tipo = 'entrevista';
      } else if (tLower.includes('observaci') || tLower.includes('justificativ')) {
        tipo = 'observacion';
      }

      // 3. Categorizar automáticamente con el motor RICE 2026 según el detalle de Columna K
      const clasif = window.RICEEngine ? window.RICEEngine.clasificarTexto(detalleVal) : { categoria: 'LEVE' };

      anotacionesExtraidas.push({
        fecha: isoDate,
        tipo: tipo,
        categoriaFalta: clasif.categoria ? clasif.categoria.toLowerCase() : null,
        descripcion: detalleVal,
        autor: '',
        asignatura: '',
        motivo: clasif.categoria || ''
      });
    });

    return anotacionesExtraidas;
  },

  /**
   * Omite registros duplicados que ya existan en la Línea de Tiempo de Eventos o Bitácora del estudiante.
   * Utiliza una clave de comparación basada en fecha + tipo + texto sanitizado.
   */
  desduplicarYProcesar(estudianteId, nuevasAnotaciones) {
    const est = Storage.getEstudianteById ? Storage.getEstudianteById(estudianteId) : null;
    
    // Obtener anotaciones registradas en la tabla 'anotaciones'
    const anotacionesExistentes = (Storage.cache.anotaciones || []).filter(a => a && String(a.estudianteId || a.estudiante_id) === String(estudianteId));
    
    // Obtener registros de bitácora seguimiento del estudiante
    const bitacoraExistente = (est && Array.isArray(est.bitacoraSeguimiento)) ? est.bitacoraSeguimiento : [];

    const cleanStr = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    // Helper para generar una firma única (Clave Compuesta: YYYY-MM-DD + Tipo + Texto)
    const generarFirma = (fechaRaw, tipoRaw, descRaw) => {
      let fechaYMD = '';
      if (fechaRaw) {
        const d = new Date(fechaRaw);
        if (!isNaN(d.getTime())) {
          fechaYMD = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        } else {
          fechaYMD = String(fechaRaw).substring(0, 10);
        }
      }
      const tipoClean = cleanStr(tipoRaw);
      const descClean = cleanStr(descRaw);
      return `${fechaYMD}_${tipoClean}_${descClean}`;
    };

    // Crear un Set con las firmas ya guardadas previamente
    const firmasGuardadas = new Set();

    anotacionesExistentes.forEach(exist => {
      // Skip local-only unsynced annotations so they can be re-attempted and written to Supabase
      if (Storage.localMutations && Storage.localMutations.anotaciones && Storage.localMutations.anotaciones[exist.id]) {
        return;
      }
      const cleanDesc = cleanStr(exist.descripcion);
      // Ignorar anotaciones corruptas gigantes previamente guardadas
      if (cleanDesc.length > 500) return;
      const firma = generarFirma(exist.fecha, exist.tipo || exist.tipoAnotacion || '', exist.descripcion);
      firmasGuardadas.add(firma);
    });

    bitacoraExistente.forEach(bit => {
      const firma = generarFirma(bit.fecha, 'observacion', bit.texto || bit.descripcion);
      firmasGuardadas.add(firma);
    });

    const incorporadas = [];
    const omitidas = [];
    const firmasEnProceso = new Set();

    nuevasAnotaciones.forEach(nueva => {
      const firmaNueva = generarFirma(nueva.fecha, nueva.tipo || '', nueva.descripcion);
      const cleanNuevaDesc = cleanStr(nueva.descripcion);
      const nuevaFechaTime = new Date(nueva.fecha).getTime();

      // 1. Verificación por Firma Exacta (Fecha + Tipo + Descripción)
      let esDuplicado = firmasGuardadas.has(firmaNueva) || firmasEnProceso.has(firmaNueva);

      // 2. Verificación por Coincidencia Difusa de Texto dentro de un rango de 24 horas
      if (!esDuplicado) {
        esDuplicado = anotacionesExistentes.some(exist => {
          const cleanExistDesc = cleanStr(exist.descripcion);
          if (cleanExistDesc.length > 500) return false;

          const existFechaTime = new Date(exist.fecha).getTime();
          const mismaFechaAprox = Math.abs(existFechaTime - nuevaFechaTime) <= (24 * 60 * 60 * 1000);
          
          if (!mismaFechaAprox || !cleanExistDesc || !cleanNuevaDesc) return false;
          
          // Coincidencia estricta de subcadena significativa (mínimo 15 caracteres)
          if (cleanNuevaDesc.length >= 15 && cleanExistDesc.length >= 15) {
            return cleanExistDesc.includes(cleanNuevaDesc) || cleanNuevaDesc.includes(cleanExistDesc);
          }
          return cleanExistDesc === cleanNuevaDesc;
        });
      }

      if (esDuplicado) {
        omitidas.push(nueva);
      } else {
        incorporadas.push(nueva);
        firmasEnProceso.add(firmaNueva);
      }
    });

    return { incorporadas, omitidas };
  },

  /**
   * Guarda las nuevas anotaciones extraídas EXCLUSIVAMENTE en la Línea de Tiempo de Eventos (Storage.saveAnotacion).
   */
  async guardarAnotacionesNuevas(estudianteId, anotacionesNuevas) {
    const est = Storage.getEstudianteById ? Storage.getEstudianteById(estudianteId) : null;
    if (!est) return;

    // Primero limpiar bloques corruptos previos
    await this.limpiarAnotacionesBloque(estudianteId);

    for (const item of anotacionesNuevas) {
      const idUnico = Storage.generateId();
      
      const clasif = window.RICEEngine ? window.RICEEngine.clasificarTexto(item.descripcion) : { categoria: 'LEVE' };
      
      const anotacionObj = {
        id: idUnico,
        estudianteId: estudianteId,
        estudiante_id: estudianteId,
        fecha: item.fecha,
        tipo: item.tipo || 'observacion',
        categoriaFalta: item.categoriaFalta || (clasif.categoria ? clasif.categoria.toLowerCase() : null),
        descripcion: item.descripcion,
        registradoPor: '',
        autorId: null,
        autor_id: null
      };

      if (Storage.saveAnotacion) {
        await Storage.saveAnotacion(anotacionObj);
      }
    }

    if (window.RICEEngine) {
      window.RICEEngine.evaluarEstudiante(estudianteId);
      if (typeof window.RICEEngine.evaluarCompromisoEstudiante === 'function') {
        window.RICEEngine.evaluarCompromisoEstudiante(estudianteId);
      }
    }
  }
};

window.PDFHojaVidaParser = PDFHojaVidaParser;
