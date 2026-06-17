import { useEffect, useRef, useState } from 'react'

export function WorkCapture({
  onChange
}: {
  onChange: (captured: boolean) => void
}): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function start(): Promise<void> {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 } },
          audio: false
        })
        if (!active) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Camera unavailable')
      }
    }

    start()
    return () => {
      active = false
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function capture(): void {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    setPhoto(canvas.toDataURL('image/jpeg', 0.85))
    onChange(true)
  }

  function retake(): void {
    setPhoto(null)
    onChange(false)
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/60">
        {error ? (
          <div className="px-6 text-center text-sm text-red-400/80">
            {error}
            <p className="mt-1 text-xs text-[#c4c7c8]/50">
              Check the document camera and grant camera access.
            </p>
          </div>
        ) : photo ? (
          <img src={photo} alt="Captured work" className="h-full w-full object-contain" />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
        )}
        {!photo && !error && (
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[10px] uppercase tracking-widest text-white/80">
            <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
            Live
          </span>
        )}
      </div>

      {photo ? (
        <div className="mt-4 flex gap-3">
          <button
            onClick={retake}
            className="flex-1 rounded-xl border border-white/10 py-3 text-sm text-[#c4c7c8] transition hover:bg-white/5"
          >
            Retake
          </button>
          <button
            disabled
            className="flex-1 rounded-xl bg-emerald-500/15 py-3 text-sm font-semibold text-emerald-400"
          >
            ✓ Captured
          </button>
        </div>
      ) : (
        <button
          onClick={capture}
          disabled={!!error}
          className="mt-4 rounded-xl bg-white py-3 text-sm font-semibold text-[#16181a] transition hover:opacity-90 active:scale-[0.99] disabled:opacity-40"
        >
          Capture photo of your work
        </button>
      )}
    </div>
  )
}
