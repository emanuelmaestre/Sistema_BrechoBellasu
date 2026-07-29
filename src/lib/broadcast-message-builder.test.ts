import { beforeEach, describe, expect, test } from "vitest"
import broadcastData from "@/data/messages/broadcast.json"
import {
  buildBroadcastMessage,
  buildBroadcastSmallTalk,
  resetBroadcastHistory,
} from "./broadcast-message-builder"

describe("mensagens de campanha carregadas do JSON", () => {
  beforeEach(() => resetBroadcastHistory())

  test("usa apenas o primeiro nome e remove o placeholder", () => {
    const message = buildBroadcastSmallTalk("Maria Silva")

    expect(message).toContain("Maria")
    expect(message).not.toContain("Maria Silva")
    expect(message).not.toContain("{nome}")
  })

  test.each([null, "", "A", "12345"])(
    "usa saudacao neutra para nome invalido: %s",
    (name) => {
      const message = buildBroadcastSmallTalk(name)

      expect(message).not.toContain("{nome}")
      expect(message.length).toBeGreaterThan(0)
    },
  )

  test("percorre todas as saudacoes antes de repetir", () => {
    const messages = Array.from(
      { length: broadcastData.greetings.length },
      () => buildBroadcastSmallTalk("Beatriz Souza"),
    )

    expect(new Set(messages).size).toBe(broadcastData.greetings.length)
  })

  test("mantem o texto da campanha separado da saudacao", () => {
    const campaignText = "Novidades disponiveis hoje."
    const message = buildBroadcastMessage("Joana Lima", campaignText)

    expect(message.endsWith(`\n\n${campaignText}`)).toBe(true)
    expect(message).not.toContain("{nome}")
  })
})
