// Sidebar navigation and topbar for the EcoDistrict dashboard layout.
import { useState, useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { apiUrl } from '../services/api'
import {
  Home,
  ScanLine,
  Map,
  BarChart2,
  LayoutDashboard,
  Leaf,
  Menu,
  X,
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/',          label: 'Home',               icon: Home },
  { to: '/scan',      label: 'Scan Waste',          icon: ScanLine },
  { to: '/map',       label: 'Waste Map',           icon: Map },
  { to: '/impact',    label: 'My Impact',           icon: BarChart2 },
  { to: '/district',  label: 'District Dashboard',  icon: LayoutDashboard },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen]   = useState(false)
  const [apiStatus, setApiStatus]       = useState('checking') // checking | ok | error

  useEffect(() => {
    let cancelled = false
    fetch(apiUrl('/api/health'))
      .then(r => { if (!cancelled) setApiStatus(r.ok ? 'ok' : 'error') })
      .catch(() => { if (!cancelled) setApiStatus('error') })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {/* ── Mobile overlay ─────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-white border-r border-slate-200
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:flex
        `}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-100">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-green-600 text-white">
            <Leaf size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 leading-tight">EcoDistrict</p>
            <p className="text-xs text-slate-400">SDG 12 · Waste Platform</p>
          </div>
          {/* Close button (mobile) */}
          <button
            className="ml-auto text-slate-400 hover:text-slate-600 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                 ${isActive
                   ? 'bg-green-50 text-green-700'
                   : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                 }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Phase badge */}
        <div className="px-5 py-4 border-t border-slate-100">
          <span className="inline-block px-2 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
            Phase 1 — Live
          </span>
          <p className="mt-1 text-xs text-slate-400">Identify · Dispose · Track</p>
        </div>
      </aside>

      {/* ── Main area ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center gap-4 px-5 py-3 bg-white border-b border-slate-200 shadow-sm">
          <button
            className="text-slate-500 hover:text-slate-700 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={22} />
          </button>
          <p className="text-sm font-semibold text-slate-700">
            Intelligent District Waste Management Platform
          </p>
          <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
            <span
              className={`w-2 h-2 rounded-full inline-block ${
                apiStatus === 'ok'       ? 'bg-green-500' :
                apiStatus === 'error'    ? 'bg-red-400'   :
                                          'bg-slate-300 animate-pulse'
              }`}
            />
            {apiStatus === 'ok'      ? 'API connected' :
             apiStatus === 'error'   ? 'API offline'   :
                                       'Checking API…'}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
