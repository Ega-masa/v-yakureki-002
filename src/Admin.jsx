// voice-yakureki v5.7.1 Admin.jsx
// 管理画面: 店舗管理 / ユーザー管理 / API設定 / 使用統計（Phase A リニューアル）
import { useState, useEffect, useCallback, Fragment } from "react";
import { supabase } from "./supabase";
import { 
  Building2, Users, Key, BarChart3, Plus, Trash2, Edit3, Save, X, 
  ArrowLeft, Shield, ShieldCheck, UserCheck, Loader2, RefreshCw,
  CheckCircle, XCircle, Copy, Eye, EyeOff, LogOut, ChevronDown, ChevronRight, Check,
  Settings, Search, ArrowUp, ArrowDown, FileText, AlertTriangle, Pill, Upload,  Activity, Download
} from "lucide-react";

// === Styles ===
const S = {
  page: { minHeight:"100vh", background:"linear-gradient(168deg,#f0f1ff 0%,#f0f9ff 40%,#fafbfc 100%)", fontFamily:"'Noto Sans JP','Hiragino Sans',sans-serif" },
  header: { background:"#0f172a", borderBottom:"1px solid #1e293b", padding:"0 16px", position:"sticky", top:0, zIndex:50 },
  headerInner: { maxWidth:960, margin:"0 auto", display:"flex", alignItems:"center", height:54, gap:10 },
  headerIcon: { width:32, height:32, borderRadius:10, background:"linear-gradient(135deg,#6366f1,#4f46e5)", display:"flex", alignItems:"center", justifyContent:"center" },
  headerTitle: { fontSize:15, fontWeight:800, color:"#fff" },
  headerSub: { fontSize:9, color:"#64748b", fontWeight:600 },
  main: { maxWidth:960, margin:"0 auto", padding:"20px 16px 80px" },
  card: { background:"#fff", borderRadius:14, padding:"18px 20px", border:"1px solid #e8ecf0", marginBottom:14, boxShadow:"0 1px 4px rgba(0,0,0,.03)" },
  cardTitle: { fontSize:15, fontWeight:800, color:"#0f172a", marginBottom:12, display:"flex", alignItems:"center", gap:8 },
  tabs: { display:"flex", gap:4, background:"#f1f5f9", borderRadius:12, padding:4, marginBottom:16 },
  tab: (active) => ({ flex:1, padding:"10px 8px", border:"none", borderRadius:10, fontSize:12, fontWeight:700, cursor:"pointer", background:active?"#fff":"transparent", color:active?"#0f172a":"#94a3b8", display:"flex", alignItems:"center", justifyContent:"center", gap:6, boxShadow:active?"0 1px 3px rgba(0,0,0,.06)":"none", transition:"all 0.15s" }),
  btn: (color="#0d9488") => ({ background:`linear-gradient(135deg,${color},${color}dd)`, color:"#fff", border:"none", borderRadius:10, padding:"8px 16px", fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }),
  btnOutline: { background:"#fff", color:"#64748b", border:"1px solid #e2e8f0", borderRadius:10, padding:"8px 16px", fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:6 },
  btnDanger: { background:"#fff", color:"#ef4444", border:"1px solid #fecaca", borderRadius:10, padding:"6px 12px", fontSize:11, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:4 },
  input: { width:"100%", padding:"10px 12px", border:"2px solid #e2e8f0", borderRadius:10, fontSize:13, outline:"none", boxSizing:"border-box", fontFamily:"inherit" },
  inputSmall: { padding:"8px 10px", border:"1px solid #e2e8f0", borderRadius:8, fontSize:12, outline:"none", boxSizing:"border-box", fontFamily:"inherit" },
  label: { fontSize:11, fontWeight:700, color:"#475569", display:"block", marginBottom:4 },
  badge: (color, bg) => ({ fontSize:10, fontWeight:700, color, background:bg, padding:"2px 8px", borderRadius:6 }),
  table: { width:"100%", borderCollapse:"collapse", fontSize:12 },
  th: { textAlign:"left", padding:"8px 10px", fontSize:11, fontWeight:700, color:"#94a3b8", borderBottom:"1px solid #e2e8f0" },
  td: { padding:"10px", borderBottom:"1px solid #f1f5f9", color:"#334155" },
  empty: { textAlign:"center", padding:"40px 20px", color:"#94a3b8", fontSize:13 },
  stat: { textAlign:"center", padding:"16px" },
  statNum: { fontSize:28, fontWeight:900, color:"#0f172a", lineHeight:1 },
  statLabel: { fontSize:11, color:"#94a3b8", fontWeight:600, marginTop:4 },
  modal: { position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:16 },
  modalBox: { background:"#fff", borderRadius:16, padding:24, width:"100%", maxWidth:480, maxHeight:"85vh", overflow:"auto" },
};

// === Role Labels ===
const ROLE_LABELS = { super_admin:"全体管理者", store_admin:"店舗管理者", pharmacist:"薬剤師" };
const ROLE_COLORS = { 
  super_admin:{ color:"#7c3aed", bg:"#f3e8ff" }, 
  store_admin:{ color:"#0d9488", bg:"#ecfdf5" }, 
  pharmacist:{ color:"#2563eb", bg:"#eff6ff" } 
};
const ROLE_ICONS = { super_admin: ShieldCheck, store_admin: Shield, pharmacist: UserCheck };

