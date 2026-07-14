'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createRepair, updateRepair, getScales, getSections, getParts, getVendors, getLatestScales } from '@/lib/store'
import { repairTypeColor } from '@/lib/utils'
import type { RepairJob, RepairType, RepairPart, ExtItem } from '@/lib/mockData'

interface Props { defaultValues?: RepairJob; isEdit?: boolean }

const REPAIR_TYPES: { value: RepairType; icon: string; label: string }[] = [
  { value: 'self', icon: 'ti-tool',     label: 'ซ่อม / เปลี่ยนอะไหล่' },
  { value: 'ext',  icon: 'ti-truck',    label: 'ส่งซ่อมภายนอก' },
  { value: 'both', icon: 'ti-stack-2',  label: 'ทั้งสองแบบ' },
]

const WORK_TYPES = ['ซ่อม', 'บำรุงรักษาเชิงป้องกัน (PM)', 'ปรับเทียบ / คาลิเบรท', 'ตรวจสอบ']

const emptyPart = (): RepairPart => ({ partName: '', qty: 1, unitPrice: 0, cost: 0 })

export default function RepairForm({ defaultValues, isEdit }: Props) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)

  // ── hydrate from store after mount ────────────────────────────────────────
  const [scales, setScales] = useState(getScales())
  const [sections, setSections] = useState(getSections())
  const [partsList, setPartsList] = useState(getParts())
  const [vendors, setVendors] = useState(getVendors())
  useEffect(() => {
    setScales(getScales())
    setSections(getSections())
    setPartsList(getParts())
    setVendors(getVendors())
  }, [])

  // ── form fields ────────────────────────────────────────────────────────────
  const initParts = () => defaultValues?.parts?.length ? defaultValues.parts : [emptyPart(), emptyPart(), emptyPart(), emptyPart()]

  const [date, setDate] = useState(defaultValues?.date ?? today)
  const [pmiiDocNo, setPmiiDocNo] = useState(defaultValues?.pmiiDocNo ?? '')
  const [technician, setTechnician] = useState(defaultValues?.technician ?? '')
  const [repairType, setRepairType] = useState<RepairType>(defaultValues?.repairType ?? 'self')
  const [workType, setWorkType] = useState(WORK_TYPES[0])
  const [actionTaken, setActionTaken] = useState(defaultValues?.actionTaken ?? '')
  const [vendorCode, setVendorCode] = useState(defaultValues?.vendorCode ?? '')
  const [parts, setParts] = useState<RepairPart[]>(initParts())
  const initExt = () => defaultValues?.extItems?.length ? defaultValues.extItems : [{ description: '', cost: 0 }, { description: '', cost: 0 }]
  const [extItems, setExt] = useState<ExtItem[]>(initExt())
  const [err, setErr] = useState('')

  // ── cascade: Dept → Section → Scale ───────────────────────────────────────
  const depts = useMemo(() => [...new Set(sections.map(s => s.dept).filter(Boolean))].sort(), [sections])

  // init dept from defaultValues if editing
  const initDept = useMemo(() => {
    if (!defaultValues?.sectionCode) return ''
    const sec = sections.find(s => s.code === defaultValues.sectionCode)
    return sec?.dept ?? ''
  }, [defaultValues, sections])

  const [dept, setDept] = useState(initDept)
  const [sectionCode, setSectionCode] = useState(defaultValues?.sectionCode ?? '')
  const [scaleCode, setScaleCode] = useState(defaultValues?.scaleCode ?? '')

  const sectionOptions = useMemo(
    () => sections.filter(s => !dept || s.dept === dept),
    [sections, dept]
  )
  const scaleOptions = useMemo(() => {
    const latest = getLatestScales(scales.filter(s => !sectionCode || s.sectionRef === sectionCode))
    // ถ้ากำลังแก้ไขรายการเดิมที่ผูกกับรหัสรุ่นเก่า ให้คงตัวเลือกนั้นไว้ด้วยเพื่อไม่ให้ค่าหาย
    if (scaleCode && !latest.find(s => s.code === scaleCode)) {
      const cur = scales.find(s => s.code === scaleCode)
      if (cur) return [cur, ...latest]
    }
    return latest
  }, [scales, sectionCode, scaleCode])

  const filledParts = parts.filter(p => p.partName)
  const partCost = filledParts.reduce((s, p) => s + p.cost, 0)
  const externalCost = extItems.reduce((s, e) => s + e.cost, 0)
  const totalCost = partCost + externalCost

  function addPart() { setParts(p => [...p, emptyPart()]) }
  function removePart(i: number) { setParts(p => p.filter((_, idx) => idx !== i)) }
  function updatePart(i: number, field: keyof RepairPart, val: string | number) {
    setParts(prev => prev.map((p, idx) => {
      if (idx !== i) return p
      const updated = { ...p, [field]: val }
      if (field === 'partName') {
        const found = partsList.find(x => x.name === val)
        if (found) updated.unitPrice = found.standardPrice
      }
      updated.cost = (field === 'qty' ? Number(val) : updated.qty) * (field === 'unitPrice' ? Number(val) : updated.unitPrice)
      return updated
    }))
  }

  function addExt() { setExt(e => [...e, { description: '', cost: 0 }]) }
  function removeExt(i: number) { setExt(e => e.filter((_, idx) => idx !== i)) }
  function updateExt(i: number, field: keyof ExtItem, val: string | number) {
    setExt(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: val } : e))
  }

  function resetForm() {
    setDate(today); setPmiiDocNo(''); setTechnician(''); setRepairType('self')
    setWorkType(WORK_TYPES[0]); setActionTaken('')
    setVendorCode(''); setParts([emptyPart(), emptyPart(), emptyPart(), emptyPart()]); setExt([{ description: '', cost: 0 }, { description: '', cost: 0 }])
    setDept(''); setSectionCode(''); setScaleCode(''); setErr('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!scaleCode) { setErr('กรุณาเลือกเครื่องชั่งก่อนบันทึกข้อมูล'); return }
    const payload = {
      date, scaleCode, sectionCode, pmiiDocNo, repairType,
      actionTaken, description: workType, technician,
      parts: filledParts,
      extItems: extItems.filter(e => e.description),
      vendorCode, partCost, externalCost, totalCost,
    }
    if (isEdit && defaultValues) updateRepair(defaultValues.repairId, payload)
    else createRepair(payload)
    router.push('/repairs')
  }

  const inputCls = 'w-full text-[12px] px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100'
  const labelCls = 'block text-[11px] font-medium text-gray-600 mb-1'
  const stepCls = 'inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-blue-600 text-[9px] font-bold mr-1'

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[15px] font-medium text-gray-900">{isEdit ? 'แก้ไขการซ่อม' : 'บันทึกการซ่อมใหม่'}</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">{isEdit ? defaultValues?.repairId : ''}</p>
        </div>
        <button type="button" onClick={resetForm} className="flex items-center gap-1.5 text-[12px] text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg bg-white">
          <i className="ti ti-refresh text-[14px]" /> รีเซ็ต
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 pb-24">
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><i className="ti ti-info-circle text-[13px]" /> ข้อมูลหลักของงานซ่อม</div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>วันที่แจ้งซ่อม *</label><input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} required /></div>
            <div><label className={labelCls}>เลขที่ใบแจ้ง PMII</label><input type="text" className={inputCls} value={pmiiDocNo} onChange={e => setPmiiDocNo(e.target.value)} placeholder="" /></div>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><i className="ti ti-filter text-[13px]" /> เลือกเครื่องชั่ง</div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className={labelCls}><span className={stepCls}>1</span>Department</label>
              <select className={inputCls} value={dept}
                onChange={e => { setDept(e.target.value); setSectionCode(''); setScaleCode('') }}>
                <option value="">— เลือกฝ่าย —</option>
                {depts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}><span className={stepCls}>2</span>Section</label>
              <select className={inputCls} value={sectionCode} disabled={!dept}
                onChange={e => { setSectionCode(e.target.value); setScaleCode('') }}>
                <option value="">— เลือกแผนก —</option>
                {sectionOptions.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}><span className={stepCls}>3</span>Scale *</label>
              <select className={inputCls} value={scaleCode} disabled={!sectionCode}
                onChange={e => setScaleCode(e.target.value)}>
                <option value="">{sectionCode ? '— เลือกเครื่องชั่ง —' : '— เลือกแผนกก่อน —'}</option>
                {scaleOptions.map(s => <option key={s.id} value={s.code}>{s.code} — {s.brand} {s.model}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>รายละเอียดอาการ / ปัญหา</label>
            <input type="text" className={inputCls} value={actionTaken} onChange={e => setActionTaken(e.target.value)} placeholder="เช่น หน้าจอไม่ติด, ค่าน้ำหนักไม่นิ่ง" />
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><i className="ti ti-writing text-[13px]" /> ประเภทการซ่อม</div>
          <div className="flex gap-2">
            {REPAIR_TYPES.map(rt => (
              <button key={rt.value} type="button" onClick={() => setRepairType(rt.value)}
                className={`flex items-center gap-2 px-3 py-2.5 border rounded-lg text-[12px] transition-all ${repairType === rt.value ? `${repairTypeColor[rt.value]} font-medium` : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'}`}>
                <i className={`ti ${rt.icon} text-[15px]`} />{rt.label}
              </button>
            ))}
          </div>
        </div>

        {(repairType === 'self' || repairType === 'both') && (
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><i className="ti ti-git-merge text-[13px]" /> รายการอะไหล่ที่ใช้</div>
            <table className="w-full text-[12px] mb-3">
              <thead><tr className="border-b border-gray-100">
                <th className="text-left py-2 pr-2 text-[10px] font-medium text-gray-400 uppercase w-2/5">ชื่ออะไหล่</th>
                <th className="text-left py-2 px-2 text-[10px] font-medium text-gray-400 uppercase w-1/6">จำนวน</th>
                <th className="text-left py-2 px-2 text-[10px] font-medium text-gray-400 uppercase w-1/5">ราคา/หน่วย (฿)</th>
                <th className="text-left py-2 px-2 text-[10px] font-medium text-gray-400 uppercase">ค่าอะไหล่รวม (฿)</th><th className="w-6"></th>
              </tr></thead>
              <tbody>
                {parts.map((p, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2 pr-2">
                      <select className="w-full text-[11px] px-2 py-1.5 border border-gray-200 rounded-md bg-white outline-none focus:border-blue-400"
                        value={p.partName} onChange={e => updatePart(i, 'partName', e.target.value)}>
                        <option value="">— ไม่มี / เลือก —</option>
                        {partsList.map(pt => <option key={pt.code} value={pt.name}>{pt.name} ({pt.code})</option>)}
                      </select>
                    </td>
                    <td className="py-2 px-2"><input type="number" min={1} value={p.qty || ''} onFocus={e => e.target.select()} onChange={e => updatePart(i, 'qty', Number(e.target.value))} className="w-full text-[11px] px-2 py-1.5 border border-gray-200 rounded-md outline-none focus:border-blue-400" /></td>
                    <td className="py-2 px-2"><input type="number" min={0} value={p.unitPrice || ''} onFocus={e => e.target.select()} onChange={e => updatePart(i, 'unitPrice', Number(e.target.value))} className="w-full text-[11px] px-2 py-1.5 border border-gray-200 rounded-md outline-none focus:border-blue-400" /></td>
                    <td className="py-2 px-2"><span className="inline-block bg-blue-50 text-blue-700 text-[11px] font-medium px-2 py-0.5 rounded">฿{p.cost.toLocaleString()}</span></td>
                    <td className="py-2 pl-2"><button type="button" onClick={() => removePart(i)} className="text-gray-300 hover:text-red-400">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" onClick={addPart} className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"><i className="ti ti-plus text-[12px]" /> เพิ่มรายการอะไหล่</button>

            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
              <div>
                <label className={labelCls}>ประเภทงานซ่อม</label>
                <select className={inputCls} value={workType} onChange={e => setWorkType(e.target.value)}>
                  {WORK_TYPES.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>ช่างซ่อม / ผู้รับผิดชอบ</label>
                <input type="text" className={inputCls} value={technician} onChange={e => setTechnician(e.target.value)} placeholder="" />
              </div>
            </div>
          </div>
        )}

        {(repairType === 'ext' || repairType === 'both') && (
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><i className="ti ti-truck text-[13px]" /> รายการส่งซ่อมภายนอก (ระบุรายละเอียดและค่าใช้จ่าย)</div>
            <table className="w-full text-[12px] mb-3 border border-gray-200 rounded-lg overflow-hidden">
              <thead><tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-2 px-3 text-[10px] font-medium text-gray-500 uppercase">รายละเอียด / รายการที่ส่งซ่อม</th>
                <th className="text-left py-2 px-3 text-[10px] font-medium text-gray-500 uppercase w-36">ค่าใช้จ่าย (฿)</th><th className="w-8 bg-gray-50"></th>
              </tr></thead>
              <tbody>
                {extItems.map((e, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 px-3"><input type="text" value={e.description} onChange={ev => updateExt(i, 'description', ev.target.value)} placeholder="" className="w-full text-[11px] px-2 py-1.5 border border-gray-200 rounded-md bg-white outline-none focus:border-blue-400" /></td>
                    <td className="py-2 px-3"><input type="number" min={0} value={e.cost || ''} onFocus={ev => ev.target.select()} onChange={ev => updateExt(i, 'cost', Number(ev.target.value))} className="w-full text-[11px] px-2 py-1.5 border border-gray-200 rounded-md bg-white outline-none focus:border-blue-400" /></td>
                    <td className="py-2 pr-3 text-center"><button type="button" onClick={() => removeExt(i)} className="text-gray-300 hover:text-red-400">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" onClick={addExt} className="w-full text-[11.5px] text-blue-600 border border-dashed border-blue-200 bg-blue-50/50 rounded-lg py-2 flex items-center justify-center gap-1.5 hover:bg-blue-50">
              <i className="ti ti-plus text-[13px]" /> เพิ่มรายการส่งซ่อม
            </button>

            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
              <div>
                <label className={labelCls}>Vendor / บริษัทที่ส่งซ่อม</label>
                <select className={inputCls} value={vendorCode} onChange={e => setVendorCode(e.target.value)}>
                  <option value="">— เลือก Vendor —</option>
                  {vendors.map(v => <option key={v.code} value={v.code}>{v.name} ({v.abbr})</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>ผู้ประสานงาน / ผู้รับผิดชอบ</label>
                <input type="text" className={inputCls} value={technician} onChange={e => setTechnician(e.target.value)} placeholder="" />
              </div>
            </div>
          </div>
        )}

        {err && <div className="bg-red-50 border border-red-200 text-red-700 text-[12px] px-4 py-3 rounded-lg">{err}</div>}

        <div className="fixed bottom-0 left-[250px] right-0 bg-white border-t border-gray-200 px-6 py-3 z-10">
          <div className="rounded-xl px-5 py-3 mb-3 flex items-center justify-between" style={{ background: 'linear-gradient(90deg,#0a1f4e,#0E2B5E)' }}>
            <div>
              <div className="text-[10px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,.45)' }}>ค่าอะไหล่รวม</div>
              <div className="text-[16px] font-semibold text-white">฿{fmtN(partCost)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,.45)' }}>ค่าส่งซ่อมภายนอก</div>
              <div className="text-[16px] font-semibold text-white">฿{fmtN(externalCost)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide flex items-center gap-1" style={{ color: 'rgba(255,255,255,.45)' }}><i className="ti ti-coin text-[12px]" /> ต้นทุนรวมทั้งหมด</div>
              <div className="text-[20px] font-bold text-blue-400">฿{fmtN(totalCost)}</div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={resetForm} className="flex items-center gap-1.5 text-[12px] px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 bg-white"><i className="ti ti-refresh text-[13px]" /> รีเซ็ต</button>
            <button type="submit" className="flex items-center gap-1.5 text-[12px] px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"><i className="ti ti-check text-[13px]" /> บันทึกข้อมูล</button>
          </div>
        </div>
      </form>
    </div>
  )
}

function fmtN(n: number) { return Number(n || 0).toLocaleString('th-TH') }
