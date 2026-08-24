# Melhor Envio — guia de implantação e lições aprendidas

Este documento é o handoff técnico da integração Melhor Envio deste projeto para um projeto novo. Ele combina o que foi comprovado durante a implantação, o contrato vigente consultado em 09/08/2026 e uma auditoria das partes deste código que **não devem ser copiadas sem atualização**.

## Resumo executivo

- O fluxo completo é: **OAuth → cotação → carrinho → checkout → geração → consulta → impressão → rastreamento/cancelamento**.
- O ID devolvido pelo `/me/cart` é a referência central e deve ser persistido antes de qualquer etapa seguinte.
- `/me/cart` recebe **um objeto por envio**, não um array. Se houver vários pacotes incompatíveis com múltiplos volumes, faça chamadas separadas.
- CPF/CNPJ do destinatário e `products` completos são essenciais. A integração com DC-e tornou a declaração de produtos ainda mais rigorosa a partir de 06/04/2026.
- Checkout HTTP 200 não significa sucesso integral: examine `errors` e `purchased`.
- Depois de checkout é obrigatório chamar `generate`; somente depois peça `print`.
- O código atual contém decisões históricas úteis, mas também lacunas críticas para o projeto novo: token fixo sem refresh OAuth, rastreamento no método antigo, cancelamento que só remove carrinho e ausência do fluxo DACE/DC-e.

## Ambientes e configuração

Base URLs usadas pela API v2:

- Produção: `https://melhorenvio.com.br/api/v2`
- Sandbox: `https://sandbox.melhorenvio.com.br/api/v2`

Os ambientes são completamente separados: conta, aplicativo, credenciais, saldo e etiquetas de sandbox não existem em produção. Sandbox possui limitações de transportadoras e meios de pagamento, saldo fictício e mudanças automáticas de status para homologação.

Variáveis mínimas recomendadas para uma loja própria:

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `MELHOR_ENVIO_ENV` | Sim | Use exatamente `production` ou `sandbox`. |
| `MELHOR_ENVIO_CLIENT_ID` | Sim para OAuth | ID do aplicativo do ambiente. |
| `MELHOR_ENVIO_CLIENT_SECRET` | Sim para OAuth | Segredo server-side do aplicativo. |
| `MELHOR_ENVIO_REDIRECT_URI` | Sim para OAuth | Deve ser idêntica à callback cadastrada. |
| `MELHOR_ENVIO_ACCESS_TOKEN` | Sim | Token de acesso, armazenado cifrado no servidor/banco. |
| `MELHOR_ENVIO_REFRESH_TOKEN` | Sim | Renovação do acesso sem reconectar a conta. |
| `MELHOR_ENVIO_TOKEN_EXPIRES_AT` | Sim | Permite renovar preventivamente. |
| `MELHOR_ENVIO_USER_AGENT` | Sim | `Nome da Aplicação (email de suporte)`. |
| `MELHOR_ENVIO_CEP_ORIGEM` | Sim | CEP do remetente, apenas dígitos ao enviar. |
| dimensões/peso padrão | Recomendado | Altura/largura/comprimento em cm; peso em kg. |

### Inconsistência existente que não deve ser copiada

O cliente atual escolhe produção apenas quando `MELHOR_ENVIO_ENV === "production"`, mas o `.env.example` comenta `"sandbox" ou "producao"`. Se alguém usar `producao`, o sistema silenciosamente apontará para sandbox. Padronize valores por enum, valide no startup e falhe explicitamente para qualquer valor desconhecido.

## Autenticação OAuth2

Para uma implantação durável, não trate o token como segredo manual eterno. A documentação atual informa:

- `access_token`: validade de 30 dias;
- `refresh_token`: validade de 45 dias;
- scopes devem ser apenas os necessários;
- tokens e credenciais do aplicativo ficam exclusivamente no servidor;
- callback usada na autorização precisa corresponder exatamente ao `redirect_uri` cadastrado.

Implemente:

