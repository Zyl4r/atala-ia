// =====================================================================
// LÓGICA DO POPUP LIGADA AO BACKEND
// Ao abrir a extensão: lê o produto da aba atual, manda para a API e
// mostra a análise. Também cuida do Histórico, Alertas e Ajustes, que
// ficam guardados no navegador (a extensão não tem login).
// (O script.js continua cuidando de abas, modo escuro e tamanho da fonte.)
// =====================================================================

const el = (id) => document.getElementById(id);

const estado = {
  produto: null,  // o que veio da página (extrator.js)
  detalhe: null,  // resposta da API (produto + análise)
};

const PAGINAS = ['home-page', 'product-page', 'history-page', 'alerts-page', 'settings-page', 'help-page'];

// Classes completas escritas aqui para o Tailwind encontrá-las.
const ESTILO_VEREDITO = {
  comprar: 'bg-light-blue border-secondary-blue text-dark-blue',
  esperar: 'bg-light-secondary border-dark-orange text-dark-orange',
  neutro: 'bg-secondary-off-white border-light-gray text-[#22181C]',
  sem_dados: 'bg-secondary-off-white border-light-gray text-[#22181C]',
  erro: 'bg-light-secondary border-dark-orange text-dark-orange',
};
const TODAS_AS_CLASSES_VEREDITO = [...new Set(Object.values(ESTILO_VEREDITO).join(' ').split(' '))];

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

function mostrarPagina(id) {
  PAGINAS.forEach((p) => el(p)?.classList.toggle('hidden', p !== id));
}

function mensagemNaLista(lista, texto, erro = false) {
  const cor = erro ? 'text-dark-orange' : 'text-gray';
  lista.innerHTML = `<p class="${cor} text-[12px] font-[Inter] text-center px-8">${escapar(texto)}</p>`;
}

// Busca os dados atuais de vários produtos na API (ignora os que falharem).
async function buscarProdutos(ids) {
  const resultados = await Promise.allSettled(ids.map((id) => api.produto(id)));
  const porId = {};
  resultados.forEach((r, i) => { if (r.status === 'fulfilled') porId[ids[i]] = r.value; });
  if (ids.length && !Object.keys(porId).length) {
    const falha = resultados.find((r) => r.status === 'rejected');
    if (falha) throw falha.reason;
  }
  return porId;
}

// ---------------------------------------------------------------------
// 1. LER O PRODUTO DA ABA ATUAL
// ---------------------------------------------------------------------
async function obterProdutoDaAba() {
  if (!EH_EXTENSAO) {
    // Teste fora da extensão: popup.html?titulo=...&preco=...&preco_original=...&url=...
    const p = new URLSearchParams(location.search);
    if (!p.get('preco')) return null;
    return {
      url: p.get('url') || 'https://www.exemplo.com/produto-teste',
      loja: p.get('loja') || 'Loja de teste',
      titulo: p.get('titulo') || 'Produto de teste',
      preco: parseFloat(p.get('preco')),
      preco_original: p.get('preco_original') ? parseFloat(p.get('preco_original')) : null,
      imagem_url: p.get('imagem') || null,
      moeda: 'BRL',
    };
  }
  try {
    const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!aba || !/^https?:/.test(aba.url || '')) return null;
    const [execucao] = await chrome.scripting.executeScript({ target: { tabId: aba.id }, func: extrairProduto });
    return execucao?.result || null;
  } catch (e) {
    // Páginas do próprio Chrome, loja de extensões etc. não deixam ler o conteúdo.
    console.warn('Atala.IA: não foi possível ler a página.', e);
    return null;
  }
}

