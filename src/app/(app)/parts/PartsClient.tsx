'use client'

import { useState, useMemo, useEffect } from 'react'
import { fmt } from '@/lib/utils'
import { getParts, createPart, updatePart, deletePart } from '@/lib/store'
import type { Part } from '@/lib/mockData'

const emptyPart = (): Part => ({ code: '', name: '', modelCode: '', standardPrice: 0, note: '' })

export default function PartsClient() {
  const [parts, setParts] = useState<Part[]>([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editCode, setEditCode] = useState('')
  const [form, setForm] = useState(emptyPart())

  useEffect(() => { setParts([...getParts()]) }, [])

  const filtered = useMemo(() =>
    parts.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase())),
    [parts, search]
  )

  function openAdd() { setForm(emptyPart()); setEditCode(''); setModal('add') }
  function openEdit(p: Part) { setForm({ ...p }); setEditCode(p.code); setModal('edit') }

  function save() {
    if (!form.code || !form.name) { alert('กรุณากรอกรหัสและชื่ออะไหล่'); return }
    if (modal === 'add') {
      if (parts.find(p => p.code === form.code)) { alert(`รหัสอะไหล่ "${form.code}" มีอยู่แล้ว`); return }
      createPart({ ...form })
    } else {
      updatePart(editCode, { ...form })
    }
    setParts([...getParts()])
    setModal(null)
  }

  function del(code: string) {
    const p = parts.find(x => x.code === code)
    if (!p) return
    if (confirm(`ลบอะไหล่ "${p.name}" ?`)) {
      deletePart(code)
      setParts([...getParts()])
    }
  }

  const inp = 'w-full text-[12px] px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-800 outline-none focus:border-blue-400'

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[15px] font-medium text-gray-900">Spare Parts</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">{filtered.length} Records</p>
        </div>
        <button onClick={openAdd} className="bg-blue-600 text-white text-[12px] px-3 py-1.5 rounded-lg hover:bg-blue-700 flex items-center gap-1.5">
          <i className="ti ti-plus text-[14px]" /> Add Part
        </button>
      </div>

      <input type="text" placeholder="Search" value={search} onChange={e => setSearch(e.target.value)}
        className="w-full text-[12px] px-3 py-2 border border-gray-200 rounded-lg bg-white mb-4 outline-none focus:border-blue-400" />

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 text-[10px] font-medium text-gray-400 uppercase">Part ID</th>
              <th className="text-left px-4 py-3 text-[10px] font-medium text-gray-400 uppercase">Part Name</th>
              <th className="text-left px-4 py-3 text-[10px] font-medium text-gray-400 uppercase">Code</th>
              <th className="text-right px-4 py-3 text-[10px] font-medium text-gray-400 uppercase">Price</th>
              <th className="text-left px-4 py-3 text-[10px] font-medium text-gray-400 uppercase">Note</th>
              <th className="text-center px-4 py-3 text-[10px] font-medium text-gray-400 uppercase w-20">Manage</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-300 text-[12px]">
                {parts.length === 0 ? 'Click "Add Part"' : 'ไม่พบรายการที่ตรงกัน'}
              </td></tr>
            ) : filtered.map(p => (
              <tr key={p.code} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-gray-500 text-[11px]">{p.code}</td>
                <td className="px-4 py-3 text-gray-800 font-medium">{p.name}</td>
                <td className="px-4 py-3 text-gray-500">{p.modelCode || '—'}</td>
                <td className="px-4 py-3 text-right text-gray-700">฿{fmt(p.standardPrice)}</td>
                <td className="px-4 py-3 text-gray-400 truncate">{p.note || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-1.5">
                    <button onClick={() => openEdit(p)} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-100 text-gray-500"><i className="ti ti-edit text-[12px]" /></button>
                    <button onClick={() => del(p.code)} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded hover:bg-red-50 hover:border-red-200 hover:text-red-500 text-gray-400"><i className="ti ti-trash text-[12px]" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-[14px] font-medium">{modal === 'add' ? 'Add Part' : 'แก้ไขอะไหล่'}</h2>
              <button onClick={() => setModal(null)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400"><i className="ti ti-x text-[15px]" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Part ID</label><input className={inp} placeholder="" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} disabled={modal === 'edit'} /></div>
              <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Part Name</label><input className={inp} placeholder="" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Code</label><input className={inp} placeholder="" value={form.modelCode} onChange={e => setForm(f => ({ ...f, modelCode: e.target.value }))} /></div>
              <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Price (฿)</label><input type="number" onFocus={e => e.target.select()} className={inp} placeholder="0" min={0} value={form.standardPrice || ''} onChange={e => setForm(f => ({ ...f, standardPrice: Number(e.target.value) }))} /></div>
              <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Note</label><input className={inp} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} /></div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
              <button onClick={() => setModal(null)} className="h-8 px-4 border border-gray-200 rounded-lg text-[12px] text-gray-600 hover:bg-gray-100">Cancel</button>
              <button onClick={save} className="h-8 px-4 bg-blue-600 text-white text-[12px] font-medium rounded-lg hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
