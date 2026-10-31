/* Textos que o bot envia. Rascunho para o cartão "[Bot] Escrever os textos que o bot vai usar".
   *negrito* e _itálico_ seguem a formatação do WhatsApp. */
(function (FP) {
  "use strict";
  const U = () => FP.util;
  const R = FP.regras;

  const NOME = "Natural Sabor - Polpa de Frutas";

  const T = {
    NOME,
    saudacao: (nome) =>
      "Olá, " + nome + "! 👋\nAqui é a *" + NOME + "* 🍓🥭\nVou te ajudar a fazer seu pedido por aqui mesmo.",
    foraDeOperacao: () =>
      "No momento não estamos operando. 😕\nVolte mais tarde que a gente atende você!",
    menuPrincipal: (temItens) =>
      "*Menu*\n1️⃣ Fazer pedido\n2️⃣ Ver carrinho" + (temItens ? "\n3️⃣ Finalizar pedido" : "") +
      "\n\n_A qualquer momento: *voltar*, *cancelar* ou *recomeçar*._",
    listaSabores: (sabores) =>
      "Escolha o *sabor* (digite o número):\n" + sabores.map((s, i) => (i + 1) + ". " + s.nome).join("\n"),
    listaTamanhos: (sabor, variantes) =>
      "*" + sabor + "*. Escolha o tamanho:\n" +
      variantes.map((v, i) => (i + 1) + ". " + v.rotulo + ": " + U().dinheiro(v.precoCent)).join("\n"),
    perguntaQtd: (v) => "Quantas unidades de *" + v.nome + " " + v.rotulo + "*?",
    carrinho: (itens) => {
      if (!itens.length) return "Seu carrinho está vazio.";
      const linhas = itens.map((i, n) =>
        (n + 1) + ". " + i.qtd + "x " + i.nome + " " + i.rotulo + ": " + U().dinheiro(i.precoCent * i.qtd));
      return "*Seu carrinho*\n" + linhas.join("\n") +
        "\n\nSubtotal: *" + U().dinheiro(R.subtotalCent(itens)) + "* (" + U().kg(R.pesoTotalG(itens)) + ")";
    },
    menuCarrinho: () => "1️⃣ Adicionar mais itens\n2️⃣ Remover um item\n3️⃣ Finalizar pedido",
    escolhaRemover: (itens) =>
      "Qual item remover? (número)\n" + itens.map((i, n) => (n + 1) + ". " + i.qtd + "x " + i.nome + " " + i.rotulo).join("\n"),
    acimaLimite: (kg) =>
      "Seu pedido passou de *100 kg* (" + kg + ").\nPedidos desse tamanho são combinados direto com a nossa equipe, " +
      "sem pagamento pelo link. Já avisamos o time e alguém vai falar com você por aqui. 🤝",
    pedeCep: () => "Para calcular o frete, digite o *CEP* da entrega (só números).",
    cepInvalido: () => "CEP precisa ter 8 números. Exemplo: 58038000.",
    cepNaoEncontrado: () => "Não achei esse CEP. Confira e digite de novo, ou digite *cancelar*.",
    cidadeFora: (cidade) =>
      "Ainda não entregamos em *" + cidade + "*. 😕\nAtendemos só *João Pessoa, Cabedelo e Bayeux*.\n" +
      "Digite outro CEP ou *cancelar*.",
    pedeNumero: (e) =>
      "Achei: " + (e.rua ? e.rua + ", " : "") + e.bairro + ", " + e.cidade + "/" + e.uf +
      "\nAgora digite o *número* e o complemento (ex.: 120, ap 302).",
    perguntaEntrega: (hojeOk) =>
      "Quando você quer receber?\n" +
      (hojeOk ? "1️⃣ Hoje\n" : "1️⃣ Hoje _(indisponível: hoje não é dia útil)_\n") +
      "2️⃣ Agendar (até 30 dias, só em dia útil)\n\n_Não temos retirada na fábrica._",
    pedeData: () => "Digite a data da entrega no formato *dd/mm* (ex.: 05/11).",
    dataRecusada: (motivo, sugestao) =>
      motivo + (sugestao ? "\nO próximo dia útil é *" + R.dataBr(sugestao) + "*. Digite *1* para aceitar ou outra data." : ""),
    resumo: (p) =>
      "*Resumo do pedido*\n" +
      p.itens.map((i) => "• " + i.qtd + "x " + i.nome + " " + i.rotulo + ": " + U().dinheiro(i.precoCent * i.qtd)).join("\n") +
      "\n\nSubtotal: " + U().dinheiro(p.subtotalCent) +
      "\nFrete (" + String(p.frete.km).replace(".", ",") + " km): " + U().dinheiro(p.freteCent) +
      "\n*Total: " + U().dinheiro(p.totalCent) + "*" +
      "\n\nEntrega: " + (p.entrega.tipo === "hoje" ? "*hoje*" : "*" + R.dataBr(p.entrega.data) + "* (agendada)") +
      "\nEndereço: " + [p.endereco.rua, p.endereco.numero].filter(Boolean).join(", ") + ", " + p.endereco.bairro + ", " + p.endereco.cidade +
      "\n\n1️⃣ Confirmar e receber o link de pagamento\n2️⃣ Alterar o carrinho",
    itensRemovidos: (itens) =>
      "⚠️ Enquanto você montava o pedido, estes itens ficaram indisponíveis e saíram do carrinho:\n" +
      itens.map((i) => "• " + i.nome + " " + i.rotulo).join("\n"),
    precosAtualizados: () => "⚠️ Alguns preços foram atualizados. Confira o resumo de novo.",
    link: (p, minutos) =>
      "Pronto! Pague pelo link do *Mercado Pago* (Pix ou cartão):\n" + p.link.url +
      "\n\n⏱️ O link vale *" + minutos + " minutos*, até " + U().hhmm(p.link.expiraEm) + "." +
      (p.entrega.tipo === "agendada" ? "\nO frete já está calculado e fica garantido para o dia agendado." : ""),
    aguardandoPagamento: (p) =>
      "Seu link de pagamento vale até *" + U().hhmm(p.link.expiraEm) + "*:\n" + p.link.url +
      "\nAssim que o pagamento cair, eu te aviso aqui.",
    pago: (p) =>
      "✅ *Pagamento confirmado!* Pedido *" + p.numero + "*.\nEntrega " +
      (p.entrega.tipo === "hoje" ? "*hoje*" : "em *" + R.dataBr(p.entrega.data) + "*") +
      ". Avisamos quando sair para entrega. Obrigado! 💚",
    expirou: (minutos) =>
      "⏱️ O prazo de " + minutos + " minutos do link acabou e o pedido foi *cancelado*.\n" +
      "Quando quiser, é só mandar *oi* que a gente monta de novo. 😉",
    pagouDepois: (p) =>
      "Recebemos um pagamento do pedido *" + p.numero + "*, mas ele já estava cancelado porque o prazo do link acabou.\n" +
      "O link foi invalidado. Nossa equipe vai conferir o seu caso e falar com você. Se quiser, faça um novo pedido mandando *oi*.",
    saiuEntrega: (p) => "🛵 Seu pedido *" + p.numero + "* saiu para entrega!",
    entregue: (p) => "📦 Pedido *" + p.numero + "* entregue. Bom proveito! 💚",
    canceladoCliente: () => "Pedido cancelado. Quando quiser, é só mandar *oi*.",
    naoEntendi: () => "Não entendi. 🤔 Responda com uma das opções abaixo.",
  };

  FP.textos = T;
})(window.FP = window.FP || {});