// ---------------------------------------------------------------------
// 2. TELA PRODUTO
// ---------------------------------------------------------------------
function preencherDadosDaPagina(produto) {
  el('produto-titulo').textContent = produto.titulo;
  el('produto-loja').textContent = produto.loja;
  el('produto-preco').textContent = formatarPreco(produto.preco, produto.moeda);
  el('produto-imagem').src = produto.imagem_url || 'assets/logo-header.png';
  el('produto-atualizado').textContent = '';
  el('produto-variacao').classList.add('hidden');
  el('produto-minimo').textContent = '';
  el('produto-motivos').innerHTML = '';
  el('produto-base').textContent = '';
  el('produto-alerta-badge').classList.add('hidden');
  el('produto-alerta-msg').textContent = '';
  el('input-preco-alvo').value = '';
  desenharGrafico([]);
  definirVeredito('neutro', 'Analisando o preço…', '');
}

function definirVeredito(tipo, titulo, subtitulo) {
  const caixa = el('produto-veredito');
  caixa.classList.remove(...TODAS_AS_CLASSES_VEREDITO);
  caixa.classList.add(...ESTILO_VEREDITO[tipo].split(' '));
  el('produto-veredito-titulo').textContent = titulo;
  el('produto-confianca').textContent = subtitulo;
}

async function renderizarAnalise(detalhe) {
  const { produto, analise } = detalhe;
  const e = analise.estatisticas;

  el('produto-preco').textContent = formatarPreco(e.preco_atual, produto.moeda);
  el('produto-atualizado').textContent = tempoRelativo(dataDaApi(produto.atualizado_em));
  el('produto-alerta-badge').classList.toggle('hidden', !(await alertasLocais.ativoPara(produto.id)));
  el('produto-minimo').textContent = e.minimo_30d && e.pontos_no_historico >= 2
    ? `Mín. ${formatarPreco(e.minimo_30d, produto.moeda)}` : '';

  const variacao = el('produto-variacao');
  if (e.variacao_30d_pct !== null && e.pontos_no_historico >= 2 && Math.abs(e.variacao_30d_pct) >= 1) {
    const caiu = e.variacao_30d_pct < 0;
    el('produto-variacao-texto').textContent = `${caiu ? '↓' : '↑'} ${Math.abs(e.variacao_30d_pct).toFixed(0)}% no mês`;
    variacao.className = caiu
      ? 'w-fit h-fit px-2 py-1 rounded-full border bg-light-blue border-secondary-blue text-dark-blue'
      : 'w-fit h-fit px-2 py-1 rounded-full border bg-light-secondary border-dark-orange text-dark-orange';
  } else if (e.desconto_pct) {
    el('produto-variacao-texto').textContent = `${e.desconto_pct.toFixed(0)}% off na loja`;
    variacao.className = 'w-fit h-fit px-2 py-1 rounded-full border bg-light-blue border-secondary-blue text-dark-blue';
  } else {
    variacao.className = 'hidden';
  }

  const confianca = analise.veredito === 'sem_dados' ? '' : `Confiança: ${Math.round(analise.confianca * 100)}%`;
  definirVeredito(analise.veredito, analise.titulo, confianca);

  el('produto-motivos').innerHTML = analise.motivos.map((m) => `<li>${escapar(m)}</li>`).join('');
  el('produto-base').textContent = {
    historico: analise.historico_simulado
      ? 'Histórico SIMULADO para demonstração (linha tracejada no gráfico).'
      : `Baseado em ${e.pontos_no_historico} preços dos últimos 30 dias.`,
    desconto_da_pagina: 'Baseado no desconto anunciado pela loja (ainda sem histórico).',
    sem_dados: '',
  }[analise.base] || '';

  api.historicoPrecos(produto.id).then(desenharGrafico).catch(() => desenharGrafico([]));
}

