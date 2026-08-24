# SuperFrete — guia de implantação e lições aprendidas

Este documento é o handoff técnico da integração SuperFrete deste projeto para qualquer projeto novo. Ele distingue o que foi **confirmado em produção**, o contrato implementado e os pontos que ainda exigem validação com uma conta real.

## Resumo executivo

- A integração funciona por API REST `v0`, com `Bearer token`, ambiente separado (`production`/`sandbox`) e `User-Agent` de identificação em **todas** as chamadas.
- O fluxo correto é: **cotação → carrinho → checkout → consulta do pedido → PDF**. Não há etapa separada de `generate` como no Melhor Envio.
- A unidade de verdade é o **ID do pedido**, não o código de rastreio. Ele pode ser nulo antes da liberação/postagem.
- Sempre persista o `carrier` junto da etiqueta. Reutilizar campos com nomes herdados de outro provedor é aceitável apenas se o campo tiver semântica neutra (por exemplo, `me_order_id` guarda o ID SuperFrete), mas o novo projeto deveria preferir nomes neutros como `provider_order_id`.
- Nunca envie campos opcionais de endereço vazios: omita-os. `email: ""` causou erro 400 real.

## Configuração de produção

Configure estas variáveis somente no servidor/host (nunca exponha token ao navegador):

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `SUPERFRETE_TOKEN` | Sim | Token Bearer gerado na conta do ambiente correspondente. |
| `SUPERFRETE_ENV` | Sim (recomendado) | `production` ou `sandbox`; o padrão atual é `production`. |
| `SUPERFRETE_USER_AGENT` | Sim (recomendado) | Formato: `Nome da Aplicação 1.0 (email@contato.com)`. |
| `SUPERFRETE_CEP_ORIGEM` | Sim | CEP de origem. No sistema atual há fallback para `MELHOR_ENVIO_CEP_ORIGEM`; no projeto novo não use esse acoplamento. |
| `SUPERFRETE_SERVICES` | Recomendado | IDs separados por vírgula; o padrão histórico é `1,2,17` (PAC, SEDEX, Mini Envios). Confirme IDs habilitados na conta. |
| dimensões/peso padrão | Recomendado | Altura, largura, comprimento em cm e peso em kg. O código atual reutiliza variáveis do Melhor Envio; substitua por variáveis próprias. |

Base URLs usadas:

- Produção: `https://api.superfrete.com/api/v0`
- Sandbox: `https://sandbox.superfrete.com/api/v0`

**Atenção:** token e URL são vinculados ao ambiente. Um token sandbox contra produção retorna 401 (`Token inválida!`). O teste real deste projeto confirmou que o token de produção estava válido depois que endpoint/payload foram corrigidos.

## Cliente HTTP obrigatório

Todas as requisições devem enviar:

```http
Authorization: Bearer <SUPERFRETE_TOKEN>
Accept: application/json
Content-Type: application/json
User-Agent: Minha Aplicacao 1.0 (suporte@empresa.com)
```

Use timeout explícito (o projeto usa 8 s) e leia o corpo de erro antes de descartá-lo. A API pode devolver HTML quando o endpoint não existe; trate resposta não-JSON como erro de integração, não como lista vazia.

O `User-Agent` é exigido/documentado pela SuperFrete e deve ser mantido. Contudo, uma sondagem deste projeto com token propositalmente inválido obteve o mesmo 401 com, sem e com versão no header. Portanto, 401 não deve ser diagnosticado automaticamente como problema de `User-Agent`: valide primeiro token, ambiente, URL e endpoint.

## Endpoints corretos

| Finalidade | Método e rota | Corpo / observação |
| --- | --- | --- |
| Verificar credencial e saldo | `GET /user` | Retorna dados do usuário e `balance`; não use `/user/me` nem `/balance`. |
| Cotar | `POST /calculator` | `from`, `to`, `services`, `package` e `options`. `services` e `options` são necessários. |
| Criar pedido no carrinho | `POST /cart` | Endereços completos, `volumes`, produtos e `platform` no nível raiz. |
| Pagar/emitir | `POST /checkout` | `{ "orders": ["<id>"] }`; a emissão ocorre aqui. |
| Consultar pedido/situação | `GET /order/info/{id}` | Fonte de verdade para `status` e `tracking`. |
| Obter PDF | `POST /tag/print` | `{ "orders": ["<id>"] }`; retorna URL temporária/externa. |
| Cancelar | `POST /order/cancel` | `{ "order": { "id": "<id>", "description": "motivo" } }`. |

