import { useEffect, useState, useCallback } from 'react'
import { api } from '../lib/api'
import { Phone, Calendar, Search, FileText, X, Download } from 'lucide-react'
import { format } from 'date-fns'

type CallLog = {
  id: number
  patient: number | null
  patient_name: string | null
  direction: 'inbound' | 'outbound'
  agent_name: string
  language: string
  duration_seconds: number
  outcome: string
  occurred_at: string
  transcript: string
  recording_url?: string
  summary?: string
}

export default function CallLogs() {
  const [logs, setLogs] = useState<CallLog[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLog, setSelectedLog] = useState<CallLog | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const loadLogs = useCallback(() => {
    setLoading(true)
    api.get<{ results: CallLog[] }>('/ai/call-logs/', { params: { page_size: 100 } })
      .then(res => setLogs(res.data.results || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadLogs() }, [loadLogs])

  const fmtDuration = (s: number) => s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`

  const getOutcomeStyle = (outcome: string) => {
    const o = outcome.toLowerCase()
    if (o.includes('booked')) return 'bg-cyan-100 text-cyan-800 border-cyan-200'
    if (o.includes('cancel')) return 'bg-amber-100 text-amber-800 border-amber-200'
    if (o.includes('info')) return 'bg-purple-100 text-purple-800 border-purple-200'
    if (o.includes('unanswer')) return 'bg-red-100 text-red-800 border-red-200'
    return 'bg-slate-100 text-slate-800 border-slate-200'
  }

  const filteredLogs = logs.filter(l => 
    (l.patient_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.outcome.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const downloadCSV = () => {
    const headers = ['Date', 'Time', 'Patient', 'Direction', 'Duration (s)', 'Outcome']
    const csvContent = [
      headers.join(','),
      ...filteredLogs.map(l => {
        const d = new Date(l.occurred_at)
        return [
          format(d, 'yyyy-MM-dd'),
          format(d, 'HH:mm:ss'),
          `"${l.patient_name || 'Unknown'}"`,
          l.direction,
          l.duration_seconds,
          `"${l.outcome}"`
        ].join(',')
      })
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', 'call_logs.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="flex h-full">
      {/* Main Content */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${selectedLog ? 'pr-96' : ''}`}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">AI Call Logs</h1>
            <p className="text-sm text-slate-500 mt-0.5">Review transcripts and outcomes of AI-handled calls</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search patient or outcome..."
                className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#06B6D4] w-64"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <button onClick={downloadCSV} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
              <Download size={16} /> Export
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex-1 overflow-hidden flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 sticky top-0">
                <tr>
                  <th className="px-6 py-4 font-medium">Date & Time</th>
                  <th className="px-6 py-4 font-medium">Patient</th>
                  <th className="px-6 py-4 font-medium">Direction</th>
                  <th className="px-6 py-4 font-medium">Duration</th>
                  <th className="px-6 py-4 font-medium">Outcome</th>
                  <th className="px-6 py-4 font-medium">Transcript</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Loading call logs...</td></tr>
                ) : filteredLogs.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">No call logs found.</td></tr>
                ) : (
                  filteredLogs.map(log => (
                    <tr 
                      key={log.id} 
                      className={`hover:bg-slate-50 cursor-pointer transition-colors ${selectedLog?.id === log.id ? 'bg-cyan-50/50 hover:bg-cyan-50/50' : ''}`}
                      onClick={() => setSelectedLog(log)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-900">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          {format(new Date(log.occurred_at), 'MMM d, h:mm a')}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900">{log.patient_name || <span className="text-slate-400 font-normal">Unknown</span>}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${log.direction === 'inbound' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-violet-50 text-violet-700 border-violet-200'}`}>
                          <Phone className="w-3 h-3" />
                          {log.direction}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{fmtDuration(log.duration_seconds)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium border capitalize ${getOutcomeStyle(log.outcome)}`}>
                          {log.outcome.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-[#06B6D4] font-medium hover:text-[#0891B2]">
                          <FileText className="w-4 h-4" /> View
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Transcript Drawer Side Panel */}
      <div className={`fixed top-0 right-0 h-full w-96 bg-white border-l border-slate-200 shadow-2xl transform transition-transform duration-300 ease-in-out z-40 flex flex-col ${selectedLog ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedLog && (
          <>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/80">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#06B6D4]" /> Call Details
              </h2>
              <button onClick={() => setSelectedLog(null)} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-5 border-b border-slate-100 grid grid-cols-2 gap-4 bg-white">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Patient</p>
                <p className="text-sm font-semibold text-slate-900">{selectedLog.patient_name || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Outcome</p>
                <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border uppercase tracking-wide ${getOutcomeStyle(selectedLog.outcome)}`}>
                  {selectedLog.outcome.replace(/_/g, ' ')}
                </span>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Date & Time</p>
                <p className="text-sm text-slate-700">{format(new Date(selectedLog.occurred_at), 'MMM d, yyyy h:mm a')}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Duration</p>
                <p className="text-sm text-slate-700">{fmtDuration(selectedLog.duration_seconds)}</p>
              </div>
            </div>

            {selectedLog.recording_url && (
              <div className="p-5 border-b border-slate-100 bg-white">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5" /> Call Recording
                </h3>
                <audio controls className="w-full h-10 outline-none rounded-lg custom-audio">
                  <source src={selectedLog.recording_url} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
              </div>
            )}

            {selectedLog.summary && (
              <div className="p-5 border-b border-slate-100 bg-cyan-50/30">
                <h3 className="text-xs font-bold text-cyan-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" /> AI Analysis
                </h3>
                <p className="text-sm text-slate-700 leading-relaxed bg-white p-4 rounded-xl border border-cyan-100 shadow-sm">
                  {selectedLog.summary}
                </p>
              </div>
            )}

            <div className="p-5 flex-1 overflow-y-auto bg-slate-50">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Transcript</h3>
              <div className="space-y-4">
                {selectedLog.transcript ? selectedLog.transcript.split('\n').map((line, i) => {
                  const isAI = line.startsWith('AI:');
                  const text = line.replace(/^(AI|Patient):\s*/, '');
                  if (!text.trim()) return null;

                  return (
                    <div key={i} className={`flex flex-col ${isAI ? 'items-start' : 'items-end'}`}>
                      <span className="text-[10px] font-bold text-slate-400 mb-1 px-1 uppercase">{isAI ? 'ManageOPD AI' : 'Patient'}</span>
                      <div className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-sm ${isAI ? 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm' : 'bg-[#030D39] text-white rounded-tr-sm shadow-md'}`}>
                        {text}
                      </div>
                    </div>
                  )
                }) : (
                  <p className="text-sm text-slate-500 italic text-center mt-10">No transcript available for this call.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
