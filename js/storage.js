/* ================================================================
   storage.js — Conexión con Firebase Firestore
   Reemplaza a localStorage. Mantiene una caché en memoria
   sincronizada en tiempo real.
   ================================================================ */
// Helper fechas BARITA — zona horaria negocio America/Santiago (evita corrida UTC)
const BARITA_TZ = 'America/Santiago';
const BARITA_hoyChileISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: BARITA_TZ }).format(new Date());
const BARITA_nowChileYear = () => new Intl.DateTimeFormat('en-CA', { timeZone: BARITA_TZ, year: 'numeric' }).format(new Date());
const BARITA_toChileDateKey = (d) => {
  try { const dt = d instanceof Date ? d : new Date(d); if (isNaN(dt)) return String(d||''); return new Intl.DateTimeFormat('en-CA', { timeZone: BARITA_TZ }).format(dt); } catch(_e){ return String(d||''); }
};
try{ window.BARITA_hoyChileISO=BARITA_hoyChileISO; window.BARITA_nowChileYear=BARITA_nowChileYear; window.BARITA_toChileDateKey=BARITA_toChileDateKey; window.BARITA_TZ=BARITA_TZ; }catch(_e){}

const Storage = {
  cache: {
    estudiantes: [],
    anotaciones: [],
    funcionarios: [],
    acciones: [],
    eventos: [],
    casos: [],
    protocolos_activos: [],
    documentos: [],
    config: {},
    atrasos: [],
    inasistencias: [],
    alertas_utp: [],
    gestiones_asistencia: [],
    alertas_inspectoria: [],
    notas_colaborativas: [],
    nota_comentarios: []
  },
  activeSchool: localStorage.getItem('barita_active_school') || 'demo',
  activeYear: BARITA_nowChileYear(),
  listeners: [],
  isReady: false,
  localMutations: { estudiantes: {}, anotaciones: {}, eventos: {}, casos: {}, funcionarios: {}, protocolos_activos: {} },
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,

  getSchoolProfile() {
    const key = `barita_school_profile_${this.activeSchool}`;
    let profile = { nombre: 'Escuela Demo', logo: '' };
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        profile = JSON.parse(stored);
      } else if (this.cache.config && this.cache.config.schoolProfile) {
        profile = this.cache.config.schoolProfile;
      }
    } catch (_e) {}

    if (!profile.nombre || profile.nombre === 'Escuela Demo') {
      if (this.activeSchool === 'terra_di_bimbi') profile.nombre = 'TERRA DI BIMBI';
      else if (this.activeSchool === 'escuela_demo' || this.activeSchool === 'demo') profile.nombre = 'ESCUELA DEMO';
      else profile.nombre = 'BARITA';
    }
    return profile;
  },

  getGeminiApiKey() {
    // Fase 3: Desactivado — GEMINI_API_KEY solo en Vercel Env, nunca en localStorage (B8)
    return '';
  },

  async saveGeminiApiKey(apiKey) {
    // Fase 3: No guardar en localStorage. AdminLocalView ahora usa /api proxy; si llega apiKey aquí, solo limpiar restos sensibles
    try {
      localStorage.removeItem(`barita_gemini_key_${this.activeSchool || 'demo'}`);
      localStorage.removeItem('barita_gemini_key_global');
      localStorage.removeItem('barita_gemini_key');
      localStorage.removeItem('gemini_api_key');
      localStorage.removeItem('barita_last_working_gemini_model');
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.includes('gemini') || k.includes('barita_gemini'))) localStorage.removeItem(k);
      }
    } catch (_e) {}
    if (this.cache.config) delete this.cache.config.geminiApiKey;
    window.GEMINI_API_KEY = '';
    return '';
  },

  async saveSchoolProfile(data) {
    const key = `barita_school_profile_${this.activeSchool}`;
    const current = this.getSchoolProfile();
    const updated = {
      nombre: data.nombre !== undefined ? data.nombre : current.nombre,
      logo: data.logo !== undefined ? data.logo : current.logo
    };

    try {
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (_e) {}

    try {
      if (!this.cache.config) this.cache.config = {};
      this.cache.config.schoolProfile = updated;
      const client = (typeof window.getSupabaseClient === 'function') ? window.getSupabaseClient() : null;
      if (client && !Auth.currentUser?.uid?.startsWith('test-user')) {
        await client.from('config').upsert({
          key: `school_${this.activeSchool}`,
          valor: updated
        });
      }
    } catch (e) {
      console.warn('Error guardando perfil de colegio en Supabase:', e);
    }

    return updated;
  },

  async loadSchoolProfileFromDB(schoolId) {
    const targetSchool = schoolId || this.activeSchool || 'demo';
    const key = `barita_school_profile_${targetSchool}`;
    try {
      const client = (typeof window.getSupabaseClient === 'function') ? window.getSupabaseClient() : null;
      if (client) {
        const { data, error } = await client.from('config').select('*').eq('key', `school_${targetSchool}`).maybeSingle();
        if (data && data.valor && !error) {
          if (!this.cache.config) this.cache.config = {};
          this.cache.config.schoolProfile = data.valor;
          try { localStorage.setItem(key, JSON.stringify(data.valor)); } catch (_e) {}
          return data.valor;
        }
      }
    } catch (e) {
      console.warn('Error cargando perfil de colegio desde Supabase DB:', e);
    }
    return this.getSchoolProfile();
  },

  loadLocalMutations() {
    try {
      const schoolKey = (this.activeSchool || 'demo').toString().trim();
      const stored = localStorage.getItem(`barita_local_mutations_${schoolKey}`) || localStorage.getItem('barita_local_mutations');
      if (stored) {
        this.localMutations = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Error loading local mutations', e);
    }
  },
  
  persistLocalMutations() {
    try {
      // No persistir RUT en localStorage (PII)
      const clone = JSON.parse(JSON.stringify(this.localMutations));
      if (clone.estudiantes) {
        Object.values(clone.estudiantes).forEach(e => { if (e) delete e.rut; delete e.rut_completo; });
      }
      const schoolKey = (this.activeSchool || 'demo').toString().trim();
      localStorage.setItem(`barita_local_mutations_${schoolKey}`, JSON.stringify(clone));
    } catch (e) {
      console.warn('Error saving local mutations', e);
    }
  },

  injectColegioId(item) {
    if (item && typeof item === 'object') {
      const existing = (item.colegio_id || item.colegioId || '').toString().trim();
      const active = existing || (Storage.activeSchool || 'demo').toString().trim();
      item.colegioId = active;
      item.colegio_id = active;
      if (item.funcionarioId) item.funcionario_id = item.funcionarioId;
      if (item.funcionario_id) item.funcionarioId = item.funcionario_id;
      if (item.autorId) item.autor_id = item.autorId;
      if (item.autor_id) item.autorId = item.autor_id;
      if (item.registradoPor) item.registrado_por = item.registradoPor;
      if (item.registrado_por) item.registradoPor = item.registrado_por;
      if (item.estudianteId) item.estudiante_id = item.estudianteId;
      if (item.estudiante_id) item.estudianteId = item.estudiante_id;
      if (item.categoria_falta) item.categoriaFalta = item.categoria_falta;
      if (item.categoriaFalta) item.categoria_falta = item.categoriaFalta;
      if (item.fecha_hora) item.fechaHora = item.fecha_hora;
      if (item.fechaHora) item.fecha_hora = item.fechaHora;
      if (item.organizador_email) item.organizadorEmail = item.organizador_email;
      if (item.organizadorEmail) item.organizador_email = item.organizadorEmail;
      if (item.organizador_nombre) item.organizadorNombre = item.organizador_nombre;
      if (item.organizadorNombre) item.organizador_nombre = item.organizadorNombre;

      // Casos fields mappings (camelCase <-> snake_case)
      if (item.estudiantesInvolucrados) item.estudiantes_involucrados = item.estudiantesInvolucrados;
      if (item.estudiantes_involucrados) item.estudiantesInvolucrados = item.estudiantes_involucrados;
      if (item.proximoSeguimiento) item.proximo_seguimiento = item.proximoSeguimiento;
      if (item.proximo_seguimiento) item.proximoSeguimiento = item.proximo_seguimiento;
      if (item.fechaProximoSeguimiento) item.proximo_seguimiento = item.fechaProximoSeguimiento;
      if (item.proximo_seguimiento) item.fechaProximoSeguimiento = item.proximo_seguimiento;

      if (item.fecha_nacimiento) {
        item.fechaNacimiento = item.fecha_nacimiento;
        item.fechaCumpleanos = item.fecha_nacimiento;
      }

      let meta = item.metadata;
      if (typeof meta === 'string') {
        try { meta = JSON.parse(meta); } catch (_e) { meta = {}; }
      }
      if (meta && typeof meta === 'object') {
        item.metadata = meta;
        if (meta.enSeguimiento !== undefined) item.enSeguimiento = meta.enSeguimiento;
        if (meta.esComplejo !== undefined) item.esComplejo = meta.esComplejo;
        if (meta.requiereApoyoPsicosocial !== undefined) item.requiereApoyoPsicosocial = meta.requiereApoyoPsicosocial;
        if (meta.planUtpActivo !== undefined) item.planUtpActivo = meta.planUtpActivo;
        if (meta.medidasPie !== undefined) item.medidasPie = meta.medidasPie;
        if (meta.esEstudiantePIE !== undefined) item.esEstudiantePIE = meta.esEstudiantePIE;
        if (meta.paci !== undefined) item.paci = meta.paci;
        if (meta.atrasoJustificadoGeneral !== undefined) item.atrasoJustificadoGeneral = meta.atrasoJustificadoGeneral;
        if (meta.justificadoGeneral !== undefined) item.justificadoGeneral = meta.justificadoGeneral;
        if (meta.razonJustificacionGeneral !== undefined) item.razonJustificacionGeneral = meta.razonJustificacionGeneral;
        if (meta.obsJustificacionGeneral !== undefined) item.obsJustificacionGeneral = meta.obsJustificacionGeneral;
        if (meta.bitacoraSeguimiento !== undefined) item.bitacoraSeguimiento = meta.bitacoraSeguimiento;
        if (meta.fechaProximoSeguimiento !== undefined) item.fechaProximoSeguimiento = meta.fechaProximoSeguimiento;
        if (meta.proximoSeguimiento !== undefined) item.proximoSeguimiento = meta.proximoSeguimiento;
        if (meta.fechaProximo !== undefined) item.fechaProximo = meta.fechaProximo;
        
        // Unpack Compromiso Conductual metadata
        if (meta.compromisoConductualActivo !== undefined) item.compromisoConductualActivo = meta.compromisoConductualActivo;
        if (meta.compromisoFechaInicio !== undefined) item.compromisoFechaInicio = meta.compromisoFechaInicio;
        if (meta.compromisoFechaTermino !== undefined) item.compromisoFechaTermino = meta.compromisoFechaTermino;
        if (meta.compromisoEstado !== undefined) item.compromisoEstado = meta.compromisoEstado;
        if (meta.compromisoCreadoAt !== undefined) item.compromisoCreadoAt = meta.compromisoCreadoAt;

        if (meta.fechaCumpleanos && !item.fechaCumpleanos) {
          item.fechaCumpleanos = meta.fechaCumpleanos;
          item.fechaNacimiento = meta.fechaCumpleanos;
        }
      }

      if (item.induccion && typeof item.induccion === 'string') {
        try { item.induccion = JSON.parse(item.induccion); } catch (_e) { item.induccion = {}; }
      }

      if (item.id && typeof item.id === 'string') {
        item.id = item.id.trim();
      }
    }
    return item;
  },

  async setSchool(schoolId) {
    let targetSchool = schoolId;
    // Si está impersonando, bloquear cambio de colegio fuera del colegio emulado
    try{
      const origRaw = (typeof sessionStorage!=='undefined') ? sessionStorage.getItem('superadmin_original') : null;
      if(origRaw && typeof Auth!=='undefined' && Auth.currentRole !== 'superadmin' && Auth.userProfile){
        const impersonatedColegio = (Auth.userProfile.colegio_id || Auth.userProfile.colegioId || '').toString().trim() || (this.activeSchool||'').toString().trim();
        if(impersonatedColegio && schoolId !== impersonatedColegio){
          console.warn('Bloqueo tenant hopping en modo emulación:', schoolId, '->', impersonatedColegio);
          App.showToast('Colegio bloqueado en modo emulación','warning');
          return Promise.resolve();
        }
        targetSchool = impersonatedColegio || targetSchool;
      }
    }catch(_e){}
    
    // Strict Tenant Isolation: Non-superadmin users are locked to their profile's assigned colegio_id
    if (typeof Auth !== 'undefined' && Auth.currentRole && Auth.currentRole !== 'superadmin' && Auth.userProfile) {
      const assigned = (Auth.userProfile.colegio_id || Auth.userProfile.colegioId || '').toString().trim();
      if (assigned) {
        targetSchool = assigned;
      }
    }

    // Throttle: evita re-fetch en cada focus si mismo colegio y hace <30s
    if (this.activeSchool === targetSchool && this.isReady && this._lastSyncAt && Date.now() - this._lastSyncAt < 30000) return Promise.resolve();

    this.activeSchool = targetSchool;
    try { localStorage.setItem('barita_active_school', targetSchool); } catch (_e) {}
    this.clearListeners();
    this.isReady = false;
    // Clear cache
    Object.keys(this.cache).forEach(k => {
      if (k === 'config') this.cache[k] = {};
      else this.cache[k] = [];
    });
    if (typeof AsistenciaView !== 'undefined') {
      AsistenciaView.atrasosCache = [];
      AsistenciaView.inasistenciasCache = [];
      AsistenciaView.isFetched = false;
    }
    return this.initRealtimeSync();
  },

  async setActiveSchool(schoolId) {
    return this.setSchool(schoolId);
  },

  setActiveYear(anio) {
    this.activeYear = String(anio);
    try { localStorage.setItem('barita_active_year', this.activeYear); } catch (_e) {}
  },

  getActiveYear() {
    return this.activeYear || BARITA_nowChileYear();
  },

  _filterByYear(arr) {
    const year = String(this.getActiveYear());
    if (!Array.isArray(arr)) return [];
    return arr.filter(item => {
      if (item.anio && String(item.anio) === year) return true;
      if (item.year && String(item.year) === year) return true;
      const rawFecha = (item.fecha || item.fechaCreacion || item.fechaActivacion || '');
      if (rawFecha) {
        const chileKey = BARITA_toChileDateKey(rawFecha);
        if (chileKey.startsWith(year)) return true;
      }
      // Si no hay fecha ni año, no incluir (evita contaminar año)
      return false;
    });
  },

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },
  textNode(el, str) {
    if (!el) return;
    el.textContent = str;
  },
  safeHtml(html) {
    if (typeof html !== 'string') return '';
    if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) {
      return DOMPurify.sanitize(html);
    }
    return this.escapeHtml(html);
  },
};

