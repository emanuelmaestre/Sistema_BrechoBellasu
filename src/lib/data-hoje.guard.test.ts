import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

/**
 * Guarda de arquitetura para o bug das datas da live.
 *
 * Duas formas de errar, as duas já aconteceram em produção:
 *  1. `new Date().toISOString().split("T")[0]` devolve a data em UTC. No
 *     Brasil, das 21h à meia-noite isso já é o dia seguinte — e a live
 *     acontece justamente à noite.
 *  2. Guardar essa data numa CONSTANTE de módulo congela o valor no
 *     carregamento da página. Como o sistema roda como PWA que fica dias
 *     aberto, três lives criadas em dias diferentes nasceram todas com a
 *     mesma data.
 *
 * O jeito certo é chamar `hojeISO()` na hora em que a data é necessária.
 */
function fontes(dir = "src"): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) return fontes(caminho)
    if (!/\.tsx?$/.test(entrada.name)) return []
    // utils.ts documenta o padrão errado; testes citam o padrão errado.
    if (entrada.name === "utils.ts" || entrada.name.includes(".test.")) return []
    return [caminho]
  })
}

const ARQUIVOS = fontes()

describe("guarda contra data de hoje em UTC", () => {
  it("varre o código-fonte de verdade", () => {
    expect(ARQUIVOS.length).toBeGreaterThan(100)
  })

  it("ninguém calcula a data de hoje direto do toISOString", () => {
    const culpados = ARQUIVOS.filter((arquivo) =>
      /new Date\(\)\s*\.toISOString\(\)\s*\.split\("T"\)\[0\]/.test(readFileSync(arquivo, "utf8")),
    )
    expect(culpados, "use hojeISO() de @/lib/utils nestes arquivos").toEqual([])
  })

  it("ninguém guarda a data de hoje numa constante de módulo", () => {
    const culpados = ARQUIVOS.filter((arquivo) =>
      /^const\s+\w*[Hh]oje\w*\s*=/m.test(readFileSync(arquivo, "utf8")),
    )
    expect(culpados, "hoje precisa ser calculado a cada uso, não no load do módulo").toEqual([])
  })
})
