"use client"

import React from "react"
import { Phone, Check, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { usePhoneNumber } from "@/lib/context/phone-number-context"
import { formatPhoneNumberForDisplay } from "@/lib/phone-utils"
import { Badge } from "@/components/ui/badge"

export default function HeaderPhoneSelector() {
  const { selectedPhoneNumber, setSelectedPhoneNumber, availablePhoneNumbers, isLoading } = usePhoneNumber()

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <Phone className="h-4 w-4 animate-pulse" />
        <span className="hidden md:inline">Loading...</span>
      </div>
    )
  }

  if (availablePhoneNumbers.length === 0) {
    return null
  }

  const displayNumber = selectedPhoneNumber 
    ? formatPhoneNumberForDisplay(selectedPhoneNumber.phoneNumber)
    : "Select Number"

  const displayName = selectedPhoneNumber?.friendlyName || displayNumber

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="flex items-center gap-2 h-9 px-3 border-green-200 hover:border-green-300 hover:bg-green-50 dark:border-green-800 dark:hover:border-green-700 dark:hover:bg-green-950"
        >
          <Phone className="h-4 w-4 text-green-600 dark:text-green-400" />
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-xs font-medium leading-none">
              {displayName}
            </span>
            {selectedPhoneNumber?.friendlyName && (
              <span className="text-[10px] text-muted-foreground leading-none">
                {displayNumber}
              </span>
            )}
          </div>
          <ChevronDown className="h-3 w-3 text-muted-foreground ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Phone className="h-4 w-4" />
          Select Calling Number
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {availablePhoneNumbers.map((phoneNumber) => {
          const isSelected = selectedPhoneNumber?.phoneNumber === phoneNumber.phoneNumber
          const formattedNumber = formatPhoneNumberForDisplay(phoneNumber.phoneNumber)
          
          return (
            <DropdownMenuItem
              key={phoneNumber.id}
              onClick={() => setSelectedPhoneNumber(phoneNumber)}
              className="flex items-center justify-between gap-2 cursor-pointer py-3"
            >
              <div className="flex flex-col gap-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {phoneNumber.friendlyName || formattedNumber}
                  </span>
                  {isSelected && (
                    <Check className="h-4 w-4 text-green-600" />
                  )}
                </div>
                {phoneNumber.friendlyName && (
                  <span className="text-xs text-muted-foreground">
                    {formattedNumber}
                  </span>
                )}
              </div>
              {isSelected && (
                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                  Active
                </Badge>
              )}
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <div className="px-2 py-2 text-xs text-muted-foreground">
          All calls will be made from the selected number
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

