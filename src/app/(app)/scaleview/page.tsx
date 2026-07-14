'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  getScales, getSections, getRepairsByScale, getScaleFamily,
  parseScaleCode, replaceScale, updateScale, getVendorByCode, getLatestScales,
} from '@/lib/store'
import { fmtDate, fmt, repairTypeShortLabel, repairTypeColor } from '@/lib/utils'
import type { RepairJob } from '@/lib/mockData'

function ratioTone(ratio: number) {
  if (ratio >= 80) return { text: 'text-red-600', bar: 'bg-red-500', badge: 'bg-red-50 text-red-700 border-red-200' }
  if (ratio >= 50) return { text: 'text-amber-600', bar: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 border-amber-200' }
  return { text: 'text-emerald-600', bar: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
}

function aggregateParts(repairs: RepairJob[]) {
  const map = new Map<string, { qty: number; cost: number }>()
  repairs.forEach(r => r.parts.forEach(p => {
    const cur = map.get(p.partName) ?? { qty: 0, cost: 0 }
    cur.qty += p.qty; cur.cost += p.cost
    map.set(p.partName, cur)
  }))
  return [...map.entries()].map(([name, v]) => ({ name, ...v }))
}

export default function ScaleViewPage() {
  const [allScales, setAllScales] = useState(getScales())
  const [sections, setSections] = useState(getSections())
  useEffect(() => { setAllScales(getScales()); setSections(getSections()) }, [])

  // ── cascading selector: Department → Section → Scale ─────────────────────
  const depts = useMemo(() => [...new Set(sections.map(s => s.dept).filter(Boolean))].sort(), [sections])
  const [dept, setDept] = useState('')
  const [sectionCode, setSectionCode] = useState('')
  const [scaleCode, setScaleCode] = useState('')

  const sectionOptions = useMemo(() => sections.filter(s => !dept || s.dept === dept), [sections, dept])
  const scaleOptions = useMemo(
    () => getLatestScales(allScales.filter(s => !sectionCode || s.sectionRef === sectionCode)),
    [allScales, sectionCode]
  )

  const scale = allScales.find(s => s.code === scaleCode) ?? null
  const section = scale ? sections.find(s => s.code === scale.sectionRef) ?? null : null

  // ── status update ─────────────────────────────────────────────────────────
  const [statusSelect, setStatusSelect] = useState<'Active' | 'Inactive'>('Active')
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync when the *id* or *status* actually changes, not on every allScales refresh
  useEffect(() => { if (scale) setStatusSelect(scale.status) }, [scale?.id, scale?.status])
  function applyStatus() {
    if (!scale) return
    updateScale(scale.id, { status: statusSelect })
    setAllScales([...getScales()])
  }

  // ── stats for the specifically-selected scale ────────────────────────────
  const repairHistory = scaleCode ? getRepairsByScale(scaleCode) : []
  const totalCost = repairHistory.reduce((s, r) => s + r.totalCost, 0)
  const ratio = scale && scale.purchasePrice > 0 ? (totalCost / scale.purchasePrice) * 100 : 0
  const tone = ratioTone(ratio)

  // ── generation family ─────────────────────────────────────────────────────
  const family = useMemo(() => scaleCode ? getScaleFamily(scaleCode) : [], [scaleCode])
  const parsed = scale ? parseScaleCode(scale.code) : null
  const baseLabel = parsed ? `${parsed.prefix}-XX-${parsed.serial}` : ''
  const [familyOpen, setFamilyOpen] = useState(true)
  const [viewGenCode, setViewGenCode] = useState('')
  useEffect(() => { setViewGenCode(scaleCode) }, [scaleCode])
  const viewScale = family.find(f => f.code === viewGenCode) ?? scale

  const familyRepairs = useMemo(() => family.flatMap(f => getRepairsByScale(f.code)), [family])
  const familyTotalCost = familyRepairs.reduce((s, r) => s + r.totalCost, 0)
  const timesChanged = Math.max(0, family.length - 1)
  const earliestStart = family.length > 0 ? family.reduce((a, b) => a.startDate < b.startDate ? a : b).startDate : ''

  const genRepairs = useMemo(() => viewGenCode ? getRepairsByScale(viewGenCode) : [], [viewGenCode])
  const genCost = genRepairs.reduce((s, r) => s + r.totalCost, 0)
  const genRatio = viewScale && viewScale.purchasePrice > 0 ? (genCost / viewScale.purchasePrice) * 100 : 0
  const genParsed = viewScale ? parseScaleCode(viewScale.code) : null

  const partsAgg = useMemo(() => aggregateParts(genRepairs), [genRepairs])
  const extHistory = useMemo(() => genRepairs
    .filter(r => r.extItems.length > 0)
    .flatMap(r => r.extItems.map(it => ({ date: r.date, vendor: (getVendorByCode(r.vendorCode)?.name ?? r.vendorCode) || '—', desc: it.description, cost: it.cost })))
    .sort((a, b) => b.date.localeCompare(a.date)),
  [genRepairs])

  const [tab, setTab] = useState<'history' | 'timeline'>('history')

  // ── timeline: oldest → newest, cumulative % of purchase price ────────────
  const timeline = useMemo(() => {
    if (!viewScale) return []
    const sorted = [...genRepairs].sort((a, b) => a.date.localeCompare(b.date))
    let cum = 0
    const items = sorted.map(r => {
      cum += r.totalCost
      const pct = viewScale.purchasePrice > 0 ? (cum / viewScale.purchasePrice) * 100 : 0
      return { repair: r, cum, pct }
    })
    return items
  }, [genRepairs, viewScale])

  // ── replace scale modal ───────────────────────────────────────────────────
  const [replaceModal, setReplaceModal] = useState(false)
  const [rf, setRf] = useState({ endOld: new Date().toISOString().slice(0, 10), startNew: new Date().toISOString().slice(0, 10), sn: '', model: '', price: 0 })
  function doReplace() {
    if (!scale) return
    if (!rf.sn || !rf.model) { alert('กรุณากรอก S/N และ Model เครื่องใหม่'); return }
    const newScale = replaceScale(scale.code, rf)
    if (!newScale) { alert('ไม่สามารถสร้างเครื่องใหม่ได้ (อาจมี Generation นี้อยู่แล้ว)'); return }
    setReplaceModal(false)
    setAllScales([...getScales()])
    setScaleCode(newScale.code)
  }

  const inputCls = 'w-full text-[12px] px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100'
  const labelCls = 'block text-[11px] font-medium text-gray-600 mb-1'
  const stepCls = 'inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-blue-600 text-[9px] font-bold mr-1'
  const card = 'bg-white border border-gray-100 rounded-xl'

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-[15px] font-semibold text-gray-900">ภาพรวมรายเครื่องชั่ง</h1>
        <p className="text-[11px] text-gray-400 mt-0.5">เลือกเครื่องชั่งเพื่อดูสถานะ ต้นทุนสะสม และประวัติการซ่อมทุก Generation</p>
      </div>

      {/* selector */}
      <div className={`${card} p-4 mb-4`}>
        <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><i className="ti ti-filter text-[13px]" /> เลือกเครื่องชั่ง</div>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <label className={labelCls}><span className={stepCls}>1</span>Department</label>
            <select className={inputCls} value={dept} onChange={e => { setDept(e.target.value); setSectionCode(''); setScaleCode('') }}>
              <option value="">— เลือกฝ่าย —</option>
              {depts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}><span className={stepCls}>2</span>Section</label>
            <select className={inputCls} value={sectionCode} disabled={!dept} onChange={e => { setSectionCode(e.target.value); setScaleCode('') }}>
              <option value="">— เลือกแผนก —</option>
              {sectionOptions.map(s => <option key={s.code} value={s.code}>{s.dept} — {s.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}><span className={stepCls}>3</span>Scale</label>
            <select className={inputCls} value={scaleCode} disabled={!sectionCode} onChange={e => setScaleCode(e.target.value)}>
              <option value="">{sectionCode ? '— เลือกเครื่องชั่ง —' : '— เลือกแผนกก่อน —'}</option>
              {scaleOptions.map(s => <option key={s.id} value={s.code}>{s.code} — {s.brand} {s.model} [{s.scaleType || '-'}]</option>)}
            </select>
          </div>
        </div>

        {scale && (
          <div className="flex items-end gap-2 pt-3 border-t border-gray-100">
            <div className="flex-1 max-w-[220px]">
              <label className={labelCls}>สถานะปัจจุบัน</label>
              <select className={inputCls} value={statusSelect} onChange={e => setStatusSelect(e.target.value as 'Active' | 'Inactive')}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <button onClick={applyStatus} className="flex items-center gap-1.5 text-[12px] font-medium px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <i className="ti ti-check text-[14px]" /> อัปเดตสถานะ
            </button>
            {statusSelect === 'Active' && scale.status === 'Active' && (
              <button onClick={() => { setRf({ ...rf, sn: '', model: scale.model, price: scale.purchasePrice }); setReplaceModal(true) }}
                className="ml-auto flex items-center gap-1.5 text-[12px] px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100">
                <i className="ti ti-replace text-[14px]" /> เปลี่ยนเครื่องใหม่ (Gen+1)
              </button>
            )}
          </div>
        )}
      </div>

      {!scale ? (
        <div className={`${card} py-20 text-center text-gray-300`}>
          <i className="ti ti-scale text-4xl mb-2 block" />
          <p className="text-[13px]">เลือกฝ่าย / แผนก / เครื่องชั่ง เพื่อดูรายละเอียด</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* info cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { l: 'สถานะ', v: <span className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${scale.status === 'Active' ? 'bg-emerald-500' : 'bg-gray-300'}`} />{scale.status}</span> },
              { l: 'ยี่ห้อ / รุ่น', v: `${scale.brand} (${scale.model})` },
              { l: 'TYPE', v: scale.scaleType || '—' },
              { l: 'SERIAL NUMBER', v: scale.serialNumber || '—' },
              { l: 'แผนก', v: section?.name ?? '—' },
              { l: 'START DATE', v: fmtDate(scale.startDate) },
              { l: 'END DATE', v: scale.endDate ? fmtDate(scale.endDate) : '—' },
            ].map(x => (
              <div key={x.l} className={`${card} p-3`}>
                <div className="text-[9.5px] text-gray-400 uppercase tracking-wide mb-1">{x.l}</div>
                <div className="text-[13px] font-medium text-gray-800">{x.v}</div>
              </div>
            ))}
          </div>

          {/* stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: 'ti-tool', iconBg: 'bg-blue-50 text-blue-500', v: `${repairHistory.length} ครั้ง`, l: 'ซ่อมทั้งหมด' },
              { icon: 'ti-cash', iconBg: 'bg-red-50 text-red-500', v: `฿${fmt(totalCost)}`, l: 'ค่าซ่อมสะสม' },
              { icon: 'ti-tag', iconBg: 'bg-sky-50 text-sky-500', v: `฿${fmt(scale.purchasePrice)}`, l: 'ราคาซื้อเครื่อง' },
              { icon: 'ti-chart-pie', iconBg: 'bg-amber-50 text-amber-500', v: `${ratio.toFixed(1)}%`, l: 'สัดส่วนค่าซ่อม/ราคาเครื่อง', tone: true },
            ].map(s => (
              <div key={s.l} className={`${card} p-4 flex items-center gap-3`}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${s.iconBg}`}><i className={`ti ${s.icon} text-[18px]`} /></div>
                <div>
                  <div className={`text-[17px] font-semibold ${s.tone ? tone.text : 'text-gray-800'}`}>{s.v}</div>
                  <div className="text-[10.5px] text-gray-400">{s.l}</div>
                </div>
              </div>
            ))}
          </div>

          {/* alert banner */}
          {ratio >= 50 && (
            <div className={`flex items-center gap-2 border-l-4 rounded-lg px-4 py-3 text-[12.5px] ${ratio >= 80 ? 'border-red-500 bg-red-50 text-red-700' : 'border-amber-500 bg-amber-50 text-amber-700'}`}>
              <i className="ti ti-alert-triangle text-[15px] flex-shrink-0" />
              {ratio >= 80
                ? <span><b>ระดับวิกฤต:</b> ต้นทุนสะสม {ratio.toFixed(1)}% ของราคาเครื่อง — ควรพิจารณาเปลี่ยนเครื่องใหม่</span>
                : <span><b>ระดับเฝ้าระวัง:</b> ต้นทุนสะสม {ratio.toFixed(1)}% — ควรตรวจเช็คก่อนซ่อมครั้งถัดไป</span>}
            </div>
          )}

          {/* generation history header */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'linear-gradient(90deg,#0a1f4e,#0E2B5E)' }}>
            <div className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-2.5 text-white">
                <i className="ti ti-git-branch text-[16px]" />
                <div>
                  <div className="text-[13px] font-medium">ประวัติรหัส {baseLabel}</div>
                  <div className="text-[10.5px]" style={{ color: 'rgba(255,255,255,.55)' }}>{family.length} Gen | เปลี่ยนเครื่องแล้ว {timesChanged} ครั้ง</div>
                </div>
              </div>
              <button onClick={() => setFamilyOpen(o => !o)} className="flex items-center gap-1.5 text-[11.5px] text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg">
                <i className={`ti ${familyOpen ? 'ti-eye-off' : 'ti-eye'} text-[13px]`} /> {familyOpen ? 'ซ่อน' : 'แสดง'}
              </button>
            </div>
          </div>

          {familyOpen && (
            <>
              {/* family mini stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: 'ti-refresh', iconBg: 'bg-purple-50 text-purple-500', v: `${timesChanged} ครั้ง`, l: 'เปลี่ยนเครื่องแล้ว' },
                  { icon: 'ti-tool', iconBg: 'bg-blue-50 text-blue-500', v: `${familyRepairs.length} ครั้ง`, l: 'ซ่อมรวมทุก Gen' },
                  { icon: 'ti-cash', iconBg: 'bg-red-50 text-red-500', v: `฿${fmt(familyTotalCost)}`, l: 'ต้นทุนซ่อมสะสมทั้งหมด' },
                  { icon: 'ti-calendar', iconBg: 'bg-emerald-50 text-emerald-500', v: fmtDate(earliestStart), l: 'ใช้งานมาตั้งแต่' },
                ].map(s => (
                  <div key={s.l} className={`${card} p-4 flex items-center gap-3`}>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${s.iconBg}`}><i className={`ti ${s.icon} text-[18px]`} /></div>
                    <div>
                      <div className="text-[15px] font-semibold text-gray-800">{s.v}</div>
                      <div className="text-[10.5px] text-gray-400">{s.l}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-[170px_1fr] gap-4 items-start">
                {/* gen list */}
                <div className="space-y-2">
                  {family.map(f => {
                    const fp = parseScaleCode(f.code)
                    const fCost = getRepairsByScale(f.code).reduce((s, r) => s + r.totalCost, 0)
                    return (
                      <button key={f.id} onClick={() => setViewGenCode(f.code)}
                        className={`w-full text-left border rounded-xl p-3 transition-all ${f.code === viewGenCode ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white hover:border-blue-300'}`}>
                        <div className="text-[10px] text-gray-400 mb-1">Gen</div>
                        <div className="text-[15px] font-mono font-bold text-gray-800 mb-1">{fp?.genStr}</div>
                        <div className="flex items-center gap-1 text-[11px] text-gray-600 mb-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${f.status === 'Active' ? 'bg-emerald-500' : 'bg-gray-300'}`} />{f.brand}
                        </div>
                        <div className="text-[11px] font-medium text-red-500">฿{fmt(fCost)}</div>
                        <div className="text-[10px] text-gray-400">{f.status === 'Active' ? 'กำลังใช้' : 'ปิดใช้งานแล้ว'}</div>
                      </button>
                    )
                  })}
                </div>

                {/* gen detail */}
                {viewScale && (
                  <div className="space-y-4 min-w-0">
                    <div className={`${card} p-4`}>
                      <div className="flex items-center gap-2.5 flex-wrap mb-3">
                        <span className="font-mono text-[14px] font-bold text-blue-600">{viewScale.code}</span>
                        <span className={`text-[10.5px] px-2 py-0.5 rounded-full border font-medium ${viewScale.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>{viewScale.status}</span>
                        <span className="text-[11.5px] text-gray-500">{viewScale.brand} {viewScale.model} · S/N: {viewScale.serialNumber || '—'}</span>
                        <span className="text-[11px] text-gray-400 ml-auto">เริ่ม: {fmtDate(viewScale.startDate)}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-gray-50 rounded-lg p-3"><div className="text-[15px] font-semibold text-gray-800">{genRepairs.length} ครั้ง</div><div className="text-[10.5px] text-gray-400">ซ่อม</div></div>
                        <div className="bg-gray-50 rounded-lg p-3"><div className="text-[15px] font-semibold text-red-500">฿{fmt(genCost)}</div><div className="text-[10.5px] text-gray-400">ค่าซ่อมรวม</div></div>
                        <div className="bg-gray-50 rounded-lg p-3"><div className="text-[15px] font-semibold text-gray-800">฿{fmt(viewScale.purchasePrice)}</div><div className="text-[10.5px] text-gray-400">ราคาซื้อ</div></div>
                        <div className="bg-gray-50 rounded-lg p-3"><div className={`text-[15px] font-semibold ${ratioTone(genRatio).text}`}>{genRatio.toFixed(1)}%</div><div className="text-[10.5px] text-gray-400">สัดส่วน</div></div>
                      </div>
                    </div>

                    {/* tabs: history / timeline */}
                    <div className={card}>
                      <div className="flex items-center gap-1 px-4 pt-3 border-b border-gray-100">
                        <button onClick={() => setTab('history')}
                          className={`flex items-center gap-1.5 text-[12px] px-3 py-2 border-b-2 -mb-px ${tab === 'history' ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                          <i className="ti ti-list text-[13px]" /> ประวัติการซ่อม <span className="text-[9.5px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">Gen {genParsed?.genStr}</span>
                        </button>
                        <button onClick={() => setTab('timeline')}
                          className={`flex items-center gap-1.5 text-[12px] px-3 py-2 border-b-2 -mb-px ${tab === 'timeline' ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                          <i className="ti ti-timeline text-[13px]" /> Timeline <span className="text-[9.5px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">Gen {genParsed?.genStr}</span>
                        </button>
                      </div>

                      {tab === 'history' ? (
                        <div className="p-4 overflow-x-auto">
                          {genRepairs.length === 0 ? (
                            <p className="text-[12px] text-gray-300 text-center py-8">ยังไม่มีประวัติการซ่อมสำหรับ Gen นี้</p>
                          ) : (
                            <table className="w-full text-[12px]">
                              <thead><tr className="border-b border-gray-100">
                                <th className="text-left py-2 pr-2 text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">วันที่</th>
                                <th className="text-left py-2 px-2 text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">PMII</th>
                                <th className="text-left py-2 px-2 text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">ประเภท</th>
                                <th className="text-left py-2 px-2 text-[10px] font-medium text-gray-400 uppercase">รายการ</th>
                                <th className="text-right py-2 px-2 text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">ค่าอะไหล่</th>
                                <th className="text-right py-2 px-2 text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">ค่าส่งซ่อม</th>
                                <th className="text-right py-2 px-2 text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">รวม (฿)</th>
                                <th className="text-left py-2 pl-2 text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">ช่าง</th>
                              </tr></thead>
                              <tbody>
                                {genRepairs.map(r => {
                                  const items = [...r.parts.map(p => `${p.partName}x${p.qty}`), ...r.extItems.map(e => e.description)]
                                  return (
                                    <tr key={r.repairId} className="border-b border-gray-50 hover:bg-gray-50">
                                      <td className="py-2.5 pr-2 text-gray-500 whitespace-nowrap">{fmtDate(r.date)}</td>
                                      <td className="py-2.5 px-2"><Link href={`/repairs/${r.repairId}`} className="text-blue-600 hover:underline font-mono text-[11px]">{r.pmiiDocNo || r.repairId}</Link></td>
                                      <td className="py-2.5 px-2 whitespace-nowrap"><span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${repairTypeColor[r.repairType]}`}>{repairTypeShortLabel[r.repairType]}</span></td>
                                      <td className="py-2.5 px-2 text-gray-600">
                                        {items.length === 0 ? '—' : <div className="flex flex-wrap gap-1">{items.map((it, i) => <span key={i} className="px-1.5 py-0.5 rounded bg-gray-50 border border-gray-200 text-[10px] text-gray-600 whitespace-nowrap">{it}</span>)}</div>}
                                      </td>
                                      <td className="py-2.5 px-2 text-right whitespace-nowrap">{r.partCost > 0 ? '฿' + fmt(r.partCost) : '-'}</td>
                                      <td className="py-2.5 px-2 text-right whitespace-nowrap">{r.externalCost > 0 ? '฿' + fmt(r.externalCost) : '-'}</td>
                                      <td className="py-2.5 px-2 text-right font-medium text-gray-800 whitespace-nowrap">฿{fmt(r.totalCost)}</td>
                                      <td className="py-2.5 pl-2 text-gray-600 whitespace-nowrap">{r.technician || '—'}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                              <tfoot>
                                <tr><td colSpan={6}></td><td className="pt-3 text-right text-[11px] text-gray-400">ยอดรวม Gen {genParsed?.genStr}</td><td></td></tr>
                                <tr><td colSpan={6}></td><td className="text-right font-semibold text-blue-600 text-[13px]">฿{fmt(genCost)}</td><td></td></tr>
                              </tfoot>
                            </table>
                          )}
                        </div>
                      ) : (
                        <div className="p-5">
                          {timeline.length === 0 && !viewScale.startDate ? (
                            <p className="text-[12px] text-gray-300 text-center py-8">ยังไม่มีข้อมูล Timeline</p>
                          ) : (
                            <div className="relative pl-8">
                              <div className="absolute left-[13px] top-2 bottom-2 w-px bg-gray-200" />
                              <div className="relative mb-5">
                                <div className="absolute -left-8 top-0 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center"><i className="ti ti-player-play text-[13px]" /></div>
                                <div className="text-[10.5px] text-gray-400 mb-1">{fmtDate(viewScale.startDate)}</div>
                                <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                                  <div className="text-[12.5px] font-medium text-emerald-700">เริ่มใช้งานเครื่อง</div>
                                  <div className="text-[11px] text-emerald-600/80">{viewScale.brand} {viewScale.model} · SN: {viewScale.serialNumber || '—'}</div>
                                </div>
                              </div>
                              {timeline.map(t => (
                                <div key={t.repair.repairId} className="relative mb-5 last:mb-0">
                                  <div className="absolute -left-8 top-0 w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center"><i className="ti ti-tool text-[12px]" /></div>
                                  <div className="text-[10.5px] text-gray-400 mb-1">{fmtDate(t.repair.date)}</div>
                                  <div className="bg-white border border-gray-100 rounded-lg px-3 py-2.5">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${repairTypeColor[t.repair.repairType]}`}>{repairTypeShortLabel[t.repair.repairType]}</span>
                                        <span className="font-mono text-[11px] text-gray-400">{t.repair.pmiiDocNo || t.repair.repairId}</span>
                                      </div>
                                      <span className="font-semibold text-[13px] text-gray-800">฿{fmt(t.repair.totalCost)}</span>
                                    </div>
                                    <div className="text-[11.5px] text-gray-600 mt-1">
                                      {repairTypeShortLabel[t.repair.repairType]} · {t.repair.parts.length > 0 ? `อะไหล่: ${t.repair.parts.map(p => p.partName).join(', ')}` : t.repair.extItems.length > 0 ? `ส่งซ่อม: ${t.repair.extItems.map(e => e.description).join(', ')}` : '—'}
                                      {t.repair.technician && <span className="text-gray-400"> · {t.repair.technician}</span>}
                                    </div>
                                    <div className="mt-2">
                                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${ratioTone(t.pct).bar}`} style={{ width: `${Math.min(100, t.pct)}%` }} /></div>
                                      <div className="text-[10.5px] text-gray-400 mt-1 text-right">ค่าซ่อมสะสม ฿{fmt(t.cum)} (<span className={`font-medium ${ratioTone(t.pct).text}`}>{t.pct.toFixed(1)}%</span>)</div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* parts aggregate */}
                    <div className={`${card} p-4`}>
                      <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><i className="ti ti-package text-[13px]" /> สรุปอะไหล่ที่ใช้สะสม</div>
                      {partsAgg.length === 0 ? (
                        <p className="text-[12px] text-gray-300 text-center py-6">ยังไม่มีการใช้อะไหล่</p>
                      ) : (
                        <table className="w-full text-[12px]">
                          <thead><tr className="border-b border-gray-100">
                            <th className="text-left py-2 text-[10px] font-medium text-gray-400 uppercase">อะไหล่</th>
                            <th className="text-right py-2 text-[10px] font-medium text-gray-400 uppercase">จำนวน</th>
                            <th className="text-right py-2 text-[10px] font-medium text-gray-400 uppercase">ค่าอะไหล่รวม (฿)</th>
                          </tr></thead>
                          <tbody>
                            {partsAgg.map(p => (
                              <tr key={p.name} className="border-b border-gray-50 last:border-0">
                                <td className="py-2 font-medium text-gray-700">{p.name}</td>
                                <td className="py-2 text-right text-gray-600">{p.qty} ชิ้น</td>
                                <td className="py-2 text-right text-blue-600 font-medium">฿{fmt(p.cost)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* external repair history */}
                    <div className={`${card} p-4`}>
                      <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><i className="ti ti-truck text-[13px]" /> ประวัติส่งซ่อมภายนอก</div>
                      {extHistory.length === 0 ? (
                        <p className="text-[12px] text-gray-300 text-center py-6">ไม่มีประวัติส่งซ่อมภายนอก</p>
                      ) : (
                        <table className="w-full text-[12px]">
                          <thead><tr className="border-b border-gray-100">
                            <th className="text-left py-2 text-[10px] font-medium text-gray-400 uppercase">วันที่</th>
                            <th className="text-left py-2 text-[10px] font-medium text-gray-400 uppercase">Vendor</th>
                            <th className="text-left py-2 text-[10px] font-medium text-gray-400 uppercase">รายการที่ส่งซ่อม</th>
                            <th className="text-right py-2 text-[10px] font-medium text-gray-400 uppercase">ค่าใช้จ่าย (฿)</th>
                          </tr></thead>
                          <tbody>
                            {extHistory.map((e, i) => (
                              <tr key={i} className="border-b border-gray-50 last:border-0">
                                <td className="py-2 text-gray-500">{fmtDate(e.date)}</td>
                                <td className="py-2 text-gray-700">{e.vendor}</td>
                                <td className="py-2 text-gray-600">{e.desc || '—'}</td>
                                <td className="py-2 text-right text-blue-600 font-medium">฿{fmt(e.cost)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Replace Modal */}
      {replaceModal && scale && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-[14px] font-medium">เปลี่ยนเครื่องใหม่ (Generation +1)</h2>
              <button onClick={() => setReplaceModal(false)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400"><i className="ti ti-x text-[15px]" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[12px] text-amber-800">
                เครื่องเดิม <strong>{scale.code}</strong> จะถูกปิดใช้งาน (Inactive) และระบบจะสร้างเครื่องใหม่รหัส <strong className="font-mono">{(() => { const p = parseScaleCode(scale.code); return p ? `${p.prefix}-${String(p.gen + 1).padStart(2, '0')}-${p.serial}` : '' })()}</strong> โดยอัตโนมัติ
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>วันที่ปิดเครื่องเดิม</label><input type="date" className={inputCls} value={rf.endOld} onChange={e => setRf(f => ({ ...f, endOld: e.target.value }))} /></div>
                <div><label className={labelCls}>วันเริ่มใช้เครื่องใหม่</label><input type="date" className={inputCls} value={rf.startNew} onChange={e => setRf(f => ({ ...f, startNew: e.target.value }))} /></div>
              </div>
              <div><label className={labelCls}>S/N เครื่องใหม่ *</label><input className={inputCls} value={rf.sn} onChange={e => setRf(f => ({ ...f, sn: e.target.value }))} /></div>
              <div><label className={labelCls}>Model เครื่องใหม่ *</label><input className={inputCls} value={rf.model} onChange={e => setRf(f => ({ ...f, model: e.target.value }))} /></div>
              <div><label className={labelCls}>ราคาเครื่องใหม่ (฿)</label><input type="number" onFocus={e => e.target.select()} className={inputCls} value={rf.price || ''} onChange={e => setRf(f => ({ ...f, price: Number(e.target.value) }))} /></div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
              <button onClick={() => setReplaceModal(false)} className="h-8 px-4 border border-gray-200 rounded-lg text-[12px] text-gray-600 hover:bg-gray-100">ยกเลิก</button>
              <button onClick={doReplace} className="h-8 px-4 bg-amber-600 text-white text-[12px] font-medium rounded-lg hover:bg-amber-700">ยืนยันเปลี่ยนเครื่อง</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
