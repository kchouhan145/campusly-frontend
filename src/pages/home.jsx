import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

const API_BASE = import.meta.env.VITE_API_BASE_URL
const TOKEN_KEY = 'campuslyToken'
const ROLE_KEY = 'campuslyUserRole'
const STUDENT_DEPARTMENTS = ['DCSA', 'History', 'Mathematics','Physics', 'Other']

const initialSignupState = {
  username: '',
  name: '',
  email: '',
  password: '',
  department: 'DCSA',
  customDepartment: '',
  role: 'student',
}

const initialAnnouncementForm = {
  title: '',
  content: '',
  priority: 'normal',
  pinned: false,
  image: null,
}

const initialEventForm = {
  title: '',
  description: '',
  date: '',
  location: '',
  maxAttendees: '',
  image: null,
}

const dashboardCopy = {
  student: {
    eyebrow: 'Student Dashboard',
    title: 'Stay on top of classes and campus updates',
    description: 'Track important announcements, events today, and your active chats.',
  },
  teacher: {
    eyebrow: 'Teacher Dashboard',
    title: 'Manage your department from one place',
    description: 'Post announcements, create events, and monitor your latest activity.',
  },
  admin: {
    eyebrow: 'Admin Dashboard',
    title: 'Campus-wide overview and moderation',
    description: 'Monitor announcements, events, and live conversations across campus.',
  },
}

