import Image from 'next/image'
import MascotIcon from '@/components/MascotIcon'

interface MascotIconProps {
  size?: number
  className?: string
}

export default function MascotIcon({ size = 24, className = '' }: MascotIconProps) {
  return (
    <Image
      src="/mascot.png"
      alt="MoltOS"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain' }}
    />
  )
}
