'use client'

import { createContext, useContext, useRef, useState, useCallback, ReactNode } from 'react'

export type RecordingState = 'idle' | 'recording' | 'uploading' | 'done' | 'error'

export interface RecordingPatient {
  id: string
  name: string
}

interface RecordingContextValue {
  state: RecordingState
  patient: RecordingPatient | null
  duration: number
  errorMsg: string
  startRecording: (patient: RecordingPatient, providerId: string) => Promise<void>
  stopRecording: () => void
  dismiss: () => void
}

const RecordingContext = createContext<RecordingContextValue | null>(null)

export function useRecording() {
  const ctx = useContext(RecordingContext)
  if (!ctx) throw new Error('useRecording must be used inside RecordingProvider')
  return ctx
}

export function RecordingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RecordingState>('idle')
  const [patient, setPatient] = useState<RecordingPatient | null>(null)
  const [duration, setDuration] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const [providerIdRef] = useState<{ current: string }>({ current: '' })

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    setDuration(0)
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
  }, [])

  const upload = useCallback(async (pid: string, pName: string, mime: string) => {
    setState('uploading')
    try {
      const { supabase } = await import('@/lib/supabase-browser')

      const ext = mime.includes('ogg') ? 'ogg' : 'webm'
      const blob = new Blob(chunksRef.current, { type: mime })
      const filename = `ambient/${Date.now()}_${pid}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('recordings')
        .upload(filename, blob, { contentType: mime, upsert: false })

      if (uploadErr) throw uploadErr

      // API route downloads via service role and uploads to AssemblyAI directly
      const res = await fetch('/api/visits/ambient-recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: pid,
          providerId: providerIdRef.current,
          recordingStoragePath: filename,
        }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'Upload failed')
      }

      setState('done')
      // Auto-dismiss after 4 seconds
      setTimeout(() => setState('idle'), 4000)
    } catch (err: any) {
      console.error('[RecordingContext] upload error:', err)
      setErrorMsg(err.message || 'Upload failed')
      setState('error')
    }
  }, [providerIdRef])

  const startRecording = useCallback(async (p: RecordingPatient, pid: string) => {
    setErrorMsg('')
    setPatient(p)
    providerIdRef.current = pid

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

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

      recorder.start(1000)
      setState('recording')
      startTimer()
    } catch (err: any) {
      setErrorMsg('Microphone access denied. Please allow microphone access and try again.')
      setState('error')
      setPatient(null)
    }
  }, [startTimer, providerIdRef])

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current) return

    const mime = mediaRecorderRef.current.mimeType
    const pid = patient?.id || ''
    const pName = patient?.name || ''

    mediaRecorderRef.current.onstop = () => {
      stopTimer()
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      upload(pid, pName, mime)
    }

    mediaRecorderRef.current.stop()
  }, [patient, stopTimer, upload])

  const dismiss = useCallback(() => {
    stopTimer()
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setState('idle')
    setPatient(null)
    setDuration(0)
    setErrorMsg('')
    chunksRef.current = []
    mediaRecorderRef.current = null
  }, [stopTimer])

  return (
    <RecordingContext.Provider value={{ state, patient, duration, errorMsg, startRecording, stopRecording, dismiss }}>
      {children}
    </RecordingContext.Provider>
  )
}
