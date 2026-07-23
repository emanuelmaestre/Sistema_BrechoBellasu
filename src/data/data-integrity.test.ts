import { describe, expect, test } from "vitest"
import products from "./catalog/products.json"
import exchanges from "./catalog/exchanges.json"
import calendar from "./ui/calendar.json"
import themes from "./ui/themes.json"
import liveUi from "./ui/live.json"
import navigation from "./ui/navigation.json"
import integrations from "./ui/integrations.json"
import consent from "./messages/consent.json"
import liveMessages from "./messages/live.json"
import clientPhotoImport from "./ai/client-photo-import.json"
import livePhotoImport from "./ai/live-photo-import.json"
import states from "./address/states.json"

describe("dados JSON do sistema", () => {
  test("catálogo de produtos mantém tamanhos, cores e palavras-chave válidos", () => {
    expect(products.sizes.length).toBeGreaterThan(0)
    expect(new Set(products.sizes).size).toBe(products.sizes.length)
    expect(products.colors.length).toBeGreaterThan(20)
    expect(new Set(products.colors.map((color) => color.nome)).size).toBe(products.colors.length)
    expect(products.colors.every((color) => color.nome && color.hex)).toBe(true)
    expect(products.categoryKeywords.every((entry) => entry.keywords.length && entry.categories.length)).toBe(true)
  })

  test("motivos de troca e devolução têm tópicos e opções", () => {
    const groups = [...exchanges.exchangeReasons, ...exchanges.returnReasons]
    expect(groups.length).toBeGreaterThan(0)
    expect(groups.every((group) => group.topico && group.emoji && group.cor && group.motivos.length)).toBe(true)
  })

  test("calendário e temas têm conjuntos completos e únicos", () => {
    expect(calendar.weekdays).toHaveLength(7)
    expect(calendar.weekdaysShort).toHaveLength(7)
    expect(calendar.months).toHaveLength(12)
    expect(calendar.monthsShort).toHaveLength(12)
    expect(new Set(themes.themes.map((theme) => theme.value)).size).toBe(themes.themes.length)
  })

  test("navegação, live e integrações referenciam configurações completas", () => {
    expect(navigation.sidebar).toHaveLength(10)
    expect(new Set(navigation.sidebar.map((item) => item.href)).size).toBe(navigation.sidebar.length)
    expect(liveUi.stages.map((stage) => stage.id)).toEqual([1, 2, 3, 4, 5, 6])
    expect(Object.keys(liveUi.purchaseStatuses)).toHaveLength(8)
    expect(Object.keys(integrations.serviceColors)).toContain("supabase")
  })

  test("templates de mensagens preservam placeholders obrigatórios", () => {
    expect(consent.greetings.every((message) => message.includes("{nome}"))).toBe(true)
    expect(liveMessages.greetings.every((message) => message.withValue.includes("{nome}"))).toBe(true)
    expect(liveMessages.announcementOpenings.every((message) => message.withValue.includes("{nome}"))).toBe(true)
    expect(liveMessages.announcementClosings.every((message) => message.includes("{link}"))).toBe(true)
  })

  test.each([
    ["clientes", clientPhotoImport],
    ["compras da live", livePhotoImport],
  ])("contrato de IA para %s usa JSON Schema estrito", (_name, config) => {
    expect(config.prompt.length).toBeGreaterThan(100)
    expect(config.responseFormat.strict).toBe(true)
    expect(config.responseFormat.schema.type).toBe("object")
    expect(config.responseFormat.schema.additionalProperties).toBe(false)
    expect(config.responseFormat.schema.required.length).toBeGreaterThan(0)
  })

  test("mapa de estados cobre todas as unidades federativas", () => {
    expect(Object.keys(states.nameToCode)).toHaveLength(27)
    expect(new Set(Object.values(states.nameToCode)).size).toBe(27)
    expect(states.nameToCode["SAO PAULO"]).toBe("SP")
  })
})
