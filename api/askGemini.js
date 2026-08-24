export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const allowedOrigins = [
    'https://barita-gestion.vercel.app',
    'https://gestion.barita.cl',
    'https://barita.vercel.app',
    'https://www.barita.cl',
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
  ].filter(Boolean);
  const requestOrigin = req.headers.get('origin') || '';
  const corsOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
    const corsHeaders = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'OPTIONS, POST',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Gemini-Key',
    'Vary': 'Origin'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token || token.length < 20) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabaseUrl = process.env.SUPABASE_URL || 'https://gwhlgphmchnymsiwqpkx.supabase.co';
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';
    if (supabaseAnonKey) {
      try {
        const verifyRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: { 'apikey': supabaseAnonKey, 'Authorization': `Bearer ${token}` }
        });
        if (!verifyRes.ok) {
          return new Response(JSON.stringify({ error: 'Sesión no válida o expirada' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      } catch (_e) {
        return new Response(JSON.stringify({ error: 'No se pudo validar la sesión' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const body = await req.json();
    const prompt = body.prompt;

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const tempKey = req.headers.get('x-gemini-key') || '';
    const apiKey = process.env.GEMINI_API_KEY || tempKey;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Server misconfiguration: API key missing. Configura GEMINI_API_KEY en Vercel Env o pega una temporal en Panel de Control.' }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Llamada real a Gemini — 3.6-flash con thinking MINIMAL (7s estable, Budget 0 da 500)
    let geminiRes = null;
    let lastErr = '';
    const maxAttempts = 2;
    const attemptTimeouts = [10000, 14000]; // 10s + 14s retry

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const attemptTimeout = attemptTimeouts[attempt - 1];
      const timeoutId = setTimeout(() => controller.abort(), attemptTimeout);

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            contents: [{ parts: [{ text: prompt }] }], 
            generationConfig: { 
              temperature: 0.2, 
              thinkingConfig: { thinkingLevel: "MINIMAL" } 
            } 
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (r.ok) {
          geminiRes = r;
          break;
        } else {
          lastErr = await r.text();
          // Si es un error de cliente (400, 401, 403), no tiene sentido reintentar
          if (r.status === 400 || r.status === 401 || r.status === 403) {
            geminiRes = r;
            break;
          }
        }
      } catch (e) {
        clearTimeout(timeoutId);
        lastErr = e.name === 'AbortError' ? `Timeout de ${attemptTimeout / 1000}s en intento ${attempt}` : e.message;
        console.warn(`Intento ${attempt} fallido:`, lastErr);
      }
    }

    if (!geminiRes) {
      return new Response(JSON.stringify({ error: 'Error from Gemini API', details: lastErr }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      return new Response(JSON.stringify({ error: 'Error from Gemini API', details: err }), { 
        status: geminiRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await geminiRes.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No obtuve respuesta de la IA.";

    return new Response(JSON.stringify({ response: responseText }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Error in askGemini:", error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
