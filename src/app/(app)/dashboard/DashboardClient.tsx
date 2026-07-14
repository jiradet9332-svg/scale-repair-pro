'use client'

import { useState, useEffect } from 'react'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js'
import Link from 'next/link'
import { fmt, fmtDate, repairTypeLabel } from '@/lib/utils'
import { getDashboardStats } from '@/lib/store'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler)

export default function DashboardClient() {
  const [data, setData] = useState<any>(null)

  useEffect(() => { setData(getDashboardStats()) }, [])

  if (!data) return (
    <div className="p-6 flex items-center justify-center h-64 text-gray-400 text-[13px]">
      <i className="ti ti-loader-2 animate-spin mr-2" /> กำลังโหลดข้อมูล...
    </div>
  )

  const {
    totalRepairs, totalCost, partCost, extCost, avgCost,
    totalScales, active, inactive,
    monthlyData, deptMap, typeCount, topScales, recentRepairs, years,
  } = data

  const barData = {
    labels: monthlyData.map((m: any) => m.month),
    datasets: [
      { label: 'ซ่อมเอง',    data: monthlyData.map((m: any) => m.self), backgroundColor: '#378ADD', borderRadius: 3, stack: 'a' },
      { label: 'ส่งซ่อมนอก', data: monthlyData.map((m: any) => m.ext),  backgroundColor: '#D97706', borderRadius: 3, stack: 'a' },
      { label: 'ทั้งสองแบบ', data: monthlyData.map((m: any) => m.both), backgroundColor: '#9333EA', borderRadius: 3, stack: 'a' },
    ],
  }

  const typeEntries = Object.entries(typeCount).filter(([, v]: any) => v > 0)
  const donutData = {
    labels: typeEntries.map(([k]) => repairTypeLabel[k as 'self'|'ext'|'both']),
    datasets: [{ data: typeEntries.map(([, v]) => v), backgroundColor: ['#378ADD','#D97706','#9333EA'], borderWidth: 0, hoverOffset: 4 }],
  }

  const lineData = {
    labels: monthlyData.map((m: any) => m.month),
    datasets: [{ data: monthlyData.map((m: any) => m.totalCost), borderColor: '#378ADD', backgroundColor: 'transparent', borderWidth: 1.5, pointRadius: 3, pointBackgroundColor: '#378ADD', tension: 0.3 }],
  }

  const chartOpts: any = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { font: { size: 11 }, color: '#B4B2A9' }, grid: { display: false }, border: { display: false } },
      y: { ticks: { font: { size: 10 }, color: '#B4B2A9' }, grid: { color: 'rgba(0,0,0,0.05)' }, border: { display: false } },
    },
  }

  const deptEntries = Object.entries(deptMap).sort((a: any, b: any) => b[1].cost - a[1].cost)
  const maxDeptCost = deptEntries[0]?.[1] ? (deptEntries[0][1] as any).cost : 1

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[15px] font-medium text-gray-900">ภาพรวมการซ่อมเครื่องชั่ง</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">ข้อมูล {years.length > 0 ? `ปี ${years.join(', ')}` : 'ทั้งหมด'}</p>
        </div>
        <Link href="/repairs/new" className="flex items-center gap-1.5 bg-blue-600 text-white text-[12px] px-3 py-1.5 rounded-lg hover:bg-blue-700">
          <i className="ti ti-plus text-[14px]" /> บันทึกการซ่อมใหม่
        </Link>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: 'ใบแจ้งซ่อมทั้งหมด', value: totalRepairs,       sub: 'รายการ',                                                 icon: 'ti-clipboard-list' },
          { label: 'เครื่องชั่งทั้งหมด', value: totalScales,       sub: `${active} ใช้งาน · ${inactive} ปิดใช้งาน`,             icon: 'ti-scale' },
          { label: 'ค่าใช้จ่ายรวม',      value: '฿'+fmt(totalCost), sub: `อะไหล่ ฿${fmt(partCost)} · ส่งนอก ฿${fmt(extCost)}`,  icon: 'ti-currency-baht' },
          { label: 'ค่าเฉลี่ย/งาน',      value: '฿'+fmt(avgCost),  sub: `จาก ${totalRepairs} งาน`,                               icon: 'ti-chart-bar' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-xl p-3.5 hover:shadow-md transition-shadow" style={{ borderLeft: `3px solid ${['#3B82F6','#10B981','#8B5CF6','#F59E0B'][i]}` }}>
            <div className="flex items-center justify-between mb-2"><i className={`ti ${kpi.icon} text-[18px] text-blue-500`}/></div>
            <div className="text-[20px] font-medium text-gray-900 leading-none mb-1">{kpi.value}</div>
            <div className="text-[11px] text-gray-400">{kpi.label}</div>
            <div className="text-[10px] text-gray-400 mt-1">{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-3 mb-3">
        <div className="col-span-3 bg-white border border-gray-100 rounded-xl p-4">
          <div className="text-[12px] font-medium text-gray-800 mb-0.5">ใบแจ้งซ่อมรายเดือน</div>
          <div className="flex gap-3 mb-2 mt-1">
            {[['#378ADD','ซ่อมเอง'],['#D97706','ส่งซ่อมนอก'],['#9333EA','ทั้งสองแบบ']].map(([c,l]) => (
              <span key={l} className="flex items-center gap-1 text-[10px] text-gray-500"><span className="w-2 h-2 rounded-sm inline-block" style={{background:c}}></span>{l}</span>
            ))}
          </div>
          <div className="relative h-44">
            <Bar data={barData} options={{ ...chartOpts, scales: { ...chartOpts.scales, x: { ...chartOpts.scales.x, stacked: true }, y: { ...chartOpts.scales.y, stacked: true } } }} />
          </div>
        </div>

        <div className="col-span-2 bg-white border border-gray-100 rounded-xl p-4">
          <div className="text-[12px] font-medium text-gray-800 mb-3">สัดส่วนประเภทซ่อม</div>
          {totalRepairs === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-300"><i className="ti ti-chart-pie text-2xl mb-1"/><span className="text-[11px]">ยังไม่มีข้อมูล</span></div>
          ) : (
            <>
              <div className="relative h-32 w-32 mx-auto">
                <Doughnut data={donutData} options={{ responsive:true, maintainAspectRatio:false, cutout:'68%', plugins:{legend:{display:false}} }}/>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[18px] font-medium text-gray-900">{totalRepairs}</span><span className="text-[9px] text-gray-400">รายการ</span>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {typeEntries.map(([k,v]:any,i) => (
                  <div key={k} className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 text-gray-500"><span className="w-2 h-2 rounded-sm inline-block" style={{background:['#378ADD','#D97706','#9333EA'][i]}}></span>{repairTypeLabel[k as 'self'|'ext'|'both']}</span>
                    <span className="font-medium text-gray-800">{v} ({Math.round((v/totalRepairs)*100)}%)</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="text-[12px] font-medium text-gray-800 mb-3">ค่าใช้จ่ายตามฝ่าย/แผนก</div>
          {deptEntries.length === 0 ? (
            <div className="text-[11px] text-gray-300 text-center py-4">ยังไม่มีข้อมูล</div>
          ) : (
            <div className="space-y-2">
              {deptEntries.map(([dept,d]:any) => (
                <div key={dept} className="flex items-center gap-2">
                  <div className="w-28 text-[11px] text-gray-500 truncate shrink-0">{dept}</div>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-blue-400 rounded-full" style={{width:`${Math.round((d.cost/maxDeptCost)*100)}%`}}></div></div>
                  <div className="w-20 text-right text-[11px] font-medium text-gray-700">฿{fmt(d.cost)}</div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="text-[10px] text-gray-400 mb-1.5">ค่าซ่อมรายเดือน (฿)</div>
            <div className="relative h-16">
              <Line data={lineData} options={{ ...chartOpts, plugins:{legend:{display:false}}, scales:{ x:chartOpts.scales.x, y:{...chartOpts.scales.y, ticks:{...chartOpts.scales.y.ticks, callback:(v:any)=>'฿'+Math.round(v/1000)+'k'}} }}}/>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[12px] font-medium text-gray-800">รายการซ่อมล่าสุด</div>
            <Link href="/repairs" className="text-[10px] text-blue-600 hover:underline">ดูทั้งหมด →</Link>
          </div>
          {recentRepairs.length === 0 ? (
            <div className="text-[11px] text-gray-300 text-center py-8">ยังไม่มีใบแจ้งซ่อม</div>
          ) : recentRepairs.map((job:any) => (
            <Link key={job.repairId} href={`/repairs/${job.repairId}`} className="flex items-start gap-2.5 py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded transition-colors">
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${job.repairType==='self'?'bg-blue-400':job.repairType==='ext'?'bg-amber-400':'bg-purple-400'}`}></div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-gray-800 font-medium truncate">{job.scaleCode} — {job.actionTaken.slice(0,28)}{job.actionTaken.length>28?'...':''}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{job.repairId} · {job.section?.name??'—'} · {fmtDate(job.date)}</div>
              </div>
              <span className="text-[11px] font-medium text-gray-600 flex-shrink-0">฿{fmt(job.totalCost)}</span>
            </Link>
          ))}
        </div>
      </div>

      {topScales.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="text-[12px] font-medium text-gray-800 mb-3">เครื่องชั่งที่มีค่าซ่อมสูงสุด (Top 8)</div>
          <table className="w-full text-[12px]">
            <thead><tr className="border-b border-gray-100">
              <th className="text-left py-2 text-[10px] font-medium text-gray-400 uppercase">Scale ID</th>
              <th className="text-left py-2 text-[10px] font-medium text-gray-400 uppercase">Brand / Model</th>
              <th className="text-right py-2 text-[10px] font-medium text-gray-400 uppercase">จำนวนครั้ง</th>
              <th className="text-right py-2 text-[10px] font-medium text-gray-400 uppercase">ค่าใช้จ่ายรวม</th>
            </tr></thead>
            <tbody>
              {topScales.map((s:any) => (
                <tr key={s.code} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 font-mono text-blue-600 font-medium">{s.code}</td>
                  <td className="py-2 text-gray-600">{s.brand} {s.model}</td>
                  <td className="py-2 text-right text-gray-600">{s.count}</td>
                  <td className="py-2 text-right font-medium text-gray-800">฿{fmt(s.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
