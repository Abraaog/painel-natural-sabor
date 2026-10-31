/* Motor do bot de WhatsApp (máquina de estados por telefone).
   No sistema real isto roda no backend, recebendo mensagens do WAHA. */
(function (FP) {
  "use strict";
  const R = FP.regras;
  const T = FP.textos;
  const D = FP.dados;
  const E = () => FP.estado;

  const FINAIS = ["concluido", "cancelado", "abandonada"];
  const filas = new Map(); // uma mensagem por vez por telefone

  /* ---------- contexto ---------- */
  function ctx(tel) {
    const c = E().chat(tel);
    const p = c && c.pedidoId ? E().pedido(c.pedidoId) : null;
    return { c, p, bot: c ? c.bot : null, sabores: R.saboresDisponiveis(E().catalogo()) };
  }

  function hojeOk() {
    return R.validarEntrega("hoje", null, E().agora()).ok;
  }

  /* Texto que repete a pergunta de cada passo (usado no "voltar" e no "não entendi"). */
  function pergunta(passo, x) {
    const { p, bot, sabores } = x;
    const temp = bot.temp || {};
    switch (passo) {
      case "menu": return T.menuPrincipal(p && p.itens.length > 0);
      case "sabor": return T.listaSabores(sabores);
      case "tamanho": {
        const s = sabores.find((y) => y.saborId === temp.saborId);
        return s ? T.listaTamanhos(s.nome, s.variantes) : T.listaSabores(sabores);
      }
      case "qtd": {
        const v = R.variantesDisponiveis(E().catalogo()).find((y) => y.varianteId === temp.varianteId);
        return v ? T.perguntaQtd(v) : T.listaSabores(sabores);
      }
      case "carrinho": return T.carrinho(p.itens) + "\n\n" + T.menuCarrinho();
      case "remover": return T.escolhaRemover(p.itens);
      case "cep": return T.pedeCep();
      case "numero": return temp.endereco ? T.pedeNumero(temp.endereco) : T.pedeCep();
      case "entrega": return T.perguntaEntrega(hojeOk());
      case "data": return T.pedeData();
      case "resumo": return T.resumo(p);
      case "aguardando_pagamento": return T.aguardandoPagamento(p);
      case "acima100kg": return "Nossa equipe já foi avisada e vai combinar seu pedido por aqui. 🤝";
      default: return T.menuPrincipal(false);
    }
  }

  const ir = (bot, passo, temp) => ({
    passo,
    pilha: bot.passo && bot.passo !== passo ? bot.pilha.concat([bot.passo]).slice(-12) : bot.pilha,
    temp: Object.assign({}, bot.temp, temp || {}),
  });

  const opcao = (texto, max) => {
    const n = Number(String(texto).trim());
    return Number.isInteger(n) && n >= 1 && n <= max ? n : null;
  };

  /* ---------- passos ---------- */
  function finalizarCarrinho(x) {
    const { p, bot } = x;
    if (!p.itens.length) return { bot: ir(bot, "menu"), msgs: ["Seu carrinho está vazio.", T.menuPrincipal(false)] };
    if (R.excedeLimitePeso(p.itens)) {
      E().marcarAcimaLimite(p.id);
      return { bot: ir(bot, "acima100kg"), msgs: [T.acimaLimite(FP.util.kg(R.pesoTotalG(p.itens)))] };
    }
    return { bot: ir(bot, "cep"), msgs: [T.pedeCep()] };
  }

  function entrarResumo(x, entrega) {
    const p = E().pedido(x.p.id);
    const frete = R.calcularFrete(p.frete.km, E().config()); // recalcula com a configuração atual
    E().atualizarRascunho(p.id, { entrega, frete });
    return { bot: ir(x.bot, "resumo", { sugestao: null }), msgs: [T.resumo(E().pedido(p.id))] };
  }

  const PASSOS = {
    menu(x, t) {
      if (t === "1") return x.sabores.length
        ? { bot: ir(x.bot, "sabor"), msgs: [T.listaSabores(x.sabores)] }
        : { bot: x.bot, msgs: [T.foraDeOperacao()] };
      if (t === "2") return x.p.itens.length
        ? { bot: ir(x.bot, "carrinho"), msgs: [pergunta("carrinho", x)] }
        : { bot: x.bot, msgs: ["Seu carrinho está vazio.", T.menuPrincipal(false)] };
      if (t === "3" && x.p.itens.length) return finalizarCarrinho(x);
      return null;
    },
    sabor(x, t) {
      const n = opcao(t, x.sabores.length);
      if (!n) return null;
      const s = x.sabores[n - 1];
      return { bot: ir(x.bot, "tamanho", { saborId: s.saborId }), msgs: [T.listaTamanhos(s.nome, s.variantes)] };
    },
    tamanho(x, t) {
      const s = x.sabores.find((y) => y.saborId === x.bot.temp.saborId);
      if (!s) return { bot: ir(x.bot, "sabor"), msgs: ["Esse sabor acabou de sair do cardápio. 😕", T.listaSabores(x.sabores)] };
      const n = opcao(t, s.variantes.length);
      if (!n) return null;
      const v = s.variantes[n - 1];
      return { bot: ir(x.bot, "qtd", { varianteId: v.varianteId }), msgs: [T.perguntaQtd(v)] };
    },
    qtd(x, t) {
      const q = opcao(t, 9999);
      if (!q) return { bot: x.bot, msgs: ["Digite só o número de unidades (ex.: 3)."] };
      const v = R.variantesDisponiveis(E().catalogo()).find((y) => y.varianteId === x.bot.temp.varianteId);
      if (!v) return { bot: ir(x.bot, "sabor"), msgs: ["Esse item acabou de ficar indisponível. 😕", T.listaSabores(x.sabores)] };
      const existe = x.p.itens.find((i) => i.varianteId === v.varianteId);
      const itens = existe
        ? x.p.itens.map((i) => (i.varianteId === v.varianteId ? Object.assign({}, i, { qtd: i.qtd + q, precoCent: v.precoCent }) : i))
        : x.p.itens.concat([{ varianteId: v.varianteId, nome: v.nome, rotulo: v.rotulo, pesoG: v.pesoG, precoCent: v.precoCent, qtd: q }]);
      E().atualizarRascunho(x.p.id, { itens });
      const p = E().pedido(x.p.id);
      return { bot: ir(x.bot, "carrinho"), msgs: ["✅ Adicionado!\n\n" + T.carrinho(p.itens) + "\n\n" + T.menuCarrinho()] };
    },
    carrinho(x, t) {
      if (t === "1") return { bot: ir(x.bot, "sabor"), msgs: [T.listaSabores(x.sabores)] };
      if (t === "2" && x.p.itens.length) return { bot: ir(x.bot, "remover"), msgs: [T.escolhaRemover(x.p.itens)] };
      if (t === "3") return finalizarCarrinho(x);
      return null;
    },
    remover(x, t) {
      const n = opcao(t, x.p.itens.length);
      if (!n) return null;
      const itens = x.p.itens.filter((_, i) => i !== n - 1);
      E().atualizarRascunho(x.p.id, { itens });
      if (!itens.length) return { bot: ir(x.bot, "menu"), msgs: ["Item removido. Seu carrinho ficou vazio.", T.menuPrincipal(false)] };
      return { bot: ir(x.bot, "carrinho"), msgs: ["Item removido.\n\n" + T.carrinho(itens) + "\n\n" + T.menuCarrinho()] };
    },
    async cep(x, t) {
      if (!R.cepValido(t)) return { bot: x.bot, msgs: [T.cepInvalido()] };
      const e = await FP.cep.buscar(t);
      if (!e.ok) return { bot: x.bot, msgs: [T.cepNaoEncontrado()] };
      if (!R.cidadeAtendida(e.cidade, E().config().cidadesAtivas)) return { bot: x.bot, msgs: [T.cidadeFora(e.cidade)] };
      return { bot: ir(x.bot, "numero", { endereco: e }), msgs: [T.pedeNumero(e)] };
    },
    numero(x, t) {
      const e = x.bot.temp.endereco;
      if (!e) return { bot: ir(x.bot, "cep"), msgs: [T.pedeCep()] };
      if (t.length > 60) return null;
      const rota = D.kmPara(e.bairro, e.cidade);
      const frete = R.calcularFrete(rota.km, E().config());
      const endereco = {
        rua: e.rua, numero: t, bairro: e.bairro, cidade: e.cidade, uf: e.uf, cep: e.cep,
        kmEstimado: rota.estimado, fonteCep: e.fonte,
      };
      E().atualizarRascunho(x.p.id, { endereco, frete });
      return { bot: ir(x.bot, "entrega"), msgs: [T.perguntaEntrega(hojeOk())] };
    },
    entrega(x, t) {
      if (t === "1") {
        const v = R.validarEntrega("hoje", null, E().agora());
        if (!v.ok) return { bot: x.bot, msgs: [v.motivo + " Digite *2* para agendar."] };
        return entrarResumo(x, { tipo: "hoje", data: v.data });
      }
      if (t === "2") return { bot: ir(x.bot, "data"), msgs: [T.pedeData()] };
      return null;
    },
    data(x, t) {
      const iso = t === "1" && x.bot.temp.sugestao ? x.bot.temp.sugestao : R.interpretarDataBr(t, E().agora());
      const v = R.validarEntrega("agendada", iso, E().agora());
      if (!v.ok) {
        return {
          bot: Object.assign({}, x.bot, { temp: Object.assign({}, x.bot.temp, { sugestao: v.sugestao || null }) }),
          msgs: [T.dataRecusada(v.motivo, v.sugestao)],
        };
      }
      return entrarResumo(x, { tipo: "agendada", data: v.data });
    },
    resumo(x, t) {
      if (t === "2") return { bot: ir(x.bot, "carrinho"), msgs: [pergunta("carrinho", x)] };
      if (t !== "1") return null;
      const rv = R.revalidarCarrinho(x.p.itens, E().catalogo());
      if (rv.removidos.length || rv.precoMudou.length) {
        E().atualizarRascunho(x.p.id, { itens: rv.validos });
        const msgs = [];
        if (rv.removidos.length) msgs.push(T.itensRemovidos(rv.removidos));
        if (!rv.validos.length) return { bot: ir(x.bot, "menu"), msgs: msgs.concat([T.menuPrincipal(false)]) };
        if (rv.precoMudou.length) msgs.push(T.precosAtualizados());
        return { bot: x.bot, msgs: msgs.concat([T.resumo(E().pedido(x.p.id))]) };
      }
      const r = E().gerarLink(x.p.id);
      if (!r.ok) return { bot: x.bot, msgs: ["Não consegui gerar o link: " + r.motivo] };
      return { bot: ir(x.bot, "aguardando_pagamento"), msgs: [] }; // a mensagem do link sai do estado
    },
    aguardando_pagamento: (x) => ({ bot: x.bot, msgs: [T.aguardandoPagamento(x.p)] }),
    acima100kg: (x) => ({ bot: x.bot, msgs: [pergunta("acima100kg", x)] }),
  };

  /* ---------- comandos que valem em qualquer passo ---------- */
  function comando(x, t) {
    const n = R.normalizar(t);
    if (n === "cancelar") {
      E().cancelarPeloCliente(x.p.id);
      return { bot: { passo: "finalizado", pilha: [], temp: {} }, msgs: [T.canceladoCliente()] };
    }
    if (n === "recomecar") {
      if (x.p.status !== "conversa") return { bot: x.bot, msgs: ["Seu link de pagamento já foi gerado. Para desistir, digite *cancelar*."] };
      E().atualizarRascunho(x.p.id, { itens: [], endereco: null, frete: null, entrega: null });
      return { bot: { passo: "menu", pilha: [], temp: {} }, msgs: ["Tudo zerado. Vamos de novo! 🙂", T.menuPrincipal(false)] };
    }
    if (n === "voltar") {
      if (x.p.status !== "conversa" || !x.bot.pilha.length) return { bot: x.bot, msgs: [pergunta(x.bot.passo, x)] };
      const anterior = x.bot.pilha[x.bot.pilha.length - 1];
      const bot = { passo: anterior, pilha: x.bot.pilha.slice(0, -1), temp: x.bot.temp };
      return { bot, msgs: [pergunta(anterior, Object.assign({}, x, { bot, p: E().pedido(x.p.id) }))] };
    }
    if (n === "menu" && x.p.status === "conversa") {
      return { bot: ir(x.bot, "menu"), msgs: [T.menuPrincipal(x.p.itens.length > 0)] };
    }
    return null;
  }

  async function processar(tel, nome, texto) {
    const t = String(texto || "").trim().slice(0, 500);
    if (!t) return;
    let x = ctx(tel);

    if (!x.c) {
      E().abrirConversa(tel, nome);
      E().registrarMensagem(tel, "cliente", t);
      return saudar(tel, nome);
    }
    E().registrarMensagem(tel, "cliente", t);

    if (!x.p || FINAIS.includes(x.p.status)) {
      E().abrirConversa(tel, x.c.nome || nome);
      return saudar(tel, x.c.nome || nome);
    }
    if (["pago", "entrega"].includes(x.p.status)) {
      if (R.normalizar(t) === "novo") {
        E().abrirConversa(tel, x.c.nome);
        return saudar(tel, x.c.nome);
      }
      return responder(tel, x.bot, ["Seu pedido *" + x.p.numero + "* está *" + R.ETAPAS[x.p.status].rotulo +
        "*. Para fazer outro pedido, digite *novo*."]);
    }

    x = ctx(tel);
    const r = comando(x, t) || (PASSOS[x.bot.passo] ? await PASSOS[x.bot.passo](x, t) : null);
    if (r) return responder(tel, r.bot, r.msgs);
    return responder(tel, x.bot, [T.naoEntendi(), pergunta(x.bot.passo, x)]);
  }

  function saudar(tel, nome) {
    const x = ctx(tel);
    const primeiro = String(nome).split(" ")[0];
    if (!x.sabores.length) return responder(tel, x.bot, [T.foraDeOperacao()]);
    return responder(tel, x.bot, [T.saudacao(primeiro), T.menuPrincipal(false)]);
  }

  function responder(tel, bot, msgs) {
    E().salvarBot(tel, bot);
    msgs.filter(Boolean).forEach((m) => E().registrarMensagem(tel, "bot", m));
  }

  /* Enfileira por telefone: o cliente pode digitar rápido, o bot responde em ordem. */
  function receber(tel, nome, texto) {
    const anterior = filas.get(tel) || Promise.resolve();
    const prox = anterior.then(() => processar(tel, nome, texto)).catch((erro) => {
      console.error("[bot] erro ao processar mensagem", erro);
      E().registrarMensagem(tel, "bot", "Tive um problema aqui. 😕 Tente de novo em instantes.");
    });
    filas.set(tel, prox);
    return prox;
  }

  FP.bot = { receber };
})(window.FP = window.FP || {});
