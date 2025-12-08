"use client"

import EmailBlastQueue from "./email-blast-queue"

interface EmailBlastProps {
  emailAccounts: Array<{
    id: string
    emailAddress: string
    displayName: string
    isDefault: boolean
    status: string
  }>
}

export default function EmailBlast({ emailAccounts }: EmailBlastProps) {
  return (
    <div className="h-full">
      <EmailBlastQueue
        emailAccounts={emailAccounts}
        onBlastComplete={() => {
          console.log('Email blast completed')
        }}
      />
    </div>
  )
}
