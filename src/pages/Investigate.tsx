import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AppShell } from '@/components/AppShell'
import { Button } from '@/components/ui'
import { apiFetch } from '@/lib/supabase'

type InputMode = 'link' | 'text' | 'image'

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'application/pdf']
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
const MAX_QUESTION_LENGTH = 500

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export default function Investigate() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<InputMode>('link')
  const [input, setInput] = useState('')
  const [dragging, setDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  /* Optional question — stored and shown separately from the investigated content */
  const [question, setQuestion] = useState('')

  /* Image upload state */
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  /* Text typed alongside an image — both are kept in the SAME investigation */
  const [imageNote, setImageNote] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const examplePlaceholders: Record<InputMode, string> = {
    link: 'https://apply-scholarship.com/fund2025\n\nPaste any URL, link, or website address to investigate.',
    text: 'Ye scholarship genuine hai? deadline kya hai?\n\nPaste any post, WhatsApp message, social media content, job description, or claim.',
    image: '',
  }

  const validateFile = (f: File): string | null => {
    if (!ACCEPTED_TYPES.includes(f.type)) return 'Unsupported file type. Use PNG, JPG, or PDF.'
    if (f.size > MAX_FILE_SIZE) return `File too large (${formatFileSize(f.size)}). Maximum is 20MB.`
    return null
  }

  const handleFile = (f: File) => {
    const error = validateFile(f)
    if (error) {
      setFileError(error)
      setFile(null)
      setFilePreview(null)
      return
    }
    setFileError(null)
    setFile(f)
    if (f.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => setFilePreview(e.target?.result as string)
      reader.readAsDataURL(f)
    } else {
      setFilePreview(null)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
    e.target.value = ''
  }

  const removeFile = () => {
    setFile(null)
    setFilePreview(null)
    setFileError(null)
  }

  /** Sent only when non-empty — an omitted question changes nothing upstream. */
  const questionField = () => {
    const trimmed = question.trim()
    return trimmed ? { investigationQuestion: trimmed.slice(0, MAX_QUESTION_LENGTH) } : {}
  }

  const handleInvestigate = async () => {
    setError('')
    setSubmitting(true)

    try {
      if (mode === 'image') {
        if (!file) return
        // Upload file first, then create investigation
        const formData = new FormData()
        formData.append('file', file)

        const { data: { session } } = await import('@/lib/supabase').then(m => m.supabase.auth.getSession())
        const token = session?.access_token

        const uploadRes = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/uploads`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData,
        })

        if (!uploadRes.ok) throw new Error('Upload failed')
        const uploadData = await uploadRes.json()

        const res = await apiFetch('/api/investigations', {
          method: 'POST',
          body: JSON.stringify({
            inputType: file.type === 'application/pdf' ? 'pdf' : 'image',
            inputFilePath: uploadData.data.storagePath,
            // Text typed with the image is preserved, never replaced by it
            ...(imageNote.trim() ? { inputText: imageNote.trim() } : {}),
            ...questionField(),
          }),
        })

        // Start the pipeline — the backend executor runs it asynchronously
        await apiFetch(`/api/investigations/${res.data.id}/start`, { method: 'POST' })

        navigate(`/investigation/${res.data.id}/progress`)
      } else {
        const res = await apiFetch('/api/investigations', {
          method: 'POST',
          body: JSON.stringify({
            inputType: mode === 'link' ? 'url' : 'text',
            inputText: input.trim(),
            ...questionField(),
          }),
        })

        // Start the pipeline — the backend executor runs it asynchronously
        await apiFetch(`/api/investigations/${res.data.id}/start`, { method: 'POST' })

        navigate(`/investigation/${res.data.id}/progress`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create investigation')
    } finally {
      setSubmitting(false)
    }
  }

  const canInvestigate = mode === 'image' ? !!file : !!input.trim()

  return (
    <AppShell>
      <div className="pt-16 min-h-screen flex items-center justify-center px-4 py-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-2xl">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="h-px w-10 bg-violet" />
              <span className="font-mono text-xs tracking-[0.2em] text-violet">NEW INVESTIGATION</span>
              <div className="h-px w-10 bg-violet" />
            </div>
            <h1 className="font-display mb-3" style={{ fontSize: 'clamp(36px,5vw,64px)', fontWeight: 300 }}>
              WHAT DO YOU WANT<br />TO INVESTIGATE?
            </h1>
            <p className="font-mono text-sm text-dim">Paste a scholarship, internship, job, website, post, message, or claim.</p>
          </div>

          {/* Error */}
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="mb-4 px-4 py-3 rounded-xl border border-[rgba(255,77,94,0.25)] bg-[rgba(255,77,94,0.06)]">
              <span className="font-mono text-xs text-danger">{error}</span>
            </motion.div>
          )}

          {/* Mode selector */}
          <div className="flex gap-2 mb-6 bg-surface p-1.5 rounded-2xl border border-white/[0.06]">
            {([
              { key: 'link' as const, label: 'PASTE LINK', icon: '🔗' },
              { key: 'text' as const, label: 'PASTE TEXT', icon: '📋' },
              { key: 'image' as const, label: 'UPLOAD IMAGE', icon: '🖼' },
            ]).map((item) => (
              <button key={item.key} onClick={() => { setMode(item.key); removeFile() }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-mono text-xs tracking-wider transition-all cursor-pointer ${
                  mode === item.key ? 'bg-violet text-white shadow-[0_0_16px_rgba(124,58,237,0.3)]' : 'text-dim hover:text-soft'
                }`}>
                <span className="hidden sm:inline">{item.icon}</span>{item.label}
              </button>
            ))}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.pdf"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Input area */}
          <div className="card-noir-violet p-1.5 mb-4">
            {mode !== 'image' ? (
              <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder={examplePlaceholders[mode]}
                className="w-full bg-transparent px-5 py-5 font-mono text-sm text-bone placeholder:text-dim focus:outline-none resize-none leading-relaxed"
                rows={7} autoFocus />
            ) : (
              <div>
                <AnimatePresence mode="wait">
                  {file ? (
                    <motion.div key="preview" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                      className="rounded-xl border border-white/10 p-5">
                      <div className="flex items-start gap-4">
                        {filePreview ? (
                          <div className="w-20 h-20 rounded-xl overflow-hidden border border-white/10 flex-shrink-0 bg-surface-2">
                            <img src={filePreview} alt="Upload preview" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-20 h-20 rounded-xl border border-white/10 flex-shrink-0 bg-surface-2 flex items-center justify-center">
                            <span className="text-2xl">📄</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-sm text-bone truncate mb-1">{file.name}</div>
                          <div className="font-mono text-[10px] text-dim">{formatFileSize(file.size)} · {file.type.includes('pdf') ? 'PDF' : 'Image'}</div>
                          <div className="mt-1 flex items-center gap-1">
                            <span className="text-lime text-[10px]">✓</span>
                            <span className="font-mono text-[10px] text-lime">Ready to investigate</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <button onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-1.5 rounded-lg border border-white/10 font-mono text-[10px] text-soft hover:text-bone hover:border-white/20 transition-all cursor-pointer">
                            REPLACE
                          </button>
                          <button onClick={removeFile}
                            className="px-3 py-1.5 rounded-lg border border-[rgba(255,77,94,0.2)] font-mono text-[10px] text-danger hover:border-[rgba(255,77,94,0.4)] transition-all cursor-pointer">
                            REMOVE
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="dropzone"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault()
                        setDragging(false)
                        const f = e.dataTransfer.files?.[0]
                        if (f) handleFile(f)
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className={`w-full rounded-xl border-2 border-dashed p-16 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer ${
                        dragging ? 'border-violet bg-[rgba(124,58,237,0.08)]' : 'border-white/10 hover:border-white/20'
                      }`}>
                      <div className="w-12 h-12 rounded-xl bg-[rgba(124,58,237,0.1)] flex items-center justify-center text-2xl">🖼</div>
                      <div className="text-center">
                        <div className="font-mono text-sm text-soft mb-1">Drop screenshot or PDF here</div>
                        <div className="font-mono text-xs text-dim">or click to browse · PNG, JPG, PDF up to 20MB</div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Text + image in ONE investigation — the file never replaces the text */}
                <div className="mt-3">
                  <div className="font-mono text-[10px] text-dim mb-1.5 tracking-wider">
                    ADD TEXT WITH THIS FILE (OPTIONAL)
                  </div>
                  <textarea value={imageNote} onChange={(e) => setImageNote(e.target.value)}
                    placeholder="Paste the post, message or link that goes with this screenshot — both are investigated together."
                    rows={3}
                    className="w-full bg-transparent px-4 py-3 rounded-xl border border-white/10 font-mono text-sm text-bone placeholder:text-dim focus:outline-none resize-none leading-relaxed" />
                </div>

                {fileError && (
                  <AnimatePresence>
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="mt-3 px-4 py-2.5 rounded-xl border border-[rgba(255,77,94,0.25)] bg-[rgba(255,77,94,0.06)]">
                      <div className="flex items-center gap-2">
                        <span className="text-danger text-xs">⚠</span>
                        <span className="font-mono text-[11px] text-danger">{fileError}</span>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>
            )}
          </div>

          {/* Optional question — stored separately from the investigated content */}
          <div className="mb-4 rounded-2xl border border-white/[0.06] bg-surface px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-[10px] tracking-wider text-dim">YOUR QUESTION (OPTIONAL)</span>
              <span className="font-mono text-[10px] text-dim">{question.trim().length}/500</span>
            </div>
            <input value={question} onChange={(e) => setQuestion(e.target.value)}
              maxLength={MAX_QUESTION_LENGTH}
              placeholder="e.g. Can I apply for this, and am I eligible?"
              className="w-full bg-transparent font-mono text-sm text-bone placeholder:text-dim focus:outline-none" />
            <p className="font-mono text-[10px] text-dim mt-1.5">
              Answered from the evidence this investigation collects — it never changes the verdict.
              Eligibility, deadline, “is this still active”, “is this real”, “explain this” and “find
              something similar” are recognised by keyword rules, not by a model call.
            </p>
          </div>

          <div className="flex items-center gap-3 mb-8">
            {mode === 'image' ? (
              <button onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl border border-white/[0.06] font-mono text-xs text-dim hover:text-soft hover:border-white/15 transition-all cursor-pointer flex items-center gap-2">
                📄 {file ? 'REPLACE FILE' : 'CHOOSE FILE'}
              </button>
            ) : (
              <button className="px-4 py-2 rounded-xl border border-white/[0.06] font-mono text-xs text-dim hover:text-soft hover:border-white/15 transition-all cursor-pointer flex items-center gap-2">
                📄 UPLOAD PDF
              </button>
            )}
            <div className="flex-1" />
            <span className="font-mono text-[10px] text-dim">Evidence, not guesses.</span>
          </div>

          <Button variant="lime" size="lg" className="w-full justify-center" onClick={handleInvestigate}
            disabled={!canInvestigate || submitting}>
            {submitting ? 'CREATING INVESTIGATION…' : 'INVESTIGATE →'}
          </Button>

          {/* Example prompts */}
          <div className="mt-8">
            <div className="font-mono text-[10px] text-dim mb-3 tracking-wider">TRY AN EXAMPLE</div>
            <div className="flex flex-wrap gap-2">
              {[
                'apply-scholarship.com/fund2025',
                'Ye scholarship genuine hai?',
                'HEC Research Fellowship 2025 application',
                'WhatsApp: Deadline extended to Aug 30',
              ].map((example) => (
                <button key={example}
                  onClick={() => { setMode(example.startsWith('http') || example.endsWith('.com/fund2025') ? 'link' : 'text'); setInput(example); removeFile() }}
                  className="px-3 py-1.5 rounded-full border border-white/[0.06] font-mono text-[10px] text-dim hover:text-soft hover:border-white/15 transition-all cursor-pointer">
                  {example.length > 30 ? example.slice(0, 30) + '…' : example}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </AppShell>
  )
}
