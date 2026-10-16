import './LogoLoop.css'

/**
 * LogoLoop — Horizontally scrolling infinite logo/icon strip.
 * Props:
 *   logos        – array of { id, node } objects
 *   speed        – animation duration in seconds (default: 28)
 *   direction    – 'left' | 'right' (default: 'left')
 *   logoHeight   – icon height in px (default: 28)
 *   gap          – horizontal gap between items in px (default: 32)
 *   hoverSpeed   – duration when hovering in seconds (default: 60)
 *   bgColor      – background color for edge fade (default: '#FAF9F4')
 *   className    – extra class on root
 */
export default function LogoLoop({
  logos      = [],
  speed      = 28,
  direction  = 'left',
  logoHeight = 28,
  gap        = 32,
  hoverSpeed = 60,
  bgColor    = '#FAF9F4',
  className  = '',
  style      = {},
}) {
  if (!logos.length) return null

  /* Duplicate logos for seamless loop */
  const doubled = [...logos, ...logos]

  return (
    <div
      className={`logo-loop-root ${className}`}
      style={{
        '--logo-loop-duration':       `${speed}s`,
        '--logo-loop-hover-duration': `${hoverSpeed}s`,
        '--logo-loop-direction':      direction === 'right' ? 'reverse' : 'normal',
        '--logo-loop-icon-height':    `${logoHeight}px`,
        '--logo-loop-gap':            `${gap}px`,
        '--logo-loop-bg':             bgColor,
        '--logo-loop-height':         `${logoHeight + 24}px`,
        ...style,
      }}
      aria-hidden="true"
    >
      <div className="logo-loop-track">
        {doubled.map((logo, idx) => (
          <div key={`${logo.id}-${idx}`} className="logo-loop-item">
            {logo.node}
          </div>
        ))}
      </div>
    </div>
  )
}
