import './globals.css'

export const metadata = {
  title: 'TAP - Trust Audit Protocol',
  description: 'First verified agent economy',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-slate-900 text-white">{children}</body>
    </html>
  )
}
