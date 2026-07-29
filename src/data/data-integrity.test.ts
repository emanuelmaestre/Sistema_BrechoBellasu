import { describe, expect, test } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
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
import creditReasons from "./catalog/credit-reasons.json"
import clientesUi from "./ui/clientes.json"
import emojiPicker from "./ui/emoji-picker.json"
import automations from "./ui/automations.json"
import shipping from "./ui/shipping.json"
import receiptExample from "./examples/receipt.json"

function walkFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walkFiles(path) : [path]
  })
}

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
    expect(themes.themes.map((theme) => theme.value)).toEqual(["light", "dark", "blue"])
    expect(Object.keys(calendar.holidayTypes).sort()).toEqual(["E", "M", "N"])
    expect(calendar.fixedHolidays.every((holiday) =>
      holiday.month >= 1 && holiday.month <= 12 &&
      holiday.day >= 1 && holiday.day <= 31 &&
      holiday.type in calendar.holidayTypes
    )).toBe(true)
    expect(calendar.easterRelativeHolidays.every((holiday) =>
      holiday.type in calendar.holidayTypes
    )).toBe(true)
  })

  test("navegação, live e integrações referenciam configurações completas", () => {
    expect(navigation.sidebar).toHaveLength(10)
    expect(new Set(navigation.sidebar.map((item) => item.href)).size).toBe(navigation.sidebar.length)
    const menuCards = [...navigation.menuCardsLeft, ...navigation.menuCardsRight]
    expect(new Set(menuCards.map((item) => item.href))).toEqual(
      new Set(navigation.sidebar.map((item) => item.href))
    )
    expect(menuCards.every((item) =>
      ["shoppingCart", "users", "package", "wallet", "refreshCw", "barChart2", "radio", "tag", "globe", "settings"]
        .includes(item.iconKey)
    )).toBe(true)
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
    expect(Object.keys(states.officialNameToCode)).toHaveLength(27)
    expect(new Set(Object.values(states.officialNameToCode)).size).toBe(27)
    expect(states.nameToCode["SAO PAULO"]).toBe("SP")
    expect(states.officialNameToCode["São Paulo"]).toBe("SP")
  })

  test("motivos de crédito, status de etiqueta e penalidades da live têm dados completos", () => {
    expect(creditReasons.creditReasons.every((t) => t.topico && t.emoji && t.cor && t.motivos.length)).toBe(true)
    expect(Object.values(clientesUi.etiquetaStatus).every((s) => s.label && s.cls)).toBe(true)
    expect(clientesUi.confettiColors.length).toBeGreaterThan(0)
    expect(new Set(liveUi.penaltyReasons.map((r) => r.value)).size).toBe(liveUi.penaltyReasons.length)
  })

  test("emoji picker e automações têm chaves de ícone consistentes", () => {
    expect(emojiPicker.categories.every((c) => c.icon && c.label && c.emojis.length)).toBe(true)
    expect(new Set(automations.automations.map((a) => a.id)).size).toBe(automations.automations.length)
    expect(automations.automations.every((a) => a.iconKey && a.descricao.length > 20)).toBe(true)
  })

  test("etiquetas e recibo de exemplo preservam contratos completos", () => {
    expect(Object.keys(shipping.statusMeta)).toContain("in transit")
    expect(Object.values(shipping.statusMeta).every((status) =>
      status.label && status.bg && status.text && status.dot
    )).toBe(true)
    expect(shipping.carrierGradients.default).toBeTruthy()
    expect(receiptExample.itens.length).toBeGreaterThan(0)
    expect(receiptExample.itens.reduce((total, item) => total + item.subtotal, 0)
      - receiptExample.desconto + receiptExample.frete).toBeCloseTo(receiptExample.total)
  })

  test("todo JSON de dados é válido e possui consumidor no código", () => {
    const sourceRoot = join(process.cwd(), "src")
    const dataRoot = join(sourceRoot, "data")
    const source = walkFiles(sourceRoot)
      .filter((file) => /\.(ts|tsx)$/.test(file) && !file.endsWith("data-integrity.test.ts"))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n")
    const jsonFiles = walkFiles(dataRoot).filter((file) => file.endsWith(".json"))

    expect(jsonFiles.length).toBeGreaterThanOrEqual(29)
    for (const file of jsonFiles) {
      expect(() => JSON.parse(readFileSync(file, "utf8"))).not.toThrow()
      const importPath = `@/data/${relative(dataRoot, file).replaceAll("\\", "/")}`
      expect(source, `${importPath} está órfão`).toContain(importPath)
    }
  })
})
