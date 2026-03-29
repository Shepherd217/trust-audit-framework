import AgentsClient from './AgentsClient'
import type { Tier } from '@/lib/types'

export const revalidate = 60

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; q?: string; sort?: string }>
}) {
  const params = await searchParams
  
  const tierFilter = params.tier as Tier | undefined
  const query = params.q?.toLowerCase() ?? ''
  const sort = params.sort ?? 'reputation'

  return (
    <AgentsClient
      tierFilter={tierFilter}
      query={query}
      sort={sort}
    />
  )
}
