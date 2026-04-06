import Image from 'next/image'

export const metadata = {
  title: 'Privacy Policy | Womenkind',
}

export default function PrivacyPolicyPage() {
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

        <h1 className="font-serif text-3xl text-aubergine tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-sm font-sans text-aubergine/40 mb-10">Last updated: April 6, 2026</p>

        <div className="space-y-8 text-sm font-sans text-aubergine/70 leading-relaxed">
          <section>
            <h2 className="font-serif text-lg text-aubergine mb-3">1. Introduction</h2>
            <p>
              Womenkind, operated by Iron Gate Management Services LLC (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), is a telehealth platform providing menopause and midlife care services. This Privacy Policy describes how we collect, use, disclose, and protect your personal information when you use our website, applications, and services (collectively, the &ldquo;Services&rdquo;).
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg text-aubergine mb-3">2. Information We Collect</h2>
            <p className="mb-3">We collect the following categories of information:</p>
            <p>
              <strong className="text-aubergine">Account Information:</strong> Name, email address, date of birth, phone number, and state of residence provided during registration.
            </p>
            <p className="mt-2">
              <strong className="text-aubergine">Health Information:</strong> Symptoms, medical history, and health questionnaire responses provided through our intake process. This information is used to facilitate your clinical care.
            </p>
            <p className="mt-2">
              <strong className="text-aubergine">Wearable Device Data:</strong> If you choose to connect a wearable device (such as an Oura Ring), we collect biometric data including sleep patterns, heart rate variability, skin temperature, and resting heart rate. This data is collected only with your explicit consent through the device manufacturer&apos;s authorization process, and you may disconnect your device at any time.
            </p>
            <p className="mt-2">
              <strong className="text-aubergine">Payment Information:</strong> Billing details are processed securely through Stripe. We do not store credit card numbers on our servers.
            </p>
            <p className="mt-2">
              <strong className="text-aubergine">Communications:</strong> Messages exchanged with your care team through our secure messaging system.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg text-aubergine mb-3">3. How We Use Your Information</h2>
            <p>
              We use your information to provide and improve our clinical care services, including facilitating consultations with your provider, generating personalized care plans, tracking your health progress over time, processing payments, and communicating with you about your care. Wearable device data is used to provide your care team with objective health metrics between visits, enabling more informed clinical decisions.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg text-aubergine mb-3">4. How We Share Your Information</h2>
            <p>
              We do not sell your personal information. We share your information only with your assigned healthcare providers for clinical care purposes, with service providers who assist in operating our platform (such as Supabase for data storage, Stripe for payments, and Resend for transactional emails), and when required by law or to protect our legal rights. Wearable device data is shared only with your care team and is not used for advertising or sold to third parties.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg text-aubergine mb-3">5. Wearable Device Integration</h2>
            <p>
              When you connect a wearable device, you authorize us to access specific health data through the device manufacturer&apos;s API. You control which data we can access through the authorization process. You may disconnect your device at any time from your patient dashboard, which will stop future data collection. Historical data collected prior to disconnection is retained as part of your medical record unless you request its deletion.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg text-aubergine mb-3">6. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your information, including encryption of data in transit and at rest, encrypted storage of authentication tokens, role-based access controls, and secure hosting infrastructure. While no system is completely secure, we take reasonable measures to protect your personal and health information.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg text-aubergine mb-3">7. Your Rights</h2>
            <p>
              You have the right to access your personal information, request correction of inaccurate data, request deletion of your data (subject to legal retention requirements), disconnect wearable devices and stop biometric data collection, and cancel your account at any time. To exercise these rights, contact us at support@womenkind.com.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg text-aubergine mb-3">8. Data Retention</h2>
            <p>
              We retain your health information in accordance with applicable medical record retention laws. Account information is retained for as long as your account is active. Wearable device data is retained as part of your health record. You may request deletion of your account and associated data by contacting us.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg text-aubergine mb-3">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the updated policy on our website and updating the &ldquo;Last updated&rdquo; date.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg text-aubergine mb-3">10. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or our data practices, please contact us at support@womenkind.com.
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
