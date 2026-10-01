import { useState, useRef } from 'react'
import { FileText } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { api } from '../../lib/api'
import { useUIStore } from '../../store/uistore'

interface Attachment {
  id: number
  filename: string
  file_size: number
  mime_type: string
  uploaded_at: string
  file: string
}

interface PatientDocumentsProps {
  patientId: number
  attachments: Attachment[]
  onRefresh: () => void
}

export function PatientDocuments({ patientId, attachments, onRefresh }: PatientDocumentsProps) {
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' b'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' kb'
    return (bytes / (1024 * 1024)).toFixed(1) + ' mb'
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const formData = new FormData()
    formData.append('patient', patientId.toString())
    formData.append('file', file)
    formData.append('filename', file.name)

    try {
      await api.post('/clinical/attachments/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      useUIStore.getState().addToast('Document uploaded successfully.', 'success')
      onRefresh()
    } catch (err) {
      console.error(err)
      useUIStore.getState().addToast('Failed to upload document.', 'error')
    } finally {
      setIsUploading(false)
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDownload = async (doc: Attachment) => {
    try {
      // Use the authenticated API client to fetch the file blob
      const response = await api.get(doc.file, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', doc.filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      useUIStore.getState().addToast(`Failed to download ${doc.filename}.`, 'error')
    }
  }

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">Agreements & Documents</h3>
        <Button 
          variant="secondary" 
          size="sm" 
          className="h-7 text-xs" 
          onClick={handleUploadClick}
          disabled={isUploading}
        >
          {isUploading ? 'Uploading...' : 'Upload'}
        </Button>
        <input 
          type="file" 
          className="hidden" 
          ref={fileInputRef} 
          onChange={handleFileChange}
        />
      </div>
      <div className="p-5 grid gap-3">
        {attachments.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-2">No documents attached.</p>
        ) : (
          attachments.map(doc => (
            <div key={doc.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200">
                  <FileText className="h-5 w-5 text-slate-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{doc.filename}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{formatFileSize(doc.file_size)} • {formatDate(doc.uploaded_at)}</p>
                </div>
              </div>
              <Button variant="secondary" size="sm" className="text-xs" onClick={() => handleDownload(doc)}>
                Download
              </Button>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}
