// import { useState } from 'react'
import './App.css'
import { Route, Routes } from 'react-router-dom'
import Home from "./pages/home"
import Events from "./pages/events"
import LostFound from "./pages/lostfound"
import Marketplace from "./pages/marketplace"
import Profile from "./pages/profile"
import Chat from "./pages/chat"
import AdminUsers from "./pages/adminUsers"
import Navbar from "./components/navbar"

function App() {

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/events" element={<Events />} />
          <Route path="/lostfound" element={<LostFound />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin" element={<AdminUsers />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
