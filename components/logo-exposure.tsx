// Logo oficial de EXPOSURE: estrella de cuatro puntas diagonales llenas con un
// cuerpo cóncavo, más cuatro puntas finas (norte, sur, este, oeste) dibujadas en
// línea. Es el mismo trazado que public/logo-exposure.svg y public/icon.svg.
// `tile` lo pone sobre una baldosa clara redondeada (para el header oscuro del CRM).

export function LogoExposureMark({ size = 34, color = "currentColor", className, title = "EXPOSURE" }: { size?: number; color?: string; className?: string; title?: string }) {
  return (
    <svg viewBox="-110 -110 220 220" width={size} height={size} className={className} role="img" aria-label={title}>
      <title>{title}</title>
      <path
        d="M 0 -25 Q 24 -24 70.7 -70.7 Q 24 -24 25 0 Q 24 24 70.7 70.7 Q 24 24 0 25 Q -24 24 -70.7 70.7 Q -24 24 -25 0 Q -24 -24 -70.7 -70.7 Q -24 -24 0 -25 Z"
        fill={color}
      />
      <path
        d="M -11 -23 Q -3 -40 0 -100 Q 3 -40 11 -23 M 11 -23 M 23 -11 Q 40 -3 100 0 Q 40 3 23 11 M 11 23 Q 3 40 0 100 Q -3 40 -11 23 M -23 11 Q -40 3 -100 0 Q -40 -3 -23 -11"
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function LogoExposure({ size = 34, radius = 11, className }: { size?: number; radius?: number; className?: string }) {
  return (
    <span
      className={className}
      style={{ width: size, height: size, borderRadius: radius, display: "inline-grid", placeItems: "center", background: "#f2f1ee", boxShadow: "0 0 0 1px rgba(255,255,255,.08), 0 6px 18px rgba(0,0,0,.35)", flex: "0 0 auto" }}
    >
      <LogoExposureMark size={Math.round(size * 0.74)} color="#111114" />
    </span>
  )
}
