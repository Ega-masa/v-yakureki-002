# 音声薬歴ツール 完全構築ガイド

このドキュメントに従えば、ゼロからシステムを構築できます。

---

## 必要なアカウント（全て無料プランで可）

| サービス | URL | 用途 |
|---------|-----|------|
| GitHub | https://github.com | ソースコード管理 |
| Vercel | https://vercel.com | Webアプリのホスティング |
| Supabase | https://supabase.com | データベース + 認証 |
| Groq | https://console.groq.com | 音声認識API（Whisper） |
| Anthropic | https://console.anthropic.com | AI SOAP分類（Claude） |

---

## Step 1: Supabase プロジェクト作成

### 1-1. アカウント作成
1. https://supabase.com にアクセス
2. 「Start your project」→ GitHubアカウントでサインアップ

### 1-2. プロジェクト作成
1. ダッシュボード → 「New project」
2. Organization: 個人 or 組織を選択
3. Project name: `voice-yakureki`
4. Database Password: 安全なパスワードを設定（**メモしてください**）
5. Region: `Northeast Asia (Tokyo)` を選択
6. 「Create new project」→ 2分ほど待つ

### 1-3. API情報をメモ
1. 左サイドバー → ⚙ Settings → API
2. 以下の3つをメモ帳にコピー：

```
Project URL:       https://xxxxxxxxxx.supabase.co
anon public:       eyJhbGci... (長い文字列)
service_role:      eyJhbGci... (👁アイコンをクリックして表示)
```

### 1-4. メール確認を無効化
1. 左サイドバー → Authentication → Providers → Email
2. 「Confirm email」→ **OFF**
3. 「Save」

### 1-5. SQLを実行
1. 左サイドバー → SQL Editor
2. 「New query」をクリック
3. `sql/setup.sql` の**全内容**を貼り付け
4. 「Run」をクリック
5. 「Success. No rows returned」と表示されれば完了

---

## Step 2: Groq APIキー取得

1. https://console.groq.com にアクセス → サインアップ
2. 左メニュー → API Keys → 「Create API Key」
3. Name: `voice-yakureki`
4. 生成されたキー（`gsk_...`）をメモ

---

## Step 3: Anthropic APIキー取得

1. https://console.anthropic.com にアクセス → サインアップ
2. Settings → API Keys → 「Create Key」
3. 生成されたキー（`sk-ant-...`）をメモ

---

## Step 4: GitHub リポジトリ作成

### 4-1. リポジトリ作成
1. https://github.com にログイン
2. 右上の「+」→ 「New repository」
3. Repository name: `voice-yakureki`
4. Public or Private: どちらでもOK
5. 「Create repository」

### 4-2. ファイルをアップロード
1. ZIPを解凍した `voice-yakureki/` フォルダ内の**全ファイル**をリポジトリにアップロード
2. 方法A: GitHub画面で「Upload files」→ ドラッグ＆ドロップ
3. 方法B: Git CLIで push

```bash
cd voice-yakureki
git init
git add .
git commit -m "v5.7.1 initial"
git branch -M main
git remote add origin https://github.com/あなたのユーザー名/voice-yakureki.git
git push -u origin main
```

必要なファイル構造：
```
voice-yakureki/
├── src/App.jsx
├── src/Admin.jsx
├── src/supabase.js
├── src/main.jsx
├── api/soap.js
├── api/admin.js
├── api/auth.js
├── public/manifest.json
├── public/sw.js
├── public/icon-192.png
├── public/icon-512.png
├── index.html
├── package.json
├── vite.config.js
└── vercel.json
```

---

## Step 5: Vercel デプロイ

### 5-1. Vercel接続
1. https://vercel.com にアクセス → GitHubアカウントでサインアップ
2. 「Add New...」→ 「Project」
3. 「Import Git Repository」→ `voice-yakureki` を選択
4. Framework Preset: `Vite`（自動検出される）
5. **「Environment Variables」をクリックして以下を追加**：

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | Step 1-3の Project URL |
| `SUPABASE_ANON_KEY` | Step 1-3の anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Step 1-3の service_role |
| `ANTHROPIC_API_KEY` | Step 3のキー |

6. 「Deploy」→ 2分ほど待つ
7. 完了したらURLが表示される（例: `https://voice-yakureki.vercel.app`）

