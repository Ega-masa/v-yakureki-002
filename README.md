# 音声薬歴ツール (voice-yakureki) v5.7.1

薬局向け音声薬歴作成ツール。音声をリアルタイムで文字起こし＋AI SOAP自動分類し、Musubi（電子薬歴システム）へのペースト用テキストを生成します。

## 主な機能

- **音声録音・文字起こし**: Groq Whisper v3 Turbo による高精度日本語文字起こし
- **AI SOAP分類**: Claude Haiku 4.5 による自動SOAP分類（S/O/A/EP/CP/OP/P/問/その他/ハイリスク）
- **医薬品名自動補正**: 医薬品マスタによる成分名の自動補正
- **Musubiショートカット出力**: `##S##` `##O##` 等のショートカットコマンド付きテキスト出力
- **店舗IDログイン**: 店舗ごとの共有アカウント方式（メールアドレス不要）
- **管理画面**: 店舗管理・ユーザー管理・統計・ロール権限・テンプレート・医薬品マスタ・Slack通知・診断

## 技術スタック

| 項目 | 技術 |
|------|------|
| フロントエンド | React + Vite + インラインCSS |
| バックエンド | Vercel Serverless Functions |
| データベース | Supabase (PostgreSQL) |
| 認証 | Supabase Auth |
| 音声認識 | Groq Whisper v3 Turbo ($0.04/時間) |
| AI分類 | Claude Haiku 4.5 ($1/$5 per MTok) |
| デプロイ | Vercel |

## ファイル構成

```
voice-yakureki/
├── src/
│   ├── App.jsx          # メインアプリ（ログイン・録音・SOAP編集）
│   ├── Admin.jsx        # 管理画面（全機能）
│   └── supabase.js      # Supabaseクライアント・DB操作関数
├── api/
│   ├── soap.js          # SOAP分類API（Claude Haiku）
│   ├── auth.js          # 店舗/管理者アカウント作成・パスワード管理
│   ├── admin.js         # 管理者向けAPI（環境変数診断・会社コード検索）
│   └── notify.js        # Slack通知API
├── sql/
│   ├── login_migration.sql       # 店舗IDログイン方式の移行
│   ├── security_fix_v3.sql       # RLS設定
│   ├── notification_settings.sql # Slack通知テーブル
│   ├── user_management_perms.sql # 詳細権限
│   ├── drug_master.sql           # 医薬品マスタ
│   ├── phase_a_hourly_stats.sql  # 統計テーブル
│   ├── phase_b_custom_roles.sql  # ロール管理
│   ├── phase_c_soap_templates.sql # SOAPテンプレート
│   ├── hotfix_company_login.sql  # 会社テーブル公開
│   ├── hotfix_confirm_emails.sql # メール確認一括処理
│   ├── fix_duplicates.sql        # 重複データ修正
│   └── cleanup_old_accounts.sql  # 旧アカウント停止
├── vercel.json
├── package.json
└── README.md
```

## セットアップ手順

### 1. Supabase プロジェクト作成

Supabaseで新規プロジェクトを作成し、Settings → API から以下を取得：
- Project URL
- anon public key
- service_role secret key

### 2. SQL実行（Supabase SQL Editor）

以下の順番で実行：

1. `phase_a_hourly_stats.sql`
2. `phase_b_custom_roles.sql`
3. `phase_c_soap_templates.sql`
4. `security_fix_v3.sql`
5. `hotfix_company_login.sql`
6. `drug_master.sql`
7. `login_migration.sql`
8. `user_management_perms.sql`
9. `notification_settings.sql`

### 3. Vercel 環境変数設定

| 変数名 | 値 |
|--------|-----|
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_ANON_KEY` | Supabase anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role secret |
| `ANTHROPIC_API_KEY` | Anthropic API Key |

### 4. デプロイ

```bash
git push  # Vercelが自動デプロイ
```

### 5. 初期アカウント作成

ブラウザのコンソールで実行：

```javascript
fetch("/api/auth", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    action: "create_admin_account",
    login_id: "admin-xxx",
    password: "パスワード",
    display_name: "管理者名",
    role: "super_admin"
  })
}).then(r => r.json()).then(console.log);
```

### 6. 店舗アカウント作成

管理画面 → 店舗管理 → 店舗を編集 → パスワード初期設定

## ログイン方式

| アカウント種別 | ログインID | 用途 |
|---------------|-----------|------|
| 店舗アカウント | `YK-XXXXXX`（自動生成） | 録音画面 |
| システム管理者 | `admin-xxx`（手動発行） | 管理画面 |
| 会社管理者 | `admin-xxx`（手動発行） | 管理画面（自社のみ） |

## セッション管理

- 8時間無操作で自動ログアウト
- 操作（クリック・キー入力・タッチ）で自動延長

## API エンドポイント

| パス | メソッド | 内容 |
|------|---------|------|
| `/api/soap` | POST | SOAP分類（Claude Haiku） |
| `/api/auth` | POST | アカウント作成・パスワード変更 |
| `/api/admin` | GET | 環境変数診断 |
| `/api/admin` | POST | 会社コード検索・パスワードリセット依頼 |
| `/api/notify` | POST | Slack通知送信 |

## 処理可能量（Free Tier目安）

| リソース | 制限 | 実用目安 |
|---------|------|---------|
| Supabase DB | 500MB | 薬歴50万件（7日自動削除で無制限） |
| Supabase Auth | 50,000 MAU | 5万アカウント |
| Vercel Functions | 100GB/月 | 月10万回録音 |
| Groq | レート制限 | 同時10並列・月10万回 |
| Haiku | $1/MTok | 月10万回で$50-70 |

## ライセンス

Private / Proprietary
