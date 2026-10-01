import { Download, X } from 'lucide-react'
import { useEffect, useState } from 'react'

type DeferredPrompt = Event & { prompt: () => Promise<void> }

export default function PwaInstallPrompt() {
  const [prompt, setPrompt] = useState<DeferredPrompt | null>(null)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('manageopd-install-dismissed') === '1')
  useEffect(() => {
    const listener = (event: Event) => { event.preventDefault(); setPrompt(event as DeferredPrompt) }
    window.addEventListener('beforeinstallprompt', listener)
    return () => window.removeEventListener('beforeinstallprompt', listener)
  }, [])
  if (!prompt || dismissed) return null
  return <aside aria-label="Install ManageOPD" className="fixed bottom-20 right-4 z-50 max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-lg md:bottom-4">
    <button type="button" aria-label="Dismiss install prompt" onClick={() => { localStorage.setItem('manageopd-install-dismissed', '1'); setDismissed(true) }} className="absolute right-2 top-2 min-h-11 min-w-11 text-slate-500"><X className="mx-auto h-4 w-4" /></button>
    <p className="pr-8 font-semibold">Install ManageOPD</p><p className="mt-1 text-sm text-slate-600">Add the console to your home screen for faster access.</p>
    <button type="button" onClick={() => { void prompt.prompt(); setPrompt(null) }} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"><Download className="h-4 w-4" />Install app</button>
  </aside>
}
