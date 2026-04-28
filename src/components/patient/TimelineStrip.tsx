'use client'

export type TimelineMarker = {
  id: string
  label: string
  date: Date | string
  status: 'past' | 'current' | 'scheduled'
  note?: string
}

interface Props {
  markers: TimelineMarker[]
}

export default function TimelineStrip({ markers }: Props) {
  if (markers.length === 0) return null
  return (
    <div className="bg-white rounded-card shadow-sm border border-aubergine/5 p-6">
      <h3 className="font-serif text-xl text-aubergine mb-5">Your <span className="italic text-violet">journey</span></h3>
      <div className="relative flex items-center justify-between gap-2 overflow-x-auto">
        <div className="absolute left-0 right-0 top-1/2 h-px bg-aubergine/10 -z-0" />
        {markers.map(m => {
          const styles =
            m.status === 'current'
              ? 'bg-violet text-white border border-violet'
              : m.status === 'scheduled'
              ? 'bg-white text-aubergine/60 border border-dashed border-aubergine/30'
              : 'bg-white text-aubergine/50 border border-aubergine/10'
          return (
            <div key={m.id} className="relative z-10 flex flex-col items-center min-w-[110px]">
              <div className={`px-3 py-1.5 rounded-pill text-xs font-sans font-medium ${styles}`} title={`${new Date(m.date).toLocaleDateString()}${m.note ? ' — ' + m.note : ''}`}>
                {m.label}
              </div>
              <div className="font-sans text-[10px] text-aubergine/40 mt-1.5">
                {new Date(m.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
