// ══════════════════════════════════════════════════════════════════
// Etiqueta de sacola da live — 100 × 147 mm na BY-480BT (203 dpi).
//
// A etiqueta é cortada ao meio quando cabem duas sacolas, e cada metade
// vira uma etiqueta independente colada numa sacola diferente. Por isso
// cada BLOCO repete o endereço da loja: a metade de cima não pode sair
// sem remetente.
//
// Este módulo é só cálculo — mede quanto cada bloco ocupa em milímetros
// e decide quem divide etiqueta com quem. Sem I/O, sem React.
// ══════════════════════════════════════════════════════════════════

// ─── Geometria da mídia ──────────────────────────────────────────
/** Dimensões físicas da etiqueta, em milímetros. */
export const ETIQUETA_MM = { largura: 100, altura: 147 } as const

/**
 * Respiro em volta do conteúdo. São 4 mm porque a impressora tem
 * tolerância de ±1,5 mm no tracionamento: com menos que isso, uma
 * etiqueta levemente torta imprime no liner em vez do papel.
 */
export const MARGEM_MM = 4

/** Altura útil depois de descontar as margens de cima e de baixo. */
export const ALTURA_UTIL_MM = ETIQUETA_MM.altura - MARGEM_MM * 2 // 139

/** Largura útil depois de descontar as margens laterais. */
export const LARGURA_UTIL_MM = ETIQUETA_MM.largura - MARGEM_MM * 2 // 92

/** Espaço da linha de corte entre os dois blocos. */
export const CORTE_MM = 6

/**
 * Reserva que nenhuma linha de texto pode invadir. É o que garante que
 * o endereço nunca chegue encostando na borda: o alvo de encaixe é
 * `LARGURA_UTIL_MM - RESERVA_MM`, não a largura cheia.
 */
export const RESERVA_MM = 4

// ─── Orçamento vertical de um bloco ──────────────────────────────
// Medidas conferidas no preview renderizado em milímetros reais.

/** Altura fixa de um bloco quando a etiqueta leva duas sacolas. */
const FIXO_DUPLO_MM = 40.5
/** Altura fixa de um bloco quando a sacola ocupa a etiqueta inteira. */
const FIXO_SOLO_MM = 46

/** Altura de cada linha da lista de produtos, por modo. */
const LINHA_ITEM_MM = { duplo: 4.2, solo: 5.1 } as const

/** Altura de cada linha a mais do endereço da cliente (a 1ª já está no fixo). */
const LINHA_ENDERECO_MM = { duplo: 3.3, solo: 3.7 } as const

/**
 * Altura máxima de um bloco numa etiqueta dividida. Acima disso a outra
 * metade fica um talão pequeno demais para ser útil.
 */
export const ALTURA_MAX_BLOCO_MM = 92

/** Caracteres que cabem numa linha de produto, por modo. */
const CHARS_ITEM = { duplo: 33, solo: 30 } as const

/** Caracteres que cabem numa linha do endereço da cliente. */
const CHARS_ENDERECO = { duplo: 42, solo: 40 } as const

/** Limite de linhas do endereço antes de o texto ser encurtado. */
const MAX_LINHAS_ENDERECO = 2

// ─── Tipos ───────────────────────────────────────────────────────

export interface ProdutoEtiqueta {
  nome: string
  cor?: string | null
  tamanho?: string | null
  quantidade?: number | null
  preco?: number | null
}

export interface EnderecoBruto {
  logradouro?: string | null
  numero?: string | null
  bairro?: string | null
  complemento?: string | null
}

export interface SacolaEtiqueta {
  compraId: number
  numeroSacola: string | null
  nomeCliente: string
  instagram?: string | null
  dataLive?: string | null
  produtos: ProdutoEtiqueta[]
  total: number
  /** Quitada com crédito da cliente: a etiqueta diz isso no lugar do valor. */
  pagoComCredito?: boolean
  endereco: EnderecoBruto
  /** Retirada na loja dispensa endereço — a linha vira um aviso. */
  retirada?: boolean
}

export type ModoEtiqueta = "duplo" | "solo"

export interface EtiquetaMontada {
  /** Ordem dentro do lote, começando em 1. */
  indice: number
  modo: ModoEtiqueta
  blocos: SacolaEtiqueta[]
  /** Altura ocupada por cada bloco, em mm — usada na linha de corte. */
  alturasMm: number[]
}

