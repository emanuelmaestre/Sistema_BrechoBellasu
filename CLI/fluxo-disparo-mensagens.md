# Disparo de Mensagens — Fluxo Operacional

## Regras gerais

O prazo total é o mesmo para todas as clientes, variando apenas por localidade:

- **Ribeirão Preto:** até 7 dias para concluir pagamento e retirada
- **Fora de Ribeirão Preto:** até 15 dias

---

## 1. Pagamento (após o disparo)

A cliente tem **até 2 dias** para efetuar o pagamento. Atualmente via **Pix manual** (integrações previstas para breve).

### Dia 1 — 24h após o disparo

Se a cliente não enviar o comprovante, enviar **mensagem de atenção** informando o prazo final para pagamento.

> A I.A. define o formato e o tom da mensagem conforme os parâmetros do perfil do agente.

### Dia 2 — prazo final

Enviar **lembrete** informando que é o último dia de pagamento e que, em caso de não pagamento:

- a sacola será desfeita e os itens retornarão para venda;
- a cliente ficará sujeita a penalidades.

---

## 2. Retirada (após pagamento confirmado)

Prazo de **7 dias para retirada**, contados a partir da data da live.

- Passando de 7 dias, a sacola é desfeita e o valor pago vira **crédito no cadastro** da cliente, utilizável em compras futuras.

### Exceção — pedido de prorrogação

Se a cliente informar que retirará em data posterior:

- aceitar a justificativa **apenas 1 vez**, respeitando a data que ela indicar;
- se ela não informar uma data, perguntar diretamente qual será;
- não havendo resposta, o prazo permanece em 7 dias e a sacola é desfeita.

---

## 3. Fluxograma

```
                    ┌────────────────────────────┐
                    │    Disparo da mensagem     │
                    └─────────────┬──────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │  Pagamento em até 2 dias   │
                    │         pix manual         │
                    └─────────────┬──────────────┘
                ┌─────────────────┴─────────────────┐
                │                                   │
   ┌────────────▼─────────────┐      ┌──────────────▼───────────┐
   │ Dia 1 — sem comprovante  │      │   Comprovante recebido   │
   │   mensagem de atenção    │      │  pagamento confirmado    │
   └────────────┬─────────────┘      └──────────────┬───────────┘
                │                                   │
   ┌────────────▼─────────────┐      ┌──────────────▼───────────┐
   │    Dia 2 — prazo final   │─────▶│  Retirada em até 7 dias  │──┐
   │  lembrete de último dia  │pagou │ contados da data da live │  │
   └────────────┬─────────────┘      └──────────────┬───────────┘  │
                │                                   │              │
   ┌────────────▼─────────────┐      ┌──────────────▼───────────┐  │
   │        Não pagou         │      │     Pediu novo prazo     │  │
   │ sacola desfeita, penalid.│      │    aceito apenas 1 vez   │  │
   └──────────────────────────┘      └──────────────┬───────────┘  │
                                                    │              │
                                     ┌──────────────▼───────────┐  │
                                     │     Prazo estourado      │  │
                                     │ sacola desfeita, crédito │  │
                                     └──────────────────────────┘  │
                    ┌────────────────────────────┐                 │
                    │     Retirada concluída     │◀────────────────┘
                    └────────────────────────────┘
```

**Legenda das trilhas:**

- **Esquerda** — trilha de cobrança (avisos e penalidade)
- **Direita** — caminho normal (pagamento e retirada)
- **Pediu novo prazo** — única exceção permitida, aceita uma vez só

---

## Ponto a definir

A regra geral fala em 7 dias (Ribeirão Preto) / 15 dias (fora) para pagamento + retirada, mas o fluxo detalhado usa 2 dias dos 7 para retirar — e não menciona como fica a retirada para clientes de fora. Vale alinhar esses números antes de virar procedimento oficial.
