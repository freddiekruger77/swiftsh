import type { AppProps } from 'next/app'
import { SessionProvider } from 'next-auth/react'
import '@/styles/globals.css'
import '@/styles/responsive.css'
import '@/styles/mobile.css'

export default function App({ 
  Component, 
  pageProps: { session, ...pageProps } 
}: AppProps) {
  return (
    <SessionProvider session={session}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div id="app-root">
        <Component {...pageProps} />
      </div>
    </SessionProvider>
  )
}