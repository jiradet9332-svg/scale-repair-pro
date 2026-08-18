'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createCalibration, getScales, getSections, getCalibrationsByAsset, getWeightSets } from '@/lib/store'
import { cpAddMonths, cpDaysUntil, fmtDate, wsLabel } from '@/lib/utils'
import type { CalUncertaintyComponent, WeightSet } from '@/lib/mockData'

// ─── types ──────────────────────────────────────────────────────────────────
type UnitState = 'ok' | 'due' | 'over' | 'prog'
interface Unit { id: string; model: string; loc: string; cap: number; state: UnitState; when: string; weightSetId: string; intervalMonths: number }

const STATE_LABEL: Record<UnitState, string> = { ok: 'ผ่าน', due: 'ครบกำหนด', over: 'เกินกำหนด', prog: 'กำลังทำ' }
const STATE_DOT: Record<UnitState, string> = { ok: 'bg-emerald-500', due: 'bg-amber-500', over: 'bg-red-500', prog: 'bg-blue-500' }
const STATE_BADGE: Record<UnitState, string> = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  due: 'bg-amber-50 text-amber-700 border-amber-200',
  over: 'bg-red-50 text-red-700 border-red-200',
  prog: 'bg-blue-50 text-blue-700 border-blue-200',
}

const CAPS = [220, 420, 620, 1500, 3200, 6200]

// ─── worked-example calibration data (demo values) ─────────────────────────
const D = 0.5 // resolution (g)
const MPE = 1.0 // g

// ── ชุดลูกตุ้มน้ำหนักมาตรฐาน — เลือกได้ตามแผนก/เครื่องชั่งที่ต่างกัน ─────────
// (รายการชุดจริงมาจากทะเบียนชุดตุ้มน้ำหนัก /weightsets — ดู getWeightSets() ด้านล่าง)
interface WeightSpec { nom: number; cm: number; Uw: number }
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length
const sd = (a: number[]) => { const m = mean(a), n = a.length; if (n < 2) return 0; return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1)) }
const uRes = Math.sqrt(2 * Math.pow(D / 2 / Math.sqrt(3), 2))
const f = (x: number, n = 4) => Number(x).toFixed(n)
const f1 = (x: number) => Number(x).toFixed(1) // แสดงค่าน้ำหนักมาตรฐานทศนิยม 1 ตำแหน่ง เช่น 10.0

// ─── per-unit calibration working data ─────────────────────────────────────
interface UnitCalData {
  rep: Record<number, number[]>
  ecc: Record<number, number[]>
  weightSetId: string
  temp: number
  rh: number
  calDate: string
  technician: string
  intervalMonths: number
}

// สร้างเลขสุ่มแบบ deterministic จาก id เครื่อง เพื่อให้ค่าตั้งต้นของแต่ละเครื่องต่างกัน
// แต่ยังคงเดิมทุกครั้งที่กลับมาเลือกเครื่องเดียวกัน (ก่อนที่ผู้ใช้จะแก้ไขเอง)
function hashSeed(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function makeRng(seed: number) {
  let s = seed || 1
  return () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x7fffffff }
}

// สร้างคุณสมบัติ (เดโม) ของลูกตุ้มแต่ละจุดในชุดที่เลือก
// cm = ค่าแก้ไขมวลจริงจากค่าระบุ, Uw = ค่าความไม่แน่นอนของลูกตุ้ม (k=2)
function buildWeightSpecs(values: number[]): WeightSpec[] {
  return values.map(nom => {
    const rng = makeRng(hashSeed('wset-' + nom))
    const cmRatio = -0.003 - rng() * 0.006
    const uwRatio = 0.0006 + rng() * 0.0012
    return { nom, cm: Number((nom * cmRatio).toFixed(4)), Uw: Number((nom * uwRatio).toFixed(4)) }
  })
}

// เลือกจุดอ้างอิงสำหรับ Eccentricity — ใช้ค่าที่ใกล้ 1/3 ของตุ้มก้อนใหญ่สุดในชุด
function pickEccNom(specs: WeightSpec[]): number {
  if (specs.length === 0) return 0
  const maxNom = Math.max(...specs.map(s => s.nom))
  const target = maxNom / 3
  return specs.reduce((best, cur) => (Math.abs(cur.nom - target) < Math.abs(best.nom - target) ? cur : best)).nom
}

