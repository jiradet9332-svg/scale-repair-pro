// ─── IN-MEMORY STORE + LOCALSTORAGE PERSISTENCE ──────────────────────────────
// ข้อมูลอยู่ใน memory ระหว่างใช้งาน และ sync ลง localStorage ของเครื่องผู้ใช้
// ทุกครั้งที่มีการ create/update/delete จะ save อัตโนมัติ
// เมื่อพร้อมต่อ DB ให้แทนฟังก์ชันด้วย prisma queries แล้วลบส่วน persist ออก

import type {
  Scale, RepairJob, Part, User, Section,
  Vendor, Weight, CalPlan, RepairPart, ExtItem, CalibrationRecord,
} from './mockData'
import seedData from './seedData.json'

const LS_KEY = 'scale_repair_db_v2'
let _hydrated = false

// ─── DEFAULT CAL PLAN DATA (ใช้เมื่อไม่มีข้อมูลสอบเทียบมาพร้อม seed) ─────────
const FALLBACK_CALPLAN: CalPlan[] = [
  { id:'CP-S-001', group:'scale', department:'ฝ่ายผลิต Line 1', location:'ทำเส้น Line 1',  type:'สปริง 60 kg.',   qty:2,  intervalMonths:12, lastCal:'2026-05-01' },
  { id:'CP-S-002', group:'scale', department:'ฝ่ายผลิต Line 1', location:'อบเส้น Line 1',  type:'SUPER-3S',        qty:44, intervalMonths:12, lastCal:'2026-05-01' },
  { id:'CP-S-003', group:'scale', department:'ฝ่ายผลิต Line 1', location:'บรรจุ Line 1',   type:'Digital 10 kg.', qty:2,  intervalMonths:12, lastCal:'2026-05-01' },
  { id:'CP-S-004', group:'scale', department:'ฝ่ายผลิต Line 2', location:'ทำเส้น Line 2',  type:'สปริง 60 kg.',   qty:2,  intervalMonths:12, lastCal:'2026-06-01' },
  { id:'CP-S-005', group:'scale', department:'ฝ่ายผลิต Line 2', location:'อบเส้น Line 2',  type:'SUPER-3S',        qty:33, intervalMonths:12, lastCal:'2026-06-01' },
  { id:'CP-S-006', group:'scale', department:'ฝ่ายผลิต Line 3', location:'บรรจุเส้นสด L3', type:'SDS',             qty:135,intervalMonths:12, lastCal:'2026-08-01' },
  { id:'CP-S-007', group:'scale', department:'ฝ่ายผลิต Line 4', location:'ผลิต กต. L4',    type:'Digital 60 kg.', qty:4,  intervalMonths:12, lastCal:'2026-09-01' },
  { id:'CP-W-001', group:'weight',department:'ฝ่ายวิศวกรรม',    location:'ตุ้มน้ำหนัก (Standard)', type:'ตุ้มมาตรฐาน', qty:22, intervalMonths:12, lastCal:'2026-06-01' },
  { id:'CP-W-002', group:'weight',department:'ฝ่ายผลิต',        location:'แผนกบรรจุ Line 1', type:'ตุ้มน้ำหนัก',   qty:6,  intervalMonths:12, lastCal:'2026-04-01' },
  { id:'CP-W-003', group:'weight',department:'ฝ่ายผลิต',        location:'แผนกอบเส้น Line 4', type:'ตุ้มน้ำหนัก',  qty:7,  intervalMonths:12, lastCal:'2026-01-10' },
]
const DEFAULT_CALPLAN: CalPlan[] = (seedData as any).calplan?.length ? (seedData as any).calplan : FALLBACK_CALPLAN

