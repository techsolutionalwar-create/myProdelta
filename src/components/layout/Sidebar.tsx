import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Code2,
  Wallet,
  ScrollText,
  Settings as SettingsIcon,
  Zap,
} from 'lucide-react'
import clsx from 'clsx'
import { useAppStore } from '@/lib/store'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/editor', label: 'Indicator Editor', icon: Code2 },
  { to: '/positions', label: 'Positions', icon: Wallet },
  { to: '/trade-log', label: 'Trade Log', icon: ScrollText },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

export default function Sidebar() {
  const connectionStatus = useAppStore((s) => s.connectionStatus)

  return (
    <aside className="flex h-full w-60 flex-col border-r border-base-border bg-base-panel">
      <div className="flex items-center gap-2.5 border-b border-base-border px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan/10 ring-1 ring-cyan/30">
          <Zap size={16} className="text-cyan" strokeWidth={2.5} />
        </div>
        <div>
          <div className="font-display text-[15px] font-semibold leading-tight text-ink">Delta Quant</div>
          <div className="text-[11px] leading-tight text-ink-faint">Custom Indicator Bot</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors',
                isActive
                  ? 'bg-cyan/10 text-cyan shadow-glow-sm ring-1 ring-cyan/20'
                  : 'text-ink-dim hover:bg-base-raised hover:text-ink'
              )
            }
            end={to === '/'}
          >
            <Icon size={16} strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-base-border px-4 py-4">
        <div className="flex items-center gap-2 rounded-lg bg-base-raised px-3 py-2.5">
          <span
            className={clsx(
              'h-2 w-2 rounded-full',
              connectionStatus === 'connected' && 'bg-bull animate-pulse-dot',
              connectionStatus === 'error' && 'bg-bear',
              connectionStatus === 'unconfigured' && 'bg-ink-faint'
            )}
          />
          <span className="text-[12px] font-medium text-ink-dim">
            {connectionStatus === 'connected' && 'API Connected'}
            {connectionStatus === 'error' && 'Connection Error'}
            {connectionStatus === 'unconfigured' && 'Not Configured'}
          </span>
        </div>
      </div>
    </aside>
  )
}
