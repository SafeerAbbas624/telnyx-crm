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
import { Moon, Sun, User, Settings, LogOut } from "lucide-react"
import { useTheme } from "next-themes"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import GlobalSearch from "./global-search"

export default function Header() {
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

      {/* Global Search */}
      <div className="flex-1 max-w-2xl mx-4">
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-2">
      {/* Theme Toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className="relative hover:bg-accent"
      >
        <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all duration-200 dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all duration-200 dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Toggle theme</span>
      </Button>

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