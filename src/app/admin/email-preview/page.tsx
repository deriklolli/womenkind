import { buildEngagementEmail } from '@/lib/engagement'

const FAKE_PATIENT_ID = 'preview-patient-00000000-0000-0000-0000-000000000000'
const APP_URL = 'https://www.womenkindhealth.com'

const EMAILS: { label: string; subject: string; html: string; phi_note?: string }[] = [
  {
    label: 'Weekly Nudge',
    subject: 'Your weekly check-in is ready',
    html: buildEngagementEmail({
      heading: 'Time for your weekly check-in',
      bodyHtml: `<p style="margin:0 0 16px;font-size:16px;color:rgba(66,42,31,0.7);line-height:1.6;">Hi Sarah, your weekly symptom check-in takes about 60 seconds and helps Dr. Urban track your progress over time.</p>`,
      ctaText: 'Log Check-In',
      ctaUrl: `${APP_URL}/patient/dashboard`,
      patientId: FAKE_PATIENT_ID,
    }),
  },
  {
    label: 'Missed Check-ins',
    subject: "We've missed you",
    html: buildEngagementEmail({
      heading: "We've missed you, Sarah",
      bodyHtml: `<p style="margin:0 0 16px;font-size:16px;color:rgba(66,42,31,0.7);line-height:1.6;">Life gets busy &mdash; we get it. Your symptom data is most useful when it&rsquo;s consistent, but there&rsquo;s no pressure. Jump back in whenever you&rsquo;re ready.</p>`,
      ctaText: 'Log a Check-In',
      ctaUrl: `${APP_URL}/patient/dashboard`,
      patientId: FAKE_PATIENT_ID,
    }),
  },
  {
    label: 'No Login (30+ days)',
    subject: 'Your care team is still here',
    html: buildEngagementEmail({
      heading: 'Your care team is still here',
      bodyHtml: `<p style="margin:0 0 16px;font-size:16px;color:rgba(66,42,31,0.7);line-height:1.6;">Hi Sarah &mdash; we haven&rsquo;t gone anywhere. Your health journey continues whenever you&rsquo;re ready to pick it up. Log in to see your progress and connect with Dr. Urban.</p>`,
      ctaText: 'Go to My Dashboard',
      ctaUrl: `${APP_URL}/patient/dashboard`,
      patientId: FAKE_PATIENT_ID,
    }),
  },
  {
    label: 'Rx Refill Reminder',
    subject: 'Time to request a refill',
    html: buildEngagementEmail({
      heading: 'Time to request a refill',
      bodyHtml: `<p style="margin:0 0 16px;font-size:16px;color:rgba(66,42,31,0.7);line-height:1.6;">Your <strong>Estradiol 0.025mg patch</strong> prescription runs out around <strong>May 15</strong>. Request your refill now to avoid a gap in your treatment.</p>`,
      ctaText: 'Request Refill',
      ctaUrl: `${APP_URL}/patient/dashboard`,
      patientId: FAKE_PATIENT_ID,
    }),
    phi_note: 'Medication name appears in body only, not in subject line.',
  },
  {
    label: 'Post-Visit Follow-up',
    subject: 'How are you feeling after your visit?',
    html: buildEngagementEmail({
      heading: 'How are you feeling after your visit?',
      bodyHtml: `<p style="margin:0 0 16px;font-size:16px;color:rgba(66,42,31,0.7);line-height:1.6;">Hi Sarah &mdash; we hope your visit with Dr. Urban went well. Your next check-in is a great way to start tracking progress against your care plan. And if you have any questions, we&rsquo;re always here.</p>`,
      ctaText: 'Log a Check-In',
      ctaUrl: `${APP_URL}/patient/dashboard`,
      secondaryCtaText: 'Message Dr. Urban',
      secondaryCtaUrl: `${APP_URL}/patient/dashboard`,
      patientId: FAKE_PATIENT_ID,
    }),
    phi_note: 'Subject reveals a medical visit occurred — visible in phone notification previews.',
  },
  {
    label: 'Score Drop Alert',
    subject: 'A message from your care team',
    html: buildEngagementEmail({
      heading: 'We noticed a change in your symptoms',
      bodyHtml: `<p style="margin:0 0 16px;font-size:16px;color:rgba(66,42,31,0.7);line-height:1.6;">Hi Sarah &mdash; your most recent check-in shows an increase in symptoms compared to last week. This can happen during treatment. If you&rsquo;re concerned, reach out to Dr. Urban directly.</p>`,
      ctaText: 'Message Dr. Urban',
      ctaUrl: `${APP_URL}/patient/dashboard`,
      secondaryCtaText: 'View Your Score',
      secondaryCtaUrl: `${APP_URL}/patient/dashboard`,
      patientId: FAKE_PATIENT_ID,
    }),
  },
  {
    label: 'Monthly Recap',
    subject: 'Your April progress with Womenkind',
    html: buildEngagementEmail({
      heading: 'Your April progress',
      bodyHtml: `
        <p style="margin:0 0 20px;font-size:16px;color:rgba(66,42,31,0.7);line-height:1.6;">Hi Sarah, here&rsquo;s your April summary.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ee;border-radius:14px;padding:20px;margin:0 0 20px;">
          <tr>
            <td style="text-align:center;padding:8px 16px;">
              <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(66,42,31,0.45);">Womenkind Score</p>
              <p style="margin:4px 0 0;font-size:32px;font-weight:700;color:#280f49;">72</p>
              <p style="margin:4px 0 0;font-size:13px;"><span style="color:#0e7a5a">&#9650; 4.5 pts</span> from last month</p>
            </td>
            <td style="text-align:center;padding:8px 16px;">
              <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(66,42,31,0.45);">Check-ins</p>
              <p style="margin:4px 0 0;font-size:32px;font-weight:700;color:#280f49;">18</p>
              <p style="margin:4px 0 0;font-size:13px;color:rgba(66,42,31,0.5);">in the past 30 days</p>
            </td>
            <td style="text-align:center;padding:8px 16px;">
              <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(66,42,31,0.45);">Most Improved</p>
              <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#280f49;">Sleep</p>
            </td>
          </tr>
        </table>
      `,
      ctaText: 'View Your Dashboard',
      ctaUrl: `${APP_URL}/patient/dashboard`,
      patientId: FAKE_PATIENT_ID,
    }),
  },
  {
    label: 'Lab Results Ready',
    subject: 'Your lab results are ready',
    html: buildEngagementEmail({
      heading: 'Your lab results are ready',
      bodyHtml: `<p style="margin:0 0 16px;font-size:16px;color:rgba(66,42,31,0.7);line-height:1.6;">Hi Sarah &mdash; your lab results are now available. Dr. Urban will review them and may follow up with you directly if anything needs attention.</p>`,
      ctaText: 'View in Dashboard',
      ctaUrl: `${APP_URL}/patient/dashboard`,
      patientId: FAKE_PATIENT_ID,
    }),
    phi_note: 'Subject reveals lab testing occurred — standard in healthcare communications.',
  },
]

export default function EmailPreviewPage() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#1a1a2e', minHeight: '100vh', padding: '32px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <h1 style={{ color: '#ffffff', fontSize: 24, fontWeight: 600, margin: '0 0 8px' }}>
          Email Preview
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', margin: '0 0 40px', fontSize: 14 }}>
          All 8 engagement email templates with sample data. Rendered exactly as patients receive them.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gap: 32 }}>
          {EMAILS.map((email) => (
            <div key={email.label} style={{ background: '#0f0f1a', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: '#944fed', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {email.label}
                  </span>
                  {email.phi_note && (
                    <span style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308', fontSize: 11, padding: '2px 8px', borderRadius: 100, fontWeight: 600 }}>
                      PHI note
                    </span>
                  )}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                  <span style={{ color: 'rgba(255,255,255,0.35)' }}>Subject: </span>
                  {email.subject}
                </div>
                {email.phi_note && (
                  <div style={{ color: '#eab308', fontSize: 11, marginTop: 2 }}>
                    ⚠ {email.phi_note}
                  </div>
                )}
              </div>
              <iframe
                srcDoc={email.html}
                style={{ width: '100%', height: 520, border: 'none', display: 'block', background: '#f7f3ee' }}
                title={email.label}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