// === Store Form Modal ===
function StoreFormModal({ store, companies, onClose, onSave }) {
  const isEdit = !!store;
  const [form, setForm] = useState({
    name: store?.name || "",
    name_kana: store?.name_kana || "",
    company_id: store?.company_id || (companies?.[0]?.id || ""),
    max_users: store?.max_users || 10,
    memo: store?.memo || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  // ログインアカウント関連
  const [storePass, setStorePass] = useState("");
  const [passMsg, setPassMsg] = useState("");
  const [creatingAuth, setCreatingAuth] = useState(false);
  const [showPassChange, setShowPassChange] = useState(false);

  const generatePassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyz23456789";
    let pw = "";
    for (let i = 0; i < 8; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    setStorePass(pw);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setErr("店舗名を入力してください"); return; }
    if (!form.company_id) { setErr("会社を選択してください"); return; }
    // 新規の場合はパスワード必須
    if (!isEdit && !storePass) { setErr("店舗パスワードを設定してください（自動生成ボタンが便利です）"); return; }
    setSaving(true); setErr("");
    try {
      const payload = { name: form.name, name_kana: form.name_kana, company_id: form.company_id, max_users: form.max_users, memo: form.memo };
      if (isEdit) {
        const { error } = await supabase.from("stores").update(payload).eq("id", store.id);
        if (error) throw error;
      } else {
        // 新規店舗: INSERT → login_idはトリガーで自動付与
        const { data: newStore, error } = await supabase.from("stores").insert(payload).select().single();
        if (error) throw error;
        // Auth アカウント作成
        if (newStore?.login_id && storePass) {
          const r = await fetch("/api/auth", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "create_store_account", login_id: newStore.login_id, password: storePass, store_id: newStore.id }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error("店舗は作成されましたが、ログインアカウントの作成に失敗: " + d.error);
        }
      }
      onSave();
    } catch (e) { setErr(e.message); }
    setSaving(false);
  };

  // 既存店舗のパスワード変更 or Auth作成
  const handleAuthAction = async () => {
    if (!storePass || storePass.length < 6) { setPassMsg("❌ 6文字以上のパスワードを入力してください"); return; }
    setCreatingAuth(true); setPassMsg("");
    try {
      if (store.auth_user_id) {
        // パスワード変更
        const r = await fetch("/api/auth", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "change_password", auth_user_id: store.auth_user_id, new_password: storePass }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setPassMsg("✅ パスワードを変更しました");
      } else {
        // Auth アカウント新規作成
        const r = await fetch("/api/auth", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create_store_account", login_id: store.login_id, password: storePass, store_id: store.id }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setPassMsg("✅ ログインアカウントを作成しました");
      }
      setStorePass("");
    } catch (e) { setPassMsg("❌ " + e.message); }
    setCreatingAuth(false);
  };

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={{...S.modalBox, maxWidth:480}} onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:800 }}>{isEdit ? "店舗を編集" : "新しい店舗を追加"}</h3>
          <button onClick={onClose} style={{ background:"#f1f5f9", border:"none", borderRadius:8, width:30, height:30, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}><X size={15} color="#64748b"/></button>
        </div>

        {/* 既存店舗: login_id表示 */}
        {isEdit && store.login_id && (
          <div style={{ marginBottom:14, padding:"10px 14px", background:"#f0fdfa", borderRadius:10, border:"1px solid #ccfbf1" }}>
            <div style={{ fontSize:10, color:"#64748b", marginBottom:2 }}>店舗ログインID</div>
            <div style={{ fontSize:18, fontWeight:800, fontFamily:"monospace", letterSpacing:3, color:"#0f766e" }}>{store.login_id}</div>
            {!store.auth_user_id && <div style={{ fontSize:10, color:"#d97706", marginTop:4 }}>⚠ ログインアカウント未作成（下のパスワード設定で作成してください）</div>}
          </div>
        )}

        <div style={{ marginBottom:10 }}>
          <label style={S.label}>店舗名（漢字） *</label>
          <input style={S.input} value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="例: ○○薬局 本店" />
        </div>
        <div style={{ marginBottom:10 }}>
          <label style={S.label}>店舗名（フリガナ）</label>
          <input style={S.input} value={form.name_kana} onChange={e => setForm(p => ({...p, name_kana: e.target.value}))} placeholder="例: まるまるやっきょく ほんてん" />
        </div>
        <div style={{ marginBottom:10 }}>
          <label style={S.label}>所属会社 *</label>
          <select style={S.input} value={form.company_id} onChange={e => setForm(p => ({...p, company_id: e.target.value}))}>
            <option value="">選択してください</option>
            {(companies||[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ display:"flex", gap:10, marginBottom:10 }}>
          <div style={{ flex:1 }}>
            <label style={S.label}>最大ユーザー数</label>
            <input style={S.input} type="number" min={1} max={100} value={form.max_users} onChange={e => setForm(p => ({...p, max_users: parseInt(e.target.value) || 10}))} />
          </div>
        </div>
        <div style={{ marginBottom:12 }}>
          <label style={S.label}>メモ</label>
          <textarea style={{...S.input, resize:"vertical"}} rows={2} value={form.memo} onChange={e => setForm(p => ({...p, memo: e.target.value}))} placeholder="管理者向けメモ" />
        </div>

        {/* パスワード設定 */}
        {isEdit ? (
          store.auth_user_id ? (
            /* 既存アカウント: パスワード変更ボタン → 展開 */
            <div style={{ marginBottom:14 }}>
              {!showPassChange ? (
                <button onClick={() => setShowPassChange(true)} style={{...S.btnOutline, width:"100%", justifyContent:"center", fontSize:11, padding:"8px"}}>🔑 パスワードを変更する</button>
              ) : (
                <div style={{ padding:"12px 14px", background:"#fef3c7", borderRadius:10, border:"1px solid #fde68a" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#92400e", marginBottom:6 }}>パスワード変更</div>
                  <div style={{ display:"flex", gap:6 }}>
                    <input type="text" value={storePass} onChange={e => setStorePass(e.target.value)} placeholder="新しいパスワード（6文字以上）" style={{...S.input, flex:1, marginBottom:0, fontSize:13, fontFamily:"monospace"}} />
                    <button onClick={generatePassword} style={{...S.btnOutline, whiteSpace:"nowrap", fontSize:10, padding:"6px 10px"}}>自動生成</button>
                    <button onClick={handleAuthAction} disabled={creatingAuth} style={{...S.btn("#d97706"), whiteSpace:"nowrap", fontSize:10}}>
                      {creatingAuth ? <Loader2 size={12} style={{ animation:"spin 1s linear infinite" }}/> : "変更"}
                    </button>
                  </div>
                  {storePass && <div style={{ fontSize:10, color:"#64748b", marginTop:6 }}>新パスワード: <span style={{ fontFamily:"monospace", fontWeight:700, fontSize:12, color:"#0f172a" }}>{storePass}</span></div>}
                  {passMsg && <div style={{ fontSize:11, marginTop:6, color:passMsg.startsWith("✅")?"#059669":"#dc2626", fontWeight:600 }}>{passMsg}</div>}
                  <button onClick={() => { setShowPassChange(false); setStorePass(""); setPassMsg(""); }} style={{ marginTop:8, background:"none", border:"none", fontSize:10, color:"#94a3b8", cursor:"pointer", textDecoration:"underline" }}>閉じる</button>
                </div>
              )}
            </div>
          ) : (
            /* 未開通: パスワード初期設定 */
            <div style={{ padding:"12px 14px", background:"#f0f9ff", borderRadius:10, border:"1px solid #bfdbfe", marginBottom:14 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#1e40af", marginBottom:6 }}>パスワード初期設定</div>
              <div style={{ fontSize:10, color:"#64748b", marginBottom:6 }}>この店舗のログインアカウントを有効にするにはパスワードを設定してください</div>
              <div style={{ display:"flex", gap:6 }}>
                <input type="text" value={storePass} onChange={e => setStorePass(e.target.value)} placeholder="6文字以上" style={{...S.input, flex:1, marginBottom:0, fontSize:13, fontFamily:"monospace"}} />
                <button onClick={generatePassword} style={{...S.btnOutline, whiteSpace:"nowrap", fontSize:10, padding:"6px 10px"}}>自動生成</button>
                <button onClick={handleAuthAction} disabled={creatingAuth} style={{...S.btn("#2563eb"), whiteSpace:"nowrap", fontSize:10}}>
                  {creatingAuth ? <Loader2 size={12} style={{ animation:"spin 1s linear infinite" }}/> : "設定"}
                </button>
              </div>
              {storePass && <div style={{ fontSize:10, color:"#64748b", marginTop:6 }}>パスワード: <span style={{ fontFamily:"monospace", fontWeight:700, fontSize:12, color:"#0f172a" }}>{storePass}</span>（メモしてください）</div>}
              {passMsg && <div style={{ fontSize:11, marginTop:6, color:passMsg.startsWith("✅")?"#059669":"#dc2626", fontWeight:600 }}>{passMsg}</div>}
            </div>
          )
        ) : (
          /* 新規店舗: パスワード初期設定 */
          <div style={{ padding:"12px 14px", background:"#f0f9ff", borderRadius:10, border:"1px solid #bfdbfe", marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#1e40af", marginBottom:6 }}>店舗パスワード初期設定 *</div>
            <div style={{ display:"flex", gap:6 }}>
              <input type="text" value={storePass} onChange={e => setStorePass(e.target.value)} placeholder="6文字以上" style={{...S.input, flex:1, marginBottom:0, fontSize:13, fontFamily:"monospace"}} />
              <button onClick={generatePassword} style={{...S.btnOutline, whiteSpace:"nowrap", fontSize:10, padding:"6px 10px"}}>自動生成</button>
            </div>
            {storePass && <div style={{ fontSize:10, color:"#64748b", marginTop:6 }}>パスワード: <span style={{ fontFamily:"monospace", fontWeight:700, fontSize:12, color:"#0f172a" }}>{storePass}</span>（メモしてください）</div>}
          </div>
        )}

        {err && <div style={{ fontSize:11, color:"#dc2626", marginBottom:8, padding:"6px 10px", background:"#fef2f2", borderRadius:8 }}>{err}</div>}
        <button onClick={handleSave} disabled={saving} style={{...S.btn(), width:"100%", justifyContent:"center"}}>
          {saving ? <Loader2 size={14} style={{ animation:"spin 1s linear infinite" }}/> : <Save size={14}/>}
          {isEdit ? "更新" : "追加"}
        </button>
      </div>
    </div>
  );
}

// === Admin Account Add Modal ===
function UserAddModal({ companies, onClose, onSave }) {
  const [form, setForm] = useState({ login_id: "", password: "", display_name: "", role: "store_admin", company_id: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const generatePassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyz23456789";
    let pw = "";
    for (let i = 0; i < 8; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    setForm(p => ({...p, password: pw}));
  };

  const handleSave = async () => {
    if (!form.login_id.trim()) { setErr("管理者IDを入力してください"); return; }
    if (!form.password || form.password.length < 6) { setErr("6文字以上のパスワードを入力してください"); return; }
    if (!form.display_name.trim()) { setErr("表示名を入力してください"); return; }
    setSaving(true); setErr("");
    try {
      const r = await fetch("/api/auth", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_admin_account",
          login_id: form.login_id.trim(),
          password: form.password,
          display_name: form.display_name.trim(),
          role: form.role,
          company_id: form.company_id || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      onSave();
    } catch (e) { setErr(e.message); }
    setSaving(false);
  };

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={S.modalBox} onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:800 }}>管理者アカウント追加</h3>
          <button onClick={onClose} style={{ background:"#f1f5f9", border:"none", borderRadius:8, width:30, height:30, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}><X size={15} color="#64748b"/></button>
        </div>
        <div style={{ marginBottom:10 }}>
          <label style={S.label}>管理者ID *</label>
          <input style={{...S.input, fontFamily:"monospace"}} value={form.login_id} onChange={e => setForm(p => ({...p, login_id: e.target.value}))} placeholder="例: admin-tanaka" />
        </div>
        <div style={{ marginBottom:10 }}>
          <label style={S.label}>表示名 *</label>
          <input style={S.input} value={form.display_name} onChange={e => setForm(p => ({...p, display_name: e.target.value}))} placeholder="例: 田中太郎" />
        </div>
        <div style={{ marginBottom:10 }}>
          <label style={S.label}>パスワード *</label>
          <div style={{ display:"flex", gap:6 }}>
            <input style={{...S.input, flex:1, marginBottom:0, fontFamily:"monospace"}} value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))} placeholder="6文字以上" />
            <button onClick={generatePassword} style={{...S.btnOutline, whiteSpace:"nowrap", fontSize:10}}>自動生成</button>
          </div>
          {form.password && <div style={{ fontSize:10, color:"#64748b", marginTop:4 }}>パスワード: <span style={{ fontFamily:"monospace", fontWeight:700 }}>{form.password}</span></div>}
        </div>
        <div style={{ marginBottom:10 }}>
          <label style={S.label}>ロール</label>
          <select style={S.input} value={form.role} onChange={e => setForm(p => ({...p, role: e.target.value}))}>
            <option value="super_admin">システム管理者</option>
            <option value="store_admin">会社管理者</option>
          </select>
        </div>
        {form.role === "store_admin" && (
          <div style={{ marginBottom:10 }}>
            <label style={S.label}>所属会社</label>
            <select style={S.input} value={form.company_id} onChange={e => setForm(p => ({...p, company_id: e.target.value}))}>
              <option value="">選択してください</option>
              {(companies||[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        {err && <div style={{ fontSize:11, color:"#dc2626", marginBottom:8, padding:"6px 10px", background:"#fef2f2", borderRadius:8 }}>{err}</div>}
        <button onClick={handleSave} disabled={saving} style={{...S.btn(), width:"100%", justifyContent:"center"}}>
          {saving ? <Loader2 size={14} style={{ animation:"spin 1s linear infinite" }}/> : <Plus size={14}/>}
          作成
        </button>
      </div>
    </div>
  );
}

// === User Edit Modal ===
function UserEditModal({ user, stores, roles, companies, myRole, myRoleId, myPermissions, allStores, onClose, onSave }) {
  const isMeTopLevel = myRole === "super_admin";
  const [form, setForm] = useState({
    display_name: user.display_name || "",
    employee_id: user.employee_id || "",
    role_id: user.role_id || "",
    company_id: user.company_id || "",
    store_id: user.user_stores?.[0]?.store_id || "",
    is_approved: user.is_approved !== false,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [newPass, setNewPass] = useState("");
  const [passMsg, setPassMsg] = useState("");
  const [resettingPass, setResettingPass] = useState(false);

  // 権限チェック
  const perms = myPermissions || [];
  const canView = isMeTopLevel || perms.includes("admin.user.view") || perms.includes("admin.user");
  const canEdit = isMeTopLevel || perms.includes("admin.user.edit") || perms.includes("admin.user");
  const canChangeRole = isMeTopLevel || perms.includes("admin.user.role");
  const canChangeCompany = isMeTopLevel || perms.includes("admin.user.company");
  const canResetPassword = isMeTopLevel || perms.includes("admin.user.password");
  const canDeleteUser = isMeTopLevel || perms.includes("admin.user.delete");

  // sort_orderベースのロール階層
  const myRoleObj = roles.find(r => r.id === myRoleId);
  const mySortOrder = myRoleObj?.sort_order ?? (myRole === "super_admin" ? 0 : 99);
  const assignableRoles = roles.filter(r => r.is_active && (r.sort_order ?? 99) >= mySortOrder);
  const targetRoleObj = roles.find(r => r.id === user.role_id);
  const targetSortOrder = targetRoleObj?.sort_order ?? (user.role === "super_admin" ? 0 : user.role === "store_admin" ? 1 : 99);
  const canEditThisRole = mySortOrder <= targetSortOrder && canChangeRole;

  useEffect(() => {
    if (!form.role_id && user.role && roles.length > 0) {
      const legacyMap = { super_admin: "全体管理者", store_admin: "店舗管理者", pharmacist: "薬剤師" };
      const matched = roles.find(r => r.name === legacyMap[user.role]);
      if (matched) setForm(p => ({...p, role_id: matched.id}));
    }
  }, [roles, user.role]);

  const selectedCompanyId = form.company_id;
  const storeSource = isMeTopLevel ? (allStores || stores) : stores;
  const filteredStores = selectedCompanyId ? storeSource.filter(s => s.company_id === selectedCompanyId) : storeSource;
  const companyName = companies?.find(c => c.id === selectedCompanyId)?.name;

  const handleCompanyChange = (v) => setForm(p => ({...p, company_id: v, store_id: ""}));

  const handleSave = async () => {
    setSaving(true); setErr("");
    try {
      const selectedRole = roles.find(r => r.id === form.role_id);
      const legacyRole = selectedRole?.name === "全体管理者" ? "super_admin" : selectedRole?.name === "店舗管理者" ? "store_admin" : "pharmacist";
      const updates = { display_name: form.display_name, employee_id: form.employee_id, is_approved: form.is_approved };
      if (canEditThisRole) { updates.role = legacyRole; updates.role_id = form.role_id || null; }
      if (canChangeCompany) { updates.company_id = form.company_id || null; }
      const { error } = await supabase.from("users").update(updates).eq("id", user.id);
      if (error) throw error;
      if (form.store_id) {
        await supabase.from("user_stores").delete().eq("user_id", user.id);
        await supabase.from("user_stores").insert({ user_id: user.id, store_id: form.store_id, role: legacyRole });
      } else if (!form.store_id && user.user_stores?.length > 0) {
        await supabase.from("user_stores").delete().eq("user_id", user.id);
      }
      onSave();
    } catch (e) { setErr(e.message); }
    setSaving(false);
  };

  const handleResetPassword = async () => {
    if (!newPass || newPass.length < 6) { setPassMsg("❌ 6文字以上のパスワードを入力してください"); return; }
    setResettingPass(true); setPassMsg("");
    try {
      const session = await supabase.auth.getSession();
      const token = session?.data?.session?.access_token;
      const r = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ action: "reset_password", target_user_id: user.id, new_password: newPass }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "リセットに失敗しました");
      setPassMsg("✅ パスワードをリセットしました");
      setNewPass("");
      // リセット依頼フラグをクリア
      try { await supabase.from("users").update({ password_reset_requested: false }).eq("id", user.id); } catch {}
    } catch (e) { setPassMsg("❌ " + e.message); }
    setResettingPass(false);
    setTimeout(() => setPassMsg(""), 5000);
  };

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={{...S.modalBox, maxWidth:520}} onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:800 }}>ユーザーを編集</h3>
          <button onClick={onClose} style={{ background:"#f1f5f9", border:"none", borderRadius:8, width:30, height:30, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}><X size={15} color="#64748b"/></button>
        </div>
        <div style={{ fontSize:12, color:"#64748b", marginBottom:12, padding:"6px 10px", background:"#f8fafc", borderRadius:8 }}>{user.email}</div>

        {/* 基本情報 */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
          <div>
            <label style={S.label}>氏名</label>
            <input style={S.input} value={form.display_name} onChange={e => setForm(p => ({...p, display_name: e.target.value}))} placeholder="氏名" disabled={!canEdit}/>
          </div>
          <div>
            <label style={S.label}>社員番号</label>
            <input style={S.input} value={form.employee_id} onChange={e => setForm(p => ({...p, employee_id: e.target.value}))} placeholder="社員番号" disabled={!canEdit}/>
          </div>
        </div>

        {/* 会社 */}
        {canChangeCompany ? (
          <div style={{ marginBottom:10 }}>
            <label style={S.label}>所属会社</label>
            <select style={S.input} value={form.company_id} onChange={e => handleCompanyChange(e.target.value)}>
              <option value="">未所属</option>
              {(companies||[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        ) : companyName ? (
          <div style={{ marginBottom:10 }}>
            <label style={S.label}>所属会社</label>
            <div style={{...S.input, background:"#f8fafc", color:"#64748b"}}>{companyName}</div>
          </div>
        ) : null}

        {/* ロール + 店舗 */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
          <div>
            <label style={S.label}>ロール{!canEditThisRole && <span style={{ fontWeight:400, color:"#d97706", fontSize:9 }}>（変更不可）</span>}</label>
            <select style={{...S.input, opacity:canEditThisRole?1:0.5}} value={form.role_id} onChange={e => setForm(p => ({...p, role_id: e.target.value}))} disabled={!canEditThisRole}>
              <option value="">未設定</option>
              {assignableRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>所属店舗{companyName && <span style={{ fontWeight:400, color:"#94a3b8", fontSize:9 }}>（{companyName}）</span>}</label>
            <select style={S.input} value={form.store_id} onChange={e => setForm(p => ({...p, store_id: e.target.value}))} disabled={!canEdit}>
              <option value="">未所属</option>
              {filteredStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
          <label style={{ fontSize:12, fontWeight:700, color:"#475569", cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
            <input type="checkbox" checked={form.is_approved} onChange={e => setForm(p => ({...p, is_approved: e.target.checked}))} style={{ width:16, height:16 }} disabled={!canEdit}/>
            承認済み
          </label>
        </div>

        {err && <div style={{ fontSize:11, color:"#dc2626", marginBottom:8, padding:"6px 10px", background:"#fef2f2", borderRadius:8 }}>{err}</div>}
        <button onClick={handleSave} disabled={saving || !canEdit} style={{...S.btn(), width:"100%", justifyContent:"center", opacity:canEdit?1:0.5}}>
          {saving ? <Loader2 size={14} style={{ animation:"spin 1s linear infinite" }}/> : <Save size={14}/>}
          保存
        </button>

        {/* パスワードリセット */}
        {canResetPassword && (
          <div style={{ marginTop:16, padding:"12px 14px", background:"#fef3c7", borderRadius:10, border:"1px solid #fde68a" }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#92400e", marginBottom:8 }}>パスワードリセット</div>
            <div style={{ display:"flex", gap:6 }}>
              <input type="text" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="新しいパスワード（6文字以上）" style={{...S.input, flex:1, marginBottom:0, fontSize:12}}/>
              <button onClick={handleResetPassword} disabled={resettingPass} style={{...S.btn("#d97706"), whiteSpace:"nowrap", fontSize:11}}>
                {resettingPass ? <Loader2 size={12} style={{ animation:"spin 1s linear infinite" }}/> : "リセット"}
              </button>
            </div>
            {passMsg && <div style={{ fontSize:11, marginTop:6, color:passMsg.startsWith("✅")?"#059669":"#dc2626", fontWeight:600 }}>{passMsg}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// === API Key Section ===
function ApiKeySection({ apiKeys, onRefresh }) {
  const [showKey, setShowKey] = useState({});
  const [editing, setEditing] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleShow = (id) => setShowKey(p => ({...p, [id]: !p[id]}));
  const startEdit = (key) => { setEditing(key.id); setEditVal(key.api_key); };
  const cancelEdit = () => { setEditing(null); setEditVal(""); };

  const saveKey = async (id) => {
    setSaving(true);
    try {
      await supabase.from("api_keys").update({ api_key: editVal, updated_at: new Date().toISOString() }).eq("id", id);
      setEditing(null); setEditVal("");
      onRefresh();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const addKey = async (service) => {
    const labels = { groq: "Groq（音声認識）", anthropic: "Anthropic（SOAP分類）" };
    const key = prompt(`${labels[service] || service} APIキーを入力:`);
    if (!key) return;
    try {
      await supabase.from("api_keys").insert({ store_id: null, service, api_key: key, is_active: true });
      onRefresh();
    } catch (e) { alert(e.message); }
  };

  const services = ["groq", "anthropic"];
  const serviceLabels = { groq: "Groq（音声認識・Whisper）", anthropic: "Anthropic（SOAP分類・Haiku）" };

  return (
    <div>
      {services.map(svc => {
        const key = apiKeys.find(k => k.service === svc && !k.store_id);
        return (
          <div key={svc} style={{ background:"#f8fafc", borderRadius:10, padding:"12px 14px", marginBottom:10, border:"1px solid #e2e8f0" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
              <span style={{ fontSize:12, fontWeight:700, color:"#334155" }}>{serviceLabels[svc]}</span>
              {key ? (
                <span style={S.badge("#059669","#ecfdf5")}>
                  <CheckCircle size={10} style={{ marginRight:3, verticalAlign:"middle" }}/> 設定済み
                </span>
              ) : (
                <span style={S.badge("#ef4444","#fef2f2")}>
                  <XCircle size={10} style={{ marginRight:3, verticalAlign:"middle" }}/> 未設定
                </span>
              )}
            </div>
            {key ? (
              editing === key.id ? (
                <div style={{ display:"flex", gap:6 }}>
                  <input style={{...S.inputSmall, flex:1, fontFamily:"monospace", fontSize:11}} value={editVal} onChange={e => setEditVal(e.target.value)} />
                  <button onClick={() => saveKey(key.id)} disabled={saving} style={{...S.btn(), padding:"6px 12px", fontSize:11}}>
                    <Save size={12}/> 保存
                  </button>
                  <button onClick={cancelEdit} style={{...S.btnOutline, padding:"6px 10px", fontSize:11}}>
                    <X size={12}/>
                  </button>
                </div>
              ) : (
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <code style={{ flex:1, fontSize:10, color:"#64748b", background:"#f1f5f9", padding:"4px 8px", borderRadius:6, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {showKey[key.id] ? key.api_key : key.api_key.substring(0, 12) + "•••••••••••••"}
                  </code>
                  <button onClick={() => toggleShow(key.id)} style={{...S.btnOutline, padding:"4px 8px", fontSize:10}}>
                    {showKey[key.id] ? <EyeOff size={12}/> : <Eye size={12}/>}
                  </button>
                  <button onClick={() => startEdit(key)} style={{...S.btnOutline, padding:"4px 8px", fontSize:10}}>
                    <Edit3 size={12}/>
                  </button>
                  <button onClick={() => navigator.clipboard.writeText(key.api_key)} style={{...S.btnOutline, padding:"4px 8px", fontSize:10}}>
                    <Copy size={12}/>
                  </button>
                </div>
              )
            ) : (
              <button onClick={() => addKey(svc)} style={{...S.btn("#6366f1"), fontSize:11, padding:"6px 12px"}}>
                <Plus size={12}/> キーを追加
              </button>
            )}
          </div>
        );
      })}
      <div style={{ fontSize:10, color:"#94a3b8", lineHeight:1.6, marginTop:8 }}>
        ※ グローバル設定のAPIキーは全店舗共通で使用されます。店舗ごとに別キーを使う場合は、店舗設定から個別に登録できます。
      </div>
    </div>
  );
}

// === Usage Stats (Phase A リニューアル) ===
const DAYS_JP = ["日","月","火","水","木","金","土"];
const fmtDur = (sec) => {
  if (!sec) return "0秒";
  if (sec < 60) return `${sec}秒`;
  if (sec < 3600) return `${Math.floor(sec/60)}分${sec%60}秒`;
  return `${Math.floor(sec/3600)}時間${Math.floor((sec%3600)/60)}分`;
};
const fmtDateShort = (d) => `${d.getMonth()+1}/${d.getDate()}`;
const toJSTDate = (d) => { const t = new Date(d); t.setHours(t.getHours()+9); return t.toISOString().slice(0,10); };

// ヒートマップの色（0〜1の強度 → 色）
const heatColor = (intensity) => {
  if (intensity === 0) return "#f8fafc";
  if (intensity < 0.2) return "#e0e7ff";
  if (intensity < 0.4) return "#c7d2fe";
  if (intensity < 0.6) return "#a5b4fc";
  if (intensity < 0.8) return "#818cf8";
  return "#6366f1";
};

function UsageStats({ stores, companies }) {
  const [hourlyData, setHourlyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30d");
  const [view, setView] = useState("overview"); // overview | heatmap | calendar
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterStore, setFilterStore] = useState("all");
  const [calMonth, setCalMonth] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`; });

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 1;
      const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

      let q = supabase.from("hourly_stats").select("*").gte("stat_date", since);
      if (filterCompany !== "all") q = q.eq("company_id", filterCompany);
      if (filterStore !== "all") q = q.eq("store_id", filterStore);

      const { data, error } = await q.order("stat_date", { ascending: true });
      if (error) throw error;
      setHourlyData(data || []);
    } catch (e) {
      console.error("Stats load error:", e);
      setHourlyData([]);
    }
    setLoading(false);
  }, [period, filterCompany, filterStore]);

  useEffect(() => { loadStats(); }, [loadStats]);

  // === 集計 ===
  const totalRecords = hourlyData.reduce((a, r) => a + r.record_count, 0);
  const totalDuration = hourlyData.reduce((a, r) => a + r.total_duration_sec, 0);
  const uniqueDates = [...new Set(hourlyData.map(r => r.stat_date))];
  const activeStores = [...new Set(hourlyData.filter(r => r.store_id).map(r => r.store_id))];
  const allUsers = new Set();
  hourlyData.forEach(r => (r.user_ids || []).forEach(u => allUsers.add(u)));

  // 店舗別集計
  const byStore = {};
  hourlyData.forEach(r => {
    const sid = r.store_id || "unlinked";
    if (!byStore[sid]) byStore[sid] = { count: 0, duration: 0 };
    byStore[sid].count += r.record_count;
    byStore[sid].duration += r.total_duration_sec;
  });
  const storeRanking = Object.entries(byStore)
    .map(([id, d]) => ({ id, ...d, name: stores.find(s => s.id === id)?.name || "未紐付け" }))
    .sort((a, b) => b.count - a.count);
  const maxStoreCount = Math.max(...storeRanking.map(s => s.count), 1);

  // 日別集計
  const byDate = {};
  hourlyData.forEach(r => {
    if (!byDate[r.stat_date]) byDate[r.stat_date] = { count: 0, duration: 0 };
    byDate[r.stat_date].count += r.record_count;
    byDate[r.stat_date].duration += r.total_duration_sec;
  });
  const sortedDates = Object.keys(byDate).sort();
  const maxDayCount = Math.max(...Object.values(byDate).map(d => d.count), 1);

  // ヒートマップ集計 (曜日 × 時間帯)
  const heatmapGrid = Array.from({ length: 7 }, () => Array(24).fill(0));
  hourlyData.forEach(r => {
    const dayOfWeek = new Date(r.stat_date + "T00:00:00+09:00").getDay();
    heatmapGrid[dayOfWeek][r.stat_hour] += r.record_count;
  });
  const heatMax = Math.max(...heatmapGrid.flat(), 1);

  // カレンダー用: 月別日次データ
  const [calYear, calMonthNum] = calMonth.split("-").map(Number);
  const calFirstDay = new Date(calYear, calMonthNum - 1, 1).getDay();
  const calDaysInMonth = new Date(calYear, calMonthNum, 0).getDate();
  const calData = {};
  hourlyData.forEach(r => {
    if (r.stat_date.startsWith(calMonth)) {
      const day = parseInt(r.stat_date.slice(8, 10));
      if (!calData[day]) calData[day] = { count: 0, duration: 0 };
      calData[day].count += r.record_count;
      calData[day].duration += r.total_duration_sec;
    }
  });
  const calMaxCount = Math.max(...Object.values(calData).map(d => d.count), 1);

  // フィルタ連動: 会社選択時の店舗リスト
  const filteredStores = filterCompany === "all" ? stores : stores.filter(s => s.company_id === filterCompany);

  const PeriodBtn = ({ id, label }) => (
    <button onClick={() => setPeriod(id)} style={{
      padding:"5px 12px", borderRadius:8, border:`1px solid ${period===id?"#6366f1":"#e2e8f0"}`,
      background:period===id?"#eef2ff":"#fff", color:period===id?"#4f46e5":"#64748b",
      fontSize:11, fontWeight:700, cursor:"pointer", transition:"all 0.15s"
    }}>{label}</button>
  );

  const ViewBtn = ({ id, label }) => (
    <button onClick={() => setView(id)} style={{
      padding:"6px 14px", borderRadius:8, border:"none",
      background:view===id?"#6366f1":"transparent", color:view===id?"#fff":"#94a3b8",
      fontSize:11, fontWeight:700, cursor:"pointer", transition:"all 0.15s"
    }}>{label}</button>
  );

  if (loading) return <div style={{ textAlign:"center", padding:30 }}><Loader2 size={24} style={{ animation:"spin 1s linear infinite", color:"#94a3b8" }}/></div>;

  return (
    <div>
      {/* フィルター行 */}
      <div style={{ marginBottom:14 }}>
        <div style={{ display:"flex", gap:4, marginBottom:10 }}>
          {[{id:"1d",l:"今日"},{id:"7d",l:"7日間"},{id:"30d",l:"30日間"},{id:"90d",l:"90日間"}].map(p => (
            <PeriodBtn key={p.id} id={p.id} label={p.l}/>
          ))}
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          {(companies||[]).length > 0 && (
            <div style={{ display:"flex", alignItems:"center", gap:4 }}>
              <Building2 size={13} color="#6366f1"/>
              <select value={filterCompany} onChange={e => { setFilterCompany(e.target.value); setFilterStore("all"); }} style={{
                padding:"6px 10px", borderRadius:8, border:"2px solid #e2e8f0", fontSize:12, fontWeight:700, color:"#0f172a", cursor:"pointer", outline:"none", background:"#fff", minWidth:100
              }}>
                {(companies||[]).length > 1 && <option value="all">全社</option>}
                {(companies||[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          {filterCompany !== "all" && filteredStores.length > 0 && (
            <div style={{ display:"flex", alignItems:"center", gap:4 }}>
              <span style={{ fontSize:11, color:"#94a3b8" }}>›</span>
              <select value={filterStore} onChange={e => setFilterStore(e.target.value)} style={{
                padding:"6px 10px", borderRadius:8, border:"2px solid #e2e8f0", fontSize:12, fontWeight:700, color:"#0f172a", cursor:"pointer", outline:"none", background:"#fff", minWidth:120
              }}>
                <option value="all">全店舗（{filteredStores.length}店の合計）</option>
                {filteredStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          {filterCompany === "all" && stores.length > 0 && (
            <div style={{ display:"flex", alignItems:"center", gap:4 }}>
              <span style={{ fontSize:11, color:"#94a3b8" }}>›</span>
              <select value={filterStore} onChange={e => setFilterStore(e.target.value)} style={{
                padding:"6px 10px", borderRadius:8, border:"2px solid #e2e8f0", fontSize:12, fontWeight:700, color:"#0f172a", cursor:"pointer", outline:"none", background:"#fff", minWidth:120
              }}>
                <option value="all">全店舗</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* サマリーカード */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:8, marginBottom:16 }}>
        {[
          { num: totalRecords, label: "録音件数", color: "#6366f1" },
          { num: fmtDur(totalDuration), label: "録音時間", color: "#0d9488" },
          { num: activeStores.length, label: "稼働店舗", color: "#d97706" },
          { num: allUsers.size, label: "利用者数", color: "#db2777" },
        ].map((c, i) => (
          <div key={i} style={{ background:"#fff", borderRadius:12, padding:"14px 8px", border:"1px solid #e8ecf0", textAlign:"center", boxShadow:"0 1px 3px rgba(0,0,0,.03)" }}>
            <div style={{ fontSize:22, fontWeight:900, color:c.color, lineHeight:1 }}>{c.num}</div>
            <div style={{ fontSize:10, color:"#94a3b8", fontWeight:600, marginTop:4 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* ビュー切替 */}
      <div style={{ display:"flex", background:"#f1f5f9", borderRadius:10, padding:3, marginBottom:16, gap:2 }}>
        <ViewBtn id="overview" label="概要"/>
        <ViewBtn id="heatmap" label="ヒートマップ"/>
        <ViewBtn id="calendar" label="カレンダー"/>
      </div>

      {/* ========== 概要ビュー ========== */}
      {view === "overview" && (
        <div>
          {/* 日別推移 */}
          {sortedDates.length > 0 && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#475569", marginBottom:10 }}>日別推移</div>
              <div style={{ display:"flex", alignItems:"flex-end", gap:2, height:100, padding:"0 2px" }}>
                {sortedDates.map(date => {
                  const d = byDate[date];
                  const h = Math.max((d.count / maxDayCount) * 90, 4);
                  const dt = new Date(date + "T00:00:00+09:00");
                  return (
                    <div key={date} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", minWidth:0 }} title={`${fmtDateShort(dt)}: ${d.count}件 / ${fmtDur(d.duration)}`}>
                      <div style={{ width:"100%", maxWidth:24, height:h, background:"linear-gradient(180deg,#818cf8,#6366f1)", borderRadius:"4px 4px 0 0", transition:"height 0.3s" }}/>
                      {sortedDates.length <= 14 && (
                        <div style={{ fontSize:8, color:"#94a3b8", marginTop:2, whiteSpace:"nowrap" }}>{fmtDateShort(dt)}</div>
                      )}
                    </div>
                  );
                })}
              </div>
              {sortedDates.length > 14 && (
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                  <span style={{ fontSize:9, color:"#94a3b8" }}>{sortedDates[0]}</span>
                  <span style={{ fontSize:9, color:"#94a3b8" }}>{sortedDates[sortedDates.length-1]}</span>
                </div>
              )}
            </div>
          )}

          {/* 店舗別ランキング */}
          {storeRanking.length > 0 && (
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:"#475569", marginBottom:10 }}>店舗別</div>
              {storeRanking.map((s, i) => (
                <div key={s.id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                  <div style={{ width:20, fontSize:12, fontWeight:800, color:i < 3 ? "#6366f1" : "#94a3b8", textAlign:"right" }}>{i+1}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                      <span style={{ fontSize:12, fontWeight:700, color:"#334155", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.name}</span>
                      <span style={{ fontSize:11, fontWeight:600, color:"#6366f1", whiteSpace:"nowrap", marginLeft:8 }}>{s.count}件</span>
                    </div>
                    <div style={{ height:6, background:"#f1f5f9", borderRadius:3, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${(s.count / maxStoreCount) * 100}%`, background:"linear-gradient(90deg,#818cf8,#6366f1)", borderRadius:3, transition:"width 0.3s" }}/>
                    </div>
                    <div style={{ fontSize:9, color:"#94a3b8", marginTop:2 }}>{fmtDur(s.duration)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {totalRecords === 0 && <div style={S.empty}>この期間のデータはありません</div>}
        </div>
      )}

      {/* ========== ヒートマップビュー ========== */}
      {view === "heatmap" && (
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:"#475569", marginBottom:10 }}>時間帯 × 曜日パターン</div>
          <div style={{ fontSize:10, color:"#94a3b8", marginBottom:12 }}>録音が多い時間帯を濃い色で表示</div>
          <div style={{ overflowX:"auto" }}>
            <div style={{ display:"grid", gridTemplateColumns:"32px repeat(24, 1fr)", gap:2, minWidth:540 }}>
              {/* ヘッダー行: 時間 */}
              <div/>
              {Array.from({length:24}, (_,h) => (
                <div key={h} style={{ fontSize:8, color:"#94a3b8", textAlign:"center", fontWeight:600 }}>
                  {h % 3 === 0 ? `${h}` : ""}
                </div>
              ))}
              {/* データ行: 曜日ごと */}
              {[1,2,3,4,5,6,0].map(dow => (
                <Fragment key={dow}>
                  <div style={{ fontSize:10, fontWeight:700, color:dow===0||dow===6?"#ef4444":"#475569", display:"flex", alignItems:"center", justifyContent:"flex-end", paddingRight:4 }}>
                    {DAYS_JP[dow]}
                  </div>
                  {Array.from({length:24}, (_,h) => {
                    const val = heatmapGrid[dow][h];
                    const intensity = val / heatMax;
                    return (
                      <div key={`${dow}-${h}`} title={`${DAYS_JP[dow]}曜 ${h}時: ${val}件`} style={{
                        aspectRatio:"1", borderRadius:3, background:heatColor(intensity), cursor:"default",
                        transition:"background 0.2s", minHeight:14
                      }}/>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
          {/* 凡例 */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:4, marginTop:10 }}>
            <span style={{ fontSize:9, color:"#94a3b8" }}>少ない</span>
            {[0, 0.2, 0.4, 0.6, 0.8, 1].map(v => (
              <div key={v} style={{ width:14, height:14, borderRadius:3, background:heatColor(v) }}/>
            ))}
            <span style={{ fontSize:9, color:"#94a3b8" }}>多い</span>
          </div>
          {/* 時間帯サマリー */}
          <div style={{ marginTop:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#475569", marginBottom:6 }}>ピーク時間帯 TOP5</div>
            {(() => {
              const hourTotals = Array.from({length:24}, (_,h) => ({
                hour: h, total: heatmapGrid.reduce((a, row) => a + row[h], 0)
              })).sort((a,b) => b.total - a.total).slice(0, 5).filter(h => h.total > 0);
              return hourTotals.map((h, i) => (
                <div key={h.hour} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                  <span style={{ fontSize:11, fontWeight:800, color:i === 0 ? "#6366f1" : "#94a3b8", width:16 }}>{i+1}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:"#334155" }}>{h.hour}:00〜{h.hour+1}:00</span>
                  <span style={{ fontSize:11, color:"#6366f1", fontWeight:600 }}>{h.total}件</span>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* ========== カレンダービュー ========== */}
      {view === "calendar" && (
        <div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <button onClick={() => {
              const d = new Date(calYear, calMonthNum - 2, 1);
              setCalMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
            }} style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, color:"#6366f1", fontWeight:700 }}>‹</button>
            <div style={{ fontSize:14, fontWeight:800, color:"#0f172a" }}>{calYear}年{calMonthNum}月</div>
            <button onClick={() => {
              const d = new Date(calYear, calMonthNum, 1);
              setCalMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
            }} style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, color:"#6366f1", fontWeight:700 }}>›</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:2, marginBottom:4 }}>
            {DAYS_JP.map((d, i) => (
              <div key={d} style={{ fontSize:10, fontWeight:700, color:i===0||i===6?"#ef4444":"#94a3b8", textAlign:"center", padding:"4px 0" }}>{d}</div>
            ))}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:2 }}>
            {/* 先頭の空セル */}
            {Array.from({length: calFirstDay}, (_, i) => <div key={`e${i}`}/>)}
            {/* 日付セル */}
            {Array.from({length: calDaysInMonth}, (_, i) => {
              const day = i + 1;
              const d = calData[day];
              const intensity = d ? d.count / calMaxCount : 0;
              const today = new Date();
              const isToday = calYear === today.getFullYear() && calMonthNum === today.getMonth()+1 && day === today.getDate();
              return (
                <div key={day} title={d ? `${day}日: ${d.count}件 / ${fmtDur(d.duration)}` : `${day}日: データなし`} style={{
                  aspectRatio:"1", borderRadius:6, background: d ? heatColor(intensity) : "#f8fafc",
                  display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                  border: isToday ? "2px solid #6366f1" : "1px solid #e8ecf0",
                  cursor:"default", position:"relative", minHeight:36
                }}>
                  <div style={{ fontSize:11, fontWeight:isToday ? 800 : 600, color: d ? (intensity > 0.5 ? "#fff" : "#334155") : "#cbd5e1" }}>{day}</div>
                  {d && <div style={{ fontSize:7, fontWeight:700, color: intensity > 0.5 ? "#e0e7ff" : "#6366f1" }}>{d.count}件</div>}
                </div>
              );
            })}
          </div>
          {/* カレンダー月間サマリー */}
          {(() => {
            const monthTotal = Object.values(calData).reduce((a, d) => a + d.count, 0);
            const monthDur = Object.values(calData).reduce((a, d) => a + d.duration, 0);
            const activeDays = Object.keys(calData).length;
            return monthTotal > 0 ? (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:8, marginTop:12 }}>
                <div style={{ textAlign:"center", padding:10, background:"#f8fafc", borderRadius:8 }}>
                  <div style={{ fontSize:18, fontWeight:900, color:"#6366f1" }}>{monthTotal}</div>
                  <div style={{ fontSize:9, color:"#94a3b8", fontWeight:600 }}>月間件数</div>
                </div>
                <div style={{ textAlign:"center", padding:10, background:"#f8fafc", borderRadius:8 }}>
                  <div style={{ fontSize:18, fontWeight:900, color:"#0d9488" }}>{fmtDur(monthDur)}</div>
                  <div style={{ fontSize:9, color:"#94a3b8", fontWeight:600 }}>月間録音時間</div>
                </div>
                <div style={{ textAlign:"center", padding:10, background:"#f8fafc", borderRadius:8 }}>
                  <div style={{ fontSize:18, fontWeight:900, color:"#d97706" }}>{activeDays}日</div>
                  <div style={{ fontSize:9, color:"#94a3b8", fontWeight:600 }}>稼働日数</div>
                </div>
              </div>
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
}

// === Role Management (ロール管理) Phase B ===
const PERM_CATEGORIES = {
  recording: { label: "録音", color: "#059669", icon: "🎙️" },
  admin:     { label: "管理", color: "#6366f1", icon: "⚙️" },
  general:   { label: "一般", color: "#64748b", icon: "📋" },
};

function RolePanel({ onRefresh }) {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [rolePerms, setRolePerms] = useState({}); // { roleId: [permId, ...] }
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | "new" | role object
  const [form, setForm] = useState({ name: "", description: "", color: "#6366f1" });
  const [formPerms, setFormPerms] = useState([]); // permission ids
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: rData }, { data: pData }, { data: rpData }] = await Promise.all([
        supabase.from("roles").select("*").order("sort_order").order("created_at"),
        supabase.from("permissions").select("*").order("sort_order"),
        supabase.from("role_permissions").select("role_id, permission_id"),
      ]);
      setRoles(rData || []);
      setPermissions(pData || []);
      const map = {};
      (rpData || []).forEach(rp => {
        if (!map[rp.role_id]) map[rp.role_id] = [];
        map[rp.role_id].push(rp.permission_id);
      });
      setRolePerms(map);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (role) => {
    if (role === "new") {
      setForm({ name: "", description: "", color: "#6366f1" });
      setFormPerms([]);
    } else {
      setForm({ name: role.name, description: role.description || "", color: role.color || "#6366f1" });
      setFormPerms(rolePerms[role.id] || []);
    }
    setEditing(role);
    setErr("");
  };

  const togglePerm = (pid) => {
    setFormPerms(prev => prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid]);
  };

  const toggleCategory = (cat) => {
    const catPerms = permissions.filter(p => p.category === cat).map(p => p.id);
    const allChecked = catPerms.every(p => formPerms.includes(p));
    if (allChecked) {
      setFormPerms(prev => prev.filter(p => !catPerms.includes(p)));
    } else {
      setFormPerms(prev => [...new Set([...prev, ...catPerms])]);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setErr("ロール名を入力してください"); return; }
    setSaving(true);
    setErr("");
    try {
      let roleId;
      if (editing === "new") {
        const maxOrder = Math.max(...roles.map(r => r.sort_order || 0), 0);
        const { data, error } = await supabase.from("roles").insert({
          name: form.name.trim(),
          description: form.description.trim(),
          color: form.color,
          is_system: false,
          sort_order: maxOrder + 1,
        }).select().single();
        if (error) throw error;
        roleId = data.id;
      } else {
        const { error } = await supabase.from("roles").update({
          name: form.name.trim(),
          description: form.description.trim(),
          color: form.color,
          updated_at: new Date().toISOString(),
        }).eq("id", editing.id);
        if (error) throw error;
        roleId = editing.id;
        // 既存の権限を削除
        await supabase.from("role_permissions").delete().eq("role_id", roleId);
      }
      // 権限を挿入
      if (formPerms.length > 0) {
        const rows = formPerms.map(pid => ({ role_id: roleId, permission_id: pid }));
        const { error: rpErr } = await supabase.from("role_permissions").insert(rows);
        if (rpErr) throw rpErr;
      }
      setEditing(null);
      load();
      onRefresh?.();
    } catch (e) { setErr(e.message); }
    setSaving(false);
  };

  const handleDelete = async (role) => {
    const msg = role.is_system
      ? `⚠️ システムロール「${role.name}」を削除しますか？\n\nこのロールが割り当てられているユーザーのロールは解除されます。\nシステムロールの削除は影響が大きいため、十分注意してください。`
      : `ロール「${role.name}」を削除しますか？\nこのロールが割り当てられているユーザーのロールは解除されます。`;
    if (!confirm(msg)) return;
    try {
      await supabase.from("users").update({ role_id: null }).eq("role_id", role.id);
      await supabase.from("role_permissions").delete().eq("role_id", role.id);
      await supabase.from("roles").delete().eq("id", role.id);
      load();
      onRefresh?.();
    } catch (e) { console.error(e); }
  };

  const handleToggleActive = async (role) => {
    if (role.is_system && role.is_active) {
      if (!confirm(`⚠️ システムロール「${role.name}」を無効にしますか？\n既存ユーザーに影響する可能性があります。`)) return;
    }
    await supabase.from("roles").update({ is_active: !role.is_active }).eq("id", role.id);
    load();
  };

  const handleMoveRole = async (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= roles.length) return;
    const a = roles[index];
    const b = roles[newIndex];
    await Promise.all([
      supabase.from("roles").update({ sort_order: b.sort_order ?? newIndex }).eq("id", a.id),
      supabase.from("roles").update({ sort_order: a.sort_order ?? index }).eq("id", b.id),
    ]);
    load();
  };

  // 権限をカテゴリでグループ化
  const permsByCategory = {};
  permissions.forEach(p => {
    if (!permsByCategory[p.category]) permsByCategory[p.category] = [];
    permsByCategory[p.category].push(p);
  });

  if (loading) return <div style={{ textAlign:"center", padding:30 }}><Loader2 size={24} style={{ animation:"spin 1s linear infinite", color:"#94a3b8" }}/></div>;

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div style={{ fontSize:12, color:"#94a3b8" }}>ロール数: {roles.length}</div>
        <button onClick={() => openEdit("new")} style={S.btn()}>
          <Plus size={14}/> 新規ロール
        </button>
      </div>
      <div style={{ fontSize:10, color:"#94a3b8", marginBottom:12, padding:"6px 10px", background:"#f8fafc", borderRadius:8, lineHeight:1.6 }}>
        上にあるロールほど権限が高くなります。↑↓で順序を変更すると権限階層が変わります。下位のロールは上位のユーザーを閲覧・操作できません。
      </div>

      {/* ロール一覧 */}
      {roles.map((role, roleIdx) => {
        const perms = (rolePerms[role.id] || []).map(pid => permissions.find(p => p.id === pid)).filter(Boolean);
        return (
          <div key={role.id} style={{...S.card, opacity: role.is_active ? 1 : 0.5 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:perms.length > 0 ? 10 : 0 }}>
              {/* 並び替えボタン */}
              <div style={{ display:"flex", flexDirection:"column", gap:1, flexShrink:0 }}>
                <button onClick={() => handleMoveRole(roleIdx, -1)} disabled={roleIdx === 0} style={{ background:"none", border:"none", cursor:roleIdx === 0 ? "default" : "pointer", padding:0, opacity:roleIdx === 0 ? 0.2 : 0.6 }}>
                  <ArrowUp size={11} color="#64748b"/>
                </button>
                <button onClick={() => handleMoveRole(roleIdx, 1)} disabled={roleIdx === roles.length - 1} style={{ background:"none", border:"none", cursor:roleIdx === roles.length - 1 ? "default" : "pointer", padding:0, opacity:roleIdx === roles.length - 1 ? 0.2 : 0.6 }}>
                  <ArrowDown size={11} color="#64748b"/>
                </button>
              </div>
              <div style={{ width:8, height:8, borderRadius:4, background:role.color || "#6366f1", flexShrink:0 }}/>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:14, fontWeight:800, color:"#0f172a" }}>{role.name}</span>
                  {role.is_system && <span style={S.badge("#7c3aed","#f3e8ff")}>システム</span>}
                  {!role.is_active && <span style={S.badge("#ef4444","#fef2f2")}>無効</span>}
                </div>
                {role.description && <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>{role.description}</div>}
              </div>
              <div style={{ display:"flex", gap:4 }}>
                <button onClick={() => openEdit(role)} style={{...S.btnOutline, padding:"6px 10px"}}><Edit3 size={12}/></button>
                <button onClick={() => handleToggleActive(role)} style={{...S.btnOutline, padding:"6px 10px"}}>
                  {role.is_active ? <XCircle size={12} color="#ef4444"/> : <CheckCircle size={12} color="#059669"/>}
                </button>
                <button onClick={() => handleDelete(role)} style={{...S.btnDanger, padding:"6px 10px"}}><Trash2 size={12}/></button>
              </div>
            </div>
            {/* 権限バッジ */}
            {perms.length > 0 && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:4, paddingLeft:18 }}>
                {perms.map(p => {
                  const cat = PERM_CATEGORIES[p.category] || PERM_CATEGORIES.general;
                  return (
                    <span key={p.id} style={{ fontSize:10, fontWeight:600, color:cat.color, background:`${cat.color}12`, padding:"2px 7px", borderRadius:5, border:`1px solid ${cat.color}30` }}>
                      {p.label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {roles.length === 0 && <div style={S.empty}>ロールがありません</div>}

      {/* ロール編集モーダル */}
      {editing !== null && (
        <div style={S.modal} onClick={() => setEditing(null)}>
          <div style={{...S.modalBox, maxWidth:560 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div style={{ fontSize:16, fontWeight:800, color:"#0f172a" }}>
                {editing === "new" ? "新規ロール作成" : `${editing.name} を編集`}
              </div>
              <button onClick={() => setEditing(null)} style={{ background:"none", border:"none", cursor:"pointer" }}><X size={20} color="#94a3b8"/></button>
            </div>

            {err && <div style={{ background:"#fef2f2", color:"#dc2626", padding:"8px 12px", borderRadius:8, fontSize:12, marginBottom:12 }}>{err}</div>}

            <div style={{ marginBottom:12 }}>
              <label style={S.label}>ロール名 *</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={S.input} placeholder="例: エリアマネージャー"/>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={S.label}>説明</label>
              <input value={form.description} onChange={e => setForm({...form, description: e.target.value})} style={S.input} placeholder="このロールの説明"/>
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={S.label}>バッジカラー</label>
              <div style={{ display:"flex", gap:6 }}>
                {["#6366f1","#7c3aed","#0d9488","#2563eb","#d97706","#db2777","#059669","#dc2626","#475569"].map(c => (
                  <button key={c} onClick={() => setForm({...form, color: c})} style={{
                    width:28, height:28, borderRadius:8, background:c, border: form.color === c ? "3px solid #0f172a" : "2px solid transparent", cursor:"pointer"
                  }}/>
                ))}
              </div>
            </div>

            {/* 権限設定 */}
            <div style={{ fontSize:13, fontWeight:800, color:"#0f172a", marginBottom:10 }}>権限設定</div>
            {Object.entries(permsByCategory).map(([cat, perms]) => {
              const catMeta = PERM_CATEGORIES[cat] || PERM_CATEGORIES.general;
              const allChecked = perms.every(p => formPerms.includes(p.id));
              const someChecked = perms.some(p => formPerms.includes(p.id));
              return (
                <div key={cat} style={{ marginBottom:14, background:"#f8fafc", borderRadius:10, padding:"10px 12px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8, cursor:"pointer" }} onClick={() => toggleCategory(cat)}>
                    <div style={{
                      width:16, height:16, borderRadius:4, border:`2px solid ${allChecked ? catMeta.color : "#cbd5e1"}`,
                      background: allChecked ? catMeta.color : someChecked ? `${catMeta.color}40` : "#fff",
                      display:"flex", alignItems:"center", justifyContent:"center"
                    }}>
                      {(allChecked || someChecked) && <Check size={10} color="#fff"/>}
                    </div>
                    <span style={{ fontSize:12, fontWeight:800, color:catMeta.color }}>{catMeta.icon} {catMeta.label}</span>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:4, paddingLeft:22 }}>
                    {perms.map(p => {
                      const checked = formPerms.includes(p.id);
                      return (
                        <label key={p.id} style={{ display:"flex", alignItems:"flex-start", gap:6, cursor:"pointer", padding:"4px 0" }}>
                          <div style={{
                            width:15, height:15, borderRadius:4, border:`2px solid ${checked ? catMeta.color : "#cbd5e1"}`,
                            background: checked ? catMeta.color : "#fff", display:"flex", alignItems:"center", justifyContent:"center",
                            flexShrink:0, marginTop:1
                          }} onClick={() => togglePerm(p.id)}>
                            {checked && <Check size={9} color="#fff"/>}
                          </div>
                          <div onClick={() => togglePerm(p.id)}>
                            <div style={{ fontSize:11, fontWeight:700, color:"#334155" }}>{p.label}</div>
                            <div style={{ fontSize:9, color:"#94a3b8" }}>{p.description}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div style={{ display:"flex", gap:8, marginTop:16, justifyContent:"flex-end" }}>
              <button onClick={() => setEditing(null)} style={S.btnOutline}>キャンセル</button>
              <button onClick={handleSave} disabled={saving} style={S.btn()}>
                {saving ? <Loader2 size={14} style={{ animation:"spin 1s linear infinite" }}/> : <Save size={14}/>}
                {editing === "new" ? "作成" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// === SOAP Template Management (Phase C) ===
const TEMPLATE_CATEGORIES = {
  general:  { label: "一般", color: "#64748b" },
  initial:  { label: "初回", color: "#2563eb" },
  followup: { label: "継続", color: "#059669" },
  highrisk: { label: "ハイリスク", color: "#dc2626" },
  custom:   { label: "カスタム", color: "#7c3aed" },
};
const SOAP_FIELDS = [
  { key:"soap_s", label:"S（主観的情報）", color:"#059669" },
  { key:"soap_o", label:"O（客観的情報）", color:"#2563eb" },
  { key:"soap_a", label:"A（評価）", color:"#d97706" },
  { key:"soap_ep", label:"EP（教育計画）", color:"#7c3aed" },
  { key:"soap_cp", label:"CP（ケアプラン）", color:"#db2777" },
  { key:"soap_op", label:"OP（観察計画）", color:"#0891b2" },
  { key:"soap_p", label:"P（計画）", color:"#ea580c" },
  { key:"soap_q", label:"問い合わせ", color:"#475569" },
  { key:"soap_other", label:"その他", color:"#6b7280" },
  { key:"soap_highrisk", label:"ハイリスク", color:"#dc2626" },
];

function SoapTemplatePanel({ companies, stores }) {
  const [templates, setTemplates] = useState([]);
  const [checkRules, setCheckRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | "new" | template object
  const [editingRule, setEditingRule] = useState(null);
  const [form, setForm] = useState({});
  const [ruleForm, setRuleForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [subTab, setSubTab] = useState("templates"); // templates | rules

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: tData }, { data: rData }] = await Promise.all([
      supabase.from("soap_templates").select("*").order("sort_order").order("created_at"),
      supabase.from("soap_check_rules").select("*").order("sort_order"),
    ]);
    setTemplates(tData || []);
    setCheckRules(rData || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openTemplateEdit = (tpl) => {
    if (tpl === "new") {
      const emptyForm = { name:"", description:"", category:"general", company_id:"", store_id:"" };
      SOAP_FIELDS.forEach(f => emptyForm[f.key] = "");
      setForm(emptyForm);
    } else {
      const f = { name:tpl.name, description:tpl.description||"", category:tpl.category||"general", company_id:tpl.company_id||"", store_id:tpl.store_id||"" };
      SOAP_FIELDS.forEach(sf => f[sf.key] = tpl[sf.key] || "");
      setForm(f);
    }
    setEditing(tpl);
    setErr("");
  };

  const handleSaveTemplate = async () => {
    if (!form.name.trim()) { setErr("テンプレート名を入力してください"); return; }
    setSaving(true); setErr("");
    try {
      const row = {
        name: form.name.trim(), description: form.description.trim(), category: form.category,
        company_id: form.company_id || null, store_id: form.store_id || null,
        updated_at: new Date().toISOString(),
      };
      SOAP_FIELDS.forEach(f => row[f.key] = form[f.key] || "");
      if (editing === "new") {
        const maxOrder = Math.max(...templates.map(t => t.sort_order || 0), 0);
        row.sort_order = maxOrder + 1;
        const { error } = await supabase.from("soap_templates").insert(row);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("soap_templates").update(row).eq("id", editing.id);
        if (error) throw error;
      }
      setEditing(null);
      load();
    } catch (e) { setErr(e.message); }
    setSaving(false);
  };

  const handleDeleteTemplate = async (id) => {
    if (!confirm("このテンプレートを削除しますか？")) return;
    await supabase.from("soap_templates").delete().eq("id", id);
    load();
  };

  // チェックルール編集
  const openRuleEdit = (rule) => {
    if (rule === "new") {
      setRuleForm({ name:"", description:"", required_fields:["soap_s","soap_p"], min_length:5, applies_to:"general", company_id:"" });
    } else {
      setRuleForm({ name:rule.name, description:rule.description||"", required_fields:rule.required_fields||[], min_length:rule.min_length||0, applies_to:rule.applies_to||"general", company_id:rule.company_id||"" });
    }
    setEditingRule(rule);
    setErr("");
  };

  const handleSaveRule = async () => {
    if (!ruleForm.name.trim()) { setErr("ルール名を入力してください"); return; }
    setSaving(true); setErr("");
    try {
      const row = {
        name: ruleForm.name.trim(), description: ruleForm.description.trim(),
        required_fields: ruleForm.required_fields, min_length: ruleForm.min_length,
        applies_to: ruleForm.applies_to, company_id: ruleForm.company_id || null,
        updated_at: new Date().toISOString(),
      };
      if (editingRule === "new") {
        row.sort_order = checkRules.length + 1;
        const { error } = await supabase.from("soap_check_rules").insert(row);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("soap_check_rules").update(row).eq("id", editingRule.id);
        if (error) throw error;
      }
      setEditingRule(null);
      load();
    } catch (e) { setErr(e.message); }
    setSaving(false);
  };

  const handleDeleteRule = async (id) => {
    if (!confirm("このルールを削除しますか？")) return;
    await supabase.from("soap_check_rules").delete().eq("id", id);
    load();
  };

  const toggleRuleField = (field) => {
    setRuleForm(prev => ({
      ...prev,
      required_fields: prev.required_fields.includes(field)
        ? prev.required_fields.filter(f => f !== field)
        : [...prev.required_fields, field]
    }));
  };

  if (loading) return <div style={{ textAlign:"center", padding:30 }}><Loader2 size={24} style={{ animation:"spin 1s linear infinite", color:"#94a3b8" }}/></div>;

  return (
    <div>
      {/* サブタブ */}
      <div style={{ display:"flex", gap:4, background:"#f1f5f9", borderRadius:10, padding:3, marginBottom:16 }}>
        <button onClick={() => setSubTab("templates")} style={{ flex:1, padding:"7px 12px", borderRadius:8, border:"none", background:subTab==="templates"?"#6366f1":"transparent", color:subTab==="templates"?"#fff":"#94a3b8", fontSize:11, fontWeight:700, cursor:"pointer" }}>
          テンプレート ({templates.length})
        </button>
        <button onClick={() => setSubTab("rules")} style={{ flex:1, padding:"7px 12px", borderRadius:8, border:"none", background:subTab==="rules"?"#6366f1":"transparent", color:subTab==="rules"?"#fff":"#94a3b8", fontSize:11, fontWeight:700, cursor:"pointer" }}>
          記載チェックルール ({checkRules.length})
        </button>
      </div>

      {/* ========== テンプレート一覧 ========== */}
      {subTab === "templates" && (
        <div>
          <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
            <button onClick={() => openTemplateEdit("new")} style={S.btn()}>
              <Plus size={14}/> 新規テンプレート
            </button>
          </div>
          {templates.length === 0 ? <div style={S.empty}>テンプレートがありません</div> : (
            templates.map(tpl => {
              const cat = TEMPLATE_CATEGORIES[tpl.category] || TEMPLATE_CATEGORIES.general;
              const filledFields = SOAP_FIELDS.filter(f => tpl[f.key]?.trim()).length;
              return (
                <div key={tpl.id} style={{...S.card, opacity: tpl.is_active ? 1 : 0.5 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <FileText size={18} color={cat.color}/>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize:13, fontWeight:800, color:"#0f172a" }}>{tpl.name}</span>
                        <span style={S.badge(cat.color, `${cat.color}18`)}>{cat.label}</span>
                      </div>
                      <div style={{ fontSize:10, color:"#94a3b8", marginTop:2 }}>
                        {filledFields}項目入力済
                        {tpl.description && <span> · {tpl.description}</span>}
                      </div>
                    </div>
                    <button onClick={() => openTemplateEdit(tpl)} style={{...S.btnOutline, padding:"6px 10px"}}><Edit3 size={12}/></button>
                    <button onClick={() => handleDeleteTemplate(tpl.id)} style={{...S.btnDanger, padding:"6px 10px"}}><Trash2 size={12}/></button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========== チェックルール一覧 ========== */}
      {subTab === "rules" && (
        <div>
          <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
            <button onClick={() => openRuleEdit("new")} style={S.btn()}>
              <Plus size={14}/> 新規ルール
            </button>
          </div>
          {checkRules.length === 0 ? <div style={S.empty}>チェックルールがありません</div> : (
            checkRules.map(rule => {
              const cat = TEMPLATE_CATEGORIES[rule.applies_to] || TEMPLATE_CATEGORIES.general;
              return (
                <div key={rule.id} style={{...S.card, opacity: rule.is_active ? 1 : 0.5 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <AlertTriangle size={18} color={cat.color}/>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize:13, fontWeight:700, color:"#0f172a" }}>{rule.name}</span>
                        <span style={S.badge(cat.color, `${cat.color}18`)}>{cat.label}</span>
                      </div>
                      <div style={{ fontSize:10, color:"#94a3b8", marginTop:2 }}>
                        必須: {(rule.required_fields||[]).map(f => SOAP_FIELDS.find(sf => sf.key === f)?.label?.split("（")[0] || f).join(", ")}
                        {rule.min_length > 0 && <span> · 最低{rule.min_length}文字</span>}
                      </div>
                    </div>
                    <button onClick={() => openRuleEdit(rule)} style={{...S.btnOutline, padding:"6px 10px"}}><Edit3 size={12}/></button>
                    <button onClick={() => handleDeleteRule(rule.id)} style={{...S.btnDanger, padding:"6px 10px"}}><Trash2 size={12}/></button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========== テンプレート編集モーダル ========== */}
      {editing !== null && (
        <div style={S.modal} onClick={() => setEditing(null)}>
          <div style={{...S.modalBox, maxWidth:600 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div style={{ fontSize:16, fontWeight:800, color:"#0f172a" }}>
                {editing === "new" ? "新規テンプレート" : "テンプレートを編集"}
              </div>
              <button onClick={() => setEditing(null)} style={{ background:"none", border:"none", cursor:"pointer" }}><X size={20} color="#94a3b8"/></button>
            </div>
            {err && <div style={{ background:"#fef2f2", color:"#dc2626", padding:"8px 12px", borderRadius:8, fontSize:12, marginBottom:12 }}>{err}</div>}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
              <div>
                <label style={S.label}>テンプレート名 *</label>
                <input value={form.name} onChange={e => setForm({...form, name:e.target.value})} style={S.input} placeholder="例: 初回面談用"/>
              </div>
              <div>
                <label style={S.label}>カテゴリ</label>
                <select value={form.category} onChange={e => setForm({...form, category:e.target.value})} style={S.input}>
                  {Object.entries(TEMPLATE_CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={S.label}>説明</label>
              <input value={form.description} onChange={e => setForm({...form, description:e.target.value})} style={S.input} placeholder="このテンプレートの用途"/>
            </div>
            {(companies||[]).length > 0 && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
                <div>
                  <label style={S.label}>対象会社（空=全社共通）</label>
                  <select value={form.company_id} onChange={e => setForm({...form, company_id:e.target.value, store_id:""})} style={S.input}>
                    <option value="">全社共通</option>
                    {(companies||[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>対象店舗（空=全店舗共通）</label>
                  <select value={form.store_id} onChange={e => setForm({...form, store_id:e.target.value})} style={S.input}>
                    <option value="">全店舗共通</option>
                    {(stores||[]).filter(s => !form.company_id || s.company_id === form.company_id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
            )}
            <div style={{ fontSize:13, fontWeight:800, color:"#0f172a", marginBottom:8 }}>SOAP定型文</div>
            <div style={{ maxHeight:320, overflowY:"auto", paddingRight:4 }}>
              {SOAP_FIELDS.map(f => (
                <div key={f.key} style={{ marginBottom:10 }}>
                  <label style={{ fontSize:11, fontWeight:700, color:f.color, display:"block", marginBottom:3 }}>{f.label}</label>
                  <textarea value={form[f.key]||""} onChange={e => setForm({...form, [f.key]:e.target.value})} style={{...S.input, minHeight:48, resize:"vertical", fontSize:12, lineHeight:1.5 }} placeholder={`${f.label}のテンプレートテキスト`}/>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:8, marginTop:16, justifyContent:"flex-end" }}>
              <button onClick={() => setEditing(null)} style={S.btnOutline}>キャンセル</button>
              <button onClick={handleSaveTemplate} disabled={saving} style={S.btn()}>
                {saving ? <Loader2 size={14} style={{ animation:"spin 1s linear infinite" }}/> : <Save size={14}/>}
                {editing === "new" ? "作成" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== チェックルール編集モーダル ========== */}
      {editingRule !== null && (
        <div style={S.modal} onClick={() => setEditingRule(null)}>
          <div style={{...S.modalBox, maxWidth:520 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div style={{ fontSize:16, fontWeight:800, color:"#0f172a" }}>
                {editingRule === "new" ? "新規チェックルール" : "ルールを編集"}
              </div>
              <button onClick={() => setEditingRule(null)} style={{ background:"none", border:"none", cursor:"pointer" }}><X size={20} color="#94a3b8"/></button>
            </div>
            {err && <div style={{ background:"#fef2f2", color:"#dc2626", padding:"8px 12px", borderRadius:8, fontSize:12, marginBottom:12 }}>{err}</div>}
            <div style={{ marginBottom:10 }}>
              <label style={S.label}>ルール名 *</label>
              <input value={ruleForm.name} onChange={e => setRuleForm({...ruleForm, name:e.target.value})} style={S.input} placeholder="例: ハイリスク薬チェック"/>
            </div>
            <div style={{ marginBottom:10 }}>
              <label style={S.label}>説明</label>
              <input value={ruleForm.description} onChange={e => setRuleForm({...ruleForm, description:e.target.value})} style={S.input}/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
              <div>
                <label style={S.label}>適用カテゴリ</label>
                <select value={ruleForm.applies_to} onChange={e => setRuleForm({...ruleForm, applies_to:e.target.value})} style={S.input}>
                  {Object.entries(TEMPLATE_CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>最低文字数</label>
                <input type="number" value={ruleForm.min_length} onChange={e => setRuleForm({...ruleForm, min_length:parseInt(e.target.value)||0})} style={S.input} min="0"/>
              </div>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ ...S.label, marginBottom:8 }}>必須項目</label>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:4 }}>
                {SOAP_FIELDS.map(f => {
                  const checked = ruleForm.required_fields.includes(f.key);
                  return (
                    <label key={f.key} style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", padding:"5px 8px", borderRadius:6, background: checked ? `${f.color}10` : "transparent" }} onClick={() => toggleRuleField(f.key)}>
                      <div style={{ width:15, height:15, borderRadius:4, border:`2px solid ${checked ? f.color : "#cbd5e1"}`, background:checked ? f.color : "#fff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        {checked && <Check size={9} color="#fff"/>}
                      </div>
                      <span style={{ fontSize:11, fontWeight:600, color:f.color }}>{f.label.split("（")[0]}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button onClick={() => setEditingRule(null)} style={S.btnOutline}>キャンセル</button>
              <button onClick={handleSaveRule} disabled={saving} style={S.btn()}>
                {saving ? <Loader2 size={14} style={{ animation:"spin 1s linear infinite" }}/> : <Save size={14}/>}
                {editingRule === "new" ? "作成" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// === Drug Master Management (医薬品マスタ) ===
const DRUG_CATEGORIES = {
  general: { label:"一般", color:"#2563eb" },
  highrisk: { label:"ハイリスク", color:"#dc2626" },
  narcotic: { label:"麻薬・向精神薬", color:"#7c3aed" },
  biologics: { label:"生物学的製剤", color:"#0891b2" },
};

function DrugMasterPanel() {
  const [drugs, setDrugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ingredient_name:"", reading_kana:"", reading_kata:"", aliases:"", category:"general" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [importResult, setImportResult] = useState("");
  const fileRef = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("drug_master").select("*").eq("is_active", true).order("reading_kana");
    setDrugs(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (drug) => {
    if (drug === "new") {
      setForm({ ingredient_name:"", reading_kana:"", reading_kata:"", aliases:"", category:"general" });
    } else {
      setForm({
        ingredient_name: drug.ingredient_name,
        reading_kana: drug.reading_kana || "",
        reading_kata: drug.reading_kata || "",
        aliases: (drug.aliases || []).join(", "),
        category: drug.category || "general",
      });
    }
    setEditing(drug);
    setErr("");
  };

  const handleSave = async () => {
    if (!form.ingredient_name.trim() || !form.reading_kana.trim()) {
      setErr("成分名とひらがな読みは必須です"); return;
    }
    setSaving(true); setErr("");
    try {
      const aliasArr = form.aliases.split(/[,、，]/).map(a => a.trim()).filter(Boolean);
      const row = {
        ingredient_name: form.ingredient_name.trim(),
        reading_kana: form.reading_kana.trim(),
        reading_kata: form.reading_kata.trim() || form.ingredient_name.trim(),
        aliases: aliasArr,
        category: form.category,
        updated_at: new Date().toISOString(),
      };
      if (editing === "new") {
        const { error } = await supabase.from("drug_master").insert(row);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("drug_master").update(row).eq("id", editing.id);
        if (error) throw error;
      }
      setEditing(null);
      load();
    } catch (e) { setErr(e.message); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("この医薬品を削除しますか？")) return;
    await supabase.from("drug_master").delete().eq("id", id);
    load();
  };

  // CSVインポート: 成分名,ひらがな読み,カテゴリ
  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult("読み込み中...");
    try {
      const text = await file.text();
      const lines = text.split("\n").filter(l => l.trim());
      // ヘッダー行をスキップ
      const start = lines[0].includes("成分名") || lines[0].includes("ingredient") ? 1 : 0;
      const rows = [];
      for (let i = start; i < lines.length; i++) {
        const cols = lines[i].split(",").map(c => c.trim().replace(/^["']|["']$/g, ""));
        if (cols.length < 2 || !cols[0]) continue;
        rows.push({
          ingredient_name: cols[0],
          reading_kana: cols[1] || "",
          reading_kata: cols[2] || cols[0],
          category: cols[3] || "general",
          aliases: cols[4] ? cols[4].split("|").map(a => a.trim()) : [],
          is_active: true,
          updated_at: new Date().toISOString(),
        });
      }
      if (rows.length === 0) { setImportResult("❌ 有効なデータがありません"); return; }
      const { error } = await supabase.from("drug_master").upsert(rows, { onConflict: "ingredient_name" });
      if (error) throw error;
      setImportResult(`✅ ${rows.length}件インポート完了`);
      load();
    } catch (e) { setImportResult("❌ " + e.message); }
    e.target.value = "";
    setTimeout(() => setImportResult(""), 5000);
  };

  // フィルタ
  const q = search.trim().toLowerCase();
  const filtered = drugs.filter(d => {
    if (filterCat !== "all" && d.category !== filterCat) return false;
    if (q && !d.ingredient_name.toLowerCase().includes(q) && !d.reading_kana.includes(q) && !(d.reading_kata||"").toLowerCase().includes(q)) return false;
    return true;
  });

  if (loading) return <div style={{ textAlign:"center", padding:30 }}><Loader2 size={24} style={{ animation:"spin 1s linear infinite", color:"#94a3b8" }}/></div>;

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:8 }}>
        <div style={{ fontSize:12, color:"#94a3b8" }}>登録成分数: {drugs.length}</div>
        <div style={{ display:"flex", gap:6 }}>
          <label style={{...S.btnOutline, cursor:"pointer", display:"flex", alignItems:"center", gap:4, fontSize:11 }}>
            <Upload size={12}/> CSVインポート
            <input type="file" accept=".csv,.txt" onChange={handleImport} style={{ display:"none" }}/>
          </label>
          <button onClick={() => openEdit("new")} style={S.btn()}>
            <Plus size={14}/> 新規追加
          </button>
        </div>
      </div>
      {importResult && <div style={{ fontSize:12, fontWeight:600, color:importResult.startsWith("✅")?"#059669":"#dc2626", marginBottom:10, padding:"6px 10px", background:importResult.startsWith("✅")?"#ecfdf5":"#fef2f2", borderRadius:8 }}>{importResult}</div>}

      {/* 検索・フィルタ */}
      <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        <div style={{ flex:1, position:"relative" }}>
          <Search size={14} color="#94a3b8" style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)" }}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="成分名・読みで検索..." style={{...S.input, paddingLeft:32, fontSize:12 }}/>
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:11, fontWeight:600, cursor:"pointer", outline:"none" }}>
          <option value="all">全分類</option>
          {Object.entries(DRUG_CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div style={{ fontSize:11, color:"#94a3b8", marginBottom:8 }}>{filtered.length}件表示</div>

      {/* 医薬品リスト */}
      <div style={{ maxHeight:400, overflowY:"auto" }}>
        {filtered.length === 0 ? <div style={S.empty}>該当なし</div> : (
          filtered.map(d => {
            const cat = DRUG_CATEGORIES[d.category] || DRUG_CATEGORIES.general;
            return (
              <div key={d.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 0", borderBottom:"1px solid #f1f5f9" }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:"#0f172a" }}>{d.ingredient_name}</span>
                    <span style={{ fontSize:9, fontWeight:600, color:cat.color, background:`${cat.color}15`, padding:"1px 5px", borderRadius:4 }}>{cat.label}</span>
                  </div>
                  <div style={{ fontSize:10, color:"#94a3b8" }}>
                    {d.reading_kana}
                    {(d.aliases||[]).length > 0 && <span> · 別名: {d.aliases.join(", ")}</span>}
                  </div>
                </div>
                <button onClick={() => openEdit(d)} style={{...S.btnOutline, padding:"4px 8px"}}><Edit3 size={11}/></button>
                <button onClick={() => handleDelete(d.id)} style={{...S.btnDanger, padding:"4px 8px"}}><Trash2 size={11}/></button>
              </div>
            );
          })
        )}
      </div>

      {/* CSV形式の説明 */}
      <div style={{ marginTop:14, fontSize:10, color:"#94a3b8", lineHeight:1.6, background:"#f8fafc", borderRadius:8, padding:"8px 12px" }}>
        CSVフォーマット: <code style={{ background:"#e2e8f0", padding:"1px 4px", borderRadius:3 }}>成分名,ひらがな読み,カタカナ読み,カテゴリ,別名1|別名2</code><br/>
        毎月の新薬追加はCSVファイルで一括インポートできます。同じ成分名があれば上書き更新されます。
      </div>

      {/* 編集モーダル */}
      {editing !== null && (
        <div style={S.modal} onClick={() => setEditing(null)}>
          <div style={{...S.modalBox, maxWidth:480 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div style={{ fontSize:16, fontWeight:800, color:"#0f172a" }}>{editing === "new" ? "新規医薬品追加" : "医薬品を編集"}</div>
              <button onClick={() => setEditing(null)} style={{ background:"none", border:"none", cursor:"pointer" }}><X size={20} color="#94a3b8"/></button>
            </div>
            {err && <div style={{ background:"#fef2f2", color:"#dc2626", padding:"8px 12px", borderRadius:8, fontSize:12, marginBottom:12 }}>{err}</div>}
            <div style={{ marginBottom:10 }}>
              <label style={S.label}>成分名 *（正式表記）</label>
              <input value={form.ingredient_name} onChange={e => setForm({...form, ingredient_name:e.target.value})} style={S.input} placeholder="例: アムロジピン"/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
              <div>
                <label style={S.label}>ひらがな読み *</label>
                <input value={form.reading_kana} onChange={e => setForm({...form, reading_kana:e.target.value})} style={S.input} placeholder="例: あむろじぴん"/>
              </div>
              <div>
                <label style={S.label}>カタカナ読み</label>
                <input value={form.reading_kata} onChange={e => setForm({...form, reading_kata:e.target.value})} style={S.input} placeholder="例: アムロジピン"/>
              </div>
            </div>
            <div style={{ marginBottom:10 }}>
              <label style={S.label}>分類</label>
              <select value={form.category} onChange={e => setForm({...form, category:e.target.value})} style={S.input}>
                {Object.entries(DRUG_CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={S.label}>別名・Whisper誤変換候補（カンマ区切り）</label>
              <input value={form.aliases} onChange={e => setForm({...form, aliases:e.target.value})} style={S.input} placeholder="例: アムロジビン, あむろぢぴん"/>
            </div>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button onClick={() => setEditing(null)} style={S.btnOutline}>キャンセル</button>
              <button onClick={handleSave} disabled={saving} style={S.btn()}>
                {saving ? <Loader2 size={14} style={{ animation:"spin 1s linear infinite" }}/> : <Save size={14}/>}
                {editing === "new" ? "追加" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// === System Diagnostics (診断) ===
function DiagPanel() {
  const [log, setLog] = useState([]);
  const [testing, setTesting] = useState(false);
  const ts = () => new Date().toLocaleTimeString("ja-JP");
  const addLog = (l, s, d) => setLog(p => [...p, { time: ts(), label: l, status: s, detail: d }]);

  const runTests = async () => {
    setTesting(true); setLog([]);
    addLog("Version", "info", `Admin v5.6.1`);
    addLog("Supabase", "testing", "接続テスト中...");
    try {
      const { data, error } = await supabase.from("records").select("id").limit(1);
      addLog("Supabase", error ? "error" : "ok", error ? error.message : `接続OK`);
    } catch (e) { addLog("Supabase", "error", e.message); }
    addLog("SOAP API", "testing", "Vercel Function確認中...");
    try {
      const r = await fetch("/api/soap"); const d = await r.json();
      addLog("SOAP API", d.status === "ok" ? "ok" : "error", `v${d.version} / Anthropic: ${d.anthropic_key_set ? "✅" : "❌"}`);
    } catch (e) { addLog("SOAP API", "error", e.message); }
    // Admin API + 環境変数チェック
    addLog("Admin API", "testing", "環境変数確認中...");
    try {
      const r = await fetch("/api/admin"); const d = await r.json();
      if (d.env) {
        const missing = [];
        if (!d.env.SUPABASE_URL) missing.push("SUPABASE_URL");
        if (!d.env.SUPABASE_ANON_KEY) missing.push("SUPABASE_ANON_KEY");
        if (!d.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
        if (!d.env.ANTHROPIC_API_KEY) missing.push("ANTHROPIC_API_KEY");
        if (missing.length === 0) {
          addLog("Admin API", "ok", "全環境変数設定済み");
        } else {
          addLog("Admin API", "error", `未設定: ${missing.join(", ")} → Vercel Settings → Environment Variables で設定後 Redeploy`);
        }
      } else { addLog("Admin API", "error", "応答異常"); }
    } catch (e) { addLog("Admin API", "error", e.message); }
    addLog("DB Stats", "testing", "統計取得中...");
    try {
      const [{ count: rc }, { count: uc }, { count: sc }, { count: cc }] = await Promise.all([
        supabase.from("records").select("*", { count: "exact", head: true }),
        supabase.from("users").select("*", { count: "exact", head: true }),
        supabase.from("stores").select("*", { count: "exact", head: true }),
        supabase.from("companies").select("*", { count: "exact", head: true }),
      ]);
      addLog("DB Stats", "ok", `レコード${rc || 0}件 / ユーザー${uc || 0}人 / 店舗${sc || 0}店 / 会社${cc || 0}社`);
    } catch (e) { addLog("DB Stats", "error", e.message); }
    addLog("完了", "ok", "全テスト完了");
    setTesting(false);
  };

  const sc = s => s === "ok" ? "#059669" : s === "error" ? "#dc2626" : s === "info" ? "#2563eb" : "#94a3b8";

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        <div style={{ background: "#f0fdfa", borderRadius: 10, padding: "10px 12px", border: "1px solid #ccfbf1" }}>
          <div style={{ fontSize: 10, color: "#94a3b8" }}>音声認識</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0d9488" }}>Groq Whisper v3 Turbo</div>
        </div>
        <div style={{ background: "#f5f3ff", borderRadius: 10, padding: "10px 12px", border: "1px solid #ede9fe" }}>
          <div style={{ fontSize: 10, color: "#94a3b8" }}>SOAP分類</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#7c3aed" }}>Claude Haiku 4.5</div>
        </div>
      </div>
      <button onClick={runTests} disabled={testing} style={{ ...S.btn("#0891b2"), width: "100%", justifyContent: "center", marginBottom: 12 }}>
        {testing ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Activity size={14} />}
        {testing ? "テスト中..." : "全接続テスト"}
      </button>
      {log.length > 0 && (
        <div style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 12px", border: "1px solid #e2e8f0" }}>
          {log.map((l, i) => (
            <div key={i} style={{ padding: "4px 0", borderBottom: "1px solid #f1f5f9", fontSize: 11, display: "flex", alignItems: "flex-start", gap: 6 }}>
              <span style={{ color: "#94a3b8", minWidth: 52, flexShrink: 0, fontSize: 10 }}>{l.time}</span>
              <span style={{ minWidth: 14, flexShrink: 0 }}>{l.status === "ok" ? "✅" : l.status === "error" ? "❌" : l.status === "info" ? "ℹ️" : "⏳"}</span>
              <span style={{ color: sc(l.status), fontWeight: 700, minWidth: 72, flexShrink: 0 }}>{l.label}</span>
              <span style={{ color: "#64748b", wordBreak: "break-all", flex: 1 }}>{l.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// === Company Management (会社管理) ===
function CompanyPanel({ onRefresh }) {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('companies').select('*').order('created_at');
    setCompanies(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const startEdit = (c) => { setEditing(c.id); setForm({ name: c.name }); setErr(""); };
  const startNew = () => { setEditing("new"); setForm({ name: "" }); setErr(""); };
  const cancel = () => { setEditing(null); setErr(""); };

  const save = async () => {
    if (!form.name.trim()) { setErr("会社名を入力してください"); return; }
    setSaving(true); setErr("");
    try {
      const payload = { name: form.name.trim() };
      if (editing === "new") {
        const { error } = await supabase.from('companies').insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('companies').update(payload).eq('id', editing);
        if (error) throw error;
      }
      setEditing(null); await load(); onRefresh();
    } catch (e) { setErr(e.message); }
    setSaving(false);
  };

  const toggleActive = async (id, isActive) => {
    await supabase.from('companies').update({ is_active: !isActive }).eq('id', id);
    await load(); onRefresh();
  };

  if (loading) return <div style={{ textAlign:"center", padding:30 }}><Loader2 size={24} style={{ animation:"spin 1s linear infinite", color:"#94a3b8" }}/></div>;

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <div style={{ fontSize:14, fontWeight:800, color:"#0f172a" }}>登録企業 ({companies.length})</div>
        <button onClick={startNew} style={{ background:"linear-gradient(135deg,#0d9488,#0f766e)", color:"#fff", border:"none", borderRadius:10, padding:"8px 16px", fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
          <Plus size={14}/> 新規追加
        </button>
      </div>

      {editing && (
        <div style={{ background:"#f8fafc", borderRadius:12, padding:16, border:"1px solid #e2e8f0", marginBottom:12 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#0f172a", marginBottom:10 }}>{editing === "new" ? "新しい企業を追加" : "企業を編集"}</div>
          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, fontWeight:700, color:"#475569", display:"block", marginBottom:3 }}>会社名 *</label>
            <input style={{ width:"100%", padding:"9px 12px", border:"2px solid #e2e8f0", borderRadius:10, fontSize:13, outline:"none", boxSizing:"border-box" }} value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="例: ○○薬局グループ" />
          </div>
          {err && <div style={{ fontSize:11, color:"#dc2626", marginBottom:8, padding:"5px 8px", background:"#fef2f2", borderRadius:6 }}>{err}</div>}
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={save} disabled={saving} style={{ background:"linear-gradient(135deg,#0d9488,#0f766e)", color:"#fff", border:"none", borderRadius:8, padding:"8px 16px", fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
              {saving ? <Loader2 size={12} style={{ animation:"spin 1s linear infinite" }}/> : <Save size={12}/>} 保存
            </button>
            <button onClick={cancel} style={{ background:"#f1f5f9", color:"#64748b", border:"none", borderRadius:8, padding:"8px 16px", fontSize:12, fontWeight:700, cursor:"pointer" }}>キャンセル</button>
          </div>
        </div>
      )}

      {companies.map(c => (
        <div key={c.id} style={{ background:"#fff", borderRadius:12, padding:"14px 18px", border:"1px solid #e8ecf0", marginBottom:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <Building2 size={20} color={c.is_active ? "#6366f1" : "#94a3b8"} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:800, color:c.is_active ? "#0f172a" : "#94a3b8" }}>{c.name}</div>
              {!c.is_active && <span style={{ fontSize:10, fontWeight:700, color:"#ef4444", background:"#fef2f2", padding:"1px 6px", borderRadius:4 }}>無効</span>}
            </div>
            <button onClick={() => startEdit(c)} style={{ background:"#f1f5f9", border:"none", borderRadius:8, padding:"6px 10px", cursor:"pointer" }}><Edit3 size={12} color="#64748b"/></button>
            <button onClick={() => toggleActive(c.id, c.is_active)} style={{ background:"#f1f5f9", border:"none", borderRadius:8, padding:"6px 10px", cursor:"pointer" }}>
              {c.is_active ? <XCircle size={12} color="#ef4444"/> : <CheckCircle size={12} color="#059669"/>}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// === Pending Users (申請一覧) ===

// === Main Admin Component ===
export default function Admin({ session, onBack }) {
  const [tab, setTab] = useState("stores");
  
  const [stores, setStores] = useState([]);
  const [usersData, setUsersData] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showStoreForm, setShowStoreForm] = useState(null);
  const [showUserAdd, setShowUserAdd] = useState(false);
  const [showUserEdit, setShowUserEdit] = useState(null);
  const [companiesList, setCompaniesList] = useState([]);
  const [rolesList, setRolesList] = useState([]);
  const [myPermissions, setMyPermissions] = useState([]);
  // ユーザー検索・フィルタ
  const [userSearch, setUserSearch] = useState("");
  const [userFilterRole, setUserFilterRole] = useState("all");
  const [expandedStoreGroups, setExpandedStoreGroups] = useState({});
  const [expandedUserGroups, setExpandedUserGroups] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: me } = await supabase.from("users").select("*").eq("email", session.user.email).single();
      setUserInfo(me);

      if (me?.role !== "super_admin" && me?.role !== "store_admin") {
        setLoading(false);
        return;
      }

      const isSA = me.role === "super_admin";
      const myCompanyId = me.company_id;

      // ロール一覧（先に取得 → レベル計算に使う）
      const { data: rolesData } = await supabase.from("roles").select("*").order("sort_order").order("created_at");
      setRolesList(rolesData || []);

      // 自分の権限を取得
      if (me.role_id) {
        const { data: rpData } = await supabase.from("role_permissions").select("permission_id, permissions(key)").eq("role_id", me.role_id);
        setMyPermissions((rpData || []).map(rp => rp.permissions?.key).filter(Boolean));
      } else if (isSA) {
        setMyPermissions(["all"]); // super_adminは全権限
      }

      // 自分のロールのsort_order（小さい数字=上位）
      const myRoleObj = (rolesData || []).find(r => r.id === me.role_id);
      const mySortOrder = myRoleObj?.sort_order ?? (isSA ? 0 : 99);

      // 店舗一覧（store_adminは自社のみ）
      let storeQ = supabase.from("stores").select("*").order("created_at");
      if (!isSA && myCompanyId) storeQ = storeQ.eq("company_id", myCompanyId);
      const { data: storeData } = await storeQ;
      setStores(storeData || []);

      // ユーザー一覧（store_adminは自社のみ）
      let userQ = supabase.from("users").select("*, user_stores(store_id, role, stores(name, company_id))").order("created_at");
      if (!isSA && myCompanyId) userQ = userQ.eq("company_id", myCompanyId);
      const { data: userData } = await userQ;

      // 上位ロールのユーザーを非表示（自分と同格以下のみ）
      const filteredUsers = (userData || []).filter(u => {
        if (u.id === me.id) return true; // 自分自身は常に表示
        const uRole = (rolesData || []).find(r => r.id === u.role_id);
        const uSortOrder = uRole?.sort_order ?? (u.role === "super_admin" ? 0 : u.role === "store_admin" ? 1 : 99);
        return uSortOrder >= mySortOrder; // sort_orderが自分以上（=同格か下位）のみ
      });
      setUsersData(filteredUsers);

      // APIキー一覧（super_admin のみ）
      if (isSA) {
        const { data: keyData } = await supabase.from("api_keys").select("*").order("created_at");
        setApiKeys(keyData || []);
      }

      // 企業一覧（super_adminは全社、store_adminは自社のみ）
      if (isSA) {
        const { data: compData } = await supabase.from("companies").select("*").order("name");
        setCompaniesList(compData || []);
      } else if (myCompanyId) {
        const { data: compData } = await supabase.from("companies").select("*").eq("id", myCompanyId);
        setCompaniesList(compData || []);
      }

      // 申請件数（store_adminは自社のみ）
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [session]);

  useEffect(() => { loadData(); }, [loadData]);

  // アクセス権チェック
  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <Loader2 size={28} style={{ animation:"spin 1s linear infinite", color:"#6366f1" }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!userInfo || (userInfo.role !== "super_admin" && userInfo.role !== "store_admin")) {
    return (
      <div style={S.page}>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"80vh", gap:16 }}>
          <Shield size={48} color="#94a3b8"/>
          <div style={{ fontSize:16, fontWeight:800, color:"#334155" }}>アクセス権限がありません</div>
          <div style={{ fontSize:13, color:"#94a3b8" }}>管理者アカウントでログインしてください</div>
          <button onClick={onBack} style={S.btn()}>
            <ArrowLeft size={14}/> アプリに戻る
          </button>
        </div>
      </div>
    );
  }

  const isSuperAdmin = userInfo.role === "super_admin";
  const isStoreAdmin = userInfo.role === "store_admin";

  const handleDeleteStore = async (id) => {
    if (!confirm("この店舗を削除しますか？紐付いた履歴は残りますが、店舗情報は完全に削除されます。")) return;
    await supabase.from("stores").delete().eq("id", id);
    loadData();
  };

  const handleToggleStore = async (id, isActive) => {
    await supabase.from("stores").update({ is_active: !isActive }).eq("id", id);
    loadData();
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm("このユーザーを削除しますか？")) return;
    await supabase.from("user_stores").delete().eq("user_id", userId);
    await supabase.from("users").delete().eq("id", userId);
    loadData();
  };

  const allTabs = [
    { id:"company", label:"会社管理", icon:Building2, roles:["super_admin"] },
    { id:"stores", label:"店舗管理", icon:Building2, roles:["super_admin","store_admin"] },
    { id:"users", label:"ユーザー", icon:Users, roles:["super_admin","store_admin"] },
    { id:"apikeys", label:"API設定", icon:Key, roles:["super_admin"] },
    { id:"stats", label:"統計", icon:BarChart3, roles:["super_admin","store_admin"] },
    { id:"roles", label:"ロール", icon:Settings, roles:["super_admin"] },
    { id:"templates", label:"テンプレート", icon:FileText, roles:["super_admin"] },
    { id:"drugs", label:"医薬品", icon:Pill, roles:["super_admin"] },
    { id:"diag", label:"診断", icon:Activity, roles:["super_admin"] },
  ];
  const tabs = allTabs.filter(t => t.roles.includes(userInfo.role));

  return (
    <div style={S.page}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <header style={S.header}>
        <div style={S.headerInner}>
          <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
            {isSuperAdmin ? <LogOut size={16} color="#94a3b8"/> : <ArrowLeft size={16} color="#94a3b8"/>}
            <span style={{ fontSize:11, color:"#94a3b8", fontWeight:600 }}>{isSuperAdmin ? "ログアウト" : "アプリに戻る"}</span>
          </button>
          <div style={{ flex:1 }}/>
          <div style={S.headerIcon}><Shield size={16} color="#fff"/></div>
          <div>
            <div style={S.headerTitle}>{isSuperAdmin ? "システム管理" : "管理画面"}</div>
            <div style={S.headerSub}>{userInfo.display_name || userInfo.email}</div>
          </div>
          <div style={{ flex:1 }}/>
          <button onClick={loadData} style={{ background:"#1e293b", border:"none", borderRadius:8, width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
            <RefreshCw size={14} color="#64748b"/>
          </button>
        </div>
      </header>

      <main style={S.main}>
        <div style={S.tabs}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{...S.tab(tab === t.id), position:"relative"}}>
              <t.icon size={14}/> {t.label}
            </button>
          ))}
        </div>

        {/* ========== 店舗管理 ========== */}
        {tab === "stores" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div style={{ fontSize:14, fontWeight:800, color:"#0f172a" }}>登録店舗 ({stores.length})</div>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={() => {
                  const rows = [["店舗名","店舗ID","会社名","ステータス"]];
                  stores.forEach(s => {
                    const comp = companiesList.find(c => c.id === s.company_id);
                    rows.push([s.name, s.login_id || "", comp?.name || "", s.auth_user_id ? "開通済" : "未開通"]);
                  });
                  const csv = rows.map(r => r.map(c => `"${(c||"").replace(/"/g,'""')}"`).join(",")).join("\n");
                  const blob = new Blob(["\uFEFF"+csv], { type:"text/csv;charset=utf-8" });
                  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
                  a.download = `店舗一覧_${new Date().toISOString().slice(0,10)}.csv`; a.click();
                }} style={{...S.btnOutline, fontSize:10, padding:"6px 10px"}}><Download size={12}/> CSV</button>
                {isSuperAdmin && <button onClick={() => setShowStoreForm(false)} style={S.btn()}><Plus size={14}/> 新規追加</button>}
              </div>
            </div>
            {stores.length === 0 ? <div style={S.empty}>まだ店舗が登録されていません</div> : (
              (() => {
                // 会社ごとにグループ化
                const grouped = {};
                stores.forEach(s => {
                  const cid = s.company_id || "_none";
                  if (!grouped[cid]) grouped[cid] = [];
                  grouped[cid].push(s);
                });
                const companyIds = Object.keys(grouped).sort((a, b) => {
                  if (a === "_none") return 1;
                  if (b === "_none") return -1;
                  const ca = companiesList.find(c => c.id === a)?.name || "";
                  const cb = companiesList.find(c => c.id === b)?.name || "";
                  return ca.localeCompare(cb);
                });
                return companyIds.map(cid => {
                  const comp = companiesList.find(c => c.id === cid);
                  const storeList = grouped[cid];
                  return (
                    <div key={cid} style={{ marginBottom:12 }}>
                      <div onClick={() => setExpandedStoreGroups(p => ({...p, [cid]: !p[cid]}))} style={{ display:"flex", alignItems:"center", gap:6, marginBottom: expandedStoreGroups[cid] !== false ? 6 : 0, padding:"8px 10px", background:"#f1f5f9", borderRadius:8, cursor:"pointer", userSelect:"none" }}>
                        {expandedStoreGroups[cid] !== false ? <ChevronDown size={13} color="#64748b"/> : <ChevronRight size={13} color="#64748b"/>}
                        <Building2 size={13} color="#6366f1"/>
                        <span style={{ fontSize:12, fontWeight:800, color:"#334155" }}>{comp?.name || "未所属"}</span>
                        
                        <span style={{ fontSize:10, color:"#94a3b8", marginLeft:"auto" }}>{storeList.length}店舗</span>
                      </div>
                      {expandedStoreGroups[cid] !== false && storeList.map(s => (
                        <div key={s.id} style={{...S.card, marginLeft:8 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                            <Building2 size={18} color={s.is_active ? "#0d9488" : "#94a3b8"}/>
                            <div style={{ flex:1 }}>
                              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                <span style={{ fontSize:13, fontWeight:800, color:s.is_active ? "#0f172a" : "#94a3b8" }}>{s.name}</span>
                                {s.login_id && <span style={{ fontSize:10, fontFamily:"monospace", fontWeight:700, color:"#0d9488", background:"#ecfdf5", padding:"1px 6px", borderRadius:4 }}>{s.login_id}</span>}
                                {s.login_id && !s.auth_user_id && <span style={{ fontSize:9, color:"#d97706", fontWeight:600 }}>未開通</span>}
                              </div>
                              <div style={{ fontSize:10, color:"#94a3b8" }}>
                                {s.name_kana && <span style={{ marginRight:8 }}>{s.name_kana}</span>}
                                最大{s.max_users}名
                                {!s.is_active && <span style={S.badge("#ef4444","#fef2f2")}> 無効</span>}
                              </div>
                            </div>
                            <div style={{ display:"flex", gap:4 }}>
                              <button onClick={() => setShowStoreForm(s)} style={{...S.btnOutline, padding:"5px 8px"}}><Edit3 size={11}/></button>
                              <button onClick={() => handleToggleStore(s.id, s.is_active)} style={{...S.btnOutline, padding:"5px 8px"}}>
                                {s.is_active ? <XCircle size={11} color="#ef4444"/> : <CheckCircle size={11} color="#059669"/>}
                              </button>
                              {isSuperAdmin && <button onClick={() => handleDeleteStore(s.id)} style={{...S.btnDanger, padding:"5px 8px"}}><Trash2 size={11}/></button>}
                            </div>
                          </div>
                          {s.memo && <div style={{ fontSize:10, color:"#94a3b8", marginTop:4, paddingLeft:28 }}>{s.memo}</div>}
                        </div>
                      ))}
                    </div>
                  );
                });
              })()
            )}
          </div>
        )}

        {/* ========== ユーザー管理 ========== */}
        {tab === "users" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div style={{ fontSize:14, fontWeight:800, color:"#0f172a" }}>ユーザー ({usersData.length})</div>
              {isSuperAdmin && <button onClick={() => setShowUserAdd(true)} style={S.btn()}>
                <Plus size={14}/> 管理者追加
              </button>}
            </div>
            <div style={{ marginBottom:14 }}>
              <div style={{ position:"relative", marginBottom:8 }}>
                <Search size={14} color="#94a3b8" style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)" }}/>
                <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="名前・メールで検索..." style={{...S.input, paddingLeft:32, fontSize:12 }}/>
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {rolesList.length > 0 && (
                  <select value={userFilterRole} onChange={e => setUserFilterRole(e.target.value)} style={{ padding:"5px 8px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:11, fontWeight:600, color:"#475569", cursor:"pointer", outline:"none" }}>
                    <option value="all">全ロール</option>
                    {rolesList.filter(r => r.is_active).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                )}
              </div>
            </div>
            {(() => {
              const q = userSearch.trim().toLowerCase();
              const filtered = usersData.filter(u => {
                if (q && !(u.display_name||"").toLowerCase().includes(q) && !(u.email||"").toLowerCase().includes(q) && !(u.employee_id||"").toLowerCase().includes(q)) return false;
                if (userFilterRole !== "all") {
                  if (u.role_id !== userFilterRole) {
                    const matchedRole = rolesList.find(r => r.id === userFilterRole);
                    const legacyMap = { "全体管理者":"super_admin", "店舗管理者":"store_admin", "薬剤師":"pharmacist" };
                    if (!matchedRole || u.role !== legacyMap[matchedRole.name]) return false;
                  }
                }
                return true;
              });
              if (filtered.length === 0) return <div style={S.empty}>{usersData.length===0?"ユーザーがいません":"条件に一致するユーザーがいません"}</div>;
              // 会社ごとにグループ化
              const grouped = {};
              filtered.forEach(u => { const cid = u.company_id || "_none"; if (!grouped[cid]) grouped[cid] = []; grouped[cid].push(u); });
              const cids = Object.keys(grouped).sort((a,b) => {
                if (a==="_none") return 1; if (b==="_none") return -1;
                return (companiesList.find(c=>c.id===a)?.name||"").localeCompare(companiesList.find(c=>c.id===b)?.name||"");
              });
              const myRoleObj = rolesList.find(r => r.id === userInfo.role_id);
              const mySO = myRoleObj?.sort_order ?? (isSuperAdmin ? 0 : 99);
              return (
                <>
                  {(q || userFilterRole !== "all") && <div style={{ fontSize:11, color:"#94a3b8", marginBottom:8 }}>{filtered.length}件 / {usersData.length}件</div>}
                  {cids.map(cid => {
                    const comp = companiesList.find(c => c.id === cid);
                    const users = grouped[cid];
                    return (
                      <div key={cid} style={{ marginBottom:12 }}>
                        {cids.length > 1 && (
                          <div onClick={() => setExpandedUserGroups(p => ({...p, [cid]: !p[cid]}))} style={{ display:"flex", alignItems:"center", gap:6, marginBottom: expandedUserGroups[cid] !== false ? 6 : 0, padding:"8px 10px", background:"#f1f5f9", borderRadius:8, cursor:"pointer", userSelect:"none" }}>
                            {expandedUserGroups[cid] !== false ? <ChevronDown size={13} color="#64748b"/> : <ChevronRight size={13} color="#64748b"/>}
                            <Building2 size={13} color="#6366f1"/>
                            <span style={{ fontSize:12, fontWeight:800, color:"#334155" }}>{comp?.name || "未所属"}</span>
                            <span style={{ fontSize:10, color:"#94a3b8", marginLeft:"auto" }}>{users.length}名</span>
                          </div>
                        )}
                        {(cids.length <= 1 || expandedUserGroups[cid] !== false) && users.map(u => {
                          const userRole = rolesList.find(r => r.id === u.role_id);
                          const roleName = userRole?.name || ROLE_LABELS[u.role] || u.role;
                          const roleColor = userRole?.color || ROLE_COLORS[u.role]?.color || "#64748b";
                          const roleBg = userRole ? `${userRole.color}18` : ROLE_COLORS[u.role]?.bg || "#f1f5f9";
                          const storeNames = (u.user_stores || []).map(us => us.stores?.name).filter(Boolean);
                          const uSO = userRole?.sort_order ?? (u.role === "super_admin" ? 0 : u.role === "store_admin" ? 1 : 99);
                          const canEdit = mySO <= uSO;
                          const canDelete = isSuperAdmin && u.id !== userInfo.id && uSO > 0;
                          return (
                            <div key={u.id} style={{...S.card, marginLeft: cids.length > 1 ? 8 : 0 }}>
                              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                                <div style={{ width:8, height:8, borderRadius:4, background:roleColor, flexShrink:0 }}/>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div style={{ fontSize:13, fontWeight:700, color:"#0f172a" }}>{u.display_name || u.email}</div>
                                  <div style={{ fontSize:10, color:"#94a3b8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                    {u.email}{u.employee_id && ` / ${u.employee_id}`}{storeNames.length > 0 && ` — ${storeNames.join(", ")}`}
                                  </div>
                                </div>
                                {u.is_approved===false && <span style={S.badge("#d97706","#fffbeb")}>未承認</span>}
                                {u.password_reset_requested && <span style={S.badge("#dc2626","#fef2f2")}>PW依頼</span>}
                                <span style={S.badge(roleColor, roleBg)}>{roleName}</span>
                                {canEdit && <button onClick={() => setShowUserEdit(u)} style={{...S.btnOutline, padding:"5px 8px"}}><Edit3 size={11}/></button>}
                                {canDelete && <button onClick={() => handleDeleteUser(u.id)} style={{...S.btnDanger, padding:"5px 8px"}}><Trash2 size={11}/></button>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>
        )}

        {/* ========== API設定 ========== */}
        {tab === "apikeys" && (
          <div style={S.card}>
            <div style={S.cardTitle}><Key size={18} color="#6366f1"/> グローバルAPI設定</div>
            <ApiKeySection apiKeys={apiKeys} onRefresh={loadData}/>
          </div>
        )}

        {/* ========== 統計 ========== */}
        {tab === "stats" && (
          <div style={S.card}>
            <div style={S.cardTitle}><BarChart3 size={18} color="#6366f1"/> 使用統計</div>
            <UsageStats stores={stores} companies={companiesList}/>
          </div>
        )}

        {/* ========== ロール管理 ========== */}
        {tab === "roles" && (
          <div style={S.card}>
            <div style={S.cardTitle}><Settings size={18} color="#6366f1"/> ロール管理</div>
            <RolePanel onRefresh={loadData}/>
          </div>
        )}

        {/* ========== SOAPテンプレート ========== */}
        {tab === "templates" && (
          <div style={S.card}>
            <div style={S.cardTitle}><FileText size={18} color="#6366f1"/> SOAPテンプレート管理</div>
            <SoapTemplatePanel companies={companiesList} stores={stores}/>
          </div>
        )}

        {/* ========== 医薬品マスタ ========== */}
        {tab === "drugs" && (
          <div style={S.card}>
            <div style={S.cardTitle}><Pill size={18} color="#6366f1"/> 医薬品マスタ管理</div>
            <DrugMasterPanel/>
          </div>
        )}

        {/* ========== 診断 ========== */}
        {tab === "diag" && (
          <div style={S.card}>
            <div style={S.cardTitle}><Activity size={18} color="#6366f1"/> システム診断</div>
            <DiagPanel/>
          </div>
        )}

        {/* ========== 申請一覧 ========== */}

        {/* ========== 会社管理 ========== */}
        {tab === "company" && (
          <div style={S.card}>
            <div style={S.cardTitle}><Building2 size={18} color="#6366f1"/> 会社管理</div>
            <CompanyPanel onRefresh={loadData} />
          </div>
        )}
      </main>

      {/* Modals */}
      {showStoreForm !== null && (
        <StoreFormModal
          store={showStoreForm || null}
          companies={companiesList}
          onClose={() => setShowStoreForm(null)}
          onSave={() => { setShowStoreForm(null); loadData(); }}
        />
      )}
      {showUserAdd && (
        <UserAddModal
          companies={companiesList}
          onClose={() => setShowUserAdd(false)}
          onSave={() => { setShowUserAdd(false); loadData(); }}
        />
      )}
      {showUserEdit && (
        <UserEditModal
          user={showUserEdit}
          stores={stores}
          allStores={stores}
          roles={rolesList}
          companies={companiesList}
          myRole={userInfo.role}
          myRoleId={userInfo.role_id}
          myPermissions={myPermissions}
          onClose={() => setShowUserEdit(null)}
          onSave={() => { setShowUserEdit(null); loadData(); }}
        />
      )}
    </div>
  );
}
