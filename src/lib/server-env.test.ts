import { afterEach, describe, expect, it } from "vitest"
import { readIntEnv } from "./server-env"

const originalValue = process.env.TEST_INT_ENV

afterEach(() => {
  if (originalValue === undefined) {
    delete process.env.TEST_INT_ENV
  } else {
    process.env.TEST_INT_ENV = originalValue
  }
})

describe("readIntEnv", () => {
  it("retorna fallback quando a variavel nao existe", () => {
    delete process.env.TEST_INT_ENV

    expect(readIntEnv("TEST_INT_ENV", 10, 1, 100)).toBe(10)
  })

  it("retorna fallback quando o valor nao e numerico", () => {
    process.env.TEST_INT_ENV = "abc"

    expect(readIntEnv("TEST_INT_ENV", 10, 1, 100)).toBe(10)
  })

  it("arredonda para baixo valores decimais", () => {
    process.env.TEST_INT_ENV = "12.9"

    expect(readIntEnv("TEST_INT_ENV", 10, 1, 100)).toBe(12)
  })

  it("limita o valor pelo minimo e maximo", () => {
    process.env.TEST_INT_ENV = "-5"
    expect(readIntEnv("TEST_INT_ENV", 10, 1, 100)).toBe(1)

    process.env.TEST_INT_ENV = "150"
    expect(readIntEnv("TEST_INT_ENV", 10, 1, 100)).toBe(100)
  })
})
