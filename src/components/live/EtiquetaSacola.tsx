"use client"

// ══════════════════════════════════════════════════════════════════
// A etiqueta física — 100 × 147 mm na BY-480BT (203 dpi).
//
// Tudo aqui é medido em MILÍMETROS, não em pixels: o que está na tela
// é o que sai no papel. Nada de classe do Tailwind no miolo da
// etiqueta, porque `rem` muda com a preferência de fonte do navegador
// e a etiqueta não pode mudar de tamanho por causa disso.
//
// Quando cabem duas sacolas, a etiqueta é cortada na tracejada e cada
// metade vira uma etiqueta independente. Por isso cada BLOCO repete o
// remetente da loja: a metade de cima não pode sair sem ele.
// ══════════════════════════════════════════════════════════════════

import {
  ETIQUETA_MM,
  MARGEM_MM,
  RESERVA_MM,
  encaixarEndereco,
  descreverProduto,
  type EtiquetaMontada,
  type ModoEtiqueta,
  type SacolaEtiqueta,
} from "@/lib/etiqueta-sacola"

export interface LojaEtiqueta {
  nome: string
  logradouro?: string
  numero?: string
  bairro?: string
  cidade?: string
  estado?: string
}

/** Cidade abreviada para caber junto com o resto do remetente. */
function abreviarCidade(cidade: string): string {
  return cidade.replace(/\bRibeirão\b/i, "Rib.").replace(/\bSão\b/i, "S.")
}

/** Remetente numa linha: nome da loja, rua, número, bairro, cidade - UF. */
function linhaLoja(loja: LojaEtiqueta): string {
  const rua = [loja.logradouro, loja.numero].filter(Boolean).join(", ")
  const cidadeUf = [abreviarCidade(loja.cidade ?? ""), loja.estado].filter(Boolean).join(" - ")
  return [rua, loja.bairro, cidadeUf].filter(Boolean).join(" - ")
}

const mm = (v: number) => `${v}mm`

// ─── Um bloco = uma sacola ───────────────────────────────────────