### 5-2. デプロイ確認
ブラウザで以下にアクセス：
```
https://あなたのURL/api/admin
```

以下のように全て `true` なら成功：
```json
{"status":"ok","env":{"SUPABASE_URL":true,"SUPABASE_ANON_KEY":true,"SUPABASE_SERVICE_ROLE_KEY":true,"ANTHROPIC_API_KEY":true}}
```

`false` がある場合: Vercel → Settings → Environment Variables で確認 → 修正後 Deployments → Redeploy

---

## Step 6: 管理者アカウント作成

### 6-1. ブラウザで実行
1. デプロイされたURL（例: `https://voice-yakureki.vercel.app`）を開く
2. F12キー（Mac: Cmd+Option+J）で開発者ツールを開く
3. 「Console」タブをクリック
4. 以下を貼り付けてEnter（**login_idとpasswordを変更**）：

```javascript
fetch("/api/auth", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    action: "create_admin_account",
    login_id: "admin-xxx",
    password: "任意のパスワード（6文字以上）",
    display_name: "管理者名",
    role: "super_admin"
  })
}).then(r => r.json()).then(d => console.log("結果:", d));
```

5. `{success: true, auth_user_id: "..."}` と表示されれば成功

### 6-2. ログイン確認
1. ページをリロード
2. 「店舗ID / 管理者ID」に `admin-xxx` を入力
3. パスワードを入力
4. ログイン → 管理画面が表示されれば成功

---

## Step 7: Groq APIキーを登録

1. 管理画面 → 「API設定」タブ
2. サービス名: `groq`
3. APIキー: Step 2でメモした `gsk_...`
4. 保存

---

## Step 8: 会社と店舗の作成

### 8-1. 会社を作成
1. 管理画面 → 「会社管理」タブ
2. 「新規追加」→ 会社名を入力 → 保存

### 8-2. 店舗を作成
1. 管理画面 → 「店舗管理」タブ
2. 「新規追加」→ 店舗名・会社を入力
3. 「店舗パスワード初期設定」で「自動生成」→ パスワードをメモ
4. 「追加」

### 8-3. 店舗ログイン確認
1. ログアウト
2. 店舗ID（例: `YK-A3B7X2`）とパスワードでログイン
3. 録音画面が表示される → 🎙ボタンで録音テスト

---

## Step 9: Chrome拡張機能（任意）

1. `voice-yakureki-extension-v3.5.zip` を解凍
2. Chrome → `chrome://extensions` → デベロッパーモードON
3. 「パッケージ化されていない拡張機能を読み込む」→ フォルダを選択
4. ツールバーの🎙アイコン → 店舗IDでログイン

---

## Step 10: supabase.js の編集（別プロジェクト用）

別のSupabaseプロジェクトで使う場合、`src/supabase.js` の2行を変更：

```javascript
const SUPABASE_URL = 'https://あなたのプロジェクト.supabase.co'
const SUPABASE_ANON_KEY = 'あなたのanon key'
```

Chrome拡張機能の `popup.js` も同様に2行変更：
```javascript
const SUPABASE_URL='https://あなたのプロジェクト.supabase.co';
const SUPABASE_ANON='あなたのanon key';
```

---

## 運用メモ

### セッション
- 8時間無操作で自動ログアウト

### データ保持
- 録音データは7日で自動削除（pg_cronで毎日JST 3:00に実行）
- 統計データ（hourly_stats）は永続保持

### コスト見積もり（月間10万回録音の場合）
| 項目 | 月額 |
|------|------|
| Groq Whisper | ~$4,000（$0.04/時間 × 平均1分/回） |
| Claude Haiku SOAP | ~$50-70 |
| Supabase Free | $0 |
| Vercel Free | $0 |
| **合計** | **~$70**（小規模運用） |

### トラブルシューティング
| 問題 | 対処 |
|------|------|
| ログインできない | IDとパスワードを確認。管理者にパスワードリセットを依頼 |
| 録音後エラー | 管理画面 → API設定でGroq APIキーが登録されているか確認 |
| 環境変数エラー | `/api/admin` にアクセスしてfalseの変数を確認 → Vercelで設定 → Redeploy |
| SOAP分類されない | Vercel環境変数の`ANTHROPIC_API_KEY`を確認 |
