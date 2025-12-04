import { redirect } from 'next/navigation'

export default function Home() {
  // Redirect to sign-in page - only authenticated users should access the CRM
  redirect('/auth/signin')
}
