import { describe, expect, it } from "vitest"
import {
  detectAllowedMedia,
  normalizeCampaignMedia,
  normalizeCampaignText,
  parsePositiveInteger,
} from "./campanha-seguranca"

describe("parsePositiveInteger", () => {
  it("aceita inteiros positivos em numero ou texto", () => {
    expect(parsePositiveInteger(12)).toBe(12)
    expect(parsePositiveInteger("12")).toBe(12)
  })

  it("rejeita zero, decimais e valores nao numericos", () => {
    expect(parsePositiveInteger(0)).toBeNull()
    expect(parsePositiveInteger(1.5)).toBeNull()
    expect(parsePositiveInteger("abc")).toBeNull()
  })
})

describe("normalizeCampaignText", () => {
  it("remove espacos externos e preserva o conteudo", () => {
    expect(normalizeCampaignText("  Oferta hoje  ")).toBe("Oferta hoje")
  })

  it("rejeita texto vazio ou acima de 800 caracteres", () => {
    expect(normalizeCampaignText("   ")).toBeNull()
    expect(normalizeCampaignText("a".repeat(801))).toBeNull()
  })
})

describe("normalizeCampaignMedia", () => {
  const projectUrl = "https://projeto.supabase.co"

  it("aceita uma campanha sem midia", () => {
    expect(normalizeCampaignMedia({}, projectUrl)).toEqual({
      midia_tipo: null,
      midia_url: null,
      midia_nome: null,
    })
  })

  it("aceita somente URL do bucket e nome correspondente", () => {
    const nome = "campanha_abc-123.jpg"
    expect(normalizeCampaignMedia({
      midia_tipo: "imagem",
      midia_nome: nome,
      midia_url: `${projectUrl}/storage/v1/object/public/campanhas/${nome}`,
    }, projectUrl)).toEqual({
      midia_tipo: "imagem",
      midia_nome: nome,
      midia_url: `${projectUrl}/storage/v1/object/public/campanhas/${nome}`,
    })
  })

  it("rejeita URL externa ou nome divergente", () => {
    expect(normalizeCampaignMedia({
      midia_tipo: "imagem",
      midia_nome: "campanha_abc.jpg",
      midia_url: "https://example.com/arquivo.jpg",
    }, projectUrl)).toBeNull()

    expect(normalizeCampaignMedia({
      midia_tipo: "imagem",
      midia_nome: "campanha_abc.jpg",
      midia_url: `${projectUrl}/storage/v1/object/public/campanhas/outro.jpg`,
    }, projectUrl)).toBeNull()
  })
})

describe("detectAllowedMedia", () => {
  it("detecta a assinatura real de PNG", () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x00,
    ])
    expect(detectAllowedMedia(png)).toEqual({
      mime: "image/png",
      extension: "png",
      type: "imagem",
    })
  })

  it("rejeita texto renomeado como imagem", () => {
    expect(detectAllowedMedia(Buffer.from("arquivo falso.jpg"))).toBeNull()
  })
})
