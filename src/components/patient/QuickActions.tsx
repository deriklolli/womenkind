'use client'

export type DashboardView = 'dashboard' | 'schedule' | 'blueprint' | 'refill' | 'message' | 'billing' | 'intake-summary' | 'wearables' | 'settings' | 'lab-results' | 'scorecard'

interface QuickActionsProps {
  presentationId?: string | null
  activeView?: DashboardView
  onSelectView?: (view: DashboardView) => void
}

interface ActionItem {
  key: DashboardView
  label: string
  subtitle: string
  icon: string
  color: string
  bg: string
}

const primaryActions: ActionItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    subtitle: 'Overview & summary',
    icon: 'home',
    color: '#280f49',
    bg: 'rgba(40, 15, 73, 0.06)',
  },
  {
    key: 'scorecard',
    label: 'Score Tracker',
    subtitle: 'Your health score',
    icon: 'scorecard',
    color: '#944fed',
    bg: 'rgba(148, 79, 237, 0.08)',
  },
  {
    key: 'schedule',
    label: 'Schedule Appointment',
    subtitle: 'Book your next visit',
    icon: 'calendar',
    color: '#944fed',
    bg: 'rgba(148, 79, 237, 0.08)',
  },
  {
    key: 'refill',
    label: 'Request Rx Refill',
    subtitle: 'Submit a refill request',
    icon: 'pill',
    color: '#944fed',
    bg: 'rgba(148, 79, 237, 0.08)',
  },
  {
    key: 'message',
    label: 'Message Dr. Urban',
    subtitle: 'Send a secure message',
    icon: 'message',
    color: '#944fed',
    bg: 'rgba(148, 79, 237, 0.08)',
  },
]

const secondaryActions: ActionItem[] = [
  {
    key: 'scorecard',
    label: 'My WMI Score',
    subtitle: 'WomenKind Menopause Index',
    icon: 'scorecard',
    color: '#4ECDC4',
    bg: 'rgba(78, 205, 196, 0.08)',
  },
  {
    key: 'wearables',
    label: 'Health Trends',
    subtitle: 'Oura Ring biometrics',
    icon: 'wearable',
    color: '#4ECDC4',
    bg: 'rgba(78, 205, 196, 0.08)',
  },
  {
    key: 'blueprint',
    label: 'Your Health Blueprint',
    subtitle: 'Prepared by Dr. Urban',
    icon: 'blueprint',
    color: '#4ECDC4',
    bg: 'rgba(78, 205, 196, 0.08)',
  },
  {
    key: 'lab-results',
    label: 'Your Lab Results',
    subtitle: 'Blood work & diagnostics',
    icon: 'lab',
    color: '#4ECDC4',
    bg: 'rgba(78, 205, 196, 0.08)',
  },
  {
    key: 'intake-summary',
    label: 'Your Intake Summary',
    subtitle: 'Your responses & results',
    icon: 'clipboard',
    color: '#4ECDC4',
    bg: 'rgba(78, 205, 196, 0.08)',
  },
]

function ActionIcon({ type, color }: { type: string; color: string }) {
  const props = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  switch (type) {
    case 'home':
      return (
        <svg {...props}>
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      )
    case 'scorecard':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      )
    case 'calendar':
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      )
    case 'blueprint':
      return (
        <svg {...props}>
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        </svg>
      )
    case 'clipboard':
      return (
        <svg {...props}>
          <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        </svg>
      )
    case 'pill':
      return (
        <svg {...props}>
          <path d="M8.5 8.5l7 7" />
          <path d="M3.636 15.364a5 5 0 010-7.071l4.95-4.95a5 5 0 017.07 7.07l-4.95 4.95a5 5 0 01-7.07 0z" />
        </svg>
      )
    case 'message':
      return (
        <svg {...props}>
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      )
    case 'billing':
      return (
        <svg {...props}>
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      )
    case 'lab':
      return (
        <svg {...props}>
          <path d="M9 3h6v5.586a1 1 0 00.293.707l3.414 3.414a3 3 0 01.879 2.121V17a4 4 0 01-4 4H8.414a4 4 0 01-4-4v-2.172a3 3 0 01.879-2.121l3.414-3.414A1 1 0 009 8.586V3z" />
          <line x1="9" y1="3" x2="15" y2="3" />
          <line x1="10" y1="12" x2="14" y2="12" />
        </svg>
      )
    case 'wearable':
      return (
        <svg {...props}>
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      )
    case 'scorecard':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
        </svg>
      )
    default:
      return null
  }
}

function ActionButton({ action, isActive, onSelect, teal, alwaysColorIcon }: { action: ActionItem; isActive: boolean; onSelect: () => void; teal?: boolean; alwaysColorIcon?: boolean }) {
  const activeColor = teal ? '#4ECDC4' : '#944fed'
  const activeBg = teal ? 'bg-[#4ECDC4]/[0.06]' : 'bg-violet/[0.06]'
  const hoverBg = teal ? 'hover:bg-[#4ECDC4]/[0.03]' : 'hover:bg-violet/[0.03]'
  const showColorIcon = isActive || alwaysColorIcon

  return (
    <button
      onClick={onSelect}
      className={`flex items-center gap-3 px-3 py-3 rounded-xl text-left w-full
                 transition-colors duration-150 group
                 ${isActive ? activeBg : hoverBg}`}
    >
      <div
        className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: showColorIcon ? `${activeColor}20` : action.bg }}
      >
        <ActionIcon type={action.icon} color={showColorIcon ? activeColor : action.color} />
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-sans leading-tight ${isActive ? (teal ? 'font-medium text-[#4ECDC4]' : 'font-medium text-violet') : 'font-normal text-aubergine'}`}>
          {action.label}
        </p>
        <p className="text-xs font-sans text-aubergine/38 mt-0.5">
          {action.subtitle}
        </p>
      </div>

      {isActive ? (
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: activeColor }} />
      ) : (
        <svg
          className="w-3.5 h-3.5 flex-shrink-0 text-aubergine/18 group-hover:text-aubergine/30 transition-colors duration-150"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      )}
    </button>
  )
}

export default function QuickActions({ presentationId, activeView = 'dashboard', onSelectView }: QuickActionsProps) {
  return (
    <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-6">
      <div className="flex flex-col gap-1">
        {primaryActions.map((action) => (
          <ActionButton
            key={action.key}
            action={action}
            isActive={activeView === action.key}
            alwaysColorIcon={action.key === 'dashboard'}
            onSelect={() => onSelectView?.(action.key)}
          />
        ))}
      </div>
    </div>
  )
}

export function SecondaryActions({ presentationId, activeView = 'dashboard', onSelectView }: QuickActionsProps) {
  return (
    <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-6">
      <div className="flex flex-col gap-1">
        {secondaryActions.map((action) => (
          <ActionButton
            key={action.key}
            action={action}
            isActive={activeView === action.key}
            onSelect={() => onSelectView?.(action.key)}
            teal
          />
        ))}
      </div>
    </div>
  )
}
