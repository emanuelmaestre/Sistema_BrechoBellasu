import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

const MAX_BYTES = 16 * 1024 * 1024 // 16 MB
const ALLOWED_MIME = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "video/mp4", "video/quicktime", "video/webm",
]

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ erro: "Nenhum arquivo enviado." }, { status: 400 })

    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json({ erro: `Tipo não suportado: ${file.type}. Envie JPG, PNG, WebP, GIF, MP4, MOV ou WebM.` }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1)
      return NextResponse.json({ erro: `Arquivo muito grande: ${mb} MB. O limite é 16 MB.` }, { status: 400 })
    }

    const tipo = file.type.startsWith("video/") ? "video" : "imagem"
    const ext  = file.name.split(".").pop() ?? (tipo === "video" ? "mp4" : "jpg")
    const nome = `campanha_${Date.now()}.${ext}`

    const sb = createServerClient()
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error } = await sb.storage.from("campanhas").upload(nome, buffer, {
      contentType: file.type,
      upsert: false,
    })
    if (error) return NextResponse.json({ erro: `Falha no upload: ${error.message}` }, { status: 500 })

    const { data: urlData } = sb.storage.from("campanhas").getPublicUrl(nome)
    return NextResponse.json({ url: urlData.publicUrl, tipo, nome })
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : "Erro interno." }, { status: 500 })
  }
}
