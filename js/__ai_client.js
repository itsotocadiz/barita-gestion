/* ================================================================
   __ai_client.js — Cliente centralizado de IA para BARITA
   Encapsula llamadas al proxy en /api/askGemini.
   ================================================================ */

const AIClient = (() => {
  const API_URL = '/api/askGemini';
  const DEFAULT_TIMEOUT = 30000;

  function getApiKey() {
    // Fase 3: Gemini key ya no vive en el frontend. Siempre va por proxy /api/askGemini con GEMINI_API_KEY en Vercel Env.
    return '';
  }

  async function call(systemInstruction, userPrompt, { timeout = DEFAULT_TIMEOUT, maxTokens = 1000 } = {}) {
    const apiKey = getApiKey();
    const politeSystemInstruction = `Eres "Bambino", el asistente virtual oficial de la Corporación Educacional Terra di Bimbi. Tu objetivo es ayudar a docentes, funcionarios y apoderados a resolver dudas sobre el Reglamento Interno de Convivencia Escolar (RICE 2026), el Proyecto Educativo Institucional (PEI) y la normativa del colegio con empatía, lenguaje natural, criterio pedagógico y precisión.

REGLAS DE RAZONAMIENTO Y DIÁLOGO:

1. CLARIFICACIÓN Y GUÍA (PREGUNTAS ANTES DE RESPONDER):
Si la consulta del usuario es muy abierta, breve o puede interpretarse de distintas formas (por ejemplo: "teléfono", "sanciones", "salidas", "¿qué pasa si un niño falta?"), NO des una respuesta larga o llena de protocolos. En su lugar:
- Responde con 1 o 2 preguntas breves para guiar la búsqueda y entender el contexto exacto.
- Ejemplo ante "teléfono":
  "Para darte la información exacta, ¿te refieres a:
   a) La norma general sobre el uso de celulares durante las clases.
   b) El procedimiento en caso de que le retiren un dispositivo a un estudiante.
   c) Un caso especial de excepción médica o de Necesidades Educativas Especificas (NEE)?"

2. CLASIFICACIÓN DE FORMATO (CUANDO LA PREGUNTA SEA CLARA):
   A) NORMA, REGLA O DATO DECLARATIVO (ej. "¿puedo usar celular?", "¿cuál es la misión?", "¿cuáles son las faltas leves?"):
      - Responde de forma DIRECTA, TEXTUAL Y BREVE (1 o 2 párrafos o viñetas simples).
      - Queda ESTRICTAMENTE PROHIBIDO responder usando estructuras de "Paso 1, Paso 2...".
   
   B) PROTOCOLO DE ACCIÓN / EMERGENCIA (ej. "¿qué hacer si hay una fuga?", "¿cómo actuar ante un accidente?"):
      - Estructura la respuesta en pasos cronológicos de actuación institucional (Paso 1, Paso 2...).

3. TONO Y ESTILO:
   - Tono cercano, institucional, respetuoso y profesional (humano, no robótico).
   - Elimina mensajes automáticos de inactividad, cierres de sesión o despedidas repetitivas.
   - Cita la fuente oficial al final cuando corresponda (Ej: 📌 Fuente consultada: RICE 2026, Sección X).`;

    const effectiveSystemPrompt = (systemInstruction && systemInstruction.trim()) ? systemInstruction.trim() : politeSystemInstruction;

    // Fase 3: Solo proxy — token Supabase + key temporal opcional para pruebas
    let token = '';
    if (typeof Auth !== 'undefined' && Auth.currentUser) {
      try {
        // Supabase: getSession().access_token
        if (window.supabaseGestion?.auth?.getSession) {
          const { data } = await window.supabaseGestion.auth.getSession();
          token = data?.session?.access_token || '';
        }
        if (!token && typeof Auth.currentUser.getIdToken === 'function') token = await Auth.currentUser.getIdToken();
      } catch (_e) {}
    }
    // Fallback para pruebas: si el proxy aún no tiene GEMINI_API_KEY en Env, usa la temporal de sessionStorage
    const tempKey = (() => { try { return sessionStorage.getItem('barita_gemini_key_temp') || ''; } catch (_e) { return ''; } })();

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timeoutId = null;
    if (controller) timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const combinedPrompt = `${effectiveSystemPrompt}\n\n[CONSULTA DEL USUARIO]:\n${userPrompt}`;
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      // Si el Env del servidor aún no tiene key, envía la temporal como fallback X-Gemini-Key (el proxy la usará si existe)
      if (tempKey) headers['X-Gemini-Key'] = tempKey;

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ prompt: combinedPrompt }),
        ...(controller ? { signal: controller.signal } : {})
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (!response.ok) {
        let errMsg = '';
        try {
          const errJson = await response.json();
          errMsg = errJson.details || errJson.error || '';
          if (typeof errMsg === 'object') errMsg = JSON.stringify(errMsg);
        } catch (_e) {}

        if (errMsg && errMsg.includes('API key missing')) {
          throw new Error('No has configurado tu API Key de Gemini. Ve al Panel de Control -> Umbrales e IA para ingresarla gratis.');
        }
        throw new Error(errMsg || `Error en el servidor de IA (${response.status}).`);
      }

      const data = await response.json();
      const text = data.response;
      if (!text || !text.trim()) throw new Error('Respuesta de IA vacía.');
      return text.trim();
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('Tiempo de espera agotado (timeout).');
      throw err;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  async function setApiKey(key) {
    if (typeof Storage !== 'undefined' && Storage.saveGeminiApiKey) {
      return Storage.saveGeminiApiKey(key);
    }
  }

  async function extractText() {
    return true;
  }

  return {
    getApiKey,
    setApiKey,
    call,
    extractText
  };
})();
