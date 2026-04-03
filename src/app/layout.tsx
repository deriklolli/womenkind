import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Womenkind | Menopause Care, Redefined',
  description:
    'Expert-led, telehealth-first menopause care. Personalized treatment plans powered by AI-driven intake and board-certified providers.',
  openGraph: {
    title: 'Womenkind | Menopause Care, Redefined',
    description:
      'Expert-led, telehealth-first menopause care. Personalized treatment plans powered by AI-driven intake and board-certified providers.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white">{children}</body>
    </html>
  )
}