function Home() {
  const [activeAuthTab, setActiveAuthTab] = useState('login')
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || '')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [signupForm, setSignupForm] = useState(initialSignupState)
  const [otpForm, setOtpForm] = useState({ email: '', otp: '' })
  const [showOtp, setShowOtp] = useState(false)

  const [announcements, setAnnouncements] = useState([])
  const [events, setEvents] = useState([])
  const [todayEvents, setTodayEvents] = useState([])
  const [notifications, setNotifications] = useState([])
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
  const [announcementForm, setAnnouncementForm] = useState(initialAnnouncementForm)
  const [announcementLoading, setAnnouncementLoading] = useState(false)
  const [announcementError, setAnnouncementError] = useState('')
  const [announcementSuccess, setAnnouncementSuccess] = useState('')
  const [showEventModal, setShowEventModal] = useState(false)
  const [eventForm, setEventForm] = useState(initialEventForm)
  const [eventLoading, setEventLoading] = useState(false)
  const [eventError, setEventError] = useState('')
  const [eventSuccess, setEventSuccess] = useState('')
  const [announcementDeletingId, setAnnouncementDeletingId] = useState('')
  const [eventDeletingId, setEventDeletingId] = useState('')
  const [notificationPermission, setNotificationPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  )

  const hasBootstrappedRef = useRef(false)
  const previousImportantAnnouncementIdsRef = useRef([])
  const previousChatSnapshotRef = useRef(new Map())

  const handleApiError = async (response) => {
    let messageText = 'Something went wrong'
    try {
      const data = await response.json()
      messageText = data.message || messageText
    } catch {
      messageText = response.statusText || messageText
    }
    throw new Error(messageText)
  }

  const notifyBrowser = (title, body) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return

    try {
      new Notification(title, { body })
    } catch (notificationError) {
      console.error('Notification error:', notificationError)
    }
  }

  const getChatSignature = (chat) => {
    const senderId = chat?.senderId?._id || chat?.senderId?.id || chat?.senderId || ''
    const message = chat?.message || ''
    const createdAt = chat?.createdAt || ''
    return `${senderId}|${message}|${createdAt}`
  }

  const getEntityId = (value) => value?._id || value?.id || value || ''

  const fetchDashboard = async (authToken, options = {}) => {
    const { notify = false } = options
    const requestHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    }

    const [meRes, announcementsRes, eventsRes, chatsRes] = await Promise.all([
      fetch(`${API_BASE}/api/auth/me`, { headers: requestHeaders }),
      fetch(`${API_BASE}/api/announcements`, { headers: requestHeaders }),
      fetch(`${API_BASE}/api/events`, { headers: requestHeaders }),
      fetch(`${API_BASE}/api/messages/chats`, { headers: requestHeaders }),
    ])

    if (!meRes.ok) await handleApiError(meRes)
    if (!announcementsRes.ok) await handleApiError(announcementsRes)
    if (!eventsRes.ok) await handleApiError(eventsRes)
    if (!chatsRes.ok) await handleApiError(chatsRes)

    const meData = await meRes.json()
    const announcementData = await announcementsRes.json()
    const eventsData = await eventsRes.json()
    const chatsData = await chatsRes.json()

    const allAnnouncements = Array.isArray(announcementData.announcements)
      ? announcementData.announcements
      : []

    const allEvents = Array.isArray(eventsData.events) ? eventsData.events : []
    const chatList = Array.isArray(chatsData.chats) ? chatsData.chats : []

    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const tomorrowStart = new Date(todayStart)
    tomorrowStart.setDate(tomorrowStart.getDate() + 1)

    const todaysEventsOnly = allEvents.filter((event) => {
      const eventDate = new Date(event.date)
      return eventDate >= todayStart && eventDate < tomorrowStart
    })

    const derivedNotifications = [
      ...allAnnouncements
        .filter((item) => item.pinned || item.priority === 'important')
        .slice(0, 3)
        .map((item) => ({
          id: `ann-${item._id}`,
          title: item.title,
          subtitle: `Announcement (${item.priority || 'normal'})`,
        })),
      ...todaysEventsOnly.slice(0, 3).map((event) => ({
        id: `event-${event._id}`,
        title: event.title,
        subtitle: 'Event happening today',
      })),
    ]

    if (chatList.length > 0) {
      derivedNotifications.unshift({
        id: 'chat-notice',
        title: `${chatList.length} active chats available`,
        subtitle: 'Check your messages for updates',
      })
    }

    setUser(meData.user || null)
    if (meData.user?.role) {
      localStorage.setItem(ROLE_KEY, meData.user.role)
      window.dispatchEvent(new Event('campusly-role-changed'))
    }
    setAnnouncements(allAnnouncements.slice(0, 6))
    setEvents(allEvents)
    setTodayEvents(todaysEventsOnly)
    setNotifications(derivedNotifications.slice(0, 6))

    const nextImportantAnnouncements = allAnnouncements.filter(
      (item) => item.pinned || item.priority === 'important'
    )
    const nextAnnouncementIds = nextImportantAnnouncements.map((item) => item._id)

    const nextChatSnapshots = new Map(
      chatList.map((chat) => [chat._id, getChatSignature(chat)])
    )

    if (hasBootstrappedRef.current && notify && notificationPermission === 'granted') {
      const previousImportantIds = previousImportantAnnouncementIdsRef.current
      const newlyImportant = nextImportantAnnouncements.filter(
        (item) => !previousImportantIds.includes(item._id)
      )

      newlyImportant.slice(0, 2).forEach((item) => {
        notifyBrowser(
          `Important announcement: ${item.title}`,
          item.teacherName
            ? `Posted by ${item.teacherName}`
            : item.content || 'Open Campusly to read the announcement.'
        )
      })

      previousChatSnapshotRef.current.forEach((previousSignature, chatId) => {
        const nextSignature = nextChatSnapshots.get(chatId)
        if (!nextSignature || nextSignature === previousSignature) return

        const chat = chatList.find((entry) => entry._id === chatId)
        if (!chat) return

        const senderId = chat.senderId?._id || chat.senderId?.id || chat.senderId
        if (senderId === meData.user?.id) return

        const senderName = chat.chatType === 'department'
          ? `${chat.department} department`
          : chat.senderId?.name || chat.senderId?.username || 'New reply'

        notifyBrowser(
          `New message from ${senderName}`,
          chat.message || 'Open Campusly to read the latest reply.'
        )
      })
    }

    previousImportantAnnouncementIdsRef.current = nextAnnouncementIds
    previousChatSnapshotRef.current = nextChatSnapshots
    hasBootstrappedRef.current = true
  }

  const persistAuth = async (nextToken) => {
    setToken(nextToken)
    localStorage.setItem(TOKEN_KEY, nextToken)
    await fetchDashboard(nextToken)
  }

  const clearFeedback = () => {
    setMessage('')
    setError('')
  }

  const resetAnnouncementForm = () => {
    setAnnouncementForm(initialAnnouncementForm)
    setAnnouncementError('')
    setAnnouncementSuccess('')
  }

  const resetEventForm = () => {
    setEventForm(initialEventForm)
    setEventError('')
    setEventSuccess('')
  }

  const handleEnableNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationPermission('unsupported')
      setMessage('Browser notifications are not supported in this browser.')
      return
    }

    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)

    if (permission === 'granted') {
      setMessage('Browser notifications enabled.')
      notifyBrowser('Campusly', 'You will now receive important updates and chat replies.')
    } else {
      setMessage('Browser notifications were not enabled.')
    }
  }

  const handleCreateAnnouncement = async (event) => {
    event.preventDefault()
    setAnnouncementError('')
    setAnnouncementSuccess('')
    setAnnouncementLoading(true)

    try {
      if (user?.role !== 'teacher') {
        throw new Error('Only teachers can post announcements')
      }

      if (!announcementForm.title.trim() || !announcementForm.content.trim()) {
        throw new Error('Please provide a title and content')
      }

      const formData = new FormData()
      formData.append('title', announcementForm.title)
      formData.append('content', announcementForm.content)
      formData.append('priority', announcementForm.priority)
      formData.append('pinned', String(announcementForm.pinned))

      if (announcementForm.image) {
        formData.append('image', announcementForm.image)
      }

      const response = await fetch(`${API_BASE}/api/announcements`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to post announcement')
      }

      setAnnouncementSuccess('Announcement posted successfully')
      setMessage('Announcement posted successfully')
      setAnnouncementForm(initialAnnouncementForm)
      setShowAnnouncementModal(false)
      await fetchDashboard(token)
    } catch (err) {
      setAnnouncementError(err.message || 'Failed to post announcement')
    } finally {
      setAnnouncementLoading(false)
    }
  }

  const handleCreateEvent = async (event) => {
    event.preventDefault()
    setEventError('')
    setEventSuccess('')
    setEventLoading(true)

    try {
      if (!['teacher', 'admin'].includes(user?.role)) {
        throw new Error('Only teachers and admins can create events')
      }

      if (
        !eventForm.title.trim() ||
        !eventForm.description.trim() ||
        !eventForm.date ||
        !eventForm.location.trim()
      ) {
        throw new Error('Please provide title, description, date, and location')
      }

      const formData = new FormData()
      formData.append('title', eventForm.title)
      formData.append('description', eventForm.description)
      formData.append('date', eventForm.date)
      formData.append('location', eventForm.location)
      if (eventForm.maxAttendees) {
        formData.append('maxAttendees', eventForm.maxAttendees)
      }
      if (user.department) {
        formData.append('department', user.department)
      }
      if (eventForm.image) {
        formData.append('image', eventForm.image)
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

      setEventSuccess('Event created successfully')
      setMessage('Event created successfully')
      setEventForm(initialEventForm)
      setShowEventModal(false)
      await fetchDashboard(token)
    } catch (err) {
      setEventError(err.message || 'Failed to create event')
    } finally {
      setEventLoading(false)
    }
  }

  const handleDeleteAnnouncement = async (announcementId) => {
    if (!window.confirm('Delete this announcement?')) return

    setError('')
    setMessage('')
    setAnnouncementDeletingId(announcementId)

    try {
      const response = await fetch(`${API_BASE}/api/announcements/${announcementId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete announcement')
      }

      setMessage('Announcement deleted successfully')
      await fetchDashboard(token)
    } catch (err) {
      setError(err.message || 'Failed to delete announcement')
    } finally {
      setAnnouncementDeletingId('')
    }
  }

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Delete this event?')) return

    setError('')
    setMessage('')
    setEventDeletingId(eventId)

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

      setMessage('Event deleted successfully')
      await fetchDashboard(token)
    } catch (err) {
      setError(err.message || 'Failed to delete event')
    } finally {
      setEventDeletingId('')
    }
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    clearFeedback()
    setLoading(true)

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      })

      if (!response.ok) await handleApiError(response)
      const data = await response.json()

      if (!data.token) {
        throw new Error('Login response did not include token')
      }

      await persistAuth(data.token)
      setMessage('Login successful')
      setLoginForm({ email: '', password: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (event) => {
    event.preventDefault()
    clearFeedback()
    setLoading(true)

    try {
      const resolvedDepartment = signupForm.department === 'Other'
        ? signupForm.customDepartment.trim()
        : signupForm.department

      if (!resolvedDepartment) {
        throw new Error('Please provide your department')
      }

      const signupPayload = {
        username: signupForm.username,
        name: signupForm.name,
        email: signupForm.email,
        password: signupForm.password,
        role: signupForm.role,
        department: resolvedDepartment,
      }

      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupPayload),
      })

      if (!response.ok) await handleApiError(response)
      const data = await response.json()

      if (data.requiresOtpVerification) {
        setShowOtp(true)
        setOtpForm((prev) => ({ ...prev, email: signupForm.email }))
        setMessage('Signup successful. Enter OTP to verify your account.')
      } else {
        setMessage(data.message || 'Signup successful')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (event) => {
    event.preventDefault()
    clearFeedback()
    setLoading(true)

    try {
      const response = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(otpForm),
      })

      if (!response.ok) await handleApiError(response)
      const data = await response.json()

      if (!data.token) {
        throw new Error('OTP verification succeeded but token was missing')
      }

      await persistAuth(data.token)
      setShowOtp(false)
      setMessage('Account verified and logged in successfully')
      setSignupForm(initialSignupState)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(ROLE_KEY)
    window.dispatchEvent(new Event('campusly-role-changed'))
    setToken('')
    setUser(null)
    setAnnouncements([])
    setTodayEvents([])
    setNotifications([])
    setShowAnnouncementModal(false)
    setShowEventModal(false)
    resetAnnouncementForm()
    resetEventForm()
    hasBootstrappedRef.current = false
    previousImportantAnnouncementIdsRef.current = []
    previousChatSnapshotRef.current = new Map()
    setMessage('Logged out successfully')
    setError('')
  }

  useEffect(() => {
    if (!token) return

    let isMounted = true
    let socket = null

    const bootstrap = async () => {
      setLoading(true)
      clearFeedback()

      try {
        await fetchDashboard(token, { notify: false })
      } catch (err) {
        if (!isMounted) return
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(ROLE_KEY)
        window.dispatchEvent(new Event('campusly-role-changed'))
        setToken('')
        setUser(null)
        setError(`Session expired: ${err.message}`)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    bootstrap()

    socket = io(API_BASE, {
      auth: { token },
      transports: ['websocket'],
    })

    const refreshFromSocket = async () => {
      try {
        await fetchDashboard(token, { notify: true })
      } catch (err) {
        console.error('Socket refresh failed:', err)
      }
    }

    const handleAnnouncementNotification = (payload) => {
      const title = payload?.title || 'Important announcement'
      const body = payload?.content || 'Open Campusly to read the latest update.'
      notifyBrowser(title, body)
      refreshFromSocket()
    }

    const handleAnnouncementPosted = (payload) => {
      const creatorId = payload?.createdBy?._id || payload?.createdBy?.id
      if (creatorId && creatorId === user?.id) {
        refreshFromSocket()
        return
      }

      const title = payload?.title || 'New announcement'
      const body = payload?.teacherName
        ? `Posted by ${payload.teacherName}`
        : payload?.content || 'Open Campusly to read the latest update.'
      notifyBrowser(title, body)
      refreshFromSocket()
    }

    const handleAnnouncementDeleted = () => {
      refreshFromSocket()
    }

    const handleEventDeleted = () => {
      refreshFromSocket()
    }

    const handleReceiveMessage = (payload) => {
      const senderId = payload?.senderId?._id || payload?.senderId?.id || payload?.senderId
      if (senderId && senderId === user?.id) {
        refreshFromSocket()
        return
      }

      const senderName = payload?.senderId?.name || payload?.senderId?.username || 'New message'
      notifyBrowser(`New message from ${senderName}`, payload?.message || 'Open Campusly to read the reply.')
      refreshFromSocket()
    }

    const handleDepartmentMessage = (payload) => {
      const senderId = payload?.from?.id || payload?.senderId?._id || payload?.senderId?.id || payload?.senderId
      if (senderId && senderId === user?.id) {
        refreshFromSocket()
        return
      }

      const senderName = payload?.from?.name || payload?.senderId?.name || 'Department message'
      notifyBrowser(`New department message from ${senderName}`, payload?.message || 'Open Campusly to read the reply.')
      refreshFromSocket()
    }

    socket.on('announcement_notification', handleAnnouncementNotification)
    socket.on('announcement_posted', handleAnnouncementPosted)
    socket.on('announcement_deleted', handleAnnouncementDeleted)
    socket.on('event_deleted', handleEventDeleted)
    socket.on('receive_message', handleReceiveMessage)
    socket.on('department_message', handleDepartmentMessage)

    return () => {
      isMounted = false
      if (socket) {
        socket.off('announcement_notification', handleAnnouncementNotification)
        socket.off('announcement_posted', handleAnnouncementPosted)
        socket.off('announcement_deleted', handleAnnouncementDeleted)
        socket.off('event_deleted', handleEventDeleted)
        socket.off('receive_message', handleReceiveMessage)
        socket.off('department_message', handleDepartmentMessage)
        socket.disconnect()
      }
    }
  }, [token])

  if (user) {
    const canCreateEvent = ['teacher', 'admin'].includes(user.role)
    const myAnnouncements = announcements.filter(
      (item) => getEntityId(item.createdBy) === user.id
    )
    const myEvents = events.filter(
      (item) => getEntityId(item.createdBy) === user.id
    )
    const canDeleteAnnouncement = (item) => user.role === 'admin' || getEntityId(item.createdBy) === user.id
    const canDeleteEvent = (item) => user.role === 'admin' || getEntityId(item.createdBy) === user.id
    const view = dashboardCopy[user.role] || dashboardCopy.student

    const roleCards = user.role === 'teacher'
      ? [
        { label: 'My announcements', value: myAnnouncements.length, hint: 'Created by you' },
        { label: 'My events', value: myEvents.length, hint: 'Created by you' },
        { label: 'Alerts enabled', value: notificationPermission === 'granted' ? 'Yes' : 'No', hint: 'Browser notifications' },
      ]
      : user.role === 'admin'
        ? [
          { label: 'Total announcements', value: announcements.length, hint: 'Across campus' },
          { label: 'Total events', value: events.length, hint: 'Across campus' },
          { label: 'Important alerts', value: notifications.length, hint: 'Pinned or urgent' },
        ]
        : [
          { label: 'Important announcements', value: announcements.filter((item) => item.pinned || item.priority === 'important').length, hint: 'Need your attention' },
          { label: 'Today’s events', value: todayEvents.length, hint: 'Happening now' },
          { label: 'Alerts enabled', value: notificationPermission === 'granted' ? 'Yes' : 'No', hint: 'Browser notifications' },
        ]

    return (
      <section className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 p-6 text-white shadow-sm">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">
                {view.eyebrow}
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">Welcome, {user.name}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-200">{view.description}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleEnableNotifications}
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-50"
              >
                {notificationPermission === 'granted' ? 'Alerts Enabled' : 'Enable Alerts'}
              </button>
              {canCreateEvent && (
                <button
                  type="button"
                  onClick={() => setShowEventModal(true)}
                  className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  Create Event
                </button>
              )}
              {user.role === 'teacher' && (
                <button
                  type="button"
                  onClick={() => setShowAnnouncementModal(true)}
                  className="rounded-lg border border-white/20 bg-cyan-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-400"
                >
                  Create Announcement
                </button>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {roleCards.map((card) => (
              <div key={card.label} className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-wider text-cyan-100">{card.label}</p>
                <p className="mt-1 text-2xl font-bold text-white">{card.value}</p>
                <p className="mt-1 text-xs text-cyan-100">{card.hint}</p>
              </div>
            ))}
          </div>
        </div>

        {user.role === 'teacher' && (
          <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Teacher Area</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">Announcements</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowAnnouncementModal(true)}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Create Announcement
                </button>
                <button
                  type="button"
                  onClick={() => setShowEventModal(true)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Create Event
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">Previous announcements by you</p>
                <div className="mt-3 space-y-3">
                  {myAnnouncements.length === 0 && (
                    <p className="text-sm text-slate-500">No announcements posted yet.</p>
                  )}
                  {myAnnouncements.map((item) => (
                    <div key={item._id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            By {item.teacherName || item?.createdBy?.name || 'Teacher'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                            {item.priority || 'normal'}
                          </span>
                          {canDeleteAnnouncement(item) && (
                            <button
                              type="button"
                              onClick={() => handleDeleteAnnouncement(item._id)}
                              disabled={announcementDeletingId === item._id}
                              className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {announcementDeletingId === item._id ? 'Deleting...' : 'Delete'}
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-slate-600 line-clamp-2">{item.content}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">Previous events by you</p>
                <div className="mt-3 space-y-3">
                  {myEvents.length === 0 && (
                    <p className="text-sm text-slate-500">No events created yet.</p>
                  )}
                  {myEvents.map((item) => (
                    <div key={item._id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                          <p className="mt-1 text-sm text-slate-600 line-clamp-2">{item.description}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.location}</p>
                        </div>
                        {canDeleteEvent(item) && (
                          <button
                            type="button"
                            onClick={() => handleDeleteEvent(item._id)}
                            disabled={eventDeletingId === item._id}
                            className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {eventDeletingId === item._id ? 'Deleting...' : 'Delete'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>
        )}

        {message && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
        {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {announcementSuccess && (
          <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{announcementSuccess}</p>
        )}
        {announcementError && (
          <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{announcementError}</p>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-1">
            <h2 className="text-lg font-semibold text-slate-900">Notifications</h2>
            <ul className="mt-4 space-y-3">
              {notifications.length === 0 && (
                <li className="text-sm text-slate-500">No notifications right now.</li>
              )}
              {notifications.map((item) => (
                <li key={item.id} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-sm font-medium text-slate-800">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.subtitle}</p>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2">
            <h2 className="text-lg font-semibold text-slate-900">Announcements</h2>
            <ul className="mt-4 space-y-4">
              {announcements.length === 0 && (
                <li className="text-sm text-slate-500">No announcements found.</li>
              )}
              {announcements.map((item) => (
                <li key={item._id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                      {item.priority || 'normal'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    By {item.teacherName || item?.createdBy?.name || 'Teacher'}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">{item.content}</p>
                  {user.role === 'teacher' && getEntityId(item.createdBy) === user.id && (
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleDeleteAnnouncement(item._id)}
                        disabled={announcementDeletingId === item._id}
                        className="rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {announcementDeletingId === item._id ? 'Deleting...' : 'Delete announcement'}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </article>
        </div>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Today&apos;s Events</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {todayEvents.length === 0 && (
              <li className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                No events scheduled for today.
              </li>
            )}
            {todayEvents.map((event) => (
              <li key={event._id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{event.location}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(event.date).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {user.role === 'teacher' && getEntityId(event.createdBy) === user.id && (
                    <button
                      type="button"
                      onClick={() => handleDeleteEvent(event._id)}
                      disabled={eventDeletingId === event._id}
                      className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {eventDeletingId === event._id ? 'Deleting...' : 'Delete'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </article>

        {showAnnouncementModal && user.role === 'teacher' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6">
            <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl">
              <div className="border-b border-slate-200 px-6 py-4 sm:px-8">
                <h2 className="text-xl font-bold text-slate-900">Create Announcement</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Share an update with your department from the home page.
                </p>
              </div>

              <form onSubmit={handleCreateAnnouncement} className="space-y-4 p-6 sm:p-8">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700">Title</label>
                    <input
                      type="text"
                      value={announcementForm.title}
                      onChange={(event) =>
                        setAnnouncementForm((prev) => ({ ...prev, title: event.target.value }))
                      }
                      placeholder="Class schedule update"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-600"
                      required
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700">Content</label>
                    <textarea
                      value={announcementForm.content}
                      onChange={(event) =>
                        setAnnouncementForm((prev) => ({ ...prev, content: event.target.value }))
                      }
                      placeholder="Write the announcement details here"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-600"
                      rows={4}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">Priority</label>
                    <select
                      value={announcementForm.priority}
                      onChange={(event) =>
                        setAnnouncementForm((prev) => ({ ...prev, priority: event.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-600"
                    >
                      <option value="normal">Normal</option>
                      <option value="important">Important</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">Image (optional)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        setAnnouncementForm((prev) => ({
                          ...prev,
                          image: event.target.files?.[0] || null,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-amber-100 file:px-3 file:py-1 file:text-sm file:font-semibold file:text-amber-700 hover:file:bg-amber-200"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={announcementForm.pinned}
                        onChange={(event) =>
                          setAnnouncementForm((prev) => ({ ...prev, pinned: event.target.checked }))
                        }
                        className="rounded"
                      />
                      Pin this announcement
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAnnouncementModal(false)
                      resetAnnouncementForm()
                    }}
                    className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={announcementLoading}
                    className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
                  >
                    {announcementLoading ? 'Posting...' : 'Post Announcement'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showEventModal && canCreateEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6">
            <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl">
              <div className="border-b border-slate-200 px-6 py-4 sm:px-8">
                <h2 className="text-xl font-bold text-slate-900">Create Event</h2>
                <p className="mt-1 text-sm text-slate-600">Share a campus event from the home page.</p>
              </div>

              <form onSubmit={handleCreateEvent} className="space-y-4 p-6 sm:p-8">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700">Title</label>
                    <input
                      type="text"
                      value={eventForm.title}
                      onChange={(event) =>
                        setEventForm((prev) => ({ ...prev, title: event.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-600"
                      required
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700">Description</label>
                    <textarea
                      value={eventForm.description}
                      onChange={(event) =>
                        setEventForm((prev) => ({ ...prev, description: event.target.value }))
                      }
                      rows={4}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-600"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">Date &amp; Time</label>
                    <input
                      type="datetime-local"
                      value={eventForm.date}
                      onChange={(event) =>
                        setEventForm((prev) => ({ ...prev, date: event.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-600"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">Location</label>
                    <input
                      type="text"
                      value={eventForm.location}
                      onChange={(event) =>
                        setEventForm((prev) => ({ ...prev, location: event.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-600"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">Max Attendees</label>
                    <input
                      type="number"
                      min="1"
                      value={eventForm.maxAttendees}
                      onChange={(event) =>
                        setEventForm((prev) => ({ ...prev, maxAttendees: event.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-600"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">Image (optional)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        setEventForm((prev) => ({ ...prev, image: event.target.files?.[0] || null }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
                    />
                  </div>
                </div>

                <div className="flex gap-3 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEventModal(false)
                      resetEventForm()
                    }}
                    className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={eventLoading}
                    className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
                  >
                    {eventLoading ? 'Creating...' : 'Create Event'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6 py-8">
      <article className="relative overflow-hidden rounded-3xl border border-cyan-200 bg-gradient-to-r from-cyan-700 via-sky-700 to-indigo-800 p-6 text-white shadow-lg sm:p-8">
        <div className="absolute -left-16 -top-16 h-52 w-52 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute -bottom-20 right-0 h-56 w-56 rounded-full bg-cyan-200/20 blur-3xl" />

        <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
              One Campus. Every Update.
            </p>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
              Welcome to Campusly
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-cyan-100 sm:text-base">
              Campusly is your complete campus platform for announcements, live chat, events, marketplace,
              lost and found, and role-based dashboards for students, teachers, and admins.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {['Announcements', 'Events', 'Live Chat', 'Lost & Found', 'Marketplace', 'Profiles'].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-medium text-white"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-wider text-cyan-100">Role-Based</p>
              <p className="mt-1 text-sm font-semibold text-white">Student, Teacher, Admin dashboards</p>
            </div>
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-wider text-cyan-100">Real-Time</p>
              <p className="mt-1 text-sm font-semibold text-white">Instant notifications and updates</p>
            </div>
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-wider text-cyan-100">Campus Utility</p>
              <p className="mt-1 text-sm font-semibold text-white">Academic + community tools in one app</p>
            </div>
          </div>
        </div>
      </article>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Get Started</h2>
          <p className="mt-2 text-sm text-slate-600">
            Sign in to continue your campus journey or create a new account to join Campusly.
          </p>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => setActiveAuthTab('login')}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                activeAuthTab === 'login'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setActiveAuthTab('signup')}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                activeAuthTab === 'signup'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              Signup
            </button>
          </div>

          {message && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
          {error && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

          <div className="mt-6 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">What You Can Do</p>
            <p className="text-sm text-slate-700">Receive important announcements from teachers and admins.</p>
            <p className="text-sm text-slate-700">Explore events, marketplace listings, and campus resources.</p>
            <p className="text-sm text-slate-700">Use live chat and notifications for faster communication.</p>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {activeAuthTab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Login</h2>
              <input
                type="email"
                placeholder="Email"
                value={loginForm.email}
                onChange={(event) =>
                  setLoginForm((prev) => ({ ...prev, email: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((prev) => ({ ...prev, password: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-70"
              >
                {loading ? 'Please wait...' : 'Login'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Signup</h2>
              <input
                type="text"
                placeholder="Username"
                value={signupForm.username}
                onChange={(event) =>
                  setSignupForm((prev) => ({ ...prev, username: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                required
              />
              <input
                type="text"
                placeholder="Full name"
                value={signupForm.name}
                onChange={(event) =>
                  setSignupForm((prev) => ({ ...prev, name: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={signupForm.email}
                onChange={(event) =>
                  setSignupForm((prev) => ({ ...prev, email: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={signupForm.password}
                onChange={(event) =>
                  setSignupForm((prev) => ({ ...prev, password: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                required
              />
              <div className="grid grid-cols-2 gap-3">
                {signupForm.role === 'student' ? (
                  <select
                    value={signupForm.department}
                    onChange={(event) =>
                      setSignupForm((prev) => ({
                        ...prev,
                        department: event.target.value,
                        customDepartment: event.target.value === 'Other' ? prev.customDepartment : '',
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                    required
                  >
                    {STUDENT_DEPARTMENTS.map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Department"
                    value={signupForm.department}
                    onChange={(event) =>
                      setSignupForm((prev) => ({ ...prev, department: event.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                    required
                  />
                )}
                <select
                  value={signupForm.role}
                  onChange={(event) =>
                    setSignupForm((prev) => ({
                      ...prev,
                      role: event.target.value,
                      department: event.target.value === 'student'
                        ? (STUDENT_DEPARTMENTS.includes(prev.department) ? prev.department : 'DCSA')
                        : (prev.department === 'Other' ? prev.customDepartment : prev.department),
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                </select>
              </div>

              {signupForm.role === 'student' && signupForm.department === 'Other' && (
                <input
                  type="text"
                  placeholder="Type your department"
                  value={signupForm.customDepartment}
                  onChange={(event) =>
                    setSignupForm((prev) => ({ ...prev, customDepartment: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                  required
                />
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-70"
              >
                {loading ? 'Please wait...' : 'Signup'}
              </button>
            </form>
          )}
        </article>
      </div>

      {showOtp && (
        <article className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <form onSubmit={handleVerifyOtp} className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-slate-900">Verify OTP</h3>
              <input
                type="email"
                placeholder="Email"
                value={otpForm.email}
                onChange={(event) =>
                  setOtpForm((prev) => ({ ...prev, email: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                required
              />
              <input
                type="text"
                placeholder="6-digit OTP"
                value={otpForm.otp}
                onChange={(event) =>
                  setOtpForm((prev) => ({ ...prev, otp: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="h-fit rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-70"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </form>
        </article>
      )}
    </section>
  )
}

export default Home