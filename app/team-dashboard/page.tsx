"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import TeamDashboard from "@/components/team/team-dashboard"
import { useActivityHeartbeat } from "@/hooks/use-activity-heartbeat"

export default function TeamDashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Send periodic heartbeat to track online status
  useActivityHeartbeat()

  useEffect(() => {
    if (status === "loading") return // Still loading

    if (!session) {
      router.push("/auth/signin")
      return
    }

    if (session.user?.role !== "TEAM_USER") {
      router.push("/dashboard") // Redirect admin to main dashboard
      return
    }
  }, [session, status, router])

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!session || session.user?.role !== "TEAM_USER") {
    return null
  }

  return <TeamDashboard />
}
