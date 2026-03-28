import Image from 'next/image'

interface MascotIconProps {
  size?: number
  className?: string
  bg?: 'default' | 'panel' | 'surface'
}

export default function MascotIcon({ size = 24, className = '', bg = 'default' }: MascotIconProps) {
  const src = bg === 'panel' ? '/mascot-panel.png' : bg === 'surface' ? '/mascot-surface.png' : '/mascot.png'
  return (
    <Image
      src={src}
      alt="MoltOS"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain' }}
    />
  )
}
