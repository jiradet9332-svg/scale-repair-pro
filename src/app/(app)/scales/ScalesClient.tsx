'use client'

import { useState, useMemo, useEffect } from 'react'
import { fmtDate, fmt } from '@/lib/utils'
import { getScales, getSections, createScale, updateScale, deleteScale, buildScaleCode } from '@/lib/store'
import type { Scale, ScaleStatus } from '@/lib/mockData'

const PAGE = 15
const empty = (): Omit<Scale, 'id'> => ({
  code: '', sectionCode: '', brandCode: '', usageCount: 0, seqNumber: 0,
  serialNumber: '', brand: '', model: '', scaleType: '', sectionRef: '',
  startDate: '', endDate: '', purchasePrice: 0, status: 'Active',
})

export default function ScalesClient() {
  const [scales, setScales] = useState<Scale[]>([])
  const [sections, setSections] = useState(getSections())
  const [q, setQ] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fDept, setFDept] = useState('')
  const [fSection, setFSection] = useState('')
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState('code')
  const [sortDir, setSortDir] = useState<1 | -1>(1)
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(empty())
  const [formDept, setFormDept] = useState('')

  // load from store (which was hydrated from localStorage by HydrateStore)
  useEffect(() => {
    setScales([...getScales()])
    setSections([...getSections()])
  }, [])

  const preview = form.sectionCode && form.brandCode && form.seqNumber
    ? buildScaleCode(form.sectionCode, form.brandCode, form.usageCount, form.seqNumber)
    : null

  const depts = useMemo(() => [...new Set(sections.map(s => s.dept).filter(Boolean))].sort(), [sections])
  const sectionFilterOptions = useMemo(() => sections.filter(s => !fDept || s.dept === fDept), [sections, fDept])

  const filtered = useMemo(() => {
    const ql = q.toLowerCase()
    let rows = scales.filter(s => {
      const sec = sections.find(x => x.code === s.sectionRef)
      const mq = !ql || [s.code, s.brand, s.model, s.scaleType, s.serialNumber, sec?.name ?? '', sec?.dept ?? ''].some(v => v.toLowerCase().includes(ql))
      const ms = !fStatus || s.status === fStatus
      const md = !fDept || sec?.dept === fDept
      const msec = !fSection || s.sectionRef === fSection
      return mq && ms && md && msec
    })
    return [...rows].sort((a, b) => {
      const va = ((a as any)[sortKey] ?? '').toString().toLowerCase()
      const vb = ((b as any)[sortKey] ?? '').toString().toLowerCase()
      return va < vb ? -sortDir : va > vb ? sortDir : 0
    })
  }, [scales, q, fStatus, fDept, fSection, sortKey, sortDir, sections])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const pageData = filtered.slice((page - 1) * PAGE, page * PAGE)

  function handleSort(k: string) {
    if (sortKey === k) setSortDir(d => d === 1 ? -1 : 1)
    else { setSortKey(k); setSortDir(1) }
  }

  function openAdd() { setForm(empty()); setFormDept(''); setEditId(null); setModal('add') }
  function openEdit(s: Scale) { setForm({ ...s }); setFormDept(sections.find(x => x.code === s.sectionRef)?.dept ?? ''); setEditId(s.id); setModal('edit') }
  function closeModal() { setModal(null) }

  function save() {
    if (!form.sectionCode || !form.brandCode || !form.seqNumber || !form.brand) {
      alert('กรุณากรอก Section Code, Brand Code, หมายเลขเครื่อง และ Brand'); return
    }
    const code = buildScaleCode(form.sectionCode, form.brandCode, form.usageCount, form.seqNumber)
    if (modal === 'add') {
      if (scales.find(s => s.code === code)) { alert(`Scale ID "${code}" มีอยู่แล้ว`); return }
      createScale({ ...form, code })
    } else if (editId !== null) {
      updateScale(editId, { ...form, code })
    }
    setScales([...getScales()])
    closeModal()
  }

  function del(id: number) {
    const s = scales.find(x => x.id === id)
    if (!s) return
    if (confirm(`ลบเครื่องชั่ง "${s.code}" ออกจากทะเบียน?`)) {
      deleteScale(id)
      setScales([...getScales()])
    }
  }

  function pageList(): (number | '…')[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pts: (number | '…')[] = [1]
    if (page > 3) pts.push('…')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pts.push(i)
    if (page < totalPages - 2) pts.push('…')
    pts.push(totalPages)
    return pts
  }

  const SortIcon = ({ k }: { k: string }) => (
    <span className="ml-1 opacity-40 text-[9px]">{sortKey === k ? (sortDir === 1 ? '↑' : '↓') : '↕'}</span>
  )

  const inp = 'w-full h-9 px-3 border border-gray-200 rounded-lg text-[13px] bg-gray-50 text-gray-800 outline-none focus:border-blue-400'
  const lbl = 'block text-[12px] font-medium text-gray-500 mb-1'

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 h-8 min-w-[180px] flex-1 max-w-[260px]">
            <i className="ti ti-search text-gray-400 text-[14px]" />
            <input className="border-none outline-none text-[13px] w-full bg-transparent" placeholder="Search"
              value={q} onChange={e => { setQ(e.target.value); setPage(1) }} />
          </div>
          <select className="h-8 px-2 border border-gray-200 rounded-lg text-[13px] bg-white text-gray-700 outline-none"
            value={fStatus} onChange={e => { setFStatus(e.target.value); setPage(1) }}>
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <select className="h-8 px-2 border border-gray-200 rounded-lg text-[13px] bg-white text-gray-700 outline-none max-w-[160px]"
            value={fDept} onChange={e => { setFDept(e.target.value); setFSection(''); setPage(1) }}>
            <option value="">All Department</option>
            {depts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="h-8 px-2 border border-gray-200 rounded-lg text-[13px] bg-white text-gray-700 outline-none max-w-[160px]"
            value={fSection} onChange={e => { setFSection(e.target.value); setPage(1) }}>
            <option value="">All Section</option>
            {sectionFilterOptions.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
          <span className="text-[12px] text-gray-400">{filtered.length} Records</span>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 h-8 px-3.5 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-medium rounded-lg transition-colors flex-shrink-0">
          <i className="ti ti-plus text-[15px]" /> Add Scale
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] border-collapse" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-3 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide cursor-pointer w-36" onClick={() => handleSort('code')}>Scale ID <SortIcon k="code" /></th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide w-24">S/N</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide cursor-pointer w-28" onClick={() => handleSort('brand')}>Brand <SortIcon k="brand" /></th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide w-24">Model</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide w-20">Type</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide w-28">Department</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide w-28">Section</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide w-24">Start Date</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide w-24">End Date</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wide w-28">Machine Price</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide w-20">Status</th>
                <th className="px-3 py-2.5 text-center text-[11px] font-medium text-gray-500 uppercase tracking-wide w-20">Manage</th>
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 ? (
                <tr><td colSpan={12} className="py-16 text-center text-gray-400 text-[13px]">ยังไม่มีข้อมูลเครื่องชั่ง — กด &quot;เพิ่มเครื่องชั่ง&quot; เพื่อเริ่มต้น</td></tr>
              ) : pageData.map(s => {
                const sec = sections.find(x => x.code === s.sectionRef)
                return (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2.5 font-medium text-blue-600 tracking-wide text-[12px] font-mono">{s.code}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-[12px]">{s.serialNumber || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-800">{s.brand}</td>
                    <td className="px-3 py-2.5 text-gray-500">{s.model || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-500">{s.scaleType || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600">{sec?.dept ?? '—'}</td>
                    <td className="px-3 py-2.5 text-gray-700">{sec?.name ?? '—'}</td>
                    <td className="px-3 py-2.5 text-gray-400 text-[12px]">{fmtDate(s.startDate)}</td>
                    <td className="px-3 py-2.5 text-gray-400 text-[12px]">{s.endDate ? fmtDate(s.endDate) : '—'}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{s.purchasePrice ? '฿' + fmt(s.purchasePrice) : '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${s.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'Active' ? 'bg-emerald-500' : 'bg-gray-400'}`} />{s.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-center gap-1.5">
                        <button onClick={() => openEdit(s)} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-100 text-gray-500"><i className="ti ti-edit text-[13px]" /></button>
                        <button onClick={() => del(s.id)} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded hover:bg-red-50 hover:border-red-200 hover:text-red-500 text-gray-400"><i className="ti ti-trash text-[13px]" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-gray-50">
          <span className="text-[12px] text-gray-400">Page {page} / {totalPages} ({filtered.length} Records)</span>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded text-gray-500 disabled:opacity-30 text-[12px]">‹</button>
            {pageList().map((p, i) => p === '…'
              ? <button key={`e${i}`} disabled className="w-7 h-7 text-gray-400 text-[12px]">…</button>
              : <button key={p} onClick={() => setPage(p as number)} className={`w-7 h-7 flex items-center justify-center border rounded text-[12px] ${page === p ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600'}`}>{p}</button>
            )}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded text-gray-500 disabled:opacity-30 text-[12px]">›</button>
          </div>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-[15px] font-medium text-gray-900">{modal === 'add' ? 'Add Scale' : 'แก้ไขข้อมูลเครื่องชั่ง'}</h2>
              <button onClick={closeModal} className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400"><i className="ti ti-x text-[15px]" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className={lbl}>Scale ID</label>
                <div className={`px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[13px] font-medium tracking-wide font-mono ${preview ? 'text-blue-600' : 'text-gray-400'}`}>
                  {preview || 'XX-XX-XX-XXX'}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Section ID</label><input className={inp} placeholder="" maxLength={4} value={form.sectionCode} onChange={e => setForm(f => ({ ...f, sectionCode: e.target.value.toUpperCase() }))} /></div>
                <div><label className={lbl}>Brand ID</label><input className={inp} placeholder="" maxLength={4} value={form.brandCode} onChange={e => setForm(f => ({ ...f, brandCode: e.target.value.toUpperCase() }))} /></div>
                <div><label className={lbl}>Reuse Count (Reset = 0)</label><input type="number" onFocus={e => e.target.select()} className={inp} min={0} max={99} value={form.usageCount} onChange={e => setForm(f => ({ ...f, usageCount: Number(e.target.value) }))} /></div>
                <div><label className={lbl}>Machine Number</label><input type="number" onFocus={e => e.target.select()} className={inp} placeholder="1" min={1} max={999} value={form.seqNumber || ''} onChange={e => setForm(f => ({ ...f, seqNumber: Number(e.target.value) }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Serial Number</label><input className={inp} value={form.serialNumber} onChange={e => setForm(f => ({ ...f, serialNumber: e.target.value }))} /></div>
                <div><label className={lbl}>Brand</label><input className={inp} placeholder="" value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} /></div>
                <div><label className={lbl}>Model</label><input className={inp} placeholder="" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} /></div>
                <div><label className={lbl}>Type</label>
                  <select className={inp} value={form.scaleType} onChange={e => setForm(f => ({ ...f, scaleType: e.target.value as any }))}>
                    <option value="">— Select —</option><option value="Digital">Digital</option><option value="Spring">Spring</option>
                  </select></div>
              </div>
              <div><label className={lbl}>Department</label>
                <select className={inp} value={formDept} onChange={e => { setFormDept(e.target.value); setForm(f => ({ ...f, sectionRef: '' })) }}>
                  <option value="">— Select —</option>
                  {depts.map(d => <option key={d} value={d}>{d}</option>)}
                </select></div>
              <div><label className={lbl}>Section</label>
                <select className={inp} value={form.sectionRef} disabled={!formDept} onChange={e => setForm(f => ({ ...f, sectionRef: e.target.value }))}>
                  <option value="">{formDept ? '— Select —' : '— Select Department first —'}</option>
                  {sections.filter(s => s.dept === formDept).map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                </select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Start Date</label><input type="date" className={inp} value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} /></div>
                <div><label className={lbl}>End Date</label><input type="date" className={inp} value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} /></div>
                <div><label className={lbl}>Machine Price (฿)</label><input type="number" onFocus={e => e.target.select()} className={inp} placeholder="0" min={0} value={form.purchasePrice || ''} onChange={e => setForm(f => ({ ...f, purchasePrice: Number(e.target.value) }))} /></div>
                <div><label className={lbl}>Status</label>
                  <select className={inp} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ScaleStatus }))}>
                    <option value="Active">Active</option><option value="Inactive">Inactive</option>
                  </select></div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
              <button onClick={closeModal} className="h-8 px-4 border border-gray-200 rounded-lg text-[13px] text-gray-600 hover:bg-gray-100">Cancel</button>
              <button onClick={save} className="h-8 px-4 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-medium rounded-lg">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

