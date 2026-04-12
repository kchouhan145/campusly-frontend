import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_BASE_URL
const TOKEN_KEY = 'campuslyToken'
const CATEGORIES = [
  { value: 'books', label: 'Books' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'others', label: 'Other' },
]

const initialFormState = {
  title: '',
  description: '',
  price: '',
  category: 'books',
  contactInfo: '',
  status: 'available',
  images: [],
}

function formatPrice(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(value)
}

function formatDate(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable'
  }

  return date.toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function Marketplace() {
  const [products, setProducts] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [statusFilter, setStatusFilter] = useState('available')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState(initialFormState)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')
  const [actionError, setActionError] = useState('')
  const [sellingId, setSellingId] = useState('')
  const [deletingId, setDeletingId] = useState('')

  const token = localStorage.getItem(TOKEN_KEY) || ''

  const getEntityId = (value) => value?._id || value?.id || value || ''

  const canManageProduct = (product) => {
    const sellerId = getEntityId(product.sellerId)
    return currentUser?.role === 'admin' || sellerId === currentUser?.id
  }

  const refreshProducts = async () => {
    const params = new URLSearchParams()

    if (categoryFilter !== 'all') {
      params.append('category', categoryFilter)
    }

    if (statusFilter) {
      params.append('status', statusFilter)
    }

    if (priceMin) {
      params.append('minPrice', priceMin)
    }

    if (priceMax) {
      params.append('maxPrice', priceMax)
    }

    if (search.trim()) {
      params.append('q', search.trim())
    }

    const response = await fetch(`${API_BASE}/api/products?${params.toString()}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Failed to load products')
    }

    setProducts(Array.isArray(data.products) ? data.products : [])
  }

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    let isMounted = true

    const fetchProducts = async () => {
      setLoading(true)
      setError('')

      try {
        const [meRes] = await Promise.all([
          fetch(`${API_BASE}/api/auth/me`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }),
          refreshProducts(),
        ])

        const meData = await meRes.json()

        if (!meRes.ok) {
          throw new Error(meData.message || 'Failed to load user')
        }

        if (!isMounted) return
        setCurrentUser(meData.user || null)
      } catch (err) {
        if (!isMounted) return
        setError(err.message || 'Could not fetch products')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchProducts()

    return () => {
      isMounted = false
    }
  }, [token, categoryFilter, statusFilter, priceMin, priceMax, search])

  const handleMarkSold = async (productId) => {
    setActionError('')
    setSellingId(productId)

    try {
      const response = await fetch(`${API_BASE}/api/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'sold' }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to mark product as sold')
      }

      await refreshProducts()
    } catch (err) {
      setActionError(err.message || 'Could not update product status')
    } finally {
      setSellingId('')
    }
  }

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Delete this product post?')) return

    setActionError('')
    setDeletingId(productId)

    try {
      const response = await fetch(`${API_BASE}/api/products/${productId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete product')
      }

      await refreshProducts()
    } catch (err) {
      setActionError(err.message || 'Could not delete product')
    } finally {
      setDeletingId('')
    }
  }

  const stats = useMemo(() => {
    return {
      total: products.length,
      available: products.filter((p) => p.status === 'available').length,
      sold: products.filter((p) => p.status === 'sold').length,
    }
  }, [products])

  const handleCreateProduct = async (e) => {
    e.preventDefault()
    setCreateError('')
    setCreateSuccess('')
    setCreateLoading(true)

    try {
      if (!createForm.title.trim() || !createForm.description.trim() || !createForm.price || !createForm.contactInfo.trim()) {
        throw new Error('Please fill in all required fields')
      }

      if (createForm.title.trim().length < 3) {
        throw new Error('Title must be at least 3 characters long')
      }

      if (createForm.description.trim().length < 10) {
        throw new Error('Description must be at least 10 characters long')
      }

      if (parseFloat(createForm.price) <= 0) {
        throw new Error('Price must be greater than 0')
      }

      if (createForm.contactInfo.trim().length < 5) {
        throw new Error('Contact info must be at least 5 characters long')
      }

      const response = await fetch(`${API_BASE}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: createForm.title,
          description: createForm.description,
          price: parseFloat(createForm.price),
          category: createForm.category,
          contactInfo: createForm.contactInfo.trim(),
          status: createForm.status,
          images: createForm.images,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create product')
      }

      setCreateSuccess('Product added successfully!')
      setCreateForm(initialFormState)

      setTimeout(() => {
        setShowCreateModal(false)
        setCreateSuccess('')
        // Refetch products
        const params = new URLSearchParams()
        if (categoryFilter !== 'all') params.append('category', categoryFilter)
        if (statusFilter) params.append('status', statusFilter)
        if (priceMin) params.append('minPrice', priceMin)
        if (priceMax) params.append('maxPrice', priceMax)
        if (search.trim()) params.append('q', search.trim())

        fetch(`${API_BASE}/api/products?${params.toString()}`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        })
          .then((res) => res.json())
          .then((resData) => {
            if (resData.products) {
              setProducts(Array.isArray(resData.products) ? resData.products : [])
            }
          })
          .catch(() => {})
      }, 1500)
    } catch (err) {
      setCreateError(err.message || 'Failed to create product')
    } finally {
      setCreateLoading(false)
    }
  }

  if (!token) {
    return (
      <section className="relative overflow-hidden rounded-3xl border border-green-200 bg-gradient-to-br from-emerald-50 via-green-50 to-teal-100 p-8 shadow-sm">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-green-300/30 blur-3xl" />
        <div className="absolute -bottom-20 left-0 h-56 w-56 rounded-full bg-teal-300/20 blur-3xl" />

        <div className="relative">
          <p className="inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-green-700">
            Marketplace
          </p>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Buy and sell on campus
          </h1>
          <p className="mt-3 max-w-xl text-sm text-slate-700">
            Login to browse books, electronics, and other items from your campus community. Buy what you need or sell items you no longer use.
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
      <div className="relative overflow-hidden rounded-3xl border border-green-200 bg-gradient-to-r from-green-700 via-emerald-700 to-teal-700 p-6 text-white shadow-lg sm:p-8">
        <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/20" />
        <div className="absolute bottom-0 left-1/3 h-24 w-24 rounded-full bg-teal-200/30 blur-2xl" />

        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-100">Online Store</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Marketplace</h1>
          <p className="mt-2 max-w-2xl text-sm text-teal-100">
            Discover quality items from your campus community. Buy, sell, and trade with fellow students and staff.
          </p>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="mt-6 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-green-700 transition hover:bg-green-50"
          >
            + Sell Item
          </button>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white/15 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-wider text-teal-100">Total Items</p>
              <p className="mt-1 text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="rounded-xl bg-white/15 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-wider text-teal-100">Available</p>
              <p className="mt-1 text-2xl font-bold">{stats.available}</p>
            </div>
            <div className="rounded-xl bg-white/15 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-wider text-teal-100">Sold</p>
              <p className="mt-1 text-2xl font-bold">{stats.sold}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by title or description"
          className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-green-600"
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-green-600"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-green-600"
            >
              <option value="available">Available</option>
              <option value="sold">Sold</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">Min Price (₹)</label>
            <input
              type="number"
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-green-600"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">Max Price (₹)</label>
            <input
              type="number"
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
              placeholder="No limit"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-green-600"
            />
          </div>
        </div>
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-56 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>
      )}

      {actionError && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{actionError}</p>
      )}

      {!loading && !error && products.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">No products found</h2>
          <p className="mt-2 text-sm text-slate-600">
            Try adjusting your filters or search terms.
          </p>
        </div>
      )}

      {!loading && !error && products.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <article
              key={product._id}
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="aspect-video overflow-hidden bg-slate-100">
                {product.images && product.images.length > 0 ? (
                  <img
                    src={product.images[0]}
                    alt={product.title}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300">
                    <span className="text-lg font-bold text-slate-400">No Image</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col p-3">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                      product.status === 'available'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {product.status}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {CATEGORIES.find((cat) => cat.value === product.category)?.label || product.category}
                  </span>
                </div>

                <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-slate-900">{product.title}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-slate-600">{product.description}</p>

                <div className="mt-3 flex items-end justify-between border-t border-slate-200 pt-2">
                  <div>
                    <p className="text-lg font-bold text-green-700">{formatPrice(product.price)}</p>
                    <p className="text-[10px] text-slate-500">By {product.sellerId?.name || 'Unknown'}</p>
                    <p className="mt-1 text-[10px] text-slate-500">
                      Contact: {product.contactInfo || 'Not provided'}
                    </p>
                  </div>
                </div>

                <p className="mt-2 text-[10px] text-slate-400">{formatDate(product.createdAt)}</p>

                {canManageProduct(product) && (
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-200 pt-2">
                    <button
                      type="button"
                      onClick={() => handleMarkSold(product._id)}
                      disabled={product.status === 'sold' || sellingId === product._id}
                      className="rounded-md bg-amber-100 px-2 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {sellingId === product._id ? 'Updating...' : product.status === 'sold' ? 'Sold' : 'Mark Sold'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(product._id)}
                      disabled={deletingId === product._id}
                      className="rounded-md bg-rose-100 px-2 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingId === product._id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
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
              <h2 className="text-xl font-bold text-slate-900">Sell an Item</h2>
              <p className="mt-1 text-sm text-slate-600">List your item on the campus marketplace</p>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4 p-6 sm:p-8">
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
                  <label className="block text-sm font-semibold text-slate-700">Title</label>
                  <input
                    type="text"
                    value={createForm.title}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Used Laptop, Novel Book"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-600"
                    required
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700">Description</label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe your item in detail"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-600"
                    rows={3}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Price (₹)</label>
                  <input
                    type="number"
                    value={createForm.price}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, price: e.target.value }))}
                    placeholder="0"
                    min="1"
                    step="0.01"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-600"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Category</label>
                  <select
                    value={createForm.category}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-600"
                    required
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700">Contact Information</label>
                  <input
                    type="text"
                    value={createForm.contactInfo}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, contactInfo: e.target.value }))}
                    placeholder="Phone number, email, or WhatsApp"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-600"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Status</label>
                  <select
                    value={createForm.status}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, status: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-600"
                  >
                    <option value="available">Available</option>
                    <option value="sold">Sold</option>
                  </select>
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
                  className="flex-1 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-800 disabled:opacity-70"
                >
                  {createLoading ? 'Adding...' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

export default Marketplace