'use client'
import { useState, useEffect } from 'react'
import { getUsers, createUser, updateUser, deleteUser } from '@/lib/store'
import type { User } from '@/lib/mockData'

const empty = (): User => ({ username: '', password: '', fullname: '', role: 'employee' })

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])

  useEffect(() => { setUsers([...getUsers()]) }, [])
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editUsername, setEditUsername] = useState('')
  const [form, setForm] = useState(empty())

  function openAdd() { setForm(empty()); setEditUsername(''); setModal('add') }
  function openEdit(u: User) { setForm({ ...u }); setEditUsername(u.username); setModal('edit') }

  function save() {
    const username = form.username.trim()
    if (!username || !form.fullname.trim()) { alert('กรุณากรอก username และชื่อ-สกุล'); return }
    if (modal === 'add') {
      if (!form.password) { alert('กรุณากรอกรหัสผ่าน'); return }
      const res = createUser({ ...form, username })
      if (!res) { alert('Username นี้มีอยู่แล้ว'); return }
    } else {
      const payload: Partial<User> = { fullname: form.fullname, role: form.role }
      if (form.password) payload.password = form.password
      updateUser(editUsername, payload)
    }
    setUsers([...getUsers()])
    setModal(null)
  }

  function del(username: string) {
    if (username === 'admin') { alert('ไม่สามารถลบผู้ดูแลระบบหลักได้'); return }
    if (!confirm(`ลบผู้ใช้ "${username}" ?`)) return
    deleteUser(username)
    setUsers([...getUsers()])
  }

  const inp = 'w-full h-9 px-3 border border-gray-200 rounded-lg text-[13px] bg-gray-50 text-gray-800 outline-none focus:border-blue-400'

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900">User Managment</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">{users.length} User</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 h-8 px-3.5 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-medium rounded-lg transition-colors">
          <i className="ti ti-plus text-[15px]" /> Add User
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-4 py-3 text-left text-[10px] font-medium text-gray-400 uppercase">User</th>
              <th className="px-4 py-3 text-left text-[10px] font-medium text-gray-400 uppercase">Full Name</th>
              <th className="px-4 py-3 text-left text-[10px] font-medium text-gray-400 uppercase">Role</th>
              <th className="px-4 py-3 text-center text-[10px] font-medium text-gray-400 uppercase w-20">Manage</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.username} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-gray-700 text-[12px]">{u.username}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{u.fullname}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${u.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                    {u.role === 'admin' ? '👑 Admin' : 'Employee'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-1.5">
                    <button onClick={() => openEdit(u)} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-100 text-gray-500 transition-colors"><i className="ti ti-edit text-[13px]" /></button>
                    <button onClick={() => del(u.username)} disabled={u.username === 'admin'}
                      className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded hover:bg-red-50 hover:border-red-200 hover:text-red-500 text-gray-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                      <i className="ti ti-trash text-[13px]" />
                    </button>
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
              <h2 className="text-[14px] font-medium">{modal === 'add' ? 'Add User' : 'แก้ไขผู้ใช้'}</h2>
              <button onClick={() => setModal(null)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400"><i className="ti ti-x text-[15px]" /></button>
            </div>
            <div className="p-5 space-y-3">
              {/* dummy hidden fields to absorb Chrome's autofill heuristics */}
              <input type="text" name="fake-username" autoComplete="username" className="hidden" tabIndex={-1} aria-hidden="true" />
              <input type="password" name="fake-password" autoComplete="new-password" className="hidden" tabIndex={-1} aria-hidden="true" />
              <div><label className="block text-[11px] font-medium text-gray-500 mb-1">User</label>
                <input className={inp} placeholder="" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} disabled={modal === 'edit'}
                  autoComplete="off" name="new-user-login-field" /></div>
              <div><label className="block text-[11px] font-medium text-gray-500 mb-1">{modal === 'add' ? 'Password' : 'รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)'}</label>
                <input type="password" className={inp} placeholder="••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  autoComplete="new-password" name="new-user-password-field" /></div>
              <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Full Name</label>
                <input className={inp} placeholder="" value={form.fullname} onChange={e => setForm(f => ({ ...f, fullname: e.target.value }))} autoComplete="off" /></div>
              <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Role</label>
                <select className={inp} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as 'admin' | 'employee' }))}>
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                </select></div>
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
