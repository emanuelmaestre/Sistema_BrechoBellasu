// ══════════════════════════════════════════════════════════════════
// Impressão direta por cabo USB (WebUSB) na BY-480BT — sem driver.
//
// O navegador fala com a impressora pela porta USB e manda os pontos da
// etiqueta já rasterizados. Só existe no Chrome/Edge (Android com cabo
// OTG, ou desktop sem o driver do fabricante ocupando a porta).
//
// A linguagem de comandos da BY-480BT não foi encontrada na documentação.
// Todas as candidatas ficam disponíveis (ver `MODOS`), o modo que funcionar
// é lembrado, e `investigar` pergunta à própria impressora o que ela aceita.
// ══════════════════════════════════════════════════════════════════

import { ETIQUETA_MM } from "./etiqueta-sacola"

export type ModoImpressora = "tspl" | "tspl-continuo" | "escpos" | "cpcl" | "zpl"

/** Ordem de tentativa. A posição + 1 é o número de quadrados na etiqueta de teste. */
export const MODOS: Array<{ id: ModoImpressora; nome: string }> = [
  { id: "tspl", nome: "TSPL (etiqueta com vão)" },
  { id: "tspl-continuo", nome: "TSPL (sem vão)" },
  { id: "escpos", nome: "ESC/POS" },
  { id: "cpcl", nome: "CPCL" },
  { id: "zpl", nome: "ZPL" },
]

// WebUSB não vem nos tipos do TypeScript deste projeto; só o que se usa.
interface UsbTransferIn { status: string; data?: DataView }
interface UsbEndpoint { endpointNumber: number; direction: "in" | "out"; type: string }
interface UsbAlternate { interfaceClass: number; endpoints: UsbEndpoint[] }
interface UsbInterface { interfaceNumber: number; alternates: UsbAlternate[] }
interface UsbConfig { configurationValue: number; interfaces: UsbInterface[] }
export interface UsbDevice {
  vendorId?: number
  productId?: number
  serialNumber?: string
  productName?: string
  manufacturerName?: string
  opened: boolean
  configuration: UsbConfig | null
  configurations: UsbConfig[]
  open(): Promise<void>
  close(): Promise<void>
  selectConfiguration(v: number): Promise<void>
  claimInterface(n: number): Promise<void>
  releaseInterface(n: number): Promise<void>
  transferOut(ep: number, data: BufferSource): Promise<{ status: string }>
  transferIn?(ep: number, len: number): Promise<UsbTransferIn>
  controlTransferIn?(
    setup: { requestType: "class"; recipient: "interface"; request: number; value: number; index: number },
    len: number,
  ): Promise<UsbTransferIn>
}
interface UsbApi {
  requestDevice(o: { filters: Array<{ classCode?: number }> }): Promise<UsbDevice>
  getDevices(): Promise<UsbDevice[]>
}

const usb = (): UsbApi | null =>
  typeof navigator !== "undefined" && "usb" in navigator
    ? ((navigator as unknown as { usb: UsbApi }).usb)
    : null

export const usbDisponivel = () => usb() !== null

const CHAVE_MODO = "impressora-usb-modo"

export function modoSalvo(): ModoImpressora {
  try {
    const v = localStorage.getItem(CHAVE_MODO)
    return MODOS.some((m) => m.id === v) ? (v as ModoImpressora) : "tspl"
  } catch {
    return "tspl"
  }
}

export function salvarModo(m: ModoImpressora): void {
  try { localStorage.setItem(CHAVE_MODO, m) } catch { /* sem storage: segue */ }
}

// ─── Conexão ─────────────────────────────────────────────────────

export interface Conexao {
  dispositivo: UsbDevice
  interfaceNumero: number
  endpoint: number
  /** Porta de leitura, quando existe — é por ela que a impressora responde. */
  endpointEntrada?: number
}

