"use client"

import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"

export default function TestToastPage() {
  const { toast } = useToast()

  const handleTestToast = () => {
    console.log("Test toast button clicked")
    toast({
      title: "Test Notification",
      description: "This is a test toast notification",
    })
  }

  const handleMultipleToasts = () => {
    console.log("Multiple toasts button clicked")
    for (let i = 1; i <= 3; i++) {
      setTimeout(() => {
        toast({
          title: `Toast ${i}`,
          description: `This is test toast number ${i}`,
        })
      }, i * 500)
    }
  }

  const handleErrorToast = () => {
    console.log("Error toast button clicked")
    toast({
      title: "Error",
      description: "This is an error notification",
      variant: "destructive",
    })
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Toast Notification Test</h1>
        
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-2">Test Single Toast</h2>
            <Button onClick={handleTestToast}>
              Show Test Toast
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              Click to show a single toast notification. It should auto-dismiss after 3 seconds.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">Test Multiple Toasts</h2>
            <Button onClick={handleMultipleToasts}>
              Show 3 Toasts
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              Click to show 3 toasts with 500ms delay between each. They should stack on top of each other.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">Test Error Toast</h2>
            <Button onClick={handleErrorToast} variant="destructive">
              Show Error Toast
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              Click to show an error toast notification.
            </p>
          </div>

          <div className="mt-8 p-4 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2">Expected Behavior:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Toasts appear in the top-right corner</li>
              <li>Each toast auto-dismisses after 3 seconds</li>
              <li>Multiple toasts stack on top of each other</li>
              <li>You can manually close toasts by clicking the X button</li>
              <li>Error toasts have a red background</li>
            </ul>
          </div>

          <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <h3 className="font-semibold mb-2">Debugging:</h3>
            <p className="text-sm">
              Open the browser console (F12) to see debug logs. Check the Network tab to verify the `/api/events` connection is active.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