1. endpoint para iniciar autorização com estado (`state`) aleatório e protegido contra CSRF;
2. callback server-side que troca o código por tokens;
3. armazenamento cifrado de access/refresh token e validade por conta/loja;
4. renovação preventiva, por exemplo antes dos últimos minutos de validade;
5. lock na renovação para evitar vários refreshes concorrentes;
6. tratamento de refresh expirado exigindo reconexão explícita;
7. health check que distingue “não configurado”, “token expirado”, “scope ausente” e indisponibilidade.

O projeto analisado usa apenas `MELHOR_ENVIO_TOKEN` estático e não implementa refresh. Isso pode funcionar temporariamente ou com token gerenciado manualmente, mas **não é implantação completa** para o próximo projeto.

## Cliente HTTP

Todas as chamadas autenticadas devem conter:

```http
Authorization: Bearer <access_token>
User-Agent: Minha Aplicacao (suporte@empresa.com)
Accept: application/json
Content-Type: application/json
```

Use HTTPS, timeout explícito, retry apenas em falhas transitórias seguras e parser que rejeita HTML/resposta inválida. Nunca repita automaticamente criação de carrinho, checkout ou geração sem idempotência própria.

O cliente atual não possui timeout. No projeto novo, defina tempo limite, cancelamento e telemetria por chamada.

## Endpoints principais

| Finalidade | Método e rota | Observação |
| --- | --- | --- |
| Usuário/token | `GET /me` | Health check simples da credencial. |
| Cotação | `POST /me/shipment/calculate` | Use produtos ou volumes; considere `custom_price` e `custom_delivery_time`. |
| Criar item | `POST /me/cart` | Um objeto por chamada; persista o ID retornado. |
| Consultar carrinho | `GET /me/cart/{id}` | Item ainda no carrinho. |
| Remover carrinho | `DELETE /me/cart/{id}` | Apenas item ainda no carrinho; resposta pode ser 204 vazia. |
| Checkout | `POST /me/shipment/checkout` | `{ "orders": ["id"] }`; exige saldo. |
| Gerar | `POST /me/shipment/generate` | Deve ocorrer depois do pagamento. |
| Consultar etiqueta | `GET /me/orders/{id}` | Fonte de verdade pós-checkout/generate. |
| Imprimir | `POST /me/shipment/print` | `{ "mode": "public", "orders": ["id"] }`. |
| Status/rastreamento | `POST /me/shipment/tracking` | Contrato oficial atual usa `{ "orders": ["id"] }`. |
| Verificar cancelamento | `POST /me/shipment/cancellable` | Consultar antes de cancelar etiqueta gerada. |
| Cancelar etiqueta | `POST /me/shipment/cancel` | `order.id`, `reason_id: 2` e `description`. |
| Listar | `GET /me/orders` | Permite filtro por status. |
| Pesquisar | `GET /me/orders/search?q=...` | Busca por ID, protocolo, tracking, autorização ou documento. |
| Imprimir DACE | `GET /me/imprimir/dace/{arquivo}/{order_id}` | `pdf`, `zpl` ou `jpeg`; uma DACE por chamada. |
| Saldo | `GET /me/balance` | O código atual usa e espera `balance`, `reserved`, `debts`. Confirme esquema real da conta. |

### Divergências do código atual

- Rastreamento atual usa `GET /me/shipment/tracking?orders[]=...`; o contrato oficial consultado agora documenta `POST /me/shipment/tracking` com array no corpo. O método antigo funcionou em testes históricos, mas o projeto novo deve usar o contrato atual e possuir teste de integração.
- Cancelamento atual sempre usa `DELETE /me/cart/{id}`. Isso remove carrinho, mas não é o cancelamento correto de uma etiqueta já paga/gerada. Para estas, use `cancellable` e depois `/me/shipment/cancel`.
- Recarga atual usa `POST /me/wallet/recharges`; a referência pública atual localizada documenta inserção de saldo em `POST /me/balance` com gateway/slug/value. Não copie o endpoint de recarga antes de confirmar o contrato disponível para a conta e o modelo de integração.

## Cotação

