// voice-yakureki v5.8.0 App.jsx — 全機能統合版（修正版）
import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, Loader2, X, RotateCcw, Upload, FileAudio, List, ArrowLeft, Trash2, Clock, Check, Sparkles, ChevronDown, LogOut, User, Shield, Building2, Download, Search, AlertTriangle } from "lucide-react";
import { saveRecord, getRecords, updateRecord, deleteRecord, signIn, signOut, getSession, onAuthChange, supabase, getUserInfo, getApiKey, logUsage, loadDrugMaster, correctDrugNames } from "./supabase";
import Admin from "./Admin.jsx";

const APP_VERSION = "5.8.0";
const ST = { IDLE:"idle", REC:"rec", PROCESSING:"processing" };
const ACCEPT = ".mp3,.wav,.webm,.ogg,.m4a,.aac,.flac,.mp4,.mpeg,.mpga";

const SOAP_KEYS = [
  { key:"soap_s", apiKey:"S", label:"S", shortcut:"##S##", full:"主観的情報", color:"#059669" },
  { key:"soap_o", apiKey:"O", label:"O", shortcut:"##O##", full:"客観的情報", color:"#2563eb" },
  { key:"soap_a", apiKey:"A", label:"A", shortcut:"##A##", full:"評価", color:"#d97706" },
  { key:"soap_ep", apiKey:"EP", label:"EP", shortcut:"##EP##", full:"教育計画", color:"#7c3aed" },
  { key:"soap_cp", apiKey:"CP", label:"CP", shortcut:"##CP##", full:"ケアプラン", color:"#db2777" },
  { key:"soap_op", apiKey:"OP", label:"OP", shortcut:"##OP##", full:"観察計画", color:"#0891b2" },
  { key:"soap_p", apiKey:"P", label:"P", shortcut:"##P##", full:"計画", color:"#ea580c" },
  { key:"soap_q", apiKey:null, label:"問", shortcut:"##問##", full:"問い合わせ", color:"#475569" },
  { key:"soap_other", apiKey:null, label:"その他", shortcut:"##その他##", full:"その他", color:"#6b7280" },
  { key:"soap_highrisk", apiKey:null, label:"ハイリスク", shortcut:"##ハイリスク##", full:"ハイリスク薬", color:"#dc2626" },
];
const TEMPLATES = {soap_a:["コンプライアンス良好","服薬状況良好","副作用なし","残薬なし"],soap_ep:["用法用量の説明済み","副作用の説明済み"],soap_p:["経過観察","次回来局時に確認","処方医へ情報提供"],soap_cp:["残薬調整","一包化の提案"],soap_op:["次回血圧確認","副作用モニタリング"]};