Rotas que **não** devem ser copiadas do Melhor Envio: `/user/me`, `/print`, `/generate`, `/cart/{id}`, `/balance` e `/tracking/{codigo}`. Durante a investigação, elas devolviam HTML ou não atendiam ao contrato SuperFrete; isso fez a primeira implementação parecer autenticada, mas inutilizável.

## Contratos de payload

### Cotação

```json
{
  "from": { "postal_code": "14010080" },
  "to": { "postal_code": "01001000" },
  "services": "1,2,17",
  "package": { "weight": 0.5, "width": 20, "height": 5, "length": 30 },
  "options": {
    "own_hand": false,
    "receipt": false,
    "insurance_value": 0,
    "use_insurance_value": false
  }
}
```

Não presuma que a lista retornada é sempre array direto: o adaptador atual aceita array ou `{ data: array }`. Filtre resultados com `error` antes de mostrá-los como serviços escolhíveis.

### Carrinho/emissão

- Use `state_abbr` (`SP`, `MG` etc.), e não `state`.
- O remetente vem no objeto `from`; **não existe `sender_id`** no contrato utilizado.
- `platform` é campo de topo do `/cart`, não de `options`.
- Envie `products`/declaração de conteúdo com nome, quantidade e valor unitário. Além de ser consistente com a emissão, a SuperFrete informa que CPF/CNPJ e declaração de conteúdo são exigências do fluxo atual de DC-e.
- Para o destinatário, normalize CPF/CNPJ e CEP para apenas dígitos. Exija CPF/CNPJ antes de criar a etiqueta.
- `email`, `phone`, `document` e `complement` são opcionais **somente quando omitidos**. Não envie `""`: foi reproduzido em produção e retornou `400` para `to.email` inválido.
- Valide valores numéricos finitos e positivos de peso/dimensões antes da chamada. Não deixe `NaN`, zero ou dimensões inexistentes seguirem para a API.

Exemplo simplificado:

```json
{
  "service": 1,
  "platform": "Minha Loja",
  "from": {
    "name": "Minha Loja",
    "address": "Rua A", "number": "10", "district": "Centro",
    "city": "Ribeirão Preto", "state_abbr": "SP", "country": "BR",
    "postal_code": "14010080"
  },
  "to": {
    "name": "Cliente", "document": "00000000000",
    "address": "Rua B", "number": "20", "district": "Centro",
    "city": "São Paulo", "state_abbr": "SP", "country": "BR",
    "postal_code": "01001000"
  },
  "volumes": [{ "height": 5, "width": 20, "length": 30, "weight": 0.5 }],
  "products": [{ "name": "Produto usado", "quantity": 1, "unitary_value": 50 }],
  "options": { "insurance_value": 50, "non_commercial": true }
}
```

## Fluxo de negócio recomendado

1. Validar dados locais: autenticação, CEP, CPF/CNPJ, endereço completo de ambas as pontas, pacote e declaração de conteúdo.
2. Cotações: chamar `/calculator`, mostrar apenas propostas sem erro e guardar o `service.id` escolhido.
3. Criar pedido: chamar `/cart` e **persistir imediatamente** o ID do pedido, o provedor, status inicial e um snapshot dos dados usados. Isso permite retomar checkout e investigar falhas sem recriar pedidos.
4. Checkout: chamar `/checkout`. A resposta possui `purchased` e `errors`; `HTTP 2xx` não basta. Se `errors` tiver itens, trate a compra como falha.
5. Pós-checkout: consultar `/order/info/{id}` para obter status e código de rastreio atual; então chamar `/tag/print` para o PDF.
6. Atualizar o registro transacional com status, tracking e URL/estado de impressão. A URL pode expirar; reconsulte o endpoint ao reimprimir em vez de confiar apenas no banco.
7. Notificar o cliente somente quando houver código de rastreio e telefone; faça envio assíncrono e idempotente.
8. Cancelamento: somente para estados permitidos pelo provedor, usando `description`; ao sucesso, reflita a alteração no banco.

