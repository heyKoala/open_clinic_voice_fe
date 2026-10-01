import { useState } from "react";
import { Room, RoomEvent } from "livekit-client";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";

export default function CallAgent() {
  const url = "wss://vx.heykoala.ai";
  const [isConnected, setIsConnected] = useState(false);
  const [showBtn, setShowBtn] = useState(true);
  const [room, setRoom] = useState<Room | null>(null);
  const [status, setStatus] = useState("Idle");
  const [transcript, setTranscript] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const joinCall = async (participantName: string, participantIdentity: string) => {
    const agentUrl = import.meta.env.VITE_AGENT_URL || "https://worker.heykoala.ai";
    const apiKey = import.meta.env.VITE_AUTH_API_KEY;
    if (!apiKey) {
      throw new Error("VITE_AUTH_API_KEY is not set");
    }

    console.log("Sending webCall request to:", agentUrl);

    const response = await fetch(`${agentUrl}/webCall`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        participant_name: participantName,
        participant_identity: participantIdentity,
        webhook_url: "https://dlnfm2hm-8001.inc1.devtunnels.ms/api/v1/ai/webhooks/rock8/1/",
      }),
    });

    if (!response.ok) {
      throw new Error(`webCall failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data?.token) {
      throw new Error("webCall response missing token");
    }
    console.log("Got token successfully");
    return data.token;
  };

  function resetCallState() {
    setRoom(null);
    setIsConnected(false);
    setShowBtn(true);
    setIsMuted(false);
    setStatus("Disconnected");
    const container = document.getElementById("remote-container");
    if (container) {
      container.innerHTML = "";
    }
  }

  async function joinVideoRoom() {
    setIsConnected(true);
    setErrorMsg("");
    const participantName = "user";
    const participantIdentity = `voice_assistant_user_${Math.floor(Math.random() * 10_000)}`;

    let token;
    try {
      token = await joinCall(participantName, participantIdentity);
    } catch (error: any) {
      console.error("Could not obtain a LiveKit token", error);
      setErrorMsg(error.message || "Failed to get token");
      resetCallState();
      setStatus("Idle");
      return;
    }

    const newRoom = new Room();
    setRoom(newRoom);

    newRoom
      .on(RoomEvent.TrackSubscribed, (track) => {
        console.log("Track subscribed");
        const element = track.attach();
        document.getElementById("remote-container")?.appendChild(element);
      })
      .on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((element) => element.remove());
      })
      .on(RoomEvent.Disconnected, (_reason) => {
        console.log("Disconnected from room");
        resetCallState();
      })
      .on(RoomEvent.ParticipantDisconnected, (participant) => {
        if (participant.isAgent) {
          console.log("Agent left");
          newRoom.disconnect();
        }
      });

    newRoom.on(RoomEvent.ParticipantAttributesChanged, (_changedAttributes, participant) => {
      if (participant.isAgent) {
        const agentState = participant.attributes["lk.agent.state"];
        if (agentState) {
          setStatus(agentState);
        }
      }
    });

    newRoom.on(RoomEvent.TranscriptionReceived, (transcriptions, participant) => {
      if (participant?.isAgent) {
        transcriptions.forEach((transcription) => {
          setTranscript(transcription.text);
        });
      }
    });

    try {
      console.log("Connecting to LiveKit...");
      await newRoom.connect(url, token);
      console.log("Connected! Starting audio...");
      await newRoom.startAudio();
      await newRoom.localParticipant?.setMicrophoneEnabled(true);
      setIsConnected(false);
      setShowBtn(false);
    } catch (error: any) {
      console.error("Could not connect to LiveKit", error);
      setErrorMsg("Could not connect to voice server");
      resetCallState();
      setStatus("Idle");
    }
  }

  async function endCall() {
    await room?.disconnect();
  }

  async function muteCall() {
    if (room && room.localParticipant) {
      if (isMuted) {
        await room.localParticipant.setMicrophoneEnabled(true);
      } else {
        await room.localParticipant.setMicrophoneEnabled(false);
      }
      setIsMuted(!isMuted);
    }
  }

  const isSpeaking = status === "speaking";
  const isListening = status === "listening";

  return (
    <div className="relative flex min-h-[calc(100vh-6rem)] w-full flex-col items-center justify-center overflow-hidden rounded-3xl bg-slate-950 font-jakarta">
      {/* Background Gradients */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className={`absolute h-96 w-96 rounded-full blur-[100px] transition-all duration-1000 ${isSpeaking ? "bg-[#34E0FF]/30 scale-125" : isListening ? "bg-emerald-500/20 scale-110" : "bg-indigo-500/10 scale-100"
          }`} />
      </div>

      <div id="remote-container" className="absolute w-1 h-1 opacity-0 pointer-events-none" />

      {/* Main UI */}
      <div className="relative z-10 flex w-full max-w-xl flex-col items-center gap-12 p-8">

        {/* Header Text */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-white">ManageOPD AI Receptionist</h1>
          <p className="text-sm text-slate-400">Powered by HeyKoala</p>
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400 text-center w-full max-w-sm">
            {errorMsg}
          </div>
        )}

        {/* Central Orb */}
        <div className="relative flex h-48 w-48 items-center justify-center">
          {/* Pulsing rings when active */}
          {!showBtn && (
            <>
              <div className={`absolute inset-0 rounded-full border-2 border-[#34E0FF]/20 ${isSpeaking ? "animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" : ""}`} />
              <div className={`absolute -inset-4 rounded-full border border-[#34E0FF]/10 ${isSpeaking ? "animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]" : ""}`} />
            </>
          )}

          <div className={`relative flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl transition-all duration-500 ${isSpeaking ? "shadow-[#34E0FF]/50 ring-4 ring-[#34E0FF]/30 scale-110" : isListening ? "shadow-emerald-500/30 ring-2 ring-emerald-500/20 scale-105" : "ring-1 ring-white/10"
            }`}>
            <img src="/manageopd_icon.png" alt="AI" className="h-12 w-12 object-contain opacity-80" />
          </div>
        </div>

        {/* Status Text */}
        <div className="flex flex-col items-center gap-2">
          <div className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${isSpeaking ? "bg-[#34E0FF]/10 text-[#34E0FF]" : isListening ? "bg-emerald-500/10 text-emerald-400" : "bg-white/5 text-slate-400"
            }`}>
            <div className={`h-2 w-2 rounded-full ${isSpeaking ? "bg-[#34E0FF] animate-pulse" : isListening ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
              }`} />
            <span className="capitalize">{status === "Idle" ? "Ready" : status}</span>
          </div>
        </div>

        {/* Transcript Box */}
        <div className="w-full h-24 flex items-center justify-center px-4">
          <p className="text-center text-lg md:text-xl font-medium text-slate-200 leading-relaxed max-w-md transition-all duration-300">
            {transcript || (showBtn ? "Press call to begin..." : "Listening...")}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-6 mt-4">
          {showBtn ? (
            <button
              onClick={joinVideoRoom}
              disabled={isConnected}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 text-white shadow-lg shadow-emerald-500/30 transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
            >
              <Phone className="h-6 w-6 fill-current" />
            </button>
          ) : (
            <>
              <button
                onClick={muteCall}
                className={`flex h-14 w-14 items-center justify-center rounded-full transition-all ${isMuted
                  ? "bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/30 hover:bg-amber-500/20"
                  : "bg-white/5 text-white ring-1 ring-white/10 hover:bg-white/10"
                  }`}
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>

              <button
                onClick={endCall}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg shadow-rose-500/30 transition-transform hover:scale-105 active:scale-95"
              >
                <PhoneOff className="h-6 w-6 fill-current" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
