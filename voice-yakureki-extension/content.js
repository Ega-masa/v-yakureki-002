// 音声薬歴 Chrome Extension v3.5 - content.js
// Musubi (medication.musubi.app) 上で動作

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'paste_and_click') {
    pasteAndClick().then(r => sendResponse(r)).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (msg.action === 'ping') {
    sendResponse({ success: true, url: location.href });
    return true;
  }
});

async function pasteAndClick() {
  // Musubiの「貼り付け」ボタンを探してクリック
  // Musubiのangularアプリ内のボタンを検索
  const pasteButtons = Array.from(document.querySelectorAll('button, [role="button"]'))
    .filter(el => {
      const text = el.textContent?.trim() || '';
      return text === '貼り付け' || text.includes('貼り付け');
    });

  if (pasteButtons.length > 0) {
    // 貼り付けボタンをクリック
    pasteButtons[0].click();
    return { success: true, method: 'paste_button' };
  }

  // 「貼り付け」ボタンが見つからない場合は、テキストエリアに直接ペースト
  const textareas = document.querySelectorAll('textarea');
  if (textareas.length > 0) {
    const ta = textareas[0];
    ta.focus();
    try {
      const text = await navigator.clipboard.readText();
      // AngularのngModelを更新するためにイベントを発火
      ta.value = text;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true, method: 'textarea_paste' };
    } catch (e) {
      // クリップボードアクセスが拒否された場合はdocument.execCommand
      ta.focus();
      document.execCommand('paste');
      return { success: true, method: 'execCommand' };
    }
  }

  return { success: false, error: 'テキストエリアが見つかりません' };
}

// フローティングボタン（Musubiページ上に常時表示）
function addFloatingButton() {
  if (document.getElementById('vy-float-btn')) return;
  const btn = document.createElement('div');
  btn.id = 'vy-float-btn';
  btn.innerHTML = '🎙';
  btn.title = '音声薬歴ツール';
  btn.style.cssText = 'position:fixed;bottom:20px;right:20px;width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#0d9488,#0f766e);color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.2);z-index:99999;transition:transform .15s;';
  btn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'open_popup' });
  });
  document.body.appendChild(btn);
}

// Musubiページで常時フローティングボタンを表示
if (location.hostname === 'medication.musubi.app') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addFloatingButton);
  } else {
    addFloatingButton();
  }
}
