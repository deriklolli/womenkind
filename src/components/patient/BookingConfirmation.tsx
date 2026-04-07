'use client'

interface AppointmentType {
  id: string
  name: string
  description: string | null
  duration_minutes: number
  price_cents: number
  color: string
}

interface TimeSlot {
  start: string
  end: string
}

interface Props {
  appointmentType: AppointmentType
  slot: TimeSlot
  isMember: boolean
  patientNotes: string
  onNotesChange: (notes: string) => void
  onBook: () => void
  booking: boolean
}

export default function BookingConfirmation({
  appointmentType,
  slot,
  isMember,
  patientNotes,
  onNotesChange,
  onBook,
  booking,
}: Props) {
  const startDate = new Date(slot.start)
  const endDate = new Date(slot.end)

  return (
    <div>
      <h1 className="font-sans font-semibold text-2xl md:text-3xl text-aubergine mb-2 text-center">Confirm Your Appointment</h1>
      <p className="text-sm font-sans text-aubergine/40 mb-6 text-center">
        Review the details below and confirm your booking.
      </p>

      <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-6 max-w-lg mx-auto">
        {/* Appointment details */}
        <div className="mb-5 pb-5 border-b border-aubergine/5">
          <h3 className="text-base font-sans font-semibold text-aubergine">
            {appointmentType.name}
          </h3>
          <p className="text-sm font-sans text-aubergine/50 mt-0.5">
            with Dr. Joseph Urban Jr.
          </p>
        </div>

        {/* Date & time */}
        <div className="space-y-3 mb-5 pb-5 border-b border-aubergine/5">
          <div className="flex items-center gap-3">
            <svg className="w-4 h-4 text-aubergine/30 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-sans text-aubergine">
              {startDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <svg className="w-4 h-4 text-aubergine/30 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-sans text-aubergine">
              {startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              {' – '}
              {endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              <span className="text-aubergine/40"> ({appointmentType.duration_minutes} min)</span>
            </span>
          </div>
        </div>

        {/* Reason for visit */}
        <div className="mb-5">
          <label className="block text-xs font-sans font-medium text-aubergine/60 mb-1.5">
            Reason for visit <span className="text-aubergine/30">(optional)</span>
          </label>
          <textarea
            value={patientNotes}
            onChange={e => onNotesChange(e.target.value)}
            placeholder="Let Dr. Urban know what you'd like to discuss..."
            rows={3}
            className="w-full px-3 py-2 text-sm font-sans border border-aubergine/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet/30 focus:border-violet text-aubergine resize-none placeholder:text-aubergine/25"
          />
        </div>

        {/* Price summary */}
        <div className="flex items-center justify-between mb-5 pb-5 border-b border-aubergine/5">
          <span className="text-sm font-sans text-aubergine/60">Total</span>
          {isMember ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-sans text-aubergine/30 line-through">
                ${(appointmentType.price_cents / 100).toFixed(0)}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded-pill text-xs font-sans font-medium text-emerald-600">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Free with membership
              </span>
            </div>
          ) : (
            <span className="text-lg font-sans font-bold text-aubergine">
              ${(appointmentType.price_cents / 100).toFixed(0)}
            </span>
          )}
        </div>

        {/* Book button */}
        <button
          onClick={onBook}
          disabled={booking}
          className="w-full py-3 text-sm font-sans font-semibold text-white bg-violet rounded-pill hover:bg-violet/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {booking ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </>
          ) : isMember ? (
            'Book Appointment'
          ) : (
            <>
              Proceed to Payment
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>

        {!isMember && (
          <p className="text-[10px] font-sans text-aubergine/30 text-center mt-2.5">
            You&apos;ll be redirected to secure checkout powered by Stripe
          </p>
        )}
      </div>
    </div>
  )
}
