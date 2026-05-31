# Roteiro de Verificação Pós-Deploy

Checklist prático para confirmar, em produção, que a refatoração Clean Architecture
e os reparos de bugs funcionam. Faça na ordem.

---

## 0. Pré-deploy (obrigatório, nesta ordem)

1. **Aplicar as migrations** no Supabase → SQL Editor (cada arquivo é idempotente):
   - `supabase/008_vendas_atomica.sql`
   - `supabase/009_clientes_apelido_instagram.sql`
   - `supabase/010_live_pagamento.sql`
   - `supabase/011_trocas_reconciliacao.sql`
   - `supabase/012_live_compra_produtos.sql`
2. **Rotacionar `JWT_SECRET`** na Vercel (Environment Variables) para um valor forte
   e aleatório. ⚠️ Isso invalida as sessões atuais — todos vão re-logar uma vez.
3. **Deploy** do branch.

> Se fizer deploy ANTES das migrations, Vendas/Live/Clientes/Trocas vão falhar —
> o código novo usa colunas/funções que as migrations criam/corrigem.

---

## 1. Login & sessão (segurança)

- [ ] Login com e-mail/senha corretos → entra no /menu
- [ ] Login com senha errada → mensagem "E-mail ou senha incorretos." (sem dizer se o e-mail existe)
- [ ] No DevTools → Application → Cookies: o cookie **`brecho-token`** está com **HttpOnly ✓** e **Secure ✓**
- [ ] DevTools → Console: `document.cookie` **não** mostra o `brecho-token` (prova do HttpOnly)
- [ ] Logout → volta para /login; ao tentar abrir /menu, redireciona para /login
- [ ] (Opcional) `curl -I https://SEU_DOMINIO/` mostra `x-content-type-options: nosniff`,
      `x-frame-options: SAMEORIGIN`, `strict-transport-security`

## 2. Vendas (atomicidade + estoque)

- [ ] Anote o estoque de um produto **com controle de estoque** (ex.: 10)
- [ ] Criar venda com 3 unidades desse produto → total confere; estoque vira **7**
- [ ] Tentar vender **mais que o estoque** (ex.: 999) → bloqueado com mensagem de
      "Estoque insuficiente" (não cria a venda)
- [ ] Cancelar/excluir uma venda → o estoque dos itens **volta** ao valor anterior
- [ ] Conferir que o total da venda está correto (sem centavo errado) mesmo com preços quebrados (ex.: 19,90 × 3)

## 3. Produtos (estoque não-negativo)

- [ ] Ajuste de estoque "−" maior que o disponível → bloqueado (não fica negativo)
- [ ] Criar produto novo → aparece na lista; estoque inicial correto

## 4. Clientes (CPF + apelido/instagram)

- [ ] Cadastrar cliente com **CPF válido** → salva
- [ ] Cadastrar com **CPF inválido** → no passo do CPF aparece "CPF inválido" (não avança)
- [ ] Preencher **apelido** e **instagram**, salvar, reabrir o cliente → os dois campos
      **persistiram** (antes eram descartados)
- [ ] Editar um cliente existente → alterações salvam

## 5. Live (pagamento + vínculo + finalização)

- [ ] Criar uma live
- [ ] Adicionar uma **compra** com valor > 0 → é gerado um **link de pagamento**
- [ ] **Recarregar a página** → o link de pagamento **continua salvo** na compra
      (antes se perdia)
- [ ] Rodar a sincronização de pagamentos (ou abrir a live, que dispara o sync) →
      **não dá erro**; compras pagas no Asaas viram "PAGO"
- [ ] **Vincular um produto** à compra → estoque do produto baixa; status da compra
      muda (aguardando_vinculo → vinculo_parcial/vinculada)
- [ ] Remover o produto vinculado → estoque **volta**
- [ ] **Finalizar** a compra com tudo vinculado e baixado → sucesso
- [ ] Tentar finalizar com quantidade divergente → erro claro (não finaliza)

## 6. Financeiro (datas + resumo)

- [ ] Criar conta **a pagar** e marcar como **paga** → no banco/listagem, `pago_em` = hoje
- [ ] Criar conta **a receber** e marcar como **recebida** → `recebido_em` = hoje
- [ ] Conferir o **resumo financeiro**: "recebido no mês" e "pago no mês"
      **não estão mais zerados** quando há contas quitadas no mês

## 7. Trocas

- [ ] Criar uma troca (tipo + motivo) → salva (antes falhava)
- [ ] Mudar status (solicitado → aprovado / recusado) → atualiza (antes falhava)

---

## Rollback (se algo der errado)

- O código está no branch `refactor/clean-architecture`; reverter o deploy para o
  commit anterior na Vercel volta o app ao estado antigo.
- As migrations são **aditivas** (ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT
  EXISTS / CREATE OR REPLACE FUNCTION) — não removem dados. Reverter o código não
  exige reverter as migrations.
- Exceção: `011` faz `DROP CONSTRAINT trocas_status_check` e ajusta o DEFAULT de
  status — não destrói dados, apenas relaxa a validação.
