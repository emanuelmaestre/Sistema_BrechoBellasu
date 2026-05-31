import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { rateLimit, getClientIp } from "@/lib/rateLimit"
import { AUTH_COOKIE } from "@/lib/auth"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"

const SETE_DIAS = 60 * 60 * 24 * 7

export async function POST(req: NextRequest) {
  try {
    // Rate limit: máx 10 tentativas por IP a cada 5 min (anti brute-force)
    const ip = getClientIp(req)
    const rl = rateLimit(`login:${ip}`, 10, 5 * 60_000)
    if (!rl.ok) {
      return NextResponse.json(
        { erro: `Muitas tentativas. Tente novamente em ${rl.retryAfter}s.` },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      )
    }

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

    const secret = process.env.JWT_SECRET
    if (!secret) {
      console.error("[POST /api/auth/login] JWT_SECRET não configurado")
      return NextResponse.json({ erro: "Erro de configuração do servidor." }, { status: 500 })
    }
    const token = jwt.sign(
      { id: usuario.id, perfil: usuario.perfil },
      secret,
      { expiresIn: "7d" }
    )

    // Token vai em cookie HttpOnly — nunca exposto ao JS do browser (anti-XSS).
    const res = NextResponse.json({
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
      },
    })
    res.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SETE_DIAS,
    })
    return res
  } catch (err) {
    console.error("[POST /api/auth/login]", err)
    return NextResponse.json({ erro: "Erro interno." }, { status: 500 })
  }
}
