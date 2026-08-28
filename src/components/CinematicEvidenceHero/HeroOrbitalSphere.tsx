import { motion } from 'framer-motion'
import type { MotionValue } from 'framer-motion'

interface HeroOrbitalSphereProps {
  opacity: MotionValue<number>
  scale: MotionValue<number>
  x: MotionValue<number>
  y: MotionValue<number>
}

const particles = Array.from({ length: 34 }, (_, i) => ({
  id: i,
  x: 50 + Math.cos((i / 34) * Math.PI * 2) * (22 + (i % 5) * 4),
  y: 50 + Math.sin((i / 34) * Math.PI * 2) * (14 + (i % 4) * 3),
  r: i % 7 === 0 ? 1.8 : i % 3 === 0 ? 1.2 : 0.8,
  delay: `${(i % 9) * 0.35}s`,
}))

export function HeroOrbitalSphere({ opacity, scale, x, y }: HeroOrbitalSphereProps) {
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      style={{ opacity, scale, x, y }}
      aria-hidden="true"
    >
      {/* Outer glow blob — very present from the start */}
      <div className="absolute left-[30%] top-[5%] h-[88vh] w-[66vw] max-w-[960px] min-w-[580px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,0.18)_0%,rgba(124,58,237,0.07)_35%,transparent_68%)] blur-[1px]" />
      <svg className="absolute left-[31%] top-[7%] h-[84vh] w-[64vw] max-w-[980px] min-w-[680px]" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="sphereGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.18" />
            <stop offset="55%" stopColor="#7C3AED" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="ringStroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.04" />
            <stop offset="45%" stopColor="#A855F7" stopOpacity="0.44" />
            <stop offset="100%" stopColor="#A3FF12" stopOpacity="0.12" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="28" fill="url(#sphereGlow)" />
        <g className="hero-orbit-slow" fill="none" stroke="url(#ringStroke)" strokeWidth="0.12">
          <ellipse cx="50" cy="50" rx="35" ry="14" transform="rotate(-18 50 50)" />
          <ellipse cx="50" cy="50" rx="38" ry="18" transform="rotate(18 50 50)" />
          <ellipse cx="50" cy="50" rx="28" ry="34" transform="rotate(64 50 50)" />
          <ellipse cx="50" cy="50" rx="24" ry="37" transform="rotate(-55 50 50)" />
        </g>
        <g opacity="0.5" stroke="rgba(124,58,237,0.32)" strokeWidth="0.08">
          <path d="M23 45 C37 33, 53 31, 75 41" fill="none" />
          <path d="M31 66 C46 72, 61 67, 78 53" fill="none" />
          <path d="M42 18 C52 32, 58 45, 55 79" fill="none" />
        </g>
        <g>
          {particles.map((p) => (
            <circle key={p.id} cx={p.x} cy={p.y} r={p.r} fill={p.id % 6 === 0 ? '#A3FF12' : '#A855F7'} opacity={p.id % 6 === 0 ? 0.45 : 0.35} className="hero-particle-pulse" style={{ animationDelay: p.delay }} />
          ))}
        </g>
      </svg>
    </motion.div>
  )
}
