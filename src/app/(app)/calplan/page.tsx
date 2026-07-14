'use client'
import { useState, useEffect, useMemo } from 'react'
import { getCalPlan, updateCalLastCal, addCalPlanItem, updateCalPlanItem, deleteCalPlanItem } from '@/lib/store'
import { fmtDate, cpStatus, cpAddMonths } from '@/lib/utils'
import type { CalPlan } from '@/lib/mockData'

const empty = (): CalPlan => ({ id: '', group: 'scale', department: '', location: '', type: '', qty: 1, intervalMonths: 12, lastCal: new Date().toISOString().slice(0,10) })

export default function CalPlanPage() {
  const [plan, setPlan]     = useState<CalPlan[]>([])

  useEffect(() => { setPlan([...getCalPlan()]) }, [])
  const [tab, setTab]       = useState<'all' | 'scale' | 'weight'>('all')
  const [modal, setModal]   = useState<'add' | 'edit' | null>(null)
  const [editId, setEditId] = useState('')
  const [form, setForm]     = useState(empty())

  const rows = useMemo(() => {
    const filtered = tab === 'all' ? plan : plan.filter(p => p.group === tab)
    return filtered
      .map(p => ({ ...p, st: cpStatus(p.lastCal, p.intervalMonths) }))
      .sort((a, b) => a.st.days - b.st.days)
  }, [plan, tab])

  const overdue = rows.filter(r => r.st.days < 0).length
  const soon    = rows.filter(r => r.st.days >= 0 && r.st.days <= 30).length

  function openAdd()  { setForm(empty()); setEditId(''); setModal('add') }
  function openEdit(p: CalPlan) { setForm({ ...p }); setEditId(p.id); setModal('edit') }

  function save() {
    if (!form.location || !form.type) { alert('กรุณากรอกสถานที่และประเภท'); return }
    if (modal === 'add') {
      const prefix = form.group === 'scale' ? 'CP-S' : 'CP-W'
      const existing = plan.filter(p => p.id.startsWith(prefix)).length
      const id = `${prefix}-${String(existing + 1).padStart(3, '0')}`
      addCalPlanItem({ ...form, id })
    } else {
      updateCalPlanItem(editId, { ...form })
    }
    setPlan([...getCalPlan()])
    setModal(null)
  }

  function del(id: string) {
    if (!confirm(`ลบแผนสอบเทียบ "${id}" ?`)) return
    deleteCalPlanItem(id)
    setPlan([...getCalPlan()])
  }

  function markDone(id: string) {
    updateCalLastCal(id, new Date().toISOString().slice(0, 10))
    setPlan([...getCalPlan()])
  }

  const inp = 'w-full h-9 px-3 border border-gray-200 rounded-lg text-[12.5px] bg-gray-50 text-gray-800 outline-none focus:border-blue-400'
  const lbl = 'block text-[11px] font-medium text-gray-500 mb-1'

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900">แผนสอบเทียบเครื่องชั่ง / ลูกตุ้ม</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {rows.length} รายการ
            {overdue > 0 && <span className="ml-2 text-red-600 font-medium">• เกินกำหนด {overdue} รายการ</span>}
            {soon > 0 && <span className="ml-2 text-amber-600 font-medium">• ใกล้ครบกำหนด {soon} รายการ</span>}
          </p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 h-8 px-3.5 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-medium rounded-lg transition-colors">
          <i className="ti ti-plus text-[15px]" /> เพิ่มแผน
        </button>
      </div>

      <div className="flex gap-1.5 mb-4">
        {[
          { v: 'all',    l: 'ทั้งหมด' },
          { v: 'scale',  l: '⚖️ เครื่องชั่ง' },
          { v: 'weight', l: '🏋️ ลูกตุ้ม' },
        ].map(t => (
          <button key={t.v} onClick={() => setTab(t.v as any)}
            className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-medium border transition-colors ${tab === t.v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
            {t.l}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-[12.5px]" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-3 py-3 text-left text-[10px] font-medium text-gray-400 uppercase w-28">ID</th>
              <th className="px-3 py-3 text-left text-[10px] font-medium text-gray-400 uppercase w-32">ฝ่าย/แผนก</th>
              <th className="px-3 py-3 text-left text-[10px] font-medium text-gray-400 uppercase">สถานที่ / รายการ</th>
              <th className="px-3 py-3 text-left text-[10px] font-medium text-gray-400 uppercase w-32">ประเภท</th>
              <th className="px-3 py-3 text-right text-[10px] font-medium text-gray-400 uppercase w-16">จำนวน</th>
              <th className="px-3 py-3 text-left text-[10px] font-medium text-gray-400 uppercase w-24">สอบเทียบล่าสุด</th>
              <th className="px-3 py-3 text-left text-[10px] font-medium text-gray-400 uppercase w-24">กำหนดครั้งต่อไป</th>
              <th className="px-3 py-3 text-left text-[10px] font-medium text-gray-400 uppercase w-28">สถานะ</th>
              <th className="px-3 py-3 text-center text-[10px] font-medium text-gray-400 uppercase w-24">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} className="py-14 text-center text-gray-400 text-[12px]">ยังไม่มีแผนสอบเทียบ</td></tr>
            ) : rows.map(r => (
              <tr key={r.id} className={`border-b border-gray-50 hover:bg-gray-50 ${r.st.days < 0 ? 'bg-red-50/40' : ''}`}>
                <td className="px-3 py-3 font-mono text-blue-600 text-[11px] font-semibold">{r.id}</td>
                <td className="px-3 py-3 text-gray-600 truncate">{r.department}</td>
                <td className="px-3 py-3 font-medium text-gray-800 truncate">{r.location}</td>
                <td className="px-3 py-3 text-gray-500 truncate">{r.type}</td>
                <td className="px-3 py-3 text-right">{r.qty}</td>
                <td className="px-3 py-3 text-gray-500">{fmtDate(r.lastCal)}</td>
                <td className="px-3 py-3 text-gray-700 font-medium">{fmtDate(r.st.due)}</td>
                <td className="px-3 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-medium border ${r.st.cls}`}>
                    {r.st.label} {r.st.days < 0 ? `(${Math.abs(r.st.days)} วัน)` : r.st.days <= 30 ? `(${r.st.days} วัน)` : ''}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-center gap-1.5">
                    <button onClick={() => markDone(r.id)} title="บันทึกว่าสอบเทียบแล้ววันนี้" className="w-6 h-6 flex items-center justify-center border border-emerald-200 rounded hover:bg-emerald-50 text-emerald-600"><i className="ti ti-check text-[12px]" /></button>
                    <button onClick={() => openEdit(r)} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-100 text-gray-500"><i className="ti ti-edit text-[12px]" /></button>
                    <button onClick={() => del(r.id)} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded hover:bg-red-50 hover:border-red-200 hover:text-red-500 text-gray-400"><i className="ti ti-trash text-[12px]" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-[14px] font-medium">{modal === 'add' ? 'เพิ่มแผนสอบเทียบ' : 'แก้ไขแผนสอบเทียบ'}</h2>
              <button onClick={() => setModal(null)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400"><i className="ti ti-x text-[15px]" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>กลุ่ม</label>
                  <select className={inp} value={form.group} onChange={e => setForm(f => ({ ...f, group: e.target.value as 'scale'|'weight' }))}>
                    <option value="scale">เครื่องชั่ง</option>
                    <option value="weight">ลูกตุ้ม</option>
                  </select></div>
                <div><label className={lbl}>ฝ่าย / แผนก</label><input className={inp} value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} /></div>
              </div>
              <div><label className={lbl}>สถานที่ / รายการ *</label><input className={inp} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>ประเภท *</label><input className={inp} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} /></div>
                <div><label className={lbl}>จำนวน</label><input type="number" onFocus={e => e.target.select()} className={inp} value={form.qty || ''} onChange={e => setForm(f => ({ ...f, qty: Number(e.target.value) }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>รอบสอบเทียบ (เดือน)</label><input type="number" onFocus={e => e.target.select()} className={inp} value={form.intervalMonths || ''} onChange={e => setForm(f => ({ ...f, intervalMonths: Number(e.target.value) }))} /></div>
                <div><label className={lbl}>สอบเทียบล่าสุด</label><input type="date" className={inp} value={form.lastCal} onChange={e => setForm(f => ({ ...f, lastCal: e.target.value }))} /></div>
              </div>
              {form.lastCal && form.intervalMonths > 0 && (
                <p className="text-[11px] text-gray-400">กำหนดครั้งต่อไป: <span className="font-medium text-blue-600">{fmtDate(cpAddMonths(form.lastCal, form.intervalMonths))}</span></p>
              )}
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
