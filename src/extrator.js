// =====================================================================
// LEITOR DA PÁGINA DO PRODUTO
// ---------------------------------------------------------------------
// Esta função é "injetada" na aba da loja quando o usuário abre o popup
// (chrome.scripting.executeScript). Por isso ela precisa ser 100% autocontida:
// não pode usar nenhuma variável ou função de fora dela.
//
// Ordem de tentativa:
//   1. Dados estruturados (JSON-LD "Product") que as lojas colocam para o Google
//   2. Meta tags (og:title, og:image, product:price:amount, itemprop=price)
//   3. Seletores específicos de algumas lojas (Mercado Livre, Amazon...)
//
// Devolve { url, loja, titulo, preco, preco_original, imagem_url, moeda }
// ou null se a página não parecer ser de um produto.
// =====================================================================
function extrairProduto() {
  const texto = (el) => (el ? (el.getAttribute('content') || el.textContent || '').trim() : '');
  const $ = (seletor) => document.querySelector(seletor);

  // "R$ 1.299,90" -> 1299.9   |   "1299.90" -> 1299.9   |   "$1,299.90" -> 1299.9
  function lerPreco(valor) {
    if (valor === null || valor === undefined) return null;
    if (typeof valor === 'number') return valor > 0 ? valor : null;
    let s = String(valor).replace(/[^\d.,]/g, '');
    if (!s) return null;
    if (/^\d+(\.\d+)?$/.test(s) && !/^\d{1,3}\.\d{3}$/.test(s)) {
      // formato "máquina": 1299.90
    } else if (s.includes(',') && s.includes('.')) {
      s = s.lastIndexOf(',') > s.lastIndexOf('.')
        ? s.replace(/\./g, '').replace(',', '.')   // 1.299,90
        : s.replace(/,/g, '');                      // 1,299.90
    } else if (s.includes(',')) {
      s = /,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    } else {
      s = s.replace(/\./g, ''); // 1.299 (milhar no padrão brasileiro)
    }
    const n = parseFloat(s);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
  }

  // Preço no formato do Mercado Livre: <span fraction>1.299</span><span cents>90</span>
  function lerPrecoAndes(container) {
    if (!container) return null;
    const inteiro = texto(container.querySelector('.andes-money-amount__fraction'));
    if (!inteiro) return null;
    const centavos = texto(container.querySelector('.andes-money-amount__cents')) || '00';
    return lerPreco(`${inteiro},${centavos}`);
  }

  // ---------- 1. JSON-LD ----------
  function produtosJsonLd() {
    const encontrados = [];
    const visitar = (no) => {
      if (!no || typeof no !== 'object') return;
      if (Array.isArray(no)) return no.forEach(visitar);
      const tipo = [].concat(no['@type'] || []);
      if (tipo.includes('Product') || tipo.includes('ProductGroup')) encontrados.push(no);
      if (no['@graph']) visitar(no['@graph']);
    };
    document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
      try { visitar(JSON.parse(s.textContent)); } catch (e) { /* JSON inválido: ignora */ }
    });
    return encontrados;
  }

  const ld = produtosJsonLd()[0] || {};
  let ofertas = [].concat(ld.offers || (ld.hasVariant && ld.hasVariant[0] && ld.hasVariant[0].offers) || []);
  ofertas = ofertas.flatMap((o) => (o && o.offers ? [].concat(o.offers) : [o])).filter(Boolean);
  const oferta = ofertas[0] || {};

  let preco = lerPreco(oferta.price ?? oferta.lowPrice ?? (oferta.priceSpecification && oferta.priceSpecification.price));
  let moeda = oferta.priceCurrency || null;
  let titulo = ld.name || '';
  let imagem = ld.image;
  if (Array.isArray(imagem)) imagem = imagem[0];
  if (imagem && typeof imagem === 'object') imagem = imagem.url || imagem.contentUrl;

  // ---------- 2. Meta tags ----------
  titulo = titulo || texto($('meta[property="og:title"]'));
  imagem = imagem || texto($('meta[property="og:image"]'));
  preco = preco || lerPreco(texto($('meta[property="product:price:amount"]')) || texto($('meta[itemprop="price"]')));
  moeda = moeda || texto($('meta[property="product:price:currency"]')) || texto($('meta[itemprop="priceCurrency"]')) || null;

  // ---------- 3. Seletores por loja ----------
  const host = location.hostname.replace(/^www\./, '');
  let precoOriginal = null;

  if (host.includes('mercadolivre') || host.includes('mercadolibre')) {
    titulo = texto($('h1.ui-pdp-title')) || titulo;
    preco = lerPrecoAndes($('.ui-pdp-price__second-line .andes-money-amount')) || preco;
    precoOriginal = lerPrecoAndes($('.ui-pdp-price__original-value'));
    imagem = $('.ui-pdp-gallery__figure img')?.getAttribute('src') || imagem;
  } else if (host.includes('amazon.')) {
    titulo = texto($('#productTitle')) || titulo;
    preco = lerPreco(texto($('#corePrice_feature_div .a-price .a-offscreen')))
      || lerPreco(texto($('.priceToPay .a-offscreen')))
      || lerPreco(texto($('#corePriceDisplay_desktop_feature_div .a-price .a-offscreen')))
      || preco;
    precoOriginal = lerPreco(texto($('.basisPrice .a-offscreen')))
      || lerPreco(texto($('.a-price.a-text-price[data-a-strike="true"] .a-offscreen')));
    imagem = $('#landingImage')?.getAttribute('data-old-hires') || $('#landingImage')?.getAttribute('src') || imagem;
  }

  // Preço riscado genérico: <s>, <del>, texto tachado (line-through) ou classes com
  // "original/old/list/from". Pega o primeiro da página (o do produto principal costuma vir
  // antes das recomendações) e só se for maior que o preço atual.
  if (!precoOriginal && preco) {
    const candidatos = document.querySelectorAll(
      's, del, [class*="line-through"], [class*="original-price"], [class*="old-price"], [class*="list-price"], [class*="price-from"], [class*="priceFrom"], [class*="oldPrice"]'
    );
    for (const el of Array.from(candidatos).slice(0, 40)) {
      const t = el.textContent || '';
      if (!/\d/.test(t) || t.length > 40) continue;
      const v = lerPreco(t);
      if (v && v > preco && v < preco * 3) { precoOriginal = v; break; }
    }
  }
  if (precoOriginal && preco && precoOriginal <= preco) precoOriginal = null;

  titulo = (titulo || texto($('h1'))).replace(/\s+/g, ' ').trim().slice(0, 500);
  if (!titulo || !preco) return null; // não parece uma página de produto

  const lojas = {
    mercadolivre: 'Mercado Livre', mercadolibre: 'Mercado Livre', amazon: 'Amazon', shopee: 'Shopee',
    magazineluiza: 'Magazine Luiza', magalu: 'Magazine Luiza', americanas: 'Americanas',
    casasbahia: 'Casas Bahia', kabum: 'KaBuM!', aliexpress: 'AliExpress', netshoes: 'Netshoes',
    pontofrio: 'Ponto', carrefour: 'Carrefour', submarino: 'Submarino', shein: 'Shein',
  };
  const chave = Object.keys(lojas).find((k) => host.includes(k));
  const loja = chave ? lojas[chave] : (texto($('meta[property="og:site_name"]')) || host).slice(0, 100);

  // URL canônica (sem parâmetros de rastreamento), se for do mesmo site
  let url = location.href;
  const canonica = $('link[rel="canonical"]')?.href;
  try {
    if (canonica && new URL(canonica).hostname.endsWith(host.split('.').slice(-2).join('.'))) url = canonica;
  } catch (e) { /* canonical inválida: usa a URL da aba */ }

  let imagemUrl = null;
  try { imagemUrl = imagem ? new URL(imagem, location.href).href : null; } catch (e) { imagemUrl = null; }
  if (imagemUrl && !/^https?:/.test(imagemUrl)) imagemUrl = null;

  return {
    url,
    loja,
    titulo,
    preco,
    preco_original: precoOriginal,
    imagem_url: imagemUrl,
    moeda: (moeda || 'BRL').toUpperCase().slice(0, 3),
  };
}