function achar(dispositivo: UsbDevice): { interfaceNumero: number; endpoint: number; entrada?: number; config: number } {
  const configs = dispositivo.configuration ? [dispositivo.configuration] : dispositivo.configurations
  let melhor: { interfaceNumero: number; endpoint: number; entrada?: number; config: number; classe: number } | null = null
  for (const c of configs) {
    for (const i of c.interfaces) {
      for (const alt of i.alternates) {
        const saida = alt.endpoints.find((e) => e.direction === "out" && e.type === "bulk")
        if (!saida) continue
        const entrada = alt.endpoints.find((e) => e.direction === "in" && e.type === "bulk")
        const cand = {
          interfaceNumero: i.interfaceNumber, endpoint: saida.endpointNumber,
          entrada: entrada?.endpointNumber,
          config: c.configurationValue, classe: alt.interfaceClass,
        }
        // Prefere a interface de classe impressora (7).
        if (!melhor || (cand.classe === 7 && melhor.classe !== 7)) melhor = cand
      }
    }
  }
  if (!melhor) throw new Error("Este dispositivo USB não tem porta de saída para impressão.")
  return melhor
}

async function abrir(dispositivo: UsbDevice): Promise<Conexao> {
  if (!dispositivo.opened) await dispositivo.open()
  const alvo = achar(dispositivo)
  if (!dispositivo.configuration) await dispositivo.selectConfiguration(alvo.config)
  try {
    await dispositivo.claimInterface(alvo.interfaceNumero)
  } catch {
    throw new Error(
      "O sistema operacional está usando a impressora (driver instalado). " +
      "No Windows, troque o driver por WinUSB ou use o Android; no Android, feche outros apps de impressão.",
    )
  }
  return {
    dispositivo, interfaceNumero: alvo.interfaceNumero,
    endpoint: alvo.endpoint, endpointEntrada: alvo.entrada,
  }
}

/** Reabre a impressora já autorizada antes, sem pedir permissão de novo. */
export async function reconectar(): Promise<Conexao | null> {
  const api = usb()
  if (!api) return null
  const [primeiro] = await api.getDevices()
  if (!primeiro) return null
  try { return await abrir(primeiro) } catch { return null }
}

/** Abre o seletor do navegador (precisa de um clique do usuário). */
export async function conectar(): Promise<Conexao> {
  const api = usb()
  if (!api) throw new Error("Este navegador não permite USB. Use o Chrome ou o Edge.")
  const dispositivo = await api.requestDevice({
    filters: [{ classCode: 7 }, { classCode: 255 }, { classCode: 0 }],
  })
  return abrir(dispositivo)
}

export async function desconectar(c: Conexao): Promise<void> {
  try {
    await c.dispositivo.releaseInterface(c.interfaceNumero)
    await c.dispositivo.close()
  } catch { /* já desconectada */ }
}

export function nomeDaImpressora(c: Conexao): string {
  return [c.dispositivo.manufacturerName, c.dispositivo.productName].filter(Boolean).join(" ") || "Impressora USB"
}

// ─── Comandos ────────────────────────────────────────────────────

const texto = (s: string) => new TextEncoder().encode(s)

function juntar(partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((s, p) => s + p.length, 0)
  const saida = new Uint8Array(total)
  let pos = 0
  for (const p of partes) { saida.set(p, pos); pos += p.length }
  return saida
}

/** Empacota os pontos em bytes; `queimar` decide o valor do bit de ponto preto. */
function empacotar(preto: Uint8Array, largura: number, altura: number, queimar: 0 | 1): Uint8Array {
  const bytesLinha = Math.ceil(largura / 8)
  const saida = new Uint8Array(bytesLinha * altura)
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      const ehPreto = preto[y * largura + x] === 1
      const bit = ehPreto ? queimar : (queimar ^ 1)
      if (bit) saida[y * bytesLinha + (x >> 3)] |= 0x80 >> (x & 7)
    }
  }
  return saida
}

/** TSPL: no BITMAP, bit 0 queima (preto) e bit 1 fica branco. */
export function comandoTspl(
  preto: Uint8Array, largura: number, altura: number, comVao = true,
): Uint8Array {
  const bytesLinha = Math.ceil(largura / 8)
  return juntar([
    texto(
      `SIZE ${ETIQUETA_MM.largura} mm,${ETIQUETA_MM.altura} mm\r\n` +
      (comVao ? "GAP 3 mm,0 mm\r\n" : "GAP 0 mm,0 mm\r\n") +
      `DIRECTION 0\r\nCLS\r\n` +
      `BITMAP 0,0,${bytesLinha},${altura},0,`,
    ),
    empacotar(preto, largura, altura, 0),
    texto("\r\nPRINT 1,1\r\n"),
  ])
}

