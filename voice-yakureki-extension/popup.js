// 音声薬歴 Chrome Extension v3.5 - popup.js
const SUPABASE_URL='https://lrtcrczgwxilukltetxa.supabase.co';
const SUPABASE_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxydGNyY3pnd3hpbHVrbHRldHhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNjY5NDMsImV4cCI6MjA4OTc0Mjk0M30.zVRuzvAKQrNVbrHkQzdnhMqie7Dy4Py8Fcr5eEZAbQo';
const APP_URL='https://voice-yakureki.vercel.app';
const SOAP_KEYS=[
  {key:'soap_s',label:'S',shortcut:'##S##',color:'#059669'},
  {key:'soap_o',label:'O',shortcut:'##O##',color:'#2563eb'},
  {key:'soap_a',label:'A',shortcut:'##A##',color:'#d97706'},
  {key:'soap_ep',label:'EP',shortcut:'##EP##',color:'#7c3aed'},
  {key:'soap_cp',label:'CP',shortcut:'##CP##',color:'#db2777'},
  {key:'soap_op',label:'OP',shortcut:'##OP##',color:'#0891b2'},
  {key:'soap_p',label:'P',shortcut:'##P##',color:'#ea580c'},
  {key:'soap_q',label:'問',shortcut:'##問##',color:'#475569'},
  {key:'soap_other',label:'その他',shortcut:'##その他##',color:'#6b7280'},
  {key:'soap_highrisk',label:'ハイリスク',shortcut:'##ハイリスク##',color:'#dc2626'}
];

let session=null,storeInfo=null,apiKey='',records=[];
let mediaRec=null,chunks=[],recStart=null,timerInterval=null,isRecording=false;
let currentView='loading'; // loading|login|main|detail|recording

// === Supabase helpers ===
async function sbFetch(path,opts={}){
  const h={'Content-Type':'application/json','apikey':SUPABASE_ANON,...(opts.headers||{})};
  if(session?.access_token)h['Authorization']='Bearer '+session.access_token;
  const r=await fetch(SUPABASE_URL+'/rest/v1/'+path,{...opts,headers:h});
  return r.json();
}
async function sbRpc(fn,params={}){
  const h={'Content-Type':'application/json','apikey':SUPABASE_ANON};
  if(session?.access_token)h['Authorization']='Bearer '+session.access_token;
  const r=await fetch(SUPABASE_URL+'/rest/v1/rpc/'+fn,{method:'POST',headers:h,body:JSON.stringify(params)});
  return r.json();
}
async function sbAuth(action,body){
  const r=await fetch(SUPABASE_URL+'/auth/v1/'+action,{
    method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_ANON},body:JSON.stringify(body)
  });
  return r.json();
}

// === Init ===
async function init(){
  const saved=await chrome.storage.local.get(['vy_session','vy_store']);
  if(saved.vy_session?.access_token){
    session=saved.vy_session;
    storeInfo=saved.vy_store||null;
    // セッション有効性チェック
    try{
      const r=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{'Authorization':'Bearer '+session.access_token,'apikey':SUPABASE_ANON}});
      if(!r.ok){session=null;storeInfo=null;await chrome.storage.local.remove(['vy_session','vy_store']);}
    }catch{session=null;}
  }
  if(session&&storeInfo){
    apiKey=await sbRpc('get_api_key',{p_service:'groq',p_store_id:storeInfo.id})||'';
    await loadRecords();
    currentView='main';
  }else{
    currentView='login';
  }
  render();
}

// === Auth ===
async function login(loginId,password){
  const email=loginId.toLowerCase()+'@vy.internal';
  const data=await sbAuth('token?grant_type=password',{email,password});
  if(data.error||!data.access_token)throw new Error(data.error_description||data.msg||'ログインに失敗しました');
  session={access_token:data.access_token,refresh_token:data.refresh_token,user:data.user};
  // 店舗情報取得
  const stores=await sbFetch('stores?auth_user_id=eq.'+data.user.id+'&select=id,name,name_kana,company_id');
  if(stores.length>0){
    storeInfo=stores[0];
  }else{
    // 管理者アカウントの場合
    const admins=await sbFetch('admin_accounts?auth_user_id=eq.'+data.user.id+'&select=*');
    if(admins.length>0){storeInfo={id:null,name:admins[0].display_name||loginId,isAdmin:true};}
    else{storeInfo={id:null,name:loginId};}
  }
  await chrome.storage.local.set({vy_session:session,vy_store:storeInfo});
  apiKey=storeInfo?.id?await sbRpc('get_api_key',{p_service:'groq',p_store_id:storeInfo.id})||'':'';
  await loadRecords();
}

