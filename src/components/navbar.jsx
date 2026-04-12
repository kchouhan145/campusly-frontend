import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'

const links = [
	{ label: 'Home', to: '/' },
	{ label: 'Events', to: '/events' },
	{ label: 'Lost & Found', to: '/lostfound' },
	{ label: 'Marketplace', to: '/marketplace' },
	{ label: 'Chat', to: '/chat' },
	{ label: 'Profile', to: '/profile' },
]

const ROLE_KEY = 'campuslyUserRole'

const getLinkClass = ({ isActive }) =>
	[
		'rounded-md px-3 py-2 text-sm font-medium transition-colors',
		isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-200',
	].join(' ')

function Navbar() {
	const [menuOpen, setMenuOpen] = useState(false)
	const [userRole, setUserRole] = useState(() => localStorage.getItem(ROLE_KEY) || '')

	useEffect(() => {
		const syncRole = () => setUserRole(localStorage.getItem(ROLE_KEY) || '')
		syncRole()
		window.addEventListener('storage', syncRole)
		window.addEventListener('focus', syncRole)
		window.addEventListener('campusly-role-changed', syncRole)
		return () => {
			window.removeEventListener('storage', syncRole)
			window.removeEventListener('focus', syncRole)
			window.removeEventListener('campusly-role-changed', syncRole)
		}
	}, [])

	const visibleLinks = userRole === 'admin'
		? [...links, { label: 'Admin', to: '/admin' }]
		: links

	return (
		<header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
			<nav className="mx-auto flex max-w-6xl flex-col px-4 py-3 sm:px-6 md:flex-row md:items-center md:justify-between">
				<div className="flex items-center justify-between">
				<NavLink to="/" className="text-lg font-bold tracking-tight text-slate-900">
					Campusly
				</NavLink>

				<button
					type="button"
					onClick={() => setMenuOpen((prev) => !prev)}
					className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 md:hidden"
					aria-label="Toggle navigation menu"
					aria-expanded={menuOpen}
				>
					{menuOpen ? 'Close' : 'Menu'}
				</button>
				</div>

				<div className="mt-3 hidden flex-wrap items-center gap-2 md:mt-0 md:flex">
					{visibleLinks.map((link) => (
						<NavLink key={link.to} to={link.to} className={getLinkClass} end={link.to === '/'}>
							{link.label}
						</NavLink>
					))}
				</div>

				{menuOpen && (
					<div className="mt-3 grid gap-2 border-t border-slate-200 pt-3 md:hidden">
						{visibleLinks.map((link) => (
							<NavLink
								key={link.to}
								to={link.to}
								className={getLinkClass}
								end={link.to === '/'}
								onClick={() => setMenuOpen(false)}
							>
								{link.label}
							</NavLink>
						))}
					</div>
				)}
			</nav>
		</header>
	)
}

export default Navbar
