import { useState } from "react"

// Mockup: Patient dashboard left column after care plan is ready
// Replaces the intake status tracker with an actions panel

const actions = [
  {
    label: "Schedule Appointment",
    subtitle: "Book your next visit",
    icon: "calendar",
    color: "#944fed",
    bg: "rgba(148, 79, 237, 0.08)",
  },
  {
    label: "View Health Blueprint",
    subtitle: "Prepared by Dr. Urban",
    icon: "blueprint",
    color: "#944fed",
    bg: "rgba(148, 79, 237, 0.08)",
  },
  {
    label: "Request Rx Refill",
    subtitle: "Submit a refill request",
    icon: "pill",
    color: "#4ECDC4",
    bg: "rgba(78, 205, 196, 0.08)",
  },
  {
    label: "Message Dr. Urban",
    subtitle: "Send a secure message",
    icon: "message",
    color: "#4ECDC4",
    bg: "rgba(78, 205, 196, 0.08)",
  },
  {
    label: "Billing & Membership",
    subtitle: "Active \u00b7 $200/mo",
    icon: "billing",
    color: "#422a1f",
    bg: "rgba(40, 15, 73, 0.04)",
  },
]

const icons = {
  calendar: (color) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  blueprint: (color) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  ),
  pill: (color) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-6 18.75h9" />
      <path d="M9.75 7.5h4.5M9.75 12h4.5M9.75 16.5h4.5" />
    </svg>
  ),
  message: (color) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  ),
  billing: (color) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
}

export default function DashboardActionsMockup() {
  const [hovered, setHovered] = useState(null)

  return (
    <div
      style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        backgroundColor: "#f7f3ee",
        minHeight: "100vh",
        padding: "32px",
        display: "flex",
        gap: 24,
      }}
    >
      {/* LEFT COLUMN — Actions */}
      <div style={{ width: 300, flexShrink: 0 }}>
        {/* Quick Actions card */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 1px 3px rgba(40, 15, 73, 0.04)",
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              color: "rgba(40, 15, 73, 0.45)",
              marginTop: 0,
              marginBottom: 20,
            }}
          >
            Quick Actions
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {actions.map((action, i) => (
              <button
                key={i}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "none",
                  backgroundColor: hovered === i ? "rgba(148, 79, 237, 0.04)" : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                  transition: "background-color 0.15s ease",
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    backgroundColor: action.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {icons[action.icon](action.color)}
                </div>

                {/* Label + subtitle */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#280f49",
                      margin: 0,
                      lineHeight: 1.3,
                    }}
                  >
                    {action.label}
                  </p>
                  <p
                    style={{
                      fontSize: 12,
                      color: "rgba(40, 15, 73, 0.38)",
                      margin: 0,
                      marginTop: 1,
                    }}
                  >
                    {action.subtitle}
                  </p>
                </div>

                {/* Chevron */}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={hovered === i ? "#944fed" : "rgba(40, 15, 73, 0.18)"}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flexShrink: 0, transition: "stroke 0.15s ease" }}
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            ))}
          </div>
        </div>

        {/* Membership status — compact, below actions */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 16,
            padding: "16px 24px",
            marginTop: 12,
            boxShadow: "0 1px 3px rgba(40, 15, 73, 0.04)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#280f49", margin: 0 }}>
              Membership
            </p>
            <p style={{ fontSize: 11, color: "rgba(40, 15, 73, 0.35)", margin: 0, marginTop: 2 }}>
              Renews May 4, 2026
            </p>
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#4ECDC4",
              backgroundColor: "rgba(78, 205, 196, 0.08)",
              border: "1px solid rgba(78, 205, 196, 0.2)",
              borderRadius: 99,
              padding: "4px 10px",
            }}
          >
            Active
          </span>
        </div>
      </div>

      {/* RIGHT COLUMN — placeholder for content */}
      <div style={{ flex: 1 }}>
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 16,
            padding: 32,
            boxShadow: "0 1px 3px rgba(40, 15, 73, 0.04)",
            minHeight: 400,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <p style={{ fontSize: 14, color: "rgba(40, 15, 73, 0.25)" }}>
            Right column: Intake Summary, Upcoming Appointments, etc.
          </p>
        </div>
      </div>
    </div>
  )
}
