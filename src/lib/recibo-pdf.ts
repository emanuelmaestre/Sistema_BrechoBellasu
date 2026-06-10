// ══════════════════════════════════════════════════════════
// Gerador de Recibo PDF — html2canvas → jsPDF
// Renderiza HTML fiel ao modelo oficial (RECIBO - SISTEMA.html)
// Suporta emoji, fontes Google, CSS completo.
// ══════════════════════════════════════════════════════════

function formatarTelefone(tel: string): string {
  if (!tel) return "—"
  const d = tel.replace(/\D/g, "")
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return tel
}

export interface ReciboItem {
  nome: string
  cor?: string | null
  marca?: string | null
  qtd: number
  preco_unit: number
  subtotal: number
}

export interface ReciboData {
  numero: number | string
  tipo: "Venda" | "Troca" | "Devolução"
  data: string
  cliente_nome: string
  cliente_celular: string
  itens: ReciboItem[]
  forma_pagamento: string
  frete?: number
  desconto?: number
  total: number
}

function fmtBRL(v: number) {
  return `R$ ${v.toFixed(2).replace(".", ",")}`
}

function buildHTML(data: ReciboData): string {
  const subtotal = data.itens.reduce((s, it) => s + it.subtotal, 0)
  const frete    = data.frete    ?? 0
  const desconto = data.desconto ?? 0

  const formas = ["PIX", "Dinheiro", "Cartão Crédito", "Cartão Débito", "Crédito"]
  const formaAtual = (data.forma_pagamento ?? "").toLowerCase()

  const chipsHTML = formas.map(f => {
    const sel = formaAtual.includes(f.toLowerCase())
    return `<label class="pt${sel ? " sel" : ""}"><span>${f}</span></label>`
  }).join("")

  const rowsHTML = data.itens.map((item, i) => `
    <tr class="${i % 2 === 0 ? "odd" : "even"}">
      <td class="desc">${item.nome.toUpperCase()}</td>
      <td class="c">${item.marca || "—"}</td>
      <td class="cq">${item.qtd}</td>
      <td class="cp">${fmtBRL(item.preco_unit)}</td>
      <td class="sv">${fmtBRL(item.subtotal)}</td>
    </tr>`).join("")

  const linhasResumo = [
    `<div class="tr"><span>Subtotal</span><span>${fmtBRL(subtotal)}</span></div>`,
    frete    > 0 ? `<div class="tr"><span>Frete</span><span>${fmtBRL(frete)}</span></div>` : "",
    `<div class="tr"><span>Desconto</span><span>${desconto > 0 ? `– ${fmtBRL(desconto)}` : "—"}</span></div>`,
    `<div class="tr ttotal"><span>TOTAL</span><span>${fmtBRL(data.total)}</span></div>`,
  ].join("")

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,400;0,700;1,400&family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--gold:#C9A84C;--gold-l:#E8D49A;--gold-d:#9B7A2F;--brown:#3B1F0E;--br2:#6B4226;--cream:#F7F2E8;--bd:#D4B86A}
body{background:#fff;font-family:'Lato',sans-serif;display:flex;justify-content:center;align-items:flex-start;min-height:unset}
.card{background:#fff;width:600px;border:1px solid var(--bd)}
.gbar{height:5px;background:linear-gradient(90deg,var(--gold-d),var(--gold),var(--gold-l),var(--gold),var(--gold-d))}
.hd{background:var(--cream);padding:24px 28px 18px;text-align:center;border-bottom:1px solid var(--bd)}
.hd img{width:90px;height:90px;object-fit:contain;display:block;margin:0 auto 8px}
.hd h1{font-family:'Playfair Display',serif;font-size:20px;color:var(--brown);letter-spacing:3px;text-transform:uppercase}
.hd .tag{font-family:'Playfair Display',serif;font-style:italic;color:var(--gold-d);font-size:11.5px;margin-top:3px}
.divider{height:1px;background:linear-gradient(90deg,transparent,var(--gold),transparent);margin:14px auto 0;width:70%}
.meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:14px;text-align:center}
.mi{display:flex;flex-direction:column;gap:4px;align-items:center}
.lbl{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:var(--gold-d)}
.val{font-family:'Lato',sans-serif;font-size:13px;font-weight:700;color:var(--brown)}
.sec{padding:16px 28px;border-bottom:1px solid #ede5d5}
.stitle{font-size:9.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--gold-d);margin-bottom:12px;display:flex;align-items:center;gap:8px}
.stitle::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,var(--gold-l),transparent)}
.c2{display:grid;grid-template-columns:1fr 1fr;gap:10px 20px}
.fg{display:flex;flex-direction:column;gap:3px}
.flbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:var(--gold-d)}
.fval{font-size:13px;color:var(--brown);font-weight:700;word-break:break-word;word-spacing:4px;letter-spacing:0.3px}
.lgpd{background:#fffaef;border-left:3px solid var(--gold);padding:8px 12px;font-size:10.5px;color:var(--br2);line-height:1.6;margin-top:12px}
.lgpd b{color:var(--gold-d)}
table{width:100%;border-collapse:collapse;font-size:13px;table-layout:fixed}
col.cd{width:40%}col.ct{width:12%}col.cq{width:10%}col.cp{width:16%}col.cs{width:22%}
thead tr{background:var(--brown)}
thead th{padding:10px 12px;font-size:9px;letter-spacing:0.8px;text-transform:uppercase;color:var(--gold-l);font-weight:700;text-align:left;vertical-align:middle}
thead th.c{text-align:center}
thead th.r{text-align:right}
tbody tr{border-bottom:1px solid #e8e0ce}
tbody tr.even{background:var(--cream)}
tbody tr.odd{background:#fff}
tbody td{padding:9px 12px;vertical-align:middle;line-height:1.4}
tbody td.desc{color:var(--brown);font-weight:700}
tbody td.c{color:var(--brown);font-weight:700;text-align:center}
tbody td.cq{color:var(--brown);font-weight:700;text-align:center}
tbody td.cp{color:var(--brown);font-weight:700;text-align:right}
tbody td.sv{text-align:right;font-weight:700;color:var(--brown)}
.bot{display:grid;grid-template-columns:1fr auto;gap:24px;align-items:start;padding:16px 28px}
.pay-col{display:flex;flex-direction:column;gap:7px}
.pt{display:flex;align-items:center;justify-content:center;text-align:center;font-size:12px;color:var(--br2);padding:7px 10px;border:1px solid var(--bd);border-radius:2px;white-space:nowrap;line-height:1}
.pt.sel{background:var(--brown);color:var(--gold-l);border-color:var(--brown);font-weight:700}
.tbox{border:1px solid var(--bd);min-width:195px}
.tr{display:flex;justify-content:space-between;padding:8px 12px;font-size:12.5px;color:var(--br2);border-bottom:1px solid #ede5d5;align-items:center;line-height:1}
.tr:last-child{border:none}
.ttotal{background:var(--brown);color:var(--gold-l);font-family:'Lato',sans-serif;font-size:16px;font-weight:700;padding:11px 12px}
.ft{background:var(--cream);padding:16px 28px;text-align:center;border-top:3px solid var(--gold)}
.ft-msg{font-family:'Playfair Display',serif;font-style:italic;font-weight:700;font-size:13.5px;color:var(--brown);margin-bottom:8px}
.ft-links{display:flex;justify-content:center;gap:22px;font-size:12px;flex-wrap:wrap;margin-bottom:8px}
.ft-links a{color:var(--gold-d);text-decoration:none;border-bottom:1px dashed var(--gold)}
.ft-note{font-size:10px;color:var(--gold-d);letter-spacing:1px;text-transform:uppercase;font-weight:700}
</style>
</head>
<body>
<div class="card">
  <div class="gbar"></div>

  <!-- HEADER -->
  <div class="hd">
    <img src="/logo-bellasu-pdf.jpg" alt="Logo Brechó Bellasu" onerror="this.style.display='none'">
    <h1>Brechó Bellasu</h1>
    <div class="tag">O Desapego é o Esporte da Felicidade!</div>
    <div class="divider"></div>
    <div class="meta">
      <div class="mi">
        <span class="lbl">Nº Recibo</span>
        <span class="val">${String(data.numero).padStart(3, "0")}</span>
      </div>
      <div class="mi">
        <span class="lbl">Data da Compra</span>
        <span class="val">${data.data}</span>
      </div>
      <div class="mi">
        <span class="lbl">Tipo</span>
        <span class="val">${data.tipo.toUpperCase()}</span>
      </div>
    </div>
  </div>

  <!-- CLIENTE -->
  <div class="sec">
    <div class="stitle">Cliente</div>
    <div class="c2">
      <div class="fg">
        <span class="flbl">Nome</span>
        <span class="fval">${data.cliente_nome.toUpperCase()}</span>
      </div>
      <div class="fg">
        <span class="flbl">WhatsApp</span>
        <span class="fval">${formatarTelefone(data.cliente_celular)}</span>
      </div>
    </div>
    <div class="lgpd">
      <b>LGPD – LEI 13.709/2018</b> — Nome e telefone coletados exclusivamente para identificação desta transação. Não compartilhados com terceiros.
    </div>
  </div>

  <!-- ITENS -->
  <div class="sec">
    <div class="stitle">Itens</div>
    <table>
      <colgroup>
        <col class="cd"><col class="ct"><col class="cq"><col class="cp"><col class="cs">
      </colgroup>
      <thead>
        <tr>
          <th>Descrição</th>
          <th class="c">Marca</th>
          <th class="c">Qtd.</th>
          <th class="r">Preço Unit.</th>
          <th class="r">Subtotal</th>
        </tr>
      </thead>
      <tbody>${rowsHTML}</tbody>
    </table>
  </div>

  <!-- PAGAMENTO + RESUMO -->
  <div class="bot">
    <div class="pay-col">
      <div class="stitle" style="margin-bottom:8px">Pagamento</div>
      ${chipsHTML}
    </div>
    <div>
      <div class="stitle" style="margin-bottom:8px">Resumo</div>
      <div class="tbox">${linhasResumo}</div>
    </div>
  </div>

  <!-- RODAPÉ -->
  <div class="ft">
    <div class="ft-msg">Obrigada pela sua compra! 🛍️✨</div>
    <div class="ft-links">
      <a href="https://wa.me/5516994556296">📱 (16) 99455-6296</a>
      <a href="https://www.instagram.com/brecho.bellasu/">📸 @brecho.bellasu</a>
    </div>
    <div class="ft-note">Trocas aceitas em até 7 dias &nbsp;·&nbsp; Guarde este recibo</div>
  </div>
  <div class="gbar"></div>
</div>
</body>
</html>`
}

/** Abre o recibo em nova janela e dispara o diálogo de impressão nativa.
 *  Texto é selecionável/copiável. Usa window.print() — sem custo extra. */
export function imprimirRecibo(data: ReciboData): void {
  const html = buildHTML(data)
  const win = window.open("", "_blank", "width=700,height=900")
  if (!win) return
  win.document.open()
  win.document.write(html)
  win.document.close()
  // Aguarda fontes e imagens antes de imprimir
  win.onload = () => {
    setTimeout(() => {
      win.focus()
      win.print()
    }, 600)
  }
}

export async function gerarReciboPDF(data: ReciboData): Promise<Blob> {
  // Importações dinâmicas — só no browser
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ])

  // Monta o HTML num iframe oculto para isolar estilos e carregar fontes
  const iframe = document.createElement("iframe")
  iframe.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:640px;height:900px;border:none;visibility:hidden"
  document.body.appendChild(iframe)

  const iDoc = iframe.contentDocument!
  iDoc.open()
  iDoc.write(buildHTML(data))
  iDoc.close()

  // Aguarda fontes + imagens carregarem
  await new Promise<void>(resolve => {
    const check = () => {
      if (iDoc.readyState === "complete") resolve()
      else setTimeout(check, 50)
    }
    check()
  })

  // Aguarda fontes Google
  try {
    await (iDoc as Document & { fonts?: FontFaceSet }).fonts?.ready
  } catch { /* fallback silencioso */ }

  // Pequeno delay extra para garantir render das fontes
  await new Promise(r => setTimeout(r, 400))

  const card = iDoc.querySelector(".card") as HTMLElement
  if (!card) throw new Error("Elemento .card não encontrado no recibo HTML")

  const canvas = await html2canvas(card, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    windowWidth: 600,
    scrollX: 0,
    scrollY: 0,
  })

  document.body.removeChild(iframe)

  // Largura A4 em mm — altura exata do conteúdo (sem espaço em branco)
  const A4_W = 210
  const imgW = A4_W
  const imgH = (canvas.height * A4_W) / canvas.width

  const doc = new jsPDF({
    unit: "mm",
    format: [A4_W, imgH],
    orientation: "portrait",
  })

  const imgData = canvas.toDataURL("image/jpeg", 0.92)

  // Uma única página do tamanho exato do recibo
  doc.addImage(imgData, "JPEG", 0, 0, imgW, imgH)

  if (false) {
    // bloco mantido apenas para satisfazer o compilador — nunca executado
    let srcY = 0
    const pageH = (297 * canvas.width) / A4_W
    while (srcY < canvas.height) {
      const slice = Math.min(pageH, canvas.height - srcY)
      const pageCanvas = document.createElement("canvas")
      pageCanvas.width  = canvas.width
      pageCanvas.height = slice
      const ctx = pageCanvas.getContext("2d")!
      ctx.drawImage(canvas, 0, srcY, canvas.width, slice, 0, 0, canvas.width, slice)
      const pageData = pageCanvas.toDataURL("image/jpeg", 0.92)
      if (srcY > 0) doc.addPage()
      doc.addImage(pageData, "JPEG", 0, 0, A4_W, (slice * A4_W) / canvas.width)
      srcY += slice
    }
  }

  return doc.output("blob")
}
