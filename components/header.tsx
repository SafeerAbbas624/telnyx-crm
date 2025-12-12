"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Image from "next/image"
import Logo from "../Adler Capital.png"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { User, Settings, LogOut, OctagonX } from "lucide-react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import GlobalSearch from "./global-search"
import HeaderPhoneSelector from "./header-phone-selector"
import ThemeSelector from "./theme-selector"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export default function Header() {
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [killingSending, setKillingSending] = useState(false)

  const handleLogout = async () => {
    try {
      toast({
        title: "Logging out...",
        description: "Please wait while we sign you out.",
      })

      await signOut({
        callbackUrl: "/auth/signin",
        redirect: true
      })
    } catch (error) {
      console.error("Logout error:", error)
      toast({
        title: "Logout Error",
        description: "There was an error signing you out. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleSettings = () => {
    // Navigate to the settings tab within the dashboard
    router.push("/?section=settings")
  }

  const handleKillAllSending = async () => {
    setKillingSending(true)
    console.log('🛑 [KILL SWITCH] Starting kill all blasts...')
    try {
      // Kill all text blasts
      const textRes = await fetch('/api/text-blast/kill-all', { method: 'POST' })
      const textData = await textRes.json()
      console.log('🛑 [KILL SWITCH] Text blasts result:', textData)

      // Kill all call campaigns
      const callRes = await fetch('/api/call-campaigns/kill-all', { method: 'POST' })
      const callData = await callRes.json()
      console.log('🛑 [KILL SWITCH] Call campaigns result:', callData)

      // Kill all email blasts
      const emailRes = await fetch('/api/email-blast/kill-all', { method: 'POST' })
      const emailData = await emailRes.json()
      console.log('🛑 [KILL SWITCH] Email blasts result:', emailData)

      const totalKilled = (textData.cancelledCount || 0) + (emailData.count || 0) + (callData.cancelledCount || 0)
      console.log(`🛑 [KILL SWITCH] ✅ Total killed: ${totalKilled}`)

      toast({
        title: "🛑 All Sending Stopped",
        description: `Cancelled ${textData.cancelledCount || 0} text blasts, ${emailData.count || 0} email blasts, and ${callData.cancelledCount || 0} call campaigns.`,
      })
    } catch (error) {
      console.error("🛑 [KILL SWITCH] Error:", error)
      toast({
        title: "Error",
        description: "Failed to stop some operations. Try refreshing the page.",
        variant: "destructive",
      })
    } finally {
      setKillingSending(false)
    }
  }

  return (
    <header className="h-16 md:h-20 bg-background border-b border-border flex items-center justify-between px-6 gap-4">
      {/* Brand */}
      <div className="flex items-center gap-2">
        <Image src={Logo as any} alt="Logo" className="h-24 w-auto md:h-28" priority />
        <span className="text-xl font-semibold hidden sm:inline">Adler Capital CRM</span>
      </div>

      {/* Global Search */}
      <div className="flex-1 max-w-2xl mx-4">
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-2">
      {/* Phone Number Selector */}
      <HeaderPhoneSelector />

      {/* Emergency Kill Switch */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative hover:bg-red-100 text-red-600 hover:text-red-700"
            title="Emergency: Stop All Sending"
          >
            <OctagonX className="h-[1.2rem] w-[1.2rem]" />
            <span className="sr-only">Emergency Stop</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">🛑 Emergency Stop All Sending</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately stop <strong>ALL</strong> running text blasts, email blasts, and call campaigns.
              Messages that are already queued may still be sent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleKillAllSending}
              disabled={killingSending}
              className="bg-red-600 hover:bg-red-700"
            >
              {killingSending ? "Stopping..." : "Stop All Sending"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Theme Selector */}
      <ThemeSelector />

      {/* User Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full">
            <Avatar className="h-10 w-10">
              {(session?.user as any)?.avatar && (
                <AvatarImage src={(session?.user as any).avatar} alt="User" />
              )}
              <AvatarFallback className="bg-orange-100 text-orange-600">
                {session?.user?.email?.charAt(0).toUpperCase() || <User className="h-5 w-5" />}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                {session?.user?.name || "Admin User"}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {session?.user?.email || "admin@adlercapital.com"}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSettings} className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>

    </header>
  )
}