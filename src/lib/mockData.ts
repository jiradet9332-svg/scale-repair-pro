// ─── MOCK DATA STORE ────────────────────────────────────────────────────────
// ใช้แทน Database ชั่วคราว  เมื่อพร้อมต่อ DB ให้ลบไฟล์นี้และแก้ page/api ต่างๆ

// ─── ENUMS ───────────────────────────────────────────────────────────────────
export type ScaleStatus   = 'Active' | 'Inactive'
export type RepairType    = 'self' | 'ext' | 'both'

// ─── INTERFACES ──────────────────────────────────────────────────────────────
export interface Section {
  code: string           // e.g. "L1"
  name: string           // e.g. "Line 1"
  dept: string           // e.g. "ฝ่ายผลิต"
}

export interface Vendor {
  code: string           // e.g. "B01"
  name: string           // e.g. "Zentech"
  abbr: string           // e.g. "ZT"
}

export interface Scale {
  id: number
  code: string           // [SC]-[BR]-[UU]-[NNN]
  sectionCode: string    // part[0]
  brandCode: string      // part[1]
  usageCount: number     // part[2] as int
  seqNumber: number      // part[3] as int
  serialNumber: string
  brand: string
  model: string
  scaleType: 'Digital' | 'Spring' | ''
  sectionRef: string     // foreign key → Section.code
  startDate: string
  endDate: string
  purchasePrice: number
  status: ScaleStatus
}

export interface RepairPart {
  partName: string
  qty: number
  unitPrice: number
  cost: number
}

export interface ExtItem {
  description: string
  cost: number
}

export interface RepairJob {
  repairId: string        // REP-YY-NNNN
  date: string
  scaleCode: string
  sectionCode: string
  pmiiDocNo: string
  repairType: RepairType
  actionTaken: string
  description: string
  technician: string
  parts: RepairPart[]
  extItems: ExtItem[]
  vendorCode: string
  partCost: number
  externalCost: number
  totalCost: number
}

export interface Part {
  code: string
  name: string
  modelCode: string
  standardPrice: number
  note: string
}

export interface User {
  username: string
  password: string
  fullname: string
  role: 'admin' | 'employee'
}

export interface Weight {
  sn: string             // Weight S/N
  sectionCode: string
  weightG: number
  class_: string
  supplier: string
  mpe: number
  calDate: string
  calBy: string
  certNo: string
  convMass: number
  uncertainty: number
  status: 'Pass' | 'Not pass'
}

export interface CalPlan {
  id: string             // CP-S-001, CP-W-001
  group: 'scale' | 'weight'
  department: string
  location: string
  type: string
  qty: number
  intervalMonths: number
  lastCal: string        // ISO date
}

// ─── Balance Calibration record (สอบเทียบเครื่องชั่ง) ───────────────────────
export interface CalUncertaintyComponent {
  name: string
  type: string      // 'A' | 'B'
  dist: string      // normal / rectangular
  val: number
  div: string
  u: number
}

export interface CalibrationRecord {
  certNo: string          // CAL-YY-NNNN
  assetId: string         // รหัสเครื่องชั่ง เช่น A0142
  model: string
  location: string
  date: string            // วันที่สอบเทียบ ISO
  tempC: number
  rh: number
  maxCap: number
  resolution: number
  mpe: number
  uA: number              // repeatability
  uEcc: number            // eccentricity
  uRes: number            // resolution
  uWeight: number         // standard weight
  uc: number              // combined uncertainty
  k: number
  uExpanded: number       // U = k * uc
  errorMax: number        // |E|max จาก linearity
  worst: number           // errorMax + uExpanded
  pass: boolean
  components: CalUncertaintyComponent[]
  // ── ค่าดิบที่ใช้คำนวณ (เก็บไว้เพื่อดูย้อนหลังทั้งหมด ไม่ใช่แค่ผลสรุป) ──────
  repeatability?: { nom: number; readings: number[]; mean: number; sd: number; uA: number }[]
  eccentricity?: { nom: number; readings: number[]; ref: number; maxDev: number; u: number }
  linearity?: { nom: number; realMass: number; reading: number; error: number; uWeight: number }[]
  technician: string
  intervalMonths: number
  nextDue: string         // ISO date = date + intervalMonths
  status: 'draft' | 'issued'
}

