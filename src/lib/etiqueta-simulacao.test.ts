import { describe, expect, it, vi, afterEach } from "vitest"
import {
  ALTURA_MAX_BLOCO_MM, ALTURA_UTIL_MM, alturaBlocoMm, dividirSacolaExcedente,
  montarEtiquetas, type SacolaEtiqueta,
} from "./etiqueta-sacola"
import {
  comandoEscPos, comandoTspl, conectar, enviar, reconectar, usbDisponivel,
  type UsbDevice,
} from "./impressora-usb"

function sacola(numero: number, itens: number, extra: Partial<SacolaEtiqueta> = {}): SacolaEtiqueta {
  return {
    compraId: numero,
    numeroSacola: String(numero),
    nomeCliente: "Cliente " + numero,
    produtos: Array.from({ length: itens }, (_, i) => ({
      nome: "Vestido", cor: "Rosa", quantidade: 1, preco: 50 + i,
    })),
    total: 100,
    endereco: { logradouro: "Rua Teste", numero: "10", bairro: "Centro" },
    ...extra,
  }
}

describe("simulação: lote parecido com o da imagem", () => {
  it("pares só quando AMBAS cabem na metade; senão cada uma inteira", () => {
    const lote = [sacola(1, 2), sacola(2, 1), sacola(3, 1), sacola(4, 2), sacola(5, 9), sacola(6, 1)]
    const et = montarEtiquetas(lote)
    for (const e of et) {
      if (e.modo === "duplo") {
        expect(e.blocos).toHaveLength(2)
        for (const h of e.alturasMm) expect(h).toBeLessThanOrEqual(ALTURA_MAX_BLOCO_MM)
      } else {
        expect(e.blocos).toHaveLength(1)
      }
    }
    // 1+2 e 3+4 dividem; a 5 (9 itens) vai inteira e a 6 sobra sozinha.
    expect(et.map((e) => e.blocos.map((b) => b.numeroSacola))).toEqual([["1", "2"], ["3", "4"], ["5"], ["6"]])
  })

  it("nenhuma sacola some ou duplica sem ser parte dividida", () => {
    const lote = Array.from({ length: 40 }, (_, i) => sacola(i + 1, (i * 7) % 13 + 1))
    const ids = montarEtiquetas(lote).flatMap((e) => e.blocos.map((b) => b.compraId))
    expect(new Set(ids)).toEqual(new Set(lote.map((s) => s.compraId)))
  })
})

describe("simulação: cliente que enche a etiqueta inteira", () => {
  it("divide em 1/2, 2/2 sem perder nem repetir produto, e cada parte cabe", () => {
    const gorda = sacola(7, 40)
    const partes = dividirSacolaExcedente(gorda)
    expect(partes.length).toBeGreaterThan(1)
    expect(partes.flatMap((p) => p.produtos)).toEqual(gorda.produtos)
    partes.forEach((p, i) => {
      expect(p.parte).toEqual({ atual: i + 1, total: partes.length })
      expect(alturaBlocoMm(p, "solo")).toBeLessThanOrEqual(ALTURA_UTIL_MM)
    })
  })

  it("partes ficam em etiquetas próprias e não dividem com a vizinha", () => {
    const et = montarEtiquetas([sacola(1, 40), sacola(2, 1)])
    expect(et.every((e) => e.modo === "solo")).toBe(true)
    expect(et.map((e) => e.blocos[0].parte?.atual ?? 0)).toEqual([1, 2, 3, 0])
  })

  it("sacola normal não ganha marca de parte", () => {
    expect(dividirSacolaExcedente(sacola(3, 5))).toHaveLength(1)
    expect(dividirSacolaExcedente(sacola(3, 5))[0].parte).toBeUndefined()
  })
})

// ─── Impressora USB falsa ────────────────────────────────────────

