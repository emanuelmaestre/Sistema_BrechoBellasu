import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { detectAllowedMedia } from "@/lib/campanha-seguranca"
import { withAdminAuth } from "@/lib/with-auth"
import { getClientIp, rateLimit } from "@/lib/rateLimit"

const MAX_BYTES = 16 * 1024 * 1024

export const POST = withAdminAuth(async (req: NextRequest, _ctx, auth) => {
  const limit = rateLimit(
    `campaign-upload:${auth.id}:${getClientIp(req)}`,
    10,
    60 * 60_000
  )
  if (!limit.ok) {
    return NextResponse.json(
      { erro: "Limite de uploads atingido. Aguarde antes de tentar novamente." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    )
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0)
  if (contentLength > MAX_BYTES + 1024 * 1024) {
    return NextResponse.json(
      { erro: "Arquivo maior que o limite de 16 MB." },
      { status: 413 }
    )
  }

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json({ erro: "Nenhum arquivo enviado." }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { erro: "Arquivo maior que o limite de 16 MB." },
        { status: 413 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const detected = detectAllowedMedia(buffer)
    if (!detected) {
      return NextResponse.json(
        {
          erro: "Conteudo invalido. Envie JPG, PNG, WebP, GIF, MP4, MOV ou WebM.",
        },
        { status: 400 }
      )
    }

    const nome = `campanha_${randomUUID()}.${detected.extension}`
    const sb = createServerClient()
    const { error } = await sb.storage.from("campanhas").upload(nome, buffer, {
      contentType: detected.mime,
      upsert: false,
    })
    if (error) {
      console.error("[campaign-upload] Falha no Storage:", error.message)
      return NextResponse.json({ erro: "Falha ao armazenar a midia." }, { status: 500 })
    }

    const { data: urlData } = sb.storage.from("campanhas").getPublicUrl(nome)
    return NextResponse.json({
      url: urlData.publicUrl,
      tipo: detected.type,
      nome,
    })
  } catch (error) {
    console.error("[campaign-upload] Falha ao processar arquivo:", error)
    return NextResponse.json(
      { erro: "Erro interno ao processar o arquivo." },
      { status: 500 }
    )
  }
})
