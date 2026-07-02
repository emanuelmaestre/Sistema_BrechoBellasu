import { describe, test, expect, beforeEach } from "vitest"
import type { CompraData } from "./live-message-builder"
import {
  buildCompleteMessage,
  buildFixedContent,
  buildSmallTalk,
  countCharacters,
  countUtf8Bytes,
  generateNotificationId,
  resetSmallTalkHistory,
  selectSmallTalkIndex,
  validateCustomerName,
  validateMessageLimit,
  CHAR_LIMIT,
} from "./live-message-builder"

// ─── Fixtures ─────────────────────────────────────────────────────

const baseCompra: CompraData = {
  data_compra:      "2026-06-10",
  data_live:        "2026-06-10",
  numero_sacola:    "1",
  cor_sacola:       "AZUL",
  quantidade_itens: 3,
  valor_total:      26.0,
  nome_cliente:     "Ana Maria Felix Bonfim Falchti",
  link_pagamento:   null,
}

// ─── countCharacters ────────────────────────────────────────────

test("countCharacters conta emojis como 1 char (code point)", () => {
  expect(countCharacters("💖")).toBe(1)
  expect(countCharacters("Olá! 💖")).toBe(6)
})

test("countCharacters conta acentos corretamente", () => {
  expect(countCharacters("ação")).toBe(4)
})

// ─── countUtf8Bytes ──────────────────────────────────────────────

test("countUtf8Bytes: emoji ocupa 4 bytes", () => {
  expect(countUtf8Bytes("💖")).toBe(4)
})

test("countUtf8Bytes: ASCII puro = 1 byte por char", () => {
  expect(countUtf8Bytes("abc")).toBe(3)
})

test("countUtf8Bytes: ç e acentos = 2 bytes cada", () => {
  expect(countUtf8Bytes("ção")).toBe(5)
})

// ─── validateCustomerName ────────────────────────────────────────

test("validateCustomerName: nome válido retorna o nome", () => {
  expect(validateCustomerName("Ana Maria")).toBe("Ana Maria")
})

test("validateCustomerName: null retorna null", () => {
  expect(validateCustomerName(null)).toBeNull()
})

test("validateCustomerName: string vazia retorna null", () => {
  expect(validateCustomerName("")).toBeNull()
})

test("validateCustomerName: apenas números retorna null", () => {
  expect(validateCustomerName("123456")).toBeNull()
})

test("validateCustomerName: palavra reservada retorna null", () => {
  expect(validateCustomerName("cliente")).toBeNull()
  expect(validateCustomerName("sem nome")).toBeNull()
  expect(validateCustomerName("não informado")).toBeNull()
})

test("validateCustomerName: username do Instagram retorna null", () => {
  expect(validateCustomerName("kamilaa_pazz")).toBeNull()
  expect(validateCustomerName("user123")).toBeNull()
})

test("validateCustomerName: nome com símbolos inválidos retorna null", () => {
  expect(validateCustomerName("Ana <script>")).toBeNull()
})

// ─── buildSmallTalk ──────────────────────────────────────────────

test("buildSmallTalk FALLBACK não usa nome", () => {
  const st = buildSmallTalk("FALLBACK", "Maria", 0)
  expect(st).toContain("Olá!")
  expect(st).toContain("live")
})

test("buildSmallTalk COMPLETO com nome usa primeiro nome", () => {
  const st = buildSmallTalk("COMPLETO", "Ana Maria Silva", 0)
  expect(st).toContain("Ana")
})

test("buildSmallTalk COMPLETO sem nome usa saudação neutra", () => {
  const st = buildSmallTalk("COMPLETO", null, 0)
  expect(st).not.toContain("null")
  expect(st.length).toBeGreaterThan(0)
})

test("buildSmallTalk CURTO é menor que COMPLETO", () => {
  const completo = buildSmallTalk("COMPLETO", null, 0)
  const curto    = buildSmallTalk("CURTO", null, 0)
  expect(countCharacters(curto)).toBeLessThan(countCharacters(completo))
})

// ─── buildFixedContent ───────────────────────────────────────────

test("buildFixedContent contém todos os campos obrigatórios", () => {
  const fixed = buildFixedContent(baseCompra, "sexta-feira")
  expect(fixed).toContain("LIVE/COMPRA:")
  expect(fixed).toContain("Sacola:")
  expect(fixed).toContain("COR:")
  expect(fixed).toContain("QT:")
  expect(fixed).toContain("Valor Total:")
  expect(fixed).toContain("sexta-feira")
  expect(fixed).toContain("PIX")
  expect(fixed).toContain("Barão do Amazonas")
  expect(fixed).toContain("promoção")
})

test("buildFixedContent formata número da sacola com zero à esquerda", () => {
  const fixed = buildFixedContent({ ...baseCompra, numero_sacola: "1" }, "sexta-feira")
  expect(fixed).toContain("01")
})

test("buildFixedContent usa ITEM no singular e ITENS no plural", () => {
  const singular = buildFixedContent({ ...baseCompra, quantidade_itens: 1 }, "segunda-feira")
  expect(singular).toContain("1 ITEM")

  const plural = buildFixedContent({ ...baseCompra, quantidade_itens: 3 }, "segunda-feira")
  expect(plural).toContain("3 ITENS")
})

