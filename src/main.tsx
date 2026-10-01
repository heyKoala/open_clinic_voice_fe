import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import React from 'react'
class ErrorBoundary extends React.Component<any, any> { state: any = { error: null }; static getDerivedStateFromError(error: any) { return { error }; } componentDidCatch(e: any) { fetch('http://localhost:8002', {method:'POST', body: String(e.stack || e)}); console.error(e); } render() { if (this.state.error) return <div style={{padding: 20, color: 'red'}}><pre>{String(this.state.error.stack || this.state.error)}</pre></div>; return this.props.children; } }

if ('serviceWorker' in navigator) window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js') })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </StrictMode>,
)

