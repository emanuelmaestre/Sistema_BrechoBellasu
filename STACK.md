# Stack — Brechó Bellasu V2

> Sistema de Gestão para Live Commerce  
> Gerado em: 26/05/2026

---

## Framework & Runtime

| Tecnologia | Versão |
|---|---|
| Next.js | 16.2.6 |
| React | 19.2.4 |
| React DOM | 19.2.4 |
| TypeScript | ^5 |
| Node.js | ^20 |

---

## Banco de Dados & Auth

| Tecnologia | Versão |
|---|---|
| Supabase JS | ^2.106.1 |
| Supabase SSR | ^0.10.3 |
| Supabase CLI (dev) | ^2.101.0 |
| jsonwebtoken | ^9.0.3 |
| bcryptjs | ^3.0.3 |

---

## UI & Estilização

| Tecnologia | Versão |
|---|---|
| Tailwind CSS | ^4 |
| @tailwindcss/postcss | ^4 |
| tailwind-merge | ^3.6.0 |
| class-variance-authority | ^0.7.1 |
| clsx | ^2.1.1 |
| motion (Framer Motion) | ^12.40.0 |
| lucide-react | ^1.16.0 |

### Radix UI

| Componente | Versão |
|---|---|
| @radix-ui/react-avatar | ^1.1.11 |
| @radix-ui/react-dialog | ^1.1.15 |
| @radix-ui/react-dropdown-menu | ^2.1.16 |
| @radix-ui/react-label | ^2.1.8 |
| @radix-ui/react-select | ^2.2.6 |
| @radix-ui/react-separator | ^1.1.8 |
| @radix-ui/react-slot | ^1.2.4 |
| @radix-ui/react-tabs | ^1.1.13 |
| @radix-ui/react-toast | ^1.2.15 |

---

## State Management & Forms

| Tecnologia | Versão |
|---|---|
| Zustand | ^5.0.13 |
| TanStack React Query | ^5.100.11 |
| TanStack React Table | ^8.21.3 |
| React Hook Form | ^7.76.0 |
| @hookform/resolvers | ^5.4.0 |
| Zod | ^4.4.3 |

---

## HTTP & Comunicação

| Tecnologia | Versão |
|---|---|
| Axios | ^1.16.1 |

---

## IA

| Tecnologia | Versão |
|---|---|
| AI SDK (Vercel) | ^6.0.190 |
| @ai-sdk/anthropic | ^3.0.78 |

---

## PDF & Exportação

| Tecnologia | Versão |
|---|---|
| jsPDF | ^4.2.1 |
| jspdf-autotable | ^5.0.8 |
| xlsx | ^0.18.5 |

---

## Email

| Tecnologia | Versão |
|---|---|
| Resend | ^6.12.3 |
| react-email | ^6.3.0 |

---

## Gráficos

| Tecnologia | Versão |
|---|---|
| Recharts | ^2.15.4 |

---

## Dev & Testes

| Tecnologia | Versão |
|---|---|
| ESLint | ^9 |
| eslint-config-next | 16.2.6 |
| Prettier | ^3.8.3 |
| Vitest | ^4.1.7 |
| @vitejs/plugin-react | ^6.0.2 |
| pg (PostgreSQL client) | ^8.21.0 |

---

## Integrações Externas

| Serviço | Finalidade |
|---|---|
| **Supabase** | Banco de dados PostgreSQL + Storage |
| **Z-API** | Envio de mensagens via WhatsApp |
| **Melhor Envio** | Cálculo de frete + Etiquetas de envio |
| **OpenAI** | Agente de IA |
| **Resend** | Emails transacionais |
| **Vercel** | Hospedagem e deploy |

---

## Variáveis de Ambiente

| Variável | Finalidade |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anônima Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service role Supabase |
| `JWT_SECRET` | Segredo para geração de tokens JWT |
| `RESEND_API_KEY` | Chave da API Resend |
| `OPENAI_API_KEY` | Chave da API OpenAI |
| `NEXT_PUBLIC_APP_URL` | URL pública da aplicação |
| `ZAPI_INSTANCE_ID` | ID da instância Z-API |
| `ZAPI_TOKEN` | Token da instância Z-API |
| `ZAPI_CLIENT_TOKEN` | Client token Z-API |
| `MELHOR_ENVIO_ENV` | Ambiente Melhor Envio (`sandbox` / `production`) |
| `MELHOR_ENVIO_TOKEN` | Token de autenticação Melhor Envio |
| `MELHOR_ENVIO_CEP_ORIGEM` | CEP de origem para cálculo de frete |
| `MELHOR_ENVIO_ALTURA` | Altura padrão da embalagem (cm) |
| `MELHOR_ENVIO_LARGURA` | Largura padrão da embalagem (cm) |
| `MELHOR_ENVIO_COMPRIMENTO` | Comprimento padrão da embalagem (cm) |
| `MELHOR_ENVIO_PESO` | Peso padrão da embalagem (kg) |

---

## Migrações Pendentes

| Arquivo | Descrição | Status |
|---|---|---|
| `supabase/006_live_tipo.sql` | Adiciona coluna `tipo` à tabela `lives` | ⚠️ Não aplicada |

> Para aplicar: acesse [Supabase SQL Editor](https://supabase.com/dashboard/project/mfhpiwwctovltejiznmr/sql/new) e execute o arquivo `supabase/006_live_tipo.sql`.
