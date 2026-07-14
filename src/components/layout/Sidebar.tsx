'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { exportBackup, importBackup } from '@/lib/store'

const navGroups = [
  {
    label: 'DASHBOARD',
    items: [
      { href: '/dashboard', icon: 'ti-layout-dashboard', label: 'Dashboard' },
      { href: '/scaleview', icon: 'ti-search', label: 'Scale Overview' },
    ],
  },
  {
    label: 'Data Management',
    items: [
      { href: '/repairs/new', icon: 'ti-file-plus', label: 'Repair Record' },
      { href: '/repairs', icon: 'ti-tool', label: 'Repair History' },
    ],
  },
  {
    label: 'PLAN',
    items: [
      { href: '/calplan', icon: 'ti-calendar-check', label: 'Calibration Schedule' },
      { href: '/calibration', icon: 'ti-certificate', label: 'Balance Calibration' },
      { href: '/calregistry', icon: 'ti-list-check', label: 'Calibration Registry' },
    ],
  },
  {
    label: 'DATABASE',
    items: [
      { href: '/scales', icon: 'ti-scale', label: 'Scale Register' },
      { href: '/weights', icon: 'ti-weight', label: 'Test Weight Register' },
      { href: '/sections', icon: 'ti-building-factory', label: 'Departments' },
      { href: '/parts', icon: 'ti-package', label: 'Spare Parts' },
      { href: '/vendors', icon: 'ti-truck', label: 'Vendors' },
      { href: '/users', icon: 'ti-users', label: 'User Management' },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    if (href === '/repairs') return pathname === '/repairs' || (pathname.startsWith('/repairs/') && pathname !== '/repairs/new')
    return pathname.startsWith(href)
  }

  function handleBackup() {
    const data = exportBackup()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    a.href = url
    a.download = `scale_manager_backup_${stamp}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleRestoreClick() {
    if (!confirm('การ Restore จะแทนที่ข้อมูลทั้งหมดในระบบด้วยข้อมูลจากไฟล์ที่เลือก ต้องการดำเนินการต่อหรือไม่?')) return
    fileInputRef.current?.click()
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const result = importBackup(text)
      alert(`Restore สำเร็จ:\nเครื่องชั่ง ${result.scales} รายการ\nประวัติซ่อม ${result.repairs} รายการ\nแผนก ${result.sections} รายการ`)
      window.location.reload()
    } catch (err: any) {
      alert('Restore ไม่สำเร็จ: ' + (err?.message ?? 'ไฟล์ไม่ถูกต้อง'))
    }
  }

  return (
    <aside className="w-[250px] flex flex-col h-full shrink-0"
      style={{ background: 'linear-gradient(180deg,#0a1f4e 0%,#0E2B5E 60%,#112f6a 100%)', borderRight: '1px solid rgba(255,255,255,.05)', boxShadow: '4px 0 24px rgba(0,0,0,.18)' }}>

      {/* Logo */}
      <div className="px-4 py-4 flex items-center gap-2.5 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#2563EB,#1D64D8)', boxShadow: '0 2px 12px rgba(37,99,235,.5)' }}>
          <i className="ti ti-scale text-white text-lg" />
        </div>
        <div>
          <div className="text-[14px] font-semibold text-white leading-none">ThaiWah<span className="text-blue-400"> Scale</span></div>
          <div className="text-[10px] mt-0.5 tracking-wide" style={{ color: 'rgba(255,255,255,.4)' }}>MANAGEMENT SYSTEM</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,.15) transparent' }}>
        {navGroups.map(group => (
          <div key={group.label}>
            <div className="px-4 pt-4 pb-1 text-[9.5px] font-bold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,.3)' }}>
              {group.label}
            </div>
            {group.items.map(item => {
              const active = isActive(item.href)
              return (
                <Link key={item.href} href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 px-3.5 py-2 mx-2 my-0.5 rounded-lg text-[13px] transition-all duration-150',
                    active
                      ? 'font-medium text-white'
                      : 'font-normal hover:bg-white/10'
                  )}
                  style={active ? {
                    background: 'linear-gradient(90deg,#1D64D8,#2563EB)',
                    boxShadow: '0 2px 12px rgba(29,100,216,.45), inset 0 1px 0 rgba(255,255,255,.12)',
                    color: '#fff',
                  } : { color: 'rgba(255,255,255,.65)' }}>
                  <i className={`ti ${item.icon} text-[17px] flex-shrink-0`}
                    style={{ opacity: active ? 1 : 0.8 }} />
                  <span className="flex-1">{item.label}</span>
                  {active && <i className="ti ti-chevron-right text-[12px] opacity-60" />}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,.1)' }}>
        <div className="px-3.5 py-3 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#1D64D8,#163580)', border: '1px solid rgba(255,255,255,.15)' }}>
            AD
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-semibold text-white truncate">Admin</div>
            <div className="text-[10px]" style={{ color: 'rgba(255,255,255,.4)' }}>👑 ผู้ดูแลระบบ</div>
          </div>
        </div>
        <div className="px-4 pb-3 text-[11px] flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,.3)' }}>
          <i className="ti ti-database text-[13px]" />
          <span>ThaiWah Scale v2.0</span>
        </div>
        <input type="file" accept="application/json" ref={fileInputRef} onChange={handleFileSelected} className="hidden" />
        <div className="px-3 pb-3 grid grid-cols-2 gap-2">
          <button onClick={handleBackup}
            className="flex items-center justify-center gap-1.5 text-[11px] py-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 border border-white/10">
            <i className="ti ti-download text-[13px]" /> Backup
          </button>
          <button onClick={handleRestoreClick}
            className="flex items-center justify-center gap-1.5 text-[11px] py-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 border border-white/10">
            <i className="ti ti-upload text-[13px]" /> Restore
          </button>
        </div>
      </div>
    </aside>
  )
}
