import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_BASE_URL
const TOKEN_KEY = 'campuslyToken'

function formatDate(value) {
  const date = new Date(value)
  return date.toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const initialFormState = {
  type: 'lost',
  title: '',
  description: '',
  location: '',
  contactInfo: '',
  image: null,
}

function LostFound() {
  const [posts, setPosts] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [resolvedFilter, setResolvedFilter] = useState('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState(initialFormState)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')
  const [deletingPostId, setDeletingPostId] = useState('')

  const token = localStorage.getItem(TOKEN_KEY) || ''

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    let isMounted = true

    const fetchPosts = async () => {
      setLoading(true)
      setError('')

      try {
        const params = new URLSearchParams()

        if (typeFilter !== 'all') {
          params.append('type', typeFilter)
        }

        if (resolvedFilter !== 'all') {
          params.append('resolved', resolvedFilter === 'resolved' ? 'true' : 'false')
        }

        if (search.trim()) {
          params.append('q', search.trim())
        }

        const [postsRes, meRes] = await Promise.all([
          fetch(`${API_BASE}/api/posts?${params.toString()}`, {
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

        const data = await postsRes.json()
        const meData = await meRes.json()

        if (!postsRes.ok) {
          throw new Error(data.message || 'Failed to load posts')
        }
        if (!meRes.ok) {
          throw new Error(meData.message || 'Failed to load user')
        }

        if (!isMounted) return

        const list = Array.isArray(data.posts) ? data.posts : []
        setPosts(list)
        setCurrentUser(meData.user || null)
      } catch (err) {
        if (!isMounted) return
        setError(err.message || 'Could not fetch posts')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchPosts()

    return () => {
      isMounted = false
    }
  }, [token, typeFilter, resolvedFilter, search])

  const handleCreatePost = async (e) => {
    e.preventDefault()
    setCreateError('')
    setCreateSuccess('')
    setCreateLoading(true)

    try {
      if (!createForm.title.trim() || !createForm.description.trim() || !createForm.location.trim() || !createForm.contactInfo.trim()) {
        throw new Error('Please fill in all required fields')
      }

      const formData = new FormData()
      formData.append('type', createForm.type)
      formData.append('title', createForm.title)
      formData.append('description', createForm.description)
      formData.append('location', createForm.location)
      formData.append('contactInfo', createForm.contactInfo)

      if (createForm.image) {
        formData.append('image', createForm.image)
      }

      const response = await fetch(`${API_BASE}/api/posts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create post')
      }

      setCreateSuccess('Post created successfully!')
      setCreateForm(initialFormState)

      setTimeout(() => {
        setShowCreateModal(false)
        setCreateSuccess('')
        // Refetch posts
        const params = new URLSearchParams()
        if (typeFilter !== 'all') params.append('type', typeFilter)
        if (resolvedFilter !== 'all') params.append('resolved', resolvedFilter === 'resolved' ? 'true' : 'false')
        if (search.trim()) params.append('q', search.trim())

        fetch(`${API_BASE}/api/posts?${params.toString()}`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        })
          .then((res) => res.json())
          .then((resData) => {
            if (resData.posts) {
              setPosts(Array.isArray(resData.posts) ? resData.posts : [])
            }
          })
          .catch(() => {})
      }, 1500)
    } catch (err) {
      setCreateError(err.message || 'Failed to create post')
    } finally {
      setCreateLoading(false)
    }
  }

  const getEntityId = (value) => value?._id || value?.id || value || ''

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Delete this post?')) return

    setError('')
    setDeletingPostId(postId)

    try {
      const response = await fetch(`${API_BASE}/api/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete post')
      }

      const params = new URLSearchParams()
      if (typeFilter !== 'all') params.append('type', typeFilter)
      if (resolvedFilter !== 'all') params.append('resolved', resolvedFilter === 'resolved' ? 'true' : 'false')
      if (search.trim()) params.append('q', search.trim())

      const refreshRes = await fetch(`${API_BASE}/api/posts?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      const refreshData = await refreshRes.json()

      if (!refreshRes.ok) {
        throw new Error(refreshData.message || 'Failed to refresh posts')
      }

      setPosts(Array.isArray(refreshData.posts) ? refreshData.posts : [])
    } catch (err) {
      setError(err.message || 'Could not delete post')
    } finally {
      setDeletingPostId('')
    }
  }

  const stats = useMemo(() => {
    const lostCount = posts.filter((p) => p.type === 'lost').length
    const foundCount = posts.filter((p) => p.type === 'found').length
    const activeCount = posts.filter((p) => !p.isResolved).length

    return {
      total: posts.length,
      lost: lostCount,
      found: foundCount,
      active: activeCount,
    }
  }, [posts])

  const canDeletePost = (post) => {
    return currentUser?.role === 'admin' || getEntityId(post.userId) === currentUser?.id
  }

  if (!token) {
    return (
      <section className="relative overflow-hidden rounded-3xl border border-blue-200 bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-100 p-8 shadow-sm">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-300/30 blur-3xl" />
        <div className="absolute -bottom-20 left-0 h-56 w-56 rounded-full bg-purple-300/20 blur-3xl" />

        <div className="relative">
          <p className="inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
            Lost &amp; Found
          </p>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Find your lost items
          </h1>
          <p className="mt-3 max-w-xl text-sm text-slate-700">
            Login to browse lost and found items from your campus community. Help others reunite with their belongings.
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
      <div className="relative overflow-hidden rounded-3xl border border-indigo-200 bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-700 p-6 text-white shadow-lg sm:p-8">
        <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/20" />
        <div className="absolute bottom-0 left-1/3 h-24 w-24 rounded-full bg-purple-200/30 blur-2xl" />

        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-100">Community Board</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Lost &amp; Found</h1>
          <p className="mt-2 max-w-2xl text-sm text-purple-100">
            Help the campus community. Browse items that were lost and found, or post about your missing belongings.
          </p>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="mt-6 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-purple-700 transition hover:bg-purple-50"
          >
            + Create Post
          </button>

          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-white/15 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-wider text-purple-100">Total Posts</p>
              <p className="mt-1 text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="rounded-xl bg-white/15 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-wider text-purple-100">Lost</p>
              <p className="mt-1 text-2xl font-bold">{stats.lost}</p>
            </div>
            <div className="rounded-xl bg-white/15 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-wider text-purple-100">Found</p>
              <p className="mt-1 text-2xl font-bold">{stats.found}</p>
            </div>
            <div className="rounded-xl bg-white/15 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-wider text-purple-100">Active</p>
              <p className="mt-1 text-2xl font-bold">{stats.active}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by item title, description, or location"
          className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-600"
        />

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">Type</label>
            <div className="flex flex-wrap gap-2">
              {['all', 'lost', 'found'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTypeFilter(type)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                    typeFilter === type
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">Status</label>
            <div className="flex flex-wrap gap-2">
              {['all', 'active', 'resolved'].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setResolvedFilter(status)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                    resolvedFilter === status
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>
      )}

      {!loading && !error && posts.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">No posts found</h2>
          <p className="mt-2 text-sm text-slate-600">
            Try adjusting your search or filters to find what you&apos;re looking for.
          </p>
        </div>
      )}

      {!loading && !error && posts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <article
              key={post._id}
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              {post.image && (
                <div className="aspect-video overflow-hidden bg-slate-100">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                </div>
              )}

              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                        post.type === 'lost'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {post.type}
                    </span>
                    {post.isResolved && (
                      <span className="ml-2 inline-flex rounded-full bg-slate-200 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-700">
                        Resolved
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="mt-3 text-base font-semibold text-slate-900">{post.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{post.description}</p>

                <div className="mt-4 space-y-1.5 border-t border-slate-200 pt-3 text-xs text-slate-600">
                  <p>
                    <span className="font-semibold text-slate-700">Location:</span> {post.location || 'Not specified'}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Posted:</span> {formatDate(post.createdAt)}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">By:</span> {post.userId?.name || 'Unknown'}
                  </p>
                </div>

                <div className="mt-3 rounded-lg bg-slate-50 p-2.5">
                  <p className="text-xs font-semibold text-slate-700">Contact Info</p>
                  <p className="mt-1 break-all text-xs text-slate-600">{post.contactInfo}</p>
                </div>

                {canDeletePost(post) && (
                  <button
                    type="button"
                    onClick={() => handleDeletePost(post._id)}
                    disabled={deletingPostId === post._id}
                    className="mt-3 w-full rounded-lg bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {deletingPostId === post._id ? 'Deleting...' : 'Delete Post'}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4 sm:px-8">
              <h2 className="text-xl font-bold text-slate-900">Create Lost &amp; Found Post</h2>
              <p className="mt-1 text-sm text-slate-600">Share details about a lost or found item on campus</p>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-4 p-6 sm:p-8">
              {createError && (
                <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{createError}</p>
              )}
              {createSuccess && (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                  {createSuccess}
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700">Item Type</label>
                  <select
                    value={createForm.type}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, type: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                    required
                  >
                    <option value="lost">Lost</option>
                    <option value="found">Found</option>
                  </select>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700">Title</label>
                  <input
                    type="text"
                    value={createForm.title}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Blue Backpack, Gold Watch"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                    required
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700">Description</label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the item in detail (color, brand, distinctive marks, etc.)"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                    rows={3}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Location</label>
                  <input
                    type="text"
                    value={createForm.location}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, location: e.target.value }))}
                    placeholder="e.g., Library, Cafeteria"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Contact Info</label>
                  <input
                    type="text"
                    value={createForm.contactInfo}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, contactInfo: e.target.value }))}
                    placeholder="Phone or email"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                    required
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700">Image (Optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, image: e.target.files?.[0] || null }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:rounded file:border-0 file:bg-indigo-100 file:px-3 file:py-1 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-200"
                  />
                  {createForm.image && (
                    <p className="text-xs text-slate-600">Selected: {createForm.image.name}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setCreateForm(initialFormState)
                    setCreateError('')
                    setCreateSuccess('')
                  }}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="flex-1 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-800 disabled:opacity-70"
                >
                  {createLoading ? 'Creating...' : 'Create Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

export default LostFound