O sistema analisado tenta cancelar o pedido do carrinho quando checkout automático falha. Preserve essa compensação, mas registre separadamente: a compensação pode falhar e deixar pedido pendente na SuperFrete.

## Rastreamento e sincronização

Não use o código de rastreio para consultar a API. O código pode aparecer somente após `released`, enquanto o pedido já precisa ser acompanhado desde `pending`.

- Consulte `GET /order/info/{provider_order_id}` para todos os pedidos ativos, inclusive os sem tracking.
- O endpoint fornece situação e tracking, mas não entregava histórico detalhado no teste deste projeto. Gere no máximo um evento sintético para a interface; não invente histórico de transporte.
- Mapeamento atualmente usado: `pending` → aguardando pagamento; `released` → etiqueta postada; `posted` → objeto postado; `delivered` → entregue; `canceled` → cancelada. Mantenha os valores brutos também, pois devem ser confirmados na conta real.
- Não silencie erros de sincronização. Cron deve continuar processando os demais pedidos, mas retornar contagem e amostra dos erros.
- O cron deste projeto roda diariamente às 15:00 UTC, protegido por segredo e limitado por tempo/quantidade. No novo projeto escolha frequência e paginação conforme volume, com idempotência de notificação.

Para links enviados ao cliente, o sistema atual forma `https://superfrete.com/rastreio/{tracking}`. Confirme esse link no primeiro envio real antes de adotá-lo como contrato permanente.

## Banco de dados e segurança

Tabela de etiquetas recomendada:

| Campo | Motivo |
| --- | --- |
| `provider` / `carrier` | Roteia ações ao provedor correto. Use check constraint. |
| `provider_order_id` | Chave para `/order/info`, checkout, impressão e cancelamento. |
| `provider_protocol` | Referência humana, quando disponível. |
| `tracking_code` | Pode ser nulo inicialmente; não use como chave. |
| `provider_status` e `business_status` | Preserve valor bruto e estado normalizado da UI. |
| `label_url`, `label_generated_at` | Cache opcional; reconsulte para imprimir. |
| snapshot de destinatário/remetente/produtos | Auditoria, suporte e reemissão. |
| flags/data de notificação | Evita WhatsApps duplicados. |

Neste projeto a migração adicionou `carrier` com default `melhorenvio`, índice e constraint que aceita `melhorenvio`/`superfrete`. O acesso ao banco é via backend com `service_role`; políticas públicas foram removidas e RLS habilitado. No novo projeto, adote RLS e endpoints autenticados sem depender de um token exposto ao cliente.

## Observabilidade e tratamento de erros

- Para cada chamada, registre método, rota, status HTTP, `provider_order_id` e mensagem sanitizada; nunca token, CPF completo ou endereço completo nos logs.
- Diferencie: 401/403 (credencial/ambiente), 400/422 (dados/payload), 402 ou erros de checkout (saldo/pagamento), 404 (pedido/etiqueta ainda indisponível), timeout/rede e resposta HTML inesperada.
- Mostre o erro legível ao operador, mas mantenha resposta bruta truncada apenas em log seguro.
- Exponha health check autenticado por `GET /user`; ele confirma token e permite exibir saldo sem supor que `/balance` exista.
- Consulte saldo do SuperFrete separadamente de outros provedores. Não some saldos e não deixe a falha de um esconder o saldo do outro.

## Casos reais que já causaram falha

| Sintoma | Causa real | Prevenção |
| --- | --- | --- |
| 401 repetido | Token sandbox contra base de produção e, antes, endpoints/payload errados. | Parear token/base e testar `GET /user`. |
| API retornando HTML em vez de JSON | Rotas copiadas do Melhor Envio não existem na SuperFrete. | Centralizar rotas no adaptador e rejeitar JSON inválido. |
| Cotação sem opções | Campo `services` ausente; `options` ausente em cotações sem seguro. | Enviar ambos sempre. |
| Integração aparecia “não configurada” | Código exigia `SUPERFRETE_SENDER_ID`, variável/conceito inexistente. | Configuração mínima: token; validar origem separadamente. |
| Saldo sempre falhava | Chamada a `/balance`, que não é endpoint válido. | Usar `GET /user`. |
| Emissão 400 para clientes sem e-mail | Campo opcional enviado como string vazia. | Remover opcionais vazios/nulos antes de serializar. |
| Cancelamento 400 | Corpo usava `reason`; a API exige `order.description`. | Usar o corpo correto e testar com ID inócuo. |
| Etiquetas canceladas continuavam “aguardando” | Sync consultava `/tracking/{codigo}` e ignorava pedidos sem tracking. | Consultar `/order/info/{id}` para todos os ativos. |
| Saldo mostrado de outro provedor | UI tinha cartão/chip único. | Estado e saldo por carrier. |

