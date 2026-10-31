/* Seção "Projeto": não faz parte do sistema real. Serve para alinhar o time e o dono. */
(function (FP) {
  "use strict";
  const U = FP.util;
  const esc = U.esc;

  /* Revisão do quadro (29/10/2026). gravidade: alta | media | baixa */
  const REVISAO_CARTOES = [
    ["alta", "Pagamento depois do cancelamento", "O cartão decidido (29/10) diz: não honra, sem estorno automático. O resumo antigo dizia \"honrar se o item estiver ativo\". O protótipo segue o cartão decidido. Falta definir quem devolve o dinheiro e em quanto tempo, senão a empresa fica com dinheiro de pedido cancelado."],
    ["alta", "[Decisão] Definir orçamento e prazo × [Decidido] Quem vai construir, orçamento e prazo", "Os dois títulos se contradizem. Renomear o decidido para \"[Decidido] Quem vai construir o sistema\" e deixar orçamento e prazo só no cartão aberto."],
    ["alta", "Conectar o sistema ao WhatsApp", "A descrição ainda fala de API oficial, mensagens-modelo e verificação da Meta. Já está decidido WAHA em número novo. Trocar por: subir o WAHA, ler o QR code, reconectar sozinho e alertar se cair."],
    ["alta", "[Decisão] Horário de funcionamento", "Falta o horário-limite para entrega hoje. Sem ele, o bot aceita \"entrega hoje\" às 23 h de um dia útil. Incluir essa pergunta no cartão."],
    ["media", "Definir stack do frontend × Passar o protótipo para React", "O segundo já assume React + Vite, mas a decisão ainda está aberta. Deixar o cartão do React esperando a decisão."],
    ["media", "Tamanhos e preço de cada sabor", "Cada tamanho precisa de peso em gramas. Sem peso, a regra dos 100 kg não funciona. O protótipo antigo usava ml."],
    ["media", "Sem responsável", "\"[Bot] Marcar a conversa como abandonada\", \"[Bot] Ajustar a data para o próximo dia útil\" e \"[Frete] Pedidos acima de 100 kg\" têm label de bot, mas ninguém atribuído. Foram criados depois do script de atribuição."],
    ["media", "Cartões de cadastro (produto, sabor, tamanho, ativo/inativo)", "Estão só com Backend/Walison, mas têm tela. Deixar claro quem faz a tela, ou dividir com o Abraão."],
    ["media", "Feriados", "Nenhum cartão cobre a lista de feriados. Dia útil depende de feriados nacionais, da Paraíba e das três cidades. Criar uma tarefa na Etapa 3."],
    ["baixa", "Relatório de pedidos por status", "A descrição cita cancelados, mas não as conversas abandonadas. O protótipo mostra as duas."],
    ["baixa", "Bot lembra em que etapa cada cliente está × [Bot] Marcar abandonada depois de 24 h", "Os dois falam de conversa parada. Tirar a parte do abandono do primeiro."],
    ["baixa", "[Bot] Ajustar a data para o próximo dia útil × Entrega hoje ou agendada em até 30 dias", "Mesma regra em duas etapas. Ligar um ao outro no Trello para não implementar duas vezes."],
    ["baixa", "Script sincronizar_tarefas.py", "Comparava os nomes \"walison\" e \"abraao\", mas os usuários reais são walisilva e abraaosilva54. Todo cartão de Pagamento, Frete e Relatórios aparecia como \"dono\". Corrigido."],
  ];

  const REVISAO_TELAS = [
    ["Pedidos (Kanban)", "Ficou com as 4 colunas da regra. Concluído virou só alvo de soltar. Saíram os botões \"Receber pagamento\" e \"Cliente ligou e pagou direto\": só o Mercado Pago move para Pago. O operador só move Pago → Em entrega → Concluído."],
    ["Pop-up do pedido", "Mostra a fórmula do frete com os números, o peso, o link, os pagamentos e o histórico de status. Saiu a edição de data de entrega: quem escolhe é o cliente no bot, e o frete já foi cobrado."],
    ["Produtos", "Organizado por sabor, com preço editável por tamanho e chave em cada um. Dá para criar tamanhos novos (ex.: 2 kg). Sabor novo já nasce com tamanho e preço, mas desligado; só liga se algum tamanho tiver preço maior que zero."],
    ["Relatórios", "Uma aba por status, incluindo Cancelado e Abandonada. Tem soma no rodapé, filtro de período e CSV que abre certo no Excel. Os indicadores do piloto ficam no topo."],
    ["Configurações", "Tem frete com simulação ao vivo, prazos, as 3 cidades e as regras fixas. Antes, o multiplicador estava em 1,0 e entrava antes do mínimo."],
    ["Login", "Tela nova. A senha só existe como hash e a sessão fica aberta no monitor."],
    ["Simulador do WhatsApp", "Tela nova e só do protótipo. Roda o fluxo inteiro do bot e simula o Mercado Pago e o relógio."],
    ["Visão Geral e Tarefas do Trello", "Não são telas do sistema. Foram para o grupo \"Projeto\" e não devem ir para o React."],
  ];

  const PROPOSTAS = [
    "Pedido agendado fica em Pago com o botão \"Enviar para entrega\" travado até o dia da entrega.",
    "O bot avisa o cliente quando o pedido sai para entrega e quando é concluído.",
    "O frete é recalculado ao mostrar o resumo e fica congelado quando o link é gerado.",
    "O cliente com pedido pago ou em entrega que manda mensagem recebe o status. Ele digita \"novo\" para outro pedido.",
  ];

  function renderMvp(el) {
    const cor = { alta: "selo-vermelho", media: "selo-amarelo", baixa: "selo-cinza" };
    el.innerHTML =
      '<div class="projeto">' +
      '<section class="painel"><h2>Revisão dos cartões do Trello</h2><p class="mudo">O que não fecha entre os cartões, e entre os cartões e as regras. Nada foi alterado no Trello.</p>' +
      '<ul class="revisao">' + REVISAO_CARTOES.map(([g, t, d]) => '<li><span class="selo ' + cor[g] + '">' + g + "</span><div><b>" + esc(t) + "</b><p>" + esc(d) + "</p></div></li>").join("") + "</ul></section>" +
      '<section class="painel"><h2>Revisão das telas</h2><ul class="revisao">' +
      REVISAO_TELAS.map(([t, d]) => "<li><div><b>" + esc(t) + "</b><p>" + esc(d) + "</p></div></li>").join("") + "</ul></section>" +
      '<section class="painel"><h2>Propostas a validar com o dono</h2><p class="mudo">Não estão nas regras fechadas. O protótipo já faz assim para o dono poder ver.</p><ul class="regras">' +
      PROPOSTAS.map((p) => "<li>" + esc(p) + "</li>").join("") + "</ul></section>" +
      '<section class="painel"><h2>Fora do MVP</h2><p>Multi-cliente, app nativo, nota fiscal, fidelidade, estoque com saldo, Uber Direct, outras cidades, atendimento humano no sistema, métricas avançadas e cadastro de entregadores (Fase 2).</p></section>' +
      "</div>";
  }

  FP.ui.registrarTela("mvp", { titulo: "Regras e revisão do MVP", render: renderMvp, eventos: [] });
})(window.FP = window.FP || {});
