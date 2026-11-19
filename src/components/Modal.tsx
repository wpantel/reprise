import { useEffect, useRef, type ReactNode } from 'react'

const SHAPES = {
  /** Right-hand panel on desktop, full screen on a phone. */
  panel: 'inset-y-0 right-0 left-auto h-dvh max-h-none w-full max-w-none md:max-w-md md:border-l',
  /** Covers the whole screen, for reading from the music stand. */
  full: 'inset-0 h-dvh max-h-none w-screen max-w-none',
  center: 'inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[min(38rem,calc(100vw-2rem))] rounded-2xl border',
}

export function Modal({
  label,
  shape,
  onClose,
  children,
}: {
  label: string
  shape: keyof typeof SHAPES
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose() // click on the backdrop
      }}
      className={`fixed m-0 border-line bg-card p-0 text-ink shadow-card backdrop:bg-ebony/40 ${SHAPES[shape]}`}
    >
      <div className="flex h-full max-h-[inherit] flex-col overflow-y-auto overscroll-contain">{children}</div>
    </dialog>
  )
}
