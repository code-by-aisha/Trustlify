import { motion, useTransform } from 'framer-motion'
import type { ReactNode } from 'react'
import type { MotionValue } from 'framer-motion'
import type { HeroPointerValues } from './HeroPointerController'
import type { HeroScrollValues } from './HeroScrollController'
import instagramImg from '@/assets/posts/instagram-scholarship.png'
import linkedinImg from '@/assets/posts/linkedin-opportunity.png'
import posterImg from '@/assets/posts/fellowship-poster.png'
import whatsappImg from '@/assets/posts/whatsapp-message.png'
import pdfImg from '@/assets/posts/pdf-eligibility.png'

type Depth = 'far' | 'mid' | 'fg'

interface ArtifactShellProps {
  children: ReactNode
  className: string
  convergence: MotionValue<number>
  opacity: MotionValue<number>
  scatter: { x: number; y: number; r: number; scale: number; blur: number }
  focus: { x: number; y: number; r: number; scale: number; blur: number }
  pointer: HeroPointerValues
  depth: Depth
}

function ArtifactShell({ children, className, convergence, opacity, scatter, focus, pointer, depth }: ArtifactShellProps) {
  const x = useTransform(convergence, [0, 1], [scatter.x, focus.x])
  const y = useTransform(convergence, [0, 1], [scatter.y, focus.y])
  const rotate = useTransform(convergence, [0, 1], [scatter.r, focus.r])
  const scale = useTransform(convergence, [0, 1], [scatter.scale, focus.scale])
  const blur = useTransform(convergence, [0, 1], [`blur(${scatter.blur}px)`, `blur(${focus.blur}px)`])
  const px = depth === 'fg' ? pointer.fgX : depth === 'mid' ? pointer.midX : pointer.farX
  const py = depth === 'fg' ? pointer.fgY : depth === 'mid' ? pointer.midY : pointer.farY

  return (
    <motion.div className={className} style={{ x, y, rotate, scale, opacity, filter: blur }}>
      <motion.div style={{ x: px, y: py }}>
        {children}
      </motion.div>
    </motion.div>
  )
}

function VisualPostCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`hero-artifact border border-white/[0.08] bg-[rgba(17,17,24,0.82)] shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-xl overflow-hidden ${className}`}>
      {children}
    </div>
  )
}

/* ─── Instagram Scholarship Post ──────────────────────────────────────────── */

export function InstagramArtifact() {
  return (
    <VisualPostCard className="w-[300px] rounded-[22px]">
      {/* Platform header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[#F5B942] via-[#C13584] to-[#7C3AED] text-[9px] font-bold text-white">IG</div>
          <div>
            <div className="font-mono text-[10px] font-medium text-bone">career.growth.pk</div>
            <div className="font-mono text-[8px] text-dim">Sponsored</div>
          </div>
        </div>
        <div className="font-mono text-[10px] text-dim">•••</div>
      </div>
      {/* Image area */}
      <div className="relative aspect-[3/4] overflow-hidden">
        <img src={instagramImg} alt="" className="h-full w-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(10,10,15,0.6)] via-transparent to-transparent" />
      </div>
      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2.5 font-mono text-[10px] text-dim">
        <span>♡ 1,248   ◇ 32</span><span>fictional demo</span>
      </div>
    </VisualPostCard>
  )
}

/* ─── LinkedIn Opportunity Post ───────────────────────────────────────────── */

export function LinkedInArtifact() {
  return (
    <VisualPostCard className="w-[310px] rounded-[22px]">
      {/* Platform header */}
      <div className="flex items-start justify-between px-3.5 py-2.5">
        <div className="flex gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-[#0A66C2] text-[10px] font-bold text-white">in</div>
          <div>
            <div className="font-mono text-[11px] font-medium text-bone">BrightPath Internships</div>
            <div className="font-mono text-[9px] text-dim">Opportunity · 2d</div>
          </div>
        </div>
        <span className="text-[14px] text-soft/60">×</span>
      </div>
      {/* Image area */}
      <div className="relative aspect-[3/4] overflow-hidden">
        <img src={linkedinImg} alt="" className="h-full w-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(10,10,15,0.5)] via-transparent to-transparent" />
      </div>
      {/* Footer */}
      <div className="flex items-center justify-between px-3.5 py-2.5 font-mono text-[10px] text-dim">
        <span>●● 345</span><span>22 comments</span>
      </div>
    </VisualPostCard>
  )
}

/* ─── Scholarship Poster ──────────────────────────────────────────────────── */

export function PosterArtifact() {
  return (
    <VisualPostCard className="w-[280px] rounded-[18px]">
      {/* Minimal header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="h-1.5 w-8 rounded-full bg-caution/80" />
        <span className="font-mono text-[8px] tracking-wider text-dim">POSTER</span>
      </div>
      {/* Image area */}
      <div className="relative aspect-[3/4.2] overflow-hidden">
        <img src={posterImg} alt="" className="h-full w-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(10,10,15,0.4)] via-transparent to-transparent" />
      </div>
      {/* Footer */}
      <div className="px-3 py-2 font-mono text-[9px] text-dim">
        demo-poster.example/apply
      </div>
    </VisualPostCard>
  )
}