// ─── STORE (ค่าเริ่มต้น = ข้อมูลจริงจาก seedData.json ที่นำเข้าไว้) ──────────
function freshSeed() {
  const sd = seedData as any
  return {
    sections:  (sd.sections  ?? []) as Section[],
    vendors:   (sd.vendors   ?? []) as Vendor[],
    scales:    (sd.scales    ?? []) as Scale[],
    repairs:   (sd.repairs   ?? []) as RepairJob[],
    parts:     (sd.parts     ?? []) as Part[],
    users:     (sd.users?.length ? sd.users : [
      { username: 'admin', password: '1234', fullname: 'ผู้ดูแลระบบ', role: 'admin' as const },
    ]) as User[],
    weights:   (sd.weights   ?? []) as Weight[],
    calplan:   DEFAULT_CALPLAN,
    calibrations: [] as CalibrationRecord[],
    _repairSeq: 0,
  }
}
let store = freshSeed()

// ─── PERSISTENCE (localStorage) ──────────────────────────────────────────────
function persist() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(store))
  } catch (e) {
    console.error('บันทึกข้อมูลลง localStorage ไม่สำเร็จ', e)
  }
}

/** เรียกครั้งเดียวตอนแอปเริ่มทำงานบน client เพื่อโหลดข้อมูลที่เคยบันทึกไว้ */
export function hydrate(): boolean {
  if (typeof window === 'undefined') return false
  if (_hydrated) return false
  _hydrated = true
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      store = {
        sections:   saved.sections   ?? [],
        vendors:    saved.vendors    ?? [],
        scales:     saved.scales     ?? [],
        repairs:    saved.repairs    ?? [],
        parts:      saved.parts      ?? [],
        users:      saved.users?.length ? saved.users : store.users,
        weights:    saved.weights    ?? [],
        calplan:    saved.calplan?.length ? saved.calplan : DEFAULT_CALPLAN,
        calibrations: saved.calibrations ?? [],
        _repairSeq: saved._repairSeq ?? 0,
      }
      return true
    }
  } catch (e) {
    console.error('โหลดข้อมูลจาก localStorage ไม่สำเร็จ', e)
  }
  return false
}