function desenharGrafico(pontos) {
  const area = el('produto-grafico');
  const rotulos = ['grafico-data-inicio', 'grafico-data-meio', 'grafico-data-fim'];
  if (!pontos || pontos.length < 2) {
    area.innerHTML = '<p class="text-[10px] text-[#706F66] font-[Inter] text-center pt-4">Ainda sem histórico para o gráfico</p>';
    rotulos.forEach((id) => { el(id).textContent = ''; });
    return;
  }
  const L = 300, A = 55, margem = 4;
  const tempos = pontos.map((p) => dataDaApi(p.coletado_em).getTime());
  const precos = pontos.map((p) => p.preco);
  const [t0, t1] = [Math.min(...tempos), Math.max(...tempos)];
  const [pMin, pMax] = [Math.min(...precos), Math.max(...precos)];
  const x = (t) => (t1 === t0 ? L / 2 : ((t - t0) / (t1 - t0)) * L);
  const y = (p) => (pMax === pMin ? A / 2 : margem + (1 - (p - pMin) / (pMax - pMin)) * (A - 2 * margem));
  const coordenada = (i) => `${x(tempos[i]).toFixed(1)},${y(precos[i]).toFixed(1)}`;

  // Preços simulados (para demonstração) ficam tracejados; os reais, em linha cheia.
  // O primeiro ponto real entra nos dois trechos para a linha não ficar quebrada.
  const primeiroReal = pontos.findIndex((p) => !p.simulado);
  const indices = pontos.map((_, i) => i);
  const simulados = primeiroReal === -1 ? indices : indices.slice(0, primeiroReal + 1);
  const reais = primeiroReal === -1 ? [] : indices.slice(primeiroReal);
  const trecho = (lista, extra) => (lista.length < 2 ? '' : `
      <polyline points="${lista.map(coordenada).join(' ')}" fill="none" stroke="#E29578" stroke-width="2"
        stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" ${extra}/>`);

  area.innerHTML = `
    <svg viewBox="0 0 ${L} ${A}" preserveAspectRatio="none" class="w-full h-full overflow-visible">
      <line x1="0" y1="${A / 2}" x2="${L}" y2="${A / 2}" stroke="#E8DFD2" stroke-width="1" vector-effect="non-scaling-stroke"/>
      ${trecho(simulados, 'stroke-dasharray="4 3" opacity="0.7"')}
      ${trecho(reais, '')}
    </svg>`;

  const formatarDia = (t) => {
    const d = new Date(t);
    return `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleDateString('pt-BR', { month: 'short' })}`;
  };
  el('grafico-data-inicio').textContent = formatarDia(t0);
  el('grafico-data-meio').textContent = formatarDia((t0 + t1) / 2);
  el('grafico-data-fim').textContent = formatarDia(t1);
}

async function analisarProduto() {
  preencherDadosDaPagina(estado.produto);
  // Servidores gratuitos "dormem" sem uso e levam até ~1 minuto para acordar.
  const avisoDemora = setTimeout(() => {
    definirVeredito('neutro', 'Acordando o servidor…', 'Pode levar até 1 minuto');
  }, 4000);
  try {
    estado.detalhe = await api.observar(estado.produto);
    clearTimeout(avisoDemora);
    await historicoLocal.registrar(estado.detalhe.produto.id);
    await renderizarAnalise(estado.detalhe);
  } catch (erro) {
    clearTimeout(avisoDemora);
    estado.detalhe = null;
    definirVeredito('erro', 'Não foi possível analisar', '');
    el('produto-motivos').innerHTML = `<li>${escapar(erro.message)}</li>`;
    if (erro.status === 0) {
      el('produto-base').textContent = 'Confira se o backend está rodando.';
    }
  }
}

async function criarAlerta() {
  const mensagem = el('produto-alerta-msg');
  if (!estado.detalhe) return;
  const valor = parseFloat(String(el('input-preco-alvo').value).replace(',', '.'));
  if (!(valor > 0)) {
    mensagem.textContent = 'Digite o preço que você quer pagar.';
    return;
  }
  await alertasLocais.salvar(estado.detalhe.produto.id, valor);
  el('produto-alerta-badge').classList.remove('hidden');
  mensagem.textContent = `Alerta criado: vamos avisar quando chegar a ${formatarPreco(valor)}.`;
}

