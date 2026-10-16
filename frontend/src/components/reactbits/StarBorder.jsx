import './StarBorder.css'

/**
 * StarBorder — animated conic-gradient border that rotates around the element.
 * Props:
 *   as       – HTML tag or component to render (default: 'button')
 *   color    – star/beam color (default: '#537B60' sage-green)
 *   speed    – animation duration (default: '6s')
 *   thickness – inner gap before content (default: '1.5px')
 *   theme    – 'light' | 'dark' (default: 'light')
 *   className – classes for the inner content wrapper
 *   children  – content inside
 *   ...rest   – forwarded to the root element (onClick, href, etc.)
 */
export default function StarBorder({
  as: Tag     = 'button',
  color       = '#537B60',
  speed       = '6s',
  thickness   = '1.5px',
  theme       = 'light',
  className   = '',
  children,
  style       = {},
  ...rest
}) {
  const surfaceBg = theme === 'light' ? '#FFFFFF' : '#1A1F1C'

  return (
    <Tag
      className="star-border-container"
      data-theme={theme}
      style={{
        '--star-border-color': color,
        '--star-border-speed': speed,
        borderRadius: '10px',
        ...style,
      }}
      {...rest}
    >
      {/* Rotating gradient track */}
      <span className="star-border-track" aria-hidden="true">
        <span className="star-border-gradient" />
      </span>
      {/* Inner surface that masks the gradient to show only the border */}
      <span
        className="star-border-surface"
        aria-hidden="true"
        style={{
          background: surfaceBg,
          inset: thickness,
        }}
      />
      {/* Content */}
      <span className={`star-border-inner ${className}`}>
        {children}
      </span>
    </Tag>
  )
}