function fmtT(s){return`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;}
function fmtDate(d){const dt=new Date(d);return`${dt.getMonth()+1}/${dt.getDate()} ${dt.getHours()}:${String(dt.getMinutes()).padStart(2,"0")}`;}
function daysLeft(e){if(!e)return null;const d=Math.ceil((new Date(e)-Date.now())/86400000);return d>0?d:0;}
function ts(){return new Date().toLocaleTimeString("ja-JP");}
function buildMusubiText(soap){return SOAP_KEYS.filter(s=>soap[s.key]?.trim()).map(s=>s.shortcut+"\n"+soap[s.key].trim()).join("\n");}
function buildDisplayText(soap){return SOAP_KEYS.filter(s=>soap[s.key]?.trim()).map(s=>`${s.label}: ${soap[s.key].trim()}`).join("\n");}

function toWav16k(buf){const t=16000,s=buf.getChannelData(0),r=buf.sampleRate/t,l=Math.floor(s.length/r),a=new ArrayBuffer(44+l*2),v=new DataView(a);const w=(o,x)=>{for(let i=0;i<x.length;i++)v.setUint8(o+i,x.charCodeAt(i));};w(0,"RIFF");v.setUint32(4,36+l*2,true);w(8,"WAVE");w(12,"fmt ");v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,t,true);v.setUint32(28,t*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,"data");v.setUint32(40,l*2,true);let o=44;for(let i=0;i<l;i++){const idx=Math.min(Math.floor(i*r),s.length-1),x=Math.max(-1,Math.min(1,s[idx]));v.setInt16(o,x<0?x*0x8000:x*0x7FFF,true);o+=2;}return new Blob([a],{type:"audio/wav"});}
async function decodeBlob(b){const a=await b.arrayBuffer(),c=new AudioContext(),d=await c.decodeAudioData(a);c.close();return d;}
async function transcribeAudio(w,k){const f=new FormData();f.append("file",w,"recording.wav");f.append("model","whisper-large-v3-turbo");f.append("language","ja");const r=await fetch("https://api.groq.com/openai/v1/audio/transcriptions",{method:"POST",headers:{Authorization:`Bearer ${k}`},body:f});if(!r.ok){const t=await r.text();let m;try{m=JSON.parse(t).error?.message||t;}catch{m=t;}throw new Error(m);}return(await r.json()).text||"";}
async function classifySOAP(transcript,sessionToken){const headers={"Content-Type":"application/json"};if(sessionToken)headers["Authorization"]=`Bearer ${sessionToken}`;const r=await fetch("/api/soap",{method:"POST",headers,body:JSON.stringify({transcript})});const d=await r.json();if(!r.ok)throw new Error(d.error||`HTTP ${r.status}`);return d.soap;}

// ======================================
// ログイン画面
// ======================================
function LoginScreen({onLogin}){
  const[loginId,setLoginId]=useState(()=>{try{return localStorage.getItem("vy-login-id")||"";}catch{return"";}});
  const[pass,setPass]=useState("");
  const[loading,setLoading]=useState(false);const[err,setErr]=useState("");
  const[helpMode,setHelpMode]=useState(null);

  const handle=async()=>{
    const id=loginId.trim().toUpperCase();
    if(!id){setErr("店舗IDまたは管理者IDを入力してください");return;}
    if(!pass){setErr("パスワードを入力してください");return;}
    setLoading(true);setErr("");
    try{
      const email=`${id.toLowerCase()}@vy.internal`;
      await signIn(email,pass);
      try{localStorage.setItem("vy-login-id",id);}catch{}
      onLogin();
    }catch(e){
      const msg=e.message||"";
      if(msg.includes("Invalid login")||msg.includes("invalid_credentials")){
        setErr("IDまたはパスワードが正しくありません");
      }else{
        setErr(msg);
      }
    }
    setLoading(false);
  };

  const IS={width:"100%",padding:"10px 12px",border:"2px solid #e2e8f0",borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box",marginBottom:8};

  return(<div style={{minHeight:"100vh",background:"linear-gradient(168deg,#f0fdfa 0%,#f0f9ff 40%,#fafbfc 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Noto Sans JP',sans-serif"}}>
    <div style={{background:"#fff",borderRadius:20,padding:"32px 28px",width:"92%",maxWidth:380,boxShadow:"0 8px 32px rgba(0,0,0,.08)"}}>
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{width:48,height:48,borderRadius:14,background:"linear-gradient(135deg,#0d9488,#0f766e)",display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:10}}><Mic size={22} color="#fff"/></div>
        <div style={{fontSize:18,fontWeight:800,color:"#0f172a"}}>音声薬歴ツール</div>
        <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>v{APP_VERSION}</div>
      </div>
      <div style={{marginBottom:12}}>
        <label style={{fontSize:11,fontWeight:700,color:"#475569",display:"block",marginBottom:4}}>店舗ID / 管理者ID</label>
        <input value={loginId} onChange={e=>setLoginId(e.target.value)} placeholder="例: YK-A3B7X2" autoComplete="username" style={{...IS,fontSize:15,fontWeight:700,fontFamily:"monospace",letterSpacing:2,textTransform:"uppercase"}}/>
      </div>
      <div style={{marginBottom:14}}>
        <label style={{fontSize:11,fontWeight:700,color:"#475569",display:"block",marginBottom:4}}>パスワード</label>
        <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="パスワード" autoComplete="current-password" onKeyDown={e=>e.key==="Enter"&&handle()} style={{...IS,marginBottom:4}}/>
      </div>
      {err&&<div style={{fontSize:11,color:"#dc2626",marginBottom:8,padding:"6px 10px",background:"#fef2f2",borderRadius:8,lineHeight:1.6}}>{err}</div>}
      <button onClick={handle} disabled={loading||!loginId.trim()||!pass} style={{width:"100%",padding:"10px",background:loading?"#94a3b8":"linear-gradient(135deg,#0d9488,#0f766e)",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:loading?"wait":"pointer"}}>
        {loading?<Loader2 size={16} style={{animation:"spin 1s linear infinite"}}/>:"ログイン"}
      </button>
      <div style={{display:"flex",justifyContent:"center",gap:16,marginTop:12}}>
        <button onClick={()=>setHelpMode(helpMode==="id"?null:"id")} style={{background:"none",border:"none",fontSize:11,color:"#6366f1",cursor:"pointer",textDecoration:"underline"}}>IDを忘れた</button>
        <button onClick={()=>setHelpMode(helpMode==="pass"?null:"pass")} style={{background:"none",border:"none",fontSize:11,color:"#6366f1",cursor:"pointer",textDecoration:"underline"}}>パスワードを忘れた</button>
      </div>
      {helpMode==="id"&&<div style={{marginTop:10,padding:"12px 14px",background:"#f0f9ff",borderRadius:10,border:"1px solid #bfdbfe"}}>
        <div style={{fontSize:12,fontWeight:700,color:"#1e40af",marginBottom:6}}>店舗IDを検索</div>
        <div style={{fontSize:10,color:"#64748b"}}>管理者に発行された店舗IDをご確認ください。管理画面の店舗一覧に表示されています。</div>
      </div>}
      {helpMode==="pass"&&<div style={{marginTop:10,padding:"12px 14px",background:"#fef3c7",borderRadius:10,border:"1px solid #fde68a"}}>
        <div style={{fontSize:12,fontWeight:700,color:"#92400e",marginBottom:6}}>パスワードリセット</div>
        <div style={{fontSize:10,color:"#64748b"}}>管理者にお問い合わせください。管理画面からパスワードのリセットが可能です。</div>
      </div>}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  </div>);
}

// ======================================
// 小コンポーネント
// ======================================
function Wave({active,level}){return(<div style={{display:"flex",alignItems:"center",gap:2,height:48,justifyContent:"center"}}>{Array.from({length:36}).map((_,i)=>{const h=active?8+(level||.3)*40+Math.sin(Date.now()/200+i)*8:4;return<div key={i} style={{width:2.5,borderRadius:2,background:active?`hsl(${165+i*2},60%,${40+Math.sin(i*.4)*12}%)`:"#d1d5db",height:`${Math.max(4,h)}px`,transition:active?"height 0.1s":"height 0.4s"}}/>;})}</div>);}
function TemplatePicker({soapKey,onInsert,dbTemplates}){const[open,setOpen]=useState(false);const hardcoded=TEMPLATES[soapKey]||[];const dbItems=(dbTemplates||[]).filter(t=>t.soap_field===soapKey).map(t=>t.template_text);const all=[...dbItems,...hardcoded.filter(h=>!dbItems.includes(h))];if(all.length===0)return null;return(<div style={{position:"relative"}}><button onClick={()=>setOpen(!open)} style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"2px 6px",fontSize:9,color:"#64748b",cursor:"pointer",display:"flex",alignItems:"center",gap:2}}><ChevronDown size={10}/>定型文</button>{open&&<div style={{position:"absolute",top:24,right:0,background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,boxShadow:"0 4px 12px rgba(0,0,0,.1)",zIndex:20,minWidth:200,maxHeight:200,overflow:"auto",padding:4}}>{all.map((t,i)=><div key={i} onClick={()=>{onInsert(t);setOpen(false);}} style={{padding:"6px 10px",fontSize:11,color:"#334155",cursor:"pointer",borderRadius:4,whiteSpace:"pre-wrap",lineHeight:1.5}} onMouseEnter={e=>e.target.style.background="#f0fdfa"} onMouseLeave={e=>e.target.style.background="transparent"}>{t.length>60?t.slice(0,60)+"…":t}</div>)}</div>}</div>);}
function ProcessLog({logs}){if(logs.length===0)return null;return(<div style={{background:"#f8fafc",borderRadius:10,padding:"10px 12px",marginBottom:12,border:"1px solid #e2e8f0"}}><div style={{fontSize:10,fontWeight:700,color:"#94a3b8",marginBottom:4}}>処理ログ</div>{logs.map((l,i)=><div key={i} style={{fontSize:11,padding:"2px 0",color:l.status==="error"?"#dc2626":l.status==="ok"?"#059669":"#475569"}}><span style={{color:"#94a3b8",marginRight:4}}>{l.time}</span>{l.status==="ok"?"✅":l.status==="error"?"❌":"⏳"} {l.msg}</div>)}</div>);}

// ======================================
// レコード詳細（SOAP編集）
// ======================================
function RecordDetail({record,onBack,onUpdate,onDelete,initialSoap,storeId,companyId}){
  const[soap,setSoap]=useState(()=>{const b=Object.fromEntries(SOAP_KEYS.map(s=>[s.key,record[s.key]||""]));if(initialSoap){for(const sk of SOAP_KEYS){if(sk.apiKey&&initialSoap[sk.apiKey]&&!b[sk.key])b[sk.key]=initialSoap[sk.apiKey];}}return b;});
  const[saving,setSaving]=useState(false);const[msg,setMsg]=useState("");
  const[dbTemplates,setDbTemplates]=useState([]);

  useEffect(()=>{const b=Object.fromEntries(SOAP_KEYS.map(s=>[s.key,record[s.key]||""]));if(initialSoap){for(const sk of SOAP_KEYS){if(sk.apiKey&&initialSoap[sk.apiKey]&&!b[sk.key])b[sk.key]=initialSoap[sk.apiKey];}}setSoap(b);},[record.id]);

  // テンプレートをDBから読み込み
  useEffect(()=>{(async()=>{
    try{
      const{data}=await supabase.from("soap_templates").select("*").eq("is_active",true).order("sort_order");
      const filtered=(data||[]).filter(t=>
        (!t.company_id && !t.store_id) ||
        (t.company_id===companyId && !t.store_id) ||
        (t.store_id===storeId)
      );
      setDbTemplates(filtered);
    }catch(e){console.error("Template load:",e);}
  })();},[storeId,companyId]);

  const handleSaveAndCopy=async()=>{
    setSaving(true);setMsg("");
    try{
      await onUpdate(record.id,soap);
      const mt=buildMusubiText(soap);
      if(mt){await navigator.clipboard.writeText(mt);setMsg("✅ 保存＋Musubiコピー完了");}
      else setMsg("✅ 保存しました");
    }catch(e){setMsg("❌ "+e.message);}
    setSaving(false);setTimeout(()=>setMsg(""),3000);
  };

  return(<div>
    <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:4,background:"none",border:"none",fontSize:12,color:"#64748b",fontWeight:700,cursor:"pointer",marginBottom:12,padding:0}}><ArrowLeft size={14}/> 戻る</button>
    <div style={{background:"#fff",borderRadius:16,padding:"16px 18px",border:"1px solid #e8ecf0",marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
        <span style={{fontSize:14,fontWeight:800,color:"#0f172a"}}>SOAP編集</span>
        {record.patient_name&&<span style={{fontSize:10,fontWeight:700,color:"#0d9488",background:"#ecfdf5",padding:"1px 6px",borderRadius:4}}>{record.patient_name}</span>}
        <div style={{flex:1}}/>
        <span style={{fontSize:10,color:"#94a3b8"}}>{fmtDate(record.created_at)}</span>
      </div>
      {record.transcript&&<div style={{fontSize:12,color:"#64748b",lineHeight:1.8,marginBottom:12,padding:"8px 10px",background:"#f8fafb",borderRadius:8,maxHeight:100,overflow:"auto"}}>{record.transcript}</div>}

      {SOAP_KEYS.map(s=>(<div key={s.key} style={{marginBottom:10}}><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><span style={{fontSize:12,fontWeight:800,color:s.color,width:50}}>{s.label}</span><span style={{fontSize:10,color:"#94a3b8",flex:1}}>{s.full}</span><TemplatePicker soapKey={s.key} onInsert={t=>setSoap(p=>({...p,[s.key]:p[s.key]?p[s.key]+"\n"+t:t}))} dbTemplates={dbTemplates}/></div><textarea value={soap[s.key]} onChange={e=>setSoap(p=>({...p,[s.key]:e.target.value}))} placeholder={`${s.full}...`} rows={2} style={{width:"100%",padding:"8px 10px",border:`1px solid ${s.color}30`,borderRadius:8,fontSize:12,outline:"none",resize:"vertical",fontFamily:"inherit",boxSizing:"border-box",lineHeight:1.7}}/></div>))}

      <button onClick={handleSaveAndCopy} disabled={saving} style={{width:"100%",padding:"10px",background:"linear-gradient(135deg,#0d9488,#0f766e)",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>{saving?<Loader2 size={14} style={{animation:"spin 1s linear infinite"}}/>:<><Check size={14}/> 保存＋Musubiコピー</>}</button>
      {msg&&<div style={{marginTop:8,fontSize:12,color:msg.startsWith("✅")?"#059669":"#dc2626",fontWeight:600,textAlign:"center"}}>{msg}</div>}
    </div>
    {buildDisplayText(soap)&&(<div style={{background:"#f0fdfa",borderRadius:12,padding:"12px 16px",border:"1px solid #ccfbf1",marginBottom:12}}><div style={{fontSize:11,fontWeight:700,color:"#065f46",marginBottom:6}}>Musubiプレビュー</div><pre style={{margin:0,fontSize:12,color:"#334155",lineHeight:1.8,whiteSpace:"pre-wrap",fontFamily:"inherit"}}>{buildDisplayText(soap)}</pre></div>)}
    <button onClick={()=>{if(confirm("削除しますか？"))onDelete(record.id);}} style={{width:"100%",padding:"8px",background:"#fff",color:"#ef4444",border:"1px solid #fecaca",borderRadius:10,fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}><Trash2 size={12}/> 削除</button>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>);
}

// ======================================
// メインApp
// ======================================
export default function App(){
  const[session,setSession]=useState(undefined);const[page,setPage]=useState(()=>window.location.hash==="#admin"?"admin":"app");
  const[view,setView]=useState("mic");const[state,setState]=useState(ST.IDLE);const[elapsed,setElapsed]=useState(0);
  const[audioLevel,setAudioLevel]=useState(0);const[processingMsg,setProcessingMsg]=useState("");const[result,setResult]=useState("");const[error,setError]=useState("");
  const[records,setRecords]=useState([]);const[selectedRecord,setSelectedRecord]=useState(null);const[loadingRecords,setLoadingRecords]=useState(false);
  const[savedId,setSavedId]=useState(null);const[aiSoap,setAiSoap]=useState(null);const[procLog,setProcLog]=useState([]);const[patientName,setPatientName]=useState("");
  const[userInfo,setUserInfo]=useState(null);const[currentStore,setCurrentStore]=useState(null);const[apiKey,setApiKey]=useState("");
  const[initError,setInitError]=useState("");
  const[deferredPrompt,setDeferredPrompt]=useState(null);const[showInstall,setShowInstall]=useState(false);
  const recRef=useRef(null);const chunksRef=useRef([]);const timerRef=useRef(null);const streamRef=useRef(null);const analyserRef=useRef(null);const levelRef=useRef(null);const fileRef=useRef(null);
  const addProcLog=(msg,status)=>setProcLog(p=>[...p,{time:ts(),msg,status}]);
  const isAdmin=userInfo?.role==="super_admin"||userInfo?.role==="store_admin";

  // Auth
  useEffect(()=>{getSession().then(s=>setSession(s));const{data}=onAuthChange(s=>setSession(s));return()=>data.subscription.unsubscribe();},[]);

  // ★ ログイン後の初期化（修正版: エラー時に永久ローディングにならない）
  useEffect(()=>{if(!session?.user)return;(async()=>{
    setInitError("");
    try{
      const uid=session.user.id;
      const meta=session.user.user_metadata||{};
      const loginType=meta.type;

      // 管理者アカウント
      if(loginType==="admin"){
        const{data:adminAcc}=await supabase.from("admin_accounts").select("*").eq("auth_user_id",uid).maybeSingle();
        if(adminAcc){
          setUserInfo({id:uid,email:session.user.email,role:adminAcc.role||"super_admin",company_id:adminAcc.company_id,display_name:adminAcc.display_name,is_approved:true});
          setPage("admin");
          return;
        }
      }

      // 店舗アカウント
      if(loginType==="store"){
        const{data:store}=await supabase.from("stores").select("id,name,name_kana,company_id").eq("auth_user_id",uid).maybeSingle();
        if(store){
          setCurrentStore(store);
          setUserInfo({id:uid,email:session.user.email,role:"pharmacist",company_id:store.company_id,display_name:store.name,is_approved:true});
          return;
        }
        // ★ 店舗が見つからない場合: エラーを表示（永久ローディング防止）
        setInitError("店舗情報が見つかりません。管理者にお問い合わせください。");
        setUserInfo({id:uid,email:session.user.email||"",role:"pharmacist",is_approved:true});
        return;
      }

      // 旧方式フォールバック
      if(session.user.email){
        const info=await getUserInfo(session.user.email);
        if(info){
          setUserInfo(info);
          if(info.role==="super_admin"){setPage("admin");return;}
          if(info.user_stores?.[0]?.stores){setCurrentStore(info.user_stores[0].stores);return;}
        }
      }

      // 何も見つからない場合
      setInitError("アカウント情報の読み込みに失敗しました。");
      setUserInfo({id:uid,email:session.user.email||"",role:"pharmacist",is_approved:true});
    }catch(e){
      console.error("Init error:",e);
      setInitError(`初期化エラー: ${e.message}`);
      setUserInfo({id:session.user.id,email:session.user.email||"",role:"pharmacist",is_approved:true});
    }
  })();},[session]);

  // API key
  useEffect(()=>{if(!currentStore)return;(async()=>{try{const key=await getApiKey("groq",currentStore.id);setApiKey(key);}catch(e){console.error("API key load error:",e);}})();},[currentStore]);
  // Hash routing
  useEffect(()=>{const h=()=>setPage(window.location.hash==="#admin"?"admin":"app");window.addEventListener("hashchange",h);return()=>window.removeEventListener("hashchange",h);},[]);
  // Session timeout (8時間)
  useEffect(()=>{if(!session)return;const SESSION_TIMEOUT=8*60*60*1000;const checkTimeout=()=>{const lastActivity=parseInt(localStorage.getItem("vy-last-activity")||"0");if(lastActivity&&Date.now()-lastActivity>SESSION_TIMEOUT){signOut().then(()=>{setSession(null);setUserInfo(null);setCurrentStore(null);}).catch(()=>{});}};const updateActivity=()=>{localStorage.setItem("vy-last-activity",Date.now().toString());};updateActivity();const events=["click","keydown","touchstart"];events.forEach(e=>window.addEventListener(e,updateActivity,{passive:true}));const timer=setInterval(checkTimeout,60000);return()=>{events.forEach(e=>window.removeEventListener(e,updateActivity));clearInterval(timer);};},[session]);
  // Timer
  useEffect(()=>{if(state===ST.REC){setElapsed(0);timerRef.current=setInterval(()=>setElapsed(p=>p+1),1000);}else clearInterval(timerRef.current);return()=>clearInterval(timerRef.current);},[state]);
  // PWA
  useEffect(()=>{const h=e=>{e.preventDefault();setDeferredPrompt(e);setShowInstall(true);};window.addEventListener("beforeinstallprompt",h);return()=>window.removeEventListener("beforeinstallprompt",h);},[]);
  const handleInstall=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;setShowInstall(false);setDeferredPrompt(null);};

  const startLevel=useCallback(stream=>{try{const c=new AudioContext(),s=c.createMediaStreamSource(stream),a=c.createAnalyser();a.fftSize=256;s.connect(a);analyserRef.current={ctx:c,analyser:a};const d=new Uint8Array(a.frequencyBinCount);const t=()=>{a.getByteFrequencyData(d);setAudioLevel(d.reduce((a,b)=>a+b,0)/d.length/255);levelRef.current=requestAnimationFrame(t);};t();}catch(e){}},[]);
  const stopLevel=useCallback(()=>{if(levelRef.current)cancelAnimationFrame(levelRef.current);if(analyserRef.current?.ctx)analyserRef.current.ctx.close().catch(()=>{});setAudioLevel(0);},[]);
  const loadRecords=useCallback(async()=>{setLoadingRecords(true);try{setRecords(await getRecords(30,currentStore?.id));}catch(e){console.error("loadRecords:",e);}setLoadingRecords(false);},[currentStore]);
  useEffect(()=>{if(view==="list"&&currentStore)loadRecords();},[view,loadRecords,currentStore]);

  // ★ processAudio: エラーハンドリング強化
  const processAudio=useCallback(async blob=>{
    if(!apiKey){setError("APIキーが未設定です。管理者に連絡してください。\n管理画面 → API設定 でGroqキーを登録してください。");setState(ST.IDLE);return;}
    setState(ST.PROCESSING);setResult("");setError("");setSavedId(null);setAiSoap(null);setProcLog([]);

    // 1. デコード
    addProcLog("音声デコード中...","pending");
    let decoded,dur;
    try{decoded=await decodeBlob(blob);dur=Math.round(decoded.duration);addProcLog(`デコード完了 (${dur}秒)`,"ok");}
    catch(e){addProcLog("デコード失敗: "+e.message,"error");setError("音声デコード失敗: "+e.message);setState(ST.IDLE);return;}

    // 2. WAV変換
    addProcLog("WAV変換中...","pending");
    let wav;
    try{wav=toWav16k(decoded);addProcLog("WAV変換完了","ok");}
    catch(e){addProcLog("WAV変換失敗","error");setError("WAV変換失敗: "+e.message);setState(ST.IDLE);return;}

    // 3. 文字起こし
    setProcessingMsg("文字起こし中...");addProcLog("Groq送信中...","pending");
    let text;
    try{text=await transcribeAudio(wav,apiKey);if(!text)throw new Error("文字起こし結果が空です");addProcLog(`文字起こし完了 (${text.length}文字)`,"ok");}
    catch(e){addProcLog("文字起こし失敗: "+e.message,"error");setError("文字起こし失敗: "+e.message);setState(ST.IDLE);setProcessingMsg("");return;}
    setResult(text);

    // 4. 医薬品名補正
    setProcessingMsg("医薬品名補正中...");
    try{
      const drugs=await loadDrugMaster();
      if(drugs.length>0){const{text:corrected,corrections}=correctDrugNames(text,drugs);if(corrections.length>0){text=corrected;setResult(corrected);addProcLog(`医薬品名補正 ${corrections.length}件`,"ok");}else{addProcLog("医薬品名補正 変更なし","ok");}}
      else{addProcLog("医薬品マスタ未登録（スキップ）","ok");}
    }catch(e){addProcLog("医薬品名補正スキップ","ok");}

    // 5. 保存 ★ エラーを明示的に表示
    setProcessingMsg("保存中...");
    let recId;
    try{
      const rec=await saveRecord(text,dur,patientName,currentStore?.id,userInfo?.id);
      recId=rec.id;setSavedId(rec.id);addProcLog("保存完了","ok");
      logUsage("transcription",currentStore?.id,userInfo?.id,dur);
    }catch(e){
      addProcLog("保存失敗: "+e.message,"error");
      setError(prev=>prev?prev+"\n⚠️ 保存失敗: "+e.message:"⚠️ 保存失敗: "+e.message);
    }

    // 6. AI SOAP分類
    setProcessingMsg("AI SOAP分類中...");
    try{
      const accessToken=session?.access_token||"";
      const soap=await classifySOAP(text,accessToken);
      if(soap&&!soap.parseError){
        setAiSoap(soap);addProcLog("SOAP分類完了","ok");
        logUsage("soap_classify",currentStore?.id,userInfo?.id);
        // 保存済みレコードにSOAPを書き込み
        if(recId){
          const sd={};for(const sk of SOAP_KEYS){if(sk.apiKey&&soap[sk.apiKey])sd[sk.key]=soap[sk.apiKey];}
          if(Object.keys(sd).length>0){try{await updateRecord(recId,sd);addProcLog("SOAP保存完了","ok");}catch(e){addProcLog("SOAP保存失敗: "+e.message,"error");}}
        }
      }else{addProcLog("SOAP分類: パースエラー","error");}
    }catch(e){addProcLog("SOAP分類失敗: "+e.message,"error");}

    addProcLog("完了","ok");setState(ST.IDLE);setProcessingMsg("");
  },[apiKey,patientName,currentStore,userInfo,session]);

  const startRec=useCallback(async()=>{
    try{setError("");setResult("");setSavedId(null);setAiSoap(null);setProcLog([]);chunksRef.current=[];
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,sampleRate:44100}});
    streamRef.current=stream;startLevel(stream);
    const mr=new MediaRecorder(stream,{mimeType:"audio/webm;codecs=opus"});
    mr.ondataavailable=e=>{if(e.data.size>0)chunksRef.current.push(e.data);};
    mr.start(500);recRef.current=mr;setState(ST.REC);}
    catch(e){setError(e.name==="NotAllowedError"?"マイクアクセスが拒否されました。ブラウザの設定からマイクを許可してください。":`マイクエラー: ${e.message}`);}
  },[startLevel]);

  const stopRec=useCallback(async()=>{if(!recRef.current)return;recRef.current.stop();streamRef.current?.getTracks().forEach(t=>t.stop());stopLevel();await new Promise(r=>{recRef.current.onstop=r;});await processAudio(new Blob(chunksRef.current,{type:"audio/webm"}));},[processAudio,stopLevel]);
  const handleFile=useCallback(async f=>{if(!f)return;if(!f.type.startsWith("audio/")&&!f.type.startsWith("video/")){setError(`非対応: ${f.type}`);return;}await processAudio(f);},[processAudio]);
  const reset=()=>{setResult("");setError("");setSavedId(null);setAiSoap(null);setProcLog([]);setElapsed(0);setView("mic");};
  const handleUpdateRecord=async(id,d)=>{const u=await updateRecord(id,d);setRecords(p=>p.map(r=>r.id===id?u:r));setSelectedRecord(u);};
  const handleDeleteRecord=async id=>{await deleteRecord(id);setRecords(p=>p.filter(r=>r.id!==id));setSelectedRecord(null);setView("list");};
  const isRec=state===ST.REC;const isBusy=state===ST.PROCESSING;const hasResult=result||error;

  const doLogout=async()=>{await signOut().catch(()=>{});setSession(null);setUserInfo(null);setCurrentStore(null);setInitError("");};

  // ルーティング
  if(session===undefined)return<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}><Loader2 size={28} style={{animation:"spin 1s linear infinite",color:"#0d9488"}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;
  if(!session)return<LoginScreen onLogin={()=>{}}/>;
  if(page==="admin"){
    const isAdminAccount = userInfo?.role === "super_admin" || session?.user?.user_metadata?.type === "admin";
    return<Admin session={session} onBack={isAdminAccount ? async()=>{await doLogout();setPage("app");} : ()=>{window.location.hash="";setPage("app");}}/>;
  }

  // ★ 修正: 永久ローディング防止。エラーがあればメッセージ表示+ログアウトボタン
  if(!userInfo)return<div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,fontFamily:"sans-serif"}}><Loader2 size={28} style={{animation:"spin 1s linear infinite",color:"#0d9488"}}/><div style={{fontSize:12,color:"#94a3b8"}}>読み込み中...</div><button onClick={doLogout} style={{marginTop:16,padding:"8px 20px",background:"#f1f5f9",color:"#64748b",border:"none",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer"}}>ログアウト</button><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;
  if(!currentStore)return<div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,fontFamily:"'Noto Sans JP',sans-serif",padding:20}}>
    <AlertTriangle size={36} color="#d97706"/>
    <div style={{fontSize:16,fontWeight:800,color:"#0f172a"}}>店舗情報が見つかりません</div>
    <div style={{fontSize:12,color:"#64748b",textAlign:"center",lineHeight:1.8,maxWidth:300}}>
      {initError||"店舗の紐付けが完了していません。管理者に連絡して、店舗アカウントの設定を確認してください。"}
    </div>
    <button onClick={doLogout} style={{marginTop:16,padding:"10px 28px",background:"linear-gradient(135deg,#ef4444,#dc2626)",color:"#fff",border:"none",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer"}}>ログアウト</button>
  </div>;

  // ======================================
  // メイン画面
  // ======================================
  return(<div style={{minHeight:"100vh",background:"linear-gradient(168deg,#f0fdfa 0%,#f0f9ff 40%,#fafbfc 100%)",fontFamily:"'Noto Sans JP','Hiragino Sans',sans-serif"}}>
    <header style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"0 16px",position:"sticky",top:0,zIndex:50,boxShadow:"0 1px 4px rgba(0,0,0,.03)"}}>
      <div style={{maxWidth:680,margin:"0 auto",display:"flex",alignItems:"center",height:46}}>
        <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,#0d9488,#0f766e)",display:"flex",alignItems:"center",justifyContent:"center",marginRight:8}}><Mic size={14} color="#fff"/></div>
        <div style={{fontSize:14,fontWeight:800,color:"#0f172a"}}>音声薬歴</div>
        <div style={{flex:1}}/>
        {isAdmin&&<button onClick={()=>{window.location.hash="#admin";setPage("admin");}} style={{background:"linear-gradient(135deg,#6366f1,#4f46e5)",border:"none",borderRadius:8,width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",marginLeft:4}} title="管理画面"><Shield size={14} color="#fff"/></button>}
        <button onClick={doLogout} style={{background:"#fef2f2",border:"none",borderRadius:8,width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",marginLeft:4}} title="ログアウト"><LogOut size={14} color="#ef4444"/></button>
      </div>
    </header>
    <div style={{background:"linear-gradient(135deg,#f0fdfa,#ecfeff)",borderBottom:"1px solid #ccfbf1",padding:"8px 16px"}}>
      <div style={{maxWidth:680,margin:"0 auto",display:"flex",alignItems:"center",gap:8}}>
        <Building2 size={16} color="#0d9488"/>
        <span style={{fontSize:13,fontWeight:800,color:"#0f766e"}}>{currentStore?.name||"店舗未設定"}</span>
      </div>
    </div>

    <main style={{maxWidth:680,margin:"0 auto",padding:"16px 14px 80px"}}>
      <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {showInstall&&<div style={{background:"linear-gradient(135deg,#6366f1,#4f46e5)",borderRadius:12,padding:"12px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:10}}><Download size={18} color="#fff"/><div style={{flex:1}}><div style={{fontSize:12,fontWeight:700,color:"#fff"}}>ホーム画面に追加</div><div style={{fontSize:10,color:"#c7d2fe"}}>アプリとしてすぐ起動できます</div></div><button onClick={handleInstall} style={{background:"#fff",color:"#4f46e5",border:"none",borderRadius:8,padding:"6px 14px",fontSize:11,fontWeight:700,cursor:"pointer"}}>追加</button><button onClick={()=>setShowInstall(false)} style={{background:"none",border:"none",cursor:"pointer"}}><X size={16} color="#c7d2fe"/></button></div>}

      {/* APIキー未設定警告 */}
      {!apiKey&&!isBusy&&view==="mic"&&<div style={{background:"#fef3c7",border:"1px solid #fde68a",borderRadius:12,padding:"12px 16px",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><AlertTriangle size={14} color="#d97706"/><span style={{fontSize:12,fontWeight:700,color:"#92400e"}}>APIキー未設定</span></div>
        <div style={{fontSize:11,color:"#78350f",lineHeight:1.6}}>管理画面 → API設定 で Groq APIキーを登録してください。録音はできますが、文字起こしは動作しません。</div>
      </div>}

      {/* 3タブ */}
      {view!=="detail"&&<div style={{display:"flex",gap:4,marginBottom:14,background:"#f1f5f9",borderRadius:12,padding:4}}>
        {[{id:"mic",label:"マイク録音",icon:<Mic size={14}/>},{id:"list",label:"履歴",icon:<List size={14}/>},{id:"file",label:"ファイル読込",icon:<Upload size={14}/>}].map(m=>
          <button key={m.id} onClick={()=>{if(!isBusy&&!isRec)setView(m.id);}} disabled={isBusy||isRec} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"9px 0",borderRadius:10,border:"none",fontSize:12,fontWeight:700,cursor:isBusy||isRec?"not-allowed":"pointer",background:view===m.id?"#fff":"transparent",color:view===m.id?"#0f172a":"#94a3b8",boxShadow:view===m.id?"0 1px 3px rgba(0,0,0,.06)":"none",transition:"all 0.15s"}}>{m.icon}{m.label}</button>
        )}
      </div>}

      {/* マイク録音タブ */}
      {view==="mic"&&(<>
        <div style={{background:"#fff",borderRadius:16,padding:"20px 18px",boxShadow:"0 1px 10px rgba(0,0,0,.04)",border:"1px solid #e8ecf0",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,padding:"8px 10px",background:"#f8fafb",borderRadius:10,border:"1px solid #e8ecf0"}}><User size={15} color="#0d9488"/><input value={patientName} onChange={e=>setPatientName(e.target.value)} placeholder="患者名（ひらがな）" style={{flex:1,border:"none",outline:"none",fontSize:13,fontWeight:600,color:"#0f172a",background:"transparent"}}/>{patientName&&<button onClick={()=>setPatientName("")} style={{background:"#e2e8f0",border:"none",borderRadius:6,width:20,height:20,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><X size={10} color="#64748b"/></button>}</div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}><div style={{width:9,height:9,borderRadius:"50%",background:isRec?"#ef4444":isBusy?"#d97706":result?"#059669":"#94a3b8",animation:isRec?"pulse 1.2s ease-in-out infinite":"none"}}/><span style={{fontSize:13,fontWeight:700,color:"#475569"}}>{isRec?`録音中 — ${fmtT(elapsed)}`:isBusy?processingMsg:result?"変換完了":"マイクで録音"}</span><div style={{flex:1}}/>{hasResult&&!isRec&&!isBusy&&<button onClick={reset} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"4px 10px",fontSize:10,color:"#64748b",fontWeight:700,cursor:"pointer"}}><RotateCcw size={10}/> リセット</button>}</div>
          <div style={{background:isRec?"#fef2f2":"#f8fafb",borderRadius:12,padding:"12px 14px",marginBottom:14,border:isRec?"1px solid #fecaca":"1px solid #e8ecf0"}}><Wave active={isRec} level={audioLevel}/></div>
          <div style={{display:"flex",justifyContent:"center"}}>{!isRec?<button onClick={startRec} disabled={isBusy} style={{background:isBusy?"#94a3b8":"linear-gradient(135deg,#0d9488,#0f766e)",color:"#fff",border:"none",borderRadius:14,padding:"12px 34px",fontSize:15,fontWeight:800,cursor:isBusy?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:8,boxShadow:isBusy?"none":"0 4px 16px rgba(13,148,136,.3)"}}>{isBusy?<><Loader2 size={17} style={{animation:"spin 1s linear infinite"}}/> {processingMsg}</>:<><Mic size={17}/> 録音開始</>}</button>:<button onClick={stopRec} style={{background:"linear-gradient(135deg,#ef4444,#dc2626)",color:"#fff",border:"none",borderRadius:14,padding:"12px 34px",fontSize:15,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",gap:8,boxShadow:"0 4px 16px rgba(239,68,68,.3)"}}><Square size={14} fill="#fff"/> 録音停止</button>}</div>
        </div>
        {error&&!isBusy&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:12,padding:"12px 16px",marginBottom:14}}><p style={{fontSize:12,color:"#991b1b",margin:0,whiteSpace:"pre-wrap"}}>{error}</p></div>}
        <ProcessLog logs={procLog}/>
        {result&&(<div style={{background:"#fff",borderRadius:12,padding:"16px 18px",border:"2px solid #99f6e4",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><span style={{fontSize:14,fontWeight:800,color:"#0f172a"}}>✓ 変換結果</span>{savedId&&<span style={{fontSize:9,color:"#059669",fontWeight:600}}>💾 保存済</span>}{patientName&&<span style={{fontSize:10,color:"#0d9488",fontWeight:700}}>{patientName}</span>}</div>
          <p style={{margin:0,fontSize:14,color:"#1e293b",lineHeight:2,whiteSpace:"pre-wrap"}}>{result}</p>
          {aiSoap&&!aiSoap.parseError&&(<div style={{marginTop:12,background:"#f0f9ff",borderRadius:10,padding:"12px 14px",border:"1px solid #bae6fd"}}><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><Sparkles size={14} color="#2563eb"/><span style={{fontSize:12,fontWeight:800,color:"#1e40af"}}>AI SOAP自動分類</span></div>{SOAP_KEYS.filter(sk=>sk.apiKey&&aiSoap[sk.apiKey]).map(sk=><div key={sk.key} style={{marginBottom:4}}><span style={{fontSize:11,fontWeight:800,color:sk.color}}>{sk.label}: </span><span style={{fontSize:12,color:"#334155"}}>{aiSoap[sk.apiKey]}</span></div>)}</div>)}
          {savedId&&<button onClick={async()=>{const rs=await getRecords(30,currentStore?.id);setRecords(rs);const r=rs.find(x=>x.id===savedId);if(r){setSelectedRecord(r);setView("detail");}}} style={{marginTop:10,width:"100%",padding:"9px",background:"linear-gradient(135deg,#6366f1,#4f46e5)",color:"#fff",border:"none",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>SOAP確認・編集 → Musubiコピー</button>}
        </div>)}
      </>)}

      {/* ファイル読込タブ */}
      {view==="file"&&(<div style={{background:"#fff",borderRadius:16,padding:"20px 18px",border:"1px solid #e8ecf0",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,padding:"8px 10px",background:"#f8fafb",borderRadius:10,border:"1px solid #e8ecf0"}}><User size={15} color="#0d9488"/><input value={patientName} onChange={e=>setPatientName(e.target.value)} placeholder="患者名（ひらがな）" style={{flex:1,border:"none",outline:"none",fontSize:13,fontWeight:600,color:"#0f172a",background:"transparent"}}/>{patientName&&<button onClick={()=>setPatientName("")} style={{background:"#e2e8f0",border:"none",borderRadius:6,width:20,height:20,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><X size={10} color="#64748b"/></button>}</div>
        {!isBusy&&!hasResult?<div onDrop={e=>{e.preventDefault();handleFile(e.dataTransfer.files?.[0]);}} onDragOver={e=>e.preventDefault()} onClick={()=>fileRef.current?.click()} style={{border:"2px dashed #d1d5db",borderRadius:14,padding:"32px 20px",textAlign:"center",cursor:"pointer"}}><input ref={fileRef} type="file" accept={ACCEPT} onChange={e=>{handleFile(e.target.files?.[0]);e.target.value="";}} style={{display:"none"}}/><FileAudio size={28} color="#94a3b8" style={{marginBottom:8}}/><div style={{fontSize:14,fontWeight:700,color:"#475569"}}>音声ファイルを選択</div></div>:isBusy?<div style={{textAlign:"center",padding:"30px 0"}}><Loader2 size={28} style={{animation:"spin 1s linear infinite",color:"#0d9488"}}/><div style={{fontSize:13,color:"#475569",fontWeight:600,marginTop:10}}>{processingMsg}</div></div>:null}
        {error&&!isBusy&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:12,padding:"12px 16px",marginTop:14}}><p style={{fontSize:12,color:"#991b1b",margin:0,whiteSpace:"pre-wrap"}}>{error}</p></div>}
        <ProcessLog logs={procLog}/>
        {result&&(<div style={{background:"#fff",borderRadius:12,padding:"16px 18px",border:"2px solid #99f6e4",marginTop:14}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><span style={{fontSize:14,fontWeight:800,color:"#0f172a"}}>✓ 変換結果</span>{savedId&&<span style={{fontSize:9,color:"#059669",fontWeight:600}}>💾 保存済</span>}</div>
          <p style={{margin:0,fontSize:14,color:"#1e293b",lineHeight:2,whiteSpace:"pre-wrap"}}>{result}</p>
          {aiSoap&&!aiSoap.parseError&&(<div style={{marginTop:12,background:"#f0f9ff",borderRadius:10,padding:"12px 14px",border:"1px solid #bae6fd"}}><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><Sparkles size={14} color="#2563eb"/><span style={{fontSize:12,fontWeight:800,color:"#1e40af"}}>AI SOAP自動分類</span></div>{SOAP_KEYS.filter(sk=>sk.apiKey&&aiSoap[sk.apiKey]).map(sk=><div key={sk.key} style={{marginBottom:4}}><span style={{fontSize:11,fontWeight:800,color:sk.color}}>{sk.label}: </span><span style={{fontSize:12,color:"#334155"}}>{aiSoap[sk.apiKey]}</span></div>)}</div>)}
          {savedId&&<button onClick={async()=>{const rs=await getRecords(30,currentStore?.id);setRecords(rs);const r=rs.find(x=>x.id===savedId);if(r){setSelectedRecord(r);setView("detail");}}} style={{marginTop:10,width:"100%",padding:"9px",background:"linear-gradient(135deg,#6366f1,#4f46e5)",color:"#fff",border:"none",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>SOAP確認・編集 → Musubiコピー</button>}
        </div>)}
      </div>)}

      {/* 履歴タブ */}
      {view==="list"&&(<div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}><div style={{fontSize:15,fontWeight:800,color:"#0f172a"}}>薬歴履歴</div><button onClick={loadRecords} disabled={loadingRecords} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"4px 10px",fontSize:10,color:"#64748b",fontWeight:700,cursor:"pointer"}}>{loadingRecords?"読込中...":"更新"}</button></div>
        <div style={{background:"#fef3c7",borderRadius:8,padding:"6px 10px",marginBottom:10,border:"1px solid #fde68a"}}><span style={{fontSize:10,color:"#92400e"}}>🕐 記録は7日後に自動削除</span></div>
        {loadingRecords&&records.length===0&&<div style={{textAlign:"center",padding:"40px 0"}}><Loader2 size={24} style={{animation:"spin 1s linear infinite",color:"#94a3b8"}}/></div>}
        {!loadingRecords&&records.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:"#94a3b8",fontSize:13}}>まだ記録がありません</div>}
        {records.map(r=>(<div key={r.id} onClick={()=>{setSelectedRecord(r);setAiSoap(null);setView("detail");}} style={{background:"#fff",borderRadius:12,padding:"12px 16px",border:"1px solid #e8ecf0",marginBottom:8,cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.borderColor="#0d9488"} onMouseLeave={e=>e.currentTarget.style.borderColor="#e8ecf0"}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <Clock size={12} color="#94a3b8"/><span style={{fontSize:11,color:"#94a3b8",fontWeight:600}}>{fmtDate(r.created_at)}</span>
            {r.patient_name&&<span style={{fontSize:10,fontWeight:700,color:"#0d9488",background:"#ecfdf5",padding:"1px 5px",borderRadius:3}}>{r.patient_name}</span>}
            {r.expires_at&&(()=>{const d=daysLeft(r.expires_at);return<span style={{fontSize:9,color:d<=1?"#ef4444":d<=3?"#d97706":"#94a3b8",fontWeight:600}}>残{d}日</span>;})()}
            <div style={{flex:1}}/>
            {(r.soap_s||r.soap_a)&&<span style={{fontSize:9,fontWeight:700,color:"#7c3aed",background:"#f3e8ff",padding:"1px 6px",borderRadius:4}}>AI分類済</span>}
          </div>
          <p style={{margin:0,fontSize:12,color:"#475569",lineHeight:1.6,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{r.transcript}</p>
        </div>))}
      </div>)}

      {/* レコード詳細 */}
      {view==="detail"&&selectedRecord&&<RecordDetail record={selectedRecord} onBack={()=>{setView("list");setAiSoap(null);}} onUpdate={handleUpdateRecord} onDelete={handleDeleteRecord} initialSoap={aiSoap} storeId={currentStore?.id} companyId={userInfo?.company_id}/>}
    </main>
  </div>);
}
