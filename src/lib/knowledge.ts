import { api } from './api'

/** A document the AI receptionist can look things up in on a call (AI Agent → Knowledge). */
export type KnowledgeType = 'file' | 'url' | 'text'
export type KnowledgeStatus = 'pending' | 'ready' | 'failed'

export type KnowledgeDocument = {
  id: number
  name: string
  type: KnowledgeType
  file_name: string
  url: string
  /** Pasted text, or the text read from the file or page. */
  text: string
  status: KnowledgeStatus
  error: string
  chunk_count: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type KnowledgeAnswer = { answer: string; found: boolean; sources: string[] }

const base = '/ai/knowledge/'

export const listKnowledge = () => api.get<KnowledgeDocument[]>(base).then((r) => r.data)

export const addKnowledgeFile = (file: File) => {
  const form = new FormData()
  form.append('type', 'file')
  form.append('file', file)
  return api.post<KnowledgeDocument>(base, form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data)
}
export const addKnowledgeUrl = (url: string, name?: string) =>
  api.post<KnowledgeDocument>(base, { type: 'url', url, ...(name ? { name } : {}) }).then((r) => r.data)
export const addKnowledgeText = (name: string, text: string) =>
  api.post<KnowledgeDocument>(base, { type: 'text', name, text }).then((r) => r.data)

export const updateKnowledge = (id: number, values: Partial<Pick<KnowledgeDocument, 'name' | 'text' | 'is_active'>>) =>
  api.patch<KnowledgeDocument>(`${base}${id}/`, values).then((r) => r.data)
export const reindexKnowledge = (id: number) => api.post<KnowledgeDocument>(`${base}${id}/reindex/`).then((r) => r.data)
export const deleteKnowledge = (id: number) => api.delete(`${base}${id}/`)

/** What the AI would answer a caller, from the documents. */
export const askKnowledge = (question: string) => api.post<KnowledgeAnswer>(`${base}ask/`, { question }).then((r) => r.data)

export const TYPE_LABEL: Record<KnowledgeType, string> = { file: 'File', url: 'Web page', text: 'Text' }
export const STATUS_PILL: Record<KnowledgeStatus, { label: string; className: string }> = {
  pending: { label: 'Processing', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  ready: { label: 'Ready', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  failed: { label: 'Failed', className: 'bg-red-50 text-red-700 ring-red-200' },
}
