import { Link } from 'react-router-dom'

function PageShell({ children, title, backTo }) {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-md mx-auto px-4 py-12">
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
