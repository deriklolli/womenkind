'use client'

import { useParams } from 'next/navigation'
import ProviderNav from '@/components/provider/ProviderNav'
import ClinicalBriefView from '@/components/provider/ClinicalBriefView'

export default function BriefViewerPage() {
  const params = useParams()
  const intakeId = params.id as string

  return (
    <div className="min-h-screen bg-cream">
      <ProviderNav />
      <div className="max-w-7xl mx-auto px-6 py-6">
        <ClinicalBriefView intakeId={intakeId} />
      </div>
    </div>
  )
}
