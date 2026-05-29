import { Star } from 'lucide-react'

export function StarBadge({ size = 14 }: { size?: number }) {
  return <Star size={size} className="text-yellow-500 fill-yellow-400 shrink-0" />
}
