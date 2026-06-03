import { NextResponse } from "next/server"

/** 200 (or custom status) JSON success response */
export function createSuccessResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status })
}

/** 500 (or custom status) JSON error response with `erro` key */
export function createErrorResponse(message: string, status = 500): NextResponse {
  return NextResponse.json({ erro: message }, { status })
}

/** 404 JSON response */
export function createNotFoundResponse(entity = "Registro"): NextResponse {
  return NextResponse.json({ erro: `${entity} não encontrado.` }, { status: 404 })
}

/** 401 JSON response */
export function createUnauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { erro: "Você precisa estar logado para realizar esta ação." },
    { status: 401 }
  )
}

/** 400 JSON validation error response */
export function createValidationErrorResponse(message: string): NextResponse {
  return NextResponse.json({ erro: message }, { status: 400 })
}
