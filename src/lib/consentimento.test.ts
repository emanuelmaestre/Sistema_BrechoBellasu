import { beforeEach, describe, expect, test } from "vitest"
import consentData from "@/data/messages/consent.json"
import {
  buildConsentFollowUpMessage,
  buildConsentMessage,
  resetConsentHistory,
  selectConsentIndex,
} from "./consentimento"

describe("mensagens de consentimento carregadas do JSON", () => {
  beforeEach(() => resetConsentHistory())

  test("substitui o nome e preserva o bloco de autorizacao", () => {
    const message = buildConsentMessage("Maria Silva", 0)

    expect(message).toContain("Maria")
    expect(message).not.toContain("Maria Silva")
    expect(message).not.toContain("{nome}")
    expect(message).toContain("*SIM*")
    expect(message).toContain("*NÃO*")
  })

  test("gera todas as combinacoes JSON sem repeticao nem placeholder", () => {
    const total =
      consentData.greetings.length *
      consentData.introductions.length *
      consentData.closings.length
    const messages = Array.from(
      { length: total },
      (_, index) => buildConsentMessage("Ana Souza", index),
    )

    expect(total).toBe(250)
    expect(new Set(messages).size).toBe(total)
    expect(messages.every((message) => !message.includes("{nome}"))).toBe(true)
  })

  test("follow-up usa o bloco configurado no JSON", () => {
    const message = buildConsentFollowUpMessage("Carla Mendes", 249)

    expect(message).toContain("Carla")
    expect(message).toContain(consentData.followupBlock)
    expect(message).not.toContain("{nome}")
  })

  test("rotacao nao repete os indices recentes", () => {
    const indexes = Array.from({ length: 6 }, () => selectConsentIndex(5))

    expect(new Set(indexes).size).toBe(indexes.length)
  })
})
