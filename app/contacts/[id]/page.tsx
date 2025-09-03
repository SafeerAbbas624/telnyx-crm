"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"
import ContactDetails from "@/components/contacts/contact-details"
import type { Contact } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

export default function ContactPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const { toast } = useToast()
  const [contact, setContact] = useState<Contact | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const contactId = params.id as string

  useEffect(() => {
    if (!session?.user || !contactId) return

    const fetchContact = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch(`/api/contacts/${contactId}`)
        
        if (!response.ok) {
          if (response.status === 404) {
            setError("Contact not found")
          } else if (response.status === 403) {
            setError("You don't have permission to view this contact")
          } else {
            setError("Failed to load contact details")
          }
          return
        }

        const contactData = await response.json()
        setContact(contactData)
      } catch (error) {
        console.error("Error fetching contact:", error)
        setError("Failed to load contact details")
        toast({
          title: "Error",
          description: "Failed to load contact details",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchContact()
  }, [session, contactId, toast])

  const handleBack = () => {
    // Determine where to go back based on user role
    if (session?.user?.role === 'TEAM_MEMBER') {
      router.push('/team-dashboard')
    } else {
      router.push('/dashboard?tab=contacts')
    }
  }

  if (!session?.user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading contact details...</p>
        </div>
      </div>
    )
  }

  if (error || !contact) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {error || "Contact not found"}
            </h1>
            <p className="text-gray-600">
              The contact you're looking for doesn't exist or you don't have permission to view it.
            </p>
          </div>
          <Button onClick={handleBack} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ContactDetails contact={contact} onBack={handleBack} />
    </div>
  )
}
