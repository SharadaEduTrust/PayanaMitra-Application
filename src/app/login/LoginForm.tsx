'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

/* ─── Deterministic star positions (seeded to avoid hydration mismatch) ── */
function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}
const rand = seededRandom(42)
const STARS = Array.from({ length: 40 }, () => ({
  size:    rand() * 2 + 1,
  top:     rand() * 65,
  left:    rand() * 100,
  opacity: rand() * 0.5 + 0.1,
  pulse:   rand() * 3 + 2,
  delay:   rand() * 3,
}))

function MountainLogo() {
  return (
    <svg width="56" height="48" viewBox="0 0 56 48" fill="none" aria-hidden="true">
      <path
        d="M28 4L8 40h40L28 4z"
        fill="none"
        stroke="url(#goldGrad)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M14 40l14-20 14 20"
        fill="none"
        stroke="url(#goldGrad)"
        strokeWidth="2"
        strokeLinejoin="round"
        opacity="0.5"
      />
      <path
        d="M24 16l4-7 4 7"
        fill="url(#goldGrad)"
        opacity="0.8"
      />
      <defs>
        <linearGradient id="goldGrad" x1="0" y1="0" x2="56" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D4A843" />
          <stop offset="1" stopColor="#F0C060" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.07 12a19.79 19.79 0 0 1-3-8.59A2 2 0 0 1 3 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 5.93 5.93l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z"/>
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

/* ─── Mountain SVG background (bottom scene) ─────────────────── */
function MountainScene() {
  return (
    <svg
      viewBox="0 0 390 220"
      preserveAspectRatio="xMidYMax meet"
      className="absolute bottom-0 left-0 w-full pointer-events-none select-none"
      aria-hidden="true"
    >
      {/* Back mountains */}
      <polygon points="0,220 60,80 120,220" fill="oklch(0.18 0.07 255 / 0.6)" />
      <polygon points="60,220 160,40 260,220" fill="oklch(0.20 0.08 255 / 0.5)" />
      <polygon points="200,220 310,70 390,220" fill="oklch(0.18 0.07 255 / 0.6)" />
      {/* Front mountains */}
      <polygon points="0,220 80,130 160,220" fill="oklch(0.14 0.05 255 / 0.85)" />
      <polygon points="130,220 230,90 330,220" fill="oklch(0.13 0.05 255 / 0.9)" />
      <polygon points="280,220 370,140 390,220" fill="oklch(0.14 0.05 255 / 0.85)" />
      {/* Snow caps */}
      <polygon points="160,40 150,70 170,70" fill="oklch(0.90 0.01 240 / 0.25)" />
      <polygon points="310,70 300,95 320,95" fill="oklch(0.90 0.01 240 / 0.20)" />
    </svg>
  )
}

/* ─── Main Login Form ─────────────────────────────────────────── */
export default function LoginForm() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const pinRef = useRef<HTMLInputElement>(null)

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10)
    setPhone(val)
    setError('')
    if (val.length === 10) pinRef.current?.focus()
  }, [])

  const handlePinChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4)
    setPin(val)
    setError('')
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (phone.length !== 10) { setError('Enter a valid 10-digit phone number.'); return }
    if (pin.length !== 4) { setError('Enter your 4-digit PIN.'); return }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Login failed. Please try again.')
        return
      }

      // Redirect based on role
      if (data.mustChangePassword) {
        router.push('/change-pin')
      } else if (data.role === 'admin') {
        router.push('/admin')
      } else if (data.role === 'leader') {
        router.push('/leader')
      } else {
        router.push('/app')
      }
    } catch {
      setError('Network error. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }, [phone, pin, router])

  const isReady = phone.length === 10 && pin.length === 4 && !loading

  return (
    <div className="dark relative min-h-screen w-full bg-mountain flex flex-col items-center justify-start overflow-hidden">

      {/* Stars — deterministic positions to avoid hydration mismatch */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {STARS.map((s, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: s.size + 'px',
              height: s.size + 'px',
              top: s.top + '%',
              left: s.left + '%',
              opacity: s.opacity,
              animation: `pulse ${s.pulse}s ease-in-out infinite`,
              animationDelay: s.delay + 's',
            }}
          />
        ))}
      </div>

      {/* Mountain scene */}
      <MountainScene />

      {/* Content */}
      <div className="relative z-10 w-full max-w-sm mx-auto px-6 pt-16 pb-36 flex flex-col items-center gap-8 fade-in">

        {/* Logo + Branding */}
        <div className="flex flex-col items-center gap-3 text-center">
          <MountainLogo />
          <h1 className="text-4xl font-bold text-white tracking-tight mt-1" style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}>
            Payana Mitra
          </h1>
          <p className="shimmer text-sm font-medium tracking-wider uppercase">
            Your Travel Companion
          </p>
        </div>

        {/* Login card */}
        <div className="glass rounded-3xl w-full p-6 flex flex-col gap-5">
          <p className="text-white/70 text-sm text-center">
            Sign in with your registered phone number
          </p>

          <form id="login-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">

            {/* Phone field */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="phone-input" className="text-xs font-medium text-white/60 uppercase tracking-wider">
                Phone Number
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40">
                  <PhoneIcon />
                </span>
                <input
                  id="phone-input"
                  type="tel"
                  inputMode="numeric"
                  pattern="\d{10}"
                  maxLength={10}
                  autoComplete="tel"
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={handlePhoneChange}
                  disabled={loading}
                  className="w-full bg-white/8 border border-white/15 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)] transition-colors disabled:opacity-50"
                  aria-label="Phone number"
                  aria-required="true"
                />
              </div>
            </div>

            {/* PIN field */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="pin-input" className="text-xs font-medium text-white/60 uppercase tracking-wider">
                4-digit PIN
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40">
                  <LockIcon />
                </span>
                <input
                  id="pin-input"
                  ref={pinRef}
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  autoComplete="current-password"
                  placeholder="••••"
                  value={pin}
                  onChange={handlePinChange}
                  disabled={loading}
                  className="w-full bg-white/8 border border-white/15 rounded-xl pl-10 pr-11 py-3 text-white placeholder:text-white/30 text-sm tracking-[0.4em] focus:outline-none focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)] transition-colors disabled:opacity-50"
                  aria-label="4-digit PIN"
                  aria-required="true"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                  aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                >
                  <EyeIcon open={showPin} />
                </button>
              </div>
              <p className="text-white/35 text-xs mt-0.5">
                Default: last 4 digits of your phone number
              </p>
            </div>

            {/* Error */}
            {error && (
              <div
                role="alert"
                className="bg-red-500/15 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm flex items-center gap-2"
              >
                <span className="text-red-400">⚠</span>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={!isReady}
              className="btn-gold w-full rounded-xl py-3.5 text-sm font-semibold mt-1 flex items-center justify-center gap-2"
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-white/25 text-xs text-center">
          Trouble signing in? Contact your trip coordinator.
        </p>
      </div>

      {/* Bottom brand */}
      <div className="absolute bottom-4 w-full text-center z-10">
        <p className="text-white/20 text-xs tracking-widest uppercase">Payana Trails</p>
      </div>
    </div>
  )
}
