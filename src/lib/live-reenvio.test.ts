import { describe, it, expect } from "vitest"
import { podeReenviar, elegivelReenvio, valorAPagar, INTERVALO_MIN_REENVIO_MS } from "./live-reenvio"

const agora = Date.parse("2026-09-15T12:00:00Z")
const base = { msg_status: "enviada", pagamento_status: "EM_ABERTO", valor_total: 150, msg_enviada_em: "2026-09-14T12:00:00Z" }

describe("podeReenviar", () => {
  it("libera compra enviada, em aberto e com valor", () => {
    expect(podeReenviar(base, agora)).toEqual({ ok: true })
  })
  it("bloqueia compra paga", () => {
    expect(podeReenviar({ ...base, pagamento_status: "PAGO" }, agora).ok).toBe(false)
  })
  it("bloqueia compra ainda pendente (vai pelo disparo normal)", () => {
    expect(podeReenviar({ ...base, msg_status: "pendente" }, agora).ok).toBe(false)
  })
  it("bloqueia quando o crédito quitou tudo", () => {
    expect(podeReenviar({ ...base, credito_aplicado: 150 }, agora).ok).toBe(false)
  })
  it("bloqueia reenvio logo depois do último envio e libera após o intervalo", () => {
    const recente = new Date(agora - 60_000).toISOString()
    const r = podeReenviar({ ...base, msg_enviada_em: recente }, agora)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain("9 min")
    const antigo = new Date(agora - INTERVALO_MIN_REENVIO_MS - 1).toISOString()
    expect(podeReenviar({ ...base, msg_enviada_em: antigo }, agora).ok).toBe(true)
  })
  it("envios antigos sem data registrada podem ser reenviados", () => {
    expect(podeReenviar({ ...base, msg_enviada_em: null }, agora).ok).toBe(true)
  })
})

describe("elegivelReenvio / valorAPagar", () => {
  it("desconta desconto e crédito", () => {
    expect(valorAPagar({ valor_total: "200", desconto: "20", credito_aplicado: 30 })).toBe(150)
  })
  it("lista só enviadas não pagas com valor", () => {
    expect(elegivelReenvio(base)).toBe(true)
    expect(elegivelReenvio({ ...base, pagamento_status: "PAGO" })).toBe(false)
  })
})

describe("trava de intervalo quando o envio não registrou a data", () => {
  // 140 compras em produção estão com msg_status='enviada' e
  // msg_enviada_em nulo — herança de quando a coluna de rastreio ainda
  // não existia. Sem data não dá para medir o intervalo, então o reenvio
  // é liberado. É aceitável (o primeiro reenvio grava a data e a trava
  // passa a valer), mas precisa estar registrado como decisão.
  it("libera o reenvio quando não há data de envio", () => {
    const semData = { ...base, msg_enviada_em: null }
    expect(podeReenviar(semData, agora).ok).toBe(true)
  })
  it("uma vez gravada a data, a trava volta a valer", () => {
    const recem = { ...base, msg_enviada_em: new Date(agora - 60_000).toISOString() }
    expect(podeReenviar(recem, agora).ok).toBe(false)
  })
})
