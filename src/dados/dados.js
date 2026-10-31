/* Dados de exemplo e tabelas de apoio do protótipo.
   Catálogo e preços são EXEMPLOS: o catálogo real está pendente (cartão da Etapa 0). */
(function (FP) {
  "use strict";
  const R = FP.regras;

  const CONFIG_PADRAO = Object.freeze({
    freteMinimoCent: 1200,
    tarifaBaseCent: 500,
    valorPorKmCent: 180,
    multiplicador: 1.1, // decisão: Uber Envios + 10%
    janelaPagamentoMin: 15, // decisão de 29/10
    abandonoHoras: 24, // proposta aceita
    cidadesAtivas: ["João Pessoa", "Cabedelo", "Bayeux"],
  });

  /* Operador de demonstração. A senha fica só como hash SHA-256 de "polpa123". */
  const OPERADOR_DEMO = Object.freeze({
    email: "operador@naturalsabor.com.br",
    nome: "Operador",
    senhaDemo: "polpa123",
  });

  /* Distância de ROTA estimada (km) da fábrica até o bairro.
     No sistema real vem da API de mapa (Google/OpenRouteService), não desta tabela. */
  const KM_POR_BAIRRO = Object.freeze({
    "joao pessoa": {
      centro: 3, tambia: 2.5, varadouro: 3, jaguaribe: 4, torre: 5, tambauzinho: 6, expedicionarios: 5.5,
      "cruz das armas": 5, "cristo redentor": 7, "agua fria": 8, "jose americo": 9, bancarios: 10,
      mangabeira: 12, valentina: 15, geisel: 10, "jardim cidade universitaria": 11, altiplano: 10,
      "cabo branco": 9, tambau: 8, manaira: 9, "jardim oceania": 11, bessa: 11, aeroclube: 10,
      brisamar: 7, miramar: 7.5, "jardim sao paulo": 9, "castelo branco": 8, cuia: 13,
      gramame: 16, funcionarios: 9, oitizeiro: 7, "alto do ceu": 9, mandacaru: 7,
    },
    cabedelo: { intermares: 16, "ponta de campina": 18, camboinha: 19, poco: 20, centro: 23, formosa: 21, camalau: 22 },
    bayeux: { centro: 10, "mario andreazza": 11, imaculada: 12, "jardim aeroporto": 13, sesi: 12, "alto da boa vista": 11, "sao bento": 10 },
  });
  const KM_PADRAO_CIDADE = Object.freeze({ "joao pessoa": 9, cabedelo: 19, bayeux: 11 });

  /* CEPs de teste para quando o ViaCEP não responder (modo offline). */
  const CEPS_OFFLINE = Object.freeze({
    "58038000": { rua: "Avenida Governador Flávio Ribeiro Coutinho", bairro: "Manaíra", cidade: "João Pessoa", uf: "PB" },
    "58039000": { rua: "Avenida Nego", bairro: "Tambaú", cidade: "João Pessoa", uf: "PB" },
    "58055000": { rua: "Rua das Acácias", bairro: "Mangabeira", cidade: "João Pessoa", uf: "PB" },
    "58102202": { rua: "Avenida Oceano Atlântico", bairro: "Intermares", cidade: "Cabedelo", uf: "PB" },
    "58306000": { rua: "Rua Sinésio Guimarães", bairro: "Centro", cidade: "Bayeux", uf: "PB" },
    "58400000": { rua: "", bairro: "Centro", cidade: "Campina Grande", uf: "PB" },
    "01310100": { rua: "Avenida Paulista", bairro: "Bela Vista", cidade: "São Paulo", uf: "SP" },
  });

  function variante(id, rotulo, pesoG, precoCent, ativo) {
    return { id, rotulo, pesoG, precoCent, ativo };
  }

  /* Preço por sabor x tamanho (nunca valor único). */
  function sabor(id, nome, precoKg, opcoes) {
    const o = opcoes || {};
    const off = o.off || [];
    const arred = (v) => Math.round(v / 10) * 10;
    return {
      id,
      nome,
      ativo: o.ativo !== false,
      variantes: [
        variante(id + "-1kg", "1 kg", 1000, precoKg, !off.includes("1kg")),
        variante(id + "-500", "500 g", 500, arred(precoKg * 0.56), !off.includes("500")),
        variante(id + "-250", "250 g", 250, arred(precoKg * 0.32), !off.includes("250")),
      ],
    };
  }

  function catalogoInicial() {
    return [
      {
        id: "polpa",
        nome: "Polpa de fruta",
        ativo: true,
        sabores: [
          sabor("acerola", "Acerola", 1600),
          sabor("caja", "Cajá", 2200),
          sabor("caju", "Caju", 1600),
          sabor("goiaba", "Goiaba", 1700),
          sabor("graviola", "Graviola", 3200, { ativo: false }),
          sabor("manga", "Manga", 1800),
          sabor("maracuja", "Maracujá", 2400),
          sabor("morango", "Morango", 2600, { off: ["250"] }),
          sabor("uva", "Uva", 2300),
          sabor("abacaxi-hortela", "Abacaxi com hortelã", 2000),
        ],
      },
    ];
  }

  function kmPara(bairro, cidade) {
    const c = R.normalizar(cidade);
    const tabela = KM_POR_BAIRRO[c] || {};
    const km = tabela[R.normalizar(bairro)];
    if (typeof km === "number") return { km, estimado: false };
    return { km: KM_PADRAO_CIDADE[c] || 10, estimado: true };
  }

  FP.dados = { CONFIG_PADRAO, OPERADOR_DEMO, CEPS_OFFLINE, catalogoInicial, kmPara };
})(window.FP = window.FP || {});
