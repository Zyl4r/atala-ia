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

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. MODO ESCURO (DARK MODE)
    // ==========================================
    const toggleDarkMode = document.getElementById('toggle-dark-mode');

    if (localStorage.getItem('theme') === 'dark') {
        document.documentElement.classList.add('dark');
        if (toggleDarkMode) toggleDarkMode.checked = true;
    }

    if (toggleDarkMode) {
        toggleDarkMode.addEventListener('change', () => {
            if (toggleDarkMode.checked) {
                document.documentElement.classList.add('dark');
                localStorage.setItem('theme', 'dark');
            } else {
                document.documentElement.classList.remove('dark');
                localStorage.setItem('theme', 'light');
            }
        });
    }

    // ==========================================
    // 2. REDIMENSIONAMENTO APENAS DAS FONTES (+2px / -2px)
    // ==========================================
    const btnSmall = document.getElementById('btn-font-small');
    const btnNormal = document.getElementById('btn-font-normal');
    const btnLarge = document.getElementById('btn-font-large');

    let fontOffset = parseInt(localStorage.getItem('fontOffset')) || 0; // Quantos pixels aumentou ou diminuiu

    // Seleciona os elementos de texto da aplicação
    function getAppTextElements() {
        return document.querySelectorAll('p, h1, h2, h3, span, label, select, option, button');
    }

    function updateTextSizes(change) {
        fontOffset += change;
        
        // Limites para não esmagar nem estourar as fontes (-6px a +10px)
        if (fontOffset < -6) fontOffset = -6;
        if (fontOffset > 10) fontOffset = 10;

        const textElements = getAppTextElements();

        textElements.forEach(el => {
            // Ignora os próprios botões de ajustar fonte para manterem o tamanho padrão
            if (el.id === 'btn-font-small' || el.id === 'btn-font-normal' || el.id === 'btn-font-large') return;

            // Salva o tamanho original em px na primeira vez
            if (!el.dataset.originalSize) {
                const currentSize = window.getComputedStyle(el).fontSize;
                el.dataset.originalSize = parseFloat(currentSize);
            }

            const baseSize = parseFloat(el.dataset.originalSize);
            el.style.fontSize = `${baseSize + fontOffset}px`;
        });

        localStorage.setItem('fontOffset', fontOffset);
    }

    // Aplica o ajuste salvo ao carregar
    if (fontOffset !== 0) {
        updateTextSizes(0);
    }

    // Eventos dos Botões
    if (btnSmall) {
        btnSmall.addEventListener('click', () => updateTextSizes(-2));
    }

    if (btnNormal) {
        btnNormal.addEventListener('click', () => {
            fontOffset = 0;
            localStorage.setItem('fontOffset', 0);
            const textElements = getAppTextElements();
            textElements.forEach(el => {
                if (el.dataset.originalSize) {
                    el.style.fontSize = `${el.dataset.originalSize}px`;
                }
            });
        });
    }

    if (btnLarge) {
        btnLarge.addEventListener('click', () => updateTextSizes(2));
    }

    // ==========================================
    // 3. BOTÃO SALVAR (FEEDBACK VISUAL)
    // ==========================================
    const btnSave = document.getElementById('btn-save-settings');

    if (btnSave) {
        btnSave.addEventListener('click', () => {
            const originalText = btnSave.innerHTML;

            btnSave.innerHTML = '✓ Salvo com sucesso!';
            btnSave.classList.remove('bg-orange');
            btnSave.classList.add('bg-blue');

            setTimeout(() => {
                btnSave.innerHTML = originalText;
                btnSave.classList.remove('bg-blue');
                btnSave.classList.add('bg-orange');
            }, 2000);
        });
    }
});