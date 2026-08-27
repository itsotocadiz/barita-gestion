/**
 * ═══ MOTOR RICE 2026 DE CLASIFICACIÓN Y SEMÁFORO DINÁMICO ═══
 * BARITA - Gestión & Talento Escolar
 */

const RICEEngine = {
  config: null,

  async init() {
    if (this.config) return this.config;
    try {
      const res = await fetch('data/rice_rules.json?v=' + Date.now());
      if (res.ok) {
        this.config = await res.json();
      }
    } catch (e) {
      console.warn('Cargando configuración RICE fallback por defecto');
    }

    if (!this.config) {
      // Fallback predeterminado
      this.config = {
        clasificacion: { umbrales: { leve: 1, grave: 3, gravisima: 5 } },
        seniales: {
          gravedad_critica: [{ keywords: ["agredió", "golpeó", "empujó", "arma", "cuchillo", "bullying", "falsificó", "robó", "amenazó", "autolesión"] }],
          gravedad_alta: [{ keywords: ["insultó", "acosó", "intimidó", "rompió", "rayó", "copió", "plagio"] }],
          gravedad_leve: [{ keywords: ["no entregó tarea", "no trajo materiales", "uniforme", "llegó tarde", "interrumpió", "celular"] }]
        },
        eventos: {
          cuentan: ["falta_leve", "falta_grave", "falta_gravísima", "negativa", "falta", "inasistencia_injustificada", "atraso_reiterado"],
          no_cuentan: ["justificativo", "entrevista", "observacion", "observacion_neutra", "seguimiento", "positiva", "felicitacion"]
        }
      };
    }
    return this.config;
  },

  getConfig() {
    let custom = null;
    try {
      if (typeof Storage !== 'undefined' && typeof Storage.getItem === 'function') {
        const raw = Storage.getItem('barita_rice_config') || localStorage.getItem('barita_rice_config');
        if (raw) custom = JSON.parse(raw);
      }
    } catch (_e) {}

    return {
      pesoLeve: Number(custom?.pesoLeve ?? 1),
      pesoGrave: Number(custom?.pesoGrave ?? 3),
      pesoGravisima: Number(custom?.pesoGravisima ?? 5),
      levesEscalanGrave: Number(custom?.levesEscalanGrave ?? 3),
      diasVentanaLeve: Number(custom?.diasVentanaLeve ?? 30),
      gravesEscalanGravisima: Number(custom?.gravesEscalanGravisima ?? 2),
      verdeMaxLeves30d: Number(custom?.verdeMaxLeves30d ?? 3),
      amarilloMinLeves30d: Number(custom?.amarilloMinLeves30d ?? 3),
      amarilloMinGraves: Number(custom?.amarilloMinGraves ?? 1),
      rojoMinGravisimas: Number(custom?.rojoMinGravisimas ?? 1),
      rojoMinGraves: Number(custom?.rojoMinGraves ?? 2),
      rojoMinTotalFaltas: Number(custom?.rojoMinTotalFaltas ?? 10),
      desescalarCompromiso: custom?.desescalarCompromiso !== false,
      desescalarGracia: custom?.desescalarGracia !== false,
      diasGracia: Number(custom?.diasGracia ?? 30),
      desescalarManual: custom?.desescalarManual !== false
    };
  },

  /**
   * Clasifica un texto de observación buscando señales clave del RICE 2026.
   * @param {string} texto 
   * @returns {object} { categoria: 'LEVE'|'GRAVE'|'GRAVÍSIMA', peso: number, seniales: string[] }
   */
  clasificarTexto(texto) {
    const cfg = this.getConfig();
    if (!texto || typeof texto !== 'string') {
      return { categoria: 'LEVE', peso: cfg.pesoLeve, seniales: [] };
    }

    const t = texto.toLowerCase();
    const senialesEncontradas = [];

    // 1. Revisar Gravedad Crítica (GRAVÍSIMA)
    const criticas = this.config?.seniales?.gravedad_critica || [];
    for (const item of criticas) {
      const kwMatch = (item.keywords || []).find(kw => t.includes(kw.toLowerCase()));
      if (kwMatch) {
        senialesEncontradas.push(kwMatch);
        return { categoria: 'GRAVÍSIMA', peso: cfg.pesoGravisima, seniales: senialesEncontradas };
      }
    }

    // 2. Revisar Gravedad Alta (GRAVE)
    const altas = this.config?.seniales?.gravedad_alta || [];
    for (const item of altas) {
      const kwMatch = (item.keywords || []).find(kw => t.includes(kw.toLowerCase()));
      if (kwMatch) {
        senialesEncontradas.push(kwMatch);
        return { categoria: 'GRAVE', peso: 3, seniales: senialesEncontradas };
      }
    }

    // 3. Revisar Gravedad Leve (LEVE)
    const leves = this.config?.seniales?.gravedad_leve || [];
    for (const item of leves) {
      const kwMatch = (item.keywords || []).find(kw => t.includes(kw.toLowerCase()));
      if (kwMatch) {
        senialesEncontradas.push(kwMatch);
      }
    }

    return {
      categoria: 'LEVE',
      peso: 1,
      seniales: senialesEncontradas
    };
  },

  /**
   * Evalúa dinámicamente el estado del Semáforo de un estudiante según las fechas de sus registros.
   * @param {string} estudianteId 
   * @returns {object} { color: 'verde'|'amarillo'|'rojo', label: string, badgeHtml: string, detalle: object }
   */
  evaluarEstudiante(estudianteId) {
    const est = Storage.getEstudianteById ? Storage.getEstudianteById(estudianteId) : null;
    if (!est) {
      return { color: 'verde', label: 'Sin Riesgo', badgeHtml: '<span class="badge" style="background:#10b981; color:#fff;">🟢 Verde</span>', detalle: {} };
    }

    // Obtener todas las anotaciones y eventos del estudiante
    const anotaciones = (Storage.cache.anotaciones || []).filter(a => a && (a.estudianteId === estudianteId || a.estudiante_id === estudianteId));
    const eventos = (Storage.cache.eventos || []).filter(e => e && (e.estudianteId === estudianteId || e.estudiante_id === estudianteId));
    
    const todosEventos = [...anotaciones, ...eventos];

    // Filtrar eventos que cuentan para sanción/riesgo (excluir observaciones neutras, entrevistas y positivas)
    const eventosNegativos = todosEventos.filter(e => {
      if (!e || !e.fecha) return false;
      const t = (e.tipo || '').toLowerCase();
      const desc = (e.descripcion || '').toLowerCase();

      // Descartar explícitamente observaciones neutras de inicio/fin y felicitaciones
      if (t === 'positiva' || t === 'felicitacion' || t === 'entrevista') return false;
      if (t === 'observacion' && (desc.includes('inicio de') || desc.includes('fin de'))) return false;

      return (t === 'negativa' || t === 'falta' || e.categoriaFalta || e.gravedad);
    });

    if (eventosNegativos.length === 0) {
      return {
        color: 'verde',
        label: 'Sin Eventos de Riesgo',
        badgeHtml: '<span class="badge" style="background:#10b981; color:#fff;">🟢 Semáforo Verde</span>',
        detalle: { eventos30dias: 0, eventosSemestre: 0, graves: 0, gravisimas: 0 }
      };
    }

    // Calcular la fecha pivote (fecha del último registro o hoy)
    const fechas = eventosNegativos.map(e => new Date(e.fecha).getTime()).filter(t => !isNaN(t));
    const nowTime = fechas.length > 0 ? Math.max(...fechas, Date.now()) : Date.now();

    const cfg = this.getConfig();
    const millisVentanaLeve = cfg.diasVentanaLeve * 24 * 60 * 60 * 1000;
    const millisSemestre = 180 * 24 * 60 * 60 * 1000;
    const millisGracia = cfg.diasGracia * 24 * 60 * 60 * 1000;

    const enVentanaLeve = eventosNegativos.filter(e => (nowTime - new Date(e.fecha).getTime()) <= millisVentanaLeve);
    const en30Dias = eventosNegativos.filter(e => (nowTime - new Date(e.fecha).getTime()) <= (30 * 24 * 60 * 60 * 1000));
    const enSemestre = eventosNegativos.filter(e => (nowTime - new Date(e.fecha).getTime()) <= millisSemestre);

    let leves30Dias = 0;
    let gravesSemestre = 0;
    let gravisimasSemestre = 0;

    enSemestre.forEach(e => {
      const clasif = this.clasificarTexto(e.descripcion || '');
      const cat = e.categoriaFalta || e.gravedad || clasif.categoria;

      if (cat === 'GRAVÍSIMA' || cat === 'gravisima' || clasif.peso >= cfg.pesoGravisima) {
        gravisimasSemestre++;
      } else if (cat === 'GRAVE' || cat === 'grave' || clasif.peso >= cfg.pesoGrave) {
        gravesSemestre++;
      } else {
        if ((nowTime - new Date(e.fecha).getTime()) <= millisVentanaLeve) {
          leves30Dias++;
        }
      }
    });

    // Regla R1: N leves en ventana escalan a 1 GRAVE
    if (cfg.levesEscalanGrave > 0 && leves30Dias >= cfg.levesEscalanGrave) {
      gravesSemestre += Math.floor(leves30Dias / cfg.levesEscalanGrave);
    }

    // Regla R2: N graves en semestre escalan a 1 GRAVÍSIMA
    if (cfg.gravesEscalanGravisima > 0 && gravesSemestre >= cfg.gravesEscalanGravisima) {
      gravisimasSemestre += Math.floor(gravesSemestre / cfg.gravesEscalanGravisima);
    }

    // Evaluar Criterios de Desescalamiento (🔴 Rojo -> 🟡 Amarillo)
    let deescalatedToYellow = false;
    let motivoDesescalamiento = '';

    const cumpleCriterioRojo = (
      gravisimasSemestre >= cfg.rojoMinGravisimas ||
      gravesSemestre >= cfg.rojoMinGraves ||
      enSemestre.length >= cfg.rojoMinTotalFaltas
    );

    if (cumpleCriterioRojo) {
      // 1. Cumplimiento Exitoso de Compromiso Conductual
      if (cfg.desescalarCompromiso && est.compromisoConductualActivo && est.compromisoEstado === 'cumplido') {
        deescalatedToYellow = true;
        motivoDesescalamiento = 'Cumplimiento Exitoso de Compromiso Conductual';
      }

      // 2. Período de Gracia Sostenido (diasGracia sin faltas)
      if (cfg.desescalarGracia && !deescalatedToYellow) {
        if (enVentanaLeve.length === 0 && eventosNegativos.length > 0) {
          const ultimaFaltaTime = Math.max(...fechas);
          if ((nowTime - ultimaFaltaTime) >= millisGracia) {
            deescalatedToYellow = true;
            motivoDesescalamiento = `Período de Gracia Sostenido (${cfg.diasGracia} días sin faltas)`;
          }
        }
      }

      // 3. Cierre de Seguimiento Restaurativo / Manual
      if (cfg.desescalarManual && !deescalatedToYellow) {
        if (est.enSeguimiento === false || est.cierreRestaurativo === true) {
          deescalatedToYellow = true;
          motivoDesescalamiento = 'Cierre de Seguimiento Restaurativo';
        }
      }
    }

    // Determinación del Semáforo RICE
    let color = 'verde';
    let label = '🟢 Verde (Bajo Riesgo)';
    let badgeHtml = '<span class="badge" style="background:#10b981; color:#fff; font-weight:600; padding:0.4rem 0.8rem; border-radius:12px;">🟢 Semáforo Verde</span>';

    if (cumpleCriterioRojo && !deescalatedToYellow) {
      color = 'rojo';
      label = '🔴 Rojo (Caso Crítico)';
      badgeHtml = '<span class="badge" style="background:#ef4444; color:#fff; font-weight:600; padding:0.4rem 0.8rem; border-radius:12px;">🔴 Semáforo Rojo (Caso Crítico)</span>';
      
      // Auto-generar / sincronizar en Casos Activos SIN alertas por correo
      this.sincronizarCasoActivo(estudianteId, `Activación por Semáforo Rojo (${gravisimasSemestre} Gravísima / ${gravesSemestre} Grave / ${enSemestre.length} Faltas totales)`, {
        leves30Dias,
        gravesSemestre,
        gravisimasSemestre,
        eventosSemestre: enSemestre.length
      });
    } else if (
      deescalatedToYellow || 
      leves30Dias >= cfg.amarilloMinLeves30d || 
      gravesSemestre >= cfg.amarilloMinGraves || 
      enVentanaLeve.length >= cfg.amarilloMinLeves30d ||
      est.enSeguimiento ||
      est.requiereApoyoPsicosocial ||
      est.planUtpActivo
    ) {
      color = 'amarillo';
      label = '🟡 Amarillo (Riesgo Medio)';
      badgeHtml = '<span class="badge" style="background:#f59e0b; color:#fff; font-weight:600; padding:0.4rem 0.8rem; border-radius:12px;">🟡 Semáforo Amarillo</span>';
      
      if (deescalatedToYellow) {
        this.registrarBitacoraDesescalamiento(est, motivoDesescalamiento);
      }
    }

    return {
      color,
      label,
      badgeHtml,
      detalle: {
        eventos30dias: en30Dias.length,
        eventosSemestre: enSemestre.length,
        leves30Dias,
        gravesSemestre,
        gravisimasSemestre
      }
    };
  },

  /**
   * Calcula la fecha de próximo seguimiento sumando días calendario y ajustando a día hábil (Lunes a Viernes).
   */
  calcularProximoDiaHabil(diasASumar = 3) {
    let d = new Date();
    d.setDate(d.getDate() + diasASumar);
    // 0 = Domingo, 6 = Sábado
    if (d.getDay() === 6) { // Sábado -> Lunes (+2 días)
      d.setDate(d.getDate() + 2);
    } else if (d.getDay() === 0) { // Domingo -> Lunes (+1 día)
      d.setDate(d.getDate() + 1);
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Registra automáticamente en la Bitácora del estudiante el evento de desescalamiento de Semáforo Rojo a Amarillo.
   */
  async registrarBitacoraDesescalamiento(est, motivo) {
    if (!est) return;
    if (!Array.isArray(est.bitacoraSeguimiento)) est.bitacoraSeguimiento = [];

    const textoBitacora = `🟡 Cambio de Estado Semáforo RICE: El estudiante desescala a Semáforo Amarillo (${motivo}).`;
    const ultimaEntradaRice = est.bitacoraSeguimiento.find(b => b && b.texto && (b.texto.includes('Semáforo Amarillo') || b.texto.includes('Semáforo Rojo')));
    const yaExiste = ultimaEntradaRice && ultimaEntradaRice.texto.includes('Semáforo Amarillo');

    if (!yaExiste) {
      est.bitacoraSeguimiento.unshift({
        id: 'bit_desesc_' + Date.now(),
        fecha: new Date().toISOString(),
        texto: textoBitacora,
        registradoPor: 'Sistema RICE 2026'
      });
      if (Storage.saveEstudiante) {
        await Storage.saveEstudiante(est);
      }
    }
  },

  /**
   * Marca al estudiante como "Estudiante en Seguimiento" (enSeguimiento = true) al pasar a Semáforo Rojo
   * e ingresa automáticamente el evento en la Bitácora describiendo la cantidad de faltas leves y graves.
   */
  async sincronizarCasoActivo(estudianteId, motivo, detalle = {}) {
    const est = Storage.getEstudianteById ? Storage.getEstudianteById(estudianteId) : null;
    if (!est) return;

    // Marcar como estudiante en seguimiento (NO como estudiante complejo con protocolos)
    est.enSeguimiento = true;
    est.esComplejo = false;

    // Calcular próximo seguimiento en día hábil (lunes a viernes)
    const proximaFechaHabil = this.calcularProximoDiaHabil(3);
    est.fechaProximoSeguimiento = proximaFechaHabil;
    est.proximoSeguimiento = proximaFechaHabil;

    // Crear registro en la Bitácora de seguimiento describiendo faltas leves y graves
    if (!Array.isArray(est.bitacoraSeguimiento)) {
      est.bitacoraSeguimiento = [];
    }

    const leves = detalle.leves30Dias || 0;
    const graves = detalle.gravesSemestre || 0;
    const gravisimas = detalle.gravisimasSemestre || 0;

    const textoInicio = `🔴 Inicio de Seguimiento por Semáforo Rojo (RICE 2026): El estudiante presenta ${leves} falta(s) leve(s) en 30 días, ${graves} falta(s) grave(s) y ${gravisimas} falta(s) gravísima(s) en el semestre. Se da inicio formal al proceso de seguimiento.`;

    const ultimaEntradaRice = est.bitacoraSeguimiento.find(b => b && b.texto && (b.texto.includes('Semáforo Amarillo') || b.texto.includes('Semáforo Rojo')));
    const yaExiste = ultimaEntradaRice && ultimaEntradaRice.texto.includes('Semáforo Rojo');
    if (!yaExiste) {
      est.bitacoraSeguimiento.unshift({
        id: 'bit_rice_' + Date.now(),
        fecha: new Date().toISOString(),
        fechaProximoSeguimiento: proximaFechaHabil,
        texto: textoInicio,
        registradoPor: 'Sistema RICE 2026'
      });
    }

    if (Storage.saveEstudiante) {
      await Storage.saveEstudiante(est);
    }
  },

  /**
   * Evalúa la vigencia y cumplimiento del Compromiso Conductual Activo de Anotaciones de un estudiante.
   * Si detecta una anotación negativa dentro del rango de vigencia, cambia el estado a 'incumplido'.
   * Si la fecha actual sobrepasa la fecha de término sin anotaciones negativas, cambia a 'cumplido'.
   */
  evaluarCompromisoEstudiante(estudianteId) {
    const est = Storage.getEstudianteById ? Storage.getEstudianteById(estudianteId) : null;
    if (!est || !est.compromisoConductualActivo) return null;

    const fInicioStr = est.compromisoFechaInicio;
    const fTerminoStr = est.compromisoFechaTermino;
    if (!fInicioStr || !fTerminoStr) return null;

    // Normalizar a cadenas YYYY-MM-DD locales evitando desfases por UTC
    const toYMD = (val) => {
      if (!val) return '';
      if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
        return val.substring(0, 10);
      }
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val).substring(0, 10);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const ymdInicio = toYMD(fInicioStr);
    const ymdTermino = toYMD(fTerminoStr);

    // Timestamps de inicio (00:00:00) y término (23:59:59) en tiempo local
    const startParts = ymdInicio.split('-').map(Number);
    const endParts = ymdTermino.split('-').map(Number);
    
    const startTime = new Date(startParts[0], startParts[1] - 1, startParts[2], 0, 0, 0, 0).getTime();
    const endTime = new Date(endParts[0], endParts[1] - 1, endParts[2], 23, 59, 59, 999).getTime();

    // Si existe fecha/hora de creación del compromiso, usarla para descartar eventos del mismo día registrados ANTES de crear el compromiso
    const compromisoCreadoAt = est.compromisoCreadoAt ? new Date(est.compromisoCreadoAt).getTime() : startTime;

    // Buscar anotaciones negativas del estudiante que realmente existan en caché
    const anotaciones = (Storage.cache.anotaciones || []).filter(a => a && String(a.estudianteId || a.estudiante_id) === String(estudianteId));
    const eventos = (Storage.cache.eventos || []).filter(e => e && String(e.estudianteId || e.estudiante_id) === String(estudianteId));
    const todos = [...anotaciones, ...eventos];

    const infraccion = todos.find(e => {
      if (!e || !e.fecha) return false;
      const t = (e.tipo || '').toLowerCase();
      const desc = (e.descripcion || '').toLowerCase();

      // Es anotación negativa si tipo es 'negativa' / 'falta' o posee categoría de falta
      const esNegativa = (t === 'negativa' || t === 'falta' || e.categoriaFalta || e.gravedad) &&
                         t !== 'positiva' && t !== 'felicitacion' && t !== 'entrevista' &&
                         !(t === 'observacion' && (desc.includes('inicio de') || desc.includes('fin de')));

      if (!esNegativa) return false;

      const ymdEvento = toYMD(e.fecha);
      const eventTime = new Date(e.fecha).getTime();

      // 1. Evaluación por Rango de Fechas (Inicio <= Evento <= Término)
      const enRangoFechas = ymdEvento >= ymdInicio && ymdEvento <= ymdTermino;
      if (!enRangoFechas) return false;

      // 2. Si el evento ocurrió el mismo día de inicio, verificar que no haya sido ANTES de la creación del compromiso
      if (!isNaN(eventTime) && !isNaN(compromisoCreadoAt) && ymdEvento === ymdInicio) {
        if (eventTime < compromisoCreadoAt) return false;
      }

      return true;
    });

    const nowD = new Date();
    const nowIso = `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, '0')}-${String(nowD.getDate()).padStart(2, '0')}`;

    if (!Array.isArray(est.bitacoraSeguimiento)) est.bitacoraSeguimiento = [];

    if (infraccion) {
      // FIX vinculado: si el seguimiento fue reprogramado a futuro (ampliación), no marcar como incumplido hoy — esperar a nueva fecha
      // Check 1: fechaProximoSeguimiento futuro => vigencia extendida, la infra anterior se considera atendida/reprogramada
      const proximaYMD = toYMD(est.fechaProximoSeguimiento || est.fechaProximo || est.proximoSeguimiento || '');
      if (proximaYMD && proximaYMD > nowIso) {
        // si el próximo seguimiento es futuro y existe bitácora de ampliación/seg. posterior a la infra, considerar vigente
        const infraTime = new Date(infraccion.fecha).getTime();
        const tieneAmpliacionFutura = Array.isArray(est.bitacoraSeguimiento) && est.bitacoraSeguimiento.some(b=>{
          if (!b || !b.texto || !b.fecha) return false;
          const txt = String(b.texto).toLowerCase();
          const esAmpli = txt.includes('ampliac') || txt.includes('compromiso') || (b.fechaProximoSeguimiento && toYMD(b.fechaProximoSeguimiento)===proximaYMD);
          if (!esAmpli) return false;
          const bTime = new Date(b.fecha).getTime();
          return !isNaN(bTime) && bTime > infraTime;
        });
        if (tieneAmpliacionFutura) {
          if (est.compromisoEstado !== 'vigente') {
            est.compromisoEstado = 'vigente';
            if (Storage.saveEstudiante) Storage.saveEstudiante(est);
          }
          return { estado: 'vigente' };
        }
      }
      // Formatear estrictamente la fecha real del evento
      const ymdInf = toYMD(infraccion.fecha);
      const partsInf = ymdInf.split('-');
      const fInfraccionFormated = partsInf.length === 3 ? `${partsInf[2]}/${partsInf[1]}/${partsInf[0]}` : ymdInf;

      const textoInfraccion = `🔴 Compromiso Incumplido: Se registra ruptura del compromiso debido a anotación negativa con fecha ${fInfraccionFormated}.`;
      
      const yaExisteInfraccionBit = est.bitacoraSeguimiento.some(b => b && b.texto && b.texto.includes(`con fecha ${fInfraccionFormated}`));
      if (!yaExisteInfraccionBit) {
        est.bitacoraSeguimiento.unshift({
          id: 'bit_comp_inc_' + Date.now(),
          fecha: new Date().toISOString(),
          texto: textoInfraccion,
          registradoPor: 'Sistema'
        });
      }

      if (est.compromisoEstado !== 'incumplido') {
        est.compromisoEstado = 'incumplido';
      }
      if (Storage.saveEstudiante) Storage.saveEstudiante(est);

      return {
        estado: 'incumplido',
        infraccionFecha: fInfraccionFormated,
        infraccionDesc: infraccion.descripcion
      };
    } else if (nowIso > fTerminoStr) {
      // Si el compromiso ya expiró en fecha sin anotaciones negativas,
      // no lo cerramos ni escribimos en bitácora de forma automática (evitamos auto-cierre).
      // Retornamos que está cumplido pero pendiente de alta manual por el usuario.
      return {
        estado: 'cumplido_pendiente'
      };
    } else {
      if (est.compromisoEstado !== 'vigente') {
        est.compromisoEstado = 'vigente';
        if (Storage.saveEstudiante) Storage.saveEstudiante(est);
      }
      return {
        estado: 'vigente'
      };
    }
  }
};

// Inicializar motor RICE al cargar el script
RICEEngine.init();
window.RICEEngine = RICEEngine;