function impressoraFalsa(opcoes: { classe?: number; claimFalha?: boolean; semSaida?: boolean } = {}) {
  const recebido: Uint8Array[] = []
  const dev: UsbDevice = {
    productName: "BY-480BT", manufacturerName: "Beeprt", opened: false,
    configuration: null,
    configurations: [{
      configurationValue: 1,
      interfaces: [
        { interfaceNumber: 0, alternates: [{ interfaceClass: 255, endpoints: [{ endpointNumber: 5, direction: "out", type: "bulk" }] }] },
        {
          interfaceNumber: 1,
          alternates: [{
            interfaceClass: opcoes.classe ?? 7,
            endpoints: opcoes.semSaida ? [{ endpointNumber: 1, direction: "in", type: "bulk" }]
              : [{ endpointNumber: 2, direction: "out", type: "bulk" }],
          }],
        },
      ],
    }],
    async open() { this.opened = true },
    async close() { this.opened = false },
    async selectConfiguration() { this.configuration = this.configurations[0] },
    async claimInterface() { if (opcoes.claimFalha) throw new Error("busy") },
    async releaseInterface() {},
    async transferOut(ep, data) {
      recebido.push(new Uint8Array(data as ArrayBuffer).slice())
      ;(dev as unknown as { ultimoEp: number }).ultimoEp = ep
      return { status: "ok" }
    },
  }
  return { dev, recebido }
}

afterEach(() => vi.unstubAllGlobals())

describe("simulação: caminho USB", () => {
  it("conecta, prefere a interface classe 7, envia em blocos e o total bate", async () => {
    const { dev, recebido } = impressoraFalsa()
    vi.stubGlobal("navigator", { usb: { requestDevice: async () => dev, getDevices: async () => [] } })
    expect(usbDisponivel()).toBe(true)

    const c = await conectar()
    expect(c.interfaceNumero).toBe(1)
    expect(c.endpoint).toBe(2)

    const preto = new Uint8Array(800 * 1176)
    const cmd = comandoTspl(preto, 800, 1176)
    await enviar(c, cmd)
    expect(recebido.length).toBe(Math.ceil(cmd.length / (16 * 1024)))
    expect(recebido.reduce((s, r) => s + r.length, 0)).toBe(cmd.length)
    expect(cmd.length).toBeGreaterThan(100 * 1176) // 117.600 bytes de bitmap
  })

  it("mensagem clara quando o SO já ocupa a impressora", async () => {
    const { dev } = impressoraFalsa({ claimFalha: true })
    vi.stubGlobal("navigator", { usb: { requestDevice: async () => dev, getDevices: async () => [] } })
    await expect(conectar()).rejects.toThrow(/sistema operacional/)
  })

  it("dispositivo sem porta de saída é recusado", async () => {
    const dev = impressoraFalsa({ semSaida: true }).dev
    dev.configurations[0].interfaces.shift() // some a interface 0 com saída
    vi.stubGlobal("navigator", { usb: { requestDevice: async () => dev, getDevices: async () => [] } })
    await expect(conectar()).rejects.toThrow(/porta de saída/)
  })

  it("reconecta sozinho quando já autorizada", async () => {
    const { dev } = impressoraFalsa()
    vi.stubGlobal("navigator", { usb: { requestDevice: async () => dev, getDevices: async () => [dev] } })
    expect((await reconectar())?.endpoint).toBe(2)
  })

  it("navegador sem WebUSB não quebra", async () => {
    vi.stubGlobal("navigator", {})
    expect(usbDisponivel()).toBe(false)
    expect(await reconectar()).toBeNull()
  })

  it("comandos: o mesmo pixel gera bits opostos em TSPL e ESC/POS", () => {
    const p = new Uint8Array(8 * 1); p[0] = 1
    const tspl = comandoTspl(p, 8, 1)
    const esc = comandoEscPos(p, 8, 1)
    const tag = "BITMAP 0,0,1,1,0,"
    const ini = new TextDecoder("latin1").decode(tspl).indexOf(tag) + tag.length
    expect(tspl[ini]).toBe(0b01111111)
    expect(esc[10]).toBe(0b10000000)
  })
})
