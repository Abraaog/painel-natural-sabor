/* Gera o estado inicial do protótipo: pedidos em todas as etapas, coerentes com as regras. */
(function (FP) {
  "use strict";
  const R = FP.regras;
  const D = FP.dados;
  const MIN = R.MINUTO;
  const HORA = R.HORA;

  function acharVariante(catalogo, varianteId) {
    for (const prod of catalogo) {
      for (const sab of prod.sabores) {
        const v = sab.variantes.find((x) => x.id === varianteId);
        if (v) return { nome: prod.nome + " de " + sab.nome, v };
      }
    }
    throw new Error("Variante de exemplo não existe: " + varianteId);
  }

  function item(catalogo, varianteId, qtd) {
    const { nome, v } = acharVariante(catalogo, varianteId);
    return { varianteId, nome, rotulo: v.rotulo, pesoG: v.pesoG, precoCent: v.precoCent, qtd };
  }

  function base(seq, cliente, telefone, criadoEm) {
    return {
      id: "ped-" + seq,
      numero: "P-" + (2040 + seq),
      cliente,
      telefone,
      criadoEm,
      ultimaMsgEm: criadoEm,
      etapaDesde: criadoEm,
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
      historico: [{ em: criadoEm, de: null, para: "conversa", autor: "Bot", obs: "Primeira mensagem no WhatsApp" }],
      acima100kg: false,
      alertaTardio: false,
      motivo: "",
    };
  }

  function comItens(p, itens, passo) {
    return Object.assign({}, p, {
      itens,
      passoBot: passo || p.passoBot,
      subtotalCent: R.subtotalCent(itens),
      totalCent: R.subtotalCent(itens),
    });
  }

  function fechar(p, cfg, end, entrega) {
    const { km } = D.kmPara(end.bairro, end.cidade);
    const frete = R.calcularFrete(km, cfg);
    const sub = R.subtotalCent(p.itens);
    return Object.assign({}, p, {
      endereco: end,
      frete,
      freteCent: frete.totalCent,
      subtotalCent: sub,
      totalCent: sub + frete.totalCent,
      entrega,
    });
  }

  function avancar(p, para, em, autor, obs, extra) {
    return Object.assign({}, p, extra || {}, {
      status: para,
      etapaDesde: em,
      historico: p.historico.concat([{ em, de: p.status, para, autor, obs: obs || "" }]),
    });
  }

  function comLink(p, em, cfg) {
    const id = "pref-" + p.id;
    const link = {
      id,
      url: "https://mpago.la/" + id.slice(-6) + "x" + String(em).slice(-4),
      criadoEm: em,
      expiraEm: em + cfg.janelaPagamentoMin * MIN,
    };
    return avancar(p, "nao_pago", em, "Bot", "Link do Mercado Pago gerado", { link, passoBot: "aguardando_pagamento" });
  }

  function comPagamento(p, em, metodo) {
    const pg = { id: "mp-" + p.id, metodo, valorCent: p.totalCent, em, tardio: false };
    return avancar(p, "pago", em, "Mercado Pago (webhook)", "Pagamento aprovado via " + metodo,
      { pagamentos: [pg], passoBot: "finalizado" });
  }

  function end(rua, numero, bairro, cidade, cep) {
    return { rua, numero, bairro, cidade, uf: "PB", cep };
  }

  /* Dia útil N dias atrás (para pedidos concluídos ficarem em dia útil). */
  function diaUtilAtras(agora, n) {
    let iso = R.somarDias(R.isoLocal(agora), -n);
    while (!R.eDiaUtil(iso)) iso = R.somarDias(iso, -1);
    return iso;
  }

  function gerar(agora) {
    const cfg = Object.assign({}, D.CONFIG_PADRAO, { cidadesAtivas: D.CONFIG_PADRAO.cidadesAtivas.slice() });
    const cat = D.catalogoInicial();
    const hoje = R.isoLocal(agora);
    const entregaHoje = R.eDiaUtil(hoje)
      ? { tipo: "hoje", data: hoje }
      : { tipo: "agendada", data: R.proximoDiaUtil(R.somarDias(hoje, 1)) };
    const agendada = { tipo: "agendada", data: R.proximoDiaUtil(R.somarDias(hoje, 4)) };
    const P = [];
    let s = 0;
    const n = () => (s += 1);

    /* ---- Conversa iniciada ---- */
    let p = base(n(), "Maria Silva", "5583999991234", agora - 8 * MIN);
    P.push(Object.assign(p, { ultimaMsgEm: agora - 6 * MIN, passoBot: "sabor" }));

    p = comItens(base(n(), "João Batista", "5583988776655", agora - 50 * MIN),
      [item(cat, "manga-1kg", 3), item(cat, "acerola-500", 2)], "cep");
    P.push(Object.assign(p, { ultimaMsgEm: agora - 40 * MIN }));

    p = comItens(base(n(), "Rita Cavalcanti (Mercadinho)", "5583977001122", agora - 2 * HORA),
      [item(cat, "caju-1kg", 120)], "acima100kg");
    P.push(Object.assign(p, { acima100kg: true, ultimaMsgEm: agora - 110 * MIN }));

    p = comItens(base(n(), "Pedro Henrique", "5583966554433", agora - 24 * HORA),
      [item(cat, "uva-500", 1)], "menu");
    P.push(Object.assign(p, { ultimaMsgEm: agora - (23 * HORA + 30 * MIN) }));

    /* ---- Não pago (link correndo) ---- */
    p = comItens(base(n(), "Carlos Lima", "5583988884321", agora - 20 * MIN),
      [item(cat, "morango-1kg", 1), item(cat, "uva-500", 3)]);
    p = fechar(p, cfg, end("Avenida Oceano Atlântico", "45, ap 302", "Intermares", "Cabedelo", "58102202"), entregaHoje);
    P.push(comLink(p, agora - 4 * MIN, cfg));

    p = comItens(base(n(), "Ana Souza", "5583977775678", agora - 25 * MIN), [item(cat, "caja-1kg", 4)]);
    p = fechar(p, cfg, end("Rua Cabo Branco", "12, casa 2", "Manaíra", "João Pessoa", "58038000"), agendada);
    P.push(comLink(p, agora - 11.5 * MIN, cfg));

    /* ---- Pago ---- */
    p = comItens(base(n(), "Fernanda Costa", "5583955553333", agora - 90 * MIN),
      [item(cat, "goiaba-1kg", 5), item(cat, "maracuja-500", 2)]);
    p = fechar(p, cfg, end("Avenida Josefa Taveira", "1050", "Mangabeira", "João Pessoa", "58055000"), entregaHoje);
    p = comLink(p, agora - 80 * MIN, cfg);
    P.push(comPagamento(p, agora - 72 * MIN, "Pix"));

    p = comItens(base(n(), "José Almeida", "5583966669999", agora - 26 * HORA), [item(cat, "maracuja-1kg", 2)]);
    p = fechar(p, cfg, end("Rua Sinésio Guimarães", "88", "Centro", "Bayeux", "58306000"), agendada);
    p = comLink(p, agora - 25.8 * HORA, cfg);
    P.push(comPagamento(p, agora - 25.7 * HORA, "Cartão"));

    /* ---- Em entrega ---- */
    p = comItens(base(n(), "Ricardo Mendes", "5583944441111", agora - 3 * HORA), [item(cat, "acerola-1kg", 6)]);
    p = fechar(p, cfg, end("Rua do Pesqueiro", "77", "Camboinha", "Cabedelo", "58103000"), entregaHoje);
    p = comPagamento(comLink(p, agora - 170 * MIN, cfg), agora - 165 * MIN, "Pix");
    P.push(avancar(p, "entrega", agora - 25 * MIN, "Operador", "Enviado para entrega"));

    /* ---- Concluídos (últimos dias úteis) ---- */
    const concluidos = [
      ["Patrícia Gomes", "5583911117777", "Jaguaribe", 1, [["morango-1kg", 2]]],
      ["Beatriz Nunes", "5583900005555", "Bessa", 1, [["manga-1kg", 4], ["caju-500", 2]]],
      ["Gustavo Souza", "5583912345678", "Tambaú", 2, [["uva-1kg", 3]]],
      ["Larissa Dias", "5583987654321", "Imaculada", 3, [["acerola-1kg", 10]]],
      ["Marcos Vinícius", "5583965432100", "Altiplano", 4, [["caja-500", 6], ["abacaxi-hortela-1kg", 2]]],
      ["Helena Prado", "5583933227788", "Intermares", 5, [["goiaba-1kg", 8]]],
      ["Sérgio Ramos", "5583922113344", "Bancários", 6, [["maracuja-1kg", 5]]],
    ];
    const cidadeDe = { Imaculada: "Bayeux", Intermares: "Cabedelo" };
    concluidos.forEach(([nome, tel, bairro, dias, its]) => {
      const dia = diaUtilAtras(agora, dias);
      const t0 = new Date(dia + "T09:30:00").getTime();
      let c = comItens(base(n(), nome, tel, t0), its.map(([v, q]) => item(cat, v, q)));
      c = fechar(c, cfg, end("Rua Exemplo", "100", bairro, cidadeDe[bairro] || "João Pessoa", "58000000"), { tipo: "hoje", data: dia });
      c = comPagamento(comLink(c, t0 + 6 * MIN, cfg), t0 + 9 * MIN, dias % 2 ? "Pix" : "Cartão");
      c = avancar(c, "entrega", t0 + 3 * HORA, "Operador", "Enviado para entrega");
      P.push(avancar(c, "concluido", t0 + 4 * HORA, "Operador", "Entrega concluída"));
    });

    /* ---- Cancelados e abandonada ---- */
    p = comItens(base(n(), "Lucas Barbosa", "5583922228888", agora - 3 * HORA), [item(cat, "abacaxi-hortela-500", 3)]);
    p = fechar(p, cfg, end("Rua da Paz", "5", "São Bento", "Bayeux", "58306000"), entregaHoje);
    p = comLink(p, agora - 170 * MIN, cfg);
    P.push(avancar(p, "cancelado", p.link.expiraEm, "Sistema", "Link expirou sem pagamento", {
      motivo: "Link expirou (" + cfg.janelaPagamentoMin + " min)", passoBot: "finalizado",
    }));

    p = comItens(base(n(), "Juliana Rocha", "5583933332222", agora - 5 * HORA), [item(cat, "uva-1kg", 2)]);
    p = fechar(p, cfg, end("Avenida Argemiro de Figueiredo", "910", "Bessa", "João Pessoa", "58037000"), entregaHoje);
    p = comLink(p, agora - 290 * MIN, cfg);
    p = avancar(p, "cancelado", p.link.expiraEm, "Sistema", "Link expirou sem pagamento", {
      motivo: "Link expirou (" + cfg.janelaPagamentoMin + " min)", passoBot: "finalizado",
    });
    const tardio = { id: "mp-tardio-" + p.id, metodo: "Pix", valorCent: p.totalCent, em: p.link.expiraEm + 2 * MIN, tardio: true };
    P.push(Object.assign({}, p, {
      pagamentos: [tardio],
      alertaTardio: true,
      historico: p.historico.concat([{ em: tardio.em, de: "cancelado", para: "cancelado", autor: "Mercado Pago (webhook)",
        obs: "Pagamento chegou DEPOIS do cancelamento. Conferir com o cliente" }]),
    }));

    p = comItens(base(n(), "Bruno Teixeira", "5583944440000", agora - 50 * HORA), [item(cat, "manga-500", 2)], "cep");
    p = Object.assign(p, { ultimaMsgEm: agora - 49 * HORA });
    P.push(avancar(p, "abandonada", agora - 25 * HORA, "Sistema", "24 h sem mensagem", { motivo: "Conversa parada por 24 h" }));

    p = comItens(base(n(), "Camila Freitas", "5583955550000", agora - 6 * HORA), [item(cat, "caju-1kg", 2)]);
    P.push(avancar(p, "cancelado", agora - 5.9 * HORA, "Cliente", "Cliente digitou cancelar", {
      motivo: "Cancelado pelo cliente", passoBot: "finalizado",
    }));

    return { versao: 2, offsetMs: 0, seq: s, config: cfg, catalogo: cat, pedidos: P, chats: gerarChats(P) };
  }

  /* Conversas de exemplo, só para o simulador ter histórico. */
  function gerarChats(pedidos) {
    const chats = {};
    pedidos.forEach((p) => {
      const msgs = [
        { de: "cliente", texto: "Oi", em: p.criadoEm },
        { de: "bot", texto: FP.textos.saudacao(p.cliente.split(" ")[0]) + "\n\n" + FP.textos.menuPrincipal(false), em: p.criadoEm + 2000 },
      ];
      if (p.itens.length) msgs.push({ de: "bot", texto: FP.textos.carrinho(p.itens), em: p.ultimaMsgEm - 1000 });
      if (p.acima100kg) msgs.push({ de: "bot", texto: FP.textos.acimaLimite(FP.util.kg(R.pesoTotalG(p.itens))), em: p.ultimaMsgEm });
      if (p.passoBot === "cep") msgs.push({ de: "bot", texto: FP.textos.pedeCep(), em: p.ultimaMsgEm });
      if (p.passoBot === "sabor") {
        msgs.push({ de: "cliente", texto: "1", em: p.ultimaMsgEm - 500 });
        msgs.push({ de: "bot", texto: FP.textos.listaSabores(R.saboresDisponiveis(FP.dados.catalogoInicial())), em: p.ultimaMsgEm });
      }
      if (p.link) msgs.push({ de: "bot", texto: FP.textos.link(p, 15), em: p.link.criadoEm, linkPedidoId: p.id });
      chats[p.telefone] = {
        telefone: p.telefone,
        nome: p.cliente,
        pedidoId: p.id,
        bot: { passo: p.passoBot, pilha: [], temp: {} },
        mensagens: msgs,
      };
    });
    return chats;
  }

  FP.seed = { gerar };
})(window.FP = window.FP || {});