/** ลบข้อมูลทั้งหมดที่บันทึกไว้ในเครื่อง (ใช้สำหรับปุ่ม "ล้างข้อมูล") */
export function clearAllData() {
  store = {
    sections: [], vendors: [], scales: [], repairs: [], parts: [],
    users: [{ username: 'admin', password: '1234', fullname: 'ผู้ดูแลระบบ', role: 'admin' as const }],
    weights: [], calplan: DEFAULT_CALPLAN, calibrations: [], _repairSeq: 0,
  }
  persist()
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
export function buildScaleCode(sc: string, bc: string, uc: number, seq: number) {
  const s = sc.toUpperCase().slice(0, 4).padEnd(2, 'X')
  const b = bc.toUpperCase().slice(0, 4).padEnd(2, 'X')
  const u = String(Math.max(0, uc)).padStart(2, '0')
  const n = String(Math.max(1, seq)).padStart(3, '0')
  return `${s}-${b}-${u}-${n}`
}

export function parseScaleCode(code: string) {
  const parts = (code || '').split('-')
  if (parts.length < 4) return null
  const gen    = parseInt(parts[parts.length - 2], 10)
  const serial = parts[parts.length - 1]
  const prefix = parts.slice(0, parts.length - 2).join('-')
  return { prefix, gen, genStr: String(gen).padStart(2,'0'), serial }
}

export function genRepairId(): string {
  store._repairSeq++
  const year = new Date().getFullYear().toString().slice(-2)
  const existing = store.repairs.map(r => {
    const m = r.repairId.match(/^REP-\d{2}-(\d+)$/)
    return m ? parseInt(m[1], 10) : 0
  })
  const max = existing.length > 0 ? Math.max(...existing) : 0
  return `REP-${year}-${String(max + 1).padStart(4, '0')}`
}

// ─── SECTIONS ─────────────────────────────────────────────────────────────────
export function getSections()                   { return store.sections }
export function getSectionByCode(code: string)  { return store.sections.find(s => s.code === code) ?? null }
export function getUniqueDepts()                { return [...new Set(store.sections.map(s => s.dept).filter(Boolean))].sort() }

export function createSection(data: Section) {
  if (store.sections.find(s => s.code === data.code)) return null
  store.sections.push(data)
  persist()
  return data
}
export function updateSection(code: string, data: Partial<Section>) {
  const i = store.sections.findIndex(s => s.code === code)
  if (i < 0) return null
  store.sections[i] = { ...store.sections[i], ...data }
  persist()
  return store.sections[i]
}
export function deleteSection(code: string) {
  const i = store.sections.findIndex(s => s.code === code)
  if (i < 0) return false
  store.sections.splice(i, 1); persist(); return true
}

// ─── VENDORS ──────────────────────────────────────────────────────────────────
export function getVendors()                    { return store.vendors }
export function getVendorByCode(code: string)   { return store.vendors.find(v => v.code === code) ?? null }

export function createVendor(data: Vendor) {
  if (store.vendors.find(v => v.code === data.code)) return null
  store.vendors.push(data)
  persist()
  return data
}
export function updateVendor(code: string, data: Partial<Vendor>) {
  const i = store.vendors.findIndex(v => v.code === code)
  if (i < 0) return null
  store.vendors[i] = { ...store.vendors[i], ...data }
  persist()
  return store.vendors[i]
}
export function deleteVendor(code: string) {
  const i = store.vendors.findIndex(v => v.code === code)
  if (i < 0) return false
  store.vendors.splice(i, 1); persist(); return true
}

// ─── SCALES ───────────────────────────────────────────────────────────────────
export function getScales()                      { return store.scales }
export function getScaleByCode(code: string)     { return store.scales.find(s => s.code === code) ?? null }
export function getScaleById(id: number)         { return store.scales.find(s => s.id === id) ?? null }
export function getScaleFamily(code: string) {
  const p = parseScaleCode(code)
  if (!p) return []
  return store.scales
    .filter(s => { const q = parseScaleCode(s.code); return q && q.prefix === p.prefix && q.serial === p.serial })
    .sort((a, b) => (parseScaleCode(a.code)?.gen ?? 0) - (parseScaleCode(b.code)?.gen ?? 0))
}

// คืนเฉพาะเครื่องรุ่นล่าสุดของแต่ละ asset (ซ่อนรหัสรุ่นเก่าที่ถูกเปลี่ยนไปแล้ว)
// ใช้ในตัวเลือก Scale เวลาต้องการเลือก "เครื่องที่ใช้งานอยู่จริง" เท่านั้น
export function getLatestScales(scales: Scale[] = store.scales) {
  const map = new Map<string, Scale>()
  scales.forEach(s => {
    const p = parseScaleCode(s.code)
    const key = p ? `${p.prefix}::${p.serial}` : s.code
    const cur = map.get(key)
    if (!cur) { map.set(key, s); return }
    const curP = parseScaleCode(cur.code)
    if (p && curP && p.gen > curP.gen) map.set(key, s)
  })
  return [...map.values()]
}

export function createScale(data: Omit<Scale, 'id'>) {
  if (store.scales.find(s => s.code === data.code)) return null
  const id = store.scales.length > 0 ? Math.max(...store.scales.map(s => s.id)) + 1 : 1
  const s: Scale = { ...data, id }
  store.scales.push(s)
  persist()
  return s
}
export function updateScale(id: number, data: Partial<Omit<Scale, 'id'>>) {
  const i = store.scales.findIndex(s => s.id === id)
  if (i < 0) return null
  store.scales[i] = { ...store.scales[i], ...data }
  persist()
  return store.scales[i]
}
export function deleteScale(id: number) {
  const i = store.scales.findIndex(s => s.id === id)
  if (i < 0) return false
  store.scales.splice(i, 1); persist(); return true
}

// Replace Scale — Gen+1
export function replaceScale(oldCode: string, opts: {
  endOld: string; startNew: string; sn: string; model: string; price: number
}) {
  const old = store.scales.find(s => s.code === oldCode)
  if (!old) return null
  const p = parseScaleCode(oldCode)
  if (!p) return null
  const newCode = `${p.prefix}-${String(p.gen + 1).padStart(2,'0')}-${p.serial}`
  if (store.scales.find(s => s.code === newCode)) return null
  old.status = 'Inactive'
  old.endDate = opts.endOld
  const newId = store.scales.length > 0 ? Math.max(...store.scales.map(s => s.id)) + 1 : 1
  const newScale: Scale = {
    ...old, id: newId, code: newCode,
    serialNumber: opts.sn, model: opts.model,
    purchasePrice: opts.price, startDate: opts.startNew, endDate: '', status: 'Active',
    usageCount: p.gen + 1,
  }
  store.scales.push(newScale)
  persist()
  return newScale
}

// ─── REPAIRS ──────────────────────────────────────────────────────────────────
export function getRepairs()                       { return store.repairs }
export function getRepairById(id: string)          { return store.repairs.find(r => r.repairId === id) ?? null }
export function getRepairsByScale(code: string)    { return store.repairs.filter(r => r.scaleCode === code) }

export function createRepair(data: Omit<RepairJob, 'repairId'>) {
  const r: RepairJob = { ...data, repairId: genRepairId() }
  store.repairs.unshift(r)
  persist()
  return r
}
export function updateRepair(id: string, data: Partial<Omit<RepairJob, 'repairId'>>) {
  const i = store.repairs.findIndex(r => r.repairId === id)
  if (i < 0) return null
  store.repairs[i] = { ...store.repairs[i], ...data }
  persist()
  return store.repairs[i]
}
export function deleteRepair(id: string) {
  const i = store.repairs.findIndex(r => r.repairId === id)
  if (i < 0) return false
  store.repairs.splice(i, 1); persist(); return true
}

// ─── PARTS ────────────────────────────────────────────────────────────────────
export function getParts()                        { return store.parts }
export function getPartByCode(code: string)       { return store.parts.find(p => p.code === code) ?? null }

export function createPart(data: Part) {
  store.parts.push(data); persist(); return data
}
export function updatePart(code: string, data: Partial<Part>) {
  const i = store.parts.findIndex(p => p.code === code)
  if (i < 0) return null
  store.parts[i] = { ...store.parts[i], ...data }
  persist()
  return store.parts[i]
}
export function deletePart(code: string) {
  const i = store.parts.findIndex(p => p.code === code)
  if (i < 0) return false
  store.parts.splice(i, 1); persist(); return true
}

// ─── USERS ────────────────────────────────────────────────────────────────────
export function getUsers()                        { return store.users }
export function getUserByUsername(u: string)      { return store.users.find(x => x.username === u) ?? null }

export function createUser(data: User) {
  if (store.users.find(u => u.username === data.username)) return null
  store.users.push(data); persist(); return data
}
export function updateUser(username: string, data: Partial<User>) {
  const i = store.users.findIndex(u => u.username === username)
  if (i < 0) return null
  store.users[i] = { ...store.users[i], ...data }
  persist()
  return store.users[i]
}
export function deleteUser(username: string) {
  if (username === 'admin') return false
  const i = store.users.findIndex(u => u.username === username)
  if (i < 0) return false
  store.users.splice(i, 1); persist(); return true
}

// ─── WEIGHTS ──────────────────────────────────────────────────────────────────
export function getWeights()                      { return store.weights }
export function getWeightBySn(sn: string)         { return store.weights.find(w => w.sn === sn) ?? null }

export function createWeight(data: Weight) {
  if (store.weights.find(w => w.sn === data.sn)) return null
  store.weights.push(data); persist(); return data
}
export function updateWeight(sn: string, data: Partial<Weight>) {
  const i = store.weights.findIndex(w => w.sn === sn)
  if (i < 0) return null
  store.weights[i] = { ...store.weights[i], ...data }
  persist()
  return store.weights[i]
}
export function deleteWeight(sn: string) {
  const i = store.weights.findIndex(w => w.sn === sn)
  if (i < 0) return false
  store.weights.splice(i, 1); persist(); return true
}

// ─── CAL PLAN ─────────────────────────────────────────────────────────────────
export function getCalPlan()                      { return store.calplan }

export function addCalPlanItem(data: CalPlan) {
  store.calplan.push(data); persist(); return data
}
export function updateCalPlanItem(id: string, data: Partial<CalPlan>) {
  const i = store.calplan.findIndex(c => c.id === id)
  if (i < 0) return null
  store.calplan[i] = { ...store.calplan[i], ...data }
  persist()
  return store.calplan[i]
}
export function deleteCalPlanItem(id: string) {
  const i = store.calplan.findIndex(c => c.id === id)
  if (i < 0) return false
  store.calplan.splice(i, 1); persist(); return true
}
export function updateCalLastCal(id: string, date: string) {
  return updateCalPlanItem(id, { lastCal: date })
}

// ─── BALANCE CALIBRATION RECORDS (ทะเบียนการสอบเทียบเครื่องชั่ง) ────────────
export function genCalCertNo(): string {
  const year = new Date().getFullYear().toString().slice(-2)
  const existing = store.calibrations.map(c => {
    const m = c.certNo.match(/^CAL-\d{2}-(\d+)$/)
    return m ? parseInt(m[1], 10) : 0
  })
  const max = existing.length > 0 ? Math.max(...existing) : 0
  return `CAL-${year}-${String(max + 1).padStart(4, '0')}`
}

export function getCalibrations()                     { return store.calibrations }
export function getCalibrationByCertNo(certNo: string) { return store.calibrations.find(c => c.certNo === certNo) ?? null }
export function getCalibrationsByAsset(assetId: string) {
  return store.calibrations.filter(c => c.assetId === assetId).sort((a, b) => b.date.localeCompare(a.date))
}

export function createCalibration(data: Omit<CalibrationRecord, 'certNo'>) {
  const rec: CalibrationRecord = { ...data, certNo: genCalCertNo() }
  store.calibrations.unshift(rec)
  persist()
  return rec
}
export function updateCalibration(certNo: string, data: Partial<Omit<CalibrationRecord, 'certNo'>>) {
  const i = store.calibrations.findIndex(c => c.certNo === certNo)
  if (i < 0) return null
  store.calibrations[i] = { ...store.calibrations[i], ...data }
  persist()
  return store.calibrations[i]
}
export function deleteCalibration(certNo: string) {
  const i = store.calibrations.findIndex(c => c.certNo === certNo)
  if (i < 0) return false
  store.calibrations.splice(i, 1); persist(); return true
}

// ─── DASHBOARD STATS ──────────────────────────────────────────────────────────
export function getDashboardStats(yearFilter?: string, deptFilter?: string, sectionFilter?: string, scaleFilter?: string) {
  const filtered = store.repairs.filter(r => {
    const y = r.date?.slice(0, 4)
    if (yearFilter && yearFilter !== 'all' && y !== yearFilter) return false
    if (deptFilter) {
      const sec = store.sections.find(s => s.code === r.sectionCode)
      if (!sec || sec.dept !== deptFilter) return false
    }
    if (sectionFilter && r.sectionCode !== sectionFilter) return false
    if (scaleFilter && r.scaleCode !== scaleFilter) return false
    return true
  })

  const totalCost  = filtered.reduce((s, r) => s + r.totalCost, 0)
  const partCost   = filtered.reduce((s, r) => s + r.partCost, 0)
  const extCost    = filtered.reduce((s, r) => s + r.externalCost, 0)
  const active     = store.scales.filter(s => s.status === 'Active').length
  const inactive   = store.scales.filter(s => s.status === 'Inactive').length

  // Monthly data (12 months)
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0')
    const rows = filtered.filter(r => yearFilter && yearFilter !== 'all'
      ? r.date?.startsWith(`${yearFilter}-${m}`)
      : r.date?.slice(5, 7) === m
    )
    return {
      month: new Date(2000, i, 1).toLocaleDateString('th-TH', { month: 'short' }),
      totalCost: rows.reduce((s, r) => s + r.totalCost, 0),
      self: rows.filter(r => r.repairType === 'self').length,
      ext:  rows.filter(r => r.repairType === 'ext').length,
      both: rows.filter(r => r.repairType === 'both').length,
    }
  })

  // Dept breakdown
  const deptMap: Record<string, { cost: number; count: number }> = {}
  filtered.forEach(r => {
    const sec = store.sections.find(s => s.code === r.sectionCode)
    const dept = sec?.dept || 'อื่นๆ'
    if (!deptMap[dept]) deptMap[dept] = { cost: 0, count: 0 }
    deptMap[dept].cost  += r.totalCost
    deptMap[dept].count += 1
  })

  // Type breakdown
  const typeCount = { self: 0, ext: 0, both: 0 }
  filtered.forEach(r => { typeCount[r.repairType]++ })

  // Top scales
  const scaleMap: Record<string, { cost: number; count: number }> = {}
  filtered.forEach(r => {
    if (!scaleMap[r.scaleCode]) scaleMap[r.scaleCode] = { cost: 0, count: 0 }
    scaleMap[r.scaleCode].cost  += r.totalCost
    scaleMap[r.scaleCode].count += 1
  })
  const topScales = Object.entries(scaleMap)
    .sort((a, b) => b[1].cost - a[1].cost)
    .slice(0, 8)
    .map(([code, d]) => {
      const scale = store.scales.find(s => s.code === code)
      return { code, ...d, brand: scale?.brand ?? '', model: scale?.model ?? '' }
    })

  const recentRepairs = [...filtered]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10)
    .map(r => ({ ...r, section: store.sections.find(s => s.code === r.sectionCode) }))

  const years = [...new Set(store.repairs.map(r => r.date?.slice(0, 4)).filter(Boolean))].sort((a, b) => b.localeCompare(a))

  return {
    totalRepairs: filtered.length,
    totalCost, partCost, extCost,
    avgCost: filtered.length > 0 ? Math.round(totalCost / filtered.length) : 0,
    totalScales: store.scales.length, active, inactive,
    monthlyData, deptMap, typeCount, topScales, recentRepairs, years,
  }
}

