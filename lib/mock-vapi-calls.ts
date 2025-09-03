import { mockContacts } from "./mock-contacts"

export type CallResult = "interested" | "not_interested" | "voicemail" | "no_answer" | "wrong_number" | "call_back"

export type VapiCall = {
  id: string
  contactId: string
  timestamp: string
  phone_number_used: string
  duration: number // in seconds
  result: CallResult
  evaluation_summary: string
  transcript: string
  recordingUrl: string
}

// Generate random dates within the last 30 days
const getRandomDate = () => {
  const now = new Date()
  const daysAgo = Math.floor(Math.random() * 30)
  now.setDate(now.getDate() - daysAgo)
  return now.toISOString()
}

// Generate random phone numbers
const generatePhoneNumber = () => {
  const prefixes = ["+1786", "+1954", "+1305", "+1561"]
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
  const suffix = Math.floor(Math.random() * 10000000)
    .toString()
    .padStart(7, "0")
  return `${prefix}${suffix}`
}

// Sample transcripts
const transcripts = [
  `AI: Hello, this is Dan from Adler Capital. Am I speaking with [FIRST_NAME] [LAST_NAME]?\nContact: Yes, this is [FIRST_NAME].\nAI: Great! I'm calling about your property at [PROPERTY_ADDRESS]. We're offering competitive refinancing options that could potentially lower your monthly payments. Would you be interested in hearing more about that?\nContact: Actually, yes. What kind of rates are you offering?\nAI: We're currently offering rates as low as 5.2% for properties like yours in [CITY]. Would you like me to have one of our loan specialists give you more details?\nContact: Sure, that sounds good.\nAI: Excellent! I'll have someone reach out to you within the next 24 hours. Is this the best number to reach you?\nContact: Yes, this number is fine.\nAI: Perfect. Thank you for your time, [FIRST_NAME]. Have a great day!`,

  `AI: Hello, this is Dan from Adler Capital. Am I speaking with [FIRST_NAME] [LAST_NAME]?\nContact: Yes, who's this again?\nAI: This is Dan from Adler Capital. I'm calling about your property at [PROPERTY_ADDRESS]. We specialize in refinancing for [PROPERTY_TYPE] properties. Is that something you might be interested in?\nContact: No, I'm not interested in refinancing right now.\nAI: I understand. Would it be alright if I check back with you in a few months? Rates are constantly changing.\nContact: No, please don't call me again.\nAI: I understand. I'll make sure you're not contacted again. Thank you for your time, and have a good day.`,

  `AI: Hello, this is Dan from Adler Capital. Am I speaking with [FIRST_NAME] [LAST_NAME]?\nContact: [VOICEMAIL BEEP]\nAI: Hello [FIRST_NAME], this is Dan from Adler Capital. I'm calling about your property at [PROPERTY_ADDRESS]. We're offering competitive refinancing options for [PROPERTY_TYPE] properties in [CITY]. If you're interested in potentially lowering your monthly payments, please give us a call back at 305-555-1234. Thank you, and have a great day!`,

  `AI: Hello, this is Dan from Adler Capital. Am I speaking with [FIRST_NAME] [LAST_NAME]?\nContact: Sorry, wrong number.\nAI: I apologize for the confusion. Have a good day.`,

  `AI: Hello, this is Dan from Adler Capital. Am I speaking with [FIRST_NAME] [LAST_NAME]?\nContact: This is [FIRST_NAME], but I'm in a meeting right now.\nAI: I apologize for the interruption. I'm calling about refinancing options for your property at [PROPERTY_ADDRESS]. When would be a better time to call back?\nContact: Maybe try tomorrow afternoon.\nAI: I'll make a note to call back tomorrow afternoon. Thank you for your time, and have a good day!`,
]

// Sample evaluation summaries
const evaluationSummaries = [
  "Contact expressed interest in refinancing. Ready for follow-up.",
  "Contact declined refinancing offer. Do not contact again.",
  "Left voicemail with callback information.",
  "Wrong number. Remove from contact list.",
  "Contact requested callback tomorrow afternoon.",
]

// Generate mock VAPI calls
export const generateMockVapiCalls = (count: number): VapiCall[] => {
  const calls: VapiCall[] = []

  for (let i = 0; i < count; i++) {
    const contactIndex = Math.floor(Math.random() * mockContacts.length)
    const contact = mockContacts[contactIndex]
    const resultOptions: CallResult[] = [
      "interested",
      "not_interested",
      "voicemail",
      "no_answer",
      "wrong_number",
      "call_back",
    ]
    const result = resultOptions[Math.floor(Math.random() * resultOptions.length)]

    let transcript = transcripts[Math.floor(Math.random() * transcripts.length)]
    const evaluationSummary = evaluationSummaries[Math.floor(Math.random() * evaluationSummaries.length)]

    // Replace placeholders with actual contact info
    transcript = transcript
      .replace(/\[FIRST_NAME\]/g, contact.firstName)
      .replace(/\[LAST_NAME\]/g, contact.lastName)
      .replace(/\[PROPERTY_ADDRESS\]/g, contact.propertyAddress || '')
      .replace(/\[CITY\]/g, contact.propertyAddress?.split(",")[1]?.trim() || "Miami")
      .replace(/\[PROPERTY_TYPE\]/g, contact.propertyAddress?.includes("Apt") ? "multi-family" : "single-family")

    calls.push({
      id: `vapi-call-${i + 1}`,
      contactId: contact.id,
      timestamp: getRandomDate(),
      phone_number_used: generatePhoneNumber(),
      duration: result === "voicemail" ? 30 : Math.floor(Math.random() * 300) + 30, // 30 seconds to 5.5 minutes
      result,
      evaluation_summary: evaluationSummary,
      transcript,
      recordingUrl: `/mock-recording-${i + 1}.mp3`,
    })
  }

  // Sort by timestamp (newest first)
  return calls.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

export const vapiCalls = generateMockVapiCalls(50)

export const getVapiCallsByContactId = (contactId: string): VapiCall[] => {
  return vapiCalls.filter((call) => call.contactId === contactId)
}

export const getVapiCallById = (callId: string): VapiCall | undefined => {
  return vapiCalls.find((call) => call.id === callId)
}