// สร้างรายชื่อเครื่องชั่งสำหรับหน้าบันทึกสอบเทียบ จากทะเบียนเครื่องชั่งจริง (Scale Register)
// รวมประวัติสอบเทียบจริงของแต่ละเครื่อง (ถ้ามี) เพื่อคำนวณสถานะครบกำหนด/เกินกำหนด/กำลังทำ
function buildCalRegistry(): Unit[] {
  const sectionName = new Map(getSections().map(s => [s.code, s.name]))
  return getScales()
    .filter(s => s.status === 'Active')
    .map(s => {
      const model = [s.brand, s.model].filter(Boolean).join(' ').trim() || (s.scaleType || 'เครื่องชั่ง')
      const loc = sectionName.get(s.sectionRef) ?? s.sectionRef ?? '—'
      // พิกัดสูงสุด: ใช้ค่าที่ผู้ใช้กรอกไว้ในทะเบียนเครื่องชั่งถ้ามี ไม่งั้นเดา (เดโม) ไปก่อน
      const cap = s.capacity || CAPS[hashSeed(s.code) % CAPS.length]
      const history = getCalibrationsByAsset(s.code) // เรียงล่าสุดก่อนแล้ว
      const draft = history.find(h => h.status === 'draft')
      const issued = history.find(h => h.status === 'issued')
      let state: UnitState, when: string
      if (draft) {
        state = 'prog'; when = 'กำลังทำ (มีร่างค้างอยู่)'
      } else if (!issued) {
        state = 'due'; when = 'ยังไม่เคยสอบเทียบ'
      } else {
        const days = cpDaysUntil(issued.nextDue)
        if (days < 0) { state = 'over'; when = `เกิน ${Math.abs(days)} วัน` }
        else if (days <= 30) { state = 'due'; when = `ภายใน ${days} วัน` }
        else { state = 'ok'; when = fmtDate(issued.nextDue) }
      }
      return { id: s.code, model, loc, cap, state, when, weightSetId: s.weightSetId || '', intervalMonths: s.intervalMonths || 12 }
    })
}

// ค่าเปล่าเริ่มต้นสำหรับเริ่มบันทึกรอบใหม่ — ทุกช่อง "ตรงเป๊ะ" กับค่าที่ควรจะเป็น
// (= ยังไม่ได้กรอกอะไร) ช่างจะพิมพ์เฉพาะจุดที่อ่านค่าได้ไม่ตรง/มีความคลาดเคลื่อนเท่านั้น
function blankUnitCal(weightSetId: string, values: number[]): UnitCalData {
  const specs = buildWeightSpecs(values)
  const rep: Record<number, number[]> = {}
  specs.forEach(w => { rep[w.nom] = Array(5).fill(w.nom) })
  const eccNom = pickEccNom(specs)
  const ecc: Record<number, number[]> = { [eccNom]: Array(5).fill(eccNom) }
  return {
    rep, ecc, weightSetId,
    temp: 20,
    rh: 50,
    calDate: new Date().toISOString().slice(0, 10),
    technician: '',
    intervalMonths: 12,
  }
}

