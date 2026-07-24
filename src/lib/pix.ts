// Gerador de payload PIX BR Code (EMV QR Code)
// Especificação: https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II_ManualdePadroesparaIniciacaodoPix.pdf

function campo(id: string, valor: string): string {
  const len = valor.length.toString().padStart(2, "0")
  return `${id}${len}${valor}`
}

function crc16(str: string): string {
  let crc = 0xffff
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
      crc &= 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0")
}

export interface PixParams {
  chave:       string   // telefone, CPF, CNPJ, email ou chave aleatória
  nome:        string   // nome do recebedor (máx 25 chars)
  cidade:      string   // cidade do recebedor (máx 15 chars)
  valor?:      number   // valor em reais (omitir = cliente digita)
  descricao?:  string   // mensagem opcional (máx 72 chars)
  txid?:       string   // referência opcional (máx 25 chars, sem espaços)
}

/** Gera o payload EMV PIX compatível com todos os bancos brasileiros */
export function gerarPixPayload(p: PixParams): string {
  const gui      = campo("00", "br.gov.bcb.pix")
  const chave    = campo("01", p.chave)
  const desc     = p.descricao ? campo("02", p.descricao.slice(0, 72)) : ""
  const merchant = campo("26", gui + chave + desc)

  const nome     = p.nome.slice(0, 25).normalize("NFD").replace(/[̀-ͯ]/g, "")
  const cidade   = p.cidade.slice(0, 15).normalize("NFD").replace(/[̀-ͯ]/g, "")
  const txid     = campo("05", (p.txid ?? "***").replace(/\s/g, "").slice(0, 25))
  const adicional = campo("62", txid)

  let payload =
    campo("00", "01")          +   // Payload Format Indicator
    campo("01", "12")          +   // Point of Initiation = estático reutilizável
    merchant                   +
    campo("52", "0000")        +   // MCC
    campo("53", "986")         +   // Moeda = BRL
    (p.valor !== undefined && p.valor > 0
      ? campo("54", p.valor.toFixed(2))
      : "")                    +
    campo("58", "BR")          +   // País
    campo("59", nome)          +
    campo("60", cidade)        +
    adicional                  +
    "6304"                         // ID + len do CRC (valor calculado a seguir)

  return payload + crc16(payload)
}
