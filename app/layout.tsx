import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/toaster'
import Providers from '@/components/providers'
import './globals.css'
import faviconPng from '../Adler Capital_.png'

export const metadata: Metadata = {
  title: 'Adler Capital CRM',
  description: 'Customer Relationship Management System',
  generator: 'v0.dev',
  icons: {
    icon: [{ url: (faviconPng as any).src }],
    apple: [{ url: (faviconPng as any).src }],
    shortcut: [{ url: (faviconPng as any).src }],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href={(faviconPng as any).src} />
      </head>
      <body>
        <Providers>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster />
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  )
}
