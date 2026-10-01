import { useState, useEffect } from 'react'

export function LiveClock() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex flex-col items-end bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 shrink-0">
      <span className="text-2xl font-bold text-slate-900 tracking-tight">
        {time.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, hour: 'numeric', minute: '2-digit', second: '2-digit' })}
      </span>
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Indian Standard Time</span>
    </div>
  )
}
