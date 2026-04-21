'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase-browser'

interface Patient {
  id: string
  name: string
}

interface Props {
  providerId: string
}

type RecorderState = 'idle' | 'selecting' | 'ready' | 'recording' | 'uploading' | 'done' | 'error'

export default function AmbientRecorder({ providerId }: Props) {
  const [state, setState] = useState<RecorderState>('idle')
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [duration, setDuration] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const [noteId, setNoteId] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load patients for provider
  useEffect(() => {
    if (state === 'selecting') {
      loadPatients()
    }
  }, [state])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer()
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  const loadPatients = async () => {
    try {
      const res = await fetch('/api/provider/ambient-roster')
      if (!res.ok) return
      const { roster } = await res.json()
      const list: Patient[] = (roster || []).map(
        (r: { patientId: string; patientName: string }) => ({
          id: r.patientId,
          name: r.patientName,
        })
      )
      setPatients(list)
    } catch (err) {
      console.error('[AmbientRecorder] loadPatients error:', err)
    }
  }

  const startTimer = () => {
    setDuration(0)
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
  }

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const handleStartRecording = async () => {
    if (!selectedPatient) return
    setErrorMsg('')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Pick best supported format
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.start(1000) // collect chunks every second
      setState('recording')
      startTimer()
    } catch (err: any) {
      setErrorMsg('Microphone access denied. Please allow microphone access and try again.')
      setState('error')
    }
  }

  const handleStopRecording = () => {
    if (!mediaRecorderRef.current) return

    mediaRecorderRef.current.onstop = async () => {
      stopTimer()
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      await uploadRecording()
    }

    mediaRecorderRef.current.stop()
  }

  const uploadRecording = async () => {
    if (!selectedPatient) return
    setState('uploading')

    try {
      const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm'
      const ext = mimeType.includes('ogg') ? 'ogg' : 'webm'
      const blob = new Blob(chunksRef.current, { type: mimeType })
      const filename = `ambient/${Date.now()}_${selectedPatient.id}.${ext}`

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('recordings')
        .upload(filename, blob, { contentType: mimeType, upsert: false })

      if (uploadErr) throw uploadErr

      // Create encounter note + trigger transcription via API.
      // The server generates its own short-lived signed URL using the service role —
      // no need to create one client-side.
      const res = await fetch('/api/visits/ambient-recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatient.id,
          providerId,
          recordingStoragePath: filename,
        }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'Upload failed')
      }

      const { noteId: id } = await res.json()
      setNoteId(id)
      setState('done')
    } catch (err: any) {
      console.error('[AmbientRecorder] upload error:', err)
      setErrorMsg(err.message || 'Upload failed. Please try again.')
      setState('error')
    }
  }

  const handleReset = () => {
    setState('idle')
    setSelectedPatient(null)
    setSearchQuery('')
    setDuration(0)
    setNoteId(null)
    setErrorMsg('')
    chunksRef.current = []
    mediaRecorderRef.current = null
  }

  const filteredPatients = patients.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  if (state === 'idle') {
    return (
      <button
        onClick={() => setState('selecting')}
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-brand bg-white border border-aubergine/15 text-sm font-sans font-semibold text-aubergine hover:border-violet/30 hover:text-violet transition-all shadow-sm"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
        Record in-office visit
      </button>
    )
  }

  return (
    <div className="bg-white rounded-card border border-aubergine/10 shadow-sm p-5 w-full max-w-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-sans font-semibold text-aubergine">Ambient Recording</h3>
        {state !== 'recording' && state !== 'uploading' && (
          <button
            onClick={handleReset}
            className="text-aubergine/30 hover:text-aubergine/60 transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Patient selection */}
      {(state === 'selecting' || state === 'ready') && (
        <div className="space-y-3">
          <p className="text-xs font-sans text-aubergine/50">Select patient for this visit</p>
          <input
            type="text"
            placeholder="Search patients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 text-sm font-sans bg-cream border border-aubergine/15 rounded-brand focus:outline-none focus:border-violet/40 text-aubergine placeholder:text-aubergine/30"
          />
          <div className="max-h-40 overflow-y-auto space-y-1">
            {filteredPatients.length === 0 ? (
              <p className="text-xs font-sans text-aubergine/30 py-2 text-center">
                {patients.length === 0 ? 'Loading...' : 'No patients found'}
              </p>
            ) : (
              filteredPatients.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedPatient(p)
                    setState('ready')
                  }}
                  className={`w-full text-left px-3 py-2 rounded-brand text-sm font-sans transition-all ${
                    selectedPatient?.id === p.id
                      ? 'bg-violet/10 text-violet font-semibold'
                      : 'text-aubergine/70 hover:bg-aubergine/5'
                  }`}
                >
                  {p.name}
                </button>
              ))
            )}
          </div>

          {state === 'ready' && selectedPatient && (
            <button
              onClick={handleStartRecording}
              className="w-full py-2.5 rounded-brand bg-violet text-white text-sm font-sans font-semibold hover:bg-violet-dark transition-colors flex items-center justify-center gap-2 mt-2"
            >
              <span className="w-2 h-2 rounded-full bg-white/70 animate-pulse" />
              Start Recording
            </button>
          )}
        </div>
      )}

      {/* Active recording */}
      {state === 'recording' && (
        <div className="space-y-4">
          <div className="text-center py-3">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-sans font-semibold text-red-500 uppercase tracking-wide">Recording</span>
            </div>
            <p className="text-3xl font-sans font-semibold text-aubergine tabular-nums">
              {formatDuration(duration)}
            </p>
            {selectedPatient && (
              <p className="text-xs font-sans text-aubergine/40 mt-1">{selectedPatient.name}</p>
            )}
          </div>
          <button
            onClick={handleStopRecording}
            className="w-full py-2.5 rounded-brand bg-aubergine text-white text-sm font-sans font-semibold hover:bg-aubergine/90 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            Stop & Process
          </button>
          <p className="text-xs font-sans text-aubergine/30 text-center">
            Recording will be transcribed and converted to a SOAP note
          </p>
        </div>
      )}

      {/* Uploading */}
      {state === 'uploading' && (
        <div className="text-center py-4 space-y-3">
          <div className="w-8 h-8 border-2 border-violet/20 border-t-violet rounded-full animate-spin mx-auto" />
          <p className="text-sm font-sans text-aubergine/60">Uploading recording…</p>
          <p className="text-xs font-sans text-aubergine/30">This will take a moment</p>
        </div>
      )}

      {/* Done */}
      {state === 'done' && (
        <div className="text-center py-2 space-y-3">
          <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-sans font-semibold text-aubergine">Recording submitted</p>
            <p className="text-xs font-sans text-aubergine/50 mt-1">
              Transcription is in progress. You'll receive an email when the SOAP note is ready to review.
            </p>
          </div>
          <button
            onClick={handleReset}
            className="w-full py-2 rounded-brand border border-aubergine/15 text-sm font-sans text-aubergine/60 hover:text-aubergine hover:border-aubergine/30 transition-all"
          >
            Record another visit
          </button>
        </div>
      )}

      {/* Error */}
      {state === 'error' && (
        <div className="space-y-3">
          <div className="bg-red-50 border border-red-200 rounded-brand p-3">
            <p className="text-xs font-sans text-red-600">{errorMsg || 'Something went wrong.'}</p>
          </div>
          <button
            onClick={handleReset}
            className="w-full py-2 rounded-brand border border-aubergine/15 text-sm font-sans text-aubergine/60 hover:text-aubergine transition-all"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
