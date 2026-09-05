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

    // Llamada optimizada a Gemini: Prioriza 2.0 Flash y 1.5 Flash sin 'thinking' para respuesta en 1-2s
    let geminiRes = null;
    const attemptsLog = [];
    const modelsToTry = [
      { name: 'gemini-2.0-flash', body: { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 800 } } },
      { name: 'gemini-1.5-flash', body: { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 800 } } },
      { name: 'gemini-3.6-flash', body: { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 800, thinkingConfig: { thinkingLevel: "MINIMAL" } } } }
    ];

    for (const modelSpec of modelsToTry) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000); // 9s timeout por modelo

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelSpec.name}:generateContent?key=${apiKey}`;
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(modelSpec.body),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (r.ok) {
          geminiRes = r;
          break;
        } else {
          const errText = await r.text();
          attemptsLog.push({ model: modelSpec.name, status: r.status, err: errText.slice(0, 300) });
          if (r.status === 401 || r.status === 403) {
            geminiRes = r;
            break;
          }
        }
      } catch (e) {
        clearTimeout(timeoutId);
        const isTimeout = e.name === 'AbortError';
        attemptsLog.push({ model: modelSpec.name, status: isTimeout ? 408 : 0, err: e.message });
      }
    }

    if (!geminiRes) {
      return new Response(JSON.stringify({ error: 'Error from Gemini API', details: attemptsLog }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
