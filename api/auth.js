// voice-yakureki v5.7.0 api/auth.js
// 店舗ログインアカウント管理API
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lrtcrczgwxilukltetxa.supabase.co';
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const ALLOWED_ORIGINS = [
  'https://voice-yakureki.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

function setCors(req, res) {
  const origin = req.headers?.origin || '';
  if (ALLOWED_ORIGINS.includes(origin) || origin.startsWith('chrome-extension://')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function getAdminClient() {
  if (!SUPABASE_SRK) return null;
  return createClient(SUPABASE_URL, SUPABASE_SRK, { auth: { autoRefreshToken: false, persistSession: false } });
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const admin = getAdminClient();
  if (!admin) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });

  const { action } = req.body || {};

  // === 店舗アカウント作成 ===
  if (action === 'create_store_account') {
    const { login_id, password, store_id } = req.body;
    if (!login_id || !password) return res.status(400).json({ error: 'login_id and password required' });
    const email = `${login_id.toLowerCase()}@vy.internal`;
    try {
      // Supabase Auth アカウント作成
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email, password,
        email_confirm: true, // 確認不要
        user_metadata: { login_id, type: 'store' }
      });
      if (authError) throw authError;
      const uid = authData.user?.id;
      // stores テーブルに auth_user_id を紐付け
      if (uid && store_id) {
        await admin.from('stores').update({ auth_user_id: uid }).eq('id', store_id);
      }
      return res.status(200).json({ success: true, auth_user_id: uid });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // === 管理者アカウント作成 ===
  if (action === 'create_admin_account') {
    const { login_id, password, display_name, role, company_id } = req.body;
    if (!login_id || !password) return res.status(400).json({ error: 'login_id and password required' });
    const email = `${login_id.toLowerCase()}@vy.internal`;
    try {
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email, password,
        email_confirm: true,
        user_metadata: { login_id, type: 'admin' }
      });
      if (authError) throw authError;
      const uid = authData.user?.id;
      // admin_accounts に登録
      await admin.from('admin_accounts').insert({
        login_id, auth_user_id: uid,
        display_name: display_name || login_id,
        role: role || 'super_admin',
        company_id: company_id || null,
      });
      // users テーブルにも登録（RLS互換）
      await admin.from('users').upsert({
        id: uid, email,
        display_name: display_name || login_id,
        role: role || 'super_admin',
        company_id: company_id || null,
        is_approved: true,
      }, { onConflict: 'id' });
      return res.status(200).json({ success: true, auth_user_id: uid });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // === パスワード変更（SRK使用） ===
  if (action === 'change_password') {
    const { auth_user_id, new_password } = req.body;
    if (!auth_user_id || !new_password) return res.status(400).json({ error: 'auth_user_id and new_password required' });
    if (new_password.length < 6) return res.status(400).json({ error: '6文字以上必要です' });
    try {
      const { error } = await admin.auth.admin.updateUserById(auth_user_id, { password: new_password });
      if (error) throw error;
      return res.status(200).json({ success: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  return res.status(400).json({ error: 'Unknown action' });
}