test("buildFixedContent com campos nulos não quebra", () => {
  const compraVazia: CompraData = {
    data_compra: null, data_live: null, numero_sacola: null,
    cor_sacola: null, quantidade_itens: null, valor_total: null,
    nome_cliente: null,
  }
  expect(() => buildFixedContent(compraVazia, "segunda-feira")).not.toThrow()
})

// ─── buildCompleteMessage ────────────────────────────────────────

test("buildCompleteMessage: mensagem válida ≤ 990 chars", () => {
  const result = buildCompleteMessage(baseCompra)
  expect(result.chars).toBeLessThanOrEqual(CHAR_LIMIT)
  expect(result.valida).toBe(true)
})

test("buildCompleteMessage: contém todos os dados da compra", () => {
  const result = buildCompleteMessage(baseCompra)
  expect(result.mensagem).toContain("AZUL")
  expect(result.mensagem).toContain("R$ 26,00")
  expect(result.mensagem).toContain("PIX")
})

test("buildCompleteMessage: chars e bytes são calculados corretamente", () => {
  const result = buildCompleteMessage(baseCompra)
  expect(result.chars).toBe(countCharacters(result.mensagem))
  expect(result.bytes).toBe(countUtf8Bytes(result.mensagem))
  expect(result.bytes).toBeGreaterThanOrEqual(result.chars) // bytes >= chars
})

test("buildCompleteMessage: nome longo não ultrapassa limite", () => {
  const compra = { ...baseCompra, nome_cliente: "A".repeat(60) }
  const result = buildCompleteMessage(compra)
  expect(result.chars).toBeLessThanOrEqual(CHAR_LIMIT)
})

test("buildCompleteMessage: sacola com número grande não ultrapassa limite", () => {
  const compra = { ...baseCompra, numero_sacola: "999" }
  const result = buildCompleteMessage(compra)
  expect(result.chars).toBeLessThanOrEqual(CHAR_LIMIT)
})

test("buildCompleteMessage: valor alto não ultrapassa limite", () => {
  const compra = { ...baseCompra, valor_total: 99999.99 }
  const result = buildCompleteMessage(compra)
  expect(result.chars).toBeLessThanOrEqual(CHAR_LIMIT)
})

test("buildCompleteMessage: mensagem real === mensagem de preview (mesma função)", () => {
  const result1 = buildCompleteMessage(baseCompra, 0)
  const result2 = buildCompleteMessage(baseCompra, 0)
  // Mesmos dados + mesmo índice = mesma mensagem
  expect(result1.mensagem).toBe(result2.mensagem)
})

test("buildCompleteMessage: level retornado é válido", () => {
  const result = buildCompleteMessage(baseCompra)
  expect(["COMPLETO","MEDIO","CURTO","FALLBACK"]).toContain(result.level)
})

// ─── Não repetição ───────────────────────────────────────────────

test("5 mensagens consecutivas não têm small talk idêntico", () => {
  resetSmallTalkHistory()
  const idxs = Array.from({ length: 5 }, () => selectSmallTalkIndex(5))
  const unicos = new Set(idxs)
  expect(unicos.size).toBe(5)
})

test("sem repetição imediata: índice selecionado nunca igual ao anterior", () => {
  resetSmallTalkHistory()
  let prev = selectSmallTalkIndex(1)
  for (let i = 0; i < 20; i++) {
    const next = selectSmallTalkIndex(1)
    expect(next).not.toBe(prev)
    prev = next
  }
})

test("gera 125 combinações distintas antes de repetir (ciclo completo)", () => {
  resetSmallTalkHistory()
  const idxs = Array.from({ length: 125 }, () => selectSmallTalkIndex(5))
  const unicos = new Set(idxs)
  expect(unicos.size).toBe(125)
})

// ─── validateMessageLimit ────────────────────────────────────────

test("validateMessageLimit: mensagem dentro do limite é válida", () => {
  const result = validateMessageLimit("A".repeat(990))
  expect(result.valida).toBe(true)
})

test("validateMessageLimit: mensagem acima do limite é inválida", () => {
  const result = validateMessageLimit("A".repeat(991))
  expect(result.valida).toBe(false)
  expect(result.erro).toBeDefined()
})

// ─── generateNotificationId ──────────────────────────────────────

test("generateNotificationId: formato correto", () => {
  expect(generateNotificationId(42, 7)).toBe("live_42_compra_7_aviso_live")
})

test("generateNotificationId: IDs diferentes geram hashes diferentes", () => {
  expect(generateNotificationId(1, 1)).not.toBe(generateNotificationId(1, 2))
  expect(generateNotificationId(1, 1)).not.toBe(generateNotificationId(2, 1))
})

// ─── Limite de caracteres com emojis e acentos ───────────────────

test("mensagem com muitos emojis ainda respeita o limite", () => {
  const result = buildCompleteMessage(baseCompra)
  // Conta os emojis na mensagem (cada um vale 1 char)
  const emojiCount = [...result.mensagem].filter(c => c.codePointAt(0)! > 0xFFFF).length
  expect(emojiCount).toBeGreaterThan(0)
  expect(result.chars).toBeLessThanOrEqual(CHAR_LIMIT)
})

test("mensagem próxima de 990 chars: chars === countCharacters(mensagem)", () => {
  const result = buildCompleteMessage(baseCompra)
  expect(result.chars).toBe([...result.mensagem].length)
})