O projeto atual envia um único `package`, porém a referência atual descreve preferencialmente cotação por `products` ou `volumes`. No projeto novo, modele ambos e use o mesmo resultado do cálculo para criar o carrinho.

Exemplo por produtos:

```json
{
  "from": { "postal_code": "14010080" },
  "to": { "postal_code": "01001000" },
  "products": [
    {
      "id": "SKU-123",
      "width": 20,
      "height": 5,
      "length": 30,
      "weight": 0.5,
      "insurance_value": 50.0,
      "quantity": 1
    }
  ],
  "options": { "receipt": false, "own_hand": false },
  "services": "1,2"
}
```

Cuidados:

- dimensões são centímetros, peso é quilograma e valores monetários têm duas casas;
- IDs de serviço podem mudar entre versões; não decida transportadora pelo nome;
- se a conta possuir taxas/descontos personalizados, mostre `custom_price` e `custom_delivery_time`, com fallback documentado apenas se ausentes;
- omitir `services` permite que as configurações do aplicativo/conta determinem os habilitados; fixar IDs exige manutenção;
- mostre resultados com `error` separadamente, nunca como opção comprável;
- valide limites do serviço e agência exigida antes de criar carrinho.

## Carrinho e declaração de conteúdo

O erro 422 mais trabalhoso desta implantação teve três causas combinadas e foi confirmado com retorno 201 depois da correção:

1. faltava `to.document` (CPF/CNPJ);
2. `/me/cart` recebia array, mas esperava objeto único;
3. `products` não era enviado em todos os pedidos.

Regras atuais importantes:

- pessoa física: use `document` (CPF);
- pessoa jurídica: use `company_document`; dependendo do envio, também `state_register` e `economic_activity_code`;
- envio comercial: nota fiscal em `options.invoice.key` e inscrição estadual quando aplicável;
- envio não comercial: não envie invoice; use declaração de conteúdo e produtos reais;
- `products` é obrigatório e, desde a integração SEFAZ/DC-e de 06/04/2026, precisa estar correto e completo;
- `insurance_value` deve corresponder à soma dos produtos/documento fiscal;
- `state_abbr` é validado contra o CEP;
- algumas transportadoras/agências exigem `agency`;
- Correios, J&T e Loggi não aceitam múltiplos volumes numa única chamada; se a cotação dividir o envio, crie um pedido por volume.

O projeto atual usa sempre um produto genérico (“Produtos de vestuário usados”, quantidade 1). Isso resolveu os 422 antigos, mas não atende necessariamente à exatidão exigida pela DC-e atual. No próximo projeto, grave e envie cada item real, quantidade e valor unitário.

Também sanitize opcionais vazios e valide CPF/CNPJ, CEP, telefone, e-mail, UF, peso, dimensões e valores antes da API.

## Checkout, saldo e pedidos órfãos

Fluxo correto com carteira:

1. criar carrinho e persistir ID/status local;
2. consultar saldo somente como pré-checagem de UX;
3. calcular saldo utilizável conforme o contrato real (`balance`, reservas/dívidas quando aplicável);
4. chamar checkout;
5. conferir tanto status HTTP quanto `errors` e `purchased`;
6. em erro antes da compra, remover o item do carrinho como compensação;
7. em timeout, consultar o pedido antes de repetir checkout para descobrir se a compra ocorreu.

Este projeto já corrigiu dois problemas reais:

- interpretar apenas HTTP/sucesso superficial e ignorar `checkout.errors`;
- deixar pedidos órfãos no carrinho quando faltava saldo.

Também trata o limite de envios simultâneos, que ocorre quando há etiquetas geradas ainda não despachadas. Oriente o operador a postar ou cancelar etiquetas não utilizadas. Não transforme esse limite em erro genérico de saldo.

### PIX

O projeto possui dois conceitos diferentes:

- recarga da carteira por PIX;
- tentativa de checkout da etiqueta com `payment_method: "pix"`.

