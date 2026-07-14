'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { fmtDate, fmt, repairTypeShortLabel, repairTypeColor } from '@/lib/utils'
import { getRepairs, deleteRepair, getSections } from '@/lib/store'
import type { RepairJob } from '@/lib/mockData'

const PAGE_SIZE = 10

export default function RepairsClient() {
  const [repairs, setRepairs] = useState<RepairJob[]>([])
  const [sections, setSections] = useState(getSections())
  const [search, setSearch]   = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [sectionFilter, setSectionFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => { setRepairs([...getRepairs()]); setSections(getSections()) }, [])

  const sectionOf = (code: string) => sections.find(s => s.code === code) ?? null

  const depts = useMemo(() => [...new Set(sections.map(s => s.dept).filter(Boolean))].sort(), [sections])
  const sectionOptions = useMemo(
    () => sections.filter(s => !deptFilter || s.dept === deptFilter),
    [sections, deptFilter]
  )

  const filtered = useMemo(() => repairs.filter(r => {
    const sec = sections.find(s => s.code === r.sectionCode) ?? null
    const mq = !search || r.repairId.toLowerCase().includes(search.toLowerCase())
      || r.actionTaken.includes(search) || r.scaleCode.toLowerCase().includes(search.toLowerCase())
      || (r.technician ?? '').includes(search)
    const md = !deptFilter || sec?.dept === deptFilter
    const ms = !sectionFilter || r.sectionCode === sectionFilter
    const mt = !typeFilter || r.repairType === typeFilter
    const mf = !dateFrom || r.date >= dateFrom
    const mtTo = !dateTo || r.date <= dateTo
    return mq && md && ms && mt && mf && mtTo
  }), [repairs, sections, search, deptFilter, sectionFilter, typeFilter, dateFrom, dateTo])

  useEffect(() => { setPage(1) }, [search, deptFilter, sectionFilter, typeFilter, dateFrom, dateTo])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageSafe = Math.min(page, totalPages)
  const pageRows = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE)

  function resetFilters() {
    setSearch(''); setDeptFilter(''); setSectionFilter(''); setTypeFilter(''); setDateFrom(''); setDateTo('')
  }

  function del(id: string) {
    if (!confirm(`ลบใบแจ้งซ่อม "${id}" ?`)) return
    deleteRepair(id)
    setRepairs([...getRepairs()])
  }

  function exportCsv() {
    const header = ['รหัสซ่อม','วันที่','รหัสเครื่อง','ฝ่าย','แผนก','ประเภท','รายการ/อะไหล่/ส่งซ่อม','ค่าอะไหล่','ค่าส่งซ่อม','รวม','ช่าง']
    const rows = filtered.map(r => {
      const sec = sectionOf(r.sectionCode)
      const items = [...r.parts.map(p => `${p.partName}x${p.qty}`), ...r.extItems.map(e => e.description)].join(' | ')
      return [r.repairId, r.date, r.scaleCode, sec?.dept ?? '', sec?.name ?? '', repairTypeShortLabel[r.repairType],
        items, r.partCost, r.externalCost, r.totalCost, r.technician || '']
    })
    const csv = [header, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `repair-history-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // build page number list with ellipsis
  const pageNumbers = useMemo(() => {
    const arr: (number | '...')[] = []
    const p = pageSafe, tp = totalPages
    if (tp <= 7) { for (let i = 1; i <= tp; i++) arr.push(i); return arr }
    arr.push(1)
    if (p > 3) arr.push('...')
    for (let i = Math.max(2, p - 1); i <= Math.min(tp - 1, p + 1); i++) arr.push(i)
    if (p < tp - 2) arr.push('...')
    arr.push(tp)
    return arr
  }, [pageSafe, totalPages])

  const selectCls = 'text-[12px] px-3 py-2 border border-gray-200 rounded-lg bg-white outline-none focus:border-blue-400'
  const dateCls = 'text-[12px] px-2 py-2 border border-gray-200 rounded-lg bg-white outline-none focus:border-blue-400'

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[15px] font-medium text-gray-900">ประวัติการซ่อม</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">พบ {filtered.length.toLocaleString('th-TH')} รายการ</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="flex items-center gap-1.5 text-[12px] text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50">
            <i className="ti ti-download text-[14px]" /> Export
          </button>
          <Link href="/repairs/new" className="flex items-center gap-1.5 bg-blue-600 text-white text-[12px] px-3 py-1.5 rounded-lg hover:bg-blue-700">
            <i className="ti ti-plus text-[14px]" /> บันทึกการซ่อม
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[14px]" />
          <input type="text" placeholder="ค้นหา..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full text-[12px] pl-8 pr-3 py-2 border border-gray-200 rounded-lg bg-white outline-none focus:border-blue-400" />
        </div>
        <select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setSectionFilter('') }} className={selectCls}>
          <option value="">ทุกฝ่าย</option>
          {depts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)} className={selectCls}>
          <option value="">ทุกแผนก</option>
          {sectionOptions.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className={selectCls}>
          <option value="">ทุกประเภท</option>
          <option value="self">ซ่อม</option>
          <option value="ext">ส่งซ่อมนอก</option>
          <option value="both">ทั้งสองแบบ</option>
        </select>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-gray-400">ช่วงวันที่:</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={dateCls} />
          <span className="text-gray-300">–</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={dateCls} />
        </div>
        <button onClick={resetFilters} className="flex items-center gap-1.5 text-[12px] text-gray-500 border border-gray-200 px-3 py-2 rounded-lg bg-white hover:bg-gray-50">
          <i className="ti ti-refresh text-[13px]" /> รีเซ็ต
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-4 py-3 text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">รหัสซ่อม</th>
              <th className="text-left px-4 py-3 text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">วันที่</th>
              <th className="text-left px-4 py-3 text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">รหัสเครื่อง</th>
              <th className="text-left px-4 py-3 text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">ฝ่าย</th>
              <th className="text-left px-4 py-3 text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">แผนก</th>
              <th className="text-left px-4 py-3 text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">ประเภท</th>
              <th className="text-left px-4 py-3 text-[10px] font-medium text-gray-400 uppercase">รายการ / อะไหล่ / ส่งซ่อม</th>
              <th className="text-right px-4 py-3 text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">ค่าอะไหล่</th>
              <th className="text-right px-4 py-3 text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">ค่าส่งซ่อม</th>
              <th className="text-right px-4 py-3 text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">รวม</th>
              <th className="text-left px-4 py-3 text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">ช่าง</th>
              <th className="text-center px-4 py-3 text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr><td colSpan={12} className="text-center py-16 text-gray-400 text-[12px]">
                {repairs.length === 0 ? 'ยังไม่มีรายการซ่อม — กด "บันทึกการซ่อม" เพื่อเริ่มต้น' : 'ไม่พบรายการที่ตรงกัน'}
              </td></tr>
            )}
            {pageRows.map(job => {
              const sec = sectionOf(job.sectionCode)
              const items = [...job.parts.map(p => `${p.partName}x${p.qty}`), ...job.extItems.map(e => e.description)]
              return (
                <tr key={job.repairId} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap"><Link href={`/repairs/${job.repairId}`} className="text-blue-600 hover:underline font-medium font-mono text-[11px]">{job.repairId}</Link></td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(job.date)}</td>
                  <td className="px-4 py-3 font-medium text-gray-700 font-mono text-[11px] whitespace-nowrap">{job.scaleCode}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{sec?.dept || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {sec?.name ? <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-50 text-sky-700 border border-sky-200">{sec.name}</span> : '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${repairTypeColor[job.repairType]}`}>{repairTypeShortLabel[job.repairType]}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {items.length === 0 ? '—' : (
                      <div className="flex flex-wrap gap-1">
                        {items.map((it, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 rounded bg-gray-50 border border-gray-200 text-[10px] text-gray-600 whitespace-nowrap">{it}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">{job.partCost > 0 ? '฿' + fmt(job.partCost) : '-'}</td>
                  <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">{job.externalCost > 0 ? '฿' + fmt(job.externalCost) : '-'}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-800 whitespace-nowrap">{job.totalCost > 0 ? '฿' + fmt(job.totalCost) : '-'}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{job.technician || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-1.5">
                      <Link href={`/repairs/${job.repairId}/edit`} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-100 text-gray-500"><i className="ti ti-edit text-[12px]"/></Link>
                      <button onClick={() => del(job.repairId)} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded hover:bg-red-50 hover:border-red-200 hover:text-red-500 text-gray-400"><i className="ti ti-trash text-[12px]"/></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>

        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-[11px] text-gray-400">
              แสดง {(pageSafe - 1) * PAGE_SIZE + 1}-{Math.min(pageSafe * PAGE_SIZE, filtered.length)} / {filtered.length.toLocaleString('th-TH')} รายการ
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pageSafe === 1}
                className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded-md text-gray-500 disabled:opacity-30 hover:bg-gray-50">
                <i className="ti ti-chevron-left text-[13px]" />
              </button>
              {pageNumbers.map((n, idx) => n === '...' ? (
                <span key={`e${idx}`} className="w-7 h-7 flex items-center justify-center text-gray-400 text-[11px]">…</span>
              ) : (
                <button key={n} onClick={() => setPage(n as number)}
                  className={`w-7 h-7 flex items-center justify-center rounded-md text-[11px] ${n === pageSafe ? 'bg-blue-600 text-white font-medium' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {n}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={pageSafe === totalPages}
                className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded-md text-gray-500 disabled:opacity-30 hover:bg-gray-50">
                <i className="ti ti-chevron-right text-[13px]" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
