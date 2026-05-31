// Barrel do domínio de Produtos.
export { Produto, type ProdutoInput } from "./produto"
export { calcularNovoEstoque, type OperacaoEstoque } from "./estoque"
export { EstoqueNegativoError, ProdutoNaoEncontradoError } from "./errors"
