import React, { useState, useEffect } from "react";
import { Button } from "../components/ui/Button";
import { Check, Play, Square } from "lucide-react";
import { api } from "../lib/api";
import { useUIStore } from "../store/uistore";

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
];

function VoiceAgentTest() {
  const [selectedVoice, setSelectedVoice] = useState('sarvam_shubh');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [clinicId, setClinicId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const { addToast } = useUIStore();

  useEffect(() => {
    const fetchClinic = async () => {
      try {
        const res = await api.get('/clinics/');
        const clinics = res.data.results || res.data;
        if (clinics.length > 0) {
          setClinicId(clinics[0].id);
          if (clinics[0].ai_voice) {
            setSelectedVoice(clinics[0].ai_voice);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchClinic();

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const togglePlay = (e: React.MouseEvent, voice: typeof VOICE_OPTIONS[0]) => {
    e.stopPropagation();
    if (playingVoiceId === voice.id) {
      audioRef.current?.pause();
      setPlayingVoiceId(null);
    } else {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(voice.audioUrl);
      audioRef.current = audio;
      audio.play().catch(console.error);
      setPlayingVoiceId(voice.id);
      audio.onended = () => setPlayingVoiceId(null);
    }
  };

  const handleSaveVoice = async () => {
    if (!clinicId) return;
    setIsSaving(true);
    try {
      await api.patch(`/clinics/configuration/`, { ai_voice_type: selectedVoice });
      addToast('AI voice updated successfully.', 'success');
    } catch (err) {
      console.error(err);
      addToast('Failed to update AI voice.', 'error');
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">AI Receptionist Settings</h2>
        <p className="text-sm text-slate-500 mt-1">Configure your AI agent's behavior, voice, and greetings.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-6">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Agent Persona & Prompt</h3>
          <p className="text-sm text-slate-500 mt-1">
            Customize how the AI answers the phone and interacts with your patients.
          </p>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            Greeting Prompt (Coming Soon)
          </label>
          <textarea
            readOnly
            className="w-full min-h-[150px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 cursor-not-allowed focus:outline-none"
            value={"You are a helpful medical receptionist for ManageOPD Care Center handling incoming calls from patients.\n\nYour main tasks are:\n1. Schedule, reschedule, or cancel appointments.\n2. If an appointment slot is unavailable or the doctor is away, suggest the next available slot.\n3. If there are multiple doctors, always ask the patient which doctor they want to book with.\n\nUse the provided tools to fetch available slots and manage appointments."}
          />
          <p className="text-xs text-slate-400">
            Note: This feature is currently a placeholder. The agent's prompt is securely hardcoded in the backend to ensure stability.
          </p>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            disabled
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white opacity-50 cursor-not-allowed"
          >
            Save Changes
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-6">
        <div>
          <h3 className="text-base font-semibold text-slate-900">AI Voice Persona</h3>
          <p className="text-sm text-slate-500 mt-1">Select the voice identity for your AI Receptionist.</p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        
        <div className="pt-4 flex justify-end">
          <Button variant="default" onClick={handleSaveVoice} disabled={!clinicId || isSaving}>
            {isSaving ? 'Saving...' : 'Save Voice'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default VoiceAgentTest;
