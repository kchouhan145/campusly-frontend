import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createAvatar } from '@dicebear/core'
import { avataaars } from '@dicebear/collection'

const API_BASE = import.meta.env.VITE_API_BASE_URL
const TOKEN_KEY = 'campuslyToken'

function generateAvatarSvg(seed, gender = 'male') {
  try {
    const avatar = createAvatar(avataaars, {
      seed,
      gender: gender === 'female' ? 'female' : 'male',
    })
    return avatar.toDataUri()
  } catch (error) {
    console.error('Avatar generation error:', error)
    return null
  }
}

function getRoleColor(role) {
  const colors = {
    admin: 'bg-rose-100 text-rose-700',
    teacher: 'bg-amber-100 text-amber-700',
    student: 'bg-blue-100 text-blue-700',
  }
  return colors[role] || 'bg-slate-100 text-slate-700'
}

function Profile() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    bio: '',
    phone: '',
    department: '',
    gender: 'male',
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')
  const [searchUsers, setSearchUsers] = useState('')

  const token = localStorage.getItem(TOKEN_KEY) || ''

  useEffect(() => {
    if (!token) {
      navigate('/')
      return
    }

    let isMounted = true

    const fetchData = async () => {
      setLoading(true)
      setError('')

      try {
        const [profileRes, usersRes] = await Promise.all([
          fetch(`${API_BASE}/api/users/profile`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(`${API_BASE}/api/users`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }),
        ])

        if (!profileRes.ok) {
          throw new Error('Failed to load profile')
        }

        if (!usersRes.ok) {
          throw new Error('Failed to load users')
        }

        const profileData = await profileRes.json()
        const usersData = await usersRes.json()

        if (!isMounted) return

        setUser(profileData.user || null)
        setEditForm({
          name: profileData.user?.name || '',
          bio: profileData.user?.bio || '',
          phone: profileData.user?.phone || '',
          department: profileData.user?.department || '',
          gender: profileData.user?.gender || 'male',
        })
        setUsers(Array.isArray(usersData.users) ? usersData.users : [])
      } catch (err) {
        if (!isMounted) return
        setError(err.message || 'Failed to load profile')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchData()

    return () => {
      isMounted = false
    }
  }, [token, navigate])

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setSaveError('')
    setSaveSuccess('')
    setSaving(true)

    try {
      const response = await fetch(`${API_BASE}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update profile')
      }

      setSaveSuccess('Profile updated successfully!')
      setUser(data.user)
      setIsEditing(false)

      setTimeout(() => setSaveSuccess(''), 3000)
    } catch (err) {
      setSaveError(err.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY)
    navigate('/')
  }

  const filteredUsers = users.filter((u) => {
    const query = searchUsers.toLowerCase()
    return (
      u.name.toLowerCase().includes(query) ||
      u.username.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query)
    )
  })

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 lg:col-span-2" />
          <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section>
        <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>
      </section>
    )
  }

  if (!user) {
    return (
      <section>
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No user data found. Please try logging in again.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-purple-200 bg-gradient-to-r from-purple-700 via-pink-700 to-rose-700 p-6 text-white shadow-lg sm:p-8">
        <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/20" />
        <div className="absolute bottom-0 left-1/3 h-24 w-24 rounded-full bg-pink-200/30 blur-2xl" />

        <div className="relative">
          <div className="flex items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <img
                src={generateAvatarSvg(user.username, user.gender) || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3C/svg%3E'}
                alt={user.name}
                className="h-20 w-20 rounded-full border-4 border-white shadow-lg"
              />
              <div>
                <h1 className="text-3xl font-black tracking-tight">{user.name}</h1>
                <p className="mt-1 text-purple-100">@{user.username}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/30"
            >
              Logout
            </button>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${getRoleColor(user.role)}`}>
              {user.role}
            </span>
            {user.isVerified && (
              <span className="rounded-full bg-emerald-100/30 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-100">
                ✓ Verified
              </span>
            )}
            {user.department && (
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                {user.department}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <article className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Profile Information</h2>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="rounded-lg bg-purple-100 px-3 py-1.5 text-sm font-semibold text-purple-700 transition hover:bg-purple-200"
              >
                {isEditing ? 'Cancel' : 'Edit Profile'}
              </button>
            </div>

            {saveError && (
              <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {saveError}
              </p>
            )}
            {saveSuccess && (
              <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                {saveSuccess}
              </p>
            )}

            {!isEditing ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</p>
                    <p className="mt-1 text-sm text-slate-900">{user.email}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Department</p>
                    <p className="mt-1 text-sm text-slate-900">{user.department || 'Not specified'}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</p>
                  <p className="mt-1 text-sm text-slate-900">{user.phone || 'Not provided'}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bio</p>
                  <p className="mt-1 text-sm text-slate-700">{user.bio || 'No bio added yet'}</p>
                </div>

                <div className="grid grid-cols-3 gap-3 border-t border-slate-200 pt-4">
                  <div className="text-center">
                    <p className="text-lg font-bold text-purple-700">{user.role}</p>
                    <p className="text-xs text-slate-600">Role</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-blue-700">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-slate-600">Joined</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-emerald-700">
                      {user.isVerified ? 'Yes' : 'No'}
                    </p>
                    <p className="text-xs text-slate-600">Verified</p>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid gaps-3 gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700">Full Name</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-purple-600"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">Department</label>
                    <input
                      type="text"
                      value={editForm.department}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, department: e.target.value }))}
                      placeholder="e.g., MCA, CSE"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-purple-600"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">Phone</label>
                    <input
                      type="text"
                      value={editForm.phone}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="+91-9876543210"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-purple-600"
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700">Bio</label>
                    <textarea
                      value={editForm.bio}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, bio: e.target.value }))}
                      placeholder="Tell us about yourself"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-purple-600"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700">Gender</label>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="gender"
                          value="male"
                          checked={editForm.gender === 'male'}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, gender: e.target.value }))}
                          className="rounded"
                        />
                        <span className="text-sm text-slate-700">Male</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="gender"
                          value="female"
                          checked={editForm.gender === 'female'}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, gender: e.target.value }))}
                          className="rounded"
                        />
                        <span className="text-sm text-slate-700">Female</span>
                      </label>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <span className="text-sm text-slate-600">Preview:</span>
                      <img
                        src={generateAvatarSvg(user.username, editForm.gender) || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3C/svg%3E'}
                        alt="Avatar preview"
                        className="h-12 w-12 rounded-full border border-slate-300"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-800 disabled:opacity-70"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900">Account Details</h3>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Username</p>
              <p className="mt-1 font-mono text-sm text-slate-900">@{user.username}</p>
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Email</p>
              <p className="mt-1 font-mono text-xs text-slate-700">{user.email}</p>
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Member Since</p>
              <p className="mt-1 text-sm text-slate-900">
                {new Date(user.createdAt).toLocaleDateString('en-IN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </article>
      </div>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900">Campus Community</h3>
        <p className="mt-1 text-sm text-slate-600">Find and connect with other users on campus</p>

        <div className="mt-4">
          <input
            type="text"
            value={searchUsers}
            onChange={(e) => setSearchUsers(e.target.value)}
            placeholder="Search by name, username, or email"
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm outline-none focus:border-purple-600"
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {filteredUsers.length === 0 && (
            <p className="col-span-full text-center text-sm text-slate-500">No users found</p>
          )}
          {filteredUsers.map((u) => (
            <div key={u._id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 truncate">
                  <p className="truncate font-semibold text-slate-900">{u.name}</p>
                  <p className="truncate text-xs text-slate-600">@{u.username}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${getRoleColor(u.role)}`}>
                  {u.role}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">{u.email}</p>
              {u.department && (
                <p className="mt-1 text-xs text-slate-600">Dept: {u.department}</p>
              )}
              {u.isVerified && (
                <p className="mt-1 text-xs font-semibold text-emerald-700">✓ Verified</p>
              )}
            </div>
          ))}
        </div>
      </article>
    </section>
  )
}

export default Profile