import { getRepairById, getScales, getSections, getVendors } from '@/lib/store'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { fmtDate, fmt, repairTypeLabel, repairTypeColor } from '@/lib/utils'

export default function RepairDetailPage({ params }: { params: { id: string } }) {
  const repair = getRepairById(params.id)
  if (!repair) notFound()
  const scale = getScales().find(s => s.code === repair.scaleCode)
  const section = getSections().find(s => s.code === repair.sectionCode)
  const vendor = getVendors().find(v => v.code === repair.vendorCode)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-[11px] text-gray-400 mb-1">ใบแจ้งซ่อม</div>
          <h1 className="text-[18px] font-semibold text-gray-900 font-mono">{repair.repairId}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/repairs/${repair.repairId}/edit`} className="text-[12px] px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">แก้ไข</Link>
          <Link href="/repairs" className="text-[12px] px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">← ย้อนกลับ</Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-3">📋 ข้อมูลทั่วไป</div>
            <div className="grid grid-cols-2 gap-4 text-[13px]">
              <div><span className="text-gray-400 text-[11px] block mb-0.5">วันที่แจ้งซ่อม</span><span className="font-medium">{fmtDate(repair.date)}</span></div>
              <div><span className="text-gray-400 text-[11px] block mb-0.5">เลขที่เอกสาร PMII</span><span className="font-medium">{repair.pmiiDocNo || '—'}</span></div>
              <div><span className="text-gray-400 text-[11px] block mb-0.5">ประเภทการซ่อม</span><span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${repairTypeColor[repair.repairType]}`}>{repairTypeLabel[repair.repairType]}</span></div>
              <div><span className="text-gray-400 text-[11px] block mb-0.5">ผู้ดำเนินการ / ช่าง</span><span className="font-medium">{repair.technician || '—'}</span></div>
              {repair.vendorCode && <div><span className="text-gray-400 text-[11px] block mb-0.5">Vendor</span><span className="font-medium">{vendor?.name ?? repair.vendorCode}</span></div>}
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">⚠️ การดำเนินการ / อาการที่พบ</div>
            <p className="text-[13px] text-gray-800 leading-relaxed">{repair.actionTaken}</p>
            {repair.description && <p className="text-[12px] text-gray-500 mt-2 border-t border-gray-100 pt-2">{repair.description}</p>}
          </div>

          {repair.parts.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-3">📦 อะไหล่ที่ใช้</div>
              <table className="w-full text-[12px]">
                <thead><tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-[10px] font-medium text-gray-400 uppercase">ชื่ออะไหล่</th>
                  <th className="text-right py-2 text-[10px] font-medium text-gray-400 uppercase">จำนวน</th>
                  <th className="text-right py-2 text-[10px] font-medium text-gray-400 uppercase">ราคา/หน่วย</th>
                  <th className="text-right py-2 text-[10px] font-medium text-gray-400 uppercase">ราคารวม</th>
                </tr></thead>
                <tbody>
                  {repair.parts.map((p, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 text-gray-800">{p.partName}</td>
                      <td className="py-2 text-right text-gray-600">{p.qty}</td>
                      <td className="py-2 text-right text-gray-600">฿{fmt(p.unitPrice)}</td>
                      <td className="py-2 text-right font-medium text-gray-800">฿{fmt(p.cost)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td colSpan={3} className="pt-2 text-right text-[11px] text-gray-400 font-medium">รวมค่าอะไหล่</td><td className="pt-2 text-right text-[14px] font-semibold text-blue-600">฿{fmt(repair.partCost)}</td></tr></tfoot>
              </table>
            </div>
          )}

          {repair.extItems.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-3">🚚 ค่าใช้จ่ายส่งซ่อมภายนอก</div>
              <table className="w-full text-[12px]">
                <thead><tr className="border-b border-gray-100"><th className="text-left py-2 text-[10px] font-medium text-gray-400 uppercase">รายละเอียด</th><th className="text-right py-2 text-[10px] font-medium text-gray-400 uppercase">ค่าใช้จ่าย</th></tr></thead>
                <tbody>{repair.extItems.map((e, i) => (
                  <tr key={i} className="border-b border-gray-50"><td className="py-2 text-gray-800">{e.description}</td><td className="py-2 text-right font-medium text-gray-800">฿{fmt(e.cost)}</td></tr>
                ))}</tbody>
                <tfoot><tr><td className="pt-2 text-right text-[11px] text-gray-400 font-medium">รวมค่าซ่อมนอก</td><td className="pt-2 text-right text-[14px] font-semibold text-blue-600">฿{fmt(repair.externalCost)}</td></tr></tfoot>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-3">⚖️ ข้อมูลเครื่องชั่ง</div>
            {scale ? (
              <div className="space-y-2 text-[13px]">
                <div><span className="text-gray-400 text-[11px] block mb-0.5">Scale ID</span><Link href="/scaleview" className="font-medium text-blue-600 font-mono">{scale.code}</Link></div>
                <div><span className="text-gray-400 text-[11px] block mb-0.5">Brand / Model</span><span className="font-medium">{scale.brand} {scale.model}</span></div>
                <div><span className="text-gray-400 text-[11px] block mb-0.5">แผนก</span><span>{section?.name ?? '—'}</span></div>
              </div>
            ) : <p className="text-[12px] text-gray-400">ไม่พบข้อมูลเครื่องชั่ง</p>}
          </div>
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4 text-white">
            <div className="text-[11px] opacity-80 mb-1">ค่าใช้จ่ายรวมทั้งหมด</div>
            <div className="text-[24px] font-bold">฿{fmt(repair.totalCost)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
