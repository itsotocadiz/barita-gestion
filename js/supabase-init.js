// Supabase — BARITA Gestión (aislado)
const _metaUrl = document.querySelector('meta[name="supabase-url"]')?.content;
const _metaKey = document.querySelector('meta[name="supabase-anon-key"]')?.content;
const gestionUrl = (window.__BARITA_ENV__?.SUPABASE_URL) || _metaUrl || 'https://gwhlgphmchnymsiwqpkx.supabase.co';
const gestionKey = (window.__BARITA_ENV__?.SUPABASE_ANON_KEY) || _metaKey || 'sb_publishable_go7pcflMpEBvf2du3Hp90Q_y1lM87CG';
window.supabaseGestion = supabase.createClient(gestionUrl, gestionKey, {
  auth: { storageKey: 'barita-gestion-auth-token', persistSession: true, detectSessionInUrl: true }
});
window.supabasePostulaciones = null;
window.getSupabaseClient = function() { return window.supabaseGestion; };
