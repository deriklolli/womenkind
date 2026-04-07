import Image from 'next/image'

export const metadata = {
  title: 'Terms of Service | Womenkind',
}

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Logo */}
        <div className="mb-12">
          <Image
            src="/womenkind-wordmark.svg"
            alt="Womenkind"
            width={160}
            height={32}
            priority
          />
        </div>

        <h1 className="font-sans font-semibold text-3xl text-aubergine tracking-tight mb-2">Terms of Service</h1>
        <p className="text-sm font-sans text-aubergine/40 mb-10">Last updated: April 6, 2026</p>

        <div className="space-y-8 text-sm font-sans text-aubergine/70 leading-relaxed">
          <section>
            <h2 className="font-sans font-semibold text-lg text-aubergine mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Womenkind&apos;s website, applications, and services (collectively, the &ldquo;Services&rdquo;), operated by Iron Gate Management Services LLC, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our Services.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-lg text-aubergine mb-3">2. Description of Services</h2>
            <p>
              Womenkind provides a telehealth platform connecting patients with licensed healthcare providers specializing in menopause and midlife care. Our Services include health intake assessments, virtual consultations, personalized care plans, prescription management, secure messaging with your care team, and optional wearable device integration for biometric health tracking.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-lg text-aubergine mb-3">3. Eligibility</h2>
            <p>
              You must be at least 18 years of age to use our Services. By using our Services, you represent that you are at least 18 years old and have the legal capacity to enter into these terms.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-lg text-aubergine mb-3">4. Account Registration</h2>
            <p>
              To access certain features of our Services, you must create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to provide accurate and complete information during registration and to update your information as needed.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-lg text-aubergine mb-3">5. Medical Disclaimer</h2>
            <p>
              Our Services facilitate access to licensed healthcare providers but do not replace the relationship between you and your primary care physician. The information provided through our platform is for informational purposes and clinical care facilitation only. In case of a medical emergency, call 911 or go to your nearest emergency room. Our Services are not designed for emergency medical situations.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-lg text-aubergine mb-3">6. Wearable Device Integration</h2>
            <p>
              Our Services may allow you to connect third-party wearable devices (such as Oura Ring) to share biometric data with your care team. By connecting a wearable device, you authorize us to access and store the health data you consent to share through the device manufacturer&apos;s authorization process. We are not responsible for the accuracy of data provided by third-party devices. You may disconnect your device at any time through your patient dashboard.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-lg text-aubergine mb-3">7. Payment Terms</h2>
            <p>
              Certain Services require payment, including initial intake consultations and ongoing membership fees. All fees are listed on our platform prior to purchase. Membership subscriptions renew automatically unless canceled before the end of the current billing period. Cancellation takes effect at the end of your current paid period. Payments are processed securely through Stripe.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-lg text-aubergine mb-3">8. Privacy</h2>
            <p>
              Your use of our Services is also governed by our <a href="/privacy" className="text-violet hover:text-violet/80 underline">Privacy Policy</a>, which describes how we collect, use, and protect your personal and health information.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-lg text-aubergine mb-3">9. Prohibited Conduct</h2>
            <p>
              You agree not to misuse our Services, including by providing false information, attempting to access other users&apos; accounts, interfering with the operation of our platform, using our Services for any unlawful purpose, or sharing your account credentials with others.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-lg text-aubergine mb-3">10. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, Iron Gate Management Services LLC and its officers, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of our Services.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-lg text-aubergine mb-3">11. Termination</h2>
            <p>
              We may suspend or terminate your access to our Services at any time for violation of these terms or for any other reason at our discretion. You may cancel your account at any time. Upon termination, your right to use the Services ceases immediately, though certain provisions of these terms will survive termination.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-lg text-aubergine mb-3">12. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms of Service at any time. We will notify you of material changes by posting the updated terms on our website. Your continued use of our Services after such changes constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-lg text-aubergine mb-3">13. Governing Law</h2>
            <p>
              These Terms of Service are governed by the laws of the State of Delaware, without regard to conflict of law principles.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-lg text-aubergine mb-3">14. Contact Us</h2>
            <p>
              If you have questions about these Terms of Service, please contact us at support@womenkind.com.
            </p>
            <p className="mt-3">
              Iron Gate Management Services LLC<br />
              Womenkind
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
