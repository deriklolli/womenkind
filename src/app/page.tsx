import Header from '@/components/Header'
import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* ============================================
          HERO — Full-bleed image with overlaid text
          Matches Figma page 5: Homepage hero
          ============================================ */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Background image — warm golden-hour photography */}
        {/* Replace this gradient placeholder with actual hero image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('/hero-home.jpg')`,
            backgroundColor: '#3d2415',
          }}
        >
          {/* Warm fallback gradient for when image isn't loaded */}
          <div className="absolute inset-0 bg-gradient-to-br from-aubergine via-aubergine/80 to-amber-900/60" />
        </div>

        {/* Dark gradient overlay for text readability */}
        <div className="hero-overlay absolute inset-0" />

        {/* Hero content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 pt-32 pb-20 w-full">
          <div className="max-w-[700px]">
            <h1 className="text-white mb-8">
              Menopause Care That Meets Women With Kindness
            </h1>
            <p className="text-white/80 text-lg md:text-xl leading-relaxed mb-10 max-w-[580px] font-sans">
              WomenKind provides physician-led menopause care for women in
              midlife. We start by listening, then apply evidence-based hormone
              therapy and advanced diagnostics.
            </p>
            <Link href="/intake" className="btn-primary text-base">
              Let&apos;s Figure Out What&apos;s Going on Together
              <span className="btn-arrow">&#8594;</span>
            </Link>
          </div>

          {/* Stats block — positioned right side on desktop */}
          <div className="mt-16 md:absolute md:bottom-20 md:right-12 flex items-start gap-8">
            <div className="text-center md:text-left">
              <p className="font-serif text-7xl md:text-8xl text-white leading-none">80%</p>
              <p className="text-white/80 text-sm mt-3 max-w-[200px] font-sans">
                Of women experience menopause symptoms that disrupt daily life,
                including hot flashes, sleep disruption, brain fog, and mood changes.
              </p>
            </div>
            <div className="stat-divider hidden md:block" />
            <div className="text-center md:text-left">
              <p className="font-serif text-7xl md:text-8xl text-white leading-none">2%</p>
              <p className="text-white/80 text-sm mt-3 max-w-[220px] font-sans">
                Less than of women receive physician led hormone therapy, despite
                strong clinical evidence supporting its safety and effectiveness
                when properly prescribed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          OUR CARE SERVICES — Cream bg section
          ============================================ */}
      <section className="section-cream py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="text-center mb-16">
            <p className="section-label mb-4">&#8226; Our Services &#8226;</p>
            <h2 className="mb-6">
              Physician-Led Menopause<br />
              <span className="italic text-violet">&amp; Midlife Care</span>
            </h2>
            <p className="text-beige/80 text-lg max-w-2xl mx-auto font-sans">
              Personalized, physician-led menopause care designed to support
              women through every stage of midlife.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Perimenopause & Menopause',
                desc: 'Care for every stage of menopause.',
              },
              {
                title: 'Sexual Health',
                desc: 'Discreet, physician-led care to support comfort, intimacy, and libido.',
              },
              {
                title: 'Hormone Optimization',
                desc: 'Thoughtful support for hormone balance.',
              },
              {
                title: 'Preventive Diagnostics',
                desc: 'Advanced testing for proactive care.',
              },
              {
                title: 'Longevity & Metabolic Health',
                desc: 'Support for energy and metabolic health.',
              },
              {
                title: 'Hair Loss',
                desc: 'Care for hormone-related hair changes.',
              },
            ].map((service) => (
              <div
                key={service.title}
                className="bg-white p-8 rounded-card hover:shadow-lg transition-shadow duration-300 group cursor-pointer"
              >
                {/* Placeholder for service thumbnail */}
                <div className="w-full h-40 rounded-xl bg-gradient-to-br from-natural/30 to-airborne/30 mb-6" />
                <h3 className="text-lg font-serif mb-2">{service.title}</h3>
                <p className="text-beige/70 text-sm font-sans">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          HOW CARE WORKS — Dark aubergine section
          ============================================ */}
      <section className="bg-aubergine py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="text-center mb-16">
            <p className="section-label text-natural/80 mb-4">&#8226; Our Care Philosophy &#8226;</p>
            <h2 className="text-white mb-6">
              Your Care, Step by Step
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                step: '01',
                title: 'Symptom Evaluation',
                desc: 'Hormonal, physical, cognitive, and sexual health changes are reviewed in detail.',
              },
              {
                step: '02',
                title: 'Lifestyle Context',
                desc: 'Sleep, nutrition, stress, and daily demands — factors that influence midlife physiology.',
              },
              {
                step: '03',
                title: 'Personal Priorities',
                desc: 'We discuss what feeling well means for you — deeper sleep, clearer thinking, restored intimacy.',
              },
              {
                step: '04',
                title: 'Personalized Clinical Plan',
                desc: 'A clear, evidence-based strategy based on your symptoms, labs, and long-term health goals.',
              },
            ].map((step) => (
              <div key={step.step} className="text-center md:text-left">
                <p className="text-violet font-sans font-bold text-sm mb-3">{step.step}</p>
                <h3 className="text-white font-serif text-xl mb-3">{step.title}</h3>
                <p className="text-natural/70 text-sm font-sans leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-14">
            <Link href="/how-care-works" className="btn-secondary">
              See How Care Works
              <span className="btn-arrow">&#8594;</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================
          ABOUT — Cream section with mission text
          ============================================ */}
      <section className="section-cream py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="section-label mb-4">&#8226; About WomenKind &#8226;</p>
              <h2 className="mb-6">
                Listening at WomenKind<br />
                <span className="italic text-violet">means time.</span>
              </h2>
              <p className="text-beige/80 text-base leading-relaxed mb-6 font-sans">
                Your initial consultation is a dedicated two-hour clinical
                immersion designed to fully understand your symptoms, history,
                and goals. Ongoing care includes unlimited communication with
                your medical team, timely responses, and follow-up visits as
                needed so your treatment can evolve with you.
              </p>
              <p className="text-beige/80 text-base leading-relaxed mb-8 font-sans">
                These transitions deserve thoughtful, physician-led care, not
                something to simply endure. We listen closely, look deeper, and
                create personalized plans through hormone therapy, advanced
                diagnostics, and ongoing support.
              </p>
              <Link href="/intake" className="btn-primary">
                Let&apos;s Figure Out What&apos;s Going on Together
                <span className="btn-arrow">&#8594;</span>
              </Link>
            </div>

            {/* Image placeholder */}
            <div className="relative">
              <div className="w-full aspect-[4/5] rounded-card bg-gradient-to-br from-natural/40 via-natural/20 to-aubergine/10 overflow-hidden">
                {/* Replace with actual about image */}
                <div className="absolute inset-0 flex items-center justify-center text-beige/30 font-sans text-sm">
                  About Image
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          CTA BANNER — Full-bleed with image bg
          ============================================ */}
      <section className="relative py-24 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-aubergine via-aubergine/90 to-violet/80" />
        <div className="hero-overlay absolute inset-0" />
        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-white mb-6">
            Ready to take control of your menopause journey?
          </h2>
          <p className="text-natural/80 text-lg mb-10 max-w-xl mx-auto font-sans">
            Start with a guided conversation — it takes about 10 minutes
            and gives your provider everything they need to help you feel like
            yourself again.
          </p>
          <Link href="/intake" className="btn-primary text-base">
            Let&apos;s Get Started
            <span className="btn-arrow">&#8594;</span>
          </Link>
        </div>
      </section>

      {/* ============================================
          FOOTER
          ============================================ */}
      <footer className="bg-aubergine-dark py-14">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="text-center md:text-left">
              <p className="text-natural font-serif text-xl mb-1">Womenkind</p>
              <p className="text-natural/50 text-sm font-sans">An Allkind company</p>
            </div>
            <div className="flex gap-8 text-sm font-sans">
              <Link href="#" className="text-natural/60 hover:text-natural transition-colors">
                Privacy Policy
              </Link>
              <Link href="#" className="text-natural/60 hover:text-natural transition-colors">
                Terms of Service
              </Link>
              <Link href="#" className="text-natural/60 hover:text-natural transition-colors">
                Contact
              </Link>
            </div>
            <p className="text-natural/40 text-sm font-sans">
              &copy; {new Date().getFullYear()} Womenkind. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
