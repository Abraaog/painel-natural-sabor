/* Busca de endereço por CEP: ViaCEP de verdade, com tabela offline de reserva.
   No sistema real fica no backend, junto com a API de rotas. */
(function (FP) {
  "use strict";
  const D = FP.dados;
  const TEMPO_LIMITE_MS = 4000;

  async function buscar(cep) {
    const d = String(cep).replace(/\D/g, "");
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TEMPO_LIMITE_MS);
      const r = await fetch("https://viacep.com.br/ws/" + d + "/json/", { signal: ctrl.signal });
      clearTimeout(timer);
      if (r.ok) {
        const j = await r.json();
        if (j && j.erro) return { ok: false };
        if (j && typeof j.localidade === "string") {
          return {
            ok: true,
            cep: d,
            rua: typeof j.logradouro === "string" ? j.logradouro : "",
            bairro: typeof j.bairro === "string" && j.bairro ? j.bairro : "Centro",
            cidade: j.localidade,
            uf: typeof j.uf === "string" ? j.uf : "",
            fonte: "ViaCEP",
          };
        }
      }
    } catch (erro) { /* sem internet ou ViaCEP fora: usa a tabela offline */ }
    const off = D.CEPS_OFFLINE[d];
    return off ? Object.assign({ ok: true, cep: d, fonte: "tabela offline" }, off) : { ok: false };
  }

  FP.cep = { buscar };
})(window.FP = window.FP || {});
