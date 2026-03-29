import { redirect } from 'next/navigation'

export default function AgentRedirect({ params }: { params: { id: string } }) {
  redirect(`/agenthub/${params.id}`)
}
