import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function PageShell({ children, title, backTo }) {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-md mx-auto px-4 py-12">
        {user && (
          <div className="flex items-center justify-between mb-6">
            <span className="text-sm text-stone-400 truncate">{user.email}</span>
            <button
              onClick={signOut}
              className="text-sm text-stone-400 hover:text-stone-600 transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
        {backTo && (
          <Link
            to={backTo}
            className="text-stone-400 hover:text-stone-600 transition-colors text-sm"
          >
            &larr; Back
          </Link>
        )}
        {title && (
          <h1 className="text-2xl font-bold text-stone-900 mt-4 mb-6">
            {title}
          </h1>
        )}
        {children}
      </div>
    </div>
  )
}

export default PageShell
