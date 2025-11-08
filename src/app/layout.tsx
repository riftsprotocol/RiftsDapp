import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap', // Optimize font loading
  preload: true
})

export const metadata: Metadata = {
  title: 'RIFTS Protocol - Advanced Volatility Farming',
  description: 'Revolutionary DeFi protocol for volatility farming with advanced risk management and automated yield optimization.',
  icons: {
    icon: '/PFP3.png',
    shortcut: '/PFP3.png',
    apple: '/PFP3.png',
  },
  openGraph: {
    title: 'RIFTS Protocol - Advanced Volatility Farming',
    description: 'Revolutionary DeFi protocol for volatility farming with advanced risk management and automated yield optimization.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}