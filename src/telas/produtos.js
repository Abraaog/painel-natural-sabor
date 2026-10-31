/* Tela Produtos: produto > sabor > tamanho, preço por sabor x tamanho e chaves ativo/inativo.
   Desligar tira do menu do bot na hora; nunca apaga histórico nem muda pedido já feito.
   Nada é de graça: sabor novo nasce com um tamanho e um preço, e só liga com preço > 0. */
(function (FP) {
  "use strict";
  const U = FP.util;
  const E = () => FP.estado;
  const esc = U.esc;

  const parseCent = (v) => Math.round(Number(String(v).replace(/\./g, "").replace(",", ".")) * 100);

  function chave(attrs, ligado, rotulo) {
    return '<label class="chave"><input type="checkbox" ' + attrs + (ligado ? " checked" : "") +
      ' aria-label="' + esc(rotulo) + '"><span></span></label>';
  }

  function linhaSabor(s) {
    const ativos = s.variantes.filter((v) => v.ativo).length;
    const noBot = s.ativo && ativos > 0;
    return '<article class="sabor ' + (noBot ? "" : "desligado") + '">' +
      '<header><h3>' + esc(s.nome) + '</h3>' +
      '<span class="selo ' + (noBot ? "selo-verde" : "selo-cinza") + '">' + (noBot ? "No menu do bot" : "Fora do menu") + "</span>" +
      chave('data-sabor="' + esc(s.id) + '"', s.ativo, "Sabor " + s.nome + " ativo") + "</header>" +
      '<table class="mini"><thead><tr><th>Tamanho</th><th class="num">Preço</th><th>Ativo</th></tr></thead><tbody>' +
      s.variantes.map((v) => "<tr><td>" + esc(v.rotulo) + '</td><td class="num"><input class="preco" inputmode="decimal" data-preco="' +
        esc(s.id) + "|" + esc(v.id) + '" value="' + (v.precoCent / 100).toFixed(2).replace(".", ",") + '" aria-label="Preço ' +
        esc(s.nome + " " + v.rotulo) + '"></td><td>' +
        chave('data-var="' + esc(s.id) + "|" + esc(v.id) + '"' + (s.ativo ? "" : " disabled"), v.ativo, s.nome + " " + v.rotulo + " ativo") +
        "</td></tr>").join("") +
      "</tbody></table>" +
      '<form class="novo-tam" data-tamsabor="' + esc(s.id) + '">' +
      '<input name="tam" placeholder="Novo tamanho (ex.: 2 kg)" maxlength="12" aria-label="Novo tamanho de ' + esc(s.nome) + '">' +
      '<input name="preco" inputmode="decimal" placeholder="Preço" aria-label="Preço do novo tamanho">' +
      '<button class="btn btn-sm">+ tamanho</button></form>' +
      "</article>";
  }

  function render(el) {
    const cat = E().catalogo();
    el.innerHTML = cat.map((prod) => {
      const ativos = prod.sabores.filter((s) => s.ativo && s.variantes.some((v) => v.ativo)).length;
      return '<div class="produto-topo"><div><h2>' + esc(prod.nome) + '</h2><p class="mudo">' + ativos + " de " +
        prod.sabores.length + " sabores no menu do bot · preço sempre por sabor e tamanho</p></div>" +
        '<form class="novo-sabor" data-produto="' + esc(prod.id) + '">' +
        '<input name="nome" placeholder="Novo sabor" maxlength="40" aria-label="Novo sabor">' +
        '<input name="tam" placeholder="Tamanho (ex.: 1 kg)" maxlength="12" aria-label="Tamanho">' +
        '<input name="preco" inputmode="decimal" placeholder="Preço" aria-label="Preço">' +
        '<button class="btn">Adicionar</button></form></div>' +
        '<div class="grade-sabores">' + prod.sabores.map(linhaSabor).join("") + "</div>";
    }).join("") +
      '<p class="nota">Sabor novo já nasce com <b>um tamanho e um preço</b> (nada é de graça), mas <b>desligado</b>. ' +
      "Confira e ligue quando quiser — só liga se algum tamanho tiver preço maior que zero. " +
      "O bot confere o carrinho de novo antes de gerar o link: se algo foi desligado no meio da conversa, sai do carrinho com aviso ao cliente.</p>";
    ligar(el);
  }

  function ligar(el) {
    U.$$("[data-sabor]", el).forEach((i) => i.addEventListener("change", () => {
      const r = E().alternarSabor(i.dataset.sabor, i.checked);
      if (!r.ok) { i.checked = false; FP.ui.toast(r.motivo, "erro"); return; }
      FP.ui.toast(i.checked ? "Sabor ligado no menu do bot." : "Sabor desligado: saiu do menu do bot agora.", "ok");
    }));
    U.$$("[data-var]", el).forEach((i) => i.addEventListener("change", () => {
      const [s, v] = i.dataset.var.split("|");
      const sabor = E().catalogo().flatMap((p) => p.sabores).find((x) => x.id === s);
      const variante = sabor.variantes.find((x) => x.id === v);
      if (i.checked && !(variante.precoCent > 0)) {
        i.checked = false;
        FP.ui.toast("Defina o preço antes de ligar esse tamanho.", "erro");
        return;
      }
      E().alternarVariante(s, v, i.checked);
    }));
    U.$$("[data-preco]", el).forEach((i) => i.addEventListener("change", () => {
      const [s, v] = i.dataset.preco.split("|");
      const r = E().alterarPreco(s, v, parseCent(i.value));
      FP.ui.toast(r.ok ? "Preço salvo. Vale para pedidos novos; pedidos já feitos não mudam." : r.motivo, r.ok ? "ok" : "erro");
      if (!r.ok) FP.ui.redesenhar();
    }));
    U.$$(".novo-sabor", el).forEach((f) => f.addEventListener("submit", (e) => {
      e.preventDefault();
      const r = E().novoSabor(f.dataset.produto, f.nome.value, f.tam.value, parseCent(f.preco.value));
      if (!r.ok) { FP.ui.toast(r.motivo, "erro"); return; }
      FP.ui.toast("Sabor criado com preço. Confira e ligue quando quiser.", "ok");
      const campo = U.$(".novo-sabor input", el);
      if (campo) campo.focus(); // cadastro em sequência: digita, Enter, próximo
    }));
    U.$$(".novo-tam", el).forEach((f) => f.addEventListener("submit", (e) => {
      e.preventDefault();
      const r = E().novoTamanho(f.dataset.tamsabor, f.tam.value, parseCent(f.preco.value));
      FP.ui.toast(r.ok ? "Tamanho adicionado." : r.motivo, r.ok ? "ok" : "erro");
    }));
  }

  FP.ui.registrarTela("produtos", {
    titulo: "Produtos",
    render,
  });
})(window.FP = window.FP || {});