O fluxo atual de etiqueta PIX é frágil: cria carrinho, solicita checkout, entrega QR e depois confia que uma segunda chamada com `order_id` significa pagamento confirmado. O projeto novo deve consultar o estado do pedido ou receber webhook antes de gerar. Não aceite `order_id` vindo do cliente como prova de pagamento.

Trate respostas assíncronas, expiração do QR, repetição, pagamento tardio e abandono. Persista o pedido já na fase 1; atualmente o histórico só é salvo na fase 2, podendo perder carrinhos/PIX pendentes.

## Geração e impressão

Após checkout aprovado:

1. `POST /me/shipment/generate`;
2. aguardar/pollar estado assíncrono quando necessário;
3. `GET /me/orders/{id}` como fonte de verdade;
4. `POST /me/shipment/print` apenas quando gerado.

A documentação recomenda intervalo entre geração e impressão porque a geração pode ser assíncrona. O código atual chama `generate`, ignora qualquer erro e imediatamente tenta consulta/print. No projeto novo, não silencie geração; faça polling limitado com backoff e estado “gerando”.

Use `mode: "public"` somente quando realmente precisar de link compartilhável. O link público permite acesso a qualquer pessoa que o possua; prefira proxy autenticado, URL curta e não registre o link em logs públicos.

O histórico deste projeto registrou que a página de impressão retornada bloqueava iframe por `X-Frame-Options`. A solução inicial foi abrir em nova aba; depois foi criado proxy backend do PDF. Para o novo projeto, prefira o arquivo/proxy seguro e tenha fallback de nova aba.

Reimprimir deve somente solicitar novamente a impressão do mesmo order ID: não criar carrinho, não fazer checkout e não descontar saldo.

## DC-e e DACE

Esta é a maior atualização regulatória ausente no projeto atual.

- Desde 06/04/2026, `products` corretos e completos sustentam a comunicação da DC-e com a SEFAZ.
- Se a DC-e for gerada fora do Melhor Envio, envie a chave em `options.dce.key` conforme o cenário documentado.
- A DACE deve acompanhar o pacote.
- A API possui impressão por `GET /me/imprimir/dace/{pdf|zpl|jpeg}/{order_id}`.
- O suporte de arquivos no sandbox é limitado em alguns serviços; homologação final deve ocorrer também em produção com envio controlado.

O novo projeto deve armazenar tipo documental (NF-e ou DC-e), chave, produtos e estado de geração/impressão da DACE.

## Rastreamento, status e webhooks

Preferência arquitetural:

1. webhook autenticado para atualizações rápidas;
2. cron de reconciliação para eventos perdidos;
3. consulta manual sob demanda.

Os webhooks do Melhor Envio usam `X-ME-Signature`, HMAC-SHA256 do corpo bruto com o secret do aplicativo. Verifique a assinatura em comparação constante antes de fazer parse/processamento e registre IDs de eventos/estado para idempotência.

Eventos documentados incluem `order.created`, `pending`, `released`, `generated`, `received`, `posted`, `delivered`, `cancelled`, `undelivered`, `paused` e `suspended`. Preserve o status bruto e mapeie para um status de negócio separado.

O tracking pode demorar até um dia útil depois da postagem, dependendo da transportadora. Portanto:

- `tracking` nulo não é erro;
- não exclua pedidos ativos do cron só por não terem tracking;
- use order ID como chave;
- `self_tracking` pode permitir link antecipado, mas não substitui o código da transportadora;
- não transforme ausência de eventos em falha fatal.

O cliente atual captura qualquer erro de rastreamento e devolve eventos vazios. Isso melhora UX antes da postagem, mas também mascara token expirado, mudança de contrato e indisponibilidade. No projeto novo, diferencie “ainda sem eventos” de erro técnico e exponha métricas.

## Cancelamento correto

Existem dois fluxos diferentes:

- pedido ainda no carrinho: `DELETE /me/cart/{id}`;
- etiqueta paga/gerada: consultar `/me/shipment/cancellable` e, se permitido, `POST /me/shipment/cancel` com:

```json
{
  "order": {
    "id": "<order_id>",
    "reason_id": 2,
    "description": "Cancelamento solicitado pelo lojista"
  }
}
```