export default function CalibrationClient() {
  // ── equipment register ──────────────────────────────────────────────────
  const [registry, setRegistry] = useState<Unit[]>(() => buildCalRegistry())

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | UnitState>('all')
  const [selId, setSelId] = useState('')
  // เลือกเครื่องแรกในทะเบียนโดยอัตโนมัติเมื่อโหลดข้อมูลเสร็จ (ถ้ายังไม่มีการเลือกเครื่องใด)
  useEffect(() => { if (!selId && registry.length) setSelId(registry[0].id) }, [registry, selId])

  const filtered = useMemo(() => registry.filter(u => {
    if (filter !== 'all' && u.state !== filter) return false
    const q = search.trim().toLowerCase()
    if (q && !(u.id.toLowerCase().includes(q) || u.model.toLowerCase().includes(q) || u.loc.toLowerCase().includes(q))) return false
    return true
  }), [registry, filter, search])

  const shown = filtered.slice(0, 120)
  const selUnit = useMemo(() => registry.find(u => u.id === selId) ?? { id: selId, model: '—', loc: '—', cap: 1500, state: 'due' as UnitState, when: '—', weightSetId: '', intervalMonths: 12 }, [registry, selId])

  const totalPlan = registry.length
  const doneCount = registry.filter(u => u.state === 'ok').length
  const dueCount = registry.filter(u => u.state === 'due').length
  const overCount = registry.filter(u => u.state === 'over').length

  // ── ชุดตุ้มน้ำหนักมาตรฐาน (จากทะเบียนชุดตุ้มน้ำหนัก /weightsets) ─────────
  const [weightSets, setWeightSets] = useState<WeightSet[]>(() => getWeightSets())
  const defaultSetId = weightSets[0]?.id ?? ''

  // ── ข้อมูลการสอบเทียบแยกตามเครื่อง (แต่ละเครื่องไม่ใช้ค่าร่วมกัน) ─────────
  // เครื่องที่ยังไม่เคยกรอก จะเริ่มจากค่าเปล่าเสมอ (ไม่มีตัวเลขค้าง/สุ่มขึ้นมาล่วงหน้า)
  // ค่าตั้งต้น (ชุดตุ้ม/ความถี่สอบเทียบ) จะดึงจากที่กำหนดไว้ในทะเบียนเครื่องชั่งของเครื่องนั้นๆ ถ้ามี
  function defaultUnitCal(unitId: string): UnitCalData {
    const u = registry.find(r => r.id === unitId)
    const validAssigned = u?.weightSetId && weightSets.some(w => w.id === u.weightSetId) ? u.weightSetId : ''
    const setId = validAssigned || defaultSetId
    const values = weightSets.find(w => w.id === setId)?.values ?? []
    const blank = blankUnitCal(setId, values)
    return { ...blank, intervalMonths: u?.intervalMonths || 12 }
  }

  const [unitData, setUnitData] = useState<Record<string, UnitCalData>>({})
  useEffect(() => {
    setUnitData(prev => (prev[selId] ? prev : { ...prev, [selId]: defaultUnitCal(selId) }))
  }, [selId]) // eslint-disable-line react-hooks/exhaustive-deps
  const current = unitData[selId] ?? defaultUnitCal(selId)

  function patchCurrent(patch: Partial<UnitCalData>) {
    setUnitData(prev => ({ ...prev, [selId]: { ...(prev[selId] ?? defaultUnitCal(selId)), ...patch } }))
  }

  const { rep, ecc, weightSetId, temp, rh, calDate, technician, intervalMonths } = current
  const currentSet = useMemo(() => weightSets.find(w => w.id === weightSetId) ?? weightSets[0], [weightSets, weightSetId])
  const specs = useMemo(() => buildWeightSpecs(currentSet?.values ?? []), [currentSet])
  const maxNom = useMemo(() => Math.max(...specs.map(s => s.nom)), [specs])
  const eccNom = useMemo(() => pickEccNom(specs), [specs])
  const setTemp = (v: number) => patchCurrent({ temp: v })
  const setRh = (v: number) => patchCurrent({ rh: v })
  const setCalDate = (v: string) => patchCurrent({ calDate: v })
  const setTechnician = (v: string) => patchCurrent({ technician: v })
  const setIntervalMonths = (v: number) => patchCurrent({ intervalMonths: v })
  // สลับชุดตุ้มน้ำหนัก — รีเซ็ตค่าที่กรอกไว้ให้ตรงกับจุดทดสอบชุดใหม่ (คงค่าอื่น เช่น ช่าง/อุณหภูมิ ไว้เหมือนเดิม)
  function setWeightSet(id: string) {
    const ws = weightSets.find(w => w.id === id)
    if (!ws) return
    const blank = blankUnitCal(id, ws.values)
    patchCurrent({ weightSetId: id, rep: blank.rep, ecc: blank.ecc })
  }

  const [saveMsg, setSaveMsg] = useState('')
  const [saveError, setSaveError] = useState('')
  // เก็บข้อความดิบของช่องที่กำลังพิมพ์อยู่ ไว้แสดงระหว่างพิมพ์ (เช่น "199.")
  // เพื่อไม่ให้ค่าที่แปลงเป็นตัวเลขแล้ว (ตัดจุดทศนิยมท้ายออก) ไปรบกวนการพิมพ์
  const [editingCell, setEditingCell] = useState<{ kind: 'rep' | 'ecc'; nom: number; idx: number; text: string } | null>(null)
  const nextDue = useMemo(() => cpAddMonths(calDate, intervalMonths), [calDate, intervalMonths])

  // เคลียร์ข้อความแจ้งเตือนเมื่อสลับเครื่องชั่ง
  useEffect(() => { setSaveMsg(''); setSaveError('') }, [selId])

  // ช่องที่เว้นว่างไว้ (ไม่พิมพ์อะไร) = อ่านค่าได้ตรงกับค่าที่ควรจะเป็นพอดี (ไม่มีคลาดเคลื่อน)
  // ช่างจึงพิมพ์เฉพาะจุดที่อ่านค่าได้ไม่ตรง เช่น 49.5 หรือ 50.5 เท่านั้น
  function updateRep(nom: number, idx: number, val: string) {
    const next = { ...rep, [nom]: [...rep[nom]] }
    const n = parseFloat(val)
    next[nom][idx] = val.trim() === '' || Number.isNaN(n) ? nom : n
    patchCurrent({ rep: next })
  }
  function updateEcc(idx: number, val: string) {
    const next = { ...ecc, [eccNom]: [...(ecc[eccNom] ?? Array(5).fill(eccNom))] }
    const n = parseFloat(val)
    next[eccNom][idx] = val.trim() === '' || Number.isNaN(n) ? eccNom : n
    patchCurrent({ ecc: next })
  }

  // ── derived calculations ─────────────────────────────────────────────────
  const repRows = useMemo(() => specs.map(w => {
    const r = rep[w.nom] ?? Array(5).fill(w.nom); const m = mean(r), s = sd(r), uA = s / Math.sqrt(r.length)
    return { ...w, r, m, s, uA }
  }), [rep, specs])
  const uA_max = Math.max(...repRows.map(r => r.uA))
  const uA_atMax = repRows.find(r => r.nom === maxNom)?.uA ?? 0

  const eccRow = useMemo(() => {
    const r = ecc[eccNom] ?? Array(5).fill(eccNom); const ref = r[0]
    const devs = r.map(v => Math.abs(v - ref)); const maxd = Math.max(...devs)
    const u = maxd / Math.sqrt(3)
    return { r, ref, devs, maxd, u, nom: eccNom }
  }, [ecc, eccNom])

  const linRows = useMemo(() => specs.map(w => {
    const realMass = w.nom + w.cm / 1000
    const reading = mean(rep[w.nom] ?? Array(5).fill(w.nom))
    const E = reading - realMass
    const uW = (w.Uw / 2) / 1000
    return { ...w, realMass, reading, E, uW }
  }), [rep, specs])
  const Eabs_max = Math.max(...linRows.map(r => Math.abs(r.E)))
  const uW_atMax = linRows.find(r => r.nom === maxNom)?.uW ?? 0

  const budget = useMemo(() => [
    { name: 'Repeatability (จุดพิกัดสูงสุด)', type: 'A', dist: 'normal', val: uA_atMax * Math.sqrt(5), div: '√5', u: uA_atMax },
    { name: 'Eccentricity', type: 'B', dist: 'rectangular', val: eccRow.u * Math.sqrt(3), div: '√3', u: eccRow.u },
    { name: 'Resolution (ศูนย์ + โหลด)', type: 'B', dist: 'rectangular', val: D, div: '√2·2√3', u: uRes },
    { name: `มวลตุ้มมาตรฐาน (${maxNom} g)`, type: 'B', dist: 'normal', val: uW_atMax * 2, div: 'k=2', u: uW_atMax },
  ], [uA_atMax, eccRow.u, uW_atMax, maxNom])

  const sumSq = budget.reduce((s, c) => s + c.u * c.u, 0)
  const uc = Math.sqrt(sumSq)
  const Uexp = 2 * uc
  const worst = Eabs_max + Uexp
  const pass = worst < MPE

  function handleSave(status: 'draft' | 'issued') {
    setSaveMsg('')
    if (!technician.trim()) { setSaveError('กรุณากรอกชื่อช่างผู้ทำสอบเทียบก่อนบันทึก'); return }
    setSaveError('')
    const rec = createCalibration({
      assetId: selUnit.id, model: selUnit.model, location: selUnit.loc,
      date: calDate, tempC: temp, rh, maxCap: selUnit.cap, resolution: D, mpe: MPE,
      uA: uA_atMax, uEcc: eccRow.u, uRes, uWeight: uW_atMax,
      uc, k: 2, uExpanded: Uexp, errorMax: Eabs_max, worst, pass,
      components: budget as CalUncertaintyComponent[],
      repeatability: repRows.map(r => ({ nom: r.nom, readings: [...r.r], mean: r.m, sd: r.s, uA: r.uA })),
      eccentricity: { nom: eccNom, readings: [...eccRow.r], ref: eccRow.ref, maxDev: eccRow.maxd, u: eccRow.u },
      linearity: linRows.map(r => ({ nom: r.nom, realMass: r.realMass, reading: r.reading, error: r.E, uWeight: r.uW })),
      technician, intervalMonths, nextDue,
      status,
    })
    setSaveMsg(`บันทึก ${status === 'issued' ? 'ใบรับรอง' : 'ร่าง'} "${rec.certNo}" เรียบร้อย — กำหนดครั้งถัดไป ${fmtDate(rec.nextDue)}`)
    // ล้างหน้าบันทึกกลับเป็นค่าเปล่า พร้อมสำหรับสอบเทียบรอบถัดไป (เครื่องเดิมหรือเครื่องอื่น) — คงชุดตุ้มน้ำหนักเดิมไว้
    setUnitData(prev => ({ ...prev, [selId]: blankUnitCal(weightSetId, currentSet?.values ?? []) }))
    // รีเฟรชสถานะในทะเบียนซ้าย ให้ badge ครบกำหนด/เกินกำหนด/กำลังทำ อัปเดตตามข้อมูลที่เพิ่งบันทึก
    setRegistry(buildCalRegistry())
  }

  // ── style tokens (matches rest of app) ──────────────────────────────────
  const card = 'bg-white border border-gray-100 rounded-xl'
  const sectionHead = 'text-[11px] font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1.5'
  const th = 'text-right px-2.5 py-2 text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap'
  const thL = 'text-left px-2.5 py-2 text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap'
  const td = 'px-2.5 py-1.5 text-right text-gray-700 whitespace-nowrap'
  const tdL = 'px-2.5 py-1.5 text-left text-gray-700 whitespace-nowrap'
  const cellInput = 'w-[62px] text-[11.5px] px-1.5 py-1 border border-gray-200 rounded-md text-right outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100'

  return (
    <div className="p-6">
      {/* header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900 flex items-center gap-2">
            <i className="ti ti-certificate text-blue-600 text-[17px]" /> บันทึกสอบเทียบเครื่องชั่ง
          </h1>
          <p className="text-[11px] text-gray-400 mt-0.5">อ้างอิง EURAMET cg-18 · OIML R76 · JCGM 100 (GUM)</p>
        </div>
        <div className="flex gap-2">
          {[
            { label: 'ในแผน', value: totalPlan, cls: 'text-gray-800' },
            { label: 'เสร็จแล้ว', value: doneCount, cls: 'text-emerald-600' },
            { label: 'ครบกำหนด', value: dueCount, cls: 'text-amber-600' },
            { label: 'เกินกำหนด', value: overCount, cls: 'text-red-600' },
          ].map(s => (
            <div key={s.label} className={`${card} px-3.5 py-2 text-right min-w-[76px]`}>
              <div className={`text-[15px] font-semibold font-mono ${s.cls}`}>{s.value || '—'}</div>
              <div className="text-[9.5px] text-gray-400 uppercase tracking-wide">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-4 items-start">
        {/* ── LEFT: equipment register ──────────────────────────────────── */}
        <div className={`${card} overflow-hidden flex flex-col`} style={{ maxHeight: 'calc(100vh - 160px)' }}>
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <i className="ti ti-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[13px]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา asset ID / รุ่น / สถานที่…"
                className="w-full text-[11.5px] pl-7 pr-2.5 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-blue-400 focus:bg-white" />
            </div>
          </div>
          <div className="flex gap-1 px-3 py-2 flex-wrap border-b border-gray-100">
            {[
              { v: 'all', l: 'ทั้งหมด' },
              { v: 'due', l: 'ครบกำหนด' },
              { v: 'prog', l: 'กำลังทำ' },
              { v: 'ok', l: 'ผ่าน' },
              { v: 'over', l: 'เกินกำหนด' },
            ].map(c => (
              <button key={c.v} onClick={() => setFilter(c.v as any)}
                className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${filter === c.v ? 'bg-blue-600 text-white border-blue-600 font-medium' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                {c.l}
              </button>
            ))}
          </div>
          <div className="px-3 py-1.5 flex items-center justify-between text-[10px] text-gray-400 uppercase tracking-wide border-b border-gray-100">
            <span>เครื่องชั่งในแผน</span><span>{shown.length}{filtered.length > 120 ? '+' : ''}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5">
            {shown.length === 0 && <div className="text-center text-[11px] text-gray-400 py-8">ไม่พบรายการ</div>}
            {shown.map(u => (
              <button key={u.id} onClick={() => setSelId(u.id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left mb-0.5 border transition-colors ${u.id === selId ? 'bg-blue-50 border-blue-200' : 'border-transparent hover:bg-gray-50'}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATE_DOT[u.state]}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11.5px] font-mono font-semibold text-gray-800">{u.id}</div>
                  <div className="text-[10px] text-gray-400 truncate">{u.model} · {u.loc}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[10.5px] font-mono text-gray-500">{u.cap} g</div>
                  <div className="text-[9.5px] text-gray-400">{u.when}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── RIGHT: calibration record ─────────────────────────────────── */}
        <div className="space-y-4 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10.5px] font-mono text-gray-400 uppercase tracking-wide">REGISTER / {selUnit.id}</div>
              <h2 className="text-[15px] font-semibold text-gray-900">{selUnit.model || 'เครื่องชั่ง'} · {selUnit.id}</h2>
              <div className="text-[10.5px] text-gray-400 mt-0.5">{selUnit.loc}</div>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[10.5px] font-medium border ${STATE_BADGE[selUnit.state]}`}>{STATE_LABEL[selUnit.state]}</span>
          </div>

          {/* environment */}
          <div className={`${card} grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-gray-100 overflow-hidden`}>
            {[
              { k: 'พิกัดสูงสุด (Max)', v: `${selUnit.cap}`, u: 'g', icon: 'ti-weight' },
              { k: 'Resolution (d)', v: f(D, 1), u: 'g', icon: 'ti-ruler-2' },
              { k: 'MPE', v: f(MPE, 1), u: 'g', icon: 'ti-target-arrow' },
            ].map(c => (
              <div key={c.k} className="p-3">
                <div className="text-[9.5px] text-gray-400 uppercase tracking-wide flex items-center gap-1"><i className={`ti ${c.icon} text-[11px]`} />{c.k}</div>
                <div className="text-[14px] font-mono font-semibold text-gray-800 mt-0.5">{c.v} <span className="text-[10px] text-gray-400 font-sans">{c.u}</span></div>
              </div>
            ))}
            <div className="p-3">
              <div className="text-[9.5px] text-gray-400 uppercase tracking-wide flex items-center gap-1"><i className="ti ti-temperature text-[11px]" />อุณหภูมิ</div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <input type="number" step="0.1" value={temp} onFocus={e => e.target.select()} onChange={e => setTemp(Number(e.target.value))}
                  className="w-14 text-[14px] font-mono font-semibold text-gray-800 border-b border-dashed border-gray-300 outline-none focus:border-blue-400" />
                <span className="text-[10px] text-gray-400">°C</span>
              </div>
            </div>
            <div className="p-3">
              <div className="text-[9.5px] text-gray-400 uppercase tracking-wide flex items-center gap-1"><i className="ti ti-droplet text-[11px]" />ความชื้นสัมพัทธ์</div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <input type="number" step="1" value={rh} onFocus={e => e.target.select()} onChange={e => setRh(Number(e.target.value))}
                  className="w-14 text-[14px] font-mono font-semibold text-gray-800 border-b border-dashed border-gray-300 outline-none focus:border-blue-400" />
                <span className="text-[10px] text-gray-400">%RH</span>
              </div>
            </div>
            <div className="p-3">
              <div className="text-[9.5px] text-gray-400 uppercase tracking-wide flex items-center gap-1"><i className="ti ti-calendar text-[11px]" />วันที่สอบเทียบ</div>
              <input type="date" value={calDate} onChange={e => setCalDate(e.target.value)}
                className="text-[13px] font-medium text-gray-800 mt-0.5 border-b border-dashed border-gray-300 outline-none focus:border-blue-400 bg-transparent" />
            </div>
          </div>

          {/* next due appointment */}
          <div className={`${card} p-4 flex items-center gap-4 flex-wrap`}>
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wider">
              <i className="ti ti-calendar-repeat text-[13px]" /> กำหนดครั้งถัดไป
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] text-gray-500">ช่างผู้ทำสอบเทียบ <span className="text-red-500">*</span></label>
              <input type="text" value={technician} onChange={e => setTechnician(e.target.value)} placeholder="ชื่อ-สกุล"
                className={`text-[12px] px-2.5 py-1.5 border rounded-lg w-40 outline-none focus:border-blue-400 ${saveError ? 'border-red-300 bg-red-50/40' : 'border-gray-200'}`} />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] text-gray-500">ความถี่สอบเทียบ</label>
              <select value={intervalMonths} onChange={e => setIntervalMonths(Number(e.target.value))}
                className="text-[12px] px-2.5 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-blue-400">
                {[3, 6, 12, 24].map(m => <option key={m} value={m}>ทุก {m} เดือน</option>)}
              </select>
            </div>
            <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-100">
              <i className="ti ti-bell text-[13px] text-blue-500" />
              <span className="text-[11.5px] text-blue-700">นัดสอบเทียบครั้งถัดไป: <b className="font-mono">{fmtDate(nextDue)}</b></span>
            </div>
          </div>

          {/* select weight set */}
          <div className={`${card} p-4 flex items-center gap-3 flex-wrap`}>
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wider">
              <i className="ti ti-stack-2 text-[13px]" /> ชุดตุ้มน้ำหนักมาตรฐาน
            </div>
            <select value={weightSetId} onChange={e => setWeightSet(e.target.value)}
              className="text-[12.5px] font-mono px-3 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-blue-400 bg-white min-w-[260px]">
              {weightSets.map(s => <option key={s.id} value={s.id}>{wsLabel(s)}</option>)}
            </select>
            <span className="text-[10.5px] text-gray-400">เลือกชุดตุ้มตามที่แผนกใช้จริง — สลับชุดจะรีเซ็ตค่าที่กรอกไว้ของเครื่องนี้</span>
            <Link href="/weightsets" className="ml-auto flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 font-medium">
              <i className="ti ti-settings text-[13px]" /> จัดการชุดตุ้มน้ำหนัก
            </Link>
          </div>

          {/* 01 repeatability */}
          <div className={card}>
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 flex-wrap">
              <span className="text-[10.5px] font-mono text-blue-600 border border-blue-200 rounded-md px-1.5 py-0.5">01</span>
              <h3 className={sectionHead}><i className="ti ti-repeat text-[13px]" />Repeatability</h3>
              <span className="text-[11px] text-gray-400">วางจุดกึ่งกลางเดิม ทำซ้ำ — คำนวณ Type A</span>
              <span className="ml-auto px-2.5 py-1 rounded-full text-[10.5px] font-mono font-medium bg-blue-50 text-blue-700">u<sub>A</sub> = {f(uA_max)} g</span>
            </div>
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-[12px] font-mono">
                <thead><tr className="border-b border-gray-100">
                  <th className={thL}>น้ำหนักทดสอบ</th>
                  {[1, 2, 3, 4, 5].map(n => <th key={n} className={th}>#{n}</th>)}
                  <th className={th}>ค่าเฉลี่ย</th><th className={th}>s</th><th className={th}>u<sub>A</sub>=s/√n</th>
                </tr></thead>
                <tbody>
                  {repRows.map(row => (
                    <tr key={row.nom} className="border-b border-gray-50 last:border-0">
                      <td className={tdL}>{f1(row.nom)} g</td>
                      {row.r.map((v, i) => (
                        <td key={i} className="px-1 py-1.5 text-right">
                          <input
                            value={editingCell && editingCell.kind === 'rep' && editingCell.nom === row.nom && editingCell.idx === i ? editingCell.text : (v === row.nom ? '' : v)}
                            placeholder={f1(row.nom)}
                            onFocus={e => { e.target.select(); setEditingCell({ kind: 'rep', nom: row.nom, idx: i, text: v === row.nom ? '' : String(v) }) }}
                            onBlur={() => setEditingCell(null)}
                            onChange={e => { setEditingCell({ kind: 'rep', nom: row.nom, idx: i, text: e.target.value }); updateRep(row.nom, i, e.target.value) }}
                            className={cellInput}
                          />
                        </td>
                      ))}
                      <td className={`${td} text-gray-400`}>{f(row.m, 1)}</td>
                      <td className={`${td} text-gray-400`}>{f(row.s, 1)}</td>
                      <td className={`${td} text-blue-600 font-medium`}>{f(row.uA, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 02 eccentricity */}
          <div className={card}>
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 flex-wrap">
              <span className="text-[10.5px] font-mono text-blue-600 border border-blue-200 rounded-md px-1.5 py-0.5">02</span>
              <h3 className={sectionHead}><i className="ti ti-focus-2 text-[13px]" />Eccentricity</h3>
              <span className="text-[11px] text-gray-400">วางต่างตำแหน่ง — คำนวณ Type B จากค่าเบี่ยงเบนสูงสุด</span>
              <span className="ml-auto px-2.5 py-1 rounded-full text-[10.5px] font-mono font-medium bg-blue-50 text-blue-700">u<sub>ecc</sub> = {f(eccRow.u)} g</span>
            </div>
            <div className="p-4">
              <div className="flex gap-5 items-center flex-wrap mb-4">
                <div className="w-[130px] h-[130px] border border-gray-200 rounded-2xl relative bg-gray-50 flex-shrink-0">
                  <div className="absolute w-7 h-7 rounded-lg border border-blue-300 text-blue-600 bg-white grid place-items-center text-[11px] font-mono" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>1</div>
                  <div className="absolute w-7 h-7 rounded-lg border border-gray-200 text-gray-500 bg-white grid place-items-center text-[11px] font-mono" style={{ top: 10, left: 10 }}>2</div>
                  <div className="absolute w-7 h-7 rounded-lg border border-gray-200 text-gray-500 bg-white grid place-items-center text-[11px] font-mono" style={{ top: 10, right: 10 }}>3</div>
                  <div className="absolute w-7 h-7 rounded-lg border border-gray-200 text-gray-500 bg-white grid place-items-center text-[11px] font-mono" style={{ bottom: 10, left: 10 }}>4</div>
                  <div className="absolute w-7 h-7 rounded-lg border border-gray-200 text-gray-500 bg-white grid place-items-center text-[11px] font-mono" style={{ bottom: 10, right: 10 }}>5</div>
                </div>
                <p className="text-[11.5px] text-gray-500 max-w-[340px] leading-relaxed">
                  ใช้ตุ้ม ≈ <b className="text-gray-800">1/3 ของพิกัด</b> (≈{eccRow.nom} g) วางตำแหน่งกึ่งกลาง (1) ก่อนเป็นค่าอ้างอิง แล้ววางมุมทั้งสี่ (2–5)
                  ค่าที่ใช้คือ <b className="text-gray-800">ค่าเบี่ยงเบนสูงสุด</b> จากตำแหน่งกึ่งกลาง หารด้วย √3
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px] font-mono">
                  <thead><tr className="border-b border-gray-100">
                    <th className={thL}>ตำแหน่ง</th><th className={th}>1 (กลาง)</th><th className={th}>2</th><th className={th}>3</th><th className={th}>4</th><th className={th}>5</th>
                    <th className={th}>เบี่ยงเบนสูงสุด</th><th className={th}>u<sub>ecc</sub>=max/√3</th>
                  </tr></thead>
                  <tbody>
                    <tr>
                      <td className={tdL}>{eccRow.nom} g</td>
                      {eccRow.r.map((v, i) => (
                        <td key={i} className="px-1 py-1.5 text-right"><input value={v === eccRow.nom ? '' : v} placeholder={String(eccRow.nom)} onFocus={e => e.target.select()} onChange={e => updateEcc(i, e.target.value)} className={cellInput} /></td>
                      ))}
                      <td className={`${td} text-gray-400`}>{f(eccRow.maxd, 3)}</td>
                      <td className={`${td} text-blue-600 font-medium`}>{f(eccRow.u, 4)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 03 linearity */}
          <div className={card}>
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 flex-wrap">
              <span className="text-[10.5px] font-mono text-blue-600 border border-blue-200 rounded-md px-1.5 py-0.5">03</span>
              <h3 className={sectionHead}><i className="ti ti-chart-dots text-[13px]" />Indication Error &amp; Linearity</h3>
              <span className="text-[11px] text-gray-400">ค่าอ่าน − มวลจริงของตุ้ม (conventional mass)</span>
              <span className="ml-auto px-2.5 py-1 rounded-full text-[10.5px] font-mono font-medium bg-blue-50 text-blue-700">|E|<sub>max</sub> = {f(Eabs_max)} g</span>
            </div>
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-[12px] font-mono">
                <thead><tr className="border-b border-gray-100">
                  <th className={thL}>น้ำหนักระบุ</th><th className={th}>มวลจริง (g)</th><th className={th}>U ตุ้ม (mg, k2)</th>
                  <th className={th}>ค่าอ่าน</th><th className={th}>Error E</th><th className={th}>u<sub>weight</sub></th><th className={th}>u<sub>res</sub></th>
                </tr></thead>
                <tbody>
                  {linRows.map(row => (
                    <tr key={row.nom} className="border-b border-gray-50 last:border-0">
                      <td className={tdL}>{row.nom} g</td>
                      <td className={`${td} text-gray-400`}>{f(row.realMass, 4)}</td>
                      <td className={`${td} text-gray-400`}>{f(row.Uw, 3)}</td>
                      <td className={td}>{f(row.reading, 3)}</td>
                      <td className={`${td} ${Math.abs(row.E) > 0.001 ? 'text-blue-600' : 'text-gray-400'}`}>{row.E >= 0 ? '+' : ''}{f(row.E, 4)}</td>
                      <td className={`${td} text-gray-400`}>{f(row.uW, 5)}</td>
                      <td className={`${td} text-gray-400`}>{f(uRes, 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* uncertainty budget */}
          <div className={`${card}`} style={{ background: 'linear-gradient(180deg,#fafbff,#ffffff)' }}>
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 flex-wrap">
              <span className="text-[10.5px] font-mono text-blue-600 border border-blue-200 rounded-md px-1.5 py-0.5">Σ</span>
              <h3 className={sectionHead}><i className="ti ti-calculator text-[13px]" />Uncertainty Budget</h3>
              <span className="text-[11px] text-gray-400">รวมที่จุดวิกฤต (พิกัดสูงสุด)</span>
            </div>
            <div className="p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-[12px] font-mono mb-4">
                  <thead><tr className="border-b border-gray-100">
                    <th className={thL}>องค์ประกอบ</th><th className={th}>ชนิด</th><th className={th}>การกระจาย</th><th className={th}>ค่า (g)</th><th className={th}>ตัวหาร</th><th className={th}>u<sub>i</sub> (g)</th>
                  </tr></thead>
                  <tbody>
                    {budget.map(c => (
                      <tr key={c.name} className="border-b border-gray-50 last:border-0">
                        <td className={`${tdL} font-sans`}>{c.name}</td>
                        <td className={`${td} text-gray-400`}>{c.type}</td>
                        <td className={`${td} text-gray-400`}>{c.dist}</td>
                        <td className={`${td} text-gray-400`}>{f(c.val, 4)}</td>
                        <td className={`${td} text-gray-400`}>{c.div}</td>
                        <td className={`${td} text-blue-600 font-medium`}>{f(c.u, 4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                <div className="bg-white p-3.5">
                  <div className="text-[9.5px] text-gray-400 uppercase tracking-wide">u_c รวม</div>
                  <div className="text-[19px] font-mono font-semibold text-gray-800 mt-1">{f(uc)} <span className="text-[11px] text-gray-400 font-sans">g</span></div>
                </div>
                <div className="bg-white p-3.5">
                  <div className="text-[9.5px] text-gray-400 uppercase tracking-wide">k</div>
                  <div className="text-[19px] font-mono font-semibold text-gray-800 mt-1">2.00</div>
                </div>
                <div className="bg-white p-3.5">
                  <div className="text-[9.5px] text-gray-400 uppercase tracking-wide">U ขยาย (95%)</div>
                  <div className="text-[19px] font-mono font-semibold text-blue-600 mt-1">{f(Uexp)} <span className="text-[11px] text-gray-400 font-sans">g</span></div>
                </div>
                <div className="bg-white p-3.5">
                  <div className="text-[9.5px] text-gray-400 uppercase tracking-wide">ผลตัดสิน vs MPE</div>
                  <div className={`text-[19px] font-mono font-semibold mt-1 ${pass ? 'text-emerald-600' : 'text-red-600'}`}>{pass ? 'ผ่าน ✓' : 'ไม่ผ่าน ✕'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* actions */}
          {saveError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-[12px] px-4 py-2.5 rounded-lg">
              <i className="ti ti-alert-triangle text-[14px]" /> {saveError}
            </div>
          )}
          {saveMsg && (
            <div className="flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[12px] px-4 py-2.5 rounded-lg">
              <span className="flex items-center gap-1.5"><i className="ti ti-circle-check text-[14px]" /> {saveMsg}</span>
              <Link href="/calregistry" className="font-medium underline whitespace-nowrap">ดูทะเบียนการสอบเทียบ →</Link>
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => handleSave('issued')}
              className="flex items-center gap-1.5 text-[12.5px] font-medium px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <i className="ti ti-file-certificate text-[15px]" /> ออกใบรับรอง (บันทึกเข้าทะเบียน)
            </button>
            <button onClick={() => handleSave('draft')}
              className="flex items-center gap-1.5 text-[12.5px] px-4 py-2 border border-gray-200 rounded-lg text-gray-600 bg-white hover:bg-gray-50">
              <i className="ti ti-device-floppy text-[15px]" /> บันทึกร่าง
            </button>
            <Link href="/calregistry"
              className="flex items-center gap-1.5 text-[12.5px] px-4 py-2 border border-gray-200 rounded-lg text-gray-600 bg-white hover:bg-gray-50">
              <i className="ti ti-list-check text-[15px]" /> ดูทะเบียนการสอบเทียบ
            </Link>
          </div>

          <p className="text-[10.5px] text-gray-400 leading-relaxed pb-4">
            แนวทาง: <code className="text-gray-500">EURAMET cg-18</code> · <code className="text-gray-500">OIML R76</code> · <code className="text-gray-500">JCGM 100 (GUM)</code>.{' '}
            u<sub>res</sub> รวมการปัดเศษ 2 จุด (ศูนย์+โหลด): <code className="text-gray-500">u_res = √2 · (d/2)/√3</code>.{' '}
            ตัวเลขคำนวณสดเมื่อแก้ค่าในตาราง — เดโม UI เท่านั้น
          </p>
        </div>
      </div>
    </div>
  )
}
