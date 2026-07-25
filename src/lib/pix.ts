// Gerador de payload PIX BR Code (EMV QR Code) — estático
// Especificação: Manual de Padrões para Iniciação do Pix — BCB
// Chave tipo telefone: formato E.164 obrigatório (+5511999990000)

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

// Remove acentos e caracteres não-ASCII de forma segura
function sanitizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, "")
}

export interface PixParams {
  chave:       string   // telefone E.164 (+5511999990000), CPF, CNPJ, email ou chave aleatória
  nome:        string   // nome do recebedor (máx 25 chars)
  cidade:      string   // cidade do recebedor (máx 15 chars)
  valor?:      number   // valor em reais (omitir = cliente digita)
  descricao?:  string   // ignorado — mantido por compatibilidade de assinatura
  txid?:       string   // referência opcional (máx 25 chars, alfanumérico sem espaços)
}

/**
 * Gera o payload EMV de um QR Code PIX ESTÁTICO, compatível com todos os bancos.
 * Estrutura enxuta (só GUI + chave no merchant) para máxima aceitação — bancos
 * como Nubank/Itaú rejeitam campos opcionais mal formados (erro 2056).
 */
export function gerarPixPayload(p: PixParams): string {
  const gui      = campo("00", "br.gov.bcb.pix")
  const chave    = campo("01", p.chave.trim())
  const merchant = campo("26", gui + chave)

  const nome     = (sanitizar(p.nome).slice(0, 25).trim()) || "PIX"
  const cidade   = (sanitizar(p.cidade).slice(0, 15).trim()) || "BRASIL"
  const txidVal  = (p.txid ?? "***").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***"
  const adicional = campo("62", campo("05", txidVal))

  const payload =
    campo("00", "01")          +   // Payload Format Indicator
    campo("01", "11")          +   // Point of Initiation = estático (reutilizável)
    merchant                   +
    campo("52", "0000")        +   // Merchant Category Code
    campo("53", "986")         +   // Moeda = BRL
    (p.valor !== undefined && p.valor > 0
      ? campo("54", p.valor.toFixed(2))
      : "")                    +
    campo("58", "BR")          +   // País
    campo("59", nome)          +   // Nome do recebedor
    campo("60", cidade)        +   // Cidade do recebedor
    adicional                  +
    "6304"                         // ID + len do CRC (valor calculado a seguir)

  return payload + crc16(payload)
}