// ─── BACKUP / RESTORE ───────────────────────────────────────────────────────
const BACKUP_VERSION = '2.0'
const BACKUP_APP = 'Scale Manager'

export interface BackupPayload {
  _meta: { version: string; exported_at: string; app: string }
  sections: Section[]; vendors: Vendor[]; scales: Scale[]; repairs: RepairJob[]
  parts: Part[]; weights: Weight[]; users: User[]; calplan: CalPlan[]
  calibrations?: CalibrationRecord[]
}

/** ส่งออกข้อมูลทั้งหมดปัจจุบันเป็นก้อน JSON (ใช้กับปุ่ม "Backup") */
export function exportBackup(): BackupPayload {
  return {
    _meta: { version: BACKUP_VERSION, exported_at: new Date().toISOString(), app: BACKUP_APP },
    sections: store.sections, vendors: store.vendors, scales: store.scales, repairs: store.repairs,
    parts: store.parts, weights: store.weights, users: store.users, calplan: store.calplan,
    calibrations: store.calibrations,
  }
}

function isSnakeCaseBackup(raw: any): boolean {
  return Array.isArray(raw?.scales) && raw.scales.length > 0 && 'scale_code' in raw.scales[0]
}

/** แปลงไฟล์ backup รูปแบบเก่า (snake_case จากระบบเดิม) ให้เป็นโครงสร้างปัจจุบัน
 *  หมายเหตุ: กรณีมีรหัสเครื่องซ้ำกันในไฟล์เก่า จะเก็บตัวแรกไว้ตามเดิม และแทนที่ตัวถัดไปด้วย
 *  รหัส Generation ใหม่ที่ไม่ชนกับตัวอื่น (ดูฟังก์ชัน getScaleFamily/parseScaleCode) */
