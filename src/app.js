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

// ---------------------------------------------------------------------
// GRÁFICO "ÚLTIMOS 30 DIAS"
// - Passe o mouse: mostra o preço daquele dia.
// - Role o scroll em cima do gráfico: zoom (centrado no mouse).
// - Clique duas vezes: volta ao período inteiro.
// ---------------------------------------------------------------------
const grafico = { pontos: [], tempos: [], tMin: 0, tMax: 0, ini: 0, fim: 0, pMin: 0, pMax: 0 };
const GRAFICO_L = 300, GRAFICO_A = 55, GRAFICO_MARGEM = 4;
const UM_DIA = 24 * 60 * 60 * 1000;

function formatarDia(t) {
  const d = new Date(t);
  return `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleDateString('pt-BR', { month: 'short' })}`;
}

function desenharGrafico(pontos) {
  const area = el('produto-grafico');
  grafico.pontos = pontos && pontos.length >= 2 ? pontos : [];
  if (!grafico.pontos.length) {
    area.innerHTML = '<p class="text-[10px] text-[#706F66] font-[Inter] text-center pt-4">Ainda sem histórico para o gráfico</p>';
    ['grafico-data-inicio', 'grafico-data-meio', 'grafico-data-fim'].forEach((id) => { el(id).textContent = ''; });
    return;
  }
  grafico.tempos = pontos.map((p) => dataDaApi(p.coletado_em).getTime());
  grafico.tMin = Math.min(...grafico.tempos);
  grafico.tMax = Math.max(...grafico.tempos);
  grafico.ini = grafico.tMin;
  grafico.fim = grafico.tMax;
  renderizarGrafico();
}

// Índices dos pontos dentro da janela de zoom (mais um de cada lado, para a linha chegar às bordas).
function janelaDoGrafico() {
  const { tempos, ini, fim } = grafico;
  const dentro = tempos.map((t, i) => i).filter((i) => tempos[i] >= ini && tempos[i] <= fim);
  const primeiro = dentro.length ? dentro[0] : tempos.findIndex((t) => t > ini);
  const ultimo = dentro.length ? dentro[dentro.length - 1] : Math.max(primeiro - 1, 0);
  return {
    dentro: dentro.length ? dentro : [primeiro, ultimo],
    de: Math.max(0, primeiro - 1),
    ate: Math.min(tempos.length - 1, ultimo + 1),
  };
}

const xDoGrafico = (t) => (grafico.fim === grafico.ini ? 0.5 : (t - grafico.ini) / (grafico.fim - grafico.ini));
const yDoGrafico = (p) => (grafico.pMax === grafico.pMin
  ? 0.5
  : (GRAFICO_MARGEM + (1 - (p - grafico.pMin) / (grafico.pMax - grafico.pMin)) * (GRAFICO_A - 2 * GRAFICO_MARGEM)) / GRAFICO_A);

function renderizarGrafico() {
  const area = el('produto-grafico');
  const { pontos, tempos, ini, fim } = grafico;
  const { dentro, de, ate } = janelaDoGrafico();

  // A escala vertical se ajusta aos preços visíveis, para o zoom mostrar a variação.
  const precosVisiveis = dentro.map((i) => pontos[i].preco);
  grafico.pMin = Math.min(...precosVisiveis);
  grafico.pMax = Math.max(...precosVisiveis);

  const indices = [];
  for (let i = de; i <= ate; i++) indices.push(i);
  const coordenada = (i) =>
    `${(xDoGrafico(tempos[i]) * GRAFICO_L).toFixed(1)},${(yDoGrafico(pontos[i].preco) * GRAFICO_A).toFixed(1)}`;

  // Preços simulados (para demonstração) ficam tracejados; os reais, em linha cheia.
  // O primeiro ponto real entra nos dois trechos para a linha não ficar quebrada.
  const primeiroReal = indices.find((i) => !pontos[i].simulado);
  const simulados = primeiroReal === undefined ? indices : indices.filter((i) => i <= primeiroReal);
  const reais = primeiroReal === undefined ? [] : indices.filter((i) => i >= primeiroReal);
  const trecho = (lista, extra) => (lista.length < 2 ? '' : `
      <polyline points="${lista.map(coordenada).join(' ')}" fill="none" stroke="#E29578" stroke-width="2"
        stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" ${extra}/>`);

  const comZoom = fim - ini < grafico.tMax - grafico.tMin - 1000;
  area.innerHTML = `
    <svg viewBox="0 0 ${GRAFICO_L} ${GRAFICO_A}" preserveAspectRatio="none" style="width:100%;height:100%;overflow:hidden;display:block">
      <line x1="0" y1="${GRAFICO_A / 2}" x2="${GRAFICO_L}" y2="${GRAFICO_A / 2}" stroke="#E8DFD2" stroke-width="1" vector-effect="non-scaling-stroke"/>
      ${trecho(simulados, 'stroke-dasharray="4 3" opacity="0.7"')}
      ${trecho(reais, '')}
    </svg>
    <div data-cursor="linha" style="position:absolute;top:0;bottom:0;width:1px;background:#C3C2B9;display:none;pointer-events:none"></div>
    <div data-cursor="ponto" style="position:absolute;width:8px;height:8px;border-radius:50%;background:#E29578;border:2px solid #fff;box-shadow:0 0 0 1px #B26548;transform:translate(-50%,-50%);display:none;pointer-events:none"></div>
    <div data-cursor="dica" style="position:absolute;transform:translate(-50%,-100%);background:#22181C;color:#FFF8EE;font:600 10px Inter,sans-serif;padding:3px 7px;border-radius:6px;white-space:nowrap;display:none;pointer-events:none;z-index:10"></div>
    ${comZoom ? '<span style="position:absolute;right:0;bottom:-2px;font:9px Inter,sans-serif;color:#706F66;pointer-events:none">2 cliques: ver tudo</span>' : ''}`;

  el('grafico-data-inicio').textContent = formatarDia(ini);
  el('grafico-data-meio').textContent = formatarDia((ini + fim) / 2);
  el('grafico-data-fim').textContent = formatarDia(fim);
}