/** ESC/POS: GS v 0 — bit 1 queima. Termina com avanço até o próximo vão. */
export function comandoEscPos(preto: Uint8Array, largura: number, altura: number): Uint8Array {
  const bytesLinha = Math.ceil(largura / 8)
  const cab = new Uint8Array([
    0x1b, 0x40, // ESC @ — reinicia
    0x1d, 0x76, 0x30, 0x00,
    bytesLinha & 0xff, bytesLinha >> 8,
    altura & 0xff, altura >> 8,
  ])
  return juntar([cab, empacotar(preto, largura, altura, 1), new Uint8Array([0x1d, 0x0c])])
}

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("").toUpperCase()

/** CPCL: EG recebe o bitmap em binário, bit 1 = preto. */
export function comandoCpcl(preto: Uint8Array, largura: number, altura: number): Uint8Array {
  const bytesLinha = Math.ceil(largura / 8)
  return juntar([
    texto(`! 0 200 200 ${altura} 1\r\nPAGE-WIDTH ${largura}\r\nEG ${bytesLinha} ${altura} 0 0 `),
    empacotar(preto, largura, altura, 1),
    texto("\r\nFORM\r\nPRINT\r\n"),
  ])
}

/** ZPL: ^GFA com dados em hexadecimal, bit 1 = preto. */
export function comandoZpl(preto: Uint8Array, largura: number, altura: number): Uint8Array {
  const bytesLinha = Math.ceil(largura / 8)
  const total = bytesLinha * altura
  return texto(
    `^XA^PW${largura}^LL${altura}^FO0,0^GFA,${total},${total},${bytesLinha},` +
    hex(empacotar(preto, largura, altura, 1)) + "^FS^XZ",
  )
}

export function montarComando(
  modo: ModoImpressora, preto: Uint8Array, largura: number, altura: number,
): Uint8Array {
  switch (modo) {
    case "tspl": return comandoTspl(preto, largura, altura, true)
    case "tspl-continuo": return comandoTspl(preto, largura, altura, false)
    case "escpos": return comandoEscPos(preto, largura, altura)
    case "cpcl": return comandoCpcl(preto, largura, altura)
    case "zpl": return comandoZpl(preto, largura, altura)
  }
}

/** Envia em blocos: transferências únicas de 100 KB estouram o buffer de alguns adaptadores. */
export async function enviar(c: Conexao, dados: Uint8Array): Promise<void> {
  const BLOCO = 16 * 1024
  for (let i = 0; i < dados.length; i += BLOCO) {
    const r = await c.dispositivo.transferOut(c.endpoint, dados.slice(i, i + BLOCO))
    if (r.status !== "ok") throw new Error(`A impressora recusou os dados (${r.status}).`)
  }
}

/** Pontos de uma etiqueta de teste: moldura, diagonais e régua de 10 mm. */
export function pontosDeTeste(largura: number, altura: number, numero = 0): Uint8Array {
  const p = new Uint8Array(largura * altura)
  const ponto = (x: number, y: number, e = 3) => {
    for (let dy = 0; dy < e; dy++) for (let dx = 0; dx < e; dx++) {
      const xx = x + dx, yy = y + dy
      if (xx >= 0 && xx < largura && yy >= 0 && yy < altura) p[yy * largura + xx] = 1
    }
  }
  for (let x = 0; x < largura; x++) { ponto(x, 0); ponto(x, altura - 4) }
  for (let y = 0; y < altura; y++) { ponto(0, y); ponto(largura - 4, y) }
  for (let y = 0; y < altura; y += 80) for (let x = 0; x < 40; x++) ponto(x, y, 2)
  for (let i = 0; i < largura; i++) ponto(i, Math.round((i * altura) / largura), 2)
  // Quadrados grandes no topo: quantos saíram diz qual linguagem funcionou.
  for (let q = 0; q < numero; q++) {
    for (let dy = 0; dy < 60; dy++) for (let dx = 0; dx < 60; dx++) ponto(80 + q * 100 + dx, 40 + dy, 1)
  }
  return p
}

// ─── Investigação ────────────────────────────────────────────────

const comTempo = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))])

