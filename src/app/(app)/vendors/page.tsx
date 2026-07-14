'use client'
import { useState, useEffect } from 'react'
import { getVendors, createVendor, updateVendor, deleteVendor } from '@/lib/store'
import type { Vendor } from '@/lib/mockData'

const empty = (): Vendor => ({ code: '', name: '', abbr: '' })

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([])

  useEffect(() => { setVendors([...getVendors()]) }, [])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editCode, setEditCode] = useState('')
  const [form, setForm] = useState(empty())

  const filtered = vendors.filter(v =>
    !search || v.code.toLowerCase().includes(search.toLowerCase()) ||
    v.name.toLowerCase().includes(search.toLowerCase())
  )

  function openAdd() { setForm(empty()); setEditCode(''); setModal('add') }
  function openEdit(v: Vendor) { setForm({ ...v }); setEditCode(v.code); setModal('edit') }

  function save() {
    const code = form.code.trim().toUpperCase()
    const name = form.name.trim()
    if (!code || !name) { alert('กรุณากรอกรหัสและชื่อบริษัท'); return }
    if (modal === 'add') {
      const res = createVendor({ ...form, code })
      if (!res) { alert('รหัส Vendor นี้มีอยู่แล้ว'); return }
    } else {
      updateVendor(editCode, { ...form })
    }
    setVendors([...getVendors()])
    setModal(null)
  }

  function del(code: string) {
    if (!confirm(`ลบ Vendor "${code}" ?`)) return
    deleteVendor(code)
    setVendors([...getVendors()])
  }

  const inp = 'w-full h-9 px-3 border border-gray-200 rounded-lg text-[13px] bg-gray-50 text-gray-800 outline-none focus:border-blue-400'

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900">Vendor</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">{filtered.length} Vendor</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 h-8 px-3.5 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-medium rounded-lg transition-colors">
          <i className="ti ti-plus text-[15px]" /> Add Vendor
        </button>
      </div>

      <input type="text" placeholder="Search" value={search} onChange={e => setSearch(e.target.value)}
        className="w-full text-[12px] px-3 py-2 border border-gray-200 rounded-lg bg-white mb-4 outline-none focus:border-blue-400" />

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-4 py-3 text-left text-[10px] font-medium text-gray-400 uppercase">ID</th>
              <th className="px-4 py-3 text-left text-[10px] font-medium text-gray-400 uppercase">Vendor Name</th>
              <th className="px-4 py-3 text-left text-[10px] font-medium text-gray-400 uppercase">Vendor ID</th>
              <th className="px-4 py-3 text-center text-[10px] font-medium text-gray-400 uppercase w-20">Manage</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={4} className="py-14 text-center text-gray-400 text-[13px]">ยังไม่มี Vendor — กด &quot;+ เพิ่ม Vendor&quot; เพื่อเริ่มต้น</td></tr>
            ) : filtered.map(v => (
              <tr key={v.code} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-blue-600 text-[12px] font-semibold">{v.code}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{v.name}</td>
                <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-600 border border-gray-200">{v.abbr || '—'}</span></td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-1.5">
                    <button onClick={() => openEdit(v)} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-100 text-gray-500 transition-colors"><i className="ti ti-edit text-[13px]" /></button>
                    <button onClick={() => del(v.code)} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded hover:bg-red-50 hover:border-red-200 hover:text-red-500 text-gray-400 transition-colors"><i className="ti ti-trash text-[13px]" /></button>
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
              <h2 className="text-[14px] font-medium">{modal === 'add' ? 'Add Vendor' : 'แก้ไข Vendor'}</h2>
              <button onClick={() => setModal(null)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400"><i className="ti ti-x text-[15px]" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div><label className="block text-[11px] font-medium text-gray-500 mb-1">ID</label>
                <input className={inp} placeholder="" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} disabled={modal === 'edit'} /></div>
              <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Vendor Name</label>
                <input className={inp} placeholder="" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Vendor ID</label>
                <input className={inp} placeholder="" value={form.abbr} onChange={e => setForm(f => ({ ...f, abbr: e.target.value }))} /></div>
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
