import { google, people_v1 } from "googleapis"
import { montarNomeContato, normalizarTelefone } from "./google-contact-nome"

// ── Auth ──────────────────────────────────────────────────────────

function criarOAuth2() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )
}

function criarPeopleClient() {
  const auth = criarOAuth2()
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return google.people({ version: "v1", auth })
}

// ── Tipos ─────────────────────────────────────────────────────────

export interface SincronizarParams {
  clienteId:  number
  nome?:      string | null
  apelido?:   string | null
  instagram?: string | null
  celular?:   string | null
  googleContactId?: string | null
}

export interface SincronizarResult {
  ok:              boolean
  googleContactId?: string
  acao:            "criar" | "atualizar" | "erro"
  nomeMontado?:    string
  telefoneNorm?:   string
  erro?:           string
}

// ── Helpers ───────────────────────────────────────────────────────

function buildResource(nomeMontado: string, telefoneNorm: string): people_v1.Schema$Person {
  return {
    names: [{ givenName: nomeMontado, unstructuredName: nomeMontado }],
    phoneNumbers: [{ value: telefoneNorm, type: "mobile" }],
  }
}

/** Busca contato existente pelo telefone normalizado. Retorna resourceName ou null. */
async function buscarPorTelefone(
  client: people_v1.People,
  telefoneNorm: string,
): Promise<string | null> {
  try {
    const res = await client.people.searchContacts({
      query: telefoneNorm,
      readMask: "phoneNumbers,names",
      pageSize: 5,
    })
    const results = res.data.results ?? []
    for (const r of results) {
      const phones = r.person?.phoneNumbers ?? []
      const telDigits = telefoneNorm.replace(/\D/g, "")
      for (const p of phones) {
        const pDigits = p.value?.replace(/\D/g, "") ?? ""
        // Compara com e sem prefixo 55 para cobrir qualquer formato salvo no Google
        if (pDigits === telDigits || pDigits === telDigits.slice(2) || telDigits === pDigits.slice(2)) {
          return r.person?.resourceName ?? null
        }
      }
    }
    return null
  } catch {
    return null
  }
}

// ── Função principal ──────────────────────────────────────────────

/**
 * Cria ou atualiza o contato na agenda Google.
 * Sempre retorna resultado — nunca lança exceção.
 */
export async function sincronizarContato(params: SincronizarParams): Promise<SincronizarResult> {
  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    return { ok: false, acao: "erro", erro: "GOOGLE_REFRESH_TOKEN não configurado." }
  }

  const nomeMontado = montarNomeContato({
    nome:      params.nome,
    instagram: params.instagram,
  })

  if (!nomeMontado) {
    return { ok: false, acao: "erro", erro: "Nenhum dado (nome/apelido/instagram) disponível para montar o contato." }
  }

  const telResult = normalizarTelefone(params.celular)
  if (!telResult.ok) {
    return { ok: false, acao: "erro", nomeMontado, erro: telResult.erro }
  }
  const telefoneNorm = telResult.valor

  try {
    const client  = criarPeopleClient()
    const resource = buildResource(nomeMontado, telefoneNorm)

    // 1. Tenta pelo ID salvo no banco
    let resourceName = params.googleContactId ?? null

    // 2. Se não tem ID → busca por telefone
    if (!resourceName) {
      resourceName = await buscarPorTelefone(client, telefoneNorm)
    }

    // 3. Atualizar contato existente
    if (resourceName) {
      try {
        const existing = await client.people.get({
          resourceName,
          personFields: "names,phoneNumbers,metadata",
        })
        const etag = existing.data.etag ?? undefined

        await client.people.updateContact({
          resourceName,
          updatePersonFields: "names,phoneNumbers",
          requestBody: { ...resource, etag },
        })

        return { ok: true, acao: "atualizar", googleContactId: resourceName, nomeMontado, telefoneNorm }
      } catch {
        // Contato não existe mais no Google — tenta buscar por telefone ou criar
        resourceName = await buscarPorTelefone(client, telefoneNorm)
        if (resourceName) {
          const existing = await client.people.get({
            resourceName,
            personFields: "names,phoneNumbers,metadata",
          })
          await client.people.updateContact({
            resourceName,
            updatePersonFields: "names,phoneNumbers",
            requestBody: { ...resource, etag: existing.data.etag ?? undefined },
          })
          return { ok: true, acao: "atualizar", googleContactId: resourceName, nomeMontado, telefoneNorm }
        }
        // Não encontrou — cai para criação abaixo
      }
    }

    // 4. Criar novo contato
    const criado = await client.people.createContact({ requestBody: resource })
    const newResourceName = criado.data.resourceName

    if (!newResourceName) {
      return { ok: false, acao: "erro", nomeMontado, telefoneNorm, erro: "Google não retornou resourceName." }
    }

    return { ok: true, acao: "criar", googleContactId: newResourceName, nomeMontado, telefoneNorm }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, acao: "erro", nomeMontado, telefoneNorm, erro: msg.slice(0, 300) }
  }
}
