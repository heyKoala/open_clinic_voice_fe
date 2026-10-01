import React, { useState, useEffect } from 'react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { api } from '../lib/api'
import { useUIStore } from '../store/uistore'
import { Check, Play, Square } from 'lucide-react'
import { PhoneNumberPanel } from '../components/PhoneNumberPanel'

const VOICE_OPTIONS = [
  {
    id: 'sarvam_shubh',
    name: 'Shubh',
    description: 'Friendly default voice for IVR and support.',
    emoji: '👨🏽',
    color: 'from-blue-500 to-blue-600',
    tagline: 'Friendly & Support',
    audioUrl: '/voices/Shubh_saarvamAI.mp3'
  },
  {
    id: 'sarvam_ritu',
    name: 'Ritu',
    description: 'Warm voice for customer interactions.',
    emoji: '👩🏽',
    color: 'from-emerald-500 to-emerald-600',
    tagline: 'Warm & Conversational',
    audioUrl: '/voices/Ritu_sarvamAI.mp3'
  },
  {
    id: 'sarvam_simran',
    name: 'Simran',
    description: 'Warm voice for conversational interfaces.',
    emoji: '👩🏽‍💼',
    color: 'from-indigo-500 to-indigo-600',
    tagline: 'Warm Conversational',
    audioUrl: '/voices/Simran_sarvamAI.mp3'
  },
  {
    id: 'sarvam_kavya',
    name: 'Kavya',
    description: 'Everyday conversational tone.',
    emoji: '👩🏽',
    color: 'from-pink-500 to-pink-600',
    tagline: 'Everyday Tone',
    audioUrl: '/voices/Kavya_sarvamAI.mp3'
  },
  {
    id: 'sarvam_ratan',
    name: 'Ratan',
    description: 'Formal voice for business communications.',
    emoji: '👨🏽‍💼',
    color: 'from-purple-500 to-purple-600',
    tagline: 'Formal & Business',
    audioUrl: '/voices/Ratan_SarvamAI.mp3'
  }
]