## Lacunas a resolver no projeto novo

1. **Checkout posterior:** no sistema atual, a rota que faz checkout de um pedido já persistido retorna PDF/status, mas não atualiza explicitamente o registro do banco. No novo projeto, faça essa atualização transacional após checkout.
2. **Pré-checagem de saldo:** o sistema atual consulta saldo para exibir, mas não bloqueia checkout SuperFrete localmente. Pode adicionar pré-checagem apenas como UX; o checkout continua sendo a autoridade.
3. **Idempotência:** use chave idempotente própria/lock por venda ao criar carrinho e checkout. Repetição por clique, timeout ou retry pode criar/cobrar mais de um pedido.
4. **Status e eventos:** valide todos os statuses possíveis e se há webhook/endpoint oficial novo. Não deduza entrega a partir de histórico inexistente.
5. **Documentos de postagem:** verifique se `/tag/print` já inclui etiqueta e DACE/declaração de conteúdo, e se há escolha A4/A6. A orientação pública recente diz que ambos devem acompanhar o pacote quando aplicável.
6. **URL de rastreio:** valide com etiqueta real e mantenha fallback para exibir apenas o código.
7. **Expiração:** a central de ajuda informa 10 dias corridos para postagem e cancelamento/estorno automático após o prazo. Sincronize para refletir isso e não ofereça ações inválidas.

## Checklist de homologação antes do go-live

- [ ] Criar token de sandbox e token de produção; confirmar que cada um só funciona na base correspondente.
- [ ] Configurar `User-Agent` com aplicação, versão e e-mail monitorado.
- [ ] Testar `GET /user` e registrar conta/saldo sem vazar segredo.
- [ ] Cotar PAC, SEDEX e serviço alternativo habilitado, incluindo seguro zero e seguro maior que zero.
- [ ] Criar carrinho com e sem e-mail/telefone/complemento; confirmar omissão dos opcionais vazios.
- [ ] Validar rejeições locais de CPF/CNPJ, CEP, peso e dimensões.
- [ ] Emitir ao menos uma etiqueta real de ponta a ponta, consultar `/order/info`, abrir PDF, imprimir e postar.
- [ ] Confirmar conteúdo/DACE/nota fiscal e documento exigido no ponto de postagem.
- [ ] Cancelar pedido de teste dentro da janela permitida e verificar reflexo no banco/UI.
- [ ] Rodar sincronização para pedido sem tracking e depois de `released`; validar status e notificações uma única vez.
- [ ] Simular timeout/retry e confirmar que não cria cobrança/etiqueta duplicada.
- [ ] Verificar reimpressão por `/tag/print`, sem gerar novo pedido nem cobrar saldo.
- [ ] Testar o fluxo quando um provedor está indisponível e outro está saudável.

## Referências externas

- [Página de integração SuperFrete](https://superfrete.com/integracao-frete)
- [Emissão e documentos DC-e — Central de Ajuda](https://ajuda.superfrete.com/artigo/passo-a-passo-para-emitir-dc-e-com-a-superfrete/)
- [Etiqueta, prazo de postagem e impressão — SuperFrete](https://superfrete.com/blog/etiqueta-de-frete)

As rotas e particularidades do contrato acima foram confirmadas principalmente por testes realizados neste repositório em 29/07/2026 e pelos commits de correção: `a33a990`, `a00a574`, `0657fea`, `dc6fda4`, `c216f1e`, `f0dd1e5`, `f4dc060` e `cc531b0`. Antes de produzir um novo projeto, compare novamente com a documentação/API atual da conta, pois integrações logísticas mudam com frequência.