// ---------------------------------------------------------------------
// 3. HISTÓRICO (produtos analisados neste navegador nos últimos 7 dias)
// ---------------------------------------------------------------------
async function carregarHistorico() {
  const lista = el('historico-lista');
  mensagemNaLista(lista, 'Carregando…');
  const umaSemana = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const itens = (await historicoLocal.listar()).filter((i) => new Date(i.visto_em).getTime() >= umaSemana);

  try {
    const produtos = await buscarProdutos(itens.map((i) => i.produto_id));
    const validos = itens.filter((i) => produtos[i.produto_id]);
    let economia = 0;

    el('resumo-qtd').textContent = `${validos.length} Produto${validos.length === 1 ? '' : 's'}`;
    if (!validos.length) {
      el('resumo-economia').textContent = formatarPreco(0);
      mensagemNaLista(lista, 'Nenhum produto analisado esta semana. Abra a extensão numa página de produto!');
      return;
    }

    lista.innerHTML = validos.map((item) => {
      const { produto, analise } = produtos[item.produto_id];
      const atual = analise.estatisticas.preco_atual;
      const v = analise.estatisticas.pontos_no_historico >= 2 ? analise.estatisticas.variacao_30d_pct : null;
      if (v !== null && v < 0) economia += atual / (1 + v / 100) - atual; // quanto caiu em R$
      const variacao = v === null || Math.abs(v) < 1
        ? 'Preço estável nos últimos 30 dias'
        : `${v < 0 ? '↓' : '↑'} ${Math.abs(v).toFixed(0)}% nos últimos 30 dias`;
      const cor = v !== null && v < 0 ? 'text-dark-blue' : 'text-dark-orange';
      return `
        <a href="${escapar(produto.url)}" data-link-produto
          class="border-2 border-light-gray rounded-md p-2 mx-8 flex items-center gap-3 hover:border-orange transition-all">
          <img src="${escapar(produto.imagem_url || 'assets/logo-header.png')}" alt=""
            class="w-16 h-16 object-cover shrink-0 rounded bg-white">
          <div class="flex flex-col min-w-0">
            <h2 class="text-dark text-[14px] font-[Jost] font-semibold line-clamp-2">${escapar(produto.titulo)}</h2>
            <h4 class="text-gray text-[11px] font-[Jost]">${escapar(produto.loja)}</h4>
            <h2 class="text-dark text-[16px] font-[Jost] font-semibold">${formatarPreco(atual, produto.moeda)}</h2>
            <h4 class="${cor} text-[11px] font-[Jost]">${variacao}</h4>
          </div>
        </a>`;
    }).join('');
    el('resumo-economia').textContent = formatarPreco(economia);
  } catch (erro) {
    mensagemNaLista(lista, erro.message, true);
  }
}