const LANGUAGES = [
  { id: 'en', label: 'English', native: 'English' },
  { id: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { id: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { id: 'ml', label: 'Malayalam', native: 'മലയാളം' },
  { id: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { id: 'te', label: 'Telugu', native: 'తెలుగు' },
  { id: 'bn', label: 'Bengali', native: 'বাংলা' },
  { id: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
  { id: 'mr', label: 'Marathi', native: 'मराठी' },
]

const PURPOSES = ['Follow-up', 'Consultation']

interface AgentConfig {
  id?: number
  purpose: string
  language: string
  first_greeting: string
  system_prompt: string
  is_active: boolean
}

export default function Settings() {
  const [configs, setConfigs] = useState<AgentConfig[]>([])
  const [activeLanguages, setActiveLanguages] = useState<Set<string>>(new Set(['en']))
  const [selectedAgentKey, setSelectedAgentKey] = useState<string>('Follow-up:en')
  
  const [greeting, setGreeting] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  
  // Voice selection states
  const [selectedVoice, setSelectedVoice] = useState('sarvam_shubh')
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null)
  const [clinicId, setClinicId] = useState<number | null>(null)
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  
  const { addToast } = useUIStore()

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [])

  const togglePlay = (e: React.MouseEvent, voice: typeof VOICE_OPTIONS[0]) => {
    e.stopPropagation()
    if (playingVoiceId === voice.id) {
      audioRef.current?.pause()
      setPlayingVoiceId(null)
    } else {
      if (audioRef.current) audioRef.current.pause()
      const audio = new Audio(voice.audioUrl)
      audioRef.current = audio
      audio.play().catch(console.error)
      setPlayingVoiceId(voice.id)
      audio.onended = () => setPlayingVoiceId(null)
    }
  }

  useEffect(() => {
    fetchConfigs()
  }, [])

  const fetchConfigs = async () => {
    try {
      const [aiRes, clinicRes] = await Promise.all([
        api.get('/ai/agent-configurations/', { params: { page_size: 100 } }),
        api.get('/clinics/')
      ])
      const data: AgentConfig[] = aiRes.data.results || aiRes.data
      const clinics = clinicRes.data.results || clinicRes.data
      if (clinics.length > 0) {
        setClinicId(clinics[0].id)
        if (clinics[0].ai_voice) {
          setSelectedVoice(clinics[0].ai_voice)
        }
      }
      setConfigs(data)
      
      const langs = new Set<string>()
      data.forEach(c => {
        if (c.is_active) langs.add(c.language)
      })
      if (langs.size > 0) setActiveLanguages(langs)
    } catch (err) {
      console.error(err)
      addToast('Failed to load AI configurations.', 'error')
    }
  }

  // Generate the active agents dropdown based on selected languages
  const dynamicAgents = React.useMemo(() => {
    const agents: { key: string, label: string, purpose: string, langId: string }[] = []
    LANGUAGES.filter(l => activeLanguages.has(l.id)).forEach(lang => {
      PURPOSES.forEach(purpose => {
        agents.push({
          key: `${purpose}:${lang.id}`,
          label: `${purpose} - ${lang.label}`,
          purpose,
          langId: lang.id
        })
      })
    })
    return agents
  }, [activeLanguages])

  // When dropdown changes, load the matching config text
  useEffect(() => {
    if (dynamicAgents.length > 0) {
      if (!dynamicAgents.find(a => a.key === selectedAgentKey)) {
        setSelectedAgentKey(dynamicAgents[0].key)
      }
    }
  }, [dynamicAgents, selectedAgentKey])

  useEffect(() => {
    const [purpose, langId] = selectedAgentKey.split(':')
    const match = configs.find(c => c.purpose === purpose && c.language === langId)
    
    if (match) {
      setGreeting(match.first_greeting)
      setSystemPrompt(match.system_prompt)
    } else {
      setGreeting('')
      setSystemPrompt('')
    }
  }, [selectedAgentKey, configs])

  const toggleLanguage = async (langId: string) => {
    const next = new Set(activeLanguages)
    const isActivating = !next.has(langId)
    
    if (isActivating) next.add(langId)
    else next.delete(langId)
    
    setActiveLanguages(next)

    // For simplicity, we create default empty configs for a newly activated language 
    // or deactivate them if removed. We patch/post to backend immediately.
    try {
      const promises = PURPOSES.map(async purpose => {
        const existing = configs.find(c => c.purpose === purpose && c.language === langId)
        if (existing && existing.id) {
          // patch is_active
          return api.patch(`/ai/agent-configurations/${existing.id}/`, { is_active: isActivating })
        } else if (isActivating) {
          // create new
          return api.post(`/ai/agent-configurations/`, {
            purpose,
            language: langId,
            first_greeting: `Hello from ${purpose} bot`,
            system_prompt: `You are a ${purpose} assistant.`,
            is_active: true
          })
        }
      })
      await Promise.all(promises)
      await fetchConfigs()
      addToast(`Language ${isActivating ? 'activated' : 'deactivated'}.`, 'success')
    } catch (err) {
      console.error(err)
      addToast('Failed to update language settings.', 'error')
    }
  }

  const handleSavePrompt = async () => {
    const [purpose, langId] = selectedAgentKey.split(':')
    const existing = configs.find(c => c.purpose === purpose && c.language === langId)
    
    setIsSaving(true)
    try {
      if (existing && existing.id) {
        await api.patch(`/ai/agent-configurations/${existing.id}/`, {
          first_greeting: greeting,
          system_prompt: systemPrompt,
          is_active: true
        })
      } else {
        await api.post(`/ai/agent-configurations/`, {
          purpose,
          language: langId,
          first_greeting: greeting,
          system_prompt: systemPrompt,
          is_active: true
        })
      }
      addToast('Prompt changes saved.', 'success')
      await fetchConfigs()
    } catch (err) {
      console.error(err)
      addToast('Failed to save prompt changes.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveVoice = async () => {
    if (!clinicId) return
    try {
      await api.patch(`/clinics/${clinicId}/`, { ai_voice: selectedVoice })
      addToast('AI voice updated successfully.', 'success')
    } catch (err) {
      console.error(err)
      addToast('Failed to update AI voice.', 'error')
    }
  }

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-slate-900">AI Settings</h2>
        <p className="text-sm text-slate-500">Phone number, languages and AI agent prompts.</p>
      </div>

      <Card className="p-6">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-900">Clinic phone number</h3>
          <p className="text-xs text-slate-500 mt-1">Patients call this number to reach your AI receptionist.</p>
        </div>
        <PhoneNumberPanel />
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900">Languages the AI speaks</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          {LANGUAGES.map((lang) => {
            const isActive = activeLanguages.has(lang.id)
            return (
              <button
                key={lang.id}
                onClick={() => toggleLanguage(lang.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
                  isActive 
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800' 
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                {lang.native} {lang.label}
              </button>
            )
          })}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900">AI Voice Persona</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {VOICE_OPTIONS.map(voice => (
            <button
              key={voice.id}
              type="button"
              onClick={() => setSelectedVoice(voice.id)}
              className={`p-5 rounded-2xl border-2 text-left transition-all relative overflow-hidden ${
                selectedVoice === voice.id
                  ? 'border-slate-900 bg-slate-50 shadow-md'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              {selectedVoice === voice.id && (
                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-slate-900 flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-white" />
                </div>
              )}
              <div className="flex items-center justify-between mb-3">
                <div className="text-3xl">{voice.emoji}</div>
                <button 
                  onClick={(e) => togglePlay(e, voice)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    playingVoiceId === voice.id 
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  title="Preview voice"
                >
                  {playingVoiceId === voice.id ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-1" />}
                </button>
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-900">{voice.name}</h3>
                <p className={`text-xs font-semibold bg-gradient-to-r ${voice.color} bg-clip-text text-transparent uppercase tracking-wider`}>
                  {voice.tagline}
                </p>
              </div>
              <p className="text-sm text-slate-500 mt-3 leading-relaxed">{voice.description}</p>
            </button>
          ))}
        </div>
        <div className="flex">
          <Button variant="default" onClick={handleSaveVoice} disabled={!clinicId}>
            Save voice selection
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-6">AI agent prompts</h3>
        
        <div className="space-y-6 max-w-3xl">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Agent (purpose & language)</label>
            <select 
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
              value={selectedAgentKey}
              onChange={(e) => setSelectedAgentKey(e.target.value)}
            >
              {dynamicAgents.length === 0 ? (
                <option value="">No languages selected</option>
              ) : (
                dynamicAgents.map(agent => (
                  <option key={agent.key} value={agent.key}>{agent.label}</option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">First greeting</label>
            <input 
              type="text"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium"
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">System prompt</label>
            <textarea 
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[120px] font-medium"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
          </div>
          
          <div className="flex">
            <Button variant="default" onClick={handleSavePrompt} disabled={isSaving || dynamicAgents.length === 0}>
              {isSaving ? 'Saving...' : 'Save prompt changes'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
