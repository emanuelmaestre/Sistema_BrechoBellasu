import { describe, it, expect } from "vitest"
import {
  ALTURA_MAX_BLOCO_MM,
  ALTURA_UTIL_MM,
  abreviarEndereco,
  alturaBlocoMm,
  cabemJuntas,
  capitalizarNome,
  contarLinhas,
  descreverProduto,
  encaixarEndereco,
  excedeEtiquetaInteira,
  linhasDosProdutos,
  montarEnderecoCliente,
  montarEtiquetas,
  resumirLote,
  type ProdutoEtiqueta,
  type SacolaEtiqueta,
} from "./etiqueta-sacola"

function produto(nome: string, cor?: string): ProdutoEtiqueta {
  return { nome, cor: cor ?? null, quantidade: 1, preco: 100 }
}

function sacola(numero: string, qtdProdutos: number, extra: Partial<SacolaEtiqueta> = {}): SacolaEtiqueta {
  return {
    compraId: Number(numero),
    numeroSacola: numero,
    nomeCliente: "Maria Oliveira",
    instagram: "@maria",
    produtos: Array.from({ length: qtdProdutos }, (_, i) => produto(`Blusa ${i}`, "azul")),
    total: 100 * qtdProdutos,
    endereco: { logradouro: "Rua São Sebastião", numero: "1250", bairro: "Centro" },
    ...extra,
  }
}

describe("capitalizarNome", () => {
  it("uniformiza cadastro em caixa alta", () => {
    expect(capitalizarNome("RUA SAO SEBASTIAO")).toBe("Rua Sao Sebastiao")
  })
  it("uniformiza cadastro em caixa baixa mantendo acento", () => {
    expect(capitalizarNome("rua são sebastião")).toBe("Rua São Sebastião")
  })
  it("mantém conectivos em minúscula no meio", () => {
    expect(capitalizarNome("RUA DUQUE DE CAXIAS")).toBe("Rua Duque de Caxias")
  })
  it("nao rebaixa conectivo que abre o nome", () => {
    expect(capitalizarNome("da lapa")).toBe("Da Lapa")
  })
  it("mantém letra solta de bloco em maiúscula", () => {
    expect(capitalizarNome("bl. a")).toBe("Bl. A")
    expect(capitalizarNome("qd. e lote 3")).toBe("Qd. E Lote 3")
  })
  it("colapsa espaços repetidos e devolve vazio para vazio", () => {
    expect(capitalizarNome("  jardim   sumaré ")).toBe("Jardim Sumaré")
    expect(capitalizarNome("")).toBe("")
  })
})

describe("montarEnderecoCliente", () => {
  it("monta rua, número, bairro e complemento", () => {
    expect(
      montarEnderecoCliente({
        logradouro: "rua são sebastião",
        numero: "1250",
        bairro: "centro",
        complemento: "ap. 32 bl. b",
      }),
    ).toBe("Rua São Sebastião, 1250 - Centro - Ap. 32 Bl. B")
  })
  it("omite campos vazios sem deixar traço órfão", () => {
    expect(
      montarEnderecoCliente({ logradouro: "Av. Independência", numero: "88", bairro: "Jd. Sumaré" }),
    ).toBe("Av. Independência, 88 - Jd. Sumaré")
  })
  it("não deixa vírgula solta quando falta o número", () => {
    expect(montarEnderecoCliente({ logradouro: "Rua das Flores", bairro: "Centro" }))
      .toBe("Rua das Flores - Centro")
  })
  it("devolve vazio quando não há endereço nenhum", () => {
    expect(montarEnderecoCliente({})).toBe("")
  })
})

describe("abreviarEndereco", () => {
  it("encurta os termos longos", () => {
    expect(abreviarEndereco("Avenida Brasil, 100 - Jardim Paulista - Apartamento 4 Fundos"))
      .toBe("Av. Brasil, 100 - Jd. Paulista - Ap. 4 Fds.")
  })
})

