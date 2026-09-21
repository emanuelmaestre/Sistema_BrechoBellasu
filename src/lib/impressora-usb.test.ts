import { describe, expect, it } from "vitest"
import { comandoEscPos, comandoTspl } from "./impressora-usb"

// 16 × 2 pontos: primeiro ponto preto, resto branco.
const pontos = () => {
  const p = new Uint8Array(16 * 2)
  p[0] = 1
  return p
}

describe("comandoTspl", () => {
  it("declara o tamanho e o bitmap com largura em bytes", () => {
    const txt = new TextDecoder("latin1").decode(comandoTspl(pontos(), 16, 2))
    expect(txt).toContain("SIZE 100 mm,147 mm")
    expect(txt).toContain("BITMAP 0,0,2,2,0,")
    expect(txt.trimEnd().endsWith("PRINT 1,1")).toBe(true)
  })
  it("usa bit 0 para preto e 1 para branco", () => {
    const c = comandoTspl(pontos(), 16, 2)
    const ini = new TextDecoder("latin1").decode(c).indexOf("BITMAP 0,0,2,2,0,") + "BITMAP 0,0,2,2,0,".length
    expect(c[ini]).toBe(0x7f) // 0111 1111: 1º ponto queima
    expect(c[ini + 1]).toBe(0xff)
  })
})

describe("comandoEscPos", () => {
  it("usa GS v 0 com bit 1 para preto", () => {
    const c = comandoEscPos(pontos(), 16, 2)
    expect(Array.from(c.slice(2, 10))).toEqual([0x1d, 0x76, 0x30, 0, 2, 0, 2, 0])
    expect(c[10]).toBe(0x80)
    expect(c[11]).toBe(0x00)
  })
})

import { comandoCpcl, comandoZpl, investigar, montarComando, MODOS, type Conexao, type UsbDevice } from "./impressora-usb"

describe("linguagens extras", () => {
  it("todas as linguagens geram comando não vazio para a mesma etiqueta", () => {
    const p = new Uint8Array(16 * 2); p[0] = 1
    for (const m of MODOS) expect(montarComando(m.id, p, 16, 2).length).toBeGreaterThan(10)
  })
  it("ZPL leva o bitmap em hexadecimal e CPCL em EG", () => {
    const p = new Uint8Array(8); p[0] = 1
    expect(new TextDecoder().decode(comandoZpl(p, 8, 1))).toBe("^XA^PW8^LL1^FO0,0^GFA,1,1,1,80^FS^XZ")
    expect(new TextDecoder("latin1").decode(comandoCpcl(p, 8, 1))).toContain("EG 1 1 0 0 ")
  })
  it("TSPL sem vão troca só o GAP", () => {
    const p = new Uint8Array(8)
    expect(new TextDecoder("latin1").decode(montarComando("tspl-continuo", p, 8, 1))).toContain("GAP 0 mm,0 mm")
  })
})

describe("investigar", () => {
  const dados = (s: string) => new DataView(new TextEncoder().encode(s).buffer)
  function conexao(respondeId: boolean): Conexao {
    const enviados: string[] = []
    const dev = {
      vendorId: 0x0483, productId: 0x5740, manufacturerName: "Beeprt", productName: "BY-480BT",
      opened: true, configuration: null, configurations: [],
      async transferOut(_e: number, d: BufferSource) { enviados.push(new TextDecoder("latin1").decode(d as ArrayBuffer)); return { status: "ok" } },
      async transferIn() {
        const ultimo = enviados[enviados.length - 1]
        return ultimo.startsWith("~!T") ? { status: "ok", data: dados("BY-480BT") } : { status: "ok", data: undefined }
      },
      async controlTransferIn() {
        if (!respondeId) return { status: "stall" }
        const t = "MFG:Beeprt;CMD:TSPL,ESCPOS;MDL:BY-480BT;"
        const b = new Uint8Array(t.length + 2); b[1] = b.length; b.set(new TextEncoder().encode(t), 2)
        return { status: "ok", data: new DataView(b.buffer) }
      },
    } as unknown as UsbDevice
    return { dispositivo: dev, interfaceNumero: 0, endpoint: 2, endpointEntrada: 1 }
  }

  it("relata linguagens declaradas e qual consulta foi respondida", async () => {
    const r = await investigar(conexao(true))
    expect(r).toContain("Vendor ID: 483")
    expect(r).toContain("Linguagens declaradas: TSPL,ESCPOS")
    expect(r).toContain('TSPL ~!T (modelo): RESPONDEU "BY-480BT"')
    expect(r).toContain("ZPL ~HI (info): sem resposta")
  })
  it("sem GET_DEVICE_ID, avisa e segue com as consultas", async () => {
    const r = await investigar(conexao(false))
    expect(r).toContain("Sem resposta (stall)")
    expect(r).toContain("CONSULTAS DE STATUS")
  })
  it("sem porta de leitura, explica que não dá para ouvir", async () => {
    const c = conexao(true); c.endpointEntrada = undefined
    expect(await investigar(c)).toContain("sem porta de leitura")
  })
})
