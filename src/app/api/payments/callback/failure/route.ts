import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const externalReference = searchParams.get('external_reference') || '';
  const planId = externalReference.split('|')[1] || '';

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://visormarkdown-virid.vercel.app').replace(/\/+$/, '');
  const redirectUrl = new URL(`${appUrl}/dashboard`);
  redirectUrl.searchParams.set('payment', 'failure');
  if (planId) redirectUrl.searchParams.set('plan', planId);

  return NextResponse.redirect(redirectUrl.toString());
}
