"use client"

import RiftsApp from './RiftsApp'

// Disable static generation since this page requires client-side wallet connection
export const dynamic = 'force-dynamic'

export default function DappPage() {
  return <RiftsApp />
}