describe("descreverProduto", () => {
  it("junta peça, cor e tamanho", () => {
    expect(descreverProduto({ nome: "Blusa Farm", cor: "azul", tamanho: "M" }))
      .toBe("Blusa Farm - azul M")
  })
  it("sai só com o nome quando não há cor nem tamanho", () => {
    expect(descreverProduto({ nome: "Vestido Longo" })).toBe("Vestido Longo")
  })
})

describe("contarLinhas", () => {
  it("texto curto ocupa uma linha", () => {
    expect(contarLinhas("Blusa Farm - azul", 33)).toBe(1)
  })
  it("texto longo quebra em duas", () => {
    expect(contarLinhas("Camisa de Linho Manga Longa - off white", 33)).toBe(2)
  })
  it("texto vazio ainda ocupa uma linha", () => {
    expect(contarLinhas("", 33)).toBe(1)
  })
})

describe("linhasDosProdutos", () => {
  it("conta as quebras, não os itens", () => {
    const produtos = [
      produto("Blusa Farm", "azul"),
      { nome: "Casaco Tricot Oversized Gola Alta", cor: "cinza claro" },
    ]
    expect(linhasDosProdutos(produtos, "duplo")).toBe(3)
  })
})

describe("encaixarEndereco", () => {
  it("mantém uma linha quando cabe", () => {
    const r = encaixarEndereco(sacola("12", 1), "duplo")
    expect(r.linhas).toBe(1)
    expect(r.texto).toBe("Rua São Sebastião, 1250 - Centro")
  })
  it("abrevia antes de deixar quebrar", () => {
    const longa = sacola("12", 1, {
      endereco: {
        logradouro: "Avenida Presidente Juscelino Kubitschek",
        numero: "1477",
        bairro: "Jardim Paulistano",
        complemento: "Apartamento 142 Bloco C",
      },
    })
    const r = encaixarEndereco(longa, "duplo")
    expect(r.texto).toContain("Av.")
    expect(r.texto).toContain("Jd.")
    expect(r.texto).toContain("Ap.")
  })
  it("nunca passa de duas linhas", () => {
    const enorme = sacola("12", 1, {
      endereco: {
        logradouro: "Avenida Doutor Professor Engenheiro Presidente da República",
        numero: "123456",
        bairro: "Residencial Condomínio dos Ipês Amarelos do Vale Verde",
        complemento: "Apartamento 1402 Bloco C Torre Norte Fundos",
      },
    })
    expect(encaixarEndereco(enorme, "duplo").linhas).toBeLessThanOrEqual(2)
  })
  it("retirada na loja dispensa o endereço", () => {
    const r = encaixarEndereco(sacola("12", 1, { retirada: true, endereco: {} }), "duplo")
    expect(r.texto).toBe("RETIRADA NA LOJA")
  })
})

describe("cabemJuntas", () => {
  it("empareelha duas sacolas pequenas", () => {
    expect(cabemJuntas(sacola("12", 7), sacola("13", 4))).toBe(true)
  })
  it("recusa quando a soma estoura a altura útil", () => {
    expect(cabemJuntas(sacola("12", 12), sacola("13", 12))).toBe(false)
  })
  it("recusa quando um bloco sozinho passa do limite por bloco", () => {
    const gorda = sacola("12", 14)
    expect(alturaBlocoMm(gorda, "duplo")).toBeGreaterThan(ALTURA_MAX_BLOCO_MM)
    expect(cabemJuntas(gorda, sacola("13", 1))).toBe(false)
  })
  it("o par nunca ultrapassa a altura útil da etiqueta", () => {
    const a = sacola("12", 7)
    const b = sacola("13", 4)
    expect(alturaBlocoMm(a, "duplo") + alturaBlocoMm(b, "duplo")).toBeLessThan(ALTURA_UTIL_MM)
  })
})