/* Global shorthand for XSS-safe string escaping */
function S(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

Object.assign(Storage, {

  async initRealtimeSync() {
    if (window.Auth && Auth.isLoggingOut) return Promise.resolve();
    // Throttle: evita loop en cada visibilitychange (30s) y si ya hay sync en progreso
    if (this._syncInProgress) return Promise.resolve();
    if (this._lastSyncAt && Date.now() - this._lastSyncAt < 30000) return Promise.resolve();
    this._syncInProgress = true;
    this._lastSyncAt = Date.now();
    this.loadLocalMutations();
    // FIX: no bloquear re-fetch si ya está ready (evita fantasma tras cerrar)

    return new Promise(async (resolve) => {
      const collections = [
        'config', 'cursos', 'estudiantes', 'funcionarios', 'acciones', 'anotaciones',
        'casos', 'eventos', 'atrasos', 'inasistencias', 'alertas_asistencia', 'alertas_utp',
        'gestiones_asistencia', 'alertas_inspectoria', 'derivaciones', 'eventos_agenda',
        'documentos', 'usuarios', 'matriculas_anuales', 'dotacion_anual', 'caso_anotaciones'
      ];
      const client = (typeof window.getSupabaseClient === 'function')
        ? window.getSupabaseClient()
        : window.supabaseGestion;
      const targetCollections = [...collections];

      try {
        const activeId = Storage.activeSchool || 'demo';
        // Collections that are global (not tenant-scoped)
        const globalCollections = ['colegios', 'config'];

        await Promise.all(targetCollections.map(async (col) => {
          let query = client.from(col).select('*');

          // Server-side multi-tenant filter for all tenant-scoped tables that are not global
          if (!globalCollections.includes(col)) {
            query = query.eq('colegio_id', activeId);
          }

          const { data, error } = await query;
          if (error) {
             // Fallback eliminado: no exponer cross-tenant si falta columna (falla cerrado)
             if (window.BARITA_DEBUG) console.warn(`[Tenant] skip ${col}:`, error.message);
             return;
          }
          
          let fetchedData = data;
          let filteredData = (fetchedData || []).map(item => {
             const injected = Storage.injectColegioId(item);
             if (col === 'eventos_agenda' && injected) {
                 injected.fechaHora = injected.fechaHora || injected.fecha_para_orden || injected.fecha_hora;
                 injected.duracionMinutos = injected.duracionMinutos || injected.duracion_minutos || 60;
             }
             return injected;
          });
          
          // Client-side multi-tenant filter (permisivo para compat demo/nulos, evita bugeo de página vacía)
          if (!globalCollections.includes(col) && col !== 'estudiantes' && col !== 'funcionarios') {
            filteredData = filteredData.filter(item => {
               const itemSchool = (item.colegio_id || item.colegioId || '').toString().trim();
               return !itemSchool || itemSchool === activeId;
            });
          }

          // Local mutations
          if (this.localMutations && this.localMutations[col]) {
            const activeId = Storage.activeSchool || 'demo';
            filteredData.forEach(item => {
              if (this.localMutations[col][item.id]) {
                Object.assign(item, this.localMutations[col][item.id]);
              }
            });
            Object.values(this.localMutations[col]).forEach(localItem => {
              const localSchool = (localItem.colegioId || localItem.colegio_id || activeId).toString().trim();
              if (localSchool === activeId && !filteredData.find(d => d.id === localItem.id)) {
                filteredData.push(localItem);
              }
            });
          }

          // Code-level purge for bugged test entries (dsda, dasdas, dsada, adas)
          filteredData = filteredData.filter(item => {
            if (!item) return false;
            const testValues = ['dsda', 'dasdas', 'dsada', 'adas'];
            const id = String(item.id || '').toLowerCase().trim();
            if (testValues.includes(id)) return false;
            
            const name = `${item.nombres || ''} ${item.apellidos || ''}`.toLowerCase().trim();
            if (testValues.some(val => name === val || name.startsWith(val + ' '))) return false;
            
            return true;
          });
          
          if (col === 'config') {
            const mainDoc = filteredData.find(d => d.id === 'main');
            this.cache[col] = mainDoc || (filteredData.length > 0 ? filteredData[0] : {});
          } else {
            this.cache[col] = filteredData;
          }
        }));
        
        this.isReady = true;
        try { localStorage.setItem('barita_last_sync_date', BARITA_hoyChileISO()); } catch (_e) {}

        if (!localStorage.getItem('barita_limpieza_general_v1')) {
          localStorage.setItem('barita_limpieza_general_v1', 'true');
          this.limpiezaGeneralPruebas();
        }
        
        if (typeof App !== 'undefined' && App.initialized) {
          // No destruir modal si está abierto: silentSync preserva portal
          let modalOpen = !!window.__baritaQuickModalOpen;
          try {
            if (!modalOpen) {
              const qm = document.getElementById('quick-seguimiento-modal');
              if (qm && (qm.style.display !== 'none' && !qm.classList.contains('hidden') || qm.classList.contains('is-open') || qm.dataset.wasOpen==='1')) modalOpen = true;
            }
            if (!modalOpen) {
              const ctxRaw = sessionStorage.getItem('barita_quick_modal_ctx');
              const ctx = ctxRaw ? JSON.parse(ctxRaw) : null;
              if (ctx && ctx.isOpen && Date.now() - (ctx.ts||0) < 86400000) modalOpen = true;
            }
            if (!modalOpen) {
              for(let i=0;i<sessionStorage.length;i++){ const k=sessionStorage.key(i); if(k&&k.startsWith('barita_quick_draft_')){ try{ const d=JSON.parse(sessionStorage.getItem(k)||'{}'); if(d&&d.isOpen&&Date.now()-d.ts<86400000){ modalOpen=true; break; } }catch(_e){} } }
            }
          } catch(_e) {}
          if (!modalOpen) App.handleRoute(true);
          else {
            // solo refrescar sidebar, no vista
            try{ App.renderSidebar(); }catch(_e){}
            try{ App.renderHeaderActions(); }catch(_e){}
          }
        }
        await this.syncLocalMutationsToServer();
        this._syncInProgress = false;
        resolve();
      } catch (err) {
        this.isReady = true;
        this._syncInProgress = false;
        resolve();
      }
    });
  },

  async syncLocalMutationsToServer() {
    if (window.BARITA_DEBUG) console.debug("Iniciando sincronización de mutaciones locales pendientes hacia Supabase...");
    const client = (typeof window.getSupabaseClient === 'function')
      ? window.getSupabaseClient()
      : window.supabaseGestion;
    if (!client) return;

    // Sincronizar anotaciones
    if (this.localMutations && this.localMutations.anotaciones) {
      const ids = Object.keys(this.localMutations.anotaciones);
      if (ids.length === 0) return;
      for (const id of ids) {
        const anot = this.localMutations.anotaciones[id];
        try {
          const payload = this.prepareAnotacionPayload(anot);
          const { error } = await client.from('anotaciones').upsert(payload);
          if (!error) {
            if (window.BARITA_DEBUG) console.debug(`Mutación local de anotación ${id} sincronizada con éxito en el servidor.`);
            // Evict para no re-sincronizar en cada visibilitychange
            delete this.localMutations.anotaciones[id];
            this.persistLocalMutations();
          } else {
            console.warn(`Error al sincronizar anotación ${id}:`, error.message);
          }
        } catch (e) {
          console.warn(`Excepción al sincronizar anotación ${id}:`, e);
        }
      }
    }
  },

  async limpiezaGeneralPruebas() {
    console.log("Iniciando Limpieza General de Datos de Prueba (asistencias, atrasos, casos, bitácoras)...");
    
    // 1. Vaciar mutaciones locales
    this.localMutations.casos = {};
    this.localMutations.anotaciones = {};
    this.localMutations.acciones = {};
    this.localMutations.eventos = {};
    this.localMutations.protocolos_activos = {};
    this.localMutations.atrasos = {};
    this.localMutations.inasistencias = {};
    this.localMutations.asistencia_diaria = {};
    this.localMutations.asistencia_atrasos = {};
    this.localMutations.justificativos = {};
    this.persistLocalMutations();

    // 2. Vaciar cachés en RAM
    this.cache.casos = [];
    this.cache.anotaciones = [];
    this.cache.acciones = [];
    this.cache.eventos = [];
    this.cache.protocolos_activos = [];
    this.cache.atrasos = [];
    this.cache.inasistencias = [];
    this.cache.asistencia_diaria = [];
    this.cache.asistencia_atrasos = [];
    this.cache.justificativos = [];

    // Resetear cachés del módulo AsistenciaView si está cargado
    if (typeof AsistenciaView !== 'undefined') {
      AsistenciaView.atrasosCache = [];
      AsistenciaView.inasistenciasCache = [];
      AsistenciaView.isFetched = false;
    }

    // 3. Vaciar tablas de prueba en Supabase DB
    try {
      const client = window.getSupabaseClient();
      if (client) {
        const tablas = [
          'casos',
          'anotaciones',
          'eventos',
          'acciones',
          'asistencia_diaria',
          'asistencia_atrasos',
          'atrasos',
          'inasistencias',
          'justificativos',
          'clima_laboral',
          'eventos_agenda',
          'derivaciones',
          'alertas_utp',
          'alertas_inspectoria',
          'protocolos_activos'
        ];
        const activeSchool = (this.activeSchool || 'demo').toString().trim();
        for (const tabla of tablas) {
          try {
            await client.from(tabla).delete().eq('colegio_id', activeSchool).neq('id', 'imposible_id_9999');
          } catch (_e) {}
        }
      }
    } catch (_e) {}

    // 4. Limpiar bitacoraSeguimiento y banderas en todos los estudiantes manteniéndolos a ellos
    const estudiantes = (this.cache.estudiantes || []).slice();
    for (const est of estudiantes) {
      est.enSeguimiento = false;
      est.esComplejo = false;
      est.requiereApoyoPsicosocial = false;
      est.planUtpActivo = false;
      est.medidasPie = false;
      est.bitacoraSeguimiento = [];
      await this.saveEstudiante(est, true);
    }

    // 5. Limpiar acciones y eventos en todos los funcionarios manteniéndolos a ellos
    const funcionarios = (this.cache.funcionarios || []).slice();
    for (const func of funcionarios) {
      func.acciones = [];
      func.eventos = [];
      await this.saveFuncionario(func, true);
    }

    console.log("Limpieza General completada con éxito. Estudiantes y funcionarios conservados.");
    return true;
  },

  async migrarEstudiantesYFuncionariosATerraDiBimbi() {
    // NO-OP: Neutralized for multi-tenant isolation.
    // Each school's data now stays in its own colegio_id partition.
    console.log('[Multi-Tenant] Migración forzada desactivada. Cada colegio mantiene sus datos aislados por colegio_id.');
  },

  clearListeners() {
    this.listeners.forEach(unsub => unsub());
    this.listeners = [];
  },

  /* Utilities */
  generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  /* Students */
  getEstudiantes() {
    const activeYearStr = this.getActiveYear();
    const activeYearInt = parseInt(activeYearStr);
    
    let list = this.cache.estudiantes || [];
    const matriculas = this.cache.matriculas_anuales || [];
    
    return list.map(est => {
      const cloned = { ...est };
      const matricula = matriculas.find(m => m.estudiante_id === est.id && parseInt(m.anio_escolar) === activeYearInt);
      if (matricula) {
        cloned.curso = matricula.curso_id;
        cloned.matriculaEstado = matricula.estado;
        cloned.activo = (matricula.estado === 'activo');
      } else {
        // Fallback for default year 2026: if no matricula exists, keep their default course
        if (activeYearInt !== 2026) {
          cloned.curso = ''; 
        }
      }
      return cloned;
    }).filter(est => {
      // If we are in 2026, include them. If in other years, only include if they have a course
      if (activeYearInt === 2026) return true;
      return !!est.curso;
    });
  },
  
  getEstudianteById(id) { 
    const list = this.getEstudiantes();
    const found = list.find(e => e.id === id) || null;
    if (window.BARITA_DEBUG) console.debug("DEBUG getEstudianteById - id:", id, "found:", found);
    return found;
  },

  getEstudiantesByCurso(cursoId) { 
    const list = this.getEstudiantes();
    return list.filter(e => e.curso === cursoId);
  },

  async saveMatriculaAnual(matricula) {
    if (!matricula.id) matricula.id = this.generateId();
    
    if (!this.cache.matriculas_anuales) this.cache.matriculas_anuales = [];
    const idx = this.cache.matriculas_anuales.findIndex(m => m.estudiante_id === matricula.estudiante_id && parseInt(m.anio_escolar) === parseInt(matricula.anio_escolar));
    if (idx >= 0) {
      this.cache.matriculas_anuales[idx] = { ...this.cache.matriculas_anuales[idx], ...matricula };
    } else {
      this.cache.matriculas_anuales.push(matricula);
    }
    
    try {
      const client = window.getSupabaseClient();
      if (client && !Auth.currentUser?.uid?.startsWith('test-user')) {
        await client.from('matriculas_anuales').upsert({
          estudiante_id: matricula.estudiante_id,
          colegio_id: matricula.colegio_id || Storage.activeSchool || 'demo',
          anio_escolar: parseInt(matricula.anio_escolar),
          curso_id: matricula.curso_id,
          estado: matricula.estado || 'activo'
        }, { onConflict: 'estudiante_id,anio_escolar' });
      }
    } catch (err) {
      console.error("Error saving matricula:", err);
    }
  },
  
  prepareEstudiantePayload(est) {
    const fechaNac = est.fecha_nacimiento || est.fechaNacimiento || est.fechaCumpleanos || null;
    const metadata = est.metadata && typeof est.metadata === 'object' ? { ...est.metadata } : {};
    
    metadata.enSeguimiento = !!est.enSeguimiento;
    metadata.esComplejo = !!est.esComplejo;
    metadata.requiereApoyoPsicosocial = !!est.requiereApoyoPsicosocial;
    metadata.planUtpActivo = !!est.planUtpActivo;
    metadata.medidasPie = !!est.medidasPie;
    metadata.atrasoJustificadoGeneral = !!(est.atrasoJustificadoGeneral || est.justificadoGeneral);
    metadata.justificadoGeneral = !!(est.atrasoJustificadoGeneral || est.justificadoGeneral);
    
    // Persist Compromiso Conductual metadata fields
    metadata.compromisoConductualActivo = !!est.compromisoConductualActivo;
    if (est.compromisoFechaInicio) metadata.compromisoFechaInicio = est.compromisoFechaInicio;
    if (est.compromisoFechaTermino) metadata.compromisoFechaTermino = est.compromisoFechaTermino;
    if (est.compromisoEstado) metadata.compromisoEstado = est.compromisoEstado;
    if (est.compromisoCreadoAt) metadata.compromisoCreadoAt = est.compromisoCreadoAt;

    metadata.esEstudiantePIE = !!est.esEstudiantePIE;
    if (Array.isArray(est.paci)) metadata.paci = est.paci;
    
    if (est.razonJustificacionGeneral) metadata.razonJustificacionGeneral = est.razonJustificacionGeneral;
    if (est.obsJustificacionGeneral) metadata.obsJustificacionGeneral = est.obsJustificacionGeneral;
    if (Array.isArray(est.bitacoraSeguimiento)) metadata.bitacoraSeguimiento = est.bitacoraSeguimiento;
    if (est.fechaProximoSeguimiento !== undefined) metadata.fechaProximoSeguimiento = est.fechaProximoSeguimiento;
    if (est.proximoSeguimiento !== undefined) metadata.proximoSeguimiento = est.proximoSeguimiento;
    if (est.fechaProximo !== undefined) metadata.fechaProximo = est.fechaProximo;
    if (fechaNac) metadata.fechaCumpleanos = fechaNac;

    return {
      id: est.id || this.generateId(),
      nombres: est.nombres || '',
      apellidos: est.apellidos || '',
      rut: est.rut || '',
      colegio_id: String(est.colegio_id || est.colegioId || Storage.activeSchool || 'demo'),
      fecha_nacimiento: fechaNac,
      metadata: metadata
    };
  },

  async saveEstudiante(est, bypassPermission = false) {
    if (!bypassPermission && !Auth.canWriteEstudiantes() && !Auth.canManageSeguimiento()) { 
      App.showToast("No tienes permisos para esto", "danger"); 
      throw new Error("Sin permisos de edición"); 
    }
    if (!est.id) est.id = this.generateId();
    
    // Optimistic local cache update
    const idx = this.cache.estudiantes.findIndex(e => e.id === est.id);
    if (idx >= 0) this.cache.estudiantes[idx] = est;
    else this.cache.estudiantes.push(est);

    if (!this.localMutations.estudiantes) this.localMutations.estudiantes = {};
    this.localMutations.estudiantes[est.id] = JSON.parse(JSON.stringify(est));
    this.persistLocalMutations();

    // Quick Login / test mode => local only
    if (Auth.currentUser && Auth.currentUser.uid.startsWith('test-user')) {
      return;
    }
    
    const payload = this.prepareEstudiantePayload(est);
    const client = window.getSupabaseClient();
    if (client) {
      const { error } = await client.from('estudiantes').upsert(payload, { onConflict: 'id' });
      if (error && !error.message?.includes('duplicate key')) {
        if (error.message?.includes('permission denied')) {
          console.warn('RLS bloqueó escritura en estudiantes (no es crítico):', error.message);
        } else {
          console.error('Error guardando en Supabase:', error);
          App.showToast("Error guardando en la base de datos: " + error.message, "danger");
        }
      } else if (!error) {
        // éxito: evict local para no fantasma
        if (this.localMutations.estudiantes && this.localMutations.estudiantes[est.id]) {
          delete this.localMutations.estudiantes[est.id];
          this.persistLocalMutations();
        }
      }
      
      // Auto-upsert matricula for the active year
      if (est.curso) {
        const activeYearStr = this.getActiveYear();
        const activeYearInt = parseInt(activeYearStr);
        const matriculaPayload = {
          estudiante_id: est.id,
          colegio_id: String(payload.colegio_id || Storage.activeSchool || 'demo'),
          anio_escolar: activeYearInt,
          curso_id: est.curso,
          estado: 'activo'
        };
        
        // Optimistic cache update for matricula
        if (!this.cache.matriculas_anuales) this.cache.matriculas_anuales = [];
        const mIdx = this.cache.matriculas_anuales.findIndex(m => m.estudiante_id === est.id && parseInt(m.anio_escolar) === activeYearInt);
        if (mIdx >= 0) {
          this.cache.matriculas_anuales[mIdx] = { ...this.cache.matriculas_anuales[mIdx], ...matriculaPayload };
        } else {
          this.cache.matriculas_anuales.push({ id: this.generateId(), ...matriculaPayload });
        }
        
        try {
          await client.from('matriculas_anuales').upsert(matriculaPayload, { onConflict: 'estudiante_id,anio_escolar' });
        } catch (err) {
          console.warn("Error upserting matriculas_anuales inside saveEstudiante:", err);
        }
      }
    }
  },

  async deleteEstudiante(id) {
    if (!Auth.canWriteEstudiantes()) return;
    this.cache.estudiantes = (this.cache.estudiantes || []).filter(e => e.id !== id);
    if (this.localMutations && this.localMutations.estudiantes && this.localMutations.estudiantes[id]) {
      delete this.localMutations.estudiantes[id];
      this.persistLocalMutations();
    }
    try {
      await window.getSupabaseClient().from('estudiantes').delete().eq('id', id);
    } catch (err) {
      console.warn('Error borrando estudiante en Supabase:', err);
    }
  },

  /* Global configs */
  getDashboardConfig() {
    const conf = this.cache.config || {};
    const defaultConf = typeof DATA !== 'undefined' ? DATA.DashboardConfig : {};
    
    if (conf.dashboards && typeof conf.dashboards === 'object') {
      const merged = JSON.parse(JSON.stringify(defaultConf));
      for (const role in conf.dashboards) {
        if (Array.isArray(conf.dashboards[role])) {
          merged[role] = conf.dashboards[role];
        }
      }
      return merged;
    }
    return JSON.parse(JSON.stringify(defaultConf));
  },

  async saveDashboardConfig(newConfig) {
    if (!['admin', 'superadmin'].includes(Auth.currentRole)) { 
      App.showToast("No tienes permisos para esto", "danger"); 
      return false; 
    }
    
    if (!this.cache.config) this.cache.config = {};
    this.cache.config.dashboards = newConfig;

    try {
      const { error } = await window.getSupabaseClient().from('config').upsert({ key: 'main', dashboards: newConfig });
      if (error) {
        console.error("Error al guardar dashboards en Supabase:", error);
        App.showToast("Error guardando en base de datos: " + error.message, "danger");
        return false;
      }
      return true;
    } catch (e) {
      console.error("Error guardando dashboards:", e);
      App.showToast("Error de conexión al guardar dashboards", "danger");
      return false;
    }
  },

  getInduccionChecklist() {
    const defaultItems = [
      { id: 'leccionario', label: 'Llenado de Leccionario' },
      { id: 'planificacion', label: 'Planificación' },
      { id: 'reglamento', label: 'Reglamento Interno' }
    ];
    if (this.cache.config && Array.isArray(this.cache.config.induccion_items) && this.cache.config.induccion_items.length > 0) {
      return this.cache.config.induccion_items;
    }
    try {
      const local = localStorage.getItem('barita_induccion_items');
      if (local) return JSON.parse(local);
    } catch (_e) {}
    return defaultItems;
  },

  async saveInduccionChecklist(items) {
    if (!['admin', 'superadmin'].includes(Auth.currentRole)) {
      App.showToast("No tienes permisos para esto", "danger");
      return false;
    }
    if (!this.cache.config) this.cache.config = {};
    this.cache.config.induccion_items = items;
    try { localStorage.setItem('barita_induccion_items', JSON.stringify(items)); } catch (_e) {}

    try {
      const client = (typeof window.getSupabaseClient === 'function') ? window.getSupabaseClient() : null;
      if (client) {
        await client.from('config').upsert({ key: 'main', induccion_items: items });
      }
    } catch (_e) {}
    return true;
  },

  /* Events */
  getEventos() { return this._filterByYear(this.cache.eventos).sort((a, b) => new Date(b.fecha) - new Date(a.fecha)); },
  getEventosByEstudiante(estudianteId) {
    if (!estudianteId) return this.getEventos();
    const targetId = String(estudianteId).trim();
    return this._filterByYear(this.cache.eventos.filter(e => {
      const eId = String(e.estudianteId || e.estudiante_id || '').trim();
      return eId === targetId;
    })).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  },
  getEventosByFuncionario(funcionarioId) {
    if (!funcionarioId) return [];
    const targetId = String(funcionarioId).trim();
    return this._filterByYear(this.cache.eventos.filter(e => {
      const fId = String(e.funcionarioId || e.funcionario_id || '').trim();
      return fId === targetId;
    })).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  },
  getAtrasosByEstudiante(estudianteId) {
    if (!estudianteId) return [];
    return this._filterByYear(this.cache.atrasos.filter(e => e.estudianteId === estudianteId)).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  },
  getInasistenciasByEstudiante(estudianteId) {
    if (!estudianteId) return [];
    return this._filterByYear(this.cache.inasistencias.filter(e => e.estudianteId === estudianteId)).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  },
  
  async saveEvento(evento) {
    if (!evento.id) evento.id = this.generateId();
    if (!evento.fecha) evento.fecha = new Date().toISOString();
    if (!evento.fechaCreacion) evento.fechaCreacion = new Date().toISOString();
    
    // Inyectar IDs normalizados
    this.injectColegioId(evento);

    // Guardar en mutaciones locales y caché en memoria
    if (!this.localMutations.eventos) this.localMutations.eventos = {};
    this.localMutations.eventos[evento.id] = JSON.parse(JSON.stringify(evento));
    
    const idx = this.cache.eventos.findIndex(e => e.id === evento.id);
    if (idx >= 0) this.cache.eventos[idx] = evento;
    else this.cache.eventos.unshift(evento);
    
    this.persistLocalMutations();

    // Persistir de forma segura en servidor Supabase
    try {
      const client = (typeof window.getSupabaseClient === 'function') ? window.getSupabaseClient() : null;
      if (client && !Auth.currentUser?.uid?.startsWith('test-user')) {
        const payload = {
          id: String(evento.id),
          tipo: String(evento.tipo || 'positiva'),
          titulo: String(evento.titulo || evento.motivo || 'Acontecimiento'),
          descripcion: String(evento.descripcion || ''),
          fecha: evento.fecha,
          responsable: String(evento.registradoPor || evento.registrado_por || evento.responsable || 'Sistema'),
          colegio_id: String(evento.colegioId || evento.colegio_id || Storage.activeSchool || 'demo'),
          estudiante_id: evento.estudianteId || evento.estudiante_id || null,
          funcionario_id: evento.funcionarioId || evento.funcionario_id || null
        };
        await client.from('eventos').upsert(payload);
      }
    } catch (err) {
      console.warn("Supabase upsert warning (eventos):", err);
    }
    
    return evento;
  },

  async deleteEvento(id) {
    try { await window.getSupabaseClient().from('eventos').delete().eq('id', id); } catch (_e) {}
    this.cache.eventos = this.cache.eventos.filter(e => e.id !== id);
    if (this.localMutations.eventos && this.localMutations.eventos[id]) {
      delete this.localMutations.eventos[id];
      this.persistLocalMutations();
    }
  },

  /* Atrasos */
  prepareAtrasoPayload(atraso) {
    const rawId = atraso.id ? String(atraso.id).trim() : this.generateId();
    const estId = (atraso.estudiante_id || atraso.estudianteId || '').toString().trim() || null;
    const funcId = (atraso.funcionario_id || atraso.funcionarioId || '').toString().trim() || null;
    const colegioId = (atraso.colegio_id || atraso.colegioId || Storage.activeSchool || 'demo').toString().trim();

    return {
      id: rawId,
      estudiante_id: estId,
      funcionario_id: funcId,
      fecha: atraso.fecha || BARITA_hoyChileISO(),
      hora: atraso.hora || '08:00',
      minutos_atraso: atraso.minutosAtraso || atraso.minutos_atraso || 15,
      motivo: atraso.motivo || atraso.descripcion || 'Atraso en ingreso',
      justificado: !!atraso.justificado,
      justificacion: atraso.justificacion || atraso.razon || atraso.motivo_justificacion || null,
      colegio_id: colegioId
    };
  },

  async saveAtraso(atraso) {
    if (!atraso) return null;
    if (!atraso.id) atraso.id = this.generateId();
    if (!atraso.estudianteId && atraso.estudiante_id) atraso.estudianteId = atraso.estudiante_id;
    if (!atraso.estudiante_id && atraso.estudianteId) atraso.estudiante_id = atraso.estudianteId;
    this.injectColegioId(atraso);

    // Save in localMutations and memory cache
    if (!this.localMutations.atrasos) this.localMutations.atrasos = {};
    this.localMutations.atrasos[atraso.id] = JSON.parse(JSON.stringify(atraso));
    
    if (!Array.isArray(this.cache.atrasos)) this.cache.atrasos = [];
    const idx = this.cache.atrasos.findIndex(a => a && String(a.id) === String(atraso.id));
    if (idx >= 0) this.cache.atrasos[idx] = atraso;
    else this.cache.atrasos.unshift(atraso);

    this.persistLocalMutations();

    // Persist to Supabase DB safely
    try {
      const client = (typeof window.getSupabaseClient === 'function') ? window.getSupabaseClient() : null;
      if (client && !Auth.currentUser?.uid?.startsWith('test-user')) {
        const payload = this.prepareAtrasoPayload(atraso);
        await client.from('atrasos').upsert(payload);
      }
    } catch (err) {
      console.warn("Supabase upsert warning (atrasos):", err);
    }
    return atraso;
  },

  getAnotacionesByEstudiante(estudianteId) {
    let list = this.cache.anotaciones || [];
    if (estudianteId) {
      const targetId = String(estudianteId).trim();
      list = list.filter(a => String(a.estudianteId || a.estudiante_id || '').trim() === targetId);
    }
    return this._filterByYear(list).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  },

  getAnotacionesByEstudianteAndYear(estudianteId, year) {
    let list = this.cache.anotaciones || [];
    if (estudianteId) {
      const targetId = String(estudianteId).trim();
      list = list.filter(a => String(a.estudianteId || a.estudiante_id || '').trim() === targetId);
    }
    const targetYear = String(year);
    return list.filter(item => {
      if (item.anio && String(item.anio) === targetYear) return true;
      if (item.year && String(item.year) === targetYear) return true;
      if (item.anio_escolar && String(item.anio_escolar) === targetYear) return true;
      const fecha = (item.fecha || item.fechaCreacion || '');
      if (fecha && String(fecha).startsWith(targetYear)) return true;
      return false;
    }).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  },

  prepareAnotacionPayload(anot) {
    const rawId = anot.id ? String(anot.id).trim() : this.generateId();
    const estId = (anot.estudiante_id || anot.estudianteId || '').toString().trim() || null;
    const funcId = (anot.funcionario_id || anot.funcionarioId || '').toString().trim() || null;
    
    let autorId = '';
    if (anot.autor_id !== null && anot.autorId !== null) {
      autorId = (anot.autor_id || anot.autorId || Auth.currentUser?.id || Auth.currentUser?.uid || '').toString().trim();
    }
    const cleanAutorId = (autorId && autorId !== 'admin' && autorId !== 'sistema') ? autorId : null;
    const colegioId = (anot.colegio_id || anot.colegioId || Storage.activeSchool || 'demo').toString().trim();

    return {
      id: rawId,
      estudiante_id: estId,
      funcionario_id: funcId,
      tipo: String(anot.tipo || 'observacion'),
      categoria_falta: anot.categoria_falta || anot.categoriaFalta || null,
      descripcion: String(anot.descripcion || ''),
      fecha: anot.fecha || new Date().toISOString(),
      autor_id: cleanAutorId,
      registrado_por: String(anot.registrado_por || anot.registradoPor || 'Sistema'),
      colegio_id: colegioId
    };
  },
  
  async saveAnotacion(anotacion) {
    if (!Auth.canWriteAnotaciones(anotacion.tipo || 'observacion')) {
      App.showToast("No tienes permiso para agregar este tipo de anotación", "danger");
      return false;
    }
    if (!anotacion.id) {
      anotacion.id = this.generateId();
      anotacion.fecha = anotacion.fecha || new Date().toISOString();
      if (Auth.currentUser) anotacion.autorId = Auth.currentUser.uid;
    } else {
      const existing = this.cache.anotaciones.find(a => a.id === anotacion.id);
      if (existing && !Auth.canEditOrDelete(existing.autorId || existing.autor_id)) {
        App.showToast("No tienes permiso para editar esta anotación", "danger");
        return false;
      }
    }
    
    // Ensure keys in memory
    anotacion.estudianteId = anotacion.estudianteId || anotacion.estudiante_id;
    anotacion.funcionarioId = anotacion.funcionarioId || anotacion.funcionario_id;

    // Optimistic cache update
    const idx = this.cache.anotaciones.findIndex(a => a.id === anotacion.id);
    if (idx >= 0) this.cache.anotaciones[idx] = anotacion;
    else this.cache.anotaciones.push(anotacion);

    // Save to localMutations for persistence guarantee across reloads
    if (!this.localMutations.anotaciones) this.localMutations.anotaciones = {};
    this.localMutations.anotaciones[anotacion.id] = JSON.parse(JSON.stringify(anotacion));
    this.persistLocalMutations();

    try {
      const payload = this.prepareAnotacionPayload(anotacion);
      const { error } = await window.getSupabaseClient().from('anotaciones').upsert(payload);
      if (error) {
        console.warn("Advertencia al guardar anotacion en Supabase:", error.message);
      }
    } catch (e) {
      console.warn("Excepción al guardar anotacion en Supabase:", e);
    }

    return true;
  },

  async deleteAnotacion(id) {
    const existing = this.cache.anotaciones.find(a => a.id === id);
    if (existing && !Auth.canEditOrDelete(existing.autorId || existing.autor_id)) {
      App.showToast("No tienes permiso para eliminar esta anotación", "danger");
      return false;
    }
    try {
      await window.getSupabaseClient().from('anotaciones').delete().eq('id', id);
    } catch (e) {
      console.warn("Excepción al eliminar anotacion en Supabase:", e);
    }
    this.cache.anotaciones = this.cache.anotaciones.filter(a => a.id !== id);
    if (this.localMutations.anotaciones && this.localMutations.anotaciones[id]) {
      delete this.localMutations.anotaciones[id];
      this.persistLocalMutations();
    }
    return true;
  },

  async deleteAtraso(id) {
    try { await window.getSupabaseClient().from('atrasos').delete().eq('id', id); } catch (_e) {}
    this.cache.atrasos = (this.cache.atrasos || []).filter(a => a.id !== id);
    if (this.localMutations.atrasos && this.localMutations.atrasos[id]) {
      delete this.localMutations.atrasos[id];
      this.persistLocalMutations();
    }
    return true;
  },

  async saveInasistencia(inasistencia) {
    if (!inasistencia) return null;
    if (!inasistencia.id) inasistencia.id = this.generateId();
    if (!inasistencia.estudianteId && inasistencia.estudiante_id) inasistencia.estudianteId = inasistencia.estudiante_id;
    if (!inasistencia.estudiante_id && inasistencia.estudianteId) inasistencia.estudiante_id = inasistencia.estudianteId;
    this.injectColegioId(inasistencia);

    if (!this.localMutations.inasistencias) this.localMutations.inasistencias = {};
    this.localMutations.inasistencias[inasistencia.id] = JSON.parse(JSON.stringify(inasistencia));

    if (!Array.isArray(this.cache.inasistencias)) this.cache.inasistencias = [];
    const idx = this.cache.inasistencias.findIndex(i => i && String(i.id) === String(inasistencia.id));
    if (idx >= 0) this.cache.inasistencias[idx] = inasistencia;
    else this.cache.inasistencias.unshift(inasistencia);

    this.persistLocalMutations();

    try {
      const client = (typeof window.getSupabaseClient === 'function') ? window.getSupabaseClient() : null;
      if (client && !Auth.currentUser?.uid?.startsWith('test-user')) {
        const payload = {
          id: String(inasistencia.id),
          estudiante_id: (inasistencia.estudiante_id || inasistencia.estudianteId || '').toString().trim() || null,
          fecha: inasistencia.fecha || BARITA_hoyChileISO(),
          justificado: !!inasistencia.justificado,
          colegio_id: String(inasistencia.colegio_id || inasistencia.colegioId || Storage.activeSchool || 'demo')
        };
        await client.from('inasistencias').upsert(payload);
      }
    } catch (err) {
      console.warn("Supabase upsert warning (inasistencias):", err);
    }
    return inasistencia;
  },

  async deleteInasistencia(id) {
    try { await window.getSupabaseClient().from('inasistencias').delete().eq('id', id); } catch (_e) {}
    this.cache.inasistencias = (this.cache.inasistencias || []).filter(i => i.id !== id);
    if (this.localMutations.inasistencias && this.localMutations.inasistencias[id]) {
      delete this.localMutations.inasistencias[id];
      this.persistLocalMutations();
    }
    return true;
  },

  async deleteAccion(id) {
    try {
      await window.getSupabaseClient().from('acciones').delete().eq('id', id);
    } catch (e) {
      console.warn("Excepción al eliminar accion en Supabase:", e);
    }
    this.cache.acciones = (this.cache.acciones || []).filter(a => a.id !== id);
    if (this.localMutations.acciones && this.localMutations.acciones[id]) {
      delete this.localMutations.acciones[id];
      this.persistLocalMutations();
    }
    return true;
  },

  getAccionFuncionarioById(id) {
    return (this.cache.acciones || []).find(a => a.id === id) || null;
  },
  async saveAccionFuncionario(accion) {
    return this.saveAccion(accion);
  },
  async deleteAccionFuncionario(id) {
    return this.deleteAccion(id);
  },

  /* Eventos asociados */
  getEventosByFuncionario(funcionarioId) {
    if (!funcionarioId) return [];
    const targetId = String(funcionarioId).trim();
    return (this.cache.eventos || []).filter(e => {
      if (!e) return false;
      const fId = String(e.funcionarioId || e.funcionario_id || '').trim();
      return fId === targetId;
    }).sort((a, b) => new Date(b.fecha || b.fechaHora || Date.now()) - new Date(a.fecha || a.fechaHora || Date.now()));
  },

  async saveEvento(evento) {
    if (!evento.id) {
      evento.id = this.generateId();
      evento.fecha = evento.fecha || new Date().toISOString();
    }
    const payload = {
      id: evento.id,
      titulo: evento.titulo || evento.tipo || '',
      descripcion: evento.descripcion || '',
      fecha: evento.fecha || new Date().toISOString(),
      funcionario_id: evento.funcionarioId || evento.funcionario_id || null,
      estudiante_id: evento.estudianteId || evento.estudiante_id || null,
      colegio_id: String(evento.colegio_id || evento.colegioId || Storage.activeSchool || 'demo'),
      tipo: evento.tipo || 'positiva',
      registrado_por: evento.registradoPor || evento.registrado_por || null
    };

    try {
      await window.getSupabaseClient().from('eventos').upsert(payload);
    } catch (e) {
      console.warn("Excepción al guardar evento en Supabase:", e);
    }

    const idx = (this.cache.eventos || []).findIndex(e => e.id === evento.id);
    if (!this.cache.eventos) this.cache.eventos = [];
    if (idx >= 0) this.cache.eventos[idx] = evento;
    else this.cache.eventos.push(evento);

    if (this.localMutations && this.localMutations.eventos) {
      this.localMutations.eventos[evento.id] = JSON.parse(JSON.stringify(evento));
      this.persistLocalMutations();
    }

    return evento;
  },

  async deleteEvento(id) {
    if (!id) return true;
    try {
      await window.getSupabaseClient().from('eventos').delete().eq('id', id);
    } catch (e) {
      console.warn("Excepción al eliminar evento en Supabase:", e);
    }
    this.cache.eventos = (this.cache.eventos || []).filter(e => e.id !== id && String(e.id) !== String(id));
    if (this.localMutations && this.localMutations.eventos) {
      delete this.localMutations.eventos[id];
      delete this.localMutations.eventos[String(id)];
      this.persistLocalMutations();
    }
    return true;
  },

  /* Funcionarios */
  getFuncionarios() {
    const active = (this.activeSchool || 'demo').toString().trim();
    return (this.cache.funcionarios || []).filter(f => (f.colegioId || f.colegio_id || 'demo') === active);
  },
  getFuncionariosActivos() {
    const active = (this.activeSchool || 'demo').toString().trim();
    return (this.cache.funcionarios || []).filter(f => (f.colegioId || f.colegio_id || 'demo') === active && f.estado !== 'inactivo');
  },
  getFuncionarioById(id) { return this.cache.funcionarios.find(f => f.id === id) || null; },
  /* Dotación anual continuidad 2025->2026 - paridad demo+terra */
  getDotacionAnual(funcionarioId, anio) {
    const a = String(anio||Storage.getActiveYear());
    const list = this.cache.dotacion_anual || [];
    return list.find(d=> String(d.funcionario_id)===String(funcionarioId) && String(d.anio)===a) || null;
  },
  getHistorialDotacion(funcionarioId) {
    return (this.cache.dotacion_anual||[]).filter(d=> String(d.funcionario_id)===String(funcionarioId)).sort((a,b)=> a.anio - b.anio);
  },
  async saveDotacionAnual(dot) {
    if (!dot.funcionario_id || !dot.anio) return;
    dot.colegio_id = dot.colegio_id || Storage.activeSchool || 'demo';
    if (!this.cache.dotacion_anual) this.cache.dotacion_anual=[];
    const idx=this.cache.dotacion_anual.findIndex(d=> String(d.funcionario_id)===String(dot.funcionario_id) && String(d.anio)===String(dot.anio));
    if(idx>=0) this.cache.dotacion_anual[idx]={...this.cache.dotacion_anual[idx], ...dot};
    else this.cache.dotacion_anual.push(dot);
    try{ const c=(typeof window.getSupabaseClient==='function')?window.getSupabaseClient():null; if(c) await c.from('dotacion_anual').upsert(dot, {onConflict:'colegio_id,funcionario_id,anio'}); }catch(e){ console.warn('saveDotacion',e.message); }
    return dot;
  },
  
  prepareFuncionarioPayload(func) {
    return {
      id: func.id || this.generateId(),
      nombres: func.nombres || '',
      apellidos: func.apellidos || '',
      rut: func.rut || '',
      categoria: func.categoria || null,
      cargo: func.cargo || null,
      colegio_id: String(func.colegio_id || func.colegioId || Storage.activeSchool || 'demo'),
      fecha_nacimiento: func.fecha_nacimiento || func.fechaNacimiento || null,
      induccion: func.induccion || {},
      run: func.run || null,
      email: func.email || null,
      telefono: func.telefono || null,
      obligaciones: func.obligaciones || {},
      fechaCorteAlDia: func.fechaCorteAlDia || func.fecha_corte_al_dia || null,
      fecha_corte_al_dia: func.fechaCorteAlDia || func.fecha_corte_al_dia || null
    };
  },

  async saveFuncionario(func, bypassPermission = false) {
    if (!bypassPermission) {
      if (!func.id && !Auth.canCreateFuncionarios()) { App.showToast("No tienes permisos para crear", "danger"); return false; }
      if (func.id && !Auth.canWriteFuncionarios()) { App.showToast("No tienes permisos para modificar", "danger"); return false; }
    }
    if (!func.id) func.id = this.generateId();
    
    // Inyectar mutación local y caché inmediata
    if (!this.localMutations.funcionarios) this.localMutations.funcionarios = {};
    this.localMutations.funcionarios[func.id] = JSON.parse(JSON.stringify(func));

    const idx = this.cache.funcionarios.findIndex(f => f.id === func.id);
    if (idx >= 0) this.cache.funcionarios[idx] = func;
    else this.cache.funcionarios.push(func);

    this.persistLocalMutations();

    // Guardar en Supabase db si no es usuario de prueba local
    try {
      const client = (typeof window.getSupabaseClient === 'function') ? window.getSupabaseClient() : null;
      if (client && !Auth.currentUser?.uid?.startsWith('test-user')) {
        const payload = this.prepareFuncionarioPayload(func);
        const { error } = await client.from('funcionarios').upsert(payload, { onConflict: 'id' });
        if (error && !error.message?.includes('duplicate key')) {
          console.warn("Supabase upsert warning (funcionarios):", error);
        }
      }
    } catch (e) {
      console.warn("Error al guardar funcionario en Supabase DB:", e);
    }

    return true;
  },

  async deleteFuncionario(id) {
    if (!Auth.canCreateFuncionarios()) return;
    await window.getSupabaseClient().from('funcionarios').delete().eq('id', id);
    this.cache.funcionarios = this.cache.funcionarios.filter(f => f.id !== id);
  },

  async updateConfig(key, value) {
    if (Auth.currentRole !== 'admin') return;
    await window.getSupabaseClient().from('config').upsert(value);
  },
  
  // Acciones
  getAllAcciones() {
    return this._filterByYear(this.cache.acciones || []);
  },
  getAccionesByFuncionario(funcionarioId) {
    return this._filterByYear(this.cache.acciones || []).filter(a => a.funcionarioId === funcionarioId);
  },
  async saveAccion(accion) {
    if (!accion.id) accion.id = this.generateId();
    await window.getSupabaseClient().from('acciones').upsert(this.injectColegioId(accion))
  },
  async deleteAccion(id) {
    await window.getSupabaseClient().from('acciones').delete().eq('id', id);
  },
  
  // Documentos institucionales
  getDocumentos() {
    return this.cache.documentos || [];
  },
  getDocumentoById(id) {
    return (this.cache.documentos || []).find(d => d.id === id) || null;
  },
  async saveDocumento(doc) {
    const allowed = ['superadmin', 'admin', 'directora', 'utp', 'coordinadora'];
    if (!allowed.includes(String(Auth.currentRole).toLowerCase())) return null; 
    if (!doc.id) {
      doc.id = this.generateId();
      doc.fechaCreacion = new Date().toISOString();
    }
    doc.ultimaActualizacion = new Date().toISOString();

    // Update local cache
    if (!this.cache.documentos) this.cache.documentos = [];
    const idx = this.cache.documentos.findIndex(d => d.id === doc.id);
    if (idx >= 0) {
      this.cache.documentos[idx] = { ...doc };
    } else {
      this.cache.documentos.push({ ...doc });
    }

    try {
      await window.getSupabaseClient().from('documentos').upsert(this.injectColegioId(doc));
    } catch (e) {
      console.warn("Error upserting documentos table:", e);
    }
    return doc;
  },
  async deleteDocumento(id) {
    const allowed = ['superadmin', 'admin', 'directora', 'utp', 'coordinadora'];
    if (!allowed.includes(String(Auth.currentRole).toLowerCase())) return;

    // Update local cache
    if (this.cache.documentos) {
      this.cache.documentos = this.cache.documentos.filter(d => d.id !== id);
    }

    try {
      await window.getSupabaseClient().from('documentos').delete().eq('id', id);
    } catch (e) {
      console.warn("Error deleting from documentos table:", e);
    }
  },

  /* Acciones de funcionario detalle */
  getAccionesFuncionario(funcionarioId) {
    if (!funcionarioId) return [];
    const targetId = String(funcionarioId).trim();
    return (this.cache.acciones || [])
      .filter(a => {
        if (!a) return false;
        const fId = String(a.funcionarioId || a.funcionario_id || '').trim();
        return fId === targetId;
      })
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  },
  getAllAcciones() { return this.cache.acciones; },
  
  prepareAccionPayload(accion) {
    const p = {
      id: accion.id || this.generateId(),
      tipo: accion.tipo || 'observacion',
      fecha: accion.fecha || new Date().toISOString(),
      descripcion: accion.descripcion || ''
    };
    if (accion.registradoPor || accion.registrado_por) {
      p.registrado_por = accion.registradoPor || accion.registrado_por;
    }
    const funcId = accion.funcionarioId || accion.funcionario_id;
    if (funcId) p.funcionario_id = String(funcId);

    const autorId = accion.autorId || accion.autor_id;
    if (autorId) p.autor_id = String(autorId);

    const colegioId = accion.colegioId || accion.colegio_id || Storage.activeSchool || 'demo';
    if (colegioId) p.colegio_id = String(colegioId);

    return p;
  },

  async saveAccionFuncionario(accion) {
    if (!Auth.canWriteFuncionarios()) return null;
    if (!accion.id) {
      accion.id = this.generateId();
      accion.fecha = accion.fecha || new Date().toISOString();
      if (Auth.currentUser) accion.autorId = Auth.currentUser.uid;
    } else {
      const existing = this.cache.acciones.find(a => a.id === accion.id);
      if (existing && !Auth.canEditOrDelete(existing.autorId)) {
        App.showToast("No tienes permiso para editar esta observación", "danger");
        return null;
      }
    }
    
    const payload = this.prepareAccionPayload(accion);
    const { error } = await window.getSupabaseClient().from('acciones').upsert(payload);
    if (error) {
      console.error('Error al guardar acción en Supabase:', error);
      App.showToast('Error guardando en Supabase: ' + error.message, 'danger');
    }
    
    const idx = this.cache.acciones.findIndex(a => a.id === accion.id);
    if (idx >= 0) this.cache.acciones[idx] = accion;
    else this.cache.acciones.push(accion);

    if (this.localMutations.acciones) {
      this.localMutations.acciones[accion.id] = JSON.parse(JSON.stringify(accion));
      this.persistLocalMutations();
    }

    return accion;
  },

  async deleteAccionFuncionario(id) {
    if (!id) return true;
    try {
      await window.getSupabaseClient().from('acciones').delete().eq('id', id);
    } catch (e) {
      console.warn("Excepción al eliminar accion en Supabase:", e);
    }
    this.cache.acciones = (this.cache.acciones || []).filter(a => a.id !== id && String(a.id) !== String(id));
    if (this.localMutations && this.localMutations.acciones) {
      delete this.localMutations.acciones[id];
      delete this.localMutations.acciones[String(id)];
      this.persistLocalMutations();
    }
    return true;
  },

  /* Documentos Institucionales */
  getDocumentos() {
    let list = Array.isArray(this.cache.documentos) ? this.cache.documentos : [];
    const activeSchool = this.activeSchool || 'demo';

    if (list.length === 0) {
      try {
        const stored = localStorage.getItem(`barita_documentos_${activeSchool}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.cache.documentos = parsed;
            list = parsed;
          }
        }
      } catch (_e) {}
    }

    return list.filter(d => (d.colegioId || d.colegio_id || 'demo') === activeSchool);
  },

  async saveDocumento(doc) {
    if (!doc) return null;
    if (!doc.id) doc.id = 'doc_' + Date.now();
    doc.colegioId = this.activeSchool || 'demo';
    doc.colegio_id = this.activeSchool || 'demo';

    if (!Array.isArray(this.cache.documentos)) this.cache.documentos = [];
    const idx = this.cache.documentos.findIndex(d => d.id === doc.id);
    if (idx >= 0) this.cache.documentos[idx] = doc;
    else this.cache.documentos.push(doc);

    try {
      localStorage.setItem(`barita_documentos_${this.activeSchool || 'demo'}`, JSON.stringify(this.cache.documentos));
    } catch (_e) {}

    try {
      const client = (typeof window.getSupabaseClient === 'function') ? window.getSupabaseClient() : null;
      if (client && !Auth.currentUser?.uid?.startsWith('test-user')) {
        await client.from('documentos').upsert({
          id: doc.id,
          nombre: doc.nombre,
          categoria: doc.categoria,
          texto: doc.texto || doc.resumen || '',
          resumen: doc.resumen || '',
          tags: doc.tags || [],
          fileName: doc.fileName || '',
          colegio_id: this.activeSchool || 'demo',
          ultimaActualizacion: doc.ultimaActualizacion || new Date().toISOString()
        });
      }
    } catch (e) {
      console.warn('Error guardando documento en Supabase:', e);
    }

    return doc;
  },

  async deleteDocumento(id) {
    if (!id) return true;
    if (!Array.isArray(this.cache.documentos)) this.cache.documentos = [];
    this.cache.documentos = this.cache.documentos.filter(d => d.id !== id);

    try {
      localStorage.setItem(`barita_documentos_${this.activeSchool || 'demo'}`, JSON.stringify(this.cache.documentos));
    } catch (_e) {}

    try {
      const client = (typeof window.getSupabaseClient === 'function') ? window.getSupabaseClient() : null;
      if (client && !Auth.currentUser?.uid?.startsWith('test-user')) {
        await client.from('documentos').delete().eq('id', id);
      }
    } catch (e) {
      console.warn('Error eliminando documento en Supabase:', e);
    }

    return true;
  },

  /* Casos graves */
  getCasos() {
    return this._filterByYear(this.cache.casos || []).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  },
  getCasoById(id) {
    if (!id) return null;
    const cleanId = String(id).trim();
    return (this.cache.casos || []).find(c => String(c.id).trim() === cleanId) || null;
  },
  getCasosByEstudiante(estudianteId) {
    if (!estudianteId) return [];
    const targetId = String(estudianteId).trim();
    const filtered = (this.cache.casos || []).filter(c => {
      const cStr = JSON.stringify(c).toLowerCase();
      if (cStr.includes('dsda') || cStr.includes('dasdas') || cStr.includes('dsada') || cStr.includes('adas')) return false;
      if (c.estudiante_id && String(c.estudiante_id).trim() === targetId) return true;
      if (c.estudianteId && String(c.estudianteId).trim() === targetId) return true;
      if (c.estudiante && String(c.estudiante).trim() === targetId) return true;
      if (Array.isArray(c.estudiantesInvolucrados) && c.estudiantesInvolucrados.map(String).includes(targetId)) return true;
      return false;
    });
    return this._filterByYear(filtered);
  },
  getCasosByEstudianteAndYear(estudianteId, year) {
    if (!estudianteId) return [];
    const targetId = String(estudianteId).trim();
    const filtered = (this.cache.casos || []).filter(c => {
      if (c.estudiante_id && String(c.estudiante_id).trim() === targetId) return true;
      if (c.estudianteId && String(c.estudianteId).trim() === targetId) return true;
      if (c.estudiante && String(c.estudiante).trim() === targetId) return true;
      if (Array.isArray(c.estudiantesInvolucrados) && c.estudiantesInvolucrados.map(String).includes(targetId)) return true;
      return false;
    });
    const targetYear = String(year);
    return filtered.filter(item => {
      if (item.anio && String(item.anio) === targetYear) return true;
      if (item.year && String(item.year) === targetYear) return true;
      if (item.anio_escolar && String(item.anio_escolar) === targetYear) return true;
      const fecha = (item.fecha || item.fechaCreacion || '');
      if (fecha && String(fecha).startsWith(targetYear)) return true;
      return false;
    }).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  },
  
  /* DUAL Manual + LIRMI Excel - vinculación caso_anotaciones */
  async vincularAnotacionesACaso(casoId, anotacionIds, origen = 'manual') {
    if (!casoId || !Array.isArray(anotacionIds) || anotacionIds.length === 0) return;
    const cleanIds = [...new Set(anotacionIds.map(String))];
    const colegioId = Storage.activeSchool || 'demo';
    // Validar tenant: solo anotaciones del mismo colegio
    const validIds = cleanIds.filter(aid => {
      const a = (this.cache.anotaciones||[]).find(x=>String(x.id)===String(aid));
      if (!a) return false;
      const aColegio = String(a.colegio_id||a.colegioId||'demo');
      return aColegio===String(colegioId);
    });
    if (validIds.length===0) return;
    const payload = validIds.map(aid => ({ caso_id: casoId, anotacion_id: aid, colegio_id: colegioId, origen }));
    try {
      const client = (typeof window.getSupabaseClient === 'function') ? window.getSupabaseClient() : null;
      if (client) await client.from('caso_anotaciones').upsert(payload, { onConflict: 'caso_id,anotacion_id' });
    } catch (e) { console.warn('vincularAnotacionesACaso:', e.message); }
    // Cache local espejo en caso.seguimiento no, solo puente
    const caso = this.getCasoById(casoId);
    if (caso) { caso.anotacionesVinculadas = [...new Set([...(caso.anotacionesVinculadas||[]), ...validIds])]; caso.evidencia_origen = origen; }
  },
  async getAnotacionesDeCaso(casoId) {
    if (!casoId) return [];
    try {
      const client = (typeof window.getSupabaseClient === 'function') ? window.getSupabaseClient() : null;
      if (client) {
        const { data } = await client.from('caso_anotaciones').select('anotacion_id').eq('caso_id', casoId);
        const ids = (data||[]).map(r=>r.anotacion_id);
        return (this.cache.anotaciones||[]).filter(a=>ids.includes(String(a.id)));
      }
    } catch(_e){}
    const caso = this.getCasoById(casoId);
    return (this.cache.anotaciones||[]).filter(a=>(caso?.anotacionesVinculadas||[]).includes(String(a.id)));
  },
  async saveCaso(caso) {
    if (!Auth.canWriteCasos()) { App.showToast("No tienes permisos", "danger"); return; }
    if (!caso.id) {
      caso.id = this.generateId();
      caso.fecha = caso.fecha || new Date().toISOString();
      caso.estado = caso.estado || 'denuncia';
    }
    caso.anio = caso.anio || parseInt(Storage.getActiveYear()) || new Date().getFullYear();
    caso.evidencia_origen = caso.evidencia_origen || 'manual';
    caso.plazo_dias = caso.plazo_dias || 10;
    
    // Quick Login mode
    if (Auth.currentUser && Auth.currentUser.uid.startsWith('test-user')) {
      if (!this.localMutations.casos) this.localMutations.casos = {};
      this.localMutations.casos[caso.id] = JSON.parse(JSON.stringify(caso));
      
      if (!this.cache.casos) this.cache.casos = [];
      const idx = this.cache.casos.findIndex(c => c.id === caso.id);
      if (idx >= 0) this.cache.casos[idx] = caso;
      else this.cache.casos.push(caso);
      
      this.persistLocalMutations();
      return;
    }
    
    // Optimistic cache update
    if (!this.cache.casos) this.cache.casos = [];
    const idx = this.cache.casos.findIndex(c => c.id === caso.id);
    if (idx >= 0) {
      this.cache.casos[idx] = { ...caso };
    } else {
      this.cache.casos.push({ ...caso });
    }
    
    if (!this.localMutations.casos) this.localMutations.casos = {};
    this.localMutations.casos[caso.id] = JSON.parse(JSON.stringify(caso));
    this.persistLocalMutations();
    
    // Preparar un payload limpio alineado al esquema real de producción de la BD
    const cleanPayload = {
      id: caso.id,
      colegio_id: caso.colegio_id || caso.colegioId || Storage.activeSchool || 'demo',
      estudiante_id: caso.estudiante_id || caso.estudianteId || null,
      titulo: caso.titulo || '',
      descripcion: caso.descripcion || '',
      estado: caso.estado || 'abierto',
      tipo: caso.tipo || 'seguimiento',
      fecha: caso.fecha || new Date().toISOString(),
      anio: caso.anio || parseInt(Storage.getActiveYear()) || new Date().getFullYear(),
      semaforo_origen: caso.semaforo_origen || null,
      evidencia_origen: caso.evidencia_origen || 'manual',
      protocolo_checklist_id: caso.protocolo_checklist_id || null,
      creado_por_id: caso.creado_por_id || caso.creadoPorId || null,
      seguimiento: Array.isArray(caso.seguimiento) ? caso.seguimiento : [],
      estudiantesInvolucrados: Array.isArray(caso.estudiantesInvolucrados) ? caso.estudiantesInvolucrados : (Array.isArray(caso.estudiantes_involucrados) ? caso.estudiantes_involucrados : [])
    };
    // Nota: proximoSeguimiento se guarda en estudiante.metadata.fechaProximoSeguimiento y en seguimiento[].fechaProximoSeguimiento, no en columna caso

    let _saveCasoErr = null;
    try {
      const { error } = await window.getSupabaseClient().from('casos').upsert(cleanPayload);
      if (error) {
        console.error("Error al guardar caso en Supabase:", error);
        App.showToast("No se pudo guardar el caso en el servidor: " + error.message, "danger");
        _saveCasoErr = error;
      }
    } catch (e) {
      console.warn("Excepción al guardar caso en Supabase:", e);
      _saveCasoErr = e;
    }
    if (!_saveCasoErr && this.localMutations.casos && this.localMutations.casos[caso.id]) {
      delete this.localMutations.casos[caso.id];
      this.persistLocalMutations();
    }
  },

  async deleteCaso(id) {
    if (!Auth.canWriteCasos()) return false;
    const cleanId = String(id).trim();
    
    const matchingCases = (this.cache.casos || []).filter(c => 
      c.id === cleanId || 
      (c.id && cleanId.includes(c.id)) ||
      (c.titulo && (c.titulo === cleanId || cleanId.includes(c.titulo))) ||
      (c.seguimiento && c.seguimiento.some(s => s.id === cleanId || s.fecha === cleanId || (s.id && cleanId.includes(s.id))))
    );
    
    const idsToDelete = matchingCases.map(c => c.id);
    if (!idsToDelete.includes(cleanId)) idsToDelete.push(cleanId);

    try {
      for (const targetId of idsToDelete) {
        await window.getSupabaseClient().from('casos').delete().eq('id', targetId);
      }
    } catch (e) {
      console.warn("Excepción al eliminar caso en Supabase:", e);
    }
    
    this.cache.casos = (this.cache.casos || []).filter(c => {
      if (idsToDelete.includes(c.id)) return false;
      if (c.titulo && idsToDelete.some(t => String(t).includes(c.titulo))) return false;
      if (c.seguimiento && c.seguimiento.some(s => idsToDelete.includes(s.id) || idsToDelete.includes(s.fecha))) return false;
      return true;
    });

    if (this.localMutations.casos) {
      idsToDelete.forEach(tId => delete this.localMutations.casos[tId]);
      Object.keys(this.localMutations.casos).forEach(key => {
        const c = this.localMutations.casos[key];
        if (c && (idsToDelete.includes(c.id) || (c.titulo && idsToDelete.some(t => String(t).includes(c.titulo))) || (c.seguimiento && c.seguimiento.some(s => idsToDelete.includes(s.id) || idsToDelete.includes(s.fecha))))) {
          delete this.localMutations.casos[key];
        }
      });
      this.persistLocalMutations();
    }

    return true;
  },

  async deleteCasoDeep(target, estudianteId) {
    if (!target) return true;
    const targetStr = String(target).trim().toLowerCase();
    const numericPart = targetStr.replace(/\D/g, '');

    // 1. Encontrar casos a eliminar (por ID, subtítulo, marca de tiempo numérica o ID específico)
    const casesToDelete = (this.cache.casos || []).filter(c => {
      if (!c) return false;
      const cStr = JSON.stringify(c).toLowerCase();
      if (cStr.includes('dsda') || cStr.includes('dasdas') || cStr.includes('dsada') || cStr.includes('adas')) return true;
      if (c.id === target || String(c.id).toLowerCase() === targetStr) return true;
      if (c.id && targetStr.includes(String(c.id).toLowerCase())) return true;
      if (c.id && String(c.id).toLowerCase().includes(targetStr)) return true;
      if (numericPart && numericPart.length > 5 && String(c.id).includes(numericPart)) return true;
      if (c.titulo && String(c.titulo).toLowerCase().includes(targetStr)) return true;
      if (c.descripcion && String(c.descripcion).toLowerCase().includes(targetStr)) return true;
      if (c.seguimiento && c.seguimiento.some(s => 
        s.id === target || 
        s.fecha === target || 
        (s.texto && String(s.texto).toLowerCase().includes(targetStr)) ||
        (s.id && targetStr.includes(String(s.id).toLowerCase()))
      )) return true;
      return false;
    });

    const titlesToDelete = casesToDelete.map(c => c.titulo ? String(c.titulo).toLowerCase() : '').filter(Boolean);
    const deletedIds = casesToDelete.map(c => c.id);
    const numericTimestamps = deletedIds.map(id => String(id).replace(/\D/g, '')).filter(n => n.length > 5);

    for (const c of casesToDelete) {
      try {
        await window.getSupabaseClient().from('casos').delete().eq('id', c.id);
      } catch (_e) {}
      if (this.localMutations.casos) delete this.localMutations.casos[c.id];
    }

    this.cache.casos = (this.cache.casos || []).filter(c => !deletedIds.includes(c.id));

    // Borrado directo en Supabase DB por patrones
    try {
      const client = window.getSupabaseClient();
      await client.from('casos').delete().or(`id.eq.${target},titulo.ilike.%${targetStr}%,descripcion.ilike.%${targetStr}%`);
    } catch (_e) {}

    // 2. Eliminar anotaciones correspondientes
    const anotacionesToDelete = (this.cache.anotaciones || []).filter(a => {
      if (!a) return false;
      const aStr = JSON.stringify(a).toLowerCase();
      if (aStr.includes('dsda') || aStr.includes('dasdas') || aStr.includes('dsada') || aStr.includes('adas')) return true;
      if (a.id === target || String(a.id).toLowerCase() === targetStr) return true;
      if (titlesToDelete.some(t => aStr.includes(t))) return true;
      if (numericTimestamps.some(num => String(a.id).includes(num) || String(a.fecha).includes(num))) return true;
      if (a.descripcion && String(a.descripcion).toLowerCase().includes(targetStr)) return true;
      return false;
    });

    for (const a of anotacionesToDelete) {
      try {
        await window.getSupabaseClient().from('anotaciones').delete().eq('id', a.id);
      } catch (_e) {}
      if (this.localMutations.anotaciones) delete this.localMutations.anotaciones[a.id];
    }

    const deletedAnotIds = anotacionesToDelete.map(a => a.id);
    this.cache.anotaciones = (this.cache.anotaciones || []).filter(a => !deletedAnotIds.includes(a.id));

    this.persistLocalMutations();

    // 3. Purgar el arreglo bitacoraSeguimiento del estudiante en RAM y localStorage
    if (estudianteId) {
      const est = this.getEstudianteById(estudianteId);
      if (est && Array.isArray(est.bitacoraSeguimiento)) {
        est.bitacoraSeguimiento = est.bitacoraSeguimiento.filter(b => {
          if (!b) return false;
          const bStr = JSON.stringify(b).toLowerCase();
          if (bStr.includes('dsda') || bStr.includes('dasdas') || bStr.includes('dsada') || bStr.includes('adas') || bStr.includes('wwww') || bStr.includes('qqqq') || bStr.includes('ssss')) return false;
          if (b.id === target || b.fecha === target) return false;
          if (targetStr && bStr.includes(targetStr)) return false;
          if (numericPart && numericPart.length > 5 && (String(b.id).includes(numericPart) || String(b.fecha).includes(numericPart))) return false;
          if (titlesToDelete.some(t => bStr.includes(t))) return false;
          if (numericTimestamps.some(num => String(b.id).includes(num) || String(b.fecha).includes(num))) return false;
          return true;
        });
        await this.saveEstudiante(est);
      }
    }

    return true;
  },

  /* Protocolos activados */
  getProtocolosActivos() {
    return this.cache.protocolos_activos.sort((a, b) => new Date(b.fechaActivacion) - new Date(a.fechaActivacion));
  },
  getProtocoloActivoById(id) { return this.cache.protocolos_activos.find(p => p.id === id) || null; },
  getProtocolosByEstudiante(estudianteId) {
    return this.cache.protocolos_activos.filter(p => (p.estudiantesInvolucrados || []).includes(estudianteId));
  },
  getProtocolosByEstado(estado) {
    return this.cache.protocolos_activos.filter(p => p.estado === estado);
  },
  async saveProtocoloActivo(prot) {
    if (!prot) return null;
    if (!prot.id) {
      prot.id = this.generateId();
      prot.fechaActivacion = prot.fechaActivacion || new Date().toISOString();
      prot.estado = prot.estado || 'en_proceso';
      prot.acciones = prot.acciones || [];
      prot.estudiantesInvolucrados = prot.estudiantesInvolucrados || [];
    }

    this.injectColegioId(prot);

    // Save in localMutations and memory cache
    if (!this.localMutations.protocolos_activos) this.localMutations.protocolos_activos = {};
    this.localMutations.protocolos_activos[prot.id] = JSON.parse(JSON.stringify(prot));
    
    if (!Array.isArray(this.cache.protocolos_activos)) this.cache.protocolos_activos = [];
    const idx = this.cache.protocolos_activos.findIndex(p => p && String(p.id) === String(prot.id));
    if (idx >= 0) this.cache.protocolos_activos[idx] = prot;
    else this.cache.protocolos_activos.unshift(prot);

    this.persistLocalMutations();

    try {
      const client = (typeof window.getSupabaseClient === 'function') ? window.getSupabaseClient() : null;
      if (client && !Auth.currentUser?.uid?.startsWith('test-user')) {
        await client.from('protocolos_activos').upsert(this.injectColegioId(prot));
      }
    } catch (err) {
      console.warn("Supabase upsert warning (protocolos_activos):", err);
    }
    return prot;
  },
  async addAccionProtocolo(protocoloId, accion) {
    const prot = this.getProtocoloActivoById(protocoloId);
    if (!prot) return null;
    accion.id = this.generateId();
    accion.fecha = accion.fecha || new Date().toISOString();
    prot.acciones = prot.acciones || [];
    prot.acciones.push(accion);
    await this.saveProtocoloActivo(prot);
    return prot;
  },

  /* Stats */
  getStats() {
    const year = this.getActiveYear();
    const estudiantes = this._filterByYear(this.cache.estudiantes);
    const anotaciones = this._filterByYear(this.cache.anotaciones);
    const casos = this._filterByYear(this.cache.casos);
    const funcionarios = this.cache.funcionarios;
    return {
      year,
      totalEstudiantes: estudiantes.length,
      totalAnotaciones: anotaciones.length,
      totalCasosGraves: casos.length,
      totalFuncionarios: funcionarios.length
    };
  },

  /* Export / Import */
  exportAll() {
    const data = {
      _meta: {
        sistema: 'BARITA - Sistema de Seguimiento',
        version: '1.0',
        fechaExportacion: new Date().toISOString(),
        totalRegistros: 0
      },
      estudiantes: this.cache.estudiantes,
      anotaciones: this.cache.anotaciones,
      funcionarios: this.cache.funcionarios,
      acciones_funcionario: this.cache.acciones,
      protocolos_activos: this.cache.protocolos_activos,
      casos: this.cache.casos
    };
    data._meta.totalRegistros =
      data.estudiantes.length + data.anotaciones.length +
      data.funcionarios.length + data.acciones_funcionario.length +
      data.protocolos_activos.length + data.casos.length;

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `barita_backup_cloud_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return data._meta;
  },

  async importAll(jsonString) {
    try {
      const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      const validSistemas = ['BARITA - Sistema de Seguimiento', 'Terra di Bimbi - Sistema de Seguimiento'];
      if (!data._meta || !validSistemas.includes(data._meta.sistema)) {
        throw new Error('Archivo no válido. No es un respaldo compatible.');
      }
      
      if (data.estudiantes && data.estudiantes.length > 0) {
        await window.supabaseGestion.from('estudiantes').upsert(data.estudiantes.map(e => { if(!e.id) e.id = this.generateId(); return e; }));
      }
      
      if (data.anotaciones && data.anotaciones.length > 0) {
        await window.supabaseGestion.from('anotaciones').upsert(data.anotaciones.map(a => { if(!a.id) a.id = this.generateId(); return a; }));
      }
      
      if (data.funcionarios && data.funcionarios.length > 0) {
        await window.supabaseGestion.from('funcionarios').upsert(data.funcionarios.map(f => { if(!f.id) f.id = this.generateId(); return f; }));
      }
      
      if (data.acciones_funcionario && data.acciones_funcionario.length > 0) {
        await window.supabaseGestion.from('acciones').upsert(data.acciones_funcionario.map(a => { if(!a.id) a.id = this.generateId(); return a; }));
      }
      
      if (data.protocolos_activos && data.protocolos_activos.length > 0) {
        await window.supabaseGestion.from('protocolos_activos').upsert(data.protocolos_activos.map(p => { if(!p.id) p.id = this.generateId(); return p; }));
      }
      
      if (data.casos && data.casos.length > 0) {
        await window.supabaseGestion.from('casos').upsert(data.casos.map(c => { if(!c.id) c.id = this.generateId(); return c; }));
      }
      
      return { success: true, meta: data._meta };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  getMenuConfig() {
    const ALL_FULL_MODULES = ['dashboard', 'agenda', 'notas', 'seguimientos', 'casos', 'cursos', 'funcionarios', 'asistencia', 'alertas_asistencia', 'consultas', 'pise', 'director', 'convivencia', 'utp', 'pie', 'profesor', 'inspectoria', 'finanzas', 'documentos', 'admin', 'superadmin'];
    
    // Si Modo Pruebas esta activo, otorgar acceso total a todos los roles
    if (window.ALLOW_ALL_ROLES_FULL_ACCESS) {
      return {
        directora: ALL_FULL_MODULES,
        inspectoria: ALL_FULL_MODULES,
        convivencia: ALL_FULL_MODULES,
        utp: ALL_FULL_MODULES,
        pie: ALL_FULL_MODULES,
        profesor: ALL_FULL_MODULES,
        finanza: ALL_FULL_MODULES,
        finanzas: ALL_FULL_MODULES,
        admin: ALL_FULL_MODULES,
        superadmin: ALL_FULL_MODULES,
        coordinadora: ALL_FULL_MODULES
      };
    }

    const STAFF_MODULES = ['dashboard', 'agenda', 'notas', 'seguimientos', 'casos', 'cursos', 'funcionarios', 'asistencia', 'alertas_asistencia', 'consultas', 'pise', 'director', 'convivencia', 'utp', 'pie', 'profesor', 'inspectoria', 'finanzas', 'documentos'];

    const defaultConfig = {
      directora: STAFF_MODULES,
      inspectoria: STAFF_MODULES,
      convivencia: STAFF_MODULES,
      utp: STAFF_MODULES,
      pie: STAFF_MODULES,
      profesor: STAFF_MODULES,
      finanzas: STAFF_MODULES,
      finanza: STAFF_MODULES,
      admin: ALL_FULL_MODULES,
      superadmin: ALL_FULL_MODULES,
      coordinadora: STAFF_MODULES
    };
    
    let configMenus = this.cache.config?.menus || defaultConfig;
    // Rule: SuperAdmin & Admin ALWAYS have permanent full access to all modules including Muro de Notas
    if (configMenus) {
      configMenus.superadmin = ALL_FULL_MODULES;
      configMenus.admin = ALL_FULL_MODULES;
    }
    
    return configMenus;
  },

  async saveMenuConfig(newConfig) {
    const role = (typeof Auth !== 'undefined' && Auth.currentRole) ? Auth.currentRole : '';
    if (role !== 'admin' && role !== 'superadmin') { 
      if (typeof App !== 'undefined' && App.showToast) App.showToast("No tienes permisos para esto", "danger"); 
      return; 
    }
    
    const ALL_FULL_MODULES = ['dashboard', 'agenda', 'notas', 'seguimientos', 'casos', 'cursos', 'funcionarios', 'asistencia', 'alertas_asistencia', 'consultas', 'pise', 'director', 'convivencia', 'utp', 'pie', 'profesor', 'inspectoria', 'finanzas', 'documentos', 'admin', 'superadmin'];
    newConfig.superadmin = ALL_FULL_MODULES;
    newConfig.admin = ALL_FULL_MODULES;

    if (Auth.currentUser && Auth.currentUser.uid && Auth.currentUser.uid.startsWith('test-user')) {
      if (!this.localMutations.config) this.localMutations.config = {};
      const configDoc = Object.assign({}, this.cache.config || {}, { key: 'main', menus: newConfig });
      this.localMutations.config['main'] = JSON.parse(JSON.stringify(configDoc));
      this.cache.config = configDoc;
      this.persistLocalMutations();
      return;
    }
    
    if (!this.cache.config) this.cache.config = { key: 'main' };
    this.cache.config.menus = newConfig;
    await window.getSupabaseClient().from('config').upsert({ menus: newConfig });
  },

  getTiposFiscalizacion() {
    const defaultItems = [
      { id: 'rutina_tarde', nombre: 'Llegada tarde al aula / Inasistencia a clase', vincularUtp: false },
      { id: 'rutina_leccionario', nombre: 'No posee o no llena leccionario', vincularUtp: true },
      { id: 'rutina_planificacion', nombre: 'No posee o no entrega planificaciones', vincularUtp: true },
      { id: 'rutina_evaluacion', nombre: 'No envía o entrega evaluaciones a tiempo', vincularUtp: true }
    ];
    if (this.cache.config && Array.isArray(this.cache.config.tipos_fiscalizacion) && this.cache.config.tipos_fiscalizacion.length > 0) {
      return this.cache.config.tipos_fiscalizacion;
    }
    try {
      const stored = localStorage.getItem('barita_tipos_fiscalizacion');
      if (stored) return JSON.parse(stored);
    } catch (_e) {}
    return defaultItems;
  },

  async saveTiposFiscalizacion(items) {
    if (!this.cache.config) this.cache.config = { key: 'main' };
    this.cache.config.tipos_fiscalizacion = items;

    try {
      localStorage.setItem('barita_tipos_fiscalizacion', JSON.stringify(items));
    } catch (_e) {}

    if (!this.localMutations.config) this.localMutations.config = {};
    const configDoc = Object.assign({}, this.cache.config || {}, { key: 'main', tipos_fiscalizacion: items });
    this.localMutations.config['main'] = JSON.parse(JSON.stringify(configDoc));
    this.persistLocalMutations();

    try {
      const client = (typeof window.getSupabaseClient === 'function') ? window.getSupabaseClient() : null;
      if (client && (!Auth.currentUser || !Auth.currentUser.uid || !Auth.currentUser.uid.startsWith('test-user'))) {
        await client.from('config').upsert({ key: 'main', tipos_fiscalizacion: items }, { onConflict: 'key' });
      }
    } catch (e) {
      console.warn("Error al guardar tipos_fiscalizacion en Supabase:", e);
    }
    return true;
  },

  async loadNotasFromSupabase() {
    try {
      const client = (typeof window.getSupabaseClient === 'function') ? window.getSupabaseClient() : null;
      if (!client) return this.getNotasColaborativas();

      const activeSchool = this.activeSchool || 'terra_di_bimbi';
      const { data, error } = await client
        .from('notas_colaborativas')
        .select('*')
        .eq('colegio_id', activeSchool)
        .order('created_at', { ascending: false });

      console.log('🔍 [DIAGNOSTICO NOTAS SUPABASE] Carga desde BD:', data ? data.length : 0, 'registros. Error:', error);

      if (error) {
        console.warn('Error al consultar notas_colaborativas en Supabase:', error.message || error);
        return this.getNotasColaborativas();
      }

      if (Array.isArray(data)) {
        const localList = this.getNotasColaborativas();
        const map = new Map();

        // 1. Cargar las remotas de Supabase primero (son la fuente de verdad)
        data.forEach(n => {
          if (n && n.id && n.id !== 'nota_demo_1') {
            map.set(String(n.id), n);
          }
        });

        // 2. Cargar las locales solo si corresponden a otros colegios
        localList.forEach(n => {
          if (n && n.id && n.id !== 'nota_demo_1') {
            const nSchool = (n.colegio_id || n.colegioId || 'terra_di_bimbi').toString().trim();
            if (nSchool !== activeSchool) {
              map.set(String(n.id), n);
            }
          }
        });

        const merged = Array.from(map.values()).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        this.cache.notas_colaborativas = merged;
        try { localStorage.setItem('barita_notas_colaborativas', JSON.stringify(merged)); } catch (_e) {}

        // Sincronizar también la tabla de comentarios (sellos de evidencia de lectura)
        try {
          const { data: comData } = await client.from('nota_comentarios').select('*').order('created_at', { ascending: true });
          if (Array.isArray(comData)) {
            this.cache.nota_comentarios = comData;
            try { localStorage.setItem('barita_nota_comentarios', JSON.stringify(comData)); } catch (_e) {}
          }
        } catch (_e) {}

        // Sincronizar también la lista de usuarios activos para el colegio activo
        try {
          let { data: usersData } = await client.from('usuarios').select('id, email, role, nombres, apellidos, colegio_id').eq('is_active', true);
          if (Array.isArray(usersData)) {
            // Filtrar usuarios oficiales para terra_di_bimbi y excluir residuales
            usersData = usersData.filter(u => {
              const email = u.email ? u.email.trim().toLowerCase() : '';
              const nombres = u.nombres ? u.nombres.toLowerCase() : '';
              const officialEmails = [
                'italo.soto@colegioterradibimbi.cl',
                'utp@terra.cl',
                'dire1@terra.cl',
                'conv@terra.cl',
                'utp2@terra.cl',
                'dire2@terra.cl',
                'pie@terra.cl'
              ];
              return email && officialEmails.includes(email) && !nombres.includes('nuevo usuario');
            });
            this.cache.usuarios = usersData;
            try { localStorage.setItem('barita_usuarios_cache', JSON.stringify(usersData)); } catch (_e) {}
          }
        } catch (_e) {}

        return merged;
      }
    } catch (e) {
      console.warn('Excepción al cargar notas desde Supabase:', e);
    }
    return this.getNotasColaborativas();
  },

  getNotasColaborativas() {
    let list = [];
    if (Array.isArray(this.cache.notas_colaborativas) && this.cache.notas_colaborativas.length > 0) {
      list = this.cache.notas_colaborativas;
    } else {
      try {
        const stored = localStorage.getItem('barita_notas_colaborativas');
        if (stored) list = JSON.parse(stored);
      } catch (_e) {}
    }
    const filtered = list.filter(n => n.id !== 'nota_demo_1');
    if (filtered.length !== list.length) {
      this.cache.notas_colaborativas = filtered;
      try { localStorage.setItem('barita_notas_colaborativas', JSON.stringify(filtered)); } catch (_e) {}
    }
    return filtered;
  },

  getUsuarios() {
    if (Array.isArray(this.cache.usuarios) && this.cache.usuarios.length > 0) {
      return this.cache.usuarios;
    }
    try {
      const stored = localStorage.getItem('barita_usuarios_cache');
      if (stored) return JSON.parse(stored);
    } catch (_e) {}
    return [];
  },

  async saveNotaColaborativa(nota) {
    if (!nota.id) nota.id = 'nota_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    if (!nota.created_at) nota.created_at = new Date().toISOString();
    if (!nota.colegio_id) nota.colegio_id = this.activeSchool || 'demo';
    if (typeof nota.leido === 'undefined') nota.leido = false;
    if (typeof nota.is_deleted === 'undefined') nota.is_deleted = false;

    const list = this.getNotasColaborativas();
    const idx = list.findIndex(n => String(n.id) === String(nota.id));
    if (idx >= 0) list[idx] = { ...list[idx], ...nota };
    else list.unshift(nota);

    this.cache.notas_colaborativas = list;
    try { localStorage.setItem('barita_notas_colaborativas', JSON.stringify(list)); } catch (_e) {}

    // Depuración de payload para Supabase para evitar rechazos de columnas no existentes (PostgREST 400)
    const allowedColumns = [
      'id', 'colegio_id', 'emisor_id', 'emisor_nombre', 'receptor_id', 'receptor_nombre',
      'mensaje', 'color', 'requiere_confirmacion', 'leido', 'fecha_lectura',
      'leido_por_nombre', 'is_deleted', 'deleted_by', 'deleted_at', 'created_at', 'updated_at',
      'confirmaciones', 'creador_email', 'visibilidad', 'is_privada'
    ];
    const supabasePayload = {};
    allowedColumns.forEach(col => {
      if (typeof nota[col] !== 'undefined') {
        supabasePayload[col] = nota[col];
      }
    });

    // Supabase sync
    try {
      const client = (typeof window.getSupabaseClient === 'function') ? window.getSupabaseClient() : null;
      if (client) {
        const { error } = await client.from('notas_colaborativas').upsert(supabasePayload);
        if (error) {
          console.error('⚠️ ERROR CRÍTICO AL GUARDAR NOTA EN SUPABASE:', error);
        } else {
          console.log('✅ NOTA GUARDADA EXITOSAMENTE EN SUPABASE:', supabasePayload.id);
        }
      }
    } catch (e) {
      console.warn('Error sincronizando nota en Supabase:', e);
    }
    if (typeof this.notifyListeners === 'function') {
      this.notifyListeners();
    }
    return nota;
  },

  async markNotaLeida(notaId, lectorNombre = 'Funcionario') {
    const list = this.getNotasColaborativas();
    const nota = list.find(n => String(n.id) === String(notaId));
    if (!nota) return null;

    const now = new Date();
    const nowIso = now.toISOString();
    const dateStr = now.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    const stampText = `💬 Confirmación: Nota leída por ${lectorNombre} el ${dateStr} a las ${timeStr} hrs.`;

    if (!Array.isArray(nota.confirmaciones)) {
      nota.confirmaciones = [];
    }

    const currentUser = (typeof Auth !== 'undefined' && Auth.currentUser) ? Auth.currentUser : null;
    const myEmail = currentUser ? (currentUser.email || '').toLowerCase() : '';
    const myId = currentUser ? (currentUser.id || currentUser.uid) : '';

    const yaFirmado = nota.confirmaciones.some(c => 
      (myId && String(c.usuario_id) === String(myId)) || 
      (myEmail && String(c.email).toLowerCase() === myEmail)
    );

    if (!yaFirmado) {
      nota.confirmaciones.push({
        usuario_id: myId,
        email: myEmail,
        nombre: lectorNombre,
        fecha: nowIso,
        comentario: stampText // Guardar el texto descriptivo del sello
      });
    }

    // Mantener campos legacy para compatibilidad
    nota.leido = true;
    nota.fecha_lectura = nowIso;
    nota.leido_por_nombre = lectorNombre;

    return await this.saveNotaColaborativa(nota);
  },

  async deleteNotaColaborativa(notaId, usuarioNombre = 'Funcionario') {
    const targetId = String(notaId);
    let list = this.getNotasColaborativas();
    const nota = list.find(n => String(n.id) === targetId);

    if (nota) {
      // Soft Delete: Preserva el registro para la Bitácora de Evidencia Institucional
      nota.is_deleted = true;
      nota.deleted_by = usuarioNombre;
      nota.deleted_at = new Date().toISOString();
      await this.saveNotaColaborativa(nota);
    } else {
      list = list.filter(n => String(n.id) !== targetId);
      this.cache.notas_colaborativas = list;
      try { localStorage.setItem('barita_notas_colaborativas', JSON.stringify(list)); } catch (_e) {}
    }
    if (typeof this.notifyListeners === 'function') {
      this.notifyListeners();
    }
    return true;
  },

  async purgeNotaColaborativa(notaId) {
    const targetId = String(notaId);
    
    // 1. Remove from local cache and local storage
    if (this.cache.notas_colaborativas) {
      this.cache.notas_colaborativas = this.cache.notas_colaborativas.filter(n => String(n.id) !== targetId);
    }
    try {
      const stored = localStorage.getItem('barita_notas_colaborativas');
      if (stored) {
        let list = JSON.parse(stored);
        list = list.filter(n => String(n.id) !== targetId);
        localStorage.setItem('barita_notas_colaborativas', JSON.stringify(list));
      }
    } catch (_e) {}

    // 2. Hard delete from Supabase
    try {
      const client = (typeof window.getSupabaseClient === 'function') ? window.getSupabaseClient() : null;
      if (client) {
        const { error } = await client.from('notas_colaborativas').delete().eq('id', targetId);
        if (error) {
          console.error('⚠️ ERROR AL PURGAR NOTA EN SUPABASE:', error);
        } else {
          console.log('✅ NOTA ELIMINADA DEFINITIVAMENTE DE SUPABASE:', targetId);
        }
      }
    } catch (e) {
      console.warn('Error purgando nota en Supabase:', e);
    }

    if (typeof this.notifyListeners === 'function') {
      this.notifyListeners();
    }
    return true;
  },

  getNotaComentarios(notaId) {
    const list = this.getNotasColaborativas();
    const nota = list.find(n => String(n.id) === String(notaId));
    if (!nota || !Array.isArray(nota.confirmaciones)) return [];

    return nota.confirmaciones.map(c => {
      if (!c) return null;
      return {
        id: c.id || ('stamp_' + (c.usuario_id || 'anon') + '_' + new Date(c.fecha || c.created_at || 0).getTime()),
        usuario_nombre: c.usuario_nombre || c.nombre || 'Funcionario',
        comentario: c.comentario || `✓ Confirmación: Nota leída.`,
        created_at: c.created_at || c.fecha || new Date().toISOString()
      };
    }).filter(Boolean).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  },

  async addNotaComentario(notaId, comentarioText) {
    const userProfile = (typeof Auth !== 'undefined' && Auth.userProfile) ? Auth.userProfile : null;
    const currentUser = (typeof Auth !== 'undefined' && Auth.currentUser) ? Auth.currentUser : null;
    const currentRole = (typeof Auth !== 'undefined' && Auth.currentRole) ? Auth.currentRole : 'usuario';
    const rawName = (userProfile && (userProfile.nombres || userProfile.nombre)) ? (userProfile.nombres || userProfile.nombre) : (currentUser ? (currentUser.email || 'Funcionario') : 'Funcionario');
    
    const roleMasks = {
      admin: 'Inspector General',
      administrador: 'Inspector General',
      directora: 'Directora',
      director: 'Directora',
      utp: 'UTP',
      pie: 'PIE',
      convivencia: 'Convivencia Escolar',
      inspectoria: 'Inspectoría General'
    };
    const roleTag = roleMasks[currentRole.toLowerCase()] || currentRole.toUpperCase();
    const cleanName = rawName.replace(/^(UTP|Directora|Director|Convivencia|Convivencia Escolar|PIE|Administrador|Admin|Inspector General|Super Admin)\s*[-–]\s*/i, '').trim();
    
    const emailToName = {
      'admin@terra.cl': 'Inspector General - Italo',
      'utp@terra.cl': 'UTP - Maximiliano',
      'conv@terra.cl': 'Convivencia Escolar - Silvana P',
      'utp2@terra.cl': 'UTP - Jessica',
      'dire1@terra.cl': 'Directora - Silvana C',
      'dire2@terra.cl': 'Directora - Rommy',
      'pie@terra.cl': 'PIE - Pamela'
    };

    let nombreFormateado = `${roleTag} - ${cleanName}`;
    if (currentUser && currentUser.email && emailToName[currentUser.email.toLowerCase()]) {
      nombreFormateado = emailToName[currentUser.email.toLowerCase()];
    }

    const comentario = {
      id: 'com_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      usuario_id: currentUser ? (currentUser.id || currentUser.uid || 'anonimo') : 'anonimo',
      usuario_nombre: nombreFormateado,
      comentario: comentarioText,
      created_at: new Date().toISOString(),
      es_comentario: true
    };

    const list = this.getNotasColaborativas();
    const nota = list.find(n => String(n.id) === String(notaId));
    if (nota) {
      if (!Array.isArray(nota.confirmaciones)) {
        nota.confirmaciones = [];
      }
      nota.confirmaciones.push(comentario);
      await this.saveNotaColaborativa(nota);
    }

    if (typeof this.notifyListeners === 'function') {
      this.notifyListeners();
    }
    return comentario;
  },

  getNotasPendientesCountForCurrentUser() {
    const notas = this.getNotasColaborativas();
    if (!notas || notas.length === 0) return 0;

    const user = (typeof Auth !== 'undefined' && Auth.currentUser) ? Auth.currentUser : null;
    const role = (typeof Auth !== 'undefined' && Auth.currentRole) ? Auth.currentRole.toLowerCase() : '';
    const userId = user ? (user.id || user.uid) : null;

    let count = 0;
    notas.forEach(n => {
      if (n.leido) return;
      
      const receptor = (n.receptor_id || '').toLowerCase();
      let matches = false;
      if (receptor === 'todos' || receptor === 'todo el equipo') matches = true;
      else if (receptor === 'utp' && (role === 'utp' || role === 'coordinadora')) matches = true;
      else if (receptor === 'direccion' && (role === 'directora' || role === 'admin' || role === 'superadmin')) matches = true;
      else if (userId && receptor === userId.toLowerCase()) matches = true;
      else if (role && receptor === role) matches = true;

      if (matches) count++;
    });

    return count;
  }
});

// Firebase compatibility polyfill
window.db = {
  batch: () => {
    const ops = [];
    return {
      set: (ref, data) => ops.push(() => ref.set(data)),
      update: (ref, data) => ops.push(() => ref.update(data)),
      delete: (ref) => ops.push(() => ref.delete()),
      commit: async () => {
        for (const op of ops) await op();
      }
    };
  },
  collection: (colName) => ({
    doc: (docId) => ({
      set: async (data, opts) => {
         const obj = { id: docId, ...data };
         if (window.Storage && window.Storage.injectColegioId) window.Storage.injectColegioId(obj);
         const { error } = await window.getSupabaseClient().from(colName).upsert(obj);
         if (error) {
             console.error('Supabase Upsert Error:', error);
             throw new Error(error.message || 'Error saving in Supabase');
         }
      },
      update: async (data) => {
         await window.getSupabaseClient().from(colName).update(data).eq('id', docId);
      },
      delete: async () => {
         await window.getSupabaseClient().from(colName).delete().eq('id', docId);
      },
      get: async () => {
         const { data } = await window.getSupabaseClient().from(colName).select('*').eq('id', docId).single();
         return { exists: !!data, data: () => data || {}, id: docId };
      },
      onSnapshot: (callback, errCb) => {
         window.getSupabaseClient().from(colName).select('*').eq('id', docId).single().then(({data}) => {
             callback({ exists: !!data, data: () => data || {}, id: docId });
         }).catch(e => errCb && errCb(e));
         return () => {}; 
      }
    }),
    add: async (data) => {
       const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
       const obj = { id, ...data };
       if (window.Storage && window.Storage.injectColegioId) window.Storage.injectColegioId(obj);
       await window.getSupabaseClient().from(colName).insert(obj);
       return { id };
    },
    get: async () => {
       let client = window.getSupabaseClient().from(colName).select('*');
       if (window.Storage && window.Storage.activeSchool && colName !== 'config') {
          client = client.eq('colegioId', window.Storage.activeSchool);
       }
       const { data } = await client;
       const docs = (data || []).map(d => ({ id: d.id, data: () => d }));
       return { empty: docs.length === 0, docs, forEach: (cb) => docs.forEach(cb) };
    },
    where: (field, operator, value) => ({
       get: async () => {
          const { data } = await window.getSupabaseClient().from(colName).select('*').eq(field, value);
          const docs = (data || []).map(d => ({ id: d.id, data: () => d }));
          return { empty: docs.length === 0, docs, forEach: (cb) => docs.forEach(cb) };
       }
    }),
    orderBy: (field, direction) => ({
       onSnapshot: (callback) => {
             window.getSupabaseClient().from(colName).select('*').order(field, { ascending: direction !== 'desc' }).then(({data}) => {
                 const docs = (data || []).map(d => ({ id: d.id, data: () => d }));
                 callback({ forEach: (cb) => docs.forEach(cb) });
             });
             return () => {};
       }
    }),
    onSnapshot: (callback) => {
         window.getSupabaseClient().from(colName).select('*').then(({data}) => {
             const docs = (data || []).map(d => ({ id: d.id, data: () => d }));
             callback({ forEach: (cb) => docs.forEach(cb) });
         });
         return () => {};
    }
  })
};
