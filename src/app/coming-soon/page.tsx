export const metadata = {
  title: 'Womenkind — Coming Soon',
  description: 'Physician-led menopause and midlife care. Launching soon.',
}

export default function ComingSoonPage() {
  return (
    <main
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
      className="min-h-screen bg-aubergine flex flex-col"
    >
      {/* Subtle warm gradient top bar */}
      <div className="h-1 w-full bg-gradient-to-r from-violet via-terracota to-natural opacity-80" />

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">

        {/* Wordmark */}
        <div className="mb-14">
          <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight leading-none">
            <span className="text-violet">Women</span><span className="text-white">kind</span>
          </h1>
          {/* Underline accent — brand spec */}
          <div className="mt-2 mx-auto h-[3px] w-3/4 rounded-full bg-violet opacity-70" />
        </div>

        {/* Headline */}
        <h2 className="text-white text-2xl sm:text-3xl font-semibold max-w-lg leading-snug mb-5">
          Midlife care that finally takes you seriously.
        </h2>

        {/* Sub-copy */}
        <p className="text-natural text-base sm:text-lg font-light max-w-md leading-relaxed mb-12 opacity-90">
          Physician-led menopause and midlife care — intelligent, personalized, and built around you.
          We're putting the finishing touches on something worth waiting for.
        </p>

        {/* Coming soon pill */}
        <div className="inline-flex items-center gap-2.5 bg-white/8 border border-white/12 rounded-pill px-6 py-3 mb-14">
          <span className="w-2 h-2 rounded-full bg-terracota animate-pulse" />
          <span className="text-natural text-sm font-medium tracking-wide uppercase">
            Launching Soon
          </span>
        </div>

        {/* Divider */}
        <div className="w-16 h-px bg-white/15 mb-10" />

        {/* Physician callout */}
        <p className="text-white/50 text-sm font-light max-w-xs leading-relaxed">
          Founded by{' '}
          <span className="text-natural font-medium">Dr. Joseph Urban Jr.</span>
          {' '}and designed for women who deserve better answers.
        </p>
      </div>

      {/* Footer */}
      <footer className="pb-10 text-center">
        <p className="text-white/25 text-xs tracking-wide">
          womenkindhealth.com &nbsp;·&nbsp; © {new Date().getFullYear()} Womenkind
        </p>
      </footer>
    </main>
  )
}
