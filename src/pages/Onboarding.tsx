import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useUIStore } from '../store/uistore'
import { Check, ChevronRight, ChevronLeft, Building2, Phone, Mic, Sparkles, Play, Square } from 'lucide-react'
import { useRef, useEffect } from 'react'
import { PhoneNumberPanel } from '../components/PhoneNumberPanel'
import { formatPhoneNumber } from '../lib/phone'

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

const steps = [
  { id: 1, title: 'About Clinic', icon: Building2 },
  { id: 2, title: 'Phone Number', icon: Phone },
  { id: 3, title: 'Voice Agent', icon: Mic },
]

export default function OnboardingPage() {
  const nav = useNavigate()
  const { addToast } = useUIStore()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Step 1 — Clinic Info
  const [clinicDescription, setClinicDescription] = useState('')
  const [clinicAddress, setClinicAddress] = useState('')
  const [clinicType, setClinicType] = useState<'single_doctor' | 'multi_doctor'>('multi_doctor')
  const [clinicPhone, setClinicPhone] = useState('')

  // Step 2 — Phone Number
  const [phoneMode, setPhoneMode] = useState<'buy' | 'bring'>('buy')
  const [boughtNumber, setBoughtNumber] = useState('')
  const [skipNumber, setSkipNumber] = useState(false)
  const [ownNumber, setOwnNumber] = useState('')

  // Step 3 — Voice Agent
  const [selectedVoice, setSelectedVoice] = useState('sarvam_shubh')
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [])

  const togglePlay = (e: React.MouseEvent, voice: typeof VOICE_OPTIONS[0]) => {
    e.stopPropagation() // prevent selecting the card when just playing audio
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

  const canProceedStep1 = clinicDescription.trim().length > 0
  const canProceedStep2 = phoneMode === 'buy' ? (boughtNumber !== '' || skipNumber) : ownNumber.trim().length > 5
  const canProceedStep3 = selectedVoice !== ''

  const handleNext = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1)
  }
  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  const handleFinish = async () => {
    setIsSubmitting(true)
    try {
      await api.post('/clinics/complete-onboarding/', {
        description: clinicDescription,
        address: clinicAddress,
        clinic_type: clinicType,
        phone: clinicPhone,
        ai_phone_number: phoneMode === 'buy' ? (boughtNumber ? formatPhoneNumber(boughtNumber) : '') : ownNumber,
        ai_voice_type: selectedVoice,
      })
      addToast('Welcome to ManageOPD! Your clinic is all set up.', 'success')
      nav('/app/dashboard', { replace: true })
    } catch {
      addToast('Something went wrong. Please try again.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur-xl px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 overflow-hidden">
              <img src="/manageopd_icon.png" alt="ManageOPD" className="w-full h-full object-cover" />
            </div>
            <span className="text-lg font-extrabold tracking-tight text-slate-900">ManageOPD</span>
          </div>
          <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Setup Wizard</span>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="max-w-4xl mx-auto w-full px-6 pt-8">
        <div className="flex items-center justify-between">
          {steps.map((step, i) => {
            const Icon = step.icon
            const isCompleted = currentStep > step.id
            const isActive = currentStep === step.id
            return (
              <div key={step.id} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div className={`
                    w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-500
                    ${isCompleted ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-95' : ''}
                    ${isActive ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/30 scale-110' : ''}
                    ${!isCompleted && !isActive ? 'bg-slate-100 text-slate-400' : ''}
                  `}>
                    {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={`text-xs mt-2 font-medium transition-colors ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                    {step.title}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className="flex-1 mx-4 mt-[-20px]">
                    <div className="h-0.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full bg-emerald-500 rounded-full transition-all duration-700 ${isCompleted ? 'w-full' : 'w-0'}`} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-2xl">

          {/* ============ STEP 1: ABOUT CLINIC ============ */}
          {currentStep === 1 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl mb-4 shadow-lg shadow-blue-500/25">
                  <Building2 className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Tell us about your clinic</h2>
                <p className="text-sm text-slate-500 mt-2">This helps our AI understand your practice and answer patient questions.</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Clinic Description *</label>
                  <textarea
                    className="w-full min-h-[100px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-shadow"
                    placeholder="e.g. A multi-specialty family clinic offering general medicine, pediatrics, and dental care in the heart of Bangalore..."
                    value={clinicDescription}
                    onChange={(e) => setClinicDescription(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Clinic Address</label>
                  <textarea
                    className="w-full min-h-[60px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-shadow"
                    placeholder="123, MG Road, Bangalore 560001"
                    value={clinicAddress}
                    onChange={(e) => setClinicAddress(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Clinic Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['single_doctor', 'multi_doctor'] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setClinicType(type)}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          clinicType === type
                            ? 'border-slate-900 bg-slate-50 shadow-sm'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <p className="text-sm font-semibold text-slate-900">{type === 'single_doctor' ? 'Single Doctor' : 'Multi Doctor'}</p>
                        <p className="text-xs text-slate-500 mt-1">{type === 'single_doctor' ? 'Solo practitioner clinic' : 'Multiple doctors or specialties'}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Clinic Contact Number</label>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-shadow"
                    placeholder="+91 80 1234 5678"
                    value={clinicPhone}
                    onChange={(e) => setClinicPhone(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ============ STEP 2: PHONE NUMBER ============ */}
          {currentStep === 2 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl mb-4 shadow-lg shadow-emerald-500/25">
                  <Phone className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Set up your AI phone number</h2>
                <p className="text-sm text-slate-500 mt-2">Patients will call this number to reach your AI voice agent.</p>
              </div>

              <div className="space-y-4">
                {/* Mode Toggle */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPhoneMode('buy')}
                    className={`p-5 rounded-2xl border-2 text-left transition-all ${
                      phoneMode === 'buy'
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="text-2xl mb-2">📱</div>
                    <p className="text-sm font-bold text-slate-900">Get a new number</p>
                    <p className="text-xs text-slate-500 mt-1">We'll provision a dedicated AI phone number for your clinic.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhoneMode('bring')}
                    className={`p-5 rounded-2xl border-2 text-left transition-all ${
                      phoneMode === 'bring'
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="text-2xl mb-2">🔄</div>
                    <p className="text-sm font-bold text-slate-900">Bring your own</p>
                    <p className="text-xs text-slate-500 mt-1">Forward your existing number to our AI agent.</p>
                  </button>
                </div>

                {/* Buy Mode */}
                {phoneMode === 'buy' && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                    <p className="text-sm font-medium text-slate-700">Choose your AI phone number</p>
                    <PhoneNumberPanel onChange={n => setBoughtNumber(n ? n.number : '')} />
                    {!boughtNumber && (
                      <label className="flex items-center gap-2 text-xs text-slate-500">
                        <input type="checkbox" checked={skipNumber} onChange={e => setSkipNumber(e.target.checked)} />
                        Skip for now — I'll get a number later in AI Settings
                      </label>
                    )}
                  </div>
                )}

                {/* Bring Mode */}
                {phoneMode === 'bring' && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <p className="text-sm font-medium text-slate-700 mb-2">Enter your existing phone number</p>
                    <p className="text-xs text-slate-400 mb-4">We'll guide you through forwarding it to our AI agent after setup.</p>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow"
                      placeholder="+91 98765 43210"
                      value={ownNumber}
                      onChange={(e) => setOwnNumber(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============ STEP 3: VOICE AGENT ============ */}
          {currentStep === 3 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-3xl mb-4 shadow-lg shadow-violet-500/25">
                  <Mic className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Choose your AI voice persona</h2>
                <p className="text-sm text-slate-500 mt-2">Select the personality that best fits your clinic's identity.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            ) : <div />}

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={
                  (currentStep === 1 && !canProceedStep1) ||
                  (currentStep === 2 && !canProceedStep2)
                }
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-slate-900/20"
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                disabled={!canProceedStep3 || isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/25"
              >
                <Sparkles className="h-4 w-4" />
                {isSubmitting ? 'Setting up...' : 'Launch My Clinic'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
