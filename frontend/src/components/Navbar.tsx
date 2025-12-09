import { Link, useLocation } from 'react-router-dom'
import { ThemeToggle } from './ThemeToggle'
import { Map, Book, Users, Route, Shield } from 'lucide-react'
import clsx from 'clsx'

export default function Navbar() {
  const location = useLocation()

  const navItems = [
    { path: '/', label: 'Map', icon: Map },
    { path: '/trips', label: 'Trips', icon: Route },
    { path: '/journal', label: 'Journal', icon: Book },
    { path: '/community', label: 'Community', icon: Users },
  ]

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm dark:bg-navy-800 dark:border-navy-700 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <Link to="/" className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-primary-600" />
            <span className="text-xl font-bold text-gray-900">SafeRoute</span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={clsx(
                    'flex items-center space-x-2 px-4 py-2 rounded-lg transition-all',
                    isActive
                      ? 'bg-primary-50 text-primary-700 font-medium dark:bg-navy-900 dark:text-primary-400'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-navy-700 dark:hover:text-white'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              )
            })}
            <div className="pl-2 border-l border-gray-200 dark:border-navy-700 ml-2">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
