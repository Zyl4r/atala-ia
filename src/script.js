// Mapeamento dos botões e suas respectivas telas
const tabs = {
  product: { btn: document.getElementById('btn-nav-product'), page: document.getElementById('product-page') },
  history: { btn: document.getElementById('btn-nav-history'), page: document.getElementById('history-page') },
  alerts: { btn: document.getElementById('btn-nav-alerts'), page: document.getElementById('alerts-page') },
  settings: { btn: document.getElementById('btn-nav-settings'), page: document.getElementById('settings-page') },
  help: { btn: document.getElementById('btn-nav-help'), page: document.getElementById('help-page') }
};

// Função para mudar a tela e as cores dos ícones
function switchTab(targetTabKey) {
  Object.keys(tabs).forEach(key => {
    const tab = tabs[key];
    if (!tab.btn || !tab.page) return;

    const icon = tab.btn.querySelector('svg');
    const label = tab.btn.querySelector('span');

    if (key === targetTabKey) {
      // Exibe a tela
      tab.page.classList.remove('hidden');

      // Aplica cor ativa (verde)
      icon?.classList.replace('stroke-gray', 'stroke-dark-green');
      label?.classList.replace('text-gray', 'text-dark-green');
      label?.classList.replace('font-normal', 'font-semibold');
    } else {
      // Esconde as outras telas
      tab.page.classList.add('hidden');

      // Restaura cor inativa (cinza)
      icon?.classList.replace('stroke-dark-green', 'stroke-gray');
      label?.classList.replace('text-dark-green', 'text-gray');
      label?.classList.replace('font-semibold', 'font-normal');
    }
  });

  // Garante que a Home Page fique oculta ao navegar pelo menu
  document.getElementById('home-page')?.classList.add('hidden');
}

// Adiciona os eventos de clique nos botões do menu
Object.keys(tabs).forEach(key => {
  tabs[key].btn?.addEventListener('click', () => switchTab(key));
});