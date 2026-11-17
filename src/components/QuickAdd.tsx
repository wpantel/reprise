import { useState, type FormEvent, type Ref } from 'react'

export function QuickAdd({ inputRef, onAdd }: { inputRef: Ref<HTMLInputElement>; onAdd: (title: string) => Promise<void> }) {
  const [value, setValue] = useState('')
  // Titles whose save failed, kept here so nothing typed is lost.
  const [failed, setFailed] = useState<string[]>([])

  function save(title: string) {
    onAdd(title).catch(() => setFailed((f) => [...f, title]))
  }
  function submit(e: FormEvent) {
    e.preventDefault()
    const title = value.trim()
    if (!title) return
    setValue('')
    save(title)
  }
  const dismiss = (i: number) => setFailed((f) => f.filter((_, j) => j !== i))

  return (
    <div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          ref={inputRef}
          className="field"
          aria-label="Add a song by title"
          aria-keyshortcuts="n"
          placeholder="Add a song title, then press Enter"
          enterKeyHint="done"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button className="btn btn-primary" disabled={!value.trim()}>
          Add
        </button>
      </form>
      {failed.length > 0 && (
        <ul role="alert" className="mt-2 flex flex-col gap-1">
          {failed.map((title, i) => (
            <li key={`${title}-${i}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-danger px-3 py-1 text-sm">
              <span className="min-w-0 flex-1 text-danger">Couldn’t save “{title}”.</span>
              <button
                className="btn"
                onClick={() => {
                  dismiss(i)
                  save(title)
                }}
              >
                Try Again
              </button>
              <button className="btn" onClick={() => dismiss(i)}>
                Discard
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
