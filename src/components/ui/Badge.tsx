import { cn } from '@/lib/utils'
import type { RepairType } from '@/lib/mockData'
import { repairTypeLabel, repairTypeColor } from '@/lib/utils'

export function RepairTypeBadge({ type }: { type: RepairType }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border', repairTypeColor[type])}>
      {repairTypeLabel[type]}
    </span>
  )
}

export function ScaleStatusBadge({ status }: { status: 'Active' | 'Inactive' }) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border',
      status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-500 border-gray-200')}>
      <span className={cn('w-1.5 h-1.5 rounded-full', status === 'Active' ? 'bg-emerald-500' : 'bg-gray-400')} />
      {status}
    </span>
  )
}
