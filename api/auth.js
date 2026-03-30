// voice-yakureki v5.8.0 api/auth.js
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function setCors(req, res) {
  // 全オリジンを許可（API専用エンドポイント）
  const origin = req.headers?.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function getAdminClient() {
  if (!SUPABASE_SRK) return null;
  if (!SUPABASE_URL) return null;
  return createClient(SUPABASE_URL, SUPABASE_SRK, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET: 環境診断（★詳細版）
  if (req.method === 'GET') {
    const urlOk = !!SUPABASE_URL && SUPABASE_URL.includes('supabase.co');
    const anonOk = !!SUPABASE_ANON && SUPABASE_ANON.length > 100;
    const srkOk = !!SUPABASE_SRK && SUPABASE_SRK.length > 100;
    const anthropicOk = !!process.env.ANTHROPIC_API_KEY;

    // SRKが正しいか簡易テスト
    let srkTest = 'not tested';
    if (srkOk && urlOk) {
      try {
        const admin = getAdminClient();
        const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
        srkTest = error ? `FAIL: ${error.message}` : `OK (${data.users.length >= 0 ? 'valid' : 'unknown'})`;
      } catch (e) {
        srkTest = `ERROR: ${e.message}`;
      }
    }

    return res.status(200).json({
      status: 'ok',
      version: '5.8.0',
      env: {
        SUPABASE_URL: urlOk,
        SUPABASE_URL_value: SUPABASE_URL ? SUPABASE_URL.replace(/https:\/\//, '').split('.')[0] + '.supabase.co' : 'NOT SET',
        SUPABASE_ANON_KEY: anonOk,
        SUPABASE_SERVICE_ROLE_KEY: srkOk,
        SUPABASE_SERVICE_ROLE_KEY_test: srkTest,
        ANTHROPIC_API_KEY: anthropicOk,
      },
      timestamp: new Date().toISOString()
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const admin = getAdminClient();
  if (!admin) {
    return res.status(500).json({
      error: 'SUPABASE_SERVICE_ROLE_KEY not configured or SUPABASE_URL missing',
      help: 'Vercel → Settings → Environment Variables で SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を確認してください',
      debug: { urlSet: !!SUPABASE_URL, srkSet: !!SUPABASE_SRK, srkLen: SUPABASE_SRK?.length || 0 }
    });
  }

  const { action } = req.body || {};

  // === 店舗アカウント作成 ===
  if (action === 'create_store_account') {
    const { login_id, password, store_id } = req.body;
    if (!login_id || !password) return res.status(400).json({ error: 'login_id and password required' });
    const email = `${login_id.toLowerCase()}@vy.internal`;
    try {
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email, password,
        email_confirm: true,
        user_metadata: { login_id, type: 'store' }
      });
      if (authError) throw authError;
      const uid = authData.user?.id;
      if (uid && store_id) {
        await admin.from('stores').update({ auth_user_id: uid }).eq('id', store_id);
      }
      return res.status(200).json({ success: true, auth_user_id: uid });
    } catch (e) {
      return res.status(500).json({
        error: e.message,
        code: e.code || 'unknown',
        hint: e.message.includes('not allowed') ? 'Supabase → Authentication → Settings → "Allow new users to sign up" を ON にしてください' : undefined
      });
    }
  }

  // === 管理者アカウント作成 ===
  if (action === 'create_admin_account') {
    const { login_id, password, display_name, role, company_id } = req.body;
    if (!login_id || !password) return res.status(400).json({ error: 'login_id and password required' });
    if (password.length < 6) return res.status(400).json({ error: 'パスワードは6文字以上必要です' });
    const email = `${login_id.toLowerCase()}@vy.internal`;
    try {
      // ★ admin.createUser は service_role キーが必須
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email, password,
        email_confirm: true,
        user_metadata: { login_id, type: 'admin' }
      });
      if (authError) throw authError;
      const uid = authData.user?.id;

      // admin_accounts に登録
      const { error: insertErr } = await admin.from('admin_accounts').insert({
        login_id, auth_user_id: uid,
        display_name: display_name || login_id,
        role: role || 'super_admin',
        company_id: company_id || null,
      });
      if (insertErr) console.warn('admin_accounts insert:', insertErr.message);

      // users テーブルにも登録
      const { error: userErr } = await admin.from('users').upsert({
        id: uid, email,
        display_name: display_name || login_id,
        role: role || 'super_admin',
        company_id: company_id || null,
        is_approved: true,
      }, { onConflict: 'id' });
      if (userErr) console.warn('users upsert:', userErr.message);

      return res.status(200).json({ success: true, auth_user_id: uid });
    } catch (e) {
      return res.status(500).json({
        error: e.message,
        code: e.code || 'unknown',
        hint: e.message.includes('not allowed')
          ? 'Supabase Dashboard → Authentication → Settings → "Allow new users to sign up" を ON にしてください'
          : e.message.includes('already been registered')
          ? 'このIDは既に登録済みです。別のIDを使用するか、パスワードリセットしてください。'
          : undefined
      });
    }
  }

  // === パスワード変更 ===
  if (action === 'change_password') {
    const { auth_user_id, new_password } = req.body;
    if (!auth_user_id || !new_password) return res.status(400).json({ error: 'auth_user_id and new_password required' });
    if (new_password.length < 6) return res.status(400).json({ error: '6文字以上必要です' });
    try {
      const { error } = await admin.auth.admin.updateUserById(auth_user_id, { password: new_password });
      if (error) throw error;
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: 'Unknown action: ' + action });
}
