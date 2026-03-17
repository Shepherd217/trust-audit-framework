// Server component wrapper - forces dynamic rendering
export const dynamic = 'force-dynamic';

import DashboardClient from './dashboard-client';

export default function DashboardPage() {
  return <DashboardClient />;
}
