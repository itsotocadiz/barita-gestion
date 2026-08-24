/* ================================================================
   api/createUser.js — Serverless Endpoint para Creación de Usuarios
   Proyecto: BARITA
   Bypassa RLS de forma segura utilizando SUPABASE_SERVICE_ROLE_KEY
   e inyecta el colegio_id único correspondiente.
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
        error: 'SUPABASE_SERVICE_ROLE_KEY no configurada en Vercel Env. Configúrala antes de crear usuarios.'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const verifyKey = supabaseAnonKey || serviceRoleKey;

    // --- Auth obligatoria: solo admin/superadmin autenticado puede crear usuarios ---
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'No autorizado: falta sesión' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const callerToken = authHeader.split('Bearer ')[1];
    if (!callerToken || callerToken.length < 20) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verificar JWT y obtener rol del caller
    let callerRole = null;
    let callerColegio = 'demo';
    try {
      const verifyRes = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { 'apikey': verifyKey, 'Authorization': `Bearer ${callerToken}` } });
      if (!verifyRes.ok) return new Response(JSON.stringify({ error: 'Sesión no válida' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const userData = await verifyRes.json();
      const callerUid = userData.id;

      // Consultar rol en tabla usuarios via service_role obligatoriamente
      if (callerUid) {
        const roleRes = await fetch(`${supabaseUrl}/rest/v1/usuarios?id=eq.${callerUid}&select=role,colegio_id,colegioId`, {
          headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}` }
        });
        const roleData = await roleRes.json();
        if (Array.isArray(roleData) && roleData[0]) {
          callerRole = (roleData[0].role || '').toLowerCase();
          callerColegio = roleData[0].colegio_id || roleData[0].colegioId || 'demo';
        }
      }
    } catch (_e) {
      return new Response(JSON.stringify({ error: 'Error validando sesión' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!callerRole || !['superadmin','admin'].includes(callerRole)) {
      return new Response(JSON.stringify({ error: 'Solo administradores pueden crear usuarios' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { email, password, role, colegio_id, nombres, apellidos } = body;

    if (!email || !role) {
      return new Response(JSON.stringify({ error: 'Email y rol son requeridos' }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    
    // Validar formato de correo electrónico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return new Response(JSON.stringify({ error: 'El formato de correo no es válido' }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const allowedRoles = ['superadmin','admin','directora','utp','coordinadora','inspectoria','finanza','PIE','convivencia','profesor'];
    if (!allowedRoles.includes((role||'').toLowerCase())) {
      return new Response(JSON.stringify({ error: 'Rol no válido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (password && password.length < 8) {
      return new Response(JSON.stringify({ error: 'Contraseña debe tener al menos 8 caracteres' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Sanitizar nombres y apellidos
    const cleanNombres = stripHtml(nombres || 'Nuevo').trim();
    const cleanApellidos = stripHtml(apellidos || 'Usuario').trim();

    // Solo superadmin puede asignar colegio distinto al propio
    let targetSchool = colegio_id || callerColegio || 'demo';
    if (callerRole !== 'superadmin' && targetSchool !== callerColegio) {
      targetSchool = callerColegio;
    }

    // 1. Consultar si el usuario existe en REST API usando service key
    const checkRes = await fetch(`${supabaseUrl}/rest/v1/usuarios?email=eq.${encodeURIComponent(normalizedEmail)}`, {
      method: 'GET',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      }
    });

    const checkData = await checkRes.json();

    if (Array.isArray(checkData) && checkData.length > 0) {
      const existing = checkData[0];
      if (existing.is_active) {
        return new Response(JSON.stringify({ error: 'El correo ya posee un perfil activo' }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Reactivar usuario existente
      const updateRes = await fetch(`${supabaseUrl}/rest/v1/usuarios?id=eq.${existing.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          is_active: true,
          role: role,
          nombres: cleanNombres,
          apellidos: cleanApellidos,
          colegio_id: targetSchool,
          colegioId: targetSchool,
          updated_at: new Date().toISOString()
        })
      });

      const updated = await updateRes.json();
      return new Response(JSON.stringify({ success: true, action: 'reactivated', data: updated }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Crear usuario vía Admin Auth API de Supabase
    // Generar password seguro si no viene
    let finalPassword = password;
    if (!finalPassword) {
      const rnd = crypto.randomUUID().slice(0, 12);
      finalPassword = `Brt-${rnd}!A1`;
    }
    const signUpRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: normalizedEmail,
        password: finalPassword,
        email_confirm: true
      })
    });

    const signUpData = await signUpRes.json();
    const uid = signUpData.id || (signUpData.user ? signUpData.user.id : null);

    if (!uid) {
      return new Response(JSON.stringify({ error: signUpData.msg || signUpData.error_description || 'Error creando credencial Auth' }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Upsert en tabla usuarios
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/usuarios`, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        id: uid,
        email: normalizedEmail,
        role: role,
        nombres: cleanNombres,
        apellidos: cleanApellidos,
        is_active: true,
        colegio_id: targetSchool,
        colegioId: targetSchool,
        created_at: new Date().toISOString()
      })
    });

    const inserted = await insertRes.json();

    return new Response(JSON.stringify({ success: true, action: 'created', data: inserted }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Error interno del servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