describe("excedeEtiquetaInteira", () => {
  it("sacola normal cabe", () => {
    expect(excedeEtiquetaInteira(sacola("12", 15))).toBe(false)
  })
  it("sacola gigante não cabe nem sozinha", () => {
    expect(excedeEtiquetaInteira(sacola("12", 40))).toBe(true)
  })
})

describe("montarEtiquetas", () => {
  it("empareelha sacolas pequenas em sequência", () => {
    const etiquetas = montarEtiquetas([sacola("12", 4), sacola("13", 4), sacola("14", 4), sacola("15", 4)])
    expect(etiquetas).toHaveLength(2)
    expect(etiquetas.every((e) => e.modo === "duplo")).toBe(true)
  })
  it("sobra ímpar sai sozinha na etiqueta inteira", () => {
    const etiquetas = montarEtiquetas([sacola("12", 4), sacola("13", 4), sacola("14", 4)])
    expect(etiquetas).toHaveLength(2)
    expect(etiquetas[1].modo).toBe("solo")
    expect(etiquetas[1].blocos[0].numeroSacola).toBe("14")
  })
  it("sacola grande vai sozinha e a seguinte tenta par com a próxima", () => {
    const etiquetas = montarEtiquetas([sacola("12", 14), sacola("13", 3), sacola("14", 3)])
    expect(etiquetas[0].modo).toBe("solo")
    expect(etiquetas[0].blocos[0].numeroSacola).toBe("12")
    expect(etiquetas[1].modo).toBe("duplo")
    expect(etiquetas[1].blocos.map((b) => b.numeroSacola)).toEqual(["13", "14"])
  })
  it("só empareelha números vizinhos, nunca salteados", () => {
    const etiquetas = montarEtiquetas([sacola("27", 3), sacola("12", 3), sacola("13", 3)])
    expect(etiquetas[0].blocos.map((b) => b.numeroSacola)).toEqual(["12", "13"])
    expect(etiquetas[1].blocos.map((b) => b.numeroSacola)).toEqual(["27"])
  })
  it("ordena pelo número da sacola, não pela ordem de chegada", () => {
    const etiquetas = montarEtiquetas([sacola("30", 3), sacola("9", 3)])
    expect(etiquetas[0].blocos[0].numeroSacola).toBe("9")
  })
  it("sacola sem número vai para o fim da fila", () => {
    const semNumero = sacola("0", 3, { numeroSacola: null, compraId: 99 })
    const etiquetas = montarEtiquetas([semNumero, sacola("5", 3)])
    expect(etiquetas[0].blocos[0].numeroSacola).toBe("5")
  })
  it("lote vazio não gera etiqueta", () => {
    expect(montarEtiquetas([])).toEqual([])
  })
  it("numera as etiquetas em sequência a partir de 1", () => {
    const etiquetas = montarEtiquetas([sacola("12", 3), sacola("13", 3), sacola("14", 14)])
    expect(etiquetas.map((e) => e.indice)).toEqual([1, 2])
  })
})

describe("resumirLote", () => {
  it("conta pares, sozinhas e economia", () => {
    const sacolas = [sacola("12", 4), sacola("13", 4), sacola("14", 14)]
    const resumo = resumirLote(montarEtiquetas(sacolas), sacolas)
    expect(resumo).toMatchObject({ sacolas: 3, etiquetas: 2, pares: 1, sozinhas: 1, economia: 1 })
  })
  it("sinaliza sacolas sem endereço", () => {
    const sacolas = [sacola("12", 4, { endereco: {} }), sacola("13", 4)]
    expect(resumirLote(montarEtiquetas(sacolas), sacolas).semEndereco).toBe(1)
  })
  it("retirada na loja não conta como sem endereço", () => {
    const sacolas = [sacola("12", 4, { endereco: {}, retirada: true })]
    expect(resumirLote(montarEtiquetas(sacolas), sacolas).semEndereco).toBe(0)
  })
})
