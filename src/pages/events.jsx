import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_BASE_URL
const TOKEN_KEY = 'campuslyToken'

function formatDate(value) {
  const date = new Date(value)
  return date.toLocaleDateString([], {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatTime(value) {
  const date = new Date(value)
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isToday(dateString) {
  const date = new Date(dateString)
  const now = new Date()

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

function Events() {
  const [events, setEvents] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    date: '',
    location: '',
    maxAttendees: '',
    image: null,
  })
  const [deletingEventId, setDeletingEventId] = useState('')

  const token = localStorage.getItem(TOKEN_KEY) || ''

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    let isMounted = true

    const fetchEvents = async () => {
      setLoading(true)
      setError('')

      try {
        const [eventsRes, meRes] = await Promise.all([
          fetch(`${API_BASE}/api/events`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(`${API_BASE}/api/auth/me`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }),
        ])

        const data = await eventsRes.json()
        const meData = await meRes.json()

        if (!eventsRes.ok) {
          throw new Error(data.message || 'Failed to load events')
        }
        if (!meRes.ok) {
          throw new Error(meData.message || 'Failed to load user')
        }

        if (!isMounted) return

        const list = Array.isArray(data.events) ? data.events : []
        setEvents(list)
        setCurrentUser(meData.user || null)
      } catch (err) {
        if (!isMounted) return
        setError(err.message || 'Could not fetch events')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchEvents()

    return () => {
      isMounted = false
    }
  }, [token])

  const stats = useMemo(() => {
    const now = new Date()

    const todayCount = events.filter((item) => isToday(item.date)).length
    const upcomingCount = events.filter((item) => new Date(item.date) >= now).length

    return {
      total: events.length,
      today: todayCount,
      upcoming: upcomingCount,
    }
  }, [events])

  const getEntityId = (value) => value?._id || value?.id || value || ''

  const filteredEvents = useMemo(() => {
    const now = new Date()
    return events
      .filter((item) => {
        const query = search.trim().toLowerCase()
        if (!query) return true

        const haystack = `${item.title || ''} ${item.description || ''} ${item.location || ''}`.toLowerCase()
        return haystack.includes(query)
      })
      .filter((item) => {
        if (filter === 'today') return isToday(item.date)
        if (filter === 'upcoming') return new Date(item.date) >= now
        if (filter === 'past') return new Date(item.date) < now
        return true
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))
  }, [events, search, filter])

  const canCreateEvent = currentUser?.role === 'teacher' || currentUser?.role === 'admin'
  const canDeleteEvent = (item) => currentUser?.role === 'admin' || getEntityId(item.createdBy) === currentUser?.id

  const refreshEvents = async () => {
    const response = await fetch(`${API_BASE}/api/events`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'Failed to load events')
    }

    setEvents(Array.isArray(data.events) ? data.events : [])
  }

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Delete this event?')) return

    setError('')
    setDeletingEventId(eventId)

    try {
      const response = await fetch(`${API_BASE}/api/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete event')
      }

      await refreshEvents()
    } catch (err) {
      setError(err.message || 'Could not delete event')
    } finally {
      setDeletingEventId('')
    }
  }

  const handleCreateEvent = async (event) => {
    event.preventDefault()
    setCreateError('')
    setCreating(true)

    try {
      const formData = new FormData()
      formData.append('title', createForm.title)
      formData.append('description', createForm.description)
      formData.append('date', new Date(createForm.date).toISOString())
      formData.append('location', createForm.location)
      if (createForm.maxAttendees) {
        formData.append('maxAttendees', createForm.maxAttendees)
      }
      if (currentUser?.department) {
        formData.append('department', currentUser.department)
      }
      if (createForm.image) {
        formData.append('image', createForm.image)
      }

      const response = await fetch(`${API_BASE}/api/events`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create event')
      }

      await refreshEvents()
      setShowCreateModal(false)
      setCreateForm({
        title: '',
        description: '',
        date: '',
        location: '',
        maxAttendees: '',
        image: null,
      })
    } catch (err) {
      setCreateError(err.message || 'Could not create event')
    } finally {
      setCreating(false)
    }
  }

  if (!token) {
    return (
      <section className="relative overflow-hidden rounded-3xl border border-orange-200 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-100 p-8 shadow-sm">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-orange-300/30 blur-3xl" />
        <div className="absolute -bottom-20 left-0 h-56 w-56 rounded-full bg-rose-300/20 blur-3xl" />

        <div className="relative">
          <p className="inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-orange-700">
            Events Portal
          </p>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Sign in to unlock campus events
          </h1>
          <p className="mt-3 max-w-xl text-sm text-slate-700">
            Your event schedule is personalized. Login or create an account to view today's activities,
            upcoming sessions, and department happenings.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/"
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Go to Login
            </Link>
            <Link
              to="/"
              className="rounded-xl border border-slate-300 bg-white/90 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white"
            >
              Create Account
            </Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-teal-200 bg-gradient-to-r from-teal-700 via-cyan-700 to-blue-700 p-6 text-white shadow-lg sm:p-8">
        <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/20" />
        <div className="absolute bottom-0 left-1/3 h-24 w-24 rounded-full bg-cyan-200/30 blur-2xl" />

        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">Campusly Planner</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Events Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm text-cyan-100">
            Keep track of events happening today and what's coming next across campus.
          </p>

          {canCreateEvent && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="mt-5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-50"
            >
              + Create Event
            </button>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white/15 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-wider text-cyan-100">Total</p>
              <p className="mt-1 text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="rounded-xl bg-white/15 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-wider text-cyan-100">Today</p>
              <p className="mt-1 text-2xl font-bold">{stats.today}</p>
            </div>
            <div className="rounded-xl bg-white/15 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-wider text-cyan-100">Upcoming</p>
              <p className="mt-1 text-2xl font-bold">{stats.upcoming}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title, description, or location"
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-cyan-600"
          />

          <div className="flex flex-wrap gap-2">
            {['all', 'today', 'upcoming', 'past'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFilter(type)}
                className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  filter === type
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>
      )}

      {!loading && !error && filteredEvents.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">No events found</h2>
          <p className="mt-2 text-sm text-slate-600">
            Try a different search keyword or switch your current filter.
          </p>
        </div>
      )}

      {!loading && !error && filteredEvents.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((event) => (
            <article
              key={event._id}
              className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">{event.title}</h2>
                  <p className="mt-1 text-xs text-slate-500">By {event.createdBy?.name || 'Teacher'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isToday(event.date) && (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                      Today
                    </span>
                  )}
                  {canDeleteEvent(event) && (
                    <button
                      type="button"
                      onClick={() => handleDeleteEvent(event._id)}
                      disabled={deletingEventId === event._id}
                      className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-700 transition hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingEventId === event._id ? 'Deleting...' : 'Delete'}
                    </button>
                  )}
                </div>
              </div>

              <p className="mt-2 line-clamp-3 text-sm text-slate-600">{event.description}</p>

              <div className="mt-4 space-y-1 text-xs text-slate-500">
                <p>
                  <span className="font-semibold text-slate-700">Date:</span> {formatDate(event.date)}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Time:</span> {formatTime(event.date)}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Location:</span> {event.location || 'TBA'}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Department:</span> {event.department || 'General'}
                </p>
              </div>

              <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {event.attendees?.length || 0} registered
                {event.maxAttendees ? ` / ${event.maxAttendees} max` : ''}
              </div>
            </article>
          ))}
        </div>
      )}

      {showCreateModal && canCreateEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4 sm:px-8">
              <h2 className="text-xl font-bold text-slate-900">Create Event</h2>
              <p className="mt-1 text-sm text-slate-600">Publish a new campus event</p>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4 p-6 sm:p-8">
              {createError && (
                <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{createError}</p>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Title</label>
                <input
                  type="text"
                  required
                  value={createForm.title}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Description</label>
                <textarea
                  required
                  rows={3}
                  value={createForm.description}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Date &amp; Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={createForm.date}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, date: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Location</label>
                  <input
                    type="text"
                    required
                    value={createForm.location}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, location: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Max Attendees</label>
                  <input
                    type="number"
                    min="1"
                    value={createForm.maxAttendees}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, maxAttendees: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Image (optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, image: e.target.files?.[0] || null }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:opacity-70"
                >
                  {creating ? 'Creating...' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

export default Events