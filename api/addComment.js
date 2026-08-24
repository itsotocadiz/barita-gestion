/* ================================================================
   api/addComment.js — Serverless Endpoint para Inserción de Comentarios
   Proyecto: BARITA
   Bypassa RLS utilizando SUPABASE_SERVICE_ROLE_KEY de forma segura
   después de validar el JWT del usuario emisor.
   ================================================================ */

export const config = {
  runtime: 'edge',
};

function stripHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>?/gm, '');
}

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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), { 
      status: 405, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://gwhlgphmchnymsiwqpkx.supabase.co';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';

    if (!serviceRoleKey) {
      return new Response(JSON.stringify({ 
        error: 'SUPABASE_SERVICE_ROLE_KEY no está configurada' 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    // Fallback: si anonKey no está en Env (Vercel), usar serviceRole para verificar JWT (también válido para auth/v1/user)
    const verifyKey = supabaseAnonKey || serviceRoleKey;

    // --- 1. Validar sesión del usuario (JWT) ---
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'No autorizado: falta sesión' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    const token = authHeader.split('Bearer ')[1];
    
    // Consultar el endpoint de usuario de Supabase Auth para verificar el token
    const verifyRes = await fetch(`${supabaseUrl}/auth/v1/user`, { 
      headers: { 'apikey': verifyKey, 'Authorization': `Bearer ${token}` } 
    });
    if (!verifyRes.ok) {
      return new Response(JSON.stringify({ error: 'Sesión no válida o expirada' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    const userData = await verifyRes.json();
    const callerUid = userData.id;

    if (!callerUid) {
      return new Response(JSON.stringify({ error: 'Usuario no identificado' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Consultar rol y colegio del usuario en usuarios via service_role (fallback a contexto autenticado si serviceRole falla)
    let callerRole = null;
    let callerColegio = 'demo';
    let callerNombre = userData.email || 'Usuario';
    let roleRes = await fetch(`${supabaseUrl}/rest/v1/usuarios?id=eq.${callerUid}&select=role,colegio_id,colegioId,nombres,apellidos,email`, {
      headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}` }
    });
    if (!roleRes.ok) {
      // Fallback: consultar como usuario autenticado (RLS: usuarios_select)
      roleRes = await fetch(`${supabaseUrl}/rest/v1/usuarios?id=eq.${callerUid}&select=role,colegio_id,colegioId,nombres,apellidos,email`, {
        headers: { 'apikey': verifyKey, 'Authorization': `Bearer ${token}` }
      });
    }
    if (roleRes.ok) {
      const roleData = await roleRes.json();
      if (Array.isArray(roleData) && roleData[0]) {
        callerRole = (roleData[0].role || '').toLowerCase();
        callerColegio = roleData[0].colegio_id || roleData[0].colegioId || 'demo';
        callerNombre = [roleData[0].nombres, roleData[0].apellidos].filter(Boolean).join(' ').trim() || roleData[0].email || callerNombre;
      }
    }

    // --- 2. Procesar el body de la petición ---
    const body = await req.json();
    const { comentario } = body;

    if (!comentario || !comentario.nota_id || !comentario.comentario) {
      return new Response(JSON.stringify({ error: 'Comentario y nota_id requeridos' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Validar que la nota referenciada pertenezca al mismo colegio (o superadmin) — usa serviceRole para ver todas las notas (bypass RLS)
    const notaRes = await fetch(`${supabaseUrl}/rest/v1/notas_colaborativas?id=eq.${encodeURIComponent(comentario.nota_id)}&select=colegio_id`, {
      headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}` }
    });
    if (!notaRes.ok) {
      const notaErr = await notaRes.text();
      return new Response(JSON.stringify({ error: 'Error al consultar la nota colaborativa en la base de datos', details: notaErr, status: notaRes.status }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const notaData = await notaRes.json();
    if (!Array.isArray(notaData) || notaData.length === 0) {
      return new Response(JSON.stringify({ error: 'La nota referenciada no existe' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const notaColegio = notaData[0].colegio_id || 'demo';
    if (callerRole !== 'superadmin' && notaColegio !== callerColegio) {
      return new Response(JSON.stringify({ error: 'No autorizado: la nota referenciada pertenece a otro colegio' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Sobreescribir el usuario_id para garantizar que corresponde al dueño del token (evita spoofing)
    // nota_comentarios: id, nota_id, usuario_id, usuario_nombre, comentario, created_at - NO tiene colegio_id
    comentario.usuario_id = callerUid;
    comentario.comentario = stripHtml(comentario.comentario || '');
    comentario.usuario_nombre = stripHtml(comentario.usuario_nombre || callerNombre || 'Funcionario');

    if (!comentario.id) comentario.id = (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2));
    if ('colegio_id' in comentario) delete comentario.colegio_id;
    if ('colegioId' in comentario) delete comentario.colegioId;
    if ('colegio' in comentario) delete comentario.colegio;

    // --- 3. Insertar comentario — intenta con contexto usuario (RLS permite auth.uid), fallback a serviceRole
    let insertRes = await fetch(`${supabaseUrl}/rest/v1/nota_comentarios`, {
      method: 'POST',
      headers: {
        'apikey': verifyKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(comentario)
    });
    if (!insertRes.ok && serviceRoleKey) {
      // Fallback serviceRole si RLS bloqueó (ej. token sin permiso)
      insertRes = await fetch(`${supabaseUrl}/rest/v1/nota_comentarios`, {
        method: 'POST',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(comentario)
      });
    }

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      return new Response(JSON.stringify({ error: 'Error en base de datos al guardar comentario', details: errText }), { 
        status: insertRes.status, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const insertedData = await insertRes.json();

    return new Response(JSON.stringify({ success: true, data: insertedData }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (err) {
    console.error('Error en api/addComment:', err);
    return new Response(JSON.stringify({ error: 'Error interno del servidor', details: err.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
}
