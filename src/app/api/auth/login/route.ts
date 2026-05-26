import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"

export async function POST(req: NextRequest) {
  try {
    const { email, senha } = await req.json()

    if (!email || !senha) {
      return NextResponse.json({ erro: "E-mail e senha obrigatórios." }, { status: 400 })
    }

    const sb = createServerClient()

    const { data: usuario, error } = await sb
      .from("usuarios")
      .select("id, nome, email, senha, perfil, ativo")
      .eq("email", email.toLowerCase().trim())
      .single()

    if (error || !usuario) {
      return NextResponse.json({ erro: "E-mail ou senha incorretos." }, { status: 401 })
    }

    if (!usuario.ativo) {
      return NextResponse.json({ erro: "Usuário inativo. Entre em contato com o administrador." }, { status: 403 })
    }

    const senhaOk = await bcrypt.compare(senha, usuario.senha)
    if (!senhaOk) {
      return NextResponse.json({ erro: "E-mail ou senha incorretos." }, { status: 401 })
    }

    const secret = process.env.JWT_SECRET ?? "brecho-secret-dev"
    const token = jwt.sign(
      { id: usuario.id, perfil: usuario.perfil },
      secret,
      { expiresIn: "7d" }
    )

    return NextResponse.json({
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
      },
    })
  } catch (err) {
    console.error("[POST /api/auth/login]", err)
    return NextResponse.json({ erro: "Erro interno." }, { status: 500 })
  }
}