/* ─── WhatsApp Message ────────────────────────────────────────────────────── */

export function WhatsAppArtifact() {
  return (
    <VisualPostCard className="w-[290px] rounded-[22px]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 font-mono text-[10px] text-[#25D366]">
        <span>↗</span><span className="font-medium">Forwarded</span>
      </div>
      {/* Image area */}
      <div className="relative aspect-[3/3.5] overflow-hidden">
        <img src={whatsappImg} alt="" className="h-full w-full object-cover" loading="lazy" />
      </div>
      {/* Footer */}
      <div className="flex items-center justify-end gap-2 px-3.5 py-2 font-mono text-[9px] text-dim">
        <span>9:41 PM</span><span className="text-[#25D366]">✓✓</span>
      </div>
    </VisualPostCard>
  )
}

/* ─── PDF Document ────────────────────────────────────────────────────────── */

export function PDFArtifact() {
  return (
    <VisualPostCard className="w-[270px] rounded-[18px]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="rounded bg-danger px-1.5 py-0.5 font-mono text-[8px] font-bold text-bone">PDF</span>
          <span className="font-mono text-[9px] text-bone/80">HEC_Ug_Research_Award_2025.pdf</span>
        </div>
        <span className="text-[12px] text-dim">×</span>
      </div>
      {/* Image area */}
      <div className="relative aspect-[3/4] overflow-hidden">
        <img src={pdfImg} alt="" className="h-full w-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(10,10,15,0.3)] via-transparent to-transparent" />
      </div>
      {/* Footer */}
      <div className="px-3 py-2 font-mono text-[9px] text-dim">
        Page 3 of 8 · fictional demo
      </div>
    </VisualPostCard>
  )
}

/* ─── Comment Fragment (kept for compatibility) ──────────────────────────── */

export function CommentArtifact() {
  return (
    <VisualPostCard className="w-[190px] rounded-[18px] p-3">
      <div className="mb-2 flex items-center gap-2">
        <div className="grid h-7 w-7 place-items-center rounded-full bg-violet/25 font-mono text-[10px] text-violet">SA</div>
        <div className="font-mono text-[10px] text-bone">study_abroad.pk</div>
      </div>
      <p className="font-mono text-[11px] leading-relaxed text-soft">Received this last year. Genuine opportunity, check eligibility carefully.</p>
      <div className="mt-2 font-mono text-[9px] text-dim">♡ 18   ◇ 2</div>
    </VisualPostCard>
  )
}

/* ─── Legacy wrapper (kept for compatibility) ────────────────────────────── */

export function HeroArtifacts({ values, pointer }: { values: HeroScrollValues; pointer: HeroPointerValues }) {
  return (
    <div className="absolute inset-0 hidden pointer-events-none lg:block overflow-hidden" aria-hidden="true">
      <ArtifactShell className="absolute left-[38%] top-[10%]" depth="mid" pointer={pointer} convergence={values.artifactConvergence} opacity={values.noiseOpacity} scatter={{ x: -48, y: -16, r: -6, scale: 1, blur: 0 }} focus={{ x: -6, y: 12, r: -2, scale: 0.88, blur: 0 }}><InstagramArtifact /></ArtifactShell>
      <ArtifactShell className="absolute left-[46%] top-[13%]" depth="mid" pointer={pointer} convergence={values.artifactConvergence} opacity={values.noiseOpacity} scatter={{ x: 28, y: -6, r: 2, scale: 1, blur: 0 }} focus={{ x: -48, y: 32, r: 1, scale: 0.82, blur: 0 }}><LinkedInArtifact /></ArtifactShell>
      <ArtifactShell className="absolute right-[10%] top-[22%]" depth="far" pointer={pointer} convergence={values.artifactConvergence} opacity={values.noiseOpacity} scatter={{ x: 36, y: 8, r: 4, scale: 0.92, blur: 0.2 }} focus={{ x: -32, y: 8, r: 1, scale: 0.7, blur: 1.2 }}><PosterArtifact /></ArtifactShell>
      <ArtifactShell className="absolute right-[12%] top-[20%]" depth="fg" pointer={pointer} convergence={values.artifactConvergence} opacity={values.noiseOpacity} scatter={{ x: 32, y: -6, r: 4, scale: 1, blur: 0 }} focus={{ x: -60, y: 42, r: 1, scale: 0.8, blur: 0 }}><WhatsAppArtifact /></ArtifactShell>
      <ArtifactShell className="absolute left-[34%] bottom-[16%]" depth="fg" pointer={pointer} convergence={values.artifactConvergence} opacity={values.noiseOpacity} scatter={{ x: -20, y: 48, r: -7, scale: 0.94, blur: 0 }} focus={{ x: 38, y: -24, r: -3, scale: 0.76, blur: 0.5 }}><PDFArtifact /></ArtifactShell>
      <ArtifactShell className="absolute left-[40%] bottom-[24%]" depth="far" pointer={pointer} convergence={values.artifactConvergence} opacity={values.noiseOpacity} scatter={{ x: -28, y: 22, r: -2, scale: 0.86, blur: 0.5 }} focus={{ x: -6, y: -8, r: 0, scale: 0.72, blur: 1 }}><CommentArtifact /></ArtifactShell>
    </div>
  )
}
