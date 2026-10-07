import { Link, useLocation } from 'react-router-dom'

export default function NotFound() {
  const location = useLocation()
  return (
    <div data-testid="not-found">
      <h1>Page not found</h1>
      <p>
        No page at <code>{location.pathname}</code>.
      </p>
      <Link to="/">Back to all pages</Link>
    </div>
  )
}
