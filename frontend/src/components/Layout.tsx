import { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const isGuardianPage = location.pathname.startsWith('/guardian')

  if (isGuardianPage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-navy-900 dark:to-navy-950 transition-colors duration-300">
        {children}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-navy-900 dark:to-navy-950 transition-colors duration-300">
      <main>{children}</main>
    </div>
  )
}

