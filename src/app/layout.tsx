import type { Metadata, Viewport } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
  weight: ['400', '600', '700'],
})

export const metadata: Metadata = {
  title: 'Payana Mitra — Your Travel Companion',
  description:
    'A digital travel companion for Payana Trails guests. View your itinerary, trip contacts, and stay connected throughout your journey.',
  applicationName: 'Payana Mitra',
  authors: [{ name: 'Payana Trails' }],
  keywords: ['travel', 'itinerary', 'Payana Trails', 'companion'],
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0f172a',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-screen font-[var(--font-inter)]">{children}</body>
    </html>
  )
}
