import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_BASE_URL
const TOKEN_KEY = 'campuslyToken'

function formatTime(value) {
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Chat() {
  const navigate = useNavigate()
  const endRef = useRef(null)
  const [token] = useState(localStorage.getItem(TOKEN_KEY) || '')
  const [user, setUser] = useState(null)
  const [chats, setChats] = useState([])
  const [people, setPeople] = useState([])
  const [selectedChat, setSelectedChat] = useState(null)
  const [messages, setMessages] = useState([])
  const [messageText, setMessageText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [peopleSearch, setPeopleSearch] = useState('')

  const headers = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }),
    [token]
  )

  const selectedChatKey = selectedChat?._id || ''

  const loadMessages = async (chat) => {
    if (!chat || !token) return

    setError('')

    try {
      if (chat.chatType === 'department') {
        const response = await fetch(
          `${API_BASE}/api/messages/department/messages?department=${encodeURIComponent(chat.department || user?.department || '')}`,
          { headers }
        )
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Failed to load department chat')
        setMessages(Array.isArray(data.messages) ? data.messages : [])
        return
      }

      const otherUserId = chat.directUser?._id
        || (chat.senderId?._id === user?.id
          ? chat.receiverId?._id || chat.receiverId
          : chat.senderId?._id || chat.senderId)

      if (!otherUserId) {
        setMessages([])
        return
      }

      const response = await fetch(`${API_BASE}/api/messages/${otherUserId}`, { headers })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to load conversation')
      setMessages(Array.isArray(data.messages) ? data.messages : [])
    } catch (err) {
      setError(err.message || 'Unable to load messages')
    }
  }

  const fetchChats = async (options = {}) => {
    const { silent = false } = options

    if (!token) {
      navigate('/')
      return
    }

    if (!silent) {
      setLoading(true)
      setError('')
    }

    try {
      const [meRes, chatsRes, usersRes] = await Promise.all([
        fetch(`${API_BASE}/api/auth/me`, { headers }),
        fetch(`${API_BASE}/api/messages/chats`, { headers }),
        fetch(`${API_BASE}/api/users`, { headers }),
      ])

      const meData = await meRes.json()
      const chatsData = await chatsRes.json()
      const usersData = await usersRes.json()

      if (!meRes.ok) throw new Error(meData.message || 'Failed to load user')
      if (!chatsRes.ok) throw new Error(chatsData.message || 'Failed to load chats')
      if (!usersRes.ok) throw new Error(usersData.message || 'Failed to load users')

      const chatList = Array.isArray(chatsData.chats) ? chatsData.chats : []
      setUser(meData.user || null)
      setChats(chatList)
      setPeople(Array.isArray(usersData.users) ? usersData.users : [])

      const departmentChat = chatList.find((chat) => chat.chatType === 'department') || null
      const nextSelected = selectedChat || departmentChat || chatList[0] || null
      setSelectedChat(nextSelected)
      if (nextSelected) {
        await loadMessages(nextSelected)
      } else {
        setMessages([])
      }
    } catch (err) {
      if (!silent) {
        setError(err.message || 'Failed to load chat data')
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    fetchChats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    if (!token) return

    const intervalId = setInterval(() => {
      fetchChats({ silent: true })
    }, 7000)

    return () => clearInterval(intervalId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedChatKey])

  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChatKey])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const filteredChats = chats.filter((chat) => {
    const query = search.toLowerCase()
    if (!query) return true

    const name = chat.chatType === 'department'
      ? `${chat.department || ''} department`
      : `${chat.senderId?.name || chat.receiverId?.name || ''} ${chat.senderId?.username || chat.receiverId?.username || ''}`

    return name.toLowerCase().includes(query) || (chat.message || '').toLowerCase().includes(query)
  })

  const filteredPeople = people.filter((person) => {
    const query = peopleSearch.toLowerCase().trim()
    if (!query) return true

    return (
      person.name?.toLowerCase().includes(query) ||
      person.username?.toLowerCase().includes(query) ||
      person.role?.toLowerCase().includes(query) ||
      person.department?.toLowerCase().includes(query)
    )
  })

  const getSenderMeta = (msg) => {
    const senderId = msg?.senderId?._id || msg?.senderId?.id || msg?.senderId
    const isMine = senderId === user?.id

    if (isMine) {
      return {
        name: user?.name || 'You',
        role: user?.role || 'member',
      }
    }

    const matched = people.find((person) => person._id === senderId)

    return {
      name: msg?.senderId?.name || matched?.name || 'Unknown',
      role: matched?.role || 'member',
    }
  }

  const handleSelectChat = async (chat) => {
    setSelectedChat(chat)
    await loadMessages(chat)
  }

  const handleSelectPerson = async (person) => {
    const directChat = {
      _id: `user:${person._id}`,
      chatType: 'direct',
      directUser: person,
      senderId: { _id: user?.id, name: user?.name, username: user?.username },
      receiverId: person,
      message: `Chat with ${person.name}`,
    }

    setSelectedChat(directChat)
    await loadMessages(directChat)
  }

  const handleSend = async (event) => {
    event.preventDefault()
    if (!messageText.trim() || !selectedChat) return

    setSending(true)
    setError('')

    try {
      if (selectedChat.chatType === 'department') {
        const response = await fetch(`${API_BASE}/api/messages/department`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            message: messageText,
            type: 'text',
            department: selectedChat.department || user?.department,
          }),
        })

        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Failed to send message')
      } else {
        const otherUserId = selectedChat.directUser?._id
          || (selectedChat.senderId?._id === user?.id
          ? selectedChat.receiverId?._id || selectedChat.receiverId
          : selectedChat.senderId?._id || selectedChat.senderId)

        const response = await fetch(`${API_BASE}/api/messages`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            receiverId: otherUserId,
            message: messageText,
            type: 'text',
          }),
        })

        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Failed to send message')
      }

      setMessageText('')
      await fetchChats()
    } catch (err) {
      setError(err.message || 'Could not send message')
    } finally {
      setSending(false)
    }
  }

  if (!token) {
    return (
      <section className="rounded-3xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-sky-50 to-blue-100 p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Chat</p>
        <h1 className="mt-3 text-3xl font-black text-slate-900">Login to open Campus Chat</h1>
        <p className="mt-2 max-w-xl text-sm text-slate-600">
          Access direct messages and department group chat from one place.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Go to Login
        </Link>
      </section>
    )
  }

  return (
    <section className="grid min-h-[calc(100vh-140px)] overflow-hidden rounded-3xl border border-slate-200 bg-[#e5ddd5] shadow-sm lg:grid-cols-[380px_1fr]">
      <style>{`
        @keyframes chatFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes chatSlideIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      <aside className="flex min-h-[70vh] flex-col border-b border-slate-200 bg-white lg:border-b-0 lg:border-r">
        <div className="border-b border-slate-200 bg-[#075e54] p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#cdeae4]">Campus Chat</p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Messages</h1>
              <p className="mt-1 text-sm text-[#d8f3ec]">
                {user?.name || 'You'}{user?.department ? ` · ${user.department}` : ''}
              </p>
            </div>
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">Online</span>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats"
            className="mt-4 w-full rounded-full border-0 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400"
          />
        </div>

        <div className="border-b border-slate-200 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Find people</p>
              <p className="text-xs text-slate-500">Start a personal chat by searching a name</p>
            </div>
          </div>
          <input
            type="text"
            value={peopleSearch}
            onChange={(e) => setPeopleSearch(e.target.value)}
            placeholder="Search users"
            className="mt-3 w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div>
            <p className="px-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Chats</p>
            <div className="mt-3">
              {loading && <p className="p-4 text-sm text-slate-500">Loading chats...</p>}
              {!loading && filteredChats.length === 0 && (
                <p className="p-4 text-sm text-slate-500">No chats yet.</p>
              )}
              {filteredChats.map((chat, index) => {
                const isSelected = chat._id === selectedChatKey
                const title = chat.chatType === 'department'
                  ? `${chat.department} Department`
                  : chat.senderId?._id === user?.id
                    ? chat.receiverId?.name || chat.receiverId?.username || 'Unknown'
                    : chat.senderId?.name || chat.senderId?.username || 'Unknown'

                return (
                  <button
                    key={chat._id}
                    type="button"
                    onClick={() => handleSelectChat(chat)}
                    className={`mb-2 w-full rounded-2xl border p-3 text-left transition ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 bg-white hover:bg-slate-50 hover:scale-[1.01]'
                    }`}
                    style={{ animation: `chatSlideIn 220ms ease-out ${Math.min(index * 35, 220)}ms both` }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{title}</p>
                        <p className="text-xs text-slate-500">
                          {chat.chatType === 'department' ? 'Department room' : 'Direct message'}
                        </p>
                      </div>
                      {chat.chatType === 'department' && (
                        <span className="rounded-full bg-[#25d366]/15 px-2 py-1 text-[10px] font-bold uppercase text-[#128c7e]">
                          Group
                        </span>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-1 text-xs text-slate-600">{chat.message || 'No messages yet'}</p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-5 border-t border-slate-200 pt-4">
            <p className="px-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Users</p>
            <div className="mt-3 space-y-2">
              {filteredPeople.length === 0 && (
                <p className="px-1 text-sm text-slate-500">No users found.</p>
              )}
              {filteredPeople.map((person, index) => {
                const isSelected = selectedChat?._id === `user:${person._id}`

                return (
                  <button
                    key={person._id}
                    type="button"
                    onClick={() => handleSelectPerson(person)}
                    className={`w-full rounded-2xl border p-3 text-left transition ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 bg-white hover:bg-slate-50 hover:scale-[1.01]'
                    }`}
                    style={{ animation: `chatSlideIn 220ms ease-out ${Math.min(index * 25, 200)}ms both` }}
                  >
                    <p className="text-sm font-semibold text-slate-900">{person.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{person.role || 'member'}</p>
                    <p className="mt-1 text-xs text-slate-600">@{person.username}</p>
                    {person.department && (
                      <p className="mt-1 text-[11px] text-slate-500">{person.department}</p>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </aside>

      <main className="flex min-h-[70vh] flex-col bg-white">
        {selectedChat ? (
          <>
            <div className="flex items-center justify-between border-b border-slate-200 bg-[#f0f2f5] p-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {selectedChat.chatType === 'department'
                    ? `${selectedChat.department} Department`
                    : selectedChat.senderId?._id === user?.id
                      ? selectedChat.receiverId?.name || selectedChat.receiverId?.username || 'Chat'
                      : selectedChat.senderId?.name || selectedChat.senderId?.username || 'Chat'}
                </h2>
                <p className="text-sm text-slate-500">
                  {selectedChat.chatType === 'department'
                    ? 'Department group chat'
                    : 'Direct conversation'}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {selectedChat.chatType === 'department' ? 'Group' : 'Direct'}
              </span>
            </div>

            {error && (
              <div className="border-b border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {error}
              </div>
            )}

            <div
              className="flex-1 space-y-4 overflow-y-auto p-5"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 20px 20px, rgba(255,255,255,0.28) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
                backgroundColor: '#efeae2',
              }}
            >
              {messages.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white/90 p-6 text-center text-sm text-slate-500">
                  Start the conversation.
                </div>
              )}

              {messages.map((msg, index) => {
                const isMine = msg.senderId?._id === user?.id || msg.senderId?.id === user?.id
                const sender = getSenderMeta(msg)
                const showSender = selectedChat.chatType === 'department'
                return (
                  <div key={msg._id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-sm ${
                        isMine
                          ? 'bg-[#d9fdd3] text-slate-900'
                          : 'bg-white border border-slate-200 text-slate-900'
                      }`}
                      style={{ animation: `chatFadeUp 220ms ease-out ${Math.min(index * 20, 180)}ms both` }}
                    >
                      {showSender && (
                        <div className="mb-1.5 flex items-center gap-2">
                          <p className={`text-xs font-semibold ${sender.role === 'teacher' ? 'text-emerald-700' : 'text-slate-600'}`}>
                            {isMine ? 'You' : sender.name}
                          </p>
                          {sender.role === 'teacher' && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                              Teacher
                            </span>
                          )}
                        </div>
                      )}
                      <p className="whitespace-pre-wrap text-sm">{msg.message}</p>
                      <p className={`mt-2 text-[10px] ${isMine ? 'text-slate-500' : 'text-slate-400'}`}>
                        {formatTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={endRef} />
            </div>

            <form onSubmit={handleSend} className="border-t border-slate-200 bg-[#f0f2f5] p-4">
              <div className="flex items-end gap-3 rounded-3xl border border-slate-300 bg-white p-3 focus-within:border-emerald-500">
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Write a message..."
                  rows={2}
                  className="max-h-28 flex-1 resize-none bg-transparent text-sm outline-none"
                />
                <button
                  type="submit"
                  disabled={sending || !messageText.trim()}
                  className="rounded-full bg-[#25d366] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1ebe5d] disabled:opacity-60"
                >
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-10 text-center">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">No chat selected</h2>
              <p className="mt-2 text-sm text-slate-600">Choose a conversation from the sidebar to start chatting.</p>
            </div>
          </div>
        )}
      </main>
    </section>
  )
}

export default Chat
