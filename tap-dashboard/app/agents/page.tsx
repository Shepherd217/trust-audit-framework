// Server component wrapper - forces dynamic rendering
export const dynamic = 'force-dynamic';

import AgentsListClient from './agents-list';

export default function AgentsPage() {
  return <AgentsListClient />;
}