function bytesDe(d: DataView, desde = 0): Uint8Array {
  return new Uint8Array(d.buffer, d.byteOffset + desde, d.byteLength - desde)
}
const legivel = (b: Uint8Array) =>
  Array.from(b, (x) => (x >= 32 && x < 127 ? String.fromCharCode(x) : ".")).join("")
const hexdump = (b: Uint8Array) =>
  Array.from(b, (x) => x.toString(16).padStart(2, "0")).join(" ")

/**
 * Pergunta à impressora quem ela é, e devolve um relatório em texto para
 * colar na conversa. Três fontes, da mais confiável para a menos:
 *  1. descritores USB (fabricante, IDs, portas);
 *  2. GET_DEVICE_ID da classe impressora — a string IEEE 1284 que muitas
 *     impressoras preenchem com "CMD:TSPL,..." ou "COMMAND SET:...";
 *  3. consultas de status em cada linguagem, lendo a resposta.
 */
export async function investigar(c: Conexao): Promise<string> {
  const d = c.dispositivo
  const l: string[] = []
  l.push("== IDENTIFICAÇÃO USB ==")
  l.push(`Fabricante: ${d.manufacturerName ?? "?"} | Produto: ${d.productName ?? "?"} | Serial: ${d.serialNumber ?? "?"}`)
  l.push(`Vendor ID: ${d.vendorId?.toString(16) ?? "?"} | Product ID: ${d.productId?.toString(16) ?? "?"}`)
  for (const cfg of d.configuration ? [d.configuration] : d.configurations) {
    for (const i of cfg.interfaces) for (const a of i.alternates) {
      l.push(`Interface ${i.interfaceNumber} classe ${a.interfaceClass}: ` +
        a.endpoints.map((e) => `${e.direction}#${e.endpointNumber}(${e.type})`).join(" "))
    }
  }
  l.push(`Usando: interface ${c.interfaceNumero}, saída #${c.endpoint}, entrada ${c.endpointEntrada ?? "nenhuma"}`)

  l.push("", "== GET_DEVICE_ID (IEEE 1284) ==")
  if (d.controlTransferIn) {
    try {
      const r = await comTempo(d.controlTransferIn(
        { requestType: "class", recipient: "interface", request: 0, value: 0, index: c.interfaceNumero << 8 }, 1024), 2000)
      if (r?.data && r.data.byteLength > 2) {
        const t = legivel(bytesDe(r.data, 2))
        l.push(t)
        const cmd = t.match(/(?:CMD|COMMAND SET|CMDS)\s*:\s*([^;]+)/i)
        l.push(cmd ? `>> Linguagens declaradas: ${cmd[1]}` : ">> Não declara linguagens.")
      } else l.push(`Sem resposta (${r?.status ?? "tempo esgotado"}).`)
    } catch (e) { l.push("Recusado: " + (e instanceof Error ? e.message : String(e))) }
  } else l.push("Navegador não expõe esse pedido.")

  l.push("", "== CONSULTAS DE STATUS ==")
  const sondas: Array<[string, Uint8Array]> = [
    ["TSPL ~!T (modelo)", texto("~!T\r\n")],
    ["TSPL ~!I (info)", texto("~!I\r\n")],
    ["ESC/POS DLE EOT 1", new Uint8Array([0x10, 0x04, 0x01])],
    ["ESC/POS GS I 1 (modelo)", new Uint8Array([0x1d, 0x49, 0x01])],
    ["ZPL ~HI (info)", texto("~HI")],
  ]
  if (c.endpointEntrada === undefined || !d.transferIn) {
    l.push("Impressora sem porta de leitura: não dá para ouvir respostas.")
  } else {
    for (const [nome, cmd] of sondas) {
      try {
        await enviar(c, cmd)
        const r = await comTempo(d.transferIn(c.endpointEntrada, 128), 1500)
        l.push(r?.data && r.data.byteLength > 0
          ? `${nome}: RESPONDEU "${legivel(bytesDe(r.data))}" [${hexdump(bytesDe(r.data))}]`
          : `${nome}: sem resposta`)
      } catch (e) { l.push(`${nome}: erro ${e instanceof Error ? e.message : e}`) }
    }
  }
  return l.join("\n")
}