function Bloco({
  sacola,
  loja,
  modo,
  preencher,
}: {
  sacola: SacolaEtiqueta
  loja: LojaEtiqueta
  modo: ModoEtiqueta
  /** Bloco que fica com a sobra de altura da etiqueta. */
  preencher: boolean
}) {
  const duplo = modo === "duplo"
  const endereco = encaixarEndereco(sacola, modo)
  const totalItens = sacola.produtos.reduce((s, p) => s + (p.quantidade ?? 1), 0)

  const dataLive = sacola.dataLive
    ? new Date(`${sacola.dataLive}T00:00:00`).toLocaleDateString("pt-BR")
    : null

  const meta = [
    sacola.instagram,
    dataLive ? `Live ${dataLive}` : null,
    `${totalItens} ${totalItens === 1 ? "item" : "itens"}`,
  ].filter(Boolean).join(" · ")

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: preencher ? 1 : undefined, minHeight: 0 }}>
      {/* ── ZONA 1 · IDENTIFICAÇÃO ── */}
      <div style={{ display: "flex", alignItems: "stretch", gap: mm(2.5) }}>
        <div style={{
          background: "#000", color: "#fff", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: `${mm(0.8)} ${mm(2)} ${mm(1.2)}`,
          minWidth: mm(duplo ? 15 : 21),
        }}>
          <span style={{
            fontSize: mm(duplo ? 2.4 : 3), fontWeight: 600, letterSpacing: ".22em",
            lineHeight: 1, textIndent: ".22em", textTransform: "uppercase",
          }}>Sacola</span>
          <span style={{
            fontSize: mm(duplo ? 10.5 : 17), fontWeight: 700, lineHeight: .86, letterSpacing: "-.03em",
          }}>{sacola.numeroSacola ?? "—"}</span>
        </div>

        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          justifyContent: "center", minWidth: 0,
        }}>
          <div style={{
            fontWeight: 700, textTransform: "uppercase", lineHeight: 1.12,
            letterSpacing: "-.015em", fontSize: mm(duplo ? 3.9 : 4.7),
          }}>{sacola.nomeCliente}</div>
          <div style={{ fontSize: mm(duplo ? 2.6 : 2.9), marginTop: mm(.4), lineHeight: 1.32 }}>
            {meta}
          </div>
          <div style={{
            fontWeight: 700, fontSize: mm(duplo ? 2.8 : 3.1), marginTop: mm(.6),
            lineHeight: 1.18, maxWidth: `calc(100% - ${mm(RESERVA_MM)})`,
          }}>{endereco.texto}</div>
        </div>
      </div>

      <hr style={{ border: 0, borderTop: `${mm(.35)} solid #000`, margin: `${mm(1.6)} 0 ${mm(1.4)}` }}/>

      {/* ── ZONA 2 · CONFERÊNCIA ── */}
      {/* Maiúsculo sem negrito: a 203 dpi o negrito em caixa alta fecha */}
      {/* os vãos das letras e vira uma mancha preta. */}
      <table style={{
        width: "100%", borderCollapse: "collapse", textTransform: "uppercase",
        letterSpacing: "-.005em",
        fontSize: mm(duplo ? 3.05 : 3.4), lineHeight: mm(duplo ? 4.2 : 5.1),
      }}>
        <tbody>
          {sacola.produtos.map((p, i) => (
            <tr key={i}>
              <td style={{ padding: 0, verticalAlign: "top", width: mm(7), fontWeight: 700 }}>
                {p.quantidade ?? 1}x
              </td>
              <td style={{ padding: 0, verticalAlign: "top", fontWeight: 400 }}>
                {descreverProduto(p)}
              </td>
              <td style={{
                padding: 0, verticalAlign: "top", width: mm(19), textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}>
                {(p.preco ?? 0).toFixed(2).replace(".", ",")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ flex: 1 }}/>

      {/* ── ZONA 3 · VALOR ── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        fontWeight: 700, textTransform: "uppercase", letterSpacing: ".02em",
        borderTop: `${mm(.35)} solid #000`, paddingTop: mm(1.2), marginTop: mm(1.2),
        fontSize: mm(duplo ? 3.9 : 4.6),
      }}>
        <span>Total</span>
        {/* Sacola quitada com crédito não pode sair com valor: cobraria de
            novo quem já pagou com o saldo dela. */}
        <span>
          {sacola.pagoComCredito
            ? "Pago com crédito"
            : `R$ ${sacola.total.toFixed(2).replace(".", ",")}`}
        </span>
      </div>

      {/* ── ZONA 4 · REMETENTE ── */}
      {/* A régua grossa separa o que é da cliente do que é da loja. */}
      <div style={{
        borderTop: `${mm(.5)} solid #000`, paddingTop: mm(1.1), marginTop: mm(1.3),
      }}>
        <div style={{
          fontSize: mm(duplo ? 2.5 : 2.9), lineHeight: 1.15, textAlign: "center",
          whiteSpace: "nowrap", overflow: "hidden",
          maxWidth: `calc(100% - ${mm(RESERVA_MM)})`, margin: "0 auto",
        }}>
          <b>{loja.nome}</b>{loja.logradouro ? ` - ${linhaLoja(loja)}` : ""}
        </div>
      </div>
    </div>
  )
}

// ─── A etiqueta inteira ──────────────────────────────────────────

export default function EtiquetaSacola({
  etiqueta,
  loja,
  mostrarGuia = false,
}: {
  etiqueta: EtiquetaMontada
  loja: LojaEtiqueta
  mostrarGuia?: boolean
}) {
  const duplo = etiqueta.modo === "duplo"

  return (
    <div
      data-etiqueta={etiqueta.indice}
      className="etiqueta-folha"
      style={{
        width: mm(ETIQUETA_MM.largura),
        height: mm(ETIQUETA_MM.altura),
        padding: mm(MARGEM_MM),
        background: "#fff",
        color: "#000",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        fontFamily: "var(--font-inter), Inter, Helvetica, Arial, sans-serif",
        // A etiqueta é impressa — nunca herda o tema escuro da interface.
        colorScheme: "light",
      }}
    >
      {mostrarGuia && (
        <div style={{
          position: "absolute", inset: mm(2), border: `${mm(.2)} dashed #c00`,
          pointerEvents: "none",
        }}/>
      )}

      {etiqueta.blocos.map((sacola, i) => (
        <div
          key={sacola.compraId}
          style={{
            display: "flex", flexDirection: "column",
            // O bloco de cima ocupa só o que precisa; o de baixo fica com
            // a sobra. É o que faz o corte cair onde a divisão realmente
            // é, em vez de sempre no meio da etiqueta.
            flex: duplo ? (i === 0 ? "0 0 auto" : "1 1 auto") : 1,
            minHeight: 0,
          }}
        >
          {i > 0 && (
            <div style={{
              position: "relative", height: mm(6), display: "flex",
              alignItems: "center", justifyContent: "flex-end", flex: "0 0 auto",
              marginBottom: mm(1),
            }}>
              <div style={{
                position: "absolute", left: 0, right: 0, top: "50%",
                borderTop: `${mm(.4)} dashed #000`,
              }}/>
              <span style={{ position: "relative", background: "#fff", padding: `0 ${mm(1.5)}`, fontSize: mm(3.4) }}>
                &#9986;
              </span>
            </div>
          )}
          <Bloco sacola={sacola} loja={loja} modo={etiqueta.modo} preencher={!duplo || i === 1}/>
        </div>
      ))}
    </div>
  )
}
