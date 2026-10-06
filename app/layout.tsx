import type { ReactNode } from 'react'
import './styles.css'

export const metadata = {
  title: 'ALTIV DEV',
  description: 'AI-native website builder, editor and deploy platform.'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="pt-BR"><body>{children}</body></html>
}
