import { NextResponse } from 'next/server';

/**
 * GET /api/agora-ai/config — endpoint retirado.
 * La configuración del agente IA se sirve desde AgoraBack vía /api/agora-ai/models.
 * Este handler devuelve 410 Gone para que el cliente no reintente.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'gone', message: 'Este endpoint fue retirado. Usa /api/agora-ai/models.' },
    { status: 410 }
  );
}
