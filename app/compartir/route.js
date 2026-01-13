import { NextResponse } from 'next/server'

export async function POST(request) {
  // Redirigir a la página de compartir
  // Los archivos se manejarán del lado del cliente
  return NextResponse.redirect(new URL('/compartir', request.url))
}

export async function GET(request) {
  return NextResponse.redirect(new URL('/compartir', request.url))
}
