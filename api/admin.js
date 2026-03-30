// voice-yakureki v5.8.0 api/admin.js
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function setCors(req, res) {
  const origin = req.headers?.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function getAdminClient() {
  if (!SUPABASE_SRK || !SUPABASE_URL) return null;
  return createClient(SUPABASE_URL, SUPABASE_SRK, { auth: { autoRefreshToken: false, persistSession: false } });
}

function getAnonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON);
}

async function verifyAdmin(req) {
  const authHeader = req.headers?.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    const anon = getAnonClient();
    const { data, error } = await anon.auth.getUser(token);
    if (error || !data?.user) return null;
    const client = getAdminClient() || anon;
    const { data: userRow } = await client.from('users').select('id, role, company_id').eq('id', data.user.id).maybeSingle();
    return userRow;
  } catch { return null; }
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET: 環境変数の診断
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      version: '5.8.0',
      env: {
        SUPABASE_URL: !!SUPABASE_URL && SUPABASE_URL.includes('supabase.co'),
        SUPABASE_ANON_KEY: !!SUPABASE_ANON && SUPABASE_ANON.length > 10,
        SUPABASE_SERVICE_ROLE_KEY: !!SUPABASE_SRK && SUPABASE_SRK.length > 10,
        ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      },
      timestamp: new Date().toISOString()
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { action } = req.body || {};

  // === パスワードリセット依頼（認証不要） ===
  if (action === 'request_password_reset') {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });
    try {
      const client = getAdminClient() || getAnonClient();
      const { data: user } = await client.from('users').select('id').eq('email', email.toLowerCase().trim()).maybeSingle();
      if (!user) return res.status(404).json({ error: 'アカウントが見つかりません' });
      return res.status(200).json({ success: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // === 以下は管理者認証必須 ===
  const caller = await verifyAdmin(req);
  if (!caller) return res.status(401).json({ error: 'Unauthorized' });

  // === パスワードリセット実行 ===
  if (action === 'reset_password') {
    const admin = getAdminClient();
    if (!admin) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEYが未設定です' });
    const { target_user_id, new_password } = req.body;
    if (!target_user_id || !new_password) return res.status(400).json({ error: 'target_user_id and new_password required' });
    if (new_password.length < 6) return res.status(400).json({ error: 'パスワードは6文字以上必要です' });
    try {
      const { error } = await admin.auth.admin.updateUserById(target_user_id, { password: new_password });
      if (error) throw error;
      return res.status(200).json({ success: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  return res.status(400).json({ error: 'Unknown action' });
}
