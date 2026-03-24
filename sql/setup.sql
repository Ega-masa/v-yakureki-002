-- ============================================================
-- 音声薬歴ツール v5.7.1 - 完全セットアップSQL
-- Supabase SQL Editorで上から下まで1回で実行してください
-- ============================================================

-- ========================================
-- 1. コアテーブル
-- ========================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  company_code TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_kana TEXT DEFAULT '',
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  max_users INT DEFAULT 10,
  memo TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  login_id TEXT UNIQUE,
  auth_user_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_login_id ON stores (login_id) WHERE login_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  display_name TEXT DEFAULT '',
  employee_id TEXT DEFAULT '',
  role TEXT DEFAULT 'pharmacist',
  role_id UUID,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  is_approved BOOLEAN DEFAULT true,
  password_reset_requested BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_stores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'pharmacist',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, store_id)
);

CREATE TABLE IF NOT EXISTS admin_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  login_id TEXT NOT NULL UNIQUE,
  auth_user_id UUID,
  display_name TEXT DEFAULT '',
  role TEXT DEFAULT 'super_admin',
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transcript TEXT DEFAULT '',
  duration_sec INT DEFAULT 0,
  patient_name TEXT DEFAULT '',
  store_id UUID REFERENCES stores(id),
  created_by UUID,
  soap_s TEXT DEFAULT '', soap_o TEXT DEFAULT '', soap_a TEXT DEFAULT '',
  soap_ep TEXT DEFAULT '', soap_cp TEXT DEFAULT '', soap_op TEXT DEFAULT '', soap_p TEXT DEFAULT '',
  soap_q TEXT DEFAULT '', soap_other TEXT DEFAULT '', soap_highrisk TEXT DEFAULT '',
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service TEXT NOT NULL DEFAULT 'groq',
  api_key TEXT NOT NULL DEFAULT '',
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT,
  store_id UUID,
  user_id UUID,
  duration_sec INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- 2. ロール・権限テーブル
-- ========================================
CREATE TABLE IF NOT EXISTS permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'admin',
  sort_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  color TEXT DEFAULT '#64748b',
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE(role_id, permission_id)
);

-- 権限マスタデータ
INSERT INTO permissions (key, label, description, category, sort_order) VALUES
  ('record.create','録音・文字起こし','音声の録音と文字起こしを実行できる','recording',10),
  ('record.view_own','自分の録音閲覧','自分が作成した録音記録を閲覧できる','recording',20),
  ('record.view_store','店舗の録音閲覧','同じ店舗の全録音記録を閲覧できる','recording',30),
  ('record.edit','録音編集','録音記録のSOAP内容を編集できる','recording',40),
  ('record.delete','録音削除','録音記録を削除できる','recording',50),
  ('record.export','録音エクスポート','Musubi用テキストのコピー・エクスポートができる','recording',60),
  ('admin.access','管理画面アクセス','管理画面を開くことができる','admin',100),
  ('admin.stats','統計閲覧','使用統計データを閲覧できる','admin',110),
  ('admin.store','店舗管理','店舗の追加・編集・削除ができる','admin',120),
  ('admin.user','ユーザー管理','ユーザーの追加・編集・削除ができる','admin',130),
  ('admin.user.view','ユーザー閲覧','ユーザー一覧を閲覧できる','admin',131),
  ('admin.user.edit','ユーザー編集','ユーザー情報を編集できる','admin',132),
  ('admin.user.role','ロール変更','ユーザーのロールを変更できる','admin',133),
  ('admin.user.password','パスワードリセット','ユーザーのパスワードをリセットできる','admin',134),
  ('admin.user.company','所属会社変更','ユーザーの所属会社を変更できる','admin',135),
  ('admin.user.delete','ユーザー削除','ユーザーを削除できる','admin',136),
  ('admin.user.add','ユーザー追加','新しいユーザーを追加できる','admin',137),
  ('admin.approve','申請承認','新規登録申請を承認・拒否できる','admin',140),
  ('admin.apikey','APIキー管理','APIキーの閲覧・追加・編集ができる','admin',150),
  ('admin.company','会社管理','会社の追加・編集ができる','admin',160),
  ('admin.role','ロール管理','ロールの追加・編集・権限設定ができる','admin',170)
ON CONFLICT (key) DO NOTHING;

