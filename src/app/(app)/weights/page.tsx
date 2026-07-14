'use client'
import { useState, useEffect, useMemo } from 'react'
import { getWeights, createWeight, updateWeight, deleteWeight, getSections } from '@/lib/store'
import { fmtDate, cpStatus, wtStatus } from '@/lib/utils'
import type { Weight } from '@/lib/mockData'

const PAGE = 15
const CLASS_SUGGESTIONS = ['E1', 'E2', 'F1', 'F2', 'M1', 'M2', 'M3']

// ฟอร์มเก็บช่องตัวเลขเป็น string ระหว่างพิมพ์ (กันปัญหาเลข 0 นำหน้าหาย เช่น 0.3 กลายเป็น .3)
type WeightFormState = Omit<Weight, 'weightG' | 'mpe' | 'convMass' | 'uncertainty'> & {
  weightG: string
  mpe: string
  convMass: string
  uncertainty: string
}

const empty = (): WeightFormState => ({
  sn: '', sectionCode: '', weightG: '', class_: 'F1', supplier: '',
  mpe: '', calDate: '', calBy: '', certNo: '', convMass: '', uncertainty: '', status: 'Pass',
})

const toNum = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) ? n : 0 }

export default function WeightsPage() {
  const [weights, setWeights] = useState<Weight[]>([])

  useEffect(() => { setWeights([...getWeights()]) }, [])
  const sections = getSections()
  const [q, setQ] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editSn, setEditSn] = useState('')
  const [form, setForm] = useState(empty())

  const filtered = useMemo(() => weights.filter(w => {
    const mq = !q || [w.sn, w.supplier, w.certNo].some(v => v.toLowerCase().includes(q.toLowerCase()))
    const ms = !fStatus || w.status === fStatus
    return mq && ms
  }), [weights, q, fStatus])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const pageData = filtered.slice((page - 1) * PAGE, page * PAGE)

  function openAdd() { setForm(empty()); setEditSn(''); setModal('add') }
  function openEdit(w: Weight) {
    setForm({ ...w, weightG: String(w.weightG || ''), mpe: String(w.mpe || ''), convMass: String(w.convMass || ''), uncertainty: String(w.uncertainty || '') })
    setEditSn(w.sn); setModal('edit')
  }

  function save() {
    const sn = form.sn.trim()
    if (!sn) { alert('กรุณากรอกหมายเลข S/N'); return }
    const weightG = toNum(form.weightG), mpe = toNum(form.mpe), convMass = toNum(form.convMass), uncertainty = toNum(form.uncertainty)
    const status = wtStatus(uncertainty, mpe)
    const payload: Weight = { ...form, sn, weightG, mpe, convMass, uncertainty, status }
    if (modal === 'add') {
      const res = createWeight(payload)
      if (!res) { alert('S/N นี้มีอยู่แล้ว'); return }
    } else {
      updateWeight(editSn, payload)
    }
    setWeights([...getWeights()])
    setModal(null)
  }

  function del(sn: string) {
    if (!confirm(`ลบลูกตุ้ม "${sn}" ?`)) return
    deleteWeight(sn)
    setWeights([...getWeights()])
  }

  const inp = 'w-full h-9 px-3 border border-gray-200 rounded-lg text-[12.5px] bg-gray-50 text-gray-800 outline-none focus:border-blue-400'
  const lbl = 'block text-[11px] font-medium text-gray-500 mb-1'

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900">ทะเบียนลูกตุ้มน้ำหนักมาตรฐาน</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">{filtered.length} รายการ</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 h-8 px-3.5 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-medium rounded-lg transition-colors">
          <i className="ti ti-plus text-[15px]" /> เพิ่มลูกตุ้ม
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        <input type="text" placeholder="ค้นหา S/N, ผู้จำหน่าย, เลขเซอร์..." value={q} onChange={e => { setQ(e.target.value); setPage(1) }}
          className="flex-1 text-[12px] px-3 py-2 border border-gray-200 rounded-lg bg-white outline-none focus:border-blue-400" />
        <select value={fStatus} onChange={e => { setFStatus(e.target.value); setPage(1) }}
          className="text-[12px] px-3 py-2 border border-gray-200 rounded-lg bg-white outline-none">
          <option value="">ทุกสถานะ</option>
          <option value="Pass">Pass</option>
          <option value="Not pass">Not pass</option>
        </select>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]" style={{ tableLayout: 'auto', minWidth: 1400 }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-3 py-3 text-left text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">Section</th>
                <th className="px-3 py-3 text-right text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">Weight (g)</th>
                <th className="px-3 py-3 text-left text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">Weight S/N</th>
                <th className="px-3 py-3 text-left text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">Class</th>
                <th className="px-3 py-3 text-left text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">Supplier</th>
                <th className="px-3 py-3 text-right text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">MPE (mg.)</th>
                <th className="px-3 py-3 text-left text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">Calibrate Date</th>
                <th className="px-3 py-3 text-left text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">Calibrate By</th>
                <th className="px-3 py-3 text-left text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">Certificate Report No.</th>
                <th className="px-3 py-3 text-right text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">Conventional Mass (mg.)</th>
                <th className="px-3 py-3 text-right text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">Uncertainty (mg.)</th>
                <th className="px-3 py-3 text-left text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">Status</th>
                <th className="px-3 py-3 text-center text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 ? (
                <tr><td colSpan={13} className="py-14 text-center text-gray-400 text-[12px]">ยังไม่มีข้อมูลลูกตุ้ม — กด &quot;+ เพิ่มลูกตุ้ม&quot; เพื่อเริ่มต้น</td></tr>
              ) : pageData.map(w => {
                const sec = sections.find(s => s.code === w.sectionCode)
                const st = wtStatus(w.uncertainty, w.mpe)
                return (
                  <tr key={w.sn} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{sec?.name ?? w.sectionCode ?? '—'}</td>
                    <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">{w.weightG}</td>
                    <td className="px-3 py-3 font-mono text-blue-600 font-semibold whitespace-nowrap">{w.sn}</td>
                    <td className="px-3 py-3 whitespace-nowrap"><span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[11px]">{w.class_}</span></td>
                    <td className="px-3 py-3 text-gray-600 truncate">{w.supplier || '—'}</td>
                    <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">{w.mpe}</td>
                    <td className="px-3 py-3 text-gray-500 whitespace-nowrap">{fmtDate(w.calDate)}</td>
                    <td className="px-3 py-3 text-gray-600 truncate">{w.calBy || '—'}</td>
                    <td className="px-3 py-3 text-gray-500 truncate">{w.certNo || '—'}</td>
                    <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">{w.convMass}</td>
                    <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">{w.uncertainty}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${st === 'Pass' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{st}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-center gap-1.5">
                        <button onClick={() => openEdit(w)} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-100 text-gray-500"><i className="ti ti-edit text-[12px]" /></button>
                        <button onClick={() => del(w.sn)} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded hover:bg-red-50 hover:border-red-200 hover:text-red-500 text-gray-400"><i className="ti ti-trash text-[12px]" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-gray-50">
          <span className="text-[12px] text-gray-400">หน้า {page} / {totalPages} ({filtered.length} รายการ)</span>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded text-gray-500 disabled:opacity-30 text-[12px]">‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 flex items-center justify-center border rounded text-[12px] ${page === p ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600'}`}>{p}</button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded text-gray-500 disabled:opacity-30 text-[12px]">›</button>
          </div>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-[14px] font-medium">{modal === 'add' ? 'เพิ่มลูกตุ้มใหม่' : 'แก้ไขลูกตุ้ม'}</h2>
              <button onClick={() => setModal(null)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400"><i className="ti ti-x text-[15px]" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Section</label>
                  <select className={inp} value={form.sectionCode} onChange={e => setForm(f => ({ ...f, sectionCode: e.target.value }))}>
                    <option value="">— เลือกจากทะเบียน —</option>
                    {sections.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                  </select></div>
                <div><label className={lbl}>Weight (g)</label><input type="text" inputMode="decimal" onFocus={e => e.target.select()} className={inp} value={form.weightG} onChange={e => { const v = e.target.value; if (/^-?\d*\.?\d*$/.test(v)) setForm(f => ({ ...f, weightG: v })) }} /></div>
                <div><label className={lbl}>Weight S/N *</label><input className={inp} value={form.sn} onChange={e => setForm(f => ({ ...f, sn: e.target.value }))} disabled={modal === 'edit'} /></div>
                <div><label className={lbl}>Class</label>
                  <input list="classSuggestions" className={inp} value={form.class_} onChange={e => setForm(f => ({ ...f, class_: e.target.value }))} placeholder="เช่น F1, F2, M1 ..." />
                  <datalist id="classSuggestions">
                    {CLASS_SUGGESTIONS.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div><label className={lbl}>Supplier</label><input className={inp} value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} /></div>
                <div><label className={lbl}>MPE (mg.)</label><input type="text" inputMode="decimal" onFocus={e => e.target.select()} className={inp} value={form.mpe} onChange={e => { const v = e.target.value; if (/^-?\d*\.?\d*$/.test(v)) setForm(f => ({ ...f, mpe: v })) }} /></div>
                <div><label className={lbl}>Calibrate Date</label><input type="date" className={inp} value={form.calDate} onChange={e => setForm(f => ({ ...f, calDate: e.target.value }))} /></div>
                <div><label className={lbl}>Calibrate By</label><input className={inp} value={form.calBy} onChange={e => setForm(f => ({ ...f, calBy: e.target.value }))} /></div>
                <div><label className={lbl}>Certificate Report No.</label><input className={inp} value={form.certNo} onChange={e => setForm(f => ({ ...f, certNo: e.target.value }))} /></div>
                <div><label className={lbl}>Conventional Mass (mg.)</label><input type="text" inputMode="decimal" onFocus={e => e.target.select()} className={inp} value={form.convMass} onChange={e => { const v = e.target.value; if (/^-?\d*\.?\d*$/.test(v)) setForm(f => ({ ...f, convMass: v })) }} /></div>
                <div><label className={lbl}>Uncertainty (mg.)</label><input type="text" inputMode="decimal" onFocus={e => e.target.select()} className={inp} value={form.uncertainty} onChange={e => { const v = e.target.value; if (/^-?\d*\.?\d*$/.test(v)) setForm(f => ({ ...f, uncertainty: v })) }} /></div>
                <div><label className={lbl}>Status (คำนวณอัตโนมัติ)</label>
                  <div className={`${inp} flex items-center bg-gray-100`}>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${wtStatus(toNum(form.uncertainty), toNum(form.mpe)) === 'Pass' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                      {wtStatus(toNum(form.uncertainty), toNum(form.mpe))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
              <button onClick={() => setModal(null)} className="h-8 px-4 border border-gray-200 rounded-lg text-[12px] text-gray-600 hover:bg-gray-100">ยกเลิก</button>
              <button onClick={save} className="h-8 px-4 bg-blue-600 text-white text-[12px] font-medium rounded-lg hover:bg-blue-700">บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