// ─── Normalização de texto ───────────────────────────────────────

/** Numerais romanos usados em nome de bairro e conjunto habitacional. */
const ROMANO = /^(i{1,3}|iv|vi{0,3}|ix|xi{0,2})$/

/** Preposições e artigos que ficam em minúscula no meio do nome próprio. */
const MINUSCULAS = new Set([
  "de", "da", "do", "das", "dos", "e", "a", "o", "as", "os", "em", "no", "na",
])

/**
 * Capitalização de nome próprio: cada palavra significativa com inicial
 * maiúscula, conectivos em minúscula. O cadastro chega bagunçado
 * ("RUA SAO SEBASTIAO", "rua são sebastião") e a etiqueta precisa sair
 * com grafia uniforme.
 */
export function capitalizarNome(texto: string): string {
  const limpo = (texto ?? "").trim().replace(/\s+/g, " ")
  if (!limpo) return ""
  const palavras = limpo.toLocaleLowerCase("pt-BR").split(" ")
  return palavras
    .map((palavra, i) => {
      // Numeral romano de bairro ("Quintino Facci II") vira "Ii" se for
      // tratado como palavra comum.
      if (ROMANO.test(palavra)) return palavra.toUpperCase()

      // "Bl. A" e "Qd. E" são identificadores, não artigos: letra solta
      // e palavra logo depois de abreviação ficam em maiúscula.
      const ehConectivo =
        i > 0 &&
        MINUSCULAS.has(palavra) &&
        palavra.length > 1 &&
        !palavras[i - 1].endsWith(".")
      if (ehConectivo) return palavra

      // A primeira LETRA, não o primeiro caractere: bairro entre
      // parênteses saía como "(dona Amália)".
      return palavra.replace(/[a-zà-ÿ]/, (c) => c.toLocaleUpperCase("pt-BR"))
    })
    .join(" ")
}

/** Abreviações aplicadas quando o endereço não cabe na linha. */
const ABREVIACOES: Array<[RegExp, string]> = [
  [/\bAvenida\b/gi, "Av."],
  [/\bRodovia\b/gi, "Rod."],
  [/\bEstrada\b/gi, "Estr."],
  [/\bAlameda\b/gi, "Al."],
  [/\bTravessa\b/gi, "Tv."],
  [/\bPraça\b/gi, "Pç."],
  [/\bJardim\b/gi, "Jd."],
  [/\bResidencial\b/gi, "Res."],
  [/\bCondomínio\b/gi, "Cond."],
  [/\bApartamento\b/gi, "Ap."],
  [/\bApto\b/gi, "Ap."],
  [/\bBloco\b/gi, "Bl."],
  [/\bQuadra\b/gi, "Qd."],
  [/\bFundos\b/gi, "Fds."],
  [/\bSobrado\b/gi, "Sob."],
  [/\bRua\b/gi, "R."],
]

export function abreviarEndereco(texto: string): string {
  return ABREVIACOES.reduce((s, [re, curto]) => s.replace(re, curto), texto)
}

/**
 * Monta o endereço da cliente: rua, número, bairro e complemento. Só
 * esses — cidade, UF e CEP não entram na etiqueta, porque a entrega é
 * local e campo opcional só existe para brigar por espaço.
 *
 * Campos vazios somem sem deixar traço órfão.
 */
export function montarEnderecoCliente(e: EnderecoBruto): string {
  const logradouro = capitalizarNome(e.logradouro ?? "")
  const numero = (e.numero ?? "").toString().trim()
  const rua = [logradouro, numero].filter(Boolean).join(", ")
  const partes = [rua, capitalizarNome(e.bairro ?? ""), capitalizarNome(e.complemento ?? "")]
  return partes.filter(Boolean).join(" - ")
}

/**
 * Arroba da cliente como sai na etiqueta.
 *
 * O cadastro guarda o usuário cru e em caixa variada ("MOREIRAMINEIRA",
 * "brecho.pri24"). Na etiqueta ele precisa do @ para se distinguir do
 * resto da linha, e em minúscula porque arroba do Instagram não tem
 * caixa — impressa em maiúscula vira grito.
 */
export function formatarInstagram(bruto?: string | null): string | null {
  const limpo = (bruto ?? "").trim().replace(/^@+/, "")
  return limpo ? `@${limpo.toLocaleLowerCase("pt-BR")}` : null
}