Etiqueta gerada pode não ser cancelável depois que a transportadora/coleta foi notificada ou após postagem. Quando aprovado depois da geração, o estorno pode levar 12 horas. Modele estados “cancelamento solicitado” e “estorno pendente”; não credite saldo local imediatamente.

O endpoint DELETE atual não cobre corretamente essa segunda situação.

## Validades e limites

Segundo o FAQ oficial atual:

- carrinho: até 20 dias para pagamento;
- depois de pago: até 20 dias para gerar;
- depois de gerado: até 20 dias para postagem em privadas e 7 dias nos Correios;
- expirado: cancelamento automático;
- limite de API informado: 250 requisições por minuto por usuário autenticado.

Use fila, backoff com jitter e limitação por conta. Não dispare um request por etiqueta sem controle em grandes lotes.

## Persistência recomendada

| Campo | Motivo |
| --- | --- |
| `provider` | Roteia operações entre Melhor Envio/SuperFrete. |
| `provider_order_id` (unique) | ID central do carrinho/etiqueta. |
| `protocol`, `tracking`, `self_tracking` | Referências distintas, potencialmente nulas. |
| `provider_status`, `business_status` | Valor bruto e normalização da aplicação. |
| `checkout_status`, `generated_at`, `paid_at` | Recuperação de fluxos parciais. |
| `document_type`, `invoice_key`, `dce_key` | Conformidade documental. |
| snapshots de remetente, destinatário, produtos e volumes | Auditoria e suporte. |
| `quoted_price`, `custom_price`, `purchased_price` | Detectar divergência entre cotação e compra. |
| flags/datas de notificações | Idempotência. |
| cancelamento/estorno | Não confundir solicitação com saldo devolvido. |

Use transação local quando possível, unique constraint por order ID e idempotency key própria por venda/tentativa. Nunca faça insert “best effort” depois de já cobrar sem fila de reparo: o projeto atual registra algumas falhas somente no console, podendo existir etiqueta paga sem histórico local.

## Observabilidade e segurança

- Nunca exponha token, client secret, refresh token, CPF completo ou link público de etiqueta em logs.
- Registre método, rota, status, latência, order ID, etapa e erro sanitizado.
- Separe 401/403, 400/422, saldo insuficiente, limite simultâneo, geração assíncrona, timeout e rate limit.
- Proteja rotas internas com autenticação/autorização e cron com segredo.
- Webhook: use corpo bruto para HMAC, comparação constante, proteção contra replay e processamento idempotente.
- Health check deve chamar `/me` ou rota adequada sem criar/cobrar nada.
- Alertas: token próximo da expiração, refresh falhando, pedidos pagos não gerados, geração sem PDF, webhook atrasado e reconciliação com erro.

## Casos reais já corrigidos neste projeto

| Sintoma | Causa | Correção |
| --- | --- | --- |
| `/me/cart` retornava 422 | Faltavam CPF/CNPJ e products; payload era array. | Objeto único, `to.document` e products sempre. |
| Checkout quebrava lendo resposta | Formato de checkout/generate não era o presumido. | Consultar `/me/orders/{id}` como fonte de verdade. |
| Saldo parecia suficiente e checkout falhava | Cálculo não considerava componentes indisponíveis/dívidas. | Mostrar saldo utilizável e deixar checkout como autoridade. |
| Pedido órfão após falha | Carrinho não era removido quando checkout falhava. | Compensação com DELETE, registrando eventual falha. |
| HTTP 200 tratado como compra | Campo `errors` ignorado. | Validar `errors` e `purchased`. |
| Erro obscuro de limite | Muitas etiquetas simultâneas não postadas. | Mensagem para postar/cancelar pendentes. |
| PDF não aparecia | URL não vinha no formato presumido e iframe era bloqueado. | Buscar pedido/print sob demanda; nova aba ou proxy. |
| Tracking falhava | Resposta vinha indexada por order ID e podia não ter eventos. | Extrair pelo ID e aceitar ausência temporária. |

## Lacunas do sistema atual a corrigir no próximo

