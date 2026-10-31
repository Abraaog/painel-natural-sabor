/* Estado do protótipo (faz o papel do backend + banco).
   Toda mudança de status passa por aqui e fica no histórico do pedido.
   É uma demonstração: o estado vive só em memória durante o uso; recarregar
   a página volta tudo ao início (seed). O localStorage é usado apenas para
   sincronizar abas abertas ao mesmo tempo (painel numa aba, simulador na
   outra), nunca para restaurar sessões anteriores. */
(function (FP) {
  "use strict";
  const R = FP.regras;
  const T = FP.textos;
  const CHAVE = "fp-prototipo-v2";
  const CHAVE_SESSAO = "fp-sessao";

  let st = null;
  const ouvintes = new Set();

  const agora = () => Date.now() + (st ? st.offsetMs : 0);

  function emitir(evento) {
    ouvintes.forEach((fn) => {
      try { fn(evento); } catch (erro) { console.error("[estado] ouvinte falhou", erro); }
    });
  }

  function persistir() {
    try { localStorage.setItem(CHAVE, JSON.stringify(st)); } catch (erro) { /* sem storage: segue só em memória */ }
  }

  function commit(novo, evento) {
    st = novo;
    persistir();
    emitir(evento || { tipo: "mudou" });
  }

  /* Sempre começa limpo, do seed: não restaura estado salvo. Assim um F5
     devolve o protótipo ao estado inicial. (Ainda escreve no localStorage,
     mas só para a sincronização entre abas abaixo.) */
  function carregar() {
    st = FP.seed.gerar(Date.now());
    persistir();
  }

  window.addEventListener("storage", (e) => {
    if (e.key !== CHAVE || !e.newValue) return;
    try {
      st = JSON.parse(e.newValue);
      emitir({ tipo: "sync" });
    } catch (erro) { /* ignora escrita parcial */ }
  });

  /* ---------- leitura ---------- */
  const pedidos = () => st.pedidos;
  const pedido = (id) => st.pedidos.find((p) => p.id === id) || null;
  const config = () => st.config;
  const catalogo = () => st.catalogo;
  const chats = () => st.chats;
  const chat = (tel) => st.chats[tel] || null;

  /* ---------- helpers imutáveis ---------- */
  function trocarPedido(estado, id, fn) {
    return Object.assign({}, estado, { pedidos: estado.pedidos.map((p) => (p.id === id ? fn(p) : p)) });
  }

  function transicao(p, para, autor, obs, extra) {
    const t = agora();
    return Object.assign({}, p, extra || {}, {
      status: para,
      etapaDesde: t,
      historico: p.historico.concat([{ em: t, de: p.status, para, autor, obs: obs || "" }]),
    });
  }

  function anotar(p, autor, obs, extra) {
    return Object.assign({}, p, extra || {}, {
      historico: p.historico.concat([{ em: agora(), de: p.status, para: p.status, autor, obs }]),
    });
  }

  function comMensagem(estado, tel, de, texto, extra) {
    const c = estado.chats[tel];
    if (!c) return estado;
    const msg = Object.assign({ de, texto, em: agora() }, extra || {});
    const novoChat = Object.assign({}, c, { mensagens: c.mensagens.concat([msg]) });
    return Object.assign({}, estado, { chats: Object.assign({}, estado.chats, { [tel]: novoChat }) });
  }

  /* ---------- conversa / bot ---------- */
  function abrirConversa(tel, nome) {
    const seq = st.seq + 1;
    const t = agora();
    const p = {
      id: "ped-" + seq + "-" + t.toString(36),
      numero: "P-" + (2040 + seq),
      cliente: nome,
      telefone: tel,
      criadoEm: t,
      ultimaMsgEm: t,
      etapaDesde: t,
      status: "conversa",
      passoBot: "menu",
      itens: [],
      endereco: null,
      frete: null,
      freteCent: 0,
      subtotalCent: 0,
      totalCent: 0,
      entrega: null,
      link: null,
      pagamentos: [],
      historico: [{ em: t, de: null, para: "conversa", autor: "Bot", obs: "Primeira mensagem no WhatsApp" }],
      acima100kg: false,
      alertaTardio: false,
      motivo: "",
    };
    const antigo = st.chats[tel];
    const novoChat = {
      telefone: tel,
      nome,
      pedidoId: p.id,
      bot: { passo: "menu", pilha: [], temp: {} },
      mensagens: antigo ? antigo.mensagens : [],
    };
    commit(Object.assign({}, st, {
      seq,
      pedidos: st.pedidos.concat([p]),
      chats: Object.assign({}, st.chats, { [tel]: novoChat }),
    }), { tipo: "novo", id: p.id });
    return p;
  }

  function registrarMensagem(tel, de, texto, extra) {
    let novo = comMensagem(st, tel, de, texto, extra);
    const c = novo.chats[tel];
    if (de === "cliente" && c && c.pedidoId) {
      novo = trocarPedido(novo, c.pedidoId, (p) => Object.assign({}, p, { ultimaMsgEm: agora() }));
    }
    commit(novo, { tipo: "mensagem", tel });
  }

  function salvarBot(tel, bot) {
    const c = st.chats[tel];
    const novoChat = Object.assign({}, c, { bot });
    let novo = Object.assign({}, st, { chats: Object.assign({}, st.chats, { [tel]: novoChat }) });
    if (c.pedidoId) {
      novo = trocarPedido(novo, c.pedidoId, (p) => (p.status === "conversa" ? Object.assign({}, p, { passoBot: bot.passo }) : p));
    }
    commit(novo, { tipo: "bot", tel });
  }

  /* Dados que o bot coleta: itens, endereço, frete, entrega. Só em Conversa iniciada. */
  function atualizarRascunho(id, patch) {
    const p = pedido(id);
    if (!p || p.status !== "conversa") return;
    const itens = patch.itens || p.itens;
    const sub = R.subtotalCent(itens);
    const frete = "frete" in patch ? patch.frete : p.frete;
    const freteCent = frete ? frete.totalCent : 0;
    commit(trocarPedido(st, id, (x) => Object.assign({}, x, patch, {
      itens,
      frete,
      subtotalCent: sub,
      freteCent,
      totalCent: sub + freteCent,
    })), { tipo: "rascunho", id });
  }

  function marcarAcimaLimite(id) {
    commit(trocarPedido(st, id, (p) => anotar(p, "Bot", "Carrinho passou de 100 kg. Combinar pelo WhatsApp",
      { acima100kg: true, passoBot: "acima100kg" })), { tipo: "acima100kg", id });
  }

  /* Gera o link do Mercado Pago. O frete fica congelado no pedido a partir daqui. */
  function gerarLink(id) {
    const p = pedido(id);
    if (!p || p.status !== "conversa") return { ok: false, motivo: "Pedido não está em Conversa iniciada." };
    if (!p.itens.length || !p.endereco || !p.frete || !p.entrega) return { ok: false, motivo: "Pedido incompleto." };
    if (R.excedeLimitePeso(p.itens)) return { ok: false, motivo: "Acima de 100 kg não gera link." };
    const t = agora();
    const prefId = "pref-" + Math.random().toString(36).slice(2, 10);
    const link = {
      id: prefId,
      url: "https://mpago.la/" + prefId.slice(5, 11),
      criadoEm: t,
      expiraEm: t + st.config.janelaPagamentoMin * R.MINUTO,
    };
    const novoP = transicao(p, "nao_pago", "Bot", "Link do Mercado Pago gerado (vale " + st.config.janelaPagamentoMin + " min)",
      { link, passoBot: "aguardando_pagamento" });
    let novo = trocarPedido(st, id, () => novoP);
    novo = comMensagem(novo, p.telefone, "bot", T.link(novoP, st.config.janelaPagamentoMin), { linkPedidoId: id });
    commit(novo, { tipo: "link", id });
    return { ok: true, pedido: novoP };
  }

  /* Webhook do Mercado Pago. Idempotente: o mesmo pagamentoId não processa duas vezes. */
  function processarWebhook(id, pagamentoId, metodo) {
    const p = pedido(id);
    if (!p) return { resultado: "inexistente" };
    const resultado = R.avaliarPagamento(p, pagamentoId);
    const pg = { id: pagamentoId, metodo, valorCent: p.totalCent, em: agora(), tardio: resultado === "tardio" };

    if (resultado === "confirmar") {
      const novoP = transicao(p, "pago", "Mercado Pago (webhook)", "Pagamento aprovado via " + metodo,
        { pagamentos: p.pagamentos.concat([pg]), passoBot: "finalizado" });
      let novo = trocarPedido(st, id, () => novoP);
      novo = comMensagem(novo, p.telefone, "bot", T.pago(novoP));
      commit(novo, { tipo: "pago", id });
    } else if (resultado === "tardio") {
      const novoP = anotar(p, "Mercado Pago (webhook)", "Pagamento chegou DEPOIS do cancelamento. Conferir com o cliente",
        { pagamentos: p.pagamentos.concat([pg]), alertaTardio: true });
      let novo = trocarPedido(st, id, () => novoP);
      novo = comMensagem(novo, p.telefone, "bot", T.pagouDepois(novoP));
      commit(novo, { tipo: "tardio", id });
    } else {
      emitir({ tipo: "webhook-ignorado", id, resultado });
    }
    return { resultado };
  }

  /* Por que o operador NÃO pode mover este pedido para "para" (null = pode). */
  function motivoMovimento(id, para) {
    const p = pedido(id);
    if (!p) return "Pedido não encontrado.";
    const bloqueio = R.motivoBloqueioMovimento(p.status, para);
    if (bloqueio) return bloqueio;
    if (para === "entrega" && p.entrega && p.entrega.data > R.isoLocal(agora())) {
      return "Entrega agendada para " + R.dataBr(p.entrega.data) + ". Só sai no dia.";
    }
    return null;
  }

  /* Ações do operador: só Pago→Em entrega e Em entrega→Concluído. */
  function moverManual(id, para, operador) {
    const motivo = motivoMovimento(id, para);
    if (motivo) return { ok: false, motivo };
    const p = pedido(id);
    const novoP = transicao(p, para, operador || "Operador", para === "entrega" ? "Enviado para entrega" : "Entrega concluída");
    let novo = trocarPedido(st, id, () => novoP);
    novo = comMensagem(novo, p.telefone, "bot", para === "entrega" ? T.saiuEntrega(novoP) : T.entregue(novoP));
    commit(novo, { tipo: "movido", id, para });
    return { ok: true };
  }

  function marcarTardioConferido(id, operador) {
    commit(trocarPedido(st, id, (p) => anotar(p, operador || "Operador", "Pagamento tardio conferido com o cliente",
      { alertaTardio: false })), { tipo: "mudou" });
  }

  function cancelarPeloCliente(id) {
    const p = pedido(id);
    if (!p || !["conversa", "nao_pago"].includes(p.status)) return;
    const obs = p.status === "nao_pago" ? "Cliente digitou cancelar, link invalidado" : "Cliente digitou cancelar";
    commit(trocarPedido(st, id, (x) => transicao(x, "cancelado", "Cliente", obs,
      { motivo: "Cancelado pelo cliente", passoBot: "finalizado" })), { tipo: "cancelado", id });
  }

  /* Roda a cada segundo: cancela link vencido e marca conversa abandonada. */
  function tick() {
    const t = agora();
    let novo = st;
    const eventos = [];
    st.pedidos.forEach((p) => {
      if (R.linkExpirado(p, t)) {
        novo = trocarPedido(novo, p.id, (x) => transicao(x, "cancelado", "Sistema", "Link expirou sem pagamento, link invalidado",
          { motivo: "Link expirou (" + novo.config.janelaPagamentoMin + " min)", passoBot: "finalizado" }));
        novo = comMensagem(novo, p.telefone, "bot", T.expirou(novo.config.janelaPagamentoMin));
        eventos.push({ tipo: "expirou", id: p.id });
      } else if (R.conversaAbandonada(p, t, novo.config.abandonoHoras)) {
        novo = trocarPedido(novo, p.id, (x) => transicao(x, "abandonada", "Sistema",
          novo.config.abandonoHoras + " h sem mensagem", { motivo: "Conversa parada por " + novo.config.abandonoHoras + " h" }));
        eventos.push({ tipo: "abandonou", id: p.id });
      }
    });
    if (eventos.length) commit(novo, { tipo: "lote", eventos });
  }

  /* ---------- configuração e catálogo ---------- */
  function salvarConfig(parcial) {
    const cfg = Object.assign({}, st.config, parcial);
    const erros = R.validarConfigFrete(cfg);
    if (!(Number.isInteger(cfg.janelaPagamentoMin) && cfg.janelaPagamentoMin >= 5 && cfg.janelaPagamentoMin <= 60))
      erros.push("Prazo do link precisa ficar entre 5 e 60 minutos.");
    if (!(Number.isInteger(cfg.abandonoHoras) && cfg.abandonoHoras >= 1 && cfg.abandonoHoras <= 72))
      erros.push("Prazo de abandono precisa ficar entre 1 e 72 horas.");
    if (!cfg.cidadesAtivas.length) erros.push("Deixe pelo menos uma cidade ligada.");
    if (erros.length) return { ok: false, erros };
    commit(Object.assign({}, st, { config: cfg }), { tipo: "config" });
    return { ok: true };
  }

  function mapearCatalogo(fn) {
    commit(Object.assign({}, st, { catalogo: fn(st.catalogo) }), { tipo: "catalogo" });
  }

  const mapSabor = (cat, saborId, fn) => cat.map((prod) => Object.assign({}, prod, {
    sabores: prod.sabores.map((s) => (s.id === saborId ? fn(s) : s)),
  }));

  function alternarSabor(saborId, ativo) {
    if (ativo) {
      const sabor = st.catalogo.flatMap((p) => p.sabores).find((s) => s.id === saborId);
      if (!R.saborTemPreco(sabor)) return { ok: false, motivo: "Defina o preço de um tamanho antes de ligar o sabor." };
    }
    mapearCatalogo((cat) => mapSabor(cat, saborId, (s) => Object.assign({}, s, { ativo })));
    return { ok: true };
  }

  function alternarVariante(saborId, varianteId, ativo) {
    mapearCatalogo((cat) => mapSabor(cat, saborId, (s) => Object.assign({}, s, {
      variantes: s.variantes.map((v) => (v.id === varianteId ? Object.assign({}, v, { ativo }) : v)),
    })));
  }

  function alterarPreco(saborId, varianteId, precoCent) {
    if (!(Number.isInteger(precoCent) && precoCent > 0)) return { ok: false, motivo: "Preço precisa ser maior que zero." };
    mapearCatalogo((cat) => mapSabor(cat, saborId, (s) => Object.assign({}, s, {
      variantes: s.variantes.map((v) => (v.id === varianteId ? Object.assign({}, v, { precoCent }) : v)),
    })));
    return { ok: true };
  }

  /* Nada é de graça: o sabor nasce com um tamanho e um preço > 0.
     Começa desligado, mas já pode ser ligado porque tem preço. */
  function novoSabor(produtoId, nome, tamanhoRotulo, precoCent) {
    const limpo = String(nome || "").trim();
    if (limpo.length < 2) return { ok: false, motivo: "Nome do sabor muito curto." };
    const existe = st.catalogo.some((p) => p.sabores.some((s) => R.normalizar(s.nome) === R.normalizar(limpo)));
    if (existe) return { ok: false, motivo: "Esse sabor já existe." };
    const rotulo = String(tamanhoRotulo || "").trim();
    const pesoG = R.pesoDeRotulo(rotulo);
    if (!pesoG) return { ok: false, motivo: "Informe o tamanho com a unidade: ex. 1 kg, 500 g." };
    if (!(Number.isInteger(precoCent) && precoCent > 0)) return { ok: false, motivo: "Preço precisa ser maior que zero (nada é de graça)." };
    const id = "sab-" + Date.now().toString(36);
    mapearCatalogo((cat) => cat.map((p) => (p.id !== produtoId ? p : Object.assign({}, p, {
      sabores: p.sabores.concat([{
        id,
        nome: limpo,
        ativo: false,
        variantes: [{ id: id + "-" + pesoG, rotulo, pesoG, precoCent, ativo: true }],
      }]),
    }))));
    return { ok: true, id };
  }

  /* Adiciona um tamanho a um sabor existente (também já com preço > 0). */
  function novoTamanho(saborId, tamanhoRotulo, precoCent) {
    const rotulo = String(tamanhoRotulo || "").trim();
    const pesoG = R.pesoDeRotulo(rotulo);
    if (!pesoG) return { ok: false, motivo: "Informe o tamanho com a unidade: ex. 1 kg, 500 g." };
    if (!(Number.isInteger(precoCent) && precoCent > 0)) return { ok: false, motivo: "Preço precisa ser maior que zero (nada é de graça)." };
    const sabor = st.catalogo.flatMap((p) => p.sabores).find((s) => s.id === saborId);
    if (!sabor) return { ok: false, motivo: "Sabor não encontrado." };
    if (sabor.variantes.some((v) => R.normalizar(v.rotulo) === R.normalizar(rotulo))) return { ok: false, motivo: "Esse tamanho já existe nesse sabor." };
    const id = saborId + "-" + pesoG + "-" + Date.now().toString(36);
    mapearCatalogo((cat) => mapSabor(cat, saborId, (s) => Object.assign({}, s, {
      variantes: s.variantes.concat([{ id, rotulo, pesoG, precoCent, ativo: true }]),
    })));
    return { ok: true, id };
  }

  /* ---------- relógio de simulação ---------- */
  function avancarRelogio(ms) {
    commit(Object.assign({}, st, { offsetMs: st.offsetMs + ms }), { tipo: "relogio" });
    tick();
  }

  function zerarRelogio() {
    commit(Object.assign({}, st, { offsetMs: 0 }), { tipo: "relogio" });
  }

  function resetar() {
    commit(FP.seed.gerar(Date.now()), { tipo: "reset" });
  }

  /* ---------- sessão do operador ---------- */
  const HASH_DEMO = FP.util.sha256(FP.dados.OPERADOR_DEMO.senhaDemo);

  function entrar(email, senha) {
    const op = FP.dados.OPERADOR_DEMO;
    const ok = R.normalizar(email) === op.email && FP.util.sha256(String(senha)) === HASH_DEMO;
    if (!ok) return { ok: false, motivo: "E-mail ou senha incorretos." };
    const sessao = { email: op.email, nome: op.nome, desde: Date.now() };
    try { localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao)); } catch (erro) { /* sessão só nesta aba */ }
    return { ok: true, sessao };
  }

  function sessao() {
    try { return JSON.parse(localStorage.getItem(CHAVE_SESSAO) || "null"); } catch (erro) { return null; }
  }

  function sair() {
    try { localStorage.removeItem(CHAVE_SESSAO); } catch (erro) { /* nada */ }
  }

  FP.estado = {
    carregar, agora, on: (fn) => { ouvintes.add(fn); return () => ouvintes.delete(fn); },
    pedidos, pedido, config, catalogo, chats, chat,
    abrirConversa, registrarMensagem, salvarBot, atualizarRascunho, marcarAcimaLimite,
    gerarLink, processarWebhook, motivoMovimento, moverManual, marcarTardioConferido, cancelarPeloCliente, tick,
    salvarConfig, alternarSabor, alternarVariante, alterarPreco, novoSabor, novoTamanho,
    avancarRelogio, zerarRelogio, resetar,
    entrar, sessao, sair,
    offset: () => st.offsetMs,
  };
})(window.FP = window.FP || {});
