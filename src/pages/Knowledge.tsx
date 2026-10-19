import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { format } from 'date-fns'
import { BookOpen, FileText, Globe, Loader2, MessageCircleQuestion, Plus, RefreshCw, Trash2, Type, Upload } from 'lucide-react'
import { apiErrorMessage } from '../lib/appointments'
import {
  STATUS_PILL, TYPE_LABEL, addKnowledgeFile, addKnowledgeText, addKnowledgeUrl, askKnowledge, deleteKnowledge,
  listKnowledge, reindexKnowledge, updateKnowledge, type KnowledgeAnswer, type KnowledgeDocument, type KnowledgeType,
} from '../lib/knowledge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/shadcn/dialog'
import { Button } from '../components/ui/Button'
import { toast } from '../components/shadcn/toast'

const field = 'h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm'
const label = 'mb-1 block text-xs font-medium text-slate-700'

const TYPE_ICON: Record<KnowledgeType, typeof FileText> = { file: FileText, url: Globe, text: Type }

/**
 * The hospital's knowledge base: documents the AI receptionist looks things up in during a call
 * (fees, timings, services, directions…). Add a file, a web page or pasted text, and try questions.
 */
export default function Knowledge() {
  const [docs, setDocs] = useState<KnowledgeDocument[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  const load = useCallback(() => {
    listKnowledge().then(setDocs).catch((err) => toast.add({ title: apiErrorMessage(err, 'The knowledge base could not be loaded.'), type: 'error' }))
  }, [])
  useEffect(load, [load])

  const run = async (key: string, action: () => Promise<unknown>, done: string) => {
    setBusy(key)
    try {
      await action()
      toast.add({ title: done, type: 'success' })
      load()
    } catch (err) {
      toast.add({ title: apiErrorMessage(err, 'That could not be done.'), type: 'error' })
    } finally {
      setBusy(null)
    }
  }

  const ready = docs?.filter((d) => d.status === 'ready' && d.is_active).length ?? 0

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-500">
          What the AI receptionist can look up while talking to a caller: consultation fees, OPD timings, services,
          doctors' specialities, directions, what to bring. Add the hospital's own documents here; the AI answers from them only.
        </p>
        <Button variant="default" onClick={() => setAdding(true)}><Plus /> Add document</Button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><BookOpen className="h-4 w-4" /></span>
          <div>
            <h2 className="font-semibold text-slate-900">Documents</h2>
            <p className="text-xs text-slate-500">
              {docs === null ? 'Loading…' : docs.length === 0 ? 'Nothing added yet.' : `${ready} of ${docs.length} in use on calls.`}
            </p>
          </div>
        </div>

        {docs !== null && docs.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <FileText className="mx-auto mb-2 h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">No documents yet. Add a PDF, a web page, or paste some text to get started.</p>
          </div>
        ) : docs && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-2.5">Name</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">Pieces</th>
                  <th className="px-3 py-2.5">Updated</th>
                  <th className="px-3 py-2.5">On calls</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {docs.map((d) => {
                  const Icon = TYPE_ICON[d.type]
                  const pill = STATUS_PILL[d.status]
                  return (
                    <tr key={d.id} className={d.is_active ? '' : 'opacity-60'}>
                      <td className="max-w-[320px] px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                          <span className="truncate font-medium text-slate-900" title={d.type === 'url' ? d.url : d.name}>{d.name}</span>
                        </div>
                        {d.status === 'failed' && d.error && <p className="mt-1 text-xs text-red-600">{d.error}</p>}
                      </td>
                      <td className="px-3 py-3 text-slate-600">{TYPE_LABEL[d.type]}</td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${pill.className}`}>{pill.label}</span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-600">{d.chunk_count}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">{format(new Date(d.updated_at), 'd MMM yyyy')}</td>
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Use ${d.name} on calls`}
                          className="h-4 w-4 rounded border-slate-300"
                          checked={d.is_active}
                          disabled={busy === `on-${d.id}`}
                          onChange={(e) => void run(`on-${d.id}`, () => updateKnowledge(d.id, { is_active: e.target.checked }), e.target.checked ? `${d.name} is in use on calls.` : `${d.name} is off.`)}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {d.type !== 'text' && (
                            <Button size="xs" variant="ghost" title="Read it again" disabled={busy === `re-${d.id}`}
                              onClick={() => void run(`re-${d.id}`, () => reindexKnowledge(d.id), `${d.name} was read again.`)}>
                              <RefreshCw className={busy === `re-${d.id}` ? 'animate-spin' : ''} />
                            </Button>
                          )}
                          {confirmDelete === d.id ? (
                            <span className="flex items-center gap-1 text-xs text-slate-600">
                              Delete?
                              <Button size="xs" variant="destructive" disabled={busy === `del-${d.id}`}
                                onClick={() => void run(`del-${d.id}`, async () => { await deleteKnowledge(d.id); setConfirmDelete(null) }, `${d.name} deleted.`)}>Yes</Button>
                              <Button size="xs" variant="ghost" onClick={() => setConfirmDelete(null)}>No</Button>
                            </span>
                          ) : (
                            <Button size="xs" variant="ghost" title="Delete" onClick={() => setConfirmDelete(d.id)}><Trash2 /></Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AskBox disabled={ready === 0} />

      {adding && <AddDocumentDialog onClose={() => setAdding(false)} onAdded={load} />}
    </div>
  )
}

/** Try a question the way a caller would ask it, and see what the AI would say. */
function AskBox({ disabled }: { disabled: boolean }) {
  const [question, setQuestion] = useState('')
  const [history, setHistory] = useState<{ q: string; a: KnowledgeAnswer }[]>([])
  const [busy, setBusy] = useState(false)

  const ask = async (e: FormEvent) => {
    e.preventDefault()
    const q = question.trim()
    if (!q) return
    setBusy(true)
    try {
      const a = await askKnowledge(q)
      setHistory((h) => [{ q, a }, ...h].slice(0, 6))
      setQuestion('')
    } catch (err) {
      toast.add({ title: apiErrorMessage(err, 'Could not get an answer.'), type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700"><MessageCircleQuestion className="h-4 w-4" /></span>
        <div>
          <h2 className="font-semibold text-slate-900">Try a question</h2>
          <p className="text-xs text-slate-500">Ask the way a caller would, and see what the AI would answer from the documents.</p>
        </div>
      </div>
      <form onSubmit={(e) => void ask(e)} className="flex gap-2">
        <input className={field} value={question} onChange={(e) => setQuestion(e.target.value)} disabled={disabled || busy}
          placeholder={disabled ? 'Add a document first' : 'e.g. How much is a consultation? Is there parking?'} />
        <Button type="submit" variant="default" disabled={disabled || busy || !question.trim()}>{busy ? <Loader2 className="animate-spin" /> : 'Ask'}</Button>
      </form>
      {history.length > 0 && (
        <ul className="space-y-3">
          {history.map(({ q, a }, i) => (
            <li key={i} className="rounded-xl bg-slate-50 p-4 text-sm">
              <p className="font-medium text-slate-900">{q}</p>
              <p className={`mt-1 ${a.found ? 'text-slate-700' : 'text-amber-800'}`}>{a.answer}</p>
              {a.sources.length > 0 && <p className="mt-1 text-xs text-slate-400">From: {a.sources.join(', ')}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function AddDocumentDialog({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [kind, setKind] = useState<KnowledgeType>('file')
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const ready = kind === 'file' ? !!file : kind === 'url' ? !!url.trim() : !!(name.trim() && text.trim())

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const doc = kind === 'file' ? await addKnowledgeFile(file!) : kind === 'url' ? await addKnowledgeUrl(url.trim(), name.trim() || undefined) : await addKnowledgeText(name.trim(), text.trim())
      toast.add({
        type: doc.status === 'ready' ? 'success' : 'error',
        title: doc.status === 'ready' ? `${doc.name} added: ${doc.chunk_count} piece${doc.chunk_count === 1 ? '' : 's'} ready for calls.` : `${doc.name} could not be read: ${doc.error}`,
      })
      onAdded(); onClose()
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not add the document.'))
    } finally {
      setBusy(false)
    }
  }

  const tabs: { kind: KnowledgeType; label: string; icon: typeof Upload }[] = [
    { kind: 'file', label: 'Upload a file', icon: Upload },
    { kind: 'url', label: 'Web page', icon: Globe },
    { kind: 'text', label: 'Paste text', icon: Type },
  ]

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add to the knowledge base</DialogTitle>
          <DialogDescription>The AI reads it once and answers callers from it.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="min-w-0 space-y-4">
          <div className="grid grid-cols-3 gap-2" role="tablist">
            {tabs.map(({ kind: k, label: l, icon: Icon }) => (
              <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}
                className={`flex !min-h-0 flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-medium ${kind === k ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-700 hover:border-slate-300'}`}>
                <Icon className="h-4 w-4" /> {l}
              </button>
            ))}
          </div>

          {kind === 'file' && (
            <div>
              <label className={label}>File (PDF, Word, text, Markdown or CSV, up to 20 MB)</label>
              <input ref={fileInput} type="file" accept=".pdf,.docx,.txt,.md,.csv" className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <p className="mt-1 text-xs text-slate-500">Scanned PDFs (images only) can't be read yet.</p>
            </div>
          )}
          {kind === 'url' && (
            <>
              <div>
                <label className={label}>Page address</label>
                <input type="url" className={field} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://gunasheela.in/services" required />
              </div>
              <div>
                <label className={label}>Name (optional)</label>
                <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Services page" />
              </div>
            </>
          )}
          {kind === 'text' && (
            <>
              <div>
                <label className={label}>Name</label>
                <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Consultation fees" required />
              </div>
              <div>
                <label className={label}>Text</label>
                <textarea className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" rows={10} style={{ minHeight: 200 }} value={text}
                  onChange={(e) => setText(e.target.value)} placeholder="General consultation: ₹500. Follow-up within 7 days: free. OPD timings: …" required />
              </div>
            </>
          )}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="default" disabled={!ready || busy}>{busy ? 'Reading…' : 'Add'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
