import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Cliente para el portal de POSTULACIONES
// Lee las variables de entorno o constantes. 
// Nota: en un entorno puro HTML/JS sin bundler, reemplaza process.env por las strings reales
// o inyéctalas a través de tu servidor.

const supabaseUrl = typeof process !== 'undefined' && process.env
  ? (process.env.VITE_SUPABASE_POSTULACIONES_URL || process.env.NEXT_PUBLIC_SUPABASE_POSTULACIONES_URL || process.env.SUPABASE_POSTULACIONES_URL || 'https://gwhlgphmchnymsiwqpkx.supabase.co')
  : 'https://gwhlgphmchnymsiwqpkx.supabase.co';

const supabaseKey = typeof process !== 'undefined' && process.env
  ? (process.env.VITE_SUPABASE_POSTULACIONES_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_POSTULACIONES_ANON_KEY || process.env.SUPABASE_POSTULACIONES_ANON_KEY)
  : 'sb_publishable_go7pcflMpEBvf2du3Hp90Q_y1lM87CG';

export const supabasePostulaciones = createClient(supabaseUrl, supabaseKey);
