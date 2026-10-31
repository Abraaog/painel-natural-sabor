/* Testes das regras de negócio. Rodar: npm test */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../src/nucleo/regras.js");

const CFG = { freteMinimoCent: 1200, tarifaBaseCent: 500, valorPorKmCent: 180, multiplicador: 1.1 };
const ts = (iso, hora = "10:00") => new Date(iso + "T" + hora + ":00").getTime();

test("frete aplica a fórmula max(mínimo, base + km×valor) × multiplicador", () => {
  const f = R.calcularFrete(10, CFG);
  assert.equal(f.variavelCent, 500 + 1800);
  assert.equal(f.aplicouMinimo, false);
  assert.equal(f.totalCent, Math.round(2300 * 1.1));
});

test("frete usa o mínimo quando a distância é curta, e o multiplicador vale por cima do mínimo", () => {
  const f = R.calcularFrete(1, CFG);
  assert.equal(f.aplicouMinimo, true);
  assert.equal(f.totalCent, Math.round(1200 * 1.1));
});

test("frete nunca é grátis, nem com 0 km", () => {
  assert.ok(R.calcularFrete(0, CFG).totalCent > 0);
});

test("frete recusa distância inválida", () => {
  assert.throws(() => R.calcularFrete(-1, CFG));
  assert.throws(() => R.calcularFrete(NaN, CFG));
});

test("configuração recusa frete mínimo zero e multiplicador abaixo de 1", () => {
  assert.ok(R.validarConfigFrete({ ...CFG, freteMinimoCent: 0 }).length > 0);
  assert.ok(R.validarConfigFrete({ ...CFG, multiplicador: 0.9 }).length > 0);
  assert.deepEqual(R.validarConfigFrete(CFG), []);
});

test("cobertura aceita só João Pessoa, Cabedelo e Bayeux, com ou sem acento", () => {
  assert.equal(R.cidadeAtendida("Joao Pessoa"), true);
  assert.equal(R.cidadeAtendida("CABEDELO"), true);
  assert.equal(R.cidadeAtendida("Santa Rita"), false);
  assert.equal(R.cidadeAtendida("Campina Grande"), false);
});

test("cobertura permite desligar uma cidade, mas nunca incluir outra", () => {
  assert.equal(R.cidadeAtendida("Bayeux", ["João Pessoa", "Cabedelo"]), false);
  assert.equal(R.cidadeAtendida("Santa Rita", ["João Pessoa", "Santa Rita"]), false);
});

test("CEP precisa ter 8 dígitos", () => {
  assert.equal(R.cepValido("58038-000"), true);
  assert.equal(R.cepValido("5803800"), false);
});

test("dia útil exclui sábado, domingo e feriado", () => {
  assert.equal(R.eDiaUtil("2026-10-30"), true); // sexta
  assert.equal(R.eDiaUtil("2026-10-31"), false); // sábado
  assert.equal(R.eDiaUtil("2026-11-02"), false); // Finados
  assert.equal(R.proximoDiaUtil("2026-10-31"), "2026-11-03");
});

test("entrega hoje só em dia útil", () => {
  assert.equal(R.validarEntrega("hoje", null, ts("2026-10-29")).ok, true);
  const sab = R.validarEntrega("hoje", null, ts("2026-10-31"));
  assert.equal(sab.ok, false);
  assert.equal(sab.sugestao, "2026-11-03");
});

test("agendamento: a partir de amanhã, até 30 dias, só em dia útil", () => {
  const agora = ts("2026-10-29");
  assert.equal(R.validarEntrega("agendada", "2026-10-29", agora).ok, false);
  assert.equal(R.validarEntrega("agendada", "2026-11-05", agora).ok, true);
  assert.equal(R.validarEntrega("agendada", "2026-11-27", agora).ok, true);
  assert.equal(R.validarEntrega("agendada", "2026-11-28", agora).ok, false); // sábado
  assert.equal(R.validarEntrega("agendada", "2026-12-01", agora).ok, false); // passou de 30 dias
  const fer = R.validarEntrega("agendada", "2026-11-20", agora);
  assert.equal(fer.ok, false);
  assert.equal(fer.sugestao, "2026-11-23");
});

test("interpreta data dd/mm e joga para o ano seguinte se já passou", () => {
  const agora = ts("2026-12-20");
  assert.equal(R.interpretarDataBr("05/01", agora), "2027-01-05");
  assert.equal(R.interpretarDataBr("22/12", agora), "2026-12-22");
  assert.equal(R.interpretarDataBr("31/02", agora), null);
  assert.equal(R.interpretarDataBr("amanhã", agora), null);
});

const CATALOGO = [
  {
    id: "p1", nome: "Polpa", ativo: true,
    sabores: [
      { id: "s1", nome: "Manga", ativo: true, variantes: [
        { id: "v1", rotulo: "1 kg", pesoG: 1000, precoCent: 2000, ativo: true },
        { id: "v2", rotulo: "500 g", pesoG: 500, precoCent: 1100, ativo: false },
      ] },
      { id: "s2", nome: "Graviola", ativo: false, variantes: [
        { id: "v3", rotulo: "1 kg", pesoG: 1000, precoCent: 3000, ativo: true },
      ] },
    ],
  },
];

