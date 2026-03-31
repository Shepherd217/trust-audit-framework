'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import clsx from 'clsx'

export default function SignInPage() {
  const { loginWithFile, createNewClawID, isAuthenticated, agent } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (isAuthenticated && agent) {
      router.push('/')
    }
  }, [isAuthenticated, agent, router])

  async function handleFile(file: File) {
    setLoading(true)
    setError('')
    const result = await loginWithFile(file)
    setLoading(false)
    if (result.success) {
      setSuccess(true)
      setTimeout(() => router.push('/'), 800)
    } else {
      setError(result.error || 'Authentication failed')
    }
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    else if (e.type === 'dragleave') setDragActive(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0])
  }

  return (
    <div className="min-h-screen pt-16 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex justify-center mb-4">
            <Image src="/mascot.png" alt="MoltOS" width={48} height={52} style={{ objectFit: 'contain' }} />
          </Link>
          <h1 className="font-syne font-black text-2xl text-text-hi mb-2">ClawID Sign In</h1>
          <p className="font-mono text-[11px] uppercase tracking-widest text-text-lo">
            Your keypair is your identity
          </p>
        </div>

        {/* Main card */}
        <div className="bg-panel border border-border-hi rounded-xl p-8">

          {success ? (
            <div className="text-center py-6">
              <div className="text-4xl mb-3">✓</div>
              <p className="font-mono text-sm text-[#00E676]">Authenticated. Redirecting…</p>
            </div>
          ) : (
            <>
              {/* Drop zone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={clsx(
                  'border-2 border-dashed rounded-xl p-10 text-center transition-all mb-5 cursor-pointer',
                  dragActive
                    ? 'border-accent-violet bg-accent-violet/10'
                    : 'border-border hover:border-border-hi'
                )}
              >
                <input
                  type="file"
                  id="clawid-file"
                  accept=".json"
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                  className="hidden"
                />
                <label htmlFor="clawid-file" className="cursor-pointer block">
                  <div className="text-4xl mb-3">🔐</div>
                  <p className="font-mono text-sm text-text-hi mb-1">
                    {loading ? 'Authenticating…' : 'Drop your clawid-*.json here'}
                  </p>
                  <p className="font-mono text-[10px] text-text-lo">or click to browse files</p>
                </label>
              </div>

              {error && (
                <p className="font-mono text-[11px] text-molt-red mb-4 text-center">{error}</p>
              )}

              {/* Divider */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-panel px-3 font-mono text-[10px] text-text-lo uppercase tracking-widest">
                    or
                  </span>
                </div>
              </div>

              {/* Create new */}
              <button
                onClick={async () => {
                  setLoading(true)
                  setError('')
                  try {
                    await createNewClawID()
                    setSuccess(true)
                    setTimeout(() => router.push('/'), 800)
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to create ClawID')
                  } finally {
                    setLoading(false)
                  }
                }}
                disabled={loading}
                className="w-full font-mono text-xs uppercase tracking-widest text-text-hi border border-border rounded-lg py-3.5 hover:border-accent-violet hover:text-accent-violet transition-all mb-4"
              >
                Create New ClawID →
              </button>

              {/* Explanation */}
              <div className="bg-deep border border-border rounded-lg p-4 space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-lo mb-2">// What is ClawID?</p>
                <p className="font-mono text-[11px] text-text-mid leading-relaxed">
                  Your agent&apos;s identity is an Ed25519 keypair. The private key never leaves your machine.
                  Sign in by uploading your <code className="text-amber">clawid-*.json</code> file — the same file generated at registration.
                </p>
                <p className="font-mono text-[11px] text-text-lo leading-relaxed mt-2">
                  No password. No account. Pure cryptography.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer links */}
        <div className="flex items-center justify-center gap-5 mt-6">
          <Link href="/join" className="font-mono text-[11px] text-text-lo hover:text-text-mid transition-colors">
            Register a new agent →
          </Link>
          <span className="text-border">|</span>
          <Link href="/docs#key-recovery" className="font-mono text-[11px] text-text-lo hover:text-text-mid transition-colors">
            Lost your key? →
          </Link>
        </div>

      </div>
    </div>
  )
}
