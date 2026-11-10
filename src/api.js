// =====================================================================
// COMUNICAÇÃO COM O BACKEND E ARMAZENAMENTO LOCAL
// A extensão não tem login (o login é só do app mobile). Ela usa apenas as
// rotas públicas da API (análise e preços dos produtos). O Histórico, os
// Alertas e as preferências ficam guardados no próprio navegador.
// Fora da extensão (abrindo o popup.html direto no navegador para testar o
// visual), usa o localStorage no lugar do chrome.storage.
// =====================================================================

const EH_EXTENSAO = typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.tabs;

const armazenamento = {
  async ler(chave, padrao = null) {
    if (EH_EXTENSAO) return (await chrome.storage.local.get(chave))[chave] ?? padrao;
    try { return JSON.parse(localStorage.getItem(chave)) ?? padrao; } catch (e) { return padrao; }
  },
  async gravar(chave, valor) {
    if (EH_EXTENSAO) return chrome.storage.local.set({ [chave]: valor });
    localStorage.setItem(chave, JSON.stringify(valor));
  },
};

class ErroApi extends Error {
  constructor(mensagem, status) {
    super(mensagem);
    this.status = status;
  }
}

const api = {
  async requisicao(metodo, caminho, corpo) {
    let resposta;
    try {
      resposta = await fetch(`${ATALA_API_URL}${caminho}`, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
    } catch (e) {
      throw new ErroApi('Não foi possível conectar ao servidor do Atala.IA.', 0);
    }
    const dados = await resposta.json().catch(() => null);
    if (!resposta.ok) {
      const mensagem = dados && typeof dados.detail === 'string' ? dados.detail : 'Algo deu errado. Tente de novo.';
      throw new ErroApi(mensagem, resposta.status);
    }
    return dados;
  },

  observar: (produto) => api.requisicao('POST', '/produtos/observar', produto),
  produto: (id) => api.requisicao('GET', `/produtos/${id}`),
  historicoPrecos: (id, dias = 30) => api.requisicao('GET', `/produtos/${id}/historico?dias=${dias}`),
};

// ---------- Histórico local: produtos analisados neste navegador ----------
const historicoLocal = {
  async listar() {
    return armazenamento.ler('atalaHistorico', []);
  },
  async registrar(produtoId) {
    const lista = (await this.listar()).filter((i) => i.produto_id !== produtoId);
    lista.unshift({ produto_id: produtoId, visto_em: new Date().toISOString() });
    await armazenamento.gravar('atalaHistorico', lista.slice(0, 50));
  },
};

// ---------- Alertas locais: um por produto ----------
const alertasLocais = {
  async listar() {
    return armazenamento.ler('atalaAlertas', []);
  },
  async salvar(produtoId, precoAlvo) {
    const lista = (await this.listar()).filter((a) => a.produto_id !== produtoId);
    lista.unshift({ produto_id: produtoId, preco_alvo: precoAlvo, ativo: true, criado_em: new Date().toISOString() });
    await armazenamento.gravar('atalaAlertas', lista);
  },
  async definirAtivo(produtoId, ativo) {
    const lista = await this.listar();
    const alerta = lista.find((a) => a.produto_id === produtoId);
    if (alerta) alerta.ativo = ativo;
    await armazenamento.gravar('atalaAlertas', lista);
  },
  async ativoPara(produtoId) {
    return (await this.listar()).some((a) => a.produto_id === produtoId && a.ativo);
  },
};

// O backend devolve datas em UTC sem fuso ("2026-11-07T20:00:00").
function dataDaApi(texto) {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(texto) ? texto : `${texto}Z`);
}

function formatarPreco(valor, moeda = 'BRL') {
  if (valor === null || valor === undefined) return '—';
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda }).format(valor);
  } catch (e) {
    return `R$ ${Number(valor).toFixed(2).replace('.', ',')}`;
  }
}

function tempoRelativo(data) {
  const minutos = Math.round((Date.now() - data.getTime()) / 60000);
  if (minutos < 1) return 'Atualizado agora';
  if (minutos < 60) return `Atualizado há ${minutos} minuto${minutos > 1 ? 's' : ''}`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `Atualizado há ${horas} hora${horas > 1 ? 's' : ''}`;
  const dias = Math.round(horas / 24);
  return `Atualizado há ${dias} dia${dias > 1 ? 's' : ''}`;
}
