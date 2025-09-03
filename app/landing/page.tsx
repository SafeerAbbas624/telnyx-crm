"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Users, 
  MessageSquare, 
  Phone, 
  Mail, 
  BarChart3, 
  Shield, 
  Zap, 
  Globe,
  CheckCircle,
  ArrowRight
} from "lucide-react"
import Link from "next/link"

export default function LandingPage() {
  const features = [
    {
      icon: Users,
      title: "Contact Management",
      description: "Organize and manage all your contacts in one centralized location with advanced filtering and search capabilities."
    },
    {
      icon: MessageSquare,
      title: "SMS & Text Blasts",
      description: "Send individual messages or bulk SMS campaigns with delivery tracking and automated responses."
    },
    {
      icon: Phone,
      title: "Voice Calls",
      description: "Make and receive calls directly through the platform with call recording and activity logging."
    },
    {
      icon: Mail,
      title: "Email Marketing",
      description: "Create and send professional email campaigns with templates, scheduling, and analytics."
    },
    {
      icon: BarChart3,
      title: "Analytics & Reports",
      description: "Track performance with detailed analytics, conversion rates, and comprehensive reporting tools."
    },
    {
      icon: Shield,
      title: "Team Management",
      description: "Create team accounts, assign clients, and manage permissions with role-based access control."
    }
  ]

  const benefits = [
    "Streamline your sales and marketing processes",
    "Increase conversion rates with targeted campaigns",
    "Manage your entire team from one dashboard",
    "Track every interaction with detailed analytics",
    "Automate repetitive tasks and workflows",
    "Scale your business with enterprise-grade tools"
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                AdlerCRM
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/auth/signin">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/auth/signup">
                <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <Badge variant="outline" className="mb-4">
            <Globe className="h-3 w-3 mr-1" />
            Trusted by 1000+ Businesses
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 bg-clip-text text-transparent">
            The Complete CRM Solution for Modern Businesses
          </h1>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Manage contacts, automate communications, track performance, and scale your business 
            with our all-in-one customer relationship management platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signup">
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-lg px-8">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="text-lg px-8">
              Watch Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-white/50">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Everything You Need to Grow</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Powerful features designed to help you manage relationships, automate workflows, 
              and drive business growth.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <div className="h-12 w-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-6">
                Why Choose AdlerCRM?
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                Built for businesses that want to scale efficiently while maintaining 
                personal relationships with their customers.
              </p>
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white">
                <h3 className="text-2xl font-bold mb-4">Ready to Get Started?</h3>
                <p className="mb-6 opacity-90">
                  Join thousands of businesses already using AdlerCRM to grow their customer relationships.
                </p>
                <div className="space-y-3">
                  <Link href="/auth/signup">
                    <Button size="lg" variant="secondary" className="w-full">
                      Create Admin Account
                    </Button>
                  </Link>
                  <p className="text-sm opacity-75 text-center">
                    No credit card required • 14-day free trial
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <div className="h-8 w-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold">AdlerCRM</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <span>© 2024 AdlerCRM. All rights reserved.</span>
              <Link href="/privacy" className="hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-white transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
