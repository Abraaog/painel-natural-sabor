/* Peças de interface compartilhadas: navegação, toast, modal e alerta sonoro. */
(function (FP) {
  "use strict";
  const U = FP.util;

  const telas = new Map();
  let atual = null;
  let modalAtivo = null; // { render: fn } para redesenhar quando o estado muda

  function registrarTela(nome, def) {
    telas.set(nome, def);
  }

  function irPara(nome) {
    if (!telas.has(nome)) nome = "pedidos";
    atual = nome;
    U.$$(".menu-item").forEach((b) => b.classList.toggle("ativo", b.dataset.tela === nome));
    U.$$(".tela").forEach((s) => s.classList.toggle("oculto", s.id !== "tela-" + nome));
    const def = telas.get(nome);
    U.$("#tituloTela").textContent = def.titulo;
    if (location.hash !== "#" + nome) history.replaceState(null, "", "#" + nome);
    redesenhar();
  }

  let redesenhoAdiado = false;

  /* Não redesenha no meio de um arraste (perderia o cartão); redesenha ao soltar. */
  function redesenhar() {
    if (U.$(".cartao.arrastando")) { redesenhoAdiado = true; return; }
    redesenhoAdiado = false;
    const def = telas.get(atual);
    if (def) def.render(U.$("#tela-" + atual));
    if (modalAtivo) modalAtivo.render();
  }

  function retomarRedesenho() {
    if (redesenhoAdiado) redesenhar();
  }

  function aCadaSegundo() {
    const def = telas.get(atual);
    if (def && def.aCadaSegundo) def.aCadaSegundo(U.$("#tela-" + atual));
    if (modalAtivo && modalAtivo.aCadaSegundo) modalAtivo.aCadaSegundo();
  }

  /* ---------- toast ---------- */
  function toast(msg, tipo) {
    const el = document.createElement("div");
    el.className = "toast " + (tipo || "");
    el.setAttribute("role", "status");
    el.textContent = msg;
    U.$("#toasts").appendChild(el);
    setTimeout(() => el.classList.add("saindo"), 3600);
    setTimeout(() => el.remove(), 4000);
  }

  /* ---------- modal ---------- */
  function abrirModal(def) {
    modalAtivo = def;
    U.$("#modal").classList.remove("oculto");
    U.$("#modal").setAttribute("aria-hidden", "false");
    def.render();
    const caixa = U.$("#modal .modal-caixa");
    if (caixa) caixa.focus();
  }

  function fecharModal() {
    modalAtivo = null;
    U.$("#modal").classList.add("oculto");
    U.$("#modal").setAttribute("aria-hidden", "true");
  }

  function preencherModal(titulo, sub, corpo, acoes) {
    U.$("#modalTitulo").innerHTML = titulo;
    U.$("#modalSub").innerHTML = sub || "";
    U.$("#modalCorpo").innerHTML = corpo;
    U.$("#modalAcoes").innerHTML = acoes || "";
  }

  /* ---------- som de pagamento ---------- */
  let audioCtx = null;
  function beep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.18].forEach((atraso, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const t0 = audioCtx.currentTime + atraso;
        osc.type = "sine";
        osc.frequency.setValueAtTime(i ? 1320 : 880, t0);
        gain.gain.setValueAtTime(0.15, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.17);
      });
    } catch (erro) { /* navegador sem áudio */ }
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalAtivo) fecharModal();
  });

  FP.ui = {
    registrarTela, irPara, redesenhar, retomarRedesenho, aCadaSegundo, telaAtual: () => atual,
    toast, abrirModal, fecharModal, preencherModal, modalAberto: () => modalAtivo, beep,
  };
})(window.FP = window.FP || {});
