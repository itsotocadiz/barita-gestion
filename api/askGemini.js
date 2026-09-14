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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Server misconfiguration: GEMINI_API_KEY missing en variables de entorno del servidor.' }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Modelos de ultra-baja latencia testeados en producción (~750ms)
    const modelsToTry = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-flash-latest'];
    let geminiRes = null;
    let lastErr = '';

    for (const modelName of modelsToTry) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000); // 7s timeout por intento

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 800
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
          if (r.status === 401 || r.status === 403) {
            geminiRes = r;
            break;
          }
        }
      } catch (e) {
        clearTimeout(timeoutId);
        lastErr = e.name === 'AbortError' ? `Timeout en ${modelName}` : e.message;
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
