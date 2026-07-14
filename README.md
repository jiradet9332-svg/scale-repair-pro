# ScaleRepair Pro 🔧⚖️
ระบบจัดการซ่อมเครื่องชั่ง — Next.js 14 + TypeScript + MySQL + Prisma

---

## Tech Stack
| Layer | Technology |
|---|---|
| Frontend | React 18 + Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Backend | Next.js API Routes (Node.js) |
| ORM | Prisma |
| Database | MySQL |
| Forms | React Hook Form + Zod |
| Charts | Chart.js + react-chartjs-2 |
| Deploy | Vercel |

---

## ขั้นตอนติดตั้ง (Local)

### 1. ติดตั้ง dependencies
```bash
npm install
# ติดตั้ง zodResolver ด้วย
npm install @hookform/resolvers
```

### 2. ตั้งค่า Database
สร้างไฟล์ `.env` จาก `.env.example`:
```bash
cp .env.example .env
```
แก้ไข `DATABASE_URL` ให้ตรงกับ MySQL ของคุณ:
```
DATABASE_URL="mysql://root:password@localhost:3306/scale_repair_db"
```

### 3. สร้าง Database และ push schema
```bash
# สร้าง DB ใน MySQL ก่อน
mysql -u root -p -e "CREATE DATABASE scale_repair_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Push schema
npm run db:push

# Seed ข้อมูลตัวอย่าง
npm run db:seed
```

### 4. รัน development server
```bash
npm run dev
```
เปิดที่ http://localhost:3000

---

## โครงสร้างโปรเจกต์
```
src/
├── app/
│   ├── (app)/                  # Layout หลัก (มี Sidebar)
│   │   ├── dashboard/          # หน้า Dashboard + charts
│   │   ├── repairs/            # รายการซ่อม, สร้างใหม่, แก้ไข
│   │   │   ├── new/            # สร้างใบแจ้งซ่อม
│   │   │   └── [id]/           # รายละเอียด + แก้ไข
│   │   ├── parts/              # คลังอะไหล่
│   │   └── scales/             # ทะเบียนเครื่องชั่ง
│   ├── api/
│   │   ├── dashboard/          # GET stats
│   │   ├── repairs/            # GET list, POST create, PATCH, DELETE
│   │   ├── parts/              # GET list, POST create
│   │   ├── scales/             # GET list
│   │   └── technicians/        # GET list
│   └── globals.css
├── components/
│   ├── layout/Sidebar.tsx
│   └── ui/Badge.tsx
├── lib/
│   ├── prisma.ts               # Prisma client singleton
│   └── utils.ts                # helpers, formatters, label maps
└── types/index.ts              # TypeScript interfaces
prisma/
├── schema.prisma               # Database schema
└── seed.ts                     # ข้อมูลตัวอย่าง
```

---

## Deploy บน Vercel

1. Push โค้ดขึ้น GitHub
2. Import repo ใน Vercel
3. ตั้งค่า Environment Variables:
   - `DATABASE_URL` — MySQL connection string (แนะนำ PlanetScale หรือ Railway สำหรับ MySQL บน cloud)
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`
4. Deploy!

> **แนะนำ MySQL บน Cloud:** [PlanetScale](https://planetscale.com) (free tier) หรือ [Railway](https://railway.app)

---

## หน้าที่มีในระบบ
| หน้า | URL | คำอธิบาย |
|---|---|---|
| Dashboard | `/dashboard` | KPI, กราฟ, รายการล่าสุด |
| รายการซ่อม | `/repairs` | ตารางพร้อม filter/search |
| แจ้งซ่อมใหม่ | `/repairs/new` | ฟอร์มสร้างใบแจ้งซ่อม |
| รายละเอียด | `/repairs/[id]` | ดูและอัปเดตสถานะ |
| แก้ไข | `/repairs/[id]/edit` | แก้ไขใบแจ้งซ่อม |
| คลังอะไหล่ | `/parts` | รายการ + เพิ่มอะไหล่ |
| ทะเบียนเครื่องชั่ง | `/scales` | การ์ดเครื่องชั่งทั้งหมด |

---

## เพิ่มเติมในอนาคต
- [ ] NextAuth.js login (Admin / ช่าง / Viewer)
- [ ] Export PDF ใบแจ้งซ่อม
- [ ] แจ้งเตือน LINE Notify เมื่อสถานะเปลี่ยน
- [ ] PM Schedule (แผน preventive maintenance)
- [ ] Barcode scan เครื่องชั่ง
