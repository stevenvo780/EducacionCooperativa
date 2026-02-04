import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getUserRole } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const role = await getUserRole(auth.uid);

    return NextResponse.json({
      uid: auth.uid,
      email: auth.email ?? null,
      role: role ?? 'user'
    });
  } catch (error: any) {
    console.error('Error fetching current user:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
