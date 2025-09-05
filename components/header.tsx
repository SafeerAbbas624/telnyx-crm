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

export default function Header() {
  const [notifications] = useState(3) // Mock notification count
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
            {notifications > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                {notifications}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">New contact added</p>
              <p className="text-xs text-muted-foreground">John Doe was added to your contacts</p>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">Activity reminder</p>
              <p className="text-xs text-muted-foreground">Call scheduled for 2:00 PM today</p>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">Import completed</p>
              <p className="text-xs text-muted-foreground">Successfully imported 150 contacts</p>
            </div>
          </DropdownMenuItem>
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