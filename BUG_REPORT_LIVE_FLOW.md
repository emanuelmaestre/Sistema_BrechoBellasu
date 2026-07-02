# 🐛 REVISÃO DE BUGS — FLUXO DA LIVE

## RESUMO EXECUTIVO
Encontrados **3 bugs críticos** no fluxo de disparo de mensagens da live que podem:
1. Fazer mensagens sumirem (preview sem produtos)
2. Exceder limite de caracteres (990) com 5+ produtos
3. Cortar mensagens no WhatsApp

---

## BUG #1: MODAL DE DISPARO NÃO CARREGA PRODUTOS PARA PREVIEW ❌ CRÍTICO

**Arquivo:** `src/app/(dashboard)/live/page.tsx`  
**Linha:** 1762-1776 (função `ModalDisparar`)

### O Problema
O modal de disparo monta o `CompraData` para o preview da mensagem SEM os produtos vinculados:

```typescript
// LINHAS 1762-1775
const compraData: CompraData = {
  data_compra:      liveData,
  data_live:        liveData,
  numero_sacola:    ex.numero_sacola,
  cor_sacola:       ex.cor_sacola,
  quantidade_itens: ex.quantidade_itens,
  valor_total:      ex.valor_total,
  nome_cliente:     ex.nome_cliente,
  credito_aplicado: ex.credito_aplicado,
  pago_com_credito: pagoCreditoEx,
  link_pagamento: pagoCreditoEx ? null : exLink ?? ex.link_pagamento ?? (gerandoLink ? undefined : null),
  // ❌ FALTA AQUI: produtos: [...]
}
setMsgResult(buildCompleteMessage(compraData, stIdx))
```

### Impacto
- A função `buildFixedContent()` no builder verifica:
  ```typescript
  // LINHA 316
  const blocoProdutos = compra.produtos && compra.produtos.length > 0 ? ... : ""
  ```
- Como `compra.produtos` é `undefined`, o bloco inteiro é ignorado
- **O cliente vê um preview SEM o bloco "🧾 SUAS PEÇAS"**
- Mas quando a mensagem é enviada via `/disparar/route.ts`, os produtos são lidos do DB e APARECEM na mensagem
- **Inconsistência crítica:** preview vs. mensagem real

### Como Corrigir
1. Criar um `useQuery` no `ModalDisparar` para buscar produtos da primeira compra pendente
2. Passar os produtos no `CompraData`:

```typescript
const { data: produtosEx } = useQuery({
  queryKey: ["disparo-preview-produtos", ex?.id],
  queryFn: () => ex ? apiGet<ProdutoMensagem[]>(`/live/${liveId}/compras/${ex.id}/produtos`) : Promise.resolve([]),
  enabled: !!ex,
})

const compraData: CompraData = {
  // ... resto dos campos
  produtos: produtosEx ?? [],
}
```

---

## BUG #2: BLOCO DE PRODUTOS EXCEDE CHAR_LIMIT ⚠️ CRÍTICO

**Arquivo:** `src/lib/live-message-builder.ts`  
**Linha:** 315-328 (função `buildFixedContent`)  
**Constante:** `CHAR_LIMIT = 990`

### O Problema
Com 5 produtos listados, a mensagem ultrapassa **990 caracteres**:

**Cálculo:**
- Bloco fixo (datas, dados, endereço, avisos): ~1.200 chars
- Bloco de produtos com 5 itens: ~260 chars
  ```
  🧾 SUAS PEÇAS (com separadores) ≈ 48 chars
  
  1️⃣ Camiseta Vermelha Premium
  👗 Marca: Calvin Klein
  🎨 Cor: Vermelho
  📐 Tamanho: M
  💵 Valor: R$ 89,90
  = ~100 chars × 5 = 500 chars
  
  Separações \n\n: ~60 chars
  ```

**Total: ~1.460 caracteres**  
**Limite: 990 caracteres**  
**Excesso: +470 chars ❌**

### Impacto
- A função `validateMessageLimit()` (linha 362) retorna erro se > 990
- Mas `buildCompleteMessage()` (linha 372) tenta todos os níveis: COMPLETO → MEDIO → CURTO → FALLBACK
- Se mesmo FALLBACK ultrapassa, `msgResult.valida = false` e **o disparo é bloqueado com erro**
- Cliente vê "A mensagem ultrapassou o limite de 990 caracteres (atual: 1.460)"

### Dados do Banco
**Migration `018_produtos_cor.sql`:**
```sql
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS cor TEXT;
```
✓ Campo `cor` EXISTE na tabela `produtos`

**Tabela `live_compra_produtos` (migration 012/007):**
```
id (PK)
compra_id (FK)
produto_id (FK, nullable)
nome_produto
quantidade
preco_original
preco_live
estoque_baixado
```
✗ **NÃO TEM** colunas: `marca`, `cor`, `tamanho`  
→ Vêm do JOIN com `produtos` (linha 103 do disparar/route.ts)

### Como Corrigir
**Opção A (Recomendada):** Reduzir seção de produtos
- Mostrar só nome + preço
- Remover marca, cor, tamanho do preview
- Ou limitar a 3 produtos em vez de 5

```typescript
// LINHA 316-328
const blocoProdutos = compra.produtos && compra.produtos.length > 0
  ? `\n——————————————\n🧾 PEÇAS (${compra.produtos.length})\n——————————————\n\n` +
    compra.produtos.slice(0, 3).map((p, i) => {
      const num = numerais[i] ?? `${i + 1}.`
      return `${num} ${p.nome}\n💵 ${fmtVal(p.preco)}`
    }).join("\n\n") +
    `\n\n——————————————`
  : ""
```

**Opção B:** Replicar a lógica de `selectSmallTalkByAvailableLength()`
- Medir espaço disponível
- Ajustar dinamicamente quantidade de campos por produto
- Se falta espaço: remover cor/tamanho, depois marca

---

## BUG #3: CAMPO `COR` NA QUERY TEM COMPORTAMENTO INDEFINIDO ⚠️ MÉDIO

**Arquivo:** `src/app/api/live/[id]/disparar/route.ts`  
**Linha:** 101-116 (seleção de produtos)

### O Problema
```typescript
// LINHA 101-105
const { data: produtosRaw } = await sb
  .from("live_compra_produtos")
  .select("nome_produto, preco_live, preco_original, produtos(marca, cor, tamanho)")
  .eq("compra_id", compraId)
  .order("id")

// LINHA 107-116
const produtos: ProdutoMensagem[] = (produtosRaw ?? []).map((p: Record<string, unknown>) => {
  const prod = p.produtos as { marca?: string | null; cor?: string | null; tamanho?: string | null } | null
  return {
    nome:    String(p.nome_produto ?? ""),
    marca:   prod?.marca ?? null,
    cor:     prod?.cor ?? null,
    tamanho: prod?.tamanho ?? null,
    preco:   parseFloat(String(p.preco_live ?? p.preco_original ?? 0)),
  }
})
```

**Cenário 1: `produto_id` é NULL** (produto manual, sem vínculo)
- O LEFT JOIN retorna `p.produtos = null`
- A linha `prod?.marca` funciona (operador opcional seguro)
- ✓ Sem erro, mas marca/cor/tamanho = null

**Cenário 2: `produto_id` EXISTS mas `produtos.cor` é NULL**
- O join retorna `p.produtos = { marca: "...", cor: null, tamanho: "..." }`
- `prod?.cor` = null
- ✓ Sem erro, mas a linha `if (p.cor)` no builder (linha 322) evita renderizar

✓ **Este caso é tratado corretamente** (sem quebra)

### Impacto
Mínimo, pois o código é defensivo. Mas deixa confusão sobre qual campo virá nulo.

---

## RESUMO DE AÇÕES NECESSÁRIAS

| Bug | Severidade | Arquivo | Linha | Fix | Tempo |
|-----|-----------|---------|-------|-----|-------|
| Produtos não no preview | 🔴 CRÍTICO | `page.tsx` | 1762 | Adicionar `useQuery` | 30min |
| Char limit excedido | 🔴 CRÍTICO | `live-message-builder.ts` | 316 | Limitar produtos ou reduzir campos | 1h |
| Campo cor ambíguo | 🟡 MÉDIO | `route.ts` | 101 | Clarificar comentário | 5min |

---

## TESTES RECOMENDADOS

1. **Modal preview vs. mensagem enviada:**
   - Abrir modal de disparo
   - Verificar se bloco "🧾 SUAS PEÇAS" aparece no preview
   - Disparar e verificar se WhatsApp recebe produtos

2. **Limite de caracteres:**
   - Compra com 5 produtos, todos com marca/cor/tamanho preenchido
   - Tentar disparar — deve falhar ou mostrar aviso

3. **Produto sem vínculo:**
   - Vincular um produto manual (sem selecionar da lista)
   - Enviado valor manual para marca/cor/tamanho
   - Disparar — deve aparecer apenas nome + preço

---

## BRANCHES/PRS AFETADAS
- Fluxo live (wizard, compras, vinculação de produtos, disparo)
- Message builder (seção de produtos)
