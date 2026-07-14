import { type ClassValue, clsx } from 'clsx'
import type { RepairType } from './mockData'

export function cn(...inputs: ClassValue[]) { return clsx(inputs) }

export function fmt(n: number | null | undefined): string {
  return Number(n || 0).toLocaleString('th-TH')
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return String(d)
  return dt.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
}

export const repairTypeLabel: Record<RepairType, string> = {
  self: 'ซ่อม / เปลี่ยนอะไหล่',
  ext:  'ส่งซ่อมภายนอก',
  both: 'ซ่อมเอง + ส่งนอก',
}

// ป้ายแบบย่อ ใช้ในตารางประวัติการซ่อม
export const repairTypeShortLabel: Record<RepairType, string> = {
  self: 'ซ่อม',
  ext:  'ส่งซ่อมนอก',
  both: 'ทั้งสองแบบ',
}

export const repairTypeIcon: Record<RepairType, string> = {
  self: 'ti-tool',
  ext:  'ti-truck',
  both: 'ti-stack-2',
}

export const repairTypeColor: Record<RepairType, string> = {
  self: 'bg-blue-50 text-blue-700 border-blue-200',
  ext:  'bg-amber-50 text-amber-700 border-amber-200',
  both: 'bg-purple-50 text-purple-700 border-purple-200',
}

// CalPlan helpers
export function cpAddMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

export function cpDaysUntil(dateStr: string): number {
  return Math.round((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

export function cpStatus(lastCal: string, intervalMonths: number) {
  const due  = cpAddMonths(lastCal, intervalMonths)
  const days = cpDaysUntil(due)
  if (days < 0)    return { label: 'เกินกำหนด',       cls: 'bg-red-50 text-red-700 border-red-200',     days, due }
  if (days <= 30)  return { label: 'ใกล้ครบกำหนด',    cls: 'bg-amber-50 text-amber-700 border-amber-200', days, due }
  return               { label: 'ปกติ',              cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', days, due }
}
