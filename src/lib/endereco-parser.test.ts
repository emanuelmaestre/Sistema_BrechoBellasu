import { describe, it, expect } from "vitest"
import {
  parseBusca, faixaContemNumero, ordenarSugestoes,
  camposFaltantesEnvio, enderecoCompletoParaEnvio,
  type EnderecoSugestao,
} from "./endereco-parser"

describe("parseBusca", () => {
  it("reconhece CEP com e sem hífen", () => {
    expect(parseBusca("14085-520").cep).toBe("14085520")
    expect(parseBusca("14085520").cep).toBe("14085520")
    expect(parseBusca(" 14085 520 ").cep).toBe("14085520")
  })

  it("não confunde número de casa com CEP", () => {
    const r = parseBusca("Rua Ceará 1687")
    expect(r.cep).toBeNull()
    expect(r.numero).toBe("1687")
  })

  it("expande abreviações de logradouro", () => {
    expect(parseBusca("Av. Brasil 200").rua).toBe("Avenida Brasil")
    expect(parseBusca("R. Ceará 15").rua).toBe("Rua Ceará")
  })

  it("separa complemento antes de procurar o número", () => {
    const r = parseBusca("Rua Ceará 1687 casa 57")
    expect(r.numero).toBe("1687")
    expect(r.complemento.toLowerCase()).toContain("casa 57")
    expect(r.rua).toBe("Rua Ceará")
  })

  it("não pega o número do apartamento como número da casa", () => {
    const r = parseBusca("Av. Brasil 200 apto 3")
    expect(r.numero).toBe("200")
    expect(r.complemento.toLowerCase()).toContain("apto 3")
  })

  it("detecta cidade e UF depois da vírgula", () => {
    const r = parseBusca("Rua Ceará 1687, Ribeirão Preto SP")
    expect(r.uf).toBe("SP")
    expect(r.cidade).toBe("Ribeirão Preto")
    expect(r.rua).toBe("Rua Ceará")
  })

  it("remove o prefixo do tipo de logradouro para o ViaCEP", () => {
    expect(parseBusca("Avenida Independência 1500").ruaSemPrefixo).toBe("Independência")
    expect(parseBusca("Alameda Santos 10").ruaSemPrefixo).toBe("Santos")
  })

  it("não confunde ALAMEDA com a UF Alagoas", () => {
    expect(parseBusca("Alameda Santos 10").uf).toBeNull()
  })

  it("gera tokens normalizados sem acento para a busca no banco", () => {
    const r = parseBusca("Rua Ceará, Ribeirão Preto")
    expect(r.tokens).toContain("ceara")
    expect(r.tokens).toContain("ribeirao")
  })
})

describe("faixaContemNumero", () => {
  it("interpreta 'de X a Y'", () => {
    expect(faixaContemNumero("de 1048 a 1698 - lado par", 1200)).toBe(true)
    expect(faixaContemNumero("de 1048 a 1698 - lado par", 2000)).toBe(false)
  })

  it("respeita o lado par/ímpar", () => {
    expect(faixaContemNumero("de 1048 a 1698 - lado par", 1201)).toBe(false)
    expect(faixaContemNumero("de 1047 a 1865 - lado ímpar", 1201)).toBe(true)
  })

  it("interpreta 'até X'", () => {
    expect(faixaContemNumero("até 610 - lado par", 400)).toBe(true)
    expect(faixaContemNumero("até 610 - lado par", 800)).toBe(false)
  })

  it("interpreta 'de X ao fim'", () => {
    expect(faixaContemNumero("de 611 ao fim - lado ímpar", 999)).toBe(true)
    expect(faixaContemNumero("de 611 ao fim - lado ímpar", 101)).toBe(false)
  })

  it("entende os limites que o ViaCEP escreve como 'par/ímpar'", () => {
    // Formas reais devolvidas pelo ViaCEP na Avenida Independência.
    expect(faixaContemNumero("de 5000/5001 ao fim", 5200)).toBe(true)
    expect(faixaContemNumero("de 5000/5001 ao fim", 1500)).toBe(false)
    expect(faixaContemNumero("de 1200/1201 a 2158/2159", 2159)).toBe(true)
    expect(faixaContemNumero("de 1200/1201 a 2158/2159", 3000)).toBe(false)
    expect(faixaContemNumero("até 1198/1199", 1199)).toBe(true)
  })

  it("devolve null quando não dá para interpretar", () => {
    expect(faixaContemNumero("", 100)).toBeNull()
    expect(faixaContemNumero(null, 100)).toBeNull()
    expect(faixaContemNumero("Shopping Center", 100)).toBeNull()
    expect(faixaContemNumero("de 1 a 100", "abc")).toBeNull()
  })
})

describe("ordenarSugestoes", () => {
  const base = (over: Partial<EnderecoSugestao>): EnderecoSugestao => ({
    cep: "14085-520", logradouro: "Rua Ceará", bairro: "Jardim Irajá",
    cidade: "Ribeirão Preto", estado: "SP", fonte: "photon", ...over,
  })

  it("coloca endereço já cadastrado na frente", () => {
    const busca = parseBusca("Rua Ceará")
    const r = ordenarSugestoes(
      [base({ fonte: "photon" }), base({ fonte: "cadastro", bairro: "Centro", ocorrencias: 4 })],
      busca,
    )
    expect(r[0].fonte).toBe("cadastro")
  })

  it("remove duplicatas de rua+bairro+cidade", () => {
    const busca = parseBusca("Rua Ceará")
    const r = ordenarSugestoes([base({}), base({}), base({})], busca)
    expect(r).toHaveLength(1)
  })

  it("prioriza a cidade que a pessoa escreveu, sem privilegiar Ribeirão Preto", () => {
    const busca = parseBusca("Rua Sete de Setembro, Franca")
    const r = ordenarSugestoes([
      base({ logradouro: "Rua Sete de Setembro", cidade: "Ribeirão Preto", bairro: "Centro" }),
      base({ logradouro: "Rua Sete de Setembro", cidade: "Franca", bairro: "Centro" }),
    ], busca)
    expect(r[0].cidade).toBe("Franca")
  })

  it("descarta sugestões sem logradouro", () => {
    const busca = parseBusca("Rua Ceará")
    expect(ordenarSugestoes([base({ logradouro: "" })], busca)).toHaveLength(0)
  })
})

describe("camposFaltantesEnvio", () => {
  const completo = {
    cep: "14085-520", logradouro: "Rua Ceará", numero: "1687",
    bairro: "Jardim Irajá", cidade: "Ribeirão Preto", estado: "SP",
  }

  it("aceita endereço completo", () => {
    expect(camposFaltantesEnvio(completo)).toEqual([])
    expect(enderecoCompletoParaEnvio(completo)).toBe(true)
  })

  it("aponta o CEP quando está incompleto", () => {
    expect(camposFaltantesEnvio({ ...completo, cep: "1408" })).toContain("CEP")
  })

  it("aponta cada campo obrigatório que falta", () => {
    expect(camposFaltantesEnvio({ ...completo, numero: "" })).toEqual(["Número"])
    expect(camposFaltantesEnvio({ ...completo, cidade: null })).toEqual(["Cidade"])
    expect(camposFaltantesEnvio({})).toEqual(["CEP", "Logradouro", "Número", "Cidade", "Estado"])
  })
})