-- 初期ロール
INSERT INTO roles (name, description, color, is_system, sort_order) VALUES
  ('全体管理者','全システムの管理権限','#dc2626',true,1),
  ('店舗管理者','店舗内の管理権限','#2563eb',true,2),
  ('薬剤師','録音・閲覧のみ','#059669',true,3)
ON CONFLICT DO NOTHING;

-- 全体管理者に全権限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = '全体管理者'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 店舗管理者に一部権限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = '店舗管理者' AND p.key IN ('record.create','record.view_own','record.view_store','record.edit','record.delete','record.export','admin.access','admin.stats','admin.store','admin.user','admin.user.view','admin.user.edit','admin.user.add','admin.approve')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 薬剤師に録音権限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = '薬剤師' AND p.key IN ('record.create','record.view_own','record.view_store','record.edit','record.export')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ========================================
-- 3. SOAPテンプレート・チェックルール
-- ========================================
CREATE TABLE IF NOT EXISTS soap_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  category TEXT DEFAULT 'general',
  soap_s TEXT DEFAULT '', soap_o TEXT DEFAULT '', soap_a TEXT DEFAULT '',
  soap_ep TEXT DEFAULT '', soap_cp TEXT DEFAULT '', soap_op TEXT DEFAULT '', soap_p TEXT DEFAULT '',
  soap_q TEXT DEFAULT '', soap_other TEXT DEFAULT '', soap_highrisk TEXT DEFAULT '',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS soap_check_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  required_fields TEXT[] DEFAULT '{}',
  min_length INT DEFAULT 0,
  applies_to TEXT DEFAULT 'general',
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- 4. 統計テーブル
-- ========================================
CREATE TABLE IF NOT EXISTS hourly_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  stat_date DATE NOT NULL,
  stat_hour INT NOT NULL CHECK (stat_hour >= 0 AND stat_hour <= 23),
  record_count INT NOT NULL DEFAULT 0,
  total_duration_sec INT NOT NULL DEFAULT 0,
  user_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, stat_date, stat_hour)
);

CREATE OR REPLACE VIEW daily_stats AS
SELECT store_id, company_id, stat_date,
  SUM(record_count) AS record_count,
  SUM(total_duration_sec) AS total_duration_sec
FROM hourly_stats GROUP BY store_id, company_id, stat_date;

-- 統計自動集計トリガー
CREATE OR REPLACE FUNCTION fn_update_hourly_stats()
RETURNS TRIGGER AS $$
DECLARE v_date DATE; v_hour INT; v_company UUID;
BEGIN
  v_date := (NEW.created_at AT TIME ZONE 'Asia/Tokyo')::date;
  v_hour := EXTRACT(HOUR FROM (NEW.created_at AT TIME ZONE 'Asia/Tokyo'));
  SELECT company_id INTO v_company FROM stores WHERE id = NEW.store_id;
  INSERT INTO hourly_stats (store_id, company_id, stat_date, stat_hour, record_count, total_duration_sec, user_ids)
  VALUES (NEW.store_id, v_company, v_date, v_hour, 1, COALESCE(NEW.duration_sec,0), ARRAY[COALESCE(NEW.created_by::text,'')])
  ON CONFLICT (store_id, stat_date, stat_hour)
  DO UPDATE SET
    record_count = hourly_stats.record_count + 1,
    total_duration_sec = hourly_stats.total_duration_sec + COALESCE(NEW.duration_sec,0),
    user_ids = CASE WHEN NOT hourly_stats.user_ids @> ARRAY[COALESCE(NEW.created_by::text,'')]
      THEN hourly_stats.user_ids || ARRAY[COALESCE(NEW.created_by::text,'')]
      ELSE hourly_stats.user_ids END;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hourly_stats ON records;
CREATE TRIGGER trg_hourly_stats AFTER INSERT ON records
  FOR EACH ROW WHEN (NEW.store_id IS NOT NULL) EXECUTE FUNCTION fn_update_hourly_stats();