test("menu do bot mostra só sabor e variante ativos", () => {
  const disp = R.variantesDisponiveis(CATALOGO).map((v) => v.varianteId);
  assert.deepEqual(disp, ["v1"]);
  assert.equal(R.saboresDisponiveis(CATALOGO).length, 1);
});

test("revalidação tira item desligado e atualiza preço que mudou", () => {
  const itens = [
    { varianteId: "v1", precoCent: 1800, pesoG: 1000, qtd: 1 },
    { varianteId: "v2", precoCent: 1100, pesoG: 500, qtd: 1 },
  ];
  const r = R.revalidarCarrinho(itens, CATALOGO);
  assert.equal(r.removidos.length, 1);
  assert.equal(r.validos[0].precoCent, 2000);
  assert.equal(r.precoMudou.length, 1);
  assert.equal(itens[0].precoCent, 1800, "não altera o carrinho original");
});

test("acima de 100 kg vai para combinação manual; exatamente 100 kg ainda passa", () => {
  assert.equal(R.excedeLimitePeso([{ pesoG: 1000, qtd: 100, precoCent: 1 }]), false);
  assert.equal(R.excedeLimitePeso([{ pesoG: 1000, qtd: 100, precoCent: 1 }, { pesoG: 250, qtd: 1, precoCent: 1 }]), true);
});

test("webhook é idempotente e reconhece pagamento tardio", () => {
  assert.equal(R.avaliarPagamento({ status: "nao_pago", pagamentos: [] }, "mp1"), "confirmar");
  assert.equal(R.avaliarPagamento({ status: "pago", pagamentos: [{ id: "mp1" }] }, "mp1"), "duplicado");
  assert.equal(R.avaliarPagamento({ status: "cancelado", pagamentos: [] }, "mp2"), "tardio");
  assert.equal(R.avaliarPagamento({ status: "entrega", pagamentos: [] }, "mp3"), "ignorar");
});

test("operador só move Pago→Em entrega e Em entrega→Concluído", () => {
  assert.equal(R.podeMoverManual("pago", "entrega"), true);
  assert.equal(R.podeMoverManual("entrega", "concluido"), true);
  assert.equal(R.podeMoverManual("nao_pago", "pago"), false);
  assert.match(R.motivoBloqueioMovimento("nao_pago", "pago"), /Mercado Pago/);
  assert.equal(R.motivoBloqueioMovimento("pago", "entrega"), null);
});

test("motivo do bloqueio explica cada movimento proibido", () => {
  assert.match(R.motivoBloqueioMovimento("pago", "nao_pago"), /não volta/);
  assert.match(R.motivoBloqueioMovimento("entrega", "pago"), /não volta/);
  assert.match(R.motivoBloqueioMovimento("conversa", "nao_pago"), /bot gera o link/);
  assert.match(R.motivoBloqueioMovimento("nao_pago", "entrega"), /Só pedido pago/);
  assert.match(R.motivoBloqueioMovimento("nao_pago", "concluido"), /em entrega pode ser concluído/);
});

test("link expira no prazo e conversa parada vira abandonada", () => {
  const agora = ts("2026-10-29");
  assert.equal(R.linkExpirado({ status: "nao_pago", link: { expiraEm: agora - 1 } }, agora), true);
  assert.equal(R.linkExpirado({ status: "nao_pago", link: { expiraEm: agora + 1 } }, agora), false);
  assert.equal(R.conversaAbandonada({ status: "conversa", ultimaMsgEm: agora - 24 * R.HORA }, agora, 24), true);
  assert.equal(R.conversaAbandonada({ status: "conversa", ultimaMsgEm: agora - 23 * R.HORA }, agora, 24), false);
});

test("só liga o sabor quando algum tamanho tem preço > 0 (nada é de graça)", () => {
  assert.equal(R.saborTemPreco({ variantes: [{ precoCent: 0 }, { precoCent: 0 }] }), false);
  assert.equal(R.saborTemPreco({ variantes: [{ precoCent: 0 }, { precoCent: 700 }] }), true);
  assert.equal(R.saborTemPreco({ variantes: [] }), false);
  assert.equal(R.saborTemPreco(null), false);
});

test("peso do tamanho sai do rótulo (kg/g) e recusa rótulo sem unidade", () => {
  assert.equal(R.pesoDeRotulo("1 kg"), 1000);
  assert.equal(R.pesoDeRotulo("500 g"), 500);
  assert.equal(R.pesoDeRotulo("1,5kg"), 1500);
  assert.equal(R.pesoDeRotulo("250g"), 250);
  assert.equal(R.pesoDeRotulo("grande"), null);
  assert.equal(R.pesoDeRotulo(""), null);
});
