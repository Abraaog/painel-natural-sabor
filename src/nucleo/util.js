/* Utilitários de tela: formatação, escape de HTML, seletores e hash de senha. */
(function (FP) {
  "use strict";

  const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  /* Escapa texto antes de ir para innerHTML (nome do cliente vem do WhatsApp). */
  function esc(valor) {
    return String(valor === undefined || valor === null ? "" : valor).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  function duracao(ms) {
    const min = Math.max(0, Math.floor(ms / 60000));
    if (min < 60) return min + " min";
    const h = Math.floor(min / 60);
    if (h < 48) return h + " h" + (min % 60 ? " " + (min % 60) + " min" : "");
    return Math.floor(h / 24) + " dias";
  }

  function contagem(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  /* Telefone no padrão do WhatsApp: só dígitos com DDI 55 (link) e "+55 83 99999-1234" (exibição/cópia). */
  function digitosWhats(t) {
    const d = String(t || "").replace(/\D/g, "");
    return d.startsWith("55") && d.length >= 12 ? d : "55" + d;
  }

  function telefoneWhats(t) {
    const d = digitosWhats(t);
    const ddd = d.slice(2, 4);
    const num = d.slice(4);
    return "+55 " + ddd + " " + num.slice(0, num.length - 4) + "-" + num.slice(-4);
  }

  /* Copia texto. Clipboard API em https/localhost; fallback para IP da rede. */
  function copiar(texto) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(texto).then(() => true, () => copiarAntigo(texto));
    }
    return Promise.resolve(copiarAntigo(texto));
  }

  function copiarAntigo(texto) {
    const area = document.createElement("textarea");
    area.value = texto;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (erro) { ok = false; }
    area.remove();
    return ok;
  }

  /* SHA-256 em JS puro. crypto.subtle não existe fora de https/localhost,
     e o protótipo também roda por IP da rede. No sistema real: bcrypt/argon2 no servidor. */
  function sha256(texto) {
    const bytes = new TextEncoder().encode(texto);
    const K = [];
    const H = [];
    let n = 2;
    let achados = 0;
    const frac = (x) => ((x - Math.floor(x)) * 4294967296) | 0;
    while (achados < 64) {
      let primo = true;
      for (let d = 2; d * d <= n; d += 1) if (n % d === 0) { primo = false; break; }
      if (primo) {
        if (achados < 8) H[achados] = frac(Math.pow(n, 1 / 2));
        K[achados] = frac(Math.pow(n, 1 / 3));
        achados += 1;
      }
      n += 1;
    }
    const tam = bytes.length;
    const total = ((tam + 9 + 63) >> 6) << 6;
    const msg = new Uint8Array(total);
    msg.set(bytes);
    msg[tam] = 0x80;
    const bits = tam * 8;
    const dv = new DataView(msg.buffer);
    dv.setUint32(total - 4, bits >>> 0);
    dv.setUint32(total - 8, Math.floor(bits / 4294967296));
    const W = new Int32Array(64);
    const rotr = (x, r) => (x >>> r) | (x << (32 - r));
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i += 1) W[i] = dv.getInt32(off + i * 4);
      for (let i = 16; i < 64; i += 1) {
        const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
        const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i += 1) {
        const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
        const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      [a, b, c, d, e, f, g, h].forEach((v, i) => { H[i] = (H[i] + v) | 0; });
    }
    return H.map((v) => (v >>> 0).toString(16).padStart(8, "0")).join("");
  }

  FP.util = {
    $: (sel, raiz) => (raiz || document).querySelector(sel),
    $$: (sel, raiz) => Array.from((raiz || document).querySelectorAll(sel)),
    esc,
    dinheiro: (cent) => BRL.format((cent || 0) / 100),
    hhmm: (ts) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    dataHora: (ts) => new Date(ts).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
    }),
    dataCurta: (iso) => FP.regras.dataBr(iso).slice(0, 5),
    diaSemana: (iso) => new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
    kg: (g) => (g / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " kg",
    telefoneBr: (t) => {
      const d = String(t).replace(/\D/g, "").replace(/^55/, "");
      return d.length === 11 ? "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7) : t;
    },
    telefoneWhats,
    linkWhats: (t) => "https://wa.me/" + digitosWhats(t),
    copiar,
    duracao,
    contagem,
    sha256,
  };
})(window.FP = window.FP || {});
