import { describe, expect, it } from "vitest";
import {
  isValidCpfCnpj,
  isValidEmail,
  normalizeBirthDate,
  onlyDigits,
  roundMoney,
} from "./photo-import-validation";

describe("photo import validation", () => {
  it("normaliza apenas dígitos", () => {
    expect(onlyDigits("+55 (16) 99123-4567")).toBe("5516991234567");
    expect(onlyDigits("--")).toBeNull();
  });

  it("valida CPF e CNPJ pelos dígitos verificadores", () => {
    expect(isValidCpfCnpj("529.982.247-25")).toBe(true);
    expect(isValidCpfCnpj("04.252.011/0001-10")).toBe(true);
    expect(isValidCpfCnpj("111.111.111-11")).toBe(false);
    expect(isValidCpfCnpj("529.982.247-24")).toBe(false);
  });

  it("aceita somente datas reais, passadas e plausíveis", () => {
    expect(normalizeBirthDate("15/03/1990")).toBe("1990-03-15");
    expect(normalizeBirthDate("31/02/1990")).toBeNull();
    expect(normalizeBirthDate("1899-12-31")).toBeNull();
  });

  it("valida e-mail e arredonda valores monetários", () => {
    expect(isValidEmail("ana@example.com")).toBe(true);
    expect(isValidEmail("ana@com")).toBe(false);
    expect(roundMoney(10.1 + 20.2)).toBe(30.3);
  });
});
