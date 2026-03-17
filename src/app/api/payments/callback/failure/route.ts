import { NextRequest, NextResponse } from 'next/server';
import { PaymentRedirectStatus } from '@/types/payments';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const externalReference = searchParams.get('external_reference') || '';
  const planId = externalReference.split('|')[1] || '';

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://agora.humanizar.cloud').replace(/\/+$/, '');
  const redirectUrl = new URL(`${appUrl}/dashboard`);
  redirectUrl.searchParams.set('payment', PaymentRedirectStatus.Failure);
  if (planId) redirectUrl.searchParams.set('plan', planId);

  return NextResponse.redirect(redirectUrl.toString());
}
