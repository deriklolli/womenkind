import { useState } from "react"

// Mockup: Compact "quick actions" row for presentation + scheduling
// These replace the large hero cards once the user has:
//   - Viewed their blueprint presentation
//   - Booked at least one appointment

export default function CompactCardsMockup() {
  const [presentationViewed] = useState(true)
  const [hasAppointment] = useState(true)

  return (
    <div
      style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        backgroundColor: "#f7f3ee",
        minHeight: "100vh",
        padding: "32px",
      }}
    >
      {/* Label */}
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.15em",
          color: "rgba(40, 15, 73, 0.45)",
          marginBottom: 16,
        }}
      >
        Current layout (large cards) stays when NOT yet interacted
      </p>

      {/* Spacer */}
      <div style={{ height: 32 }} />

      {/* ===== COMPACT TREATMENT (after interaction) ===== */}
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.15em",
          color: "rgba(40, 15, 73, 0.45)",
          marginBottom: 16,
        }}
      >
        Compact treatment (after viewing blueprint / booking appointment)
      </p>

      <div style={{ display: "flex", gap: 12, maxWidth: 720 }}>
        {/* Compact Blueprint Card */}
        <div
          style={{
            flex: 1,
            backgroundColor: "#ffffff",
            borderRadius: 16,
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            border: "1px solid rgba(40, 15, 73, 0.06)",
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Icon */}
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: "rgba(148, 79, 237, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#944fed"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
              </svg>
            </div>
            <div>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#280f49",
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                Your Health Blueprint
              </p>
              <p
                style={{
                  fontSize: 12,
                  color: "rgba(40, 15, 73, 0.4)",
                  margin: 0,
                  marginTop: 2,
                }}
              >
                Prepared by Dr. Urban
              </p>
            </div>
          </div>
          {/* Arrow */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(40, 15, 73, 0.25)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>

        {/* Compact Appointment Card */}
        <div
          style={{
            flex: 1,
            backgroundColor: "#ffffff",
            borderRadius: 16,
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            border: "1px solid rgba(40, 15, 73, 0.06)",
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Icon */}
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: "rgba(78, 205, 196, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#4ECDC4"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#280f49",
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                Next Appointment
              </p>
              <p
                style={{
                  fontSize: 12,
                  color: "rgba(40, 15, 73, 0.4)",
                  margin: 0,
                  marginTop: 2,
                }}
              >
                Tue, Apr 14 at 2:00 PM
              </p>
            </div>
          </div>
          {/* Arrow */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(40, 15, 73, 0.25)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </div>

      {/* Spacer + note */}
      <div style={{ height: 24 }} />
      <p
        style={{
          fontSize: 12,
          color: "rgba(40, 15, 73, 0.35)",
          maxWidth: 600,
          lineHeight: 1.6,
        }}
      >
        Two compact cards sit side-by-side at the top of the right column.
        Each has a subtle icon, title, subtitle (doctor name or next appointment
        date/time), and a chevron. They stay accessible but don't dominate.
        The large hero versions still show for first-time interactions.
      </p>
    </div>
  )
}
