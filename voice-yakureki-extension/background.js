// 音声薬歴 Chrome Extension v3.5 - background.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'open_popup') {
    chrome.action.openPopup();
    sendResponse({ ok: true });
  }
  return true;
});
