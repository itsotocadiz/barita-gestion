export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const env = {
    SUPABASE_URL: process.env.SUPABASE_URL || 'https://gwhlgphmchnymsiwqpkx.supabase.co',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'sb_publishable_go7pcflMpEBvf2du3Hp90Q_y1lM87CG'
  };
  return new Response(`window.__BARITA_ENV__ = ${JSON.stringify(env)};`, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-store'
    }
  });
}
