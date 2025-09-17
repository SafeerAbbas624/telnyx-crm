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
import { Badge } from "@/components/ui/badge"
import { Bell, Moon, Sun, User, Settings, LogOut } from "lucide-react"
import { useTheme } from "next-themes"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { useNotifications } from "@/lib/context/notifications-context"
import { MessageSquare, Mail as MailIcon } from "lucide-react"

export default function Header() {
  const { items, unreadCount, markAllRead, clear } = useNotifications()
  const { theme, setTheme } = useTheme()
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

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

  return (
    <header className="h-16 md:h-20 bg-background border-b border-border flex items-center justify-between px-6 gap-4">
      {/* Brand */}
      <div className="flex items-center gap-2">
        <Image src={Logo as any} alt="Logo" className="h-24 w-auto md:h-28" priority />
        <span className="text-xl font-semibold hidden sm:inline">Adler Capital CRM</span>
      </div>
      <div className="flex items-center gap-2">

      {/* Notifications */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                {unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-96">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Notifications</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={markAllRead}>Mark all read</Button>
              <Button variant="ghost" size="sm" onClick={clear}>Clear</Button>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {items.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No notifications</div>
          ) : (
            items.slice(0, 10).map((n) => (
              <DropdownMenuItem key={n.id} className="cursor-pointer" onClick={() => {
                try {
                  const url = new URL(window.location.href)
                  if (n.kind === 'sms') url.searchParams.set('section', 'messaging')
                  else url.searchParams.set('section', 'email')
                  if (n.contactId) url.searchParams.set('contactId', n.contactId)
                  url.pathname = '/dashboard'
                  window.location.assign(url.toString())
                } catch {}
              }}>
                <div className="flex items-start gap-3 py-1">
                  {n.kind === 'sms' ? (
                    <MessageSquare className="h-4 w-4 mt-1 text-blue-600" />
                  ) : (
                    <MailIcon className="h-4 w-4 mt-1 text-emerald-600" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{n.contactName || n.fromEmail || 'Unknown'}</p>
                      {!n.read && <Badge variant="destructive">New</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{n.preview || ''}</p>
                  </div>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Theme Toggle */}
      <Button variant="ghost" size="icon" onClick={toggleTheme}>
        <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Toggle theme</span>
      </Button>

      {/* User Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full">
            <Avatar className="h-10 w-10">
              <AvatarImage src="/avatars/user.jpg" alt="User" />
              <AvatarFallback>
                <User className="h-5 w-5" />
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