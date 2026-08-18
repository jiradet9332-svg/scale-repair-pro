'use client'
import { useState, useEffect, useMemo } from 'react'
import { getWeightSets, createWeightSet, updateWeightSet, deleteWeightSet } from '@/lib/store'
import { wsLabel } from '@/lib/utils'
import type { WeightSet } from '@/lib/mockData'

type FormState = { id: string; name: string; valuesText: string }
const empty = (): FormState => ({ id: '', name: '', valuesText: '' })

// แปลงข้อความ "2, 5, 10, 15" -> [2,5,10,15] (กรองค่าว่าง/ไม่ใช่ตัวเลข/ค่าซ้ำออก)
function parseValues(text: string): number[] {
  const nums = text.split(',').map(s => parseFloat(s.trim())).filter(n => Number.isFinite(n) && n > 0)
  return [...new Set(nums)].sort((a, b) => a - b)
}

export default function WeightSetsPage() {
  const [sets, setSets] = useState<WeightSet[]>([])
  useEffect(() => { setSets([...getWeightSets()]) }, [])

  const [q, setQ] = useState('')
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editId, setEditId] = useState('')
  const [form, setForm] = useState(empty())
  const [err, setErr] = useState('')

  const filtered = useMemo(() => sets.filter(s => {
    if (!q) return true
    const t = q.toLowerCase()
    return s.id.toLowerCase().includes(t) || s.name.toLowerCase().includes(t) || wsLabel(s).toLowerCase().includes(t)
  }), [sets, q])

  function openAdd() { setForm(empty()); setEditId(''); setErr(''); setModal('add') }
  function openEdit(s: WeightSet) {
    setForm({ id: s.id, name: s.name, valuesText: s.values.join(', ') })
    setEditId(s.id); setErr(''); setModal('edit')
  }

  function save() {
    const values = parseValues(form.valuesText)
    if (values.length === 0) { setErr('กรุณากรอกค่าน้ำหนักอย่างน้อย 1 จุด เช่น 2, 5, 10, 15'); return }
    if (modal === 'add') {
      const res = createWeightSet({ id: form.id.trim() || undefined, name: form.name, values })
      if (!res) { setErr('รหัสชุดนี้มีอยู่แล้ว กรุณาใช้รหัสอื่น หรือเว้นว่างให้ระบบตั้งให้อัตโนมัติ'); return }
    } else {
      updateWeightSet(editId, { name: form.name, values })
    }
    setSets([...getWeightSets()])
    setModal(null)
  }

  function del(s: WeightSet) {
    if (!confirm(`ลบชุดตุ้มน้ำหนัก "${wsLabel(s)}" ?`)) return
    const ok = deleteWeightSet(s.id)
    if (!ok) { alert('ต้องมีชุดตุ้มน้ำหนักเหลืออย่างน้อย 1 ชุดเสมอ ลบชุดนี้ไม่ได้'); return }
    setSets([...getWeightSets()])
  }

  const inp = 'w-full h-9 px-3 border border-gray-200 rounded-lg text-[12.5px] bg-gray-50 text-gray-800 outline-none focus:border-blue-400'
  const lbl = 'block text-[11px] font-medium text-gray-500 mb-1'
  const card = 'bg-white border border-gray-100 rounded-xl shadow-sm'

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900">ทะเบียนชุดตุ้มน้ำหนักมาตรฐาน</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {filtered.length} ชุด — ใช้เลือกในหน้า &quot;บันทึกสอบเทียบเครื่องชั่ง&quot; แก้ไข/เพิ่ม/ลบที่นี่จะ sync กับหน้าเลือกทันที
          </p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 h-8 px-3.5 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-medium rounded-lg transition-colors">
          <i className="ti ti-plus text-[15px]" /> เพิ่มชุดตุ้มน้ำหนัก
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        <input type="text" placeholder="ค้นหารหัสชุด, ชื่อชุด, ค่าน้ำหนัก..." value={q} onChange={e => setQ(e.target.value)}
          className="h-9 flex-1 max-w-xs px-3 border border-gray-200 rounded-lg text-[12.5px] outline-none focus:border-blue-400 bg-white" />
      </div>

      <div className={`${card} overflow-hidden`}>
        <table className="w-full text-[12px]" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th style={{ width: 110 }} className="px-3 py-3 text-left text-[10px] font-medium text-gray-400 uppercase">รหัสชุด</th>
              <th style={{ width: 160 }} className="px-3 py-3 text-left text-[10px] font-medium text-gray-400 uppercase">ชื่อชุด</th>
              <th className="px-3 py-3 text-left text-[10px] font-medium text-gray-400 uppercase">ค่าน้ำหนักมาตรฐาน (g)</th>
              <th style={{ width: 90 }} className="px-3 py-3 text-right text-[10px] font-medium text-gray-400 uppercase">จำนวนจุด</th>
              <th style={{ width: 80 }} className="px-3 py-3 text-center text-[10px] font-medium text-gray-400 uppercase">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="py-14 text-center text-gray-400 text-[12px]">ยังไม่มีชุดตุ้มน้ำหนัก — กด &quot;+ เพิ่มชุดตุ้มน้ำหนัก&quot; เพื่อเริ่มต้น</td></tr>
            ) : filtered.map(s => (
              <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-3 py-3 font-mono text-blue-600 font-semibold truncate">{s.id}</td>
                <td className="px-3 py-3 text-gray-600 truncate">{s.name || '—'}</td>
                <td className="px-3 py-3 text-gray-700 font-mono truncate">{s.values.join(', ')} g</td>
                <td className="px-3 py-3 text-right tabular-nums">{s.values.length}</td>
                <td className="px-3 py-3">
                  <div className="flex justify-center gap-1.5">
                    <button onClick={() => openEdit(s)} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-100 text-gray-500"><i className="ti ti-edit text-[12px]" /></button>
                    <button onClick={() => del(s)} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded hover:bg-red-50 hover:border-red-200 hover:text-red-500 text-gray-400"><i className="ti ti-trash text-[12px]" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setModal(null)}>
          <div className={`${card} w-full max-w-md p-5`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-semibold text-gray-900">{modal === 'add' ? 'เพิ่มชุดตุ้มน้ำหนัก' : 'แก้ไขชุดตุ้มน้ำหนัก'}</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x text-[16px]" /></button>
            </div>

            <div className="space-y-3">
              {modal === 'add' && (
                <div>
                  <label className={lbl}>รหัสชุด (เว้นว่าง = ตั้งให้อัตโนมัติ)</label>
                  <input className={`${inp} font-mono`} placeholder="เช่น WS-10" value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value }))} />
                </div>
              )}
              <div>
                <label className={lbl}>ชื่อชุด (ไม่บังคับ)</label>
                <input className={inp} placeholder="เช่น แผนกบรรจุ" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className={lbl}>ค่าน้ำหนักมาตรฐาน (g) — คั่นด้วยจุลภาค</label>
                <input className={`${inp} font-mono`} placeholder="เช่น 2, 5, 10, 15" value={form.valuesText} onChange={e => setForm(f => ({ ...f, valuesText: e.target.value }))} />
                <p className="text-[10.5px] text-gray-400 mt-1">ระบบจะเรียงค่าน้อยไปมากและตัดค่าซ้ำให้อัตโนมัติ</p>
              </div>
              {err && <p className="text-[11.5px] text-red-500">{err}</p>}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setModal(null)} className="h-9 px-4 border border-gray-200 rounded-lg text-[12.5px] text-gray-600 hover:bg-gray-50">ยกเลิก</button>
              <button onClick={save} className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[12.5px] font-medium">บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