async function logout(){
  session=null;storeInfo=null;apiKey='';records=[];
  await chrome.storage.local.remove(['vy_session','vy_store']);
  currentView='login';render();
}

// === Records ===
async function loadRecords(){
  if(!storeInfo?.id)return;
  records=await sbFetch('records?store_id=eq.'+storeInfo.id+'&order=created_at.desc&limit=20&select=*')||[];
}

// === Audio ===
function toWav16k(buf){
  const t=16000,s=buf.getChannelData(0),r=buf.sampleRate/t,l=Math.floor(s.length/r);
  const a=new ArrayBuffer(44+l*2),v=new DataView(a);
  function w(o,x){for(let i=0;i<x.length;i++)v.setUint8(o+i,x.charCodeAt(i));}
  w(0,'RIFF');v.setUint32(4,36+l*2,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);
  v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,t,true);v.setUint32(28,t*2,true);
  v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,l*2,true);
  let o=44;for(let i=0;i<l;i++){const idx=Math.min(Math.floor(i*r),s.length-1);const x=Math.max(-1,Math.min(1,s[idx]));v.setInt16(o,x<0?x*0x8000:x*0x7FFF,true);o+=2;}
  return new Blob([a],{type:'audio/wav'});
}

async function startRecording(){
  if(!apiKey){showStatus('APIキー未設定。管理者に連絡してください。','err');return;}
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
    chunks=[];mediaRec=new MediaRecorder(stream,{mimeType:'audio/webm;codecs=opus'});
    mediaRec.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data);};
    mediaRec.start(500);isRecording=true;recStart=Date.now();
    timerInterval=setInterval(()=>render(),1000);
    currentView='recording';render();
  }catch(e){showStatus('マイクアクセス拒否: '+e.message,'err');}
}

async function stopRecording(){
  if(!mediaRec)return;
  mediaRec.stop();mediaRec.stream.getTracks().forEach(t=>t.stop());
  clearInterval(timerInterval);isRecording=false;
  await new Promise(r=>{mediaRec.onstop=r;});
  const blob=new Blob(chunks,{type:'audio/webm'});
  currentView='main';showStatus('処理中...','info');render();
  await processAudio(blob);
}

async function processAudio(blob){
  try{
    // decode
    const arrBuf=await blob.arrayBuffer();
    const ac=new (window.AudioContext||window.webkitAudioContext)();
    const decoded=await ac.decodeAudioData(arrBuf);
    const dur=Math.round(decoded.duration);
    const wav=toWav16k(decoded);
    ac.close();
    // transcribe
    showStatus('文字起こし中...','info');render();
    const fd=new FormData();fd.append('file',wav,'audio.wav');fd.append('model','whisper-large-v3-turbo');fd.append('language','ja');fd.append('response_format','text');
    const tr=await fetch('https://api.groq.com/openai/v1/audio/transcriptions',{method:'POST',headers:{'Authorization':'Bearer '+apiKey},body:fd});
    if(!tr.ok)throw new Error('Groq error: '+tr.status);
    const text=await tr.text();
    if(!text.trim())throw new Error('文字起こし結果が空です');
    // save
    showStatus('保存中...','info');render();
    const patientName=document.getElementById('vy-patient')?.value||'';
    const rec={transcript:text.trim(),duration_sec:dur,store_id:storeInfo?.id,patient_name:patientName};
    const saved=await sbFetch('records?select=*',{method:'POST',body:JSON.stringify(rec),headers:{'Prefer':'return=representation'}});
    const recId=Array.isArray(saved)?saved[0]?.id:saved?.id;
    // SOAP classify
    if(recId){
      showStatus('SOAP分類中...','info');render();
      try{
        const sr=await fetch(APP_URL+'/api/soap',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},body:JSON.stringify({transcript:text.trim()})});
        if(sr.ok){
          const soap=await sr.json();
          if(soap&&!soap.parseError){
            const updates={};
            const apiMap={S:'soap_s',O:'soap_o',A:'soap_a',EP:'soap_ep',CP:'soap_cp',OP:'soap_op',P:'soap_p'};
            for(const[ak,dk]of Object.entries(apiMap)){if(soap[ak])updates[dk]=soap[ak];}
            if(Object.keys(updates).length>0){
              await sbFetch('records?id=eq.'+recId,{method:'PATCH',body:JSON.stringify(updates),headers:{'Prefer':'return=minimal'}});
            }
          }
        }
      }catch{}
    }
    await loadRecords();
    showStatus('✅ 完了（'+dur+'秒 / '+text.length+'文字）','ok');
  }catch(e){
    showStatus('❌ '+e.message,'err');
  }
  render();
}

