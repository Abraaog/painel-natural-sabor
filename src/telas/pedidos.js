/* Tela Pedidos: números do dia + Kanban (4 colunas) + pop-up do pedido. */
(function (FP) {
  "use strict";
  const R = FP.regras;
  const U = FP.util;
  const E = () => FP.estado;
  const esc = U.esc;

  const PASSO = {
    menu: "No menu", sabor: "Escolhendo sabor", tamanho: "Escolhendo tamanho", qtd: "Informando quantidade",
    carrinho: "Montando carrinho", remover: "Editando carrinho", cep: "Informando CEP", numero: "Informando endereço",
    entrega: "Escolhendo entrega", data: "Escolhendo data", resumo: "Revisando resumo", acima100kg: "Acima de 100 kg",
  };
  const PAGOS = ["pago", "entrega", "concluido"];
  const AVISO_ABANDONO_MS = 2 * R.HORA;
  const URGENTE_MS = 3 * R.MINUTO;
  const filtro = { busca: "", cidade: "" };

  const hoje = () => R.isoLocal(E().agora());
  const entregaFutura = (p) => !!p.entrega && p.entrega.data > hoje();

  function rotuloEntrega(p) {
    if (!p.entrega) return "";
    if (p.entrega.data === hoje()) return "Entregar hoje";
    return "Agendado " + U.diaSemana(p.entrega.data) + " " + U.dataCurta(p.entrega.data);
  }

  /* ---------- números do dia ---------- */
  function numerosDoDia() {
    const todos = E().pedidos();
    const dia = hoje();
    const pagosHoje = todos.filter((p) => PAGOS.includes(p.status) &&
      p.pagamentos.some((pg) => !pg.tardio && R.isoLocal(pg.em) === dia));
    const recebido = pagosHoje.reduce((s, p) => s + p.totalCent, 0);
    const aEntregar = todos.filter((p) => (p.status === "pago" && p.entrega && p.entrega.data <= dia) || p.status === "entrega");
    const aguardando = todos.filter((p) => p.status === "nao_pago");
    const conversas = todos.filter((p) => p.status === "conversa");
    const kpi = (rotulo, valor, detalhe, tom) =>
      '<div class="kpi' + (tom ? " kpi-" + tom : "") + '"><span>' + rotulo + "</span><b>" + valor + "</b><small>" + detalhe + "</small></div>";
    return '<div class="kpis">' +
      kpi("Recebido hoje", U.dinheiro(recebido), pagosHoje.length + " pedido(s) pago(s)", "destaque") +
      kpi("Para entregar hoje", aEntregar.length, aEntregar.filter((p) => p.status === "entrega").length + " já em rota") +
      kpi("Aguardando pagamento", U.dinheiro(aguardando.reduce((s, p) => s + p.totalCent, 0)), aguardando.length + " link(s) ativo(s)") +
      kpi("Conversas abertas", conversas.length, conversas.filter((p) => p.itens.length).length + " com carrinho") +
      kpi("Ticket médio hoje", U.dinheiro(pagosHoje.length ? Math.round(recebido / pagosHoje.length) : 0), "itens + frete") +
      "</div>";
  }

  function alertas() {
    const todos = E().pedidos();
    const linha = (tom, titulo, lista) => lista.length
      ? '<div class="alerta alerta-' + tom + '"><b>' + titulo + "</b>" +
        lista.map((p) => '<button class="link" data-abrir="' + esc(p.id) + '">' + esc(p.numero) + " " + esc(p.cliente) + "</button>").join("") + "</div>"
      : "";
    return linha("erro", "Pagou depois do cancelamento", todos.filter((p) => p.alertaTardio)) +
      linha("roxo", "Acima de 100 kg · combinar no WhatsApp", todos.filter((p) => p.acima100kg && p.status === "conversa"));
  }

  /* ---------- cartões ---------- */
  function filtrados() {
    const b = R.normalizar(filtro.busca);
    return E().pedidos().filter((p) => R.ETAPAS[p.status].kanban &&
      (!filtro.cidade || (p.endereco && p.endereco.cidade === filtro.cidade)) &&
      (!b || R.normalizar(p.numero + " " + p.cliente + " " + p.telefone).includes(b)));
  }

  const ORDEM = {
    conversa: (p) => -p.ultimaMsgEm,
    nao_pago: (p) => p.link.expiraEm,
    pago: (p) => (p.entrega ? p.entrega.data : "9") + String(p.etapaDesde).padStart(15, "0"),
    entrega: (p) => p.etapaDesde,
  };

  function ordenar(lista, status) {
    const k = ORDEM[status];
    return lista.slice().sort((a, b) => (k(a) < k(b) ? -1 : k(a) > k(b) ? 1 : 0));
  }

  /* Cada etapa mostra só o que o operador precisa decidir naquela coluna. */
  function detalhes(p) {
    const t = E().agora();
    const local = p.endereco ? esc(p.endereco.bairro + " · " + p.endereco.cidade) : "";
    if (p.status === "conversa") {
      const restante = E().config().abandonoHoras * R.HORA - (t - p.ultimaMsgEm);
      return {
        tempo: restante < AVISO_ABANDONO_MS ? '<span class="aviso-tempo">abandona em ' + U.duracao(restante) + "</span>" : "há " + U.duracao(t - p.ultimaMsgEm),
        meta: p.itens.length ? p.itens.length + " item(ns) no carrinho" : "Carrinho vazio",
        selo: p.acima100kg ? '<span class="selo selo-roxo">Acima de 100 kg</span>' : '<span class="selo">' + esc(PASSO[p.passoBot] || "Conversando") + "</span>",
        total: p.itens.length ? U.dinheiro(p.subtotalCent) : "",
        acao: "",
      };
    }
    if (p.status === "nao_pago") {
      const r = p.link.expiraEm - t;
      return {
        tempo: rotuloEntrega(p), meta: local,
        selo: '<span class="selo selo-amarelo cronometro' + (r < URGENTE_MS ? " urgente" : "") + '" data-expira="' + p.link.expiraEm + '">expira em <b>' + U.contagem(r) + "</b></span>",
        total: U.dinheiro(p.totalCent), acao: "",
      };
    }
    if (p.status === "pago") {
      const futura = entregaFutura(p);
      const pg = p.pagamentos[p.pagamentos.length - 1];
      return {
        tempo: "pago há " + U.duracao(t - p.etapaDesde) + (pg ? " · " + esc(pg.metodo) : ""), meta: local,
        selo: '<span class="selo ' + (futura ? "selo-azul" : "selo-verde") + '">' + rotuloEntrega(p) + "</span>",
        total: U.dinheiro(p.totalCent),
        acao: futura ? "" : '<button class="btn btn-cartao" data-acao="entrega">Enviar para entrega</button>',
      };
    }
    return {
      tempo: "saiu há " + U.duracao(t - p.etapaDesde), meta: local,
      selo: '<span class="selo selo-azul">Em rota</span>', total: U.dinheiro(p.totalCent),
      acao: '<button class="btn btn-cartao" data-acao="concluido">Concluir entrega</button>',
    };
  }

  function cartao(p) {
    const d = detalhes(p);
    return '<article class="cartao" tabindex="0" draggable="true" data-id="' + esc(p.id) + '" data-status="' + p.status + '">' +
      '<div class="c-topo"><span class="c-num">' + esc(p.numero) + '</span><span class="c-tempo">' + d.tempo + "</span></div>" +
      '<div class="c-cli">' + esc(p.cliente) + "</div>" +
      (d.meta ? '<div class="c-meta">' + d.meta + "</div>" : "") +
      '<div class="c-rodape">' + d.selo + '<span class="c-total">' + d.total + "</span></div>" + d.acao + "</article>";
  }

  function coluna(st, itens) {
    const soma = itens.reduce((s, p) => s + p.totalCent, 0);
    return '<section class="coluna" data-status="' + st + '" aria-label="' + R.ETAPAS[st].rotulo + '">' +
      '<header class="col-topo"><span class="ponto"></span><h2>' + R.ETAPAS[st].rotulo + '</h2><span class="contador">' + itens.length + "</span>" +
      '<span class="col-soma">' + (itens.length ? U.dinheiro(soma) : "") + "</span></header>" +
      '<div class="col-lista">' + (itens.map(cartao).join("") || '<p class="vazio">Nenhum pedido</p>') + "</div></section>";
  }

  function render(el) {
    const lista = filtrados();
    el.innerHTML = numerosDoDia() + alertas() +
      '<div class="barra-ferramentas"><input type="search" id="kBusca" placeholder="Buscar pedido, cliente ou telefone" value="' + esc(filtro.busca) + '" aria-label="Buscar pedido">' +
      '<select id="kCidade" aria-label="Cidade"><option value="">Todas as cidades</option>' +
      R.CIDADES_COBERTAS.map((c) => "<option" + (c === filtro.cidade ? " selected" : "") + ">" + c + "</option>").join("") + "</select></div>" +
      '<div class="kanban">' + R.COLUNAS_KANBAN.map((st) => coluna(st, ordenar(lista.filter((p) => p.status === st), st))).join("") + "</div>" +
      '<section class="coluna zona-concluir" data-status="concluido" aria-label="Concluir entrega"><span>Solte para concluir a entrega</span></section>';
    ligar(el);
  }

  function mover(id, para) {
    const r = E().moverManual(id, para, (E().sessao() || {}).nome);
    if (!r.ok) FP.ui.toast(r.motivo, "erro");
    else FP.ui.toast(E().pedido(id).numero + (para === "entrega" ? " saiu para entrega." : " concluído."), "ok");
  }

  /* ---------- arrastar e soltar (regra única em FP.estado.motivoMovimento) ---------- */
  function marcarDestinos(el, id, origem) {
    el.classList.add("arrastando-pedido");
    U.$$(".coluna", el).forEach((col) => {
      if (col.dataset.status === origem) { col.classList.add("origem"); return; }
      const motivo = E().motivoMovimento(id, col.dataset.status);
      col.classList.toggle("pode-soltar", !motivo);
      col.classList.toggle("nao-pode", !!motivo);
      col.setAttribute("data-motivo", motivo || "Solte aqui");
    });
  }

  function limparDestinos(el) {
    el.classList.remove("arrastando-pedido");
    U.$$(".coluna", el).forEach((col) => {
      col.classList.remove("pode-soltar", "nao-pode", "sobre", "origem");
      col.removeAttribute("data-motivo");
    });
  }

  function ligar(el) {
    U.$("#kBusca", el).addEventListener("input", (e) => {
      filtro.busca = e.target.value;
      render(el);
      const campo = U.$("#kBusca", el);
      campo.focus();
      campo.setSelectionRange(campo.value.length, campo.value.length);
    });
    U.$("#kCidade", el).addEventListener("change", (e) => { filtro.cidade = e.target.value; render(el); });
    U.$$("[data-abrir]", el).forEach((b) => b.addEventListener("click", () => abrirPedido(b.dataset.abrir)));

    U.$$(".cartao", el).forEach((c) => {
      c.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-acao]");
        if (btn) { e.stopPropagation(); mover(c.dataset.id, btn.dataset.acao); return; }
        abrirPedido(c.dataset.id);
      });
      c.addEventListener("keydown", (e) => { if (e.key === "Enter") abrirPedido(c.dataset.id); });
      c.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", c.dataset.id);
        e.dataTransfer.effectAllowed = "move";
        c.classList.add("arrastando");
        marcarDestinos(el, c.dataset.id, c.dataset.status);
      });
      c.addEventListener("dragend", () => {
        c.classList.remove("arrastando");
        limparDestinos(el);
        FP.ui.retomarRedesenho();
      });
    });

    U.$$(".coluna", el).forEach((col) => {
      col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("sobre"); });
      col.addEventListener("dragleave", (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove("sobre"); });
      col.addEventListener("drop", (e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain");
        const p = E().pedido(id);
        if (p && p.status !== col.dataset.status) mover(id, col.dataset.status);
      });
    });
  }

  function aCadaSegundo(el) {
    const t = E().agora();
    U.$$(".cronometro", el).forEach((c) => {
      const r = Number(c.dataset.expira) - t;
      c.querySelector("b").textContent = U.contagem(r);
      c.classList.toggle("urgente", r < URGENTE_MS);
    });
  }

  /* ---------- pop-up do pedido ---------- */
  function blocoFrete(p) {
    if (!p.frete) return "<p class='mudo'>Calculado quando o cliente informar o endereço.</p>";
    const f = p.frete;
    const cfg = E().config();
    return '<div class="formula">max(' + U.dinheiro(cfg.freteMinimoCent) + " ; " + U.dinheiro(cfg.tarifaBaseCent) + " + " +
      U.dinheiro(cfg.valorPorKmCent) + " × " + String(f.km).replace(".", ",") + " km) × " +
      String(f.multiplicador).replace(".", ",") + " = <b>" + U.dinheiro(f.totalCent) + "</b></div>" +
      '<p class="mudo">' + (f.aplicouMinimo ? "Frete mínimo aplicado. " : "") +
      (p.status === "conversa" ? "Provisório até o cliente confirmar." : "Congelado na geração do link.") +
      (p.endereco && p.endereco.kmEstimado ? " Km estimado pela cidade." : "") + "</p>";
  }

  function corpoPedido(p) {
    const itens = p.itens.map((i) => "<tr><td>" + esc(i.nome) + " " + esc(i.rotulo) + '</td><td class="num">' + i.qtd +
      '</td><td class="num">' + U.dinheiro(i.precoCent) + '</td><td class="num">' + U.dinheiro(i.precoCent * i.qtd) + "</td></tr>").join("");
    const end = p.endereco
      ? esc([p.endereco.rua, p.endereco.numero].filter(Boolean).join(", ")) + "<br>" + esc(p.endereco.bairro + " · " + p.endereco.cidade + "/" + p.endereco.uf) + " · CEP " + esc(p.endereco.cep)
      : "<span class='mudo'>Ainda não informado</span>";
    const pagamentos = p.pagamentos.length
      ? p.pagamentos.map((pg) => "<li>" + esc(pg.metodo) + " · " + U.dinheiro(pg.valorCent) + " · " + U.dataHora(pg.em) +
        (pg.tardio ? ' <span class="selo selo-vermelho">depois do cancelamento</span>' : "") + "</li>").join("")
      : "<li class='mudo'>Nenhum</li>";
    const hist = p.historico.slice().reverse().map((h) => "<li><time>" + U.dataHora(h.em) + "</time><b>" +
      (h.de && h.de !== h.para ? esc(R.ETAPAS[h.de].rotulo) + " → " : "") + esc(R.ETAPAS[h.para].rotulo) + "</b><span>" +
      esc(h.autor) + (h.obs ? " · " + esc(h.obs) : "") + "</span></li>").join("");
    const entrega = p.entrega ? (p.entrega.tipo === "hoje" ? "Hoje" : "Agendada") + " · " + R.dataBr(p.entrega.data) : "<span class='mudo'>Não escolhida</span>";
    const link = p.link ? esc(p.link.url) + '<br><span class="mudo">válido até ' + U.hhmm(p.link.expiraEm) + "</span>" : "<span class='mudo'>Não gerado</span>";

    return '<div class="dossie">' +
      '<div class="dossie-resumo"><div><span>Cliente</span><b>' + esc(p.cliente) + '</b><small class="telefone">' + esc(U.telefoneWhats(p.telefone)) +
        '<button class="copiar" data-copiar="' + esc(U.telefoneWhats(p.telefone)) + '">Copiar</button></small></div>' +
      "<div><span>Entrega</span><b>" + entrega + "</b></div>" +
      "<div><span>Total</span><b>" + U.dinheiro(p.totalCent) + "</b><small>" + U.kg(R.pesoTotalG(p.itens)) + "</small></div></div>" +
      "<section><h3>Itens</h3>" +
      (itens ? '<table class="mini"><thead><tr><th>Produto</th><th class="num">Qtd</th><th class="num">Unit.</th><th class="num">Subtotal</th></tr></thead><tbody>' + itens +
        '</tbody><tfoot><tr><td colspan="3">Itens</td><td class="num">' + U.dinheiro(p.subtotalCent) + '</td></tr><tr><td colspan="3">Frete</td><td class="num">' +
        U.dinheiro(p.freteCent) + '</td></tr><tr class="total"><td colspan="3">Total</td><td class="num">' + U.dinheiro(p.totalCent) + "</td></tr></tfoot></table>"
        : "<p class='mudo'>Carrinho vazio</p>") + "</section>" +
      '<div class="dossie-colunas"><section><h3>Endereço</h3><p>' + end + "</p></section>" +
      "<section><h3>Frete</h3>" + blocoFrete(p) + "</section>" +
      "<section><h3>Link Mercado Pago</h3><p>" + link + "</p></section>" +
      '<section><h3>Pagamentos</h3><ul class="lista">' + pagamentos + "</ul></section></div>" +
      '<section><h3>Histórico</h3><ul class="historico">' + hist + "</ul></section></div>";
  }

  function acoesPedido(p) {
    const a = ['<a class="btn" href="' + esc(U.linkWhats(p.telefone)) + '" target="_blank" rel="noopener">WhatsApp</a>',
      '<button class="btn" data-sim="1">Ver conversa</button>'];
    if (p.alertaTardio) a.push('<button class="btn btn-perigo" data-tardio="1">Marcar como conferido</button>');
    if (p.status === "pago") a.push('<button class="btn btn-primario" data-mover="entrega"' + (entregaFutura(p) ? ' disabled title="' + esc(rotuloEntrega(p)) + '"' : "") + ">Enviar para entrega</button>");
    if (p.status === "entrega") a.push('<button class="btn btn-primario" data-mover="concluido">Concluir entrega</button>');
    return a.join("");
  }

  function abrirPedido(id) {
    FP.ui.abrirModal({
      render() {
        const p = E().pedido(id);
        if (!p) { FP.ui.fecharModal(); return; }
        FP.ui.preencherModal(
          esc(p.numero) + ' <span class="chip etapa-' + p.status + '">' + R.ETAPAS[p.status].rotulo + "</span>",
          "Criado em " + U.dataHora(p.criadoEm) + (p.motivo ? " · " + esc(p.motivo) : ""),
          corpoPedido(p),
          acoesPedido(p)
        );
        U.$$("#modalCorpo [data-copiar]").forEach((b) => b.addEventListener("click", () => {
          U.copiar(b.dataset.copiar).then((ok) => {
            b.textContent = ok ? "Copiado" : "Falhou";
            b.classList.toggle("ok", ok);
            FP.ui.toast(ok ? "Número copiado: " + b.dataset.copiar : "Não deu para copiar. Selecione o número.", ok ? "ok" : "erro");
            setTimeout(() => { b.textContent = "Copiar"; b.classList.remove("ok"); }, 1600);
          });
        }));
        U.$$("#modalAcoes [data-mover]").forEach((b) => b.addEventListener("click", () => mover(id, b.dataset.mover)));
        U.$$("#modalAcoes [data-tardio]").forEach((b) => b.addEventListener("click", () => {
          E().marcarTardioConferido(id, (E().sessao() || {}).nome);
          FP.ui.toast("Pagamento tardio conferido.", "ok");
        }));
        U.$$("#modalAcoes [data-sim]").forEach((b) => b.addEventListener("click", () => {
          FP.ui.fecharModal();
          FP.telaSimulador.selecionar(p.telefone);
          FP.ui.irPara("simulador");
        }));
      },
    });
  }

  FP.telaPedidos = { abrirPedido };
  FP.ui.registrarTela("pedidos", { titulo: "Pedidos", render, aCadaSegundo });
})(window.FP = window.FP || {});
