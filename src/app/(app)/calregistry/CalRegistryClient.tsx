'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { getCalibrations, deleteCalibration } from '@/lib/store'
import { fmtDate, fmt, cpDaysUntil } from '@/lib/utils'
import type { CalibrationRecord } from '@/lib/mockData'

const PAGE_SIZE = 10

function dueState(nextDue: string) {
  const days = cpDaysUntil(nextDue)
  if (days < 0)   return { label: 'เกินกำหนด',    cls: 'bg-red-50 text-red-700 border-red-200',       days }
  if (days <= 30) return { label: 'ใกล้ครบกำหนด', cls: 'bg-amber-50 text-amber-700 border-amber-200', days }
  return              { label: 'ปกติ',           cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', days }
}

export default function CalRegistryClient() {
  const [records, setRecords] = useState<CalibrationRecord[]>([])
  useEffect(() => { setRecords([...getCalibrations()]) }, [])

  const [search, setSearch] = useState('')
  const [verdict, setVerdict] = useState<'all' | 'pass' | 'fail'>('all')
  const [dueFilter, setDueFilter] = useState<'all' | 'over' | 'soon' | 'ok'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [viewing, setViewing] = useState<CalibrationRecord | null>(null)

  const filtered = useMemo(() => records.filter(r => {
    const q = search.trim().toLowerCase()
    const mq = !q || r.certNo.toLowerCase().includes(q) || r.assetId.toLowerCase().includes(q)
      || r.model.toLowerCase().includes(q) || r.technician.toLowerCase().includes(q)
    const mv = verdict === 'all' || (verdict === 'pass' ? r.pass : !r.pass)
    const ds = dueState(r.nextDue)
    const md = dueFilter === 'all'
      || (dueFilter === 'over' && ds.days < 0)
      || (dueFilter === 'soon' && ds.days >= 0 && ds.days <= 30)
      || (dueFilter === 'ok' && ds.days > 30)
    const mf = !dateFrom || r.date >= dateFrom
    const mt = !dateTo || r.date <= dateTo
    return mq && mv && md && mf && mt
  }), [records, search, verdict, dueFilter, dateFrom, dateTo])

  useEffect(() => { setPage(1) }, [search, verdict, dueFilter, dateFrom, dateTo])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageSafe = Math.min(page, totalPages)
  const pageRows = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE)

  const overdueCount = records.filter(r => dueState(r.nextDue).days < 0).length
  const soonCount = records.filter(r => { const d = dueState(r.nextDue).days; return d >= 0 && d <= 30 }).length

  function resetFilters() {
    setSearch(''); setVerdict('all'); setDueFilter('all'); setDateFrom(''); setDateTo('')
  }

  function del(certNo: string) {
    if (!confirm(`ลบบันทึกสอบเทียบ "${certNo}" ?`)) return
    deleteCalibration(certNo)
    setRecords([...getCalibrations()])
  }

  const selectCls = 'text-[12px] px-3 py-2 border border-gray-200 rounded-lg bg-white outline-none focus:border-blue-400'
  const dateCls = 'text-[12px] px-2 py-2 border border-gray-200 rounded-lg bg-white outline-none focus:border-blue-400'
  const f = (x: number, n = 4) => Number(x || 0).toFixed(n)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900 flex items-center gap-2">
            <i className="ti ti-list-check text-blue-600 text-[17px]" /> ทะเบียนการสอบเทียบเครื่องชั่ง
          </h1>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {filtered.length.toLocaleString('th-TH')} รายการ
            {overdueCount > 0 && <span className="ml-2 text-red-600 font-medium">• เกินกำหนด {overdueCount} รายการ</span>}
            {soonCount > 0 && <span className="ml-2 text-amber-600 font-medium">• ใกล้ครบกำหนด {soonCount} รายการ</span>}
          </p>
        </div>
        <Link href="/calibration" className="flex items-center gap-1.5 bg-blue-600 text-white text-[12px] px-3 py-1.5 rounded-lg hover:bg-blue-700">
          <i className="ti ti-plus text-[14px]" /> บันทึกสอบเทียบใหม่
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[14px]" />
          <input type="text" placeholder="ค้นหา รหัสใบรับรอง / รหัสเครื่อง / ช่าง…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full text-[12px] pl-8 pr-3 py-2 border border-gray-200 rounded-lg bg-white outline-none focus:border-blue-400" />
        </div>
        <select value={verdict} onChange={e => setVerdict(e.target.value as any)} className={selectCls}>
          <option value="all">ผลตัดสินทั้งหมด</option>
          <option value="pass">ผ่าน</option>
          <option value="fail">ไม่ผ่าน</option>
        </select>
        <select value={dueFilter} onChange={e => setDueFilter(e.target.value as any)} className={selectCls}>
          <option value="all">กำหนดครั้งถัดไป: ทั้งหมด</option>
          <option value="over">เกินกำหนด</option>
          <option value="soon">ใกล้ครบกำหนด (≤30 วัน)</option>
          <option value="ok">ปกติ</option>
        </select>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-gray-400">วันที่สอบเทียบ:</span>
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
                <th className="text-left px-4 py-3 text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">รหัสใบรับรอง</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">วันที่สอบเทียบ</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">รหัสเครื่อง</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">รุ่น / สถานที่</th>
                <th className="text-right px-4 py-3 text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">u_c (g)</th>
                <th className="text-right px-4 py-3 text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">U 95% (g)</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">ผลตัดสิน</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">ช่าง</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">กำหนดครั้งถัดไป</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">สถานะ</th>
                <th className="text-center px-4 py-3 text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr><td colSpan={11} className="text-center py-16 text-gray-400 text-[12px]">
                  {records.length === 0 ? 'ยังไม่มีบันทึกสอบเทียบ — ไปที่ "บันทึกสอบเทียบเครื่องชั่ง" เพื่อเริ่มต้น' : 'ไม่พบรายการที่ตรงกัน'}
                </td></tr>
              )}
              {pageRows.map(r => {
                const ds = dueState(r.nextDue)
                return (
                  <tr key={r.certNo} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button onClick={() => setViewing(r)} className="text-blue-600 hover:underline font-medium font-mono text-[11px]">{r.certNo}</button>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(r.date)}</td>
                    <td className="px-4 py-3 font-medium text-gray-700 font-mono text-[11px] whitespace-nowrap">{r.assetId}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.model} · {r.location}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700 whitespace-nowrap">{f(r.uc)}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700 whitespace-nowrap">{f(r.uExpanded)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${r.pass ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {r.pass ? 'ผ่าน ✓' : 'ไม่ผ่าน ✕'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.technician || '—'}</td>
                    <td className="px-4 py-3 text-gray-700 font-medium whitespace-nowrap">{fmtDate(r.nextDue)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${ds.cls}`}>
                        {ds.label} {ds.days < 0 ? `(${Math.abs(ds.days)} วัน)` : ds.days <= 30 ? `(${ds.days} วัน)` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1.5">
                        <button onClick={() => setViewing(r)} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-100 text-gray-500"><i className="ti ti-eye text-[12px]" /></button>
                        <button onClick={() => del(r.certNo)} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded hover:bg-red-50 hover:border-red-200 hover:text-red-500 text-gray-400"><i className="ti ti-trash text-[12px]" /></button>
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
              <span className="text-[11px] text-gray-500 px-2">{pageSafe} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={pageSafe === totalPages}
                className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded-md text-gray-500 disabled:opacity-30 hover:bg-gray-50">
                <i className="ti ti-chevron-right text-[13px]" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* detail modal */}
      {viewing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setViewing(null)}>
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-2xl shadow-xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <div>
                <h2 className="text-[14px] font-medium text-gray-900">{viewing.certNo}</h2>
                <p className="text-[11px] text-gray-400 mt-0.5">{viewing.assetId} · {viewing.model} · {viewing.location}</p>
              </div>
              <button onClick={() => setViewing(null)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400"><i className="ti ti-x text-[15px]" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { l: 'วันที่สอบเทียบ', v: fmtDate(viewing.date) },
                  { l: 'อุณหภูมิ / ความชื้น', v: `${viewing.tempC}°C / ${viewing.rh}%RH` },
                  { l: 'พิกัด / Resolution', v: `${viewing.maxCap} g / ${viewing.resolution} g` },
                  { l: 'MPE', v: `${viewing.mpe} g` },
                ].map(x => (
                  <div key={x.l} className="bg-gray-50 rounded-lg p-3">
                    <div className="text-[9.5px] text-gray-400 uppercase tracking-wide">{x.l}</div>
                    <div className="text-[12.5px] font-medium text-gray-800 mt-0.5">{x.v}</div>
                  </div>
                ))}
              </div>

              <table className="w-full text-[12px] font-mono">
                <thead><tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-[10px] font-medium text-gray-400 uppercase font-sans">องค์ประกอบ</th>
                  <th className="text-right py-2 text-[10px] font-medium text-gray-400 uppercase">ค่า (g)</th>
                  <th className="text-right py-2 text-[10px] font-medium text-gray-400 uppercase">u<sub>i</sub> (g)</th>
                </tr></thead>
                <tbody>
                  {viewing.components.map(c => (
                    <tr key={c.name} className="border-b border-gray-50 last:border-0">
                      <td className="py-1.5 font-sans text-gray-700">{c.name}</td>
                      <td className="py-1.5 text-right text-gray-500">{f(c.val)}</td>
                      <td className="py-1.5 text-right text-blue-600 font-medium">{f(c.u)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* ── ค่าดิบที่ใช้คำนวณ (ย้อนดูได้ทั้งหมด) ────────────────────── */}
              {viewing.repeatability && viewing.repeatability.length > 0 && (
                <div>
                  <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">01 · Repeatability (ค่าดิบ)</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11.5px] font-mono">
                      <thead><tr className="border-b border-gray-100">
                        <th className="text-left py-1.5 text-[9.5px] font-medium text-gray-400 uppercase font-sans">น้ำหนักทดสอบ</th>
                        {[1,2,3,4,5,6].map(n => <th key={n} className="text-right py-1.5 text-[9.5px] font-medium text-gray-400 uppercase">#{n}</th>)}
                        <th className="text-right py-1.5 text-[9.5px] font-medium text-gray-400 uppercase">เฉลี่ย</th>
                        <th className="text-right py-1.5 text-[9.5px] font-medium text-gray-400 uppercase">s</th>
                      </tr></thead>
                      <tbody>
                        {viewing.repeatability.map(row => (
                          <tr key={row.nom} className="border-b border-gray-50 last:border-0">
                            <td className="py-1 text-gray-700 font-sans">{row.nom} g</td>
                            {row.readings.map((v, i) => <td key={i} className="py-1 text-right text-gray-600">{f(v, 3)}</td>)}
                            <td className="py-1 text-right text-gray-500">{f(row.mean, 3)}</td>
                            <td className="py-1 text-right text-gray-500">{f(row.sd, 4)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {viewing.eccentricity && (
                <div>
                  <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">02 · Eccentricity (ค่าดิบ)</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11.5px] font-mono">
                      <thead><tr className="border-b border-gray-100">
                        <th className="text-left py-1.5 text-[9.5px] font-medium text-gray-400 uppercase font-sans">ตำแหน่ง</th>
                        <th className="text-right py-1.5 text-[9.5px] font-medium text-gray-400 uppercase">1 (กลาง)</th>
                        <th className="text-right py-1.5 text-[9.5px] font-medium text-gray-400 uppercase">2</th>
                        <th className="text-right py-1.5 text-[9.5px] font-medium text-gray-400 uppercase">3</th>
                        <th className="text-right py-1.5 text-[9.5px] font-medium text-gray-400 uppercase">4</th>
                        <th className="text-right py-1.5 text-[9.5px] font-medium text-gray-400 uppercase">5</th>
                        <th className="text-right py-1.5 text-[9.5px] font-medium text-gray-400 uppercase">เบี่ยงเบนสูงสุด</th>
                      </tr></thead>
                      <tbody>
                        <tr>
                          <td className="py-1 text-gray-700 font-sans">{viewing.eccentricity.nom} g</td>
                          {viewing.eccentricity.readings.map((v, i) => <td key={i} className="py-1 text-right text-gray-600">{f(v, 3)}</td>)}
                          <td className="py-1 text-right text-gray-500">{f(viewing.eccentricity.maxDev, 3)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {viewing.linearity && viewing.linearity.length > 0 && (
                <div>
                  <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">03 · Linearity (ค่าดิบ)</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11.5px] font-mono">
                      <thead><tr className="border-b border-gray-100">
                        <th className="text-left py-1.5 text-[9.5px] font-medium text-gray-400 uppercase font-sans">น้ำหนักทดสอบ</th>
                        <th className="text-right py-1.5 text-[9.5px] font-medium text-gray-400 uppercase">มวลจริง</th>
                        <th className="text-right py-1.5 text-[9.5px] font-medium text-gray-400 uppercase">ค่าที่อ่าน</th>
                        <th className="text-right py-1.5 text-[9.5px] font-medium text-gray-400 uppercase">E = อ่าน−จริง</th>
                      </tr></thead>
                      <tbody>
                        {viewing.linearity.map(row => (
                          <tr key={row.nom} className="border-b border-gray-50 last:border-0">
                            <td className="py-1 text-gray-700 font-sans">{row.nom} g</td>
                            <td className="py-1 text-right text-gray-600">{f(row.realMass, 4)}</td>
                            <td className="py-1 text-right text-gray-600">{f(row.reading, 3)}</td>
                            <td className="py-1 text-right text-gray-500">{f(row.error, 4)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                <div className="bg-white p-3">
                  <div className="text-[9.5px] text-gray-400 uppercase tracking-wide">u_c รวม</div>
                  <div className="text-[16px] font-mono font-semibold text-gray-800 mt-1">{f(viewing.uc)} g</div>
                </div>
                <div className="bg-white p-3">
                  <div className="text-[9.5px] text-gray-400 uppercase tracking-wide">U ขยาย (k={viewing.k})</div>
                  <div className="text-[16px] font-mono font-semibold text-blue-600 mt-1">{f(viewing.uExpanded)} g</div>
                </div>
                <div className="bg-white p-3">
                  <div className="text-[9.5px] text-gray-400 uppercase tracking-wide">|E| max</div>
                  <div className="text-[16px] font-mono font-semibold text-gray-800 mt-1">{f(viewing.errorMax)} g</div>
                </div>
                <div className="bg-white p-3">
                  <div className="text-[9.5px] text-gray-400 uppercase tracking-wide">ผลตัดสิน</div>
                  <div className={`text-[16px] font-mono font-semibold mt-1 ${viewing.pass ? 'text-emerald-600' : 'text-red-600'}`}>{viewing.pass ? 'ผ่าน ✓' : 'ไม่ผ่าน ✕'}</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11.5px] text-gray-500 border-t border-gray-100 pt-3">
                <span>ช่างผู้ทำสอบเทียบ: <b className="text-gray-700">{viewing.technician || '—'}</b></span>
                <span>ความถี่: <b className="text-gray-700">ทุก {viewing.intervalMonths} เดือน</b></span>
                <span>ครั้งถัดไป: <b className="text-blue-600 font-mono">{fmtDate(viewing.nextDue)}</b></span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
