// Barrel da camada compartilhada do domínio.
export { type Result, ok, err, primeiroErro } from "./result"
export { DomainError, ValidacaoError, type ErrorKind } from "./domain-error"
export { Money } from "./money"
export { Quantidade } from "./quantidade"
export { CpfCnpj } from "./cpf-cnpj"
export { Email } from "./email"
