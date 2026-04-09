'use client'

import { useRecording } from '@/lib/recording-context'

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function RecordingBar() {
  const { state, patient, duration, errorMsg, stopRecording, dismiss } = useRecording()

  if (state === 'idle') return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div className="pointer-events-auto">

        {/* Recording active */}
        {state === 'recording' && (
          <div className="flex items-center gap-4 bg-aubergine text-white px-5 py-3 rounded-full shadow-xl shadow-aubergine/30">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
            <div className="flex items-center gap-2">
              <span className="text-sm font-sans font-semibold tabular-nums">
                {formatDuration(duration)}
              </span>
              {patient && (
                <>
                  <span className="text-white/30 text-sm">·</span>
                  <span className="text-sm font-sans text-white/70">{patient.name}</span>
                </>
              )}
            </div>
            <button
              onClick={stopRecording}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 transition-colors px-3 py-1.5 rounded-full text-xs font-sans font-semibold ml-1"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              Stop
            </button>
            <button
              onClick={dismiss}
              className="text-white/30 hover:text-white/60 transition-colors ml-1"
              aria-label="Cancel recording"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Uploading */}
        {state === 'uploading' && (
          <div className="flex items-center gap-3 bg-aubergine text-white px-5 py-3 rounded-full shadow-xl shadow-aubergine/30">
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin flex-shrink-0" />
            <span className="text-sm font-sans text-white/80">Processing recording…</span>
          </div>
        )}

        {/* Done */}
        {state === 'done' && (
          <div className="flex items-center gap-3 bg-emerald-700 text-white px-5 py-3 rounded-full shadow-xl shadow-emerald-900/30">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-sans font-semibold">Recording submitted</span>
            <span className="text-sm font-sans text-white/60">· SOAP note generating</span>
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div className="flex items-center gap-3 bg-red-700 text-white px-5 py-3 rounded-full shadow-xl shadow-red-900/30">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-sans text-white/90">{errorMsg || 'Recording failed'}</span>
            <button
              onClick={dismiss}
              className="text-white/50 hover:text-white transition-colors ml-2"
              aria-label="Dismiss"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
