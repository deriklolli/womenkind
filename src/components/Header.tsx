'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="absolute top-0 left-0 right-0 z-50 px-6 pt-6">
      {/* Frosted glass pill nav */}
      <div className="nav-glass max-w-7xl mx-auto px-6 md:px-8 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center shrink-0">
          <Image
            src="/womenkind-logo.png"
            alt="Womenkind"
            width={160}
            height={40}
            priority
            className="h-8 w-auto brightness-0 invert"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8 lg:gap-10">
          <Link
            href="/womenjourney"
            className="text-white/90 hover:text-white transition-colors text-sm font-medium flex items-center gap-1.5"
          >
            WomenJourney
            <svg className="w-3.5 h-3.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </Link>
          <Link
            href="/services"
            className="text-white/90 hover:text-white transition-colors text-sm font-medium flex items-center gap-1.5"
          >
            Services
            <svg className="w-3.5 h-3.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </Link>
          <Link
            href="/how-care-works"
            className="text-white/90 hover:text-white transition-colors text-sm font-medium flex items-center gap-1.5"
          >
            How Care Works
            <svg className="w-3.5 h-3.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </Link>
          <Link
            href="/about"
            className="text-white/90 hover:text-white transition-colors text-sm font-medium flex items-center gap-1.5"
          >
            About
            <svg className="w-3.5 h-3.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </Link>
        </nav>

        {/* CTA Button */}
        <Link href="/intake" className="hidden md:inline-flex btn-primary">
          Let&apos;s Get Started
          <span className="btn-arrow">&#8594;</span>
        </Link>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-white"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden mt-2 nav-glass px-6 py-6 space-y-4">
          <Link href="/womenjourney" className="block text-white/90 hover:text-white text-sm font-medium" onClick={() => setMobileOpen(false)}>
            WomenJourney
          </Link>
          <Link href="/services" className="block text-white/90 hover:text-white text-sm font-medium" onClick={() => setMobileOpen(false)}>
            Services
          </Link>
          <Link href="/how-care-works" className="block text-white/90 hover:text-white text-sm font-medium" onClick={() => setMobileOpen(false)}>
            How Care Works
          </Link>
          <Link href="/about" className="block text-white/90 hover:text-white text-sm font-medium" onClick={() => setMobileOpen(false)}>
            About
          </Link>
          <div className="pt-2">
            <Link href="/intake" className="btn-primary w-full justify-center" onClick={() => setMobileOpen(false)}>
              Let&apos;s Get Started
              <span className="btn-arrow">&#8594;</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
