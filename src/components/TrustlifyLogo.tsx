export function TrustlifyLogo({ size = 7 }: { size?: number }) {
  const dim = size * 4
  const svgSize = size * 2
  return (
    <div
      className="rounded-lg bg-violet flex items-center justify-center flex-shrink-0"
      style={{ width: dim, height: dim, boxShadow: '0 0 12px rgba(124,58,237,0.5)' }}
    >
      <svg width={svgSize} height={svgSize} viewBox="0 0 14 14" fill="none">
        <path d="M7 1L12.5 4V10L7 13L1.5 10V4L7 1Z" stroke="#A3FF12" strokeWidth="1.2" fill="none" />
        <path d="M4.5 7L6.5 9L9.5 5.5" stroke="#A3FF12" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