function convertLegacyBackup(raw: any): BackupPayload {
  const sections: Section[] = (raw.sections ?? []).map((s: any) => ({ code: s.section_code, name: s.section_name, dept: s.department_name }))
  const vendors: Vendor[] = (raw.vendors ?? []).map((v: any) => ({ code: v.vendor_code, name: v.vendor_name, abbr: v.vendor_abbr }))
  const parts: Part[] = (raw.parts ?? []).map((p: any) => ({ code: p.part_code, name: p.part_name, modelCode: p.model_code ?? '', standardPrice: p.standard_price ?? 0, note: p.note ?? '' }))
  const weights: Weight[] = (raw.weights ?? []).map((w: any) => ({
    sn: w.weight_sn, sectionCode: w.section_code, weightG: w.weight_g, class_: w.class_, supplier: w.supplier,
    mpe: w.mpe, calDate: w.cal_date, calBy: w.cal_by, certNo: w.cert_no, convMass: w.conv_mass,
    uncertainty: w.uncertainty, status: w.status,
  }))
  const users: User[] = (raw.users ?? []).map((u: any) => ({ username: u.username, password: u.password, fullname: u.fullname, role: u.role }))
  const calplan: CalPlan[] = (raw.calplan ?? []).map((c: any) => ({
    id: c.id, group: c.group, department: c.department, location: c.location, type: c.type,
    qty: c.qty, intervalMonths: c.interval_months, lastCal: c.last_cal,
  }))

  const seenCodes = new Set<string>((raw.scales ?? []).map((s: any) => s.scale_code))
  const scales: Scale[] = []
  const groups = new Map<string, any[]>()
  ;(raw.scales ?? []).forEach((s: any) => {
    const arr = groups.get(s.scale_code) ?? []
    arr.push(s); groups.set(s.scale_code, arr)
  })
  groups.forEach((items, code) => {
    const sorted = [...items].sort((a, b) => (a.start_date === '' ? 1 : 0) - (b.start_date === '' ? 1 : 0) || String(a.start_date).localeCompare(b.start_date))
    sorted.forEach((item, idx) => {
      const p = parseScaleCode(code)
      let finalCode = code
      if (idx > 0 && p) {
        let uc = p.gen + 1
        while (true) {
          const cand = buildScaleCode(p.prefix.split('-')[0] ?? '', p.prefix.split('-')[1] ?? '', uc, parseInt(p.serial, 10) || 0)
          if (!seenCodes.has(cand)) { finalCode = cand; seenCodes.add(cand); break }
          uc++
        }
      }
      const parsed = parseScaleCode(finalCode)
      const segs = finalCode.split('-')
      scales.push({
        id: 0, code: finalCode,
        sectionCode: segs[0] ?? '', brandCode: segs[1] ?? '',
        usageCount: parsed?.gen ?? 0, seqNumber: parseInt(parsed?.serial ?? '0', 10) || 0,
        serialNumber: item.serial_number, brand: item.brand, model: item.model, scaleType: item.type,
        sectionRef: item.section_code, startDate: item.start_date, endDate: item.end_date,
        purchasePrice: item.purchase_price, status: item.status,
      })
    })
  })

  const repairs: RepairJob[] = (raw.repairs ?? []).map((r: any) => ({
    repairId: r.repair_id, date: r.date, scaleCode: r.scale_code, sectionCode: r.section_code,
    pmiiDocNo: r.pmii_doc_no, repairType: r.repair_type, actionTaken: r.action_taken, description: r.description,
    technician: r.technician,
    parts: (r.parts ?? []).map((p: any) => ({ partName: p.part_name, qty: p.qty, unitPrice: p.unit_price, cost: p.subtotal })),
    extItems: (r.ext_items ?? []).map((e: any) => ({ description: e.description ?? e.item ?? '', cost: e.cost ?? 0 })),
    vendorCode: r.vendor_code, partCost: r.part_cost, externalCost: r.external_cost, totalCost: r.total_cost,
  }))

  // เติมรหัสเครื่องที่ถูกลบไปแล้วแต่ยังมีในประวัติซ่อม ให้เป็นเครื่อง Inactive ว่างๆ กันลิงก์ขาด
  const knownCodes = new Set(scales.map(s => s.code))
  const sectionCodes = new Set(sections.map(s => s.code))
  const missing = new Set(repairs.map(r => r.scaleCode).filter(c => c && !knownCodes.has(c)))
  missing.forEach(code => {
    const p = parseScaleCode(code)
    if (!p) return
    const segs = code.split('-')
    scales.push({
      id: 0, code, sectionCode: segs[0] ?? '', brandCode: segs[1] ?? '',
      usageCount: p.gen, seqNumber: parseInt(p.serial, 10) || 0,
      serialNumber: '', brand: '', model: '', scaleType: '',
      sectionRef: sectionCodes.has(segs[0]) ? segs[0] : (sections[0]?.code ?? ''),
      startDate: '', endDate: '', purchasePrice: 0, status: 'Inactive',
    })
  })
  scales.forEach((s, i) => { s.id = i + 1 })

  return {
    _meta: { version: BACKUP_VERSION, exported_at: new Date().toISOString(), app: BACKUP_APP },
    sections, vendors, scales, repairs, parts, weights, users, calplan, calibrations: [],
  }
}

/** นำเข้าไฟล์ backup (รองรับทั้งรูปแบบปัจจุบัน และรูปแบบเก่า snake_case) แล้วแทนที่ข้อมูลทั้งหมดในระบบ
 *  คืนค่าจำนวนรายการที่นำเข้าในแต่ละหมวด หรือ throw error ถ้าไฟล์ไม่ถูกต้อง */
export function importBackup(json: string) {
  let raw: any
  try { raw = JSON.parse(json) } catch { throw new Error('ไฟล์ไม่ใช่ JSON ที่ถูกต้อง') }

  const payload: BackupPayload = isSnakeCaseBackup(raw) ? convertLegacyBackup(raw) : raw
  if (!Array.isArray(payload.scales) || !Array.isArray(payload.repairs)) {
    throw new Error('โครงสร้างไฟล์ไม่ถูกต้อง (ไม่พบ scales หรือ repairs)')
  }

  store = {
    sections: payload.sections ?? [],
    vendors: payload.vendors ?? [],
    scales: payload.scales ?? [],
    repairs: payload.repairs ?? [],
    parts: payload.parts ?? [],
    users: payload.users?.length ? payload.users : store.users,
    weights: payload.weights ?? [],
    calplan: payload.calplan?.length ? payload.calplan : DEFAULT_CALPLAN,
    calibrations: payload.calibrations ?? [],
    _repairSeq: 0,
  }
  persist()

  return {
    sections: store.sections.length, vendors: store.vendors.length, scales: store.scales.length,
    repairs: store.repairs.length, parts: store.parts.length, weights: store.weights.length,
    users: store.users.length, calplan: store.calplan.length,
  }
}

/** รีเซ็ตกลับไปเป็นชุดข้อมูลตั้งต้นที่ติดมากับแอป (ไม่ใช่ล้างจนว่างเปล่า) */
export function restoreSeedDefaults() {
  store = freshSeed()
  persist()
}