1. Implementar OAuth completo e refresh automático.
2. Corrigir enum de ambiente e remover `producao` ambíguo.
3. Atualizar cotação para `products`/`volumes` e usar campos customizados de preço/prazo.
4. Enviar produtos reais e integrar DC-e/DACE.
5. Atualizar tracking para o contrato POST atual e adicionar webhooks assinados.
6. Separar remoção de carrinho de cancelamento de etiqueta paga/gerada.
7. Tornar checkout, geração e impressão recuperáveis/idempotentes; não silenciar generate.
8. Persistir carrinho/PIX antes do pagamento e confirmar pagamento server-side.
9. Confirmar endpoint/contrato de recarga e saldo na conta real antes de reutilizar o código atual.
10. Adicionar timeout, rate limiter, retry seguro e fila de reconciliação.

## Checklist de homologação

- [ ] Criar contas e aplicativos separados em sandbox e produção.
- [ ] Implementar autorização, callback, scopes mínimos, refresh e reconexão.
- [ ] Validar `User-Agent`, callback e health check `/me`.
- [ ] Cotar por produtos e volumes; confirmar `custom_price`/`custom_delivery_time`.
- [ ] Testar PF, PJ, nota fiscal e declaração de conteúdo/DC-e.
- [ ] Confirmar products reais, seguro total e validação UF × CEP.
- [ ] Criar carrinho como objeto único; testar serviço que exige agência.
- [ ] Testar múltiplos volumes e separação para Correios/J&T/Loggi.
- [ ] Simular saldo insuficiente, `errors` em HTTP 200 e limite simultâneo.
- [ ] Simular timeout de checkout e provar que retry não cobra duas vezes.
- [ ] Testar geração assíncrona, polling, print público/privado e proxy.
- [ ] Imprimir etiqueta e DACE; conferir documentos no pacote.
- [ ] Testar webhook válido, assinatura inválida, replay e evento duplicado.
- [ ] Reconciliar cron com pedidos sem tracking e estados especiais.
- [ ] Remover carrinho pendente e cancelar etiqueta gerada em fluxos distintos.
- [ ] Confirmar prazo e estado do estorno.
- [ ] Validar expirações de carrinho, geração e postagem.
- [ ] Fazer um envio controlado real de ponta a ponta em produção.

## Referências oficiais

- [Introdução e ambientes](https://docs.melhorenvio.com.br/reference/introducao-api-melhor-envio)
- [Autenticação OAuth2](https://docs.melhorenvio.com.br/docs/autenticacao-1)
- [Cálculo de fretes](https://docs.melhorenvio.com.br/reference/calculo-de-fretes-por-produtos)
- [Inserção no carrinho e regras DC-e](https://docs.melhorenvio.com.br/reference/inserir-fretes-no-carrinho)
- [Checkout](https://docs.melhorenvio.com.br/reference/compra-de-fretes-1)
- [Geração](https://docs.melhorenvio.com.br/reference/geracao-de-etiquetas)
- [Impressão](https://docs.melhorenvio.com.br/reference/impressao-de-etiquetas)
- [Impressão DACE](https://docs.melhorenvio.com.br/reference/impressao-dace)
- [Status da etiqueta](https://docs.melhorenvio.com.br/reference/rastreio-de-envios)
- [Cancelamento](https://docs.melhorenvio.com.br/reference/cancelamento-de-etiquetas)
- [Webhooks e assinatura](https://docs.melhorenvio.com.br/docs/webhooks)
- [FAQ: validades, rate limit e produção](https://docs.melhorenvio.com.br/reference/faq)

As lições históricas foram extraídas principalmente dos commits `389b74b`, `98e0d4d`, `9f087ff`, `4e97697`, `88378eb`, `f0e379b`, `1b8d5ae`, `e9bd993`, `34a2da4`, `1adadaa`, `ec57b68`, `6b94162` e `377da50`. Como a documentação oficial mudou em 2026, o projeto novo deve priorizar os contratos atuais e conservar testes de integração que detectem mudanças futuras.
