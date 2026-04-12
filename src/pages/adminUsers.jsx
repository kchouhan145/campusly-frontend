import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_BASE_URL
const TOKEN_KEY = 'campuslyToken'

const roleOptions = ['student', 'teacher', 'admin']
const filterOptions = ['all', 'student', 'teacher', 'admin', 'verified', 'unverified']

function getRoleBadge(role) {
  const map = {
    admin: 'bg-rose-100 text-rose-700',
    teacher: 'bg-amber-100 text-amber-700',
    student: 'bg-blue-100 text-blue-700',
  }
  return map[role] || 'bg-slate-100 text-slate-700'
}

function AdminUsers() {
  const navigate = useNavigate()
  const [currentUser, setCurrentUser] = useState(null)
  const [users, setUsers] = useState([])
  const [drafts, setDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [roleSavingId, setRoleSavingId] = useState('')
  const [statusSavingId, setStatusSavingId] = useState('')
  const [deletingId, setDeletingId] = useState('')

  const token = localStorage.getItem(TOKEN_KEY) || ''

  const syncDrafts = (list) => {
    const nextDrafts = {}
    list.forEach((user) => {
      nextDrafts[user._id] = {
        role: user.role || 'student',
        department: user.department || '',
        isVerified: Boolean(user.isVerified),
      }
    })
    setDrafts(nextDrafts)
  }

  const fetchUsers = async () => {
    const [meRes, usersRes] = await Promise.all([
      fetch(`${API_BASE}/api/auth/me`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }),
      fetch(`${API_BASE}/api/users/admin`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }),
    ])

    const meData = await meRes.json()
    const usersData = await usersRes.json()

    if (!meRes.ok) {
      throw new Error(meData.message || 'Failed to load current user')
    }
    if (!usersRes.ok) {
      throw new Error(usersData.message || 'Failed to load users')
    }

    if (meData.user?.role !== 'admin') {
      navigate('/')
      return
    }

    const list = Array.isArray(usersData.users) ? usersData.users : []
    setCurrentUser(meData.user || null)
    setUsers(list)
    syncDrafts(list)
  }

  useEffect(() => {
    if (!token) {
      navigate('/')
      return
    }

    let isMounted = true

    const load = async () => {
      setLoading(true)
      setError('')

      try {
        await fetchUsers()
      } catch (err) {
        if (!isMounted) return
        setError(err.message || 'Failed to load admin users')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    load()

    return () => {
      isMounted = false
    }
  }, [token, navigate])

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()

    return users.filter((user) => {
      if (filter === 'verified' && !user.isVerified) return false
      if (filter === 'unverified' && user.isVerified) return false
      if (filter !== 'all' && filter !== 'verified' && filter !== 'unverified' && user.role !== filter) return false

      if (!query) return true

      const haystack = `${user.name || ''} ${user.username || ''} ${user.email || ''} ${user.department || ''}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [users, search, filter])

  const stats = useMemo(() => {
    return {
      total: users.length,
      teachers: users.filter((user) => user.role === 'teacher').length,
      students: users.filter((user) => user.role === 'student').length,
      admins: users.filter((user) => user.role === 'admin').length,
    }
  }, [users])

  const updateDraft = (userId, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || {}),
        [field]: value,
      },
    }))
  }

  const handleSaveRole = async (userId) => {
    setError('')
    setMessage('')
    setRoleSavingId(userId)

    try {
      const response = await fetch(`${API_BASE}/api/users/admin/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: drafts[userId]?.role || 'student' }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || 'Failed to update role')
      }

      setMessage('User role updated successfully')
      await fetchUsers()
    } catch (err) {
      setError(err.message || 'Could not update role')
    } finally {
      setRoleSavingId('')
    }
  }

  const handleSaveStatus = async (userId) => {
    setError('')
    setMessage('')
    setStatusSavingId(userId)

    try {
      const payload = {
        isVerified: Boolean(drafts[userId]?.isVerified),
        department: drafts[userId]?.department || '',
      }

      const response = await fetch(`${API_BASE}/api/users/admin/${userId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || 'Failed to update user status')
      }

      setMessage('User account updated successfully')
      await fetchUsers()
    } catch (err) {
      setError(err.message || 'Could not update user')
    } finally {
      setStatusSavingId('')
    }
  }

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Delete this user account?')) return

    setError('')
    setMessage('')
    setDeletingId(userId)

    try {
      const response = await fetch(`${API_BASE}/api/users/admin/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete user')
      }

      setMessage('User deleted successfully')
      await fetchUsers()
    } catch (err) {
      setError(err.message || 'Could not delete user')
    } finally {
      setDeletingId('')
    }
  }

  if (!token) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Admin access required</h1>
        <p className="mt-2 text-sm text-slate-600">Please log in to open the admin panel.</p>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="h-32 animate-pulse rounded-3xl border border-slate-200 bg-slate-100" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-52 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {error}
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-lg sm:p-8">
        <div className="absolute -right-14 -top-14 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute bottom-0 left-0 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-200">Admin Console</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Manage user accounts</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-200">
              Review students, teachers, and admins in one place. Change roles, verify accounts, update departments,
              and remove accounts when needed.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-wider text-indigo-200">Signed in as</p>
            <p className="mt-1 text-sm font-semibold text-white">{currentUser?.name || 'Admin'}</p>
            <p className="text-xs text-indigo-100">{currentUser?.email}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-wider text-indigo-200">Users</p>
            <p className="mt-1 text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-wider text-indigo-200">Students</p>
            <p className="mt-1 text-2xl font-bold text-white">{stats.students}</p>
          </div>
          <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-wider text-indigo-200">Teachers</p>
            <p className="mt-1 text-2xl font-bold text-white">{stats.teachers}</p>
          </div>
          <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-wider text-indigo-200">Admins</p>
            <p className="mt-1 text-2xl font-bold text-white">{stats.admins}</p>
          </div>
        </div>
      </div>

      {message && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</p>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, username, email, or department"
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-600"
          />

          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  filter === option
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredUsers.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm md:col-span-2 xl:col-span-3">
            <h2 className="text-lg font-semibold text-slate-900">No users found</h2>
            <p className="mt-2 text-sm text-slate-600">Try changing the filter or search term.</p>
          </div>
        )}

        {filteredUsers.map((user) => {
          const draft = drafts[user._id] || { role: user.role, department: user.department || '', isVerified: user.isVerified }

          return (
            <article key={user._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">{user.name}</h2>
                  <p className="mt-1 text-xs text-slate-500">@{user.username}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${getRoleBadge(user.role)}`}>
                  {user.role}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>{user.email}</p>
                <p>Department: {user.department || 'Not set'}</p>
                <p>Status: {user.isVerified ? 'Verified' : 'Pending verification'}</p>
              </div>

              <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Role</label>
                  <select
                    value={draft.role}
                    onChange={(event) => updateDraft(user._id, 'role', event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleSaveRole(user._id)}
                    disabled={roleSavingId === user._id}
                    className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
                  >
                    {roleSavingId === user._id ? 'Saving role...' : 'Save Role'}
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Department</label>
                  <input
                    type="text"
                    value={draft.department}
                    onChange={(event) => updateDraft(user._id, 'department', event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                    placeholder="Department"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Verification</label>
                  <button
                    type="button"
                    onClick={() => updateDraft(user._id, 'isVerified', !draft.isVerified)}
                    className={`w-full rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      draft.isVerified
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    }`}
                  >
                    {draft.isVerified ? 'Verified' : 'Mark as verified'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveStatus(user._id)}
                    disabled={statusSavingId === user._id}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-70"
                  >
                    {statusSavingId === user._id ? 'Saving account...' : 'Save Account Status'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteUser(user._id)}
                  disabled={deletingId === user._id}
                  className="w-full rounded-lg bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-200 disabled:opacity-70"
                >
                  {deletingId === user._id ? 'Deleting...' : 'Delete Account'}
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export default AdminUsers
