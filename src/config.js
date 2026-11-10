// Endereço do backend (repositório atala-ia-back).
//
// - Servidor no Render:  'https://atala-ia-back.onrender.com'
// - Testando no seu PC: 'http://127.0.0.1:8000' (rode "uvicorn app.main:app --reload" no backend)
//
// Endereços *.onrender.com já estão liberados no manifest.json. Se usar outro
// servidor, adicione o endereço dele em "host_permissions" no manifest.json.
//
// Para testar o visual fora da extensão contra um backend local, abra
// popup.html?api=http://127.0.0.1:8000 (só vale fora da extensão).
const ATALA_API_URL = (() => {
  const padrao = 'https://atala-ia-back.onrender.com';
  const foraDaExtensao = typeof chrome === 'undefined' || !chrome.tabs;
  const local = foraDaExtensao && new URLSearchParams(location.search).get('api');
  return local && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(local) ? local : padrao;
})();