/** Soma dos produtos da sacola, usada quando o total da compra não bate. */
export function somarProdutos(produtos: ProdutoEtiqueta[]): number {
  return produtos.reduce((s, p) => s + (p.preco ?? 0) * (p.quantidade ?? 1), 0)
}

/**
 * O que a cliente ainda deve, e por quê.
 *
 * Líquido zero quase sempre significa QUITADO, não erro de cadastro: a
 * loja aplica crédito da cliente na compra, e aí `valor_total` continua
 * cheio enquanto `credito_aplicado` cobre tudo. Imprimir a soma das
 * peças nesse caso cobra de novo quem já pagou — o oposto do que a
 * etiqueta serve para fazer.
 *
 * Só existe um caso em que vale recorrer à soma das peças: a compra
 * nasceu com `valor_total` zerado, sem desconto e sem crédito que
 * explique o zero, mas com peças que têm preço. Aí o zero é buraco de
 * cadastro e a tela avisa.
 */
export interface ValoresCompra {
  valorTotal: number
  desconto: number
  creditoAplicado: number
}

export interface TotalSacola {
  /** Valor impresso em "Total". */
  valor: number
  /** Quitado com crédito da cliente — a etiqueta diz isso em vez do valor. */
  pagoComCredito: boolean
  /** Zero sem explicação, com peças que têm preço. A tela precisa avisar. */
  divergente: boolean
}

export function totalDaSacola(v: ValoresCompra, produtos: ProdutoEtiqueta[]): TotalSacola {
  const liquido = Math.max(0, v.valorTotal - v.desconto - v.creditoAplicado)
  if (liquido > 0) return { valor: liquido, pagoComCredito: false, divergente: false }

  if (v.creditoAplicado > 0) {
    return { valor: 0, pagoComCredito: true, divergente: false }
  }

  // Desconto que zerou a compra é intencional: cortesia, brinde, troca.
  if (v.desconto > 0) return { valor: 0, pagoComCredito: false, divergente: false }

  const soma = somarProdutos(produtos)
  if (soma > 0) return { valor: soma, pagoComCredito: false, divergente: true }
  return { valor: 0, pagoComCredito: false, divergente: false }
}

/** Descrição do produto como sai na etiqueta: peça, cor e tamanho. */
export function descreverProduto(p: ProdutoEtiqueta): string {
  const detalhes = [p.cor, p.tamanho].map((d) => (d ?? "").trim()).filter(Boolean)
  const nome = (p.nome ?? "").trim()
  return detalhes.length > 0 ? `${nome} - ${detalhes.join(" ")}` : nome
}

// ─── Medição ─────────────────────────────────────────────────────

/**
 * Quantas linhas um texto ocupa numa largura dada. A estimativa é por
 * contagem de caracteres: a fonte é a mesma em toda a etiqueta e o
 * texto é curto, então a média de avanço é estável o bastante. Quem dá
 * a palavra final é o navegador na hora de renderizar — aqui a conta
 * serve para decidir o emparelhamento antes de desenhar.
 */
export function contarLinhas(texto: string, charsPorLinha: number): number {
  const t = (texto ?? "").trim()
  if (!t) return 1
  return Math.max(1, Math.ceil(t.length / charsPorLinha))
}

/** Linhas que a lista de produtos ocupa, contando as quebras. */
export function linhasDosProdutos(produtos: ProdutoEtiqueta[], modo: ModoEtiqueta): number {
  return produtos.reduce(
    (total, p) => total + contarLinhas(descreverProduto(p), CHARS_ITEM[modo]),
    0,
  )
}

/**
 * Endereço encaixado na linha: encurta por abreviação antes de deixar
 * quebrar, e nunca corta no meio de uma palavra. Devolve o texto final
 * e quantas linhas ele ocupa.
 */
export function encaixarEndereco(
  sacola: SacolaEtiqueta,
  modo: ModoEtiqueta,
): { texto: string; linhas: number } {
  if (sacola.retirada) return { texto: "RETIRADA NA LOJA", linhas: 1 }

  const limite = CHARS_ENDERECO[modo]
  const completo = montarEnderecoCliente(sacola.endereco)
  if (!completo) return { texto: "", linhas: 1 }

  if (contarLinhas(completo, limite) <= 1) return { texto: completo, linhas: 1 }

  const abreviado = abreviarEndereco(completo)
  const linhas = Math.min(contarLinhas(abreviado, limite), MAX_LINHAS_ENDERECO)
  return { texto: abreviado, linhas }
}

