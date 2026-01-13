'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Login() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [isSetup, setIsSetup] = useState(false)
  const [confirmPin, setConfirmPin] = useState('')
  const [step, setStep] = useState('check')
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showInstall, setShowInstall] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Registrar Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('SW registrado'))
        .catch((err) => console.log('SW error:', err))
    }

    // Detectar si ya está instalada
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }

    // Capturar evento de instalación
    const handleBeforeInstall = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowInstall(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    // Check PIN
    const savedPin = localStorage.getItem('docvault_pin')
    if (savedPin) {
      setStep('login')
    } else {
      setStep('setup')
      setIsSetup(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    
    if (outcome === 'accepted') {
      setIsInstalled(true)
    }
    setDeferredPrompt(null)
    setShowInstall(false)
  }

  const handlePinInput = (digit) => {
    if (pin.length < 4) {
      const newPin = pin + digit
      setPin(newPin)
      setError('')
      
      if (newPin.length === 4) {
        if (step === 'setup') {
          setConfirmPin(newPin)
          setPin('')
          setStep('confirm')
        } else if (step === 'confirm') {
          if (newPin === confirmPin) {
            localStorage.setItem('docvault_pin', newPin)
            router.push('/boveda')
          } else {
            setError('Los PINs no coinciden')
            setPin('')
            setConfirmPin('')
            setStep('setup')
          }
        } else {
          const savedPin = localStorage.getItem('docvault_pin')
          if (newPin === savedPin) {
            router.push('/boveda')
          } else {
            setError('PIN incorrecto')
            setPin('')
          }
        }
      }
    }
  }

  const handleDelete = () => {
    setPin(pin.slice(0, -1))
    setError('')
  }

  const getMessage = () => {
    if (step === 'setup') return 'Crea tu PIN de 4 dígitos'
    if (step === 'confirm') return 'Confirma tu PIN'
    return 'Ingresa tu PIN'
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.icon}>🔐</div>
        <h1 style={styles.title}>DocVault</h1>
        <p style={styles.subtitle}>Tu bóveda de documentos</p>
        
        <p style={styles.message}>{getMessage()}</p>
        
        <div style={styles.pinDisplay}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              ...styles.pinDot,
              background: i < pin.length ? '#4ade80' : '#333'
            }} />
          ))}
        </div>
        
        {error && <p style={styles.error}>{error}</p>}
        
        <div style={styles.keypad}>
          {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((key, i) => (
            <button
              key={i}
              style={{
                ...styles.key,
                visibility: key === '' ? 'hidden' : 'visible'
              }}
              onClick={() => key === '⌫' ? handleDelete() : handlePinInput(key.toString())}
            >
              {key}
            </button>
          ))}
        </div>

        {/* Botón de instalar */}
        {showInstall && !isInstalled && (
          <button style={styles.installBtn} onClick={handleInstallClick}>
            📲 Instalar App
          </button>
        )}

        {isInstalled && (
          <p style={styles.installedText}>✓ App instalada</p>
        )}
      </div>
      
      <footer style={styles.footer}>
        Creado por C19 Sage | Colmena 2026
      </footer>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)'
  },
  card: {
    background: '#1a1a1a',
    borderRadius: '24px',
    padding: '2rem',
    width: '100%',
    maxWidth: '340px',
    textAlign: 'center'
  },
  icon: { fontSize: '4rem', marginBottom: '1rem' },
  title: { fontSize: '1.8rem', marginBottom: '0.25rem' },
  subtitle: { color: '#888', marginBottom: '2rem' },
  message: { color: '#4ade80', marginBottom: '1.5rem', fontSize: '0.95rem' },
  pinDisplay: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '1.5rem'
  },
  pinDot: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: '2px solid #4ade80',
    transition: 'background 0.15s'
  },
  error: { color: '#f87171', marginBottom: '1rem', fontSize: '0.9rem' },
  keypad: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    maxWidth: '260px',
    margin: '0 auto'
  },
  key: {
    background: '#2a2a2a',
    border: 'none',
    borderRadius: '50%',
    width: '70px',
    height: '70px',
    fontSize: '1.5rem',
    color: '#fff',
    cursor: 'pointer',
    transition: 'background 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  installBtn: {
    marginTop: '1.5rem',
    background: 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)',
    border: 'none',
    borderRadius: '12px',
    padding: '0.875rem 1.5rem',
    fontSize: '1rem',
    fontWeight: '600',
    color: '#000',
    cursor: 'pointer',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem'
  },
  installedText: {
    marginTop: '1.5rem',
    color: '#4ade80',
    fontSize: '0.9rem'
  },
  footer: {
    marginTop: '2rem',
    color: '#555',
    fontSize: '0.8rem'
  }
}