// ---------------------------------------------------------------------
// 4. ALERTAS (guardados neste navegador; preço atual vem da API)
// ---------------------------------------------------------------------
async function carregarAlertas() {
  const lista = el('alertas-lista');
  mensagemNaLista(lista, 'Carregando…');
  const alertas = await alertasLocais.listar();
  if (!alertas.length) {
    mensagemNaLista(lista, 'Você ainda não tem alertas. Crie um na tela Produto.');
    return;
  }
  try {
    const produtos = await buscarProdutos(alertas.map((a) => a.produto_id));
    lista.innerHTML = alertas.filter((a) => produtos[a.produto_id]).map((a) => {
      const { produto, analise } = produtos[a.produto_id];
      const atual = analise.estatisticas.preco_atual;
      const atingido = a.ativo && atual <= a.preco_alvo;
      return `
      <div class="flex items-center gap-3 w-full">
        <img src="${escapar(produto.imagem_url || 'assets/logo-header.png')}" alt=""
          class="w-16 h-16 object-cover rounded-lg border-[1px] border-light-gray shrink-0 bg-white">
        <div class="flex items-center justify-between w-full min-w-0">
          <div class="flex flex-col gap-0.5 min-w-0">
            <h2 class="text-dark text-[13px] font-semibold font-[Inter] line-clamp-2">${escapar(produto.titulo)}</h2>
            <p class="text-gray text-[11px] font-normal font-[Inter]">Preço atual: ${formatarPreco(atual, produto.moeda)}</p>
            <p class="text-gray text-[11px] font-normal font-[Inter]">Avisar quando chegar a: ${formatarPreco(a.preco_alvo, produto.moeda)}</p>
            ${atingido ? '<p class="text-dark-blue text-[11px] font-semibold font-[Inter]">✓ Preço atingido!</p>' : ''}
          </div>
          <label class="relative inline-flex items-center cursor-pointer shrink-0 ml-2">
            <input type="checkbox" class="sr-only peer" data-produto-id="${a.produto_id}" ${a.ativo ? 'checked' : ''}>
            <div class="w-9 h-5 bg-light-gray rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange"></div>
          </label>
        </div>
      </div>`;
    }).join('');
  } catch (erro) {
    mensagemNaLista(lista, erro.message, true);
  }
}

// ---------------------------------------------------------------------
// 5. AJUSTES (preferências guardadas neste navegador)
// ---------------------------------------------------------------------
const CAMPOS_PREFERENCIAS = {
  alerta_queda: ['pref-alerta-queda', 'checked'],
  resumo_semanal: ['pref-resumo-semanal', 'checked'],
  analisar_ao_abrir: ['toggle-monitor', 'checked'],
  intervalo: ['pref-intervalo', 'value'],
  moeda: ['pref-moeda', 'value'],
};

async function carregarPreferencias() {
  const prefs = await armazenamento.ler('atalaPreferencias', {});
  Object.entries(CAMPOS_PREFERENCIAS).forEach(([chave, [id, prop]]) => {
    if (prefs[chave] !== undefined && el(id)) el(id)[prop] = prefs[chave];
  });
}

async function salvarPreferencias() {
  const prefs = {};
  Object.entries(CAMPOS_PREFERENCIAS).forEach(([chave, [id, prop]]) => {
    if (el(id)) prefs[chave] = el(id)[prop];
  });
  await armazenamento.gravar('atalaPreferencias', prefs);
}

// ---------------------------------------------------------------------
// 6. EVENTOS E INÍCIO
// ---------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  // Estes cliques rodam DEPOIS do switchTab do script.js e completam o que ele faz.
  el('btn-nav-product').addEventListener('click', () => {
    if (!estado.produto) mostrarPagina('home-page');
  });
  el('btn-nav-history').addEventListener('click', carregarHistorico);
  el('btn-nav-alerts').addEventListener('click', carregarAlertas);

  el('btn-ver-analises').addEventListener('click', () => el('btn-nav-history').click());
  el('btn-criar-alerta').addEventListener('click', criarAlerta);
  el('btn-save-settings').addEventListener('click', salvarPreferencias);

  el('alertas-lista').addEventListener('change', async (evento) => {
    const id = Number(evento.target.dataset.produtoId);
    if (!id) return;
    await alertasLocais.definirAtivo(id, evento.target.checked);
    carregarAlertas();
  });

  // Na extensão, links precisam abrir numa aba nova (o popup não navega).
  el('historico-lista').addEventListener('click', (evento) => {
    const link = evento.target.closest('[data-link-produto]');
    if (!link || !EH_EXTENSAO) return;
    evento.preventDefault();
    chrome.tabs.create({ url: link.href });
  });

  await carregarPreferencias();

  estado.produto = await obterProdutoDaAba();
  if (estado.produto) {
    el('btn-nav-product').click();
    analisarProduto();
  }
});