-- ========================================
-- 5. 医薬品マスタ
-- ========================================
CREATE TABLE IF NOT EXISTS drug_master (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ingredient_name TEXT NOT NULL UNIQUE,
  reading_kana TEXT DEFAULT '',
  reading_kata TEXT DEFAULT '',
  aliases TEXT[] DEFAULT '{}',
  category TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drug_aliases ON drug_master USING GIN (aliases);

-- 初期医薬品データ（主要90成分）
INSERT INTO drug_master (ingredient_name, reading_kana, reading_kata, category, aliases) VALUES
  ('アムロジピン','あむろじぴん','アムロジピン','高血圧','{"アムロジン","ノルバスク"}'),
  ('ニフェジピン','にふぇじぴん','ニフェジピン','高血圧','{"アダラート"}'),
  ('カンデサルタン','かんでさるたん','カンデサルタン','高血圧','{"ブロプレス"}'),
  ('テルミサルタン','てるみさるたん','テルミサルタン','高血圧','{"ミカルディス"}'),
  ('オルメサルタン','おるめさるたん','オルメサルタン','高血圧','{"オルメテック"}'),
  ('ロサルタン','ろさるたん','ロサルタン','高血圧','{"ニューロタン"}'),
  ('バルサルタン','ばるさるたん','バルサルタン','高血圧','{"ディオバン"}'),
  ('エナラプリル','えならぷりる','エナラプリル','高血圧','{"レニベース"}'),
  ('メトホルミン','めとほるみん','メトホルミン','糖尿病','{"メトグルコ","グリコラン"}'),
  ('シタグリプチン','したぐりぷちん','シタグリプチン','糖尿病','{"ジャヌビア","グラクティブ"}'),
  ('エンパグリフロジン','えんぱぐりふろじん','エンパグリフロジン','糖尿病','{"ジャディアンス"}'),
  ('ダパグリフロジン','だぱぐりふろじん','ダパグリフロジン','糖尿病','{"フォシーガ"}'),
  ('アトルバスタチン','あとるばすたちん','アトルバスタチン','脂質異常症','{"リピトール"}'),
  ('ロスバスタチン','ろすばすたちん','ロスバスタチン','脂質異常症','{"クレストール"}'),
  ('ワルファリン','わるふぁりん','ワルファリン','抗血栓(ハイリスク)','{"ワーファリン"}'),
  ('アピキサバン','あぴきさばん','アピキサバン','抗血栓(ハイリスク)','{"エリキュース"}'),
  ('リバーロキサバン','りばーろきさばん','リバーロキサバン','抗血栓(ハイリスク)','{"イグザレルト"}'),
  ('エドキサバン','えどきさばん','エドキサバン','抗血栓(ハイリスク)','{"リクシアナ"}'),
  ('ランソプラゾール','らんそぷらぞーる','ランソプラゾール','消化器','{"タケプロン"}'),
  ('エソメプラゾール','えそめぷらぞーる','エソメプラゾール','消化器','{"ネキシウム"}'),
  ('モンテルカスト','もんてるかすと','モンテルカスト','呼吸器','{"シングレア","キプレス"}'),
  ('エスシタロプラム','えすしたろぷらむ','エスシタロプラム','精神神経','{"レクサプロ"}'),
  ('デュロキセチン','でゅろきせちん','デュロキセチン','精神神経','{"サインバルタ"}'),
  ('ロキソプロフェン','ろきそぷろふぇん','ロキソプロフェン','鎮痛','{"ロキソニン"}'),
  ('セレコキシブ','せれこきしぶ','セレコキシブ','鎮痛','{"セレコックス"}'),
  ('アモキシシリン','あもきししりん','アモキシシリン','抗菌','{"サワシリン","アモリン"}'),
  ('レボフロキサシン','れぼふろきさしん','レボフロキサシン','抗菌','{"クラビット"}'),
  ('フェキソフェナジン','ふぇきそふぇなじん','フェキソフェナジン','アレルギー','{"アレグラ"}'),
  ('デスロラタジン','ですろらたじん','デスロラタジン','アレルギー','{"デザレックス"}'),
  ('アレンドロン酸','あれんどろんさん','アレンドロンサン','骨粗鬆症','{"フォサマック","ボナロン"}')
ON CONFLICT (ingredient_name) DO NOTHING;

-- ========================================
-- 6. ヘルパー関数（RLSバイパス用）
-- ========================================
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT company_id FROM users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION get_api_key(p_service TEXT, p_store_id UUID DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_key TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  IF p_store_id IS NOT NULL THEN
    SELECT api_key INTO v_key FROM api_keys WHERE service = p_service AND store_id = p_store_id AND is_active = true LIMIT 1;
    IF v_key IS NOT NULL THEN RETURN v_key; END IF;
  END IF;
  SELECT api_key INTO v_key FROM api_keys WHERE service = p_service AND store_id IS NULL AND is_active = true LIMIT 1;
  RETURN v_key;
END; $$;

-- ========================================
-- 7. 店舗ログインID自動生成
-- ========================================
CREATE OR REPLACE FUNCTION generate_store_login_id()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; result TEXT := 'YK-'; i INT;
BEGIN
  FOR i IN 1..6 LOOP result := result || substr(chars, floor(random()*length(chars)+1)::int, 1); END LOOP;
  IF EXISTS (SELECT 1 FROM stores WHERE login_id = result) THEN RETURN generate_store_login_id(); END IF;
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION fn_auto_store_login_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.login_id IS NULL THEN NEW.login_id := generate_store_login_id(); END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_store_login_id ON stores;
CREATE TRIGGER trg_auto_store_login_id BEFORE INSERT ON stores
  FOR EACH ROW EXECUTE FUNCTION fn_auto_store_login_id();

-- ========================================
-- 8. レコード自動削除（7日後）
-- ========================================
SELECT cron.schedule('delete-expired-records', '0 18 * * *',
  $$DELETE FROM records WHERE expires_at < now()$$
);

-- ========================================
-- 9. RLS（Row Level Security）
-- ========================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "companies_select_public" ON companies FOR SELECT USING (true);
CREATE POLICY "companies_insert_admin" ON companies FOR INSERT WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "companies_update_admin" ON companies FOR UPDATE USING (get_my_role() = 'super_admin');
CREATE POLICY "companies_delete_admin" ON companies FOR DELETE USING (get_my_role() = 'super_admin');

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stores_select_auth" ON stores FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "stores_insert_admin" ON stores FOR INSERT WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "stores_update_admin" ON stores FOR UPDATE USING (get_my_role() IN ('super_admin','store_admin'));
CREATE POLICY "stores_delete_admin" ON stores FOR DELETE USING (get_my_role() = 'super_admin');

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_select_safe" ON users FOR SELECT USING (id = auth.uid() OR get_my_role() = 'super_admin' OR company_id = get_my_company_id());
CREATE POLICY "users_insert_safe" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "users_update_safe" ON users FOR UPDATE USING (id = auth.uid() OR get_my_role() IN ('super_admin','store_admin'));
CREATE POLICY "users_delete_safe" ON users FOR DELETE USING (get_my_role() = 'super_admin');

ALTER TABLE user_stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_stores_select_auth" ON user_stores FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "user_stores_insert_auth" ON user_stores FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "user_stores_delete_auth" ON user_stores FOR DELETE USING (user_id = auth.uid() OR get_my_role() IN ('super_admin','store_admin'));

ALTER TABLE admin_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_accounts_select" ON admin_accounts FOR SELECT USING (true);
CREATE POLICY "admin_accounts_insert" ON admin_accounts FOR INSERT WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "admin_accounts_update" ON admin_accounts FOR UPDATE USING (get_my_role() = 'super_admin');
CREATE POLICY "admin_accounts_delete" ON admin_accounts FOR DELETE USING (get_my_role() = 'super_admin');

ALTER TABLE records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "records_select_safe" ON records FOR SELECT USING (get_my_role() = 'super_admin' OR store_id IN (SELECT id FROM stores WHERE company_id = get_my_company_id()));
CREATE POLICY "records_insert_safe" ON records FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "records_update_safe" ON records FOR UPDATE USING (created_by = auth.uid() OR get_my_role() IN ('super_admin','store_admin'));
CREATE POLICY "records_delete_safe" ON records FOR DELETE USING (created_by = auth.uid() OR get_my_role() IN ('super_admin','store_admin'));

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_keys_select_admin" ON api_keys FOR SELECT USING (get_my_role() IN ('super_admin','store_admin'));
CREATE POLICY "api_keys_insert_admin" ON api_keys FOR INSERT WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "api_keys_update_admin" ON api_keys FOR UPDATE USING (get_my_role() = 'super_admin');
CREATE POLICY "api_keys_delete_admin" ON api_keys FOR DELETE USING (get_my_role() = 'super_admin');

-- drug_master: 全員閲覧可、管理者のみ編集
ALTER TABLE drug_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drug_master_select" ON drug_master FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "drug_master_insert" ON drug_master FOR INSERT WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "drug_master_update" ON drug_master FOR UPDATE USING (get_my_role() = 'super_admin');
CREATE POLICY "drug_master_delete" ON drug_master FOR DELETE USING (get_my_role() = 'super_admin');

-- ========================================
DO $$ BEGIN RAISE NOTICE '音声薬歴ツール v5.7.1 セットアップ完了！'; END $$;
