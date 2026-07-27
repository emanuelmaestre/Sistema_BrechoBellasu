import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

describe("contrato seguro do formulario de login", () => {
  it("usa POST no fallback HTML para nao expor credenciais na URL", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./page.tsx", import.meta.url)),
      "utf8"
    )

    expect(source).toMatch(/<form\s+method="post"\s+onSubmit=/)
  })
})
