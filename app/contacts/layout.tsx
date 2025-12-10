// Contacts layout - no longer wraps with Providers
// because root layout.tsx already provides all contexts globally
export default function ContactsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