// === Musubi paste ===
function buildMusubiText(rec){
  let t='';
  for(const s of SOAP_KEYS){if(rec[s.key]?.trim())t+=s.shortcut+'\n'+rec[s.key].trim()+'\n';}
  return t.trim();
}

async function pasteToMusubi(rec){
  const text=buildMusubiText(rec);
  if(!text){showStatus('SOAP内容がありません','err');render();return;}
  try{
    await navigator.clipboard.writeText(text);
    // Musubiタブを探してcontent.jsに貼り付け指示
    const tabs=await chrome.tabs.query({url:'https://medication.musubi.app/*'});
    if(tabs.length>0){
      await chrome.tabs.sendMessage(tabs[0].id,{action:'paste_and_click'});
      showStatus('✅ Musubiにコピー＋貼り付け実行','ok');
    }else{
      showStatus('✅ クリップボードにコピーしました（Musubiページを開いてください）','ok');
    }
  }catch(e){showStatus('❌ '+e.message,'err');}
  render();
}

// === Render ===
let statusText='',statusType='';
function showStatus(msg,type){statusText=msg;statusType=type;render();}

function render(){
  const app=document.getElementById('app');
  if(currentView==='loading'){app.innerHTML='<div style="text-align:center;padding:40px"><div class="spinner" style="font-size:24px">⏳</div></div>';return;}

  if(currentView==='login'){
    app.innerHTML=`
      <div class="header"><div class="header-icon">🎙</div><div><div class="header-title">音声薬歴ツール</div><div class="header-sub">v3.5</div></div></div>
      <div class="content">
        <div class="login-box">
          <div class="login-title">ログイン</div>
          <input id="vy-id" class="input input-mono" placeholder="店舗ID（例: YK-A3B7X2）" value="${localStorage.getItem('vy-ext-id')||''}">
          <input id="vy-pw" class="input" type="password" placeholder="パスワード">
          ${statusText?`<div class="status status-${statusType}">${statusText}</div>`:''}
          <button id="vy-login" class="btn">ログイン</button>
        </div>
      </div>`;
    document.getElementById('vy-login').onclick=async()=>{
      const id=document.getElementById('vy-id').value.trim();
      const pw=document.getElementById('vy-pw').value;
      if(!id||!pw){showStatus('IDとパスワードを入力してください','err');return;}
      showStatus('ログイン中...','info');render();
      try{
        await login(id,pw);
        localStorage.setItem('vy-ext-id',id);
        currentView='main';render();
      }catch(e){showStatus(e.message,'err');}
    };
    document.getElementById('vy-pw')?.addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('vy-login').click();});
    return;
  }

  if(currentView==='recording'){
    const elapsed=Math.floor((Date.now()-(recStart||Date.now()))/1000);
    const mm=String(Math.floor(elapsed/60)).padStart(2,'0');
    const ss=String(elapsed%60).padStart(2,'0');
    app.innerHTML=`
      <div class="header" style="background:linear-gradient(135deg,#dc2626,#b91c1c)"><div class="header-icon">⏺</div><div><div class="header-title">録音中</div><div class="header-sub">${storeInfo?.name||''}</div></div></div>
      <div class="content" style="text-align:center">
        <div class="timer">${mm}:${ss}</div>
        <button id="vy-stop" class="btn-rec btn-stop">⏹ 録音を停止</button>
      </div>`;
    document.getElementById('vy-stop').onclick=()=>stopRecording();
    return;
  }

  if(currentView==='detail'){
    const rec=window._detailRecord;
    if(!rec){currentView='main';render();return;}
    const fmtDate=d=>{const dt=new Date(d);return `${dt.getMonth()+1}/${dt.getDate()} ${dt.getHours()}:${String(dt.getMinutes()).padStart(2,'0')}`;};
    let soapHtml='';
    for(const s of SOAP_KEYS){
      if(rec[s.key]?.trim()){
        soapHtml+=`<div class="detail-field"><div class="detail-label" style="color:${s.color}">${s.label}</div><div class="detail-text">${esc(rec[s.key])}</div></div>`;
      }
    }
    app.innerHTML=`
      <div class="header"><div class="header-icon">📋</div><div><div class="header-title">薬歴詳細</div><div class="header-sub">${fmtDate(rec.created_at)}${rec.patient_name?' · '+esc(rec.patient_name):''}</div></div></div>
      <div class="content">
        <button class="back-btn" id="vy-back">← 一覧に戻る</button>
        ${statusText?`<div class="status status-${statusType}">${statusText}</div>`:''}
        <div class="detail">
          <div class="detail-field"><div class="detail-label" style="color:#94a3b8">文字起こし</div><div class="detail-text">${esc(rec.transcript||'')}</div></div>
          ${soapHtml}
        </div>
        <button id="vy-copy" class="btn-copy">📋 Musubiテキストをコピー</button>
        <button id="vy-paste" class="btn-paste">📥 Musubiに貼り付け</button>
      </div>`;
    document.getElementById('vy-back').onclick=()=>{statusText='';currentView='main';render();};
    document.getElementById('vy-copy').onclick=async()=>{
      const t=buildMusubiText(rec);
      if(t){await navigator.clipboard.writeText(t);showStatus('✅ コピーしました','ok');}
      else showStatus('SOAP内容がありません','err');
    };
    document.getElementById('vy-paste').onclick=()=>pasteToMusubi(rec);
    return;
  }

  // === main view ===
  const fmtDate=d=>{const dt=new Date(d);return `${dt.getMonth()+1}/${dt.getDate()} ${dt.getHours()}:${String(dt.getMinutes()).padStart(2,'0')}`;};
  let listHtml='';
  if(records.length===0){
    listHtml='<div class="empty">録音履歴がありません</div>';
  }else{
    for(const r of records){
      const soapTags=SOAP_KEYS.filter(s=>r[s.key]?.trim()).map(s=>`<span class="soap-tag" style="background:${s.color}18;color:${s.color}">${s.label}</span>`).join('');
      listHtml+=`<div class="card" data-id="${r.id}">
        <div class="card-title">${esc(r.patient_name||r.transcript?.slice(0,40)||'録音')}</div>
        <div class="card-sub">${fmtDate(r.created_at)} · ${r.duration_sec||0}秒 ${soapTags}</div>
      </div>`;
    }
  }
  app.innerHTML=`
    <div class="header">
      <div class="header-icon">🎙</div>
      <div><div class="header-title">${esc(storeInfo?.name||'')}</div><div class="header-sub">${storeInfo?.id?'店舗アカウント':'管理者'}</div></div>
      <div class="header-right">
        <button class="btn-sm" id="vy-refresh">↻</button>
        <button class="btn-sm" id="vy-logout">退出</button>
      </div>
    </div>
    <div class="content">
      ${statusText?`<div class="status status-${statusType}">${statusText}</div>`:''}
      ${storeInfo?.id?`
        <div class="patient-input">
          <input id="vy-patient" class="input" style="margin:0;flex:1" placeholder="患者名（任意）">
        </div>
        <button id="vy-rec" class="btn-rec">🎙 録音開始</button>
        <div style="margin:10px 0 6px;font-size:11px;font-weight:700;color:#64748b">最近の録音</div>
      `:`<div class="status status-info">管理者アカウントです。録音はWebアプリから行ってください。</div>`}
      ${listHtml}
    </div>`;
  document.getElementById('vy-refresh')?.addEventListener('click',async()=>{showStatus('更新中...','info');await loadRecords();statusText='';render();});
  document.getElementById('vy-logout')?.addEventListener('click',logout);
  document.getElementById('vy-rec')?.addEventListener('click',startRecording);
  document.querySelectorAll('.card[data-id]').forEach(el=>{
    el.addEventListener('click',()=>{
      const rec=records.find(r=>r.id===el.dataset.id);
      if(rec){window._detailRecord=rec;statusText='';currentView='detail';render();}
    });
  });
}

function esc(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

// === Start ===
init();
