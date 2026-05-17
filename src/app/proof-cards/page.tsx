import type { Metadata } from 'next';
import CardsView from '@/components/proof-cards/CardsView';

export const metadata: Metadata = {
  title: 'Proof Obligations — Agora',
  description:
    'Tablero de obligations de un documento: claims, premisas y teoremas con su estado individual (verified, pending, failed, unknown), pruebas paso a paso y contraejemplos.',
  alternates: { canonical: '/proof-cards' },
  openGraph: {
    title: 'Proof Obligations — Agora',
    description:
      'Estado individual por claim con prueba o contraejemplo. Filtrado por estado y búsqueda de texto.',
    url: '/proof-cards'
  },
  robots: { index: true, follow: true }
};

export default function ProofCardsPage() {
  return <CardsView />;
}