function mostrarPrecoDoMouse(evento) {
  if (!grafico.pontos.length) return;
  const area = el('produto-grafico');
  const caixa = area.getBoundingClientRect();
  const fracao = Math.min(Math.max((evento.clientX - caixa.left) / caixa.width, 0), 1);
  const tMouse = grafico.ini + fracao * (grafico.fim - grafico.ini);

  // Ponto visível mais próximo do mouse.
  const { dentro } = janelaDoGrafico();
  const i = dentro.reduce((melhor, j) =>
    (Math.abs(grafico.tempos[j] - tMouse) < Math.abs(grafico.tempos[melhor] - tMouse) ? j : melhor), dentro[0]);
  const ponto = grafico.pontos[i];
  const xPx = xDoGrafico(grafico.tempos[i]) * caixa.width;
  const yPx = yDoGrafico(ponto.preco) * caixa.height;

  const [linha, marcador, dica] = ['linha', 'ponto', 'dica'].map((nome) => area.querySelector(`[data-cursor="${nome}"]`));
  linha.style.left = `${xPx}px`;
  marcador.style.left = `${xPx}px`;
  marcador.style.top = `${yPx}px`;
  marcador.style.borderStyle = ponto.simulado ? 'dashed' : 'solid';
  dica.textContent = `${formatarDia(grafico.tempos[i])} · ${formatarPreco(ponto.preco, estado.detalhe?.produto.moeda)}${ponto.simulado ? ' (simulado)' : ''}`;
  [linha, marcador, dica].forEach((elemento) => { elemento.style.display = 'block'; });

  // Mantém a dica dentro do gráfico (não corta nas bordas).
  const metade = dica.offsetWidth / 2;
  dica.style.left = `${Math.min(Math.max(xPx, metade), caixa.width - metade)}px`;
  dica.style.top = `${Math.max(yPx - 8, 0)}px`;
}

function esconderPrecoDoMouse() {
  el('produto-grafico').querySelectorAll('[data-cursor]').forEach((elemento) => { elemento.style.display = 'none'; });
}

function zoomComScroll(evento) {
  if (!grafico.pontos.length) return;
  const total = grafico.tMax - grafico.tMin;
  const atual = grafico.fim - grafico.ini;
  const aproximar = evento.deltaY < 0;
  // Já no período inteiro e rolando para afastar: deixa a página rolar normalmente.
  if (!aproximar && atual >= total) return;
  evento.preventDefault();

  const minimo = Math.min(total, 2 * UM_DIA);
  const novo = Math.min(Math.max(atual * (aproximar ? 0.8 : 1.25), minimo), total);
  const caixa = el('produto-grafico').getBoundingClientRect();
  const fracao = Math.min(Math.max((evento.clientX - caixa.left) / caixa.width, 0), 1);
  const tMouse = grafico.ini + fracao * atual;

  // O dia embaixo do mouse continua no mesmo lugar depois do zoom.
  let ini = tMouse - fracao * novo;
  ini = Math.min(Math.max(ini, grafico.tMin), grafico.tMax - novo);
  grafico.ini = ini;
  grafico.fim = ini + novo;
  renderizarGrafico();
  mostrarPrecoDoMouse(evento);
}

function configurarInteracaoDoGrafico() {
  const area = el('produto-grafico');
  area.style.position = 'relative';
  area.style.cursor = 'crosshair';
  area.addEventListener('mousemove', mostrarPrecoDoMouse);
  area.addEventListener('mouseleave', esconderPrecoDoMouse);
  area.addEventListener('wheel', zoomComScroll, { passive: false });
  area.addEventListener('dblclick', () => {
    if (!grafico.pontos.length) return;
    grafico.ini = grafico.tMin;
    grafico.fim = grafico.tMax;
    renderizarGrafico();
  });
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
  configurarInteracaoDoGrafico();
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
