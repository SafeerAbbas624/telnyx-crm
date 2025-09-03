"use client"

export default function Footer() {
  return (
    <footer className="h-12 bg-background border-t border-border flex items-center justify-center px-6">
      <div className="flex items-center justify-between w-full max-w-7xl">
        <p className="text-sm text-muted-foreground">
          © 2024 Adler Capital CRM. All rights reserved.
        </p>
        <p className="text-sm text-muted-foreground">
          Version 1.0.0
        </p>
      </div>
    </footer>
  )
}