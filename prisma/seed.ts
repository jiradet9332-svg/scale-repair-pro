import { PrismaClient, RepairType, RepairStatus, Urgency, ScaleStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Departments & Sections
  const deptA = await prisma.department.upsert({
    where: { name: 'Production A' },
    update: {},
    create: {
      name: 'Production A',
      sections: { create: [{ name: 'Mixing' }, { name: 'Packing' }] },
    },
  })
  const deptB = await prisma.department.upsert({
    where: { name: 'Production B' },
    update: {},
    create: {
      name: 'Production B',
      sections: { create: [{ name: 'Mixing' }, { name: 'Filling' }] },
    },
  })
  const deptWH = await prisma.department.upsert({
    where: { name: 'Warehouse' },
    update: {},
    create: {
      name: 'Warehouse',
      sections: { create: [{ name: 'Receiving' }, { name: 'Shipping' }] },
    },
  })
  await prisma.department.upsert({
    where: { name: 'Quality Control' },
    update: {},
    create: {
      name: 'Quality Control',
      sections: { create: [{ name: 'Lab' }, { name: 'Inspection' }] },
    },
  })

  const sections = await prisma.section.findMany()
  const sec = (deptName: string, secName: string) =>
    sections.find(s => s.name === secName && s.departmentId === [deptA, deptB, deptWH].find(d => d.name === deptName)?.id)

  // Scales
  const scaleData = [
    { code: 'SC-001', brand: 'Sartorius', model: 'CPA34001S', capacity: '30', sectionId: sec('Production A', 'Mixing')?.id ?? 1 },
    { code: 'SC-002', brand: 'Mettler Toledo', model: 'ICS449', capacity: '150', sectionId: sec('Production A', 'Packing')?.id ?? 1 },
    { code: 'SC-003', brand: 'Ohaus', model: 'Defender 5000', capacity: '500', sectionId: sec('Warehouse', 'Receiving')?.id ?? 1 },
    { code: 'SC-004', brand: 'A&D', model: 'GP-100K', capacity: '100', sectionId: sec('Production B', 'Filling')?.id ?? 1 },
    { code: 'SC-005', brand: 'Sartorius', model: 'SIGNUM', capacity: '60', sectionId: sec('Quality Control', 'Lab')?.id ?? 1 },
  ]
  for (const s of scaleData) {
    await prisma.scale.upsert({ where: { code: s.code }, update: {}, create: s })
  }

  // Technicians
  const techs = [
    { name: 'สมชาย ทองดี', phone: '081-234-5678', email: 'somchai@company.com' },
    { name: 'วิชัย แก้วมณี', phone: '082-345-6789', email: 'wichai@company.com' },
    { name: 'ประเสริฐ สุขใจ', phone: '083-456-7890', email: 'prasert@company.com' },
  ]
  for (const t of techs) {
    const existing = await prisma.technician.findFirst({ where: { name: t.name } })
    if (!existing) await prisma.technician.create({ data: t })
  }

  // Parts
  const partsData = [
    { code: 'LC-001', name: 'Load Cell Sensor', unitPrice: 1200, stock: 5, unit: 'ชิ้น' },
    { code: 'DM-001', name: 'Display Module', unitPrice: 850, stock: 3, unit: 'ชิ้น' },
    { code: 'PA-001', name: 'Power Adapter 12V', unitPrice: 350, stock: 8, unit: 'ชิ้น' },
    { code: 'IB-001', name: 'Indicator Board', unitPrice: 2200, stock: 2, unit: 'ชิ้น' },
    { code: 'RF-001', name: 'Rubber Foot Pad', unitPrice: 50, stock: 20, unit: 'ชุด' },
    { code: 'CB-001', name: 'Signal Cable', unitPrice: 180, stock: 15, unit: 'เส้น' },
    { code: 'FU-001', name: 'Fuse 250mA', unitPrice: 30, stock: 50, unit: 'ชิ้น' },
  ]
  for (const p of partsData) {
    await prisma.part.upsert({ where: { code: p.code }, update: {}, create: p })
  }

  // Sample repair jobs
  const scales = await prisma.scale.findMany()
  const technicians = await prisma.technician.findMany()
  const parts = await prisma.part.findMany()

  const jobs = [
    {
      pmiiNumber: 'PMII-2025-0037',
      scaleId: scales[0].id,
      technicianId: technicians[1].id,
      repairType: RepairType.REPLACE_PART,
      symptom: 'ค่าน้ำหนักไม่นิ่ง โหลดเซลล์เสีย',
      urgency: Urgency.URGENT,
      status: RepairStatus.DONE,
      reportedAt: new Date('2025-04-01'),
      endTime: new Date('2025-04-03'),
      totalPartCost: 1200,
    },
    {
      pmiiNumber: 'PMII-2025-0038',
      scaleId: scales[4].id,
      technicianId: technicians[0].id,
      repairType: RepairType.CALIBRATE,
      symptom: 'ต้องการ Calibrate ตามกำหนด PM',
      urgency: Urgency.NORMAL,
      status: RepairStatus.DONE,
      reportedAt: new Date('2025-04-05'),
      endTime: new Date('2025-04-05'),
      totalPartCost: 0,
    },
    {
      pmiiNumber: 'PMII-2025-0039',
      scaleId: scales[3].id,
      technicianId: technicians[2].id,
      repairType: RepairType.EXTERNAL_REPAIR,
      symptom: 'Board หลักเสีย ซ่อมเองไม่ได้ต้องส่งศูนย์',
      urgency: Urgency.URGENT,
      status: RepairStatus.SENT_EXTERNAL,
      reportedAt: new Date('2025-04-08'),
      totalPartCost: 0,
    },
    {
      pmiiNumber: 'PMII-2025-0041',
      scaleId: scales[2].id,
      technicianId: technicians[0].id,
      repairType: RepairType.REPLACE_PART,
      symptom: 'หน้าจอกะพริบ แสดงผลไม่ชัด',
      urgency: Urgency.URGENT,
      status: RepairStatus.IN_PROGRESS,
      reportedAt: new Date('2025-04-10'),
      totalPartCost: 850,
    },
    {
      pmiiNumber: 'PMII-2025-0042',
      scaleId: scales[1].id,
      technicianId: technicians[1].id,
      repairType: RepairType.REPLACE_PART,
      symptom: 'เครื่องชั่งแสดงค่าผิดพลาด ค่าน้ำหนักไม่นิ่ง',
      errorCode: 'E01',
      urgency: Urgency.CRITICAL,
      status: RepairStatus.PENDING,
      reportedAt: new Date('2025-04-10'),
      totalPartCost: 2050,
    },
  ]

  for (const job of jobs) {
    const existing = await prisma.repairJob.findUnique({ where: { pmiiNumber: job.pmiiNumber } })
    if (!existing) {
      await prisma.repairJob.create({ data: job })
    }
  }

  console.log('✅ Seed completed')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

// Users
import bcrypt from 'bcryptjs'
async function seedUsers() {
  const users = [
    { username: 'admin', name: 'ผู้ดูแลระบบ', role: 'ADMIN' as const, password: 'admin1234' },
    { username: 'technician', name: 'สมชาย ทองดี', role: 'TECHNICIAN' as const, password: 'tech1234' },
    { username: 'supervisor', name: 'วิชัย แก้วมณี', role: 'SUPERVISOR' as const, password: 'super1234' },
  ]
  for (const u of users) {
    const hashed = await bcrypt.hash(u.password, 10)
    const existing = await prisma.user.findUnique({ where: { username: u.username } })
    if (!existing) {
      await prisma.user.create({ data: { ...u, password: hashed } })
      console.log(`✅ Created user: ${u.username}`)
    }
  }
}
seedUsers().catch(console.error)