/** Altura total que a sacola ocupa no modo dado, em milímetros. */
export function alturaBlocoMm(sacola: SacolaEtiqueta, modo: ModoEtiqueta): number {
  const fixo = modo === "duplo" ? FIXO_DUPLO_MM : FIXO_SOLO_MM
  const itens = linhasDosProdutos(sacola.produtos, modo) * LINHA_ITEM_MM[modo]
  const enderecoExtra = (encaixarEndereco(sacola, modo).linhas - 1) * LINHA_ENDERECO_MM[modo]
  return fixo + itens + enderecoExtra
}

/** Uma sacola sozinha não cabe nem na etiqueta inteira? */
export function excedeEtiquetaInteira(sacola: SacolaEtiqueta): boolean {
  return alturaBlocoMm(sacola, "solo") > ALTURA_UTIL_MM
}

/** As duas sacolas cabem juntas na mesma etiqueta? */
export function cabemJuntas(a: SacolaEtiqueta, b: SacolaEtiqueta): boolean {
  const alturaA = alturaBlocoMm(a, "duplo")
  const alturaB = alturaBlocoMm(b, "duplo")
  if (alturaA > ALTURA_MAX_BLOCO_MM || alturaB > ALTURA_MAX_BLOCO_MM) return false
  return alturaA + alturaB + CORTE_MM <= ALTURA_UTIL_MM
}

// ─── Emparelhamento ──────────────────────────────────────────────

/** Número da sacola como inteiro, para ordenar e achar consecutivos. */
function ordemSacola(s: SacolaEtiqueta): number {
  const n = parseInt((s.numeroSacola ?? "").replace(/\D/g, ""), 10)
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER
}

/**
 * Distribui as sacolas em etiquetas.
 *
 * Só empareamos sacolas VIZINHAS na ordem de número, nunca a 12 com a
 * 27: na bancada você separa seguindo a numeração, e um par fora de
 * ordem quebra esse ritmo. Quando a vizinha não cabe, a sacola sai
 * sozinha e a seguinte tenta par com a próxima.
 */
export function montarEtiquetas(sacolas: SacolaEtiqueta[]): EtiquetaMontada[] {
  const fila = [...sacolas].sort((a, b) => ordemSacola(a) - ordemSacola(b))
  const etiquetas: EtiquetaMontada[] = []

  let i = 0
  while (i < fila.length) {
    const atual = fila[i]
    const proxima = fila[i + 1]

    if (proxima && cabemJuntas(atual, proxima)) {
      etiquetas.push({
        indice: etiquetas.length + 1,
        modo: "duplo",
        blocos: [atual, proxima],
        alturasMm: [alturaBlocoMm(atual, "duplo"), alturaBlocoMm(proxima, "duplo")],
      })
      i += 2
      continue
    }

    etiquetas.push({
      indice: etiquetas.length + 1,
      modo: "solo",
      blocos: [atual],
      alturasMm: [alturaBlocoMm(atual, "solo")],
    })
    i += 1
  }

  return etiquetas
}

export interface ResumoLote {
  sacolas: number
  etiquetas: number
  pares: number
  sozinhas: number
  /** Etiquetas poupadas pelo emparelhamento. */
  economia: number
  /** Sacolas que não cabem nem na etiqueta inteira. */
  excedentes: number
  /** Sacolas sem endereço e sem marcação de retirada. */
  semEndereco: number
}

export function resumirLote(
  etiquetas: EtiquetaMontada[],
  sacolas: SacolaEtiqueta[],
): ResumoLote {
  const pares = etiquetas.filter((e) => e.modo === "duplo").length
  const sozinhas = etiquetas.length - pares
  return {
    sacolas: sacolas.length,
    etiquetas: etiquetas.length,
    pares,
    sozinhas,
    economia: sacolas.length - etiquetas.length,
    excedentes: sacolas.filter(excedeEtiquetaInteira).length,
    semEndereco: sacolas.filter(
      (s) => !s.retirada && !montarEnderecoCliente(s.endereco),
    ).length,
  }
}
