export const mockTemplates = [
  {
    id: "template1",
    name: "Property Refinance Offer",
    content:
      "Hi {first_name}, I'm a private lender. I can refinance {property_address} or fund a purchase under 7%. Are you free to chat later today?",
    variables: ["first_name", "property_address"],
    subject: "Property Refinance Opportunity",
  },
  {
    id: "template2",
    name: "Local Lender Introduction",
    content:
      "Hi {first_name}, I'm a private lender working on a {property_type} in {city_state} that's similar to your property at {property_address}. Any interest in refinancing?",
    variables: ["first_name", "property_type", "city_state", "property_address"],
    subject: "Local Lending Services",
  },
  {
    id: "template3",
    name: "Competitive Rate Offer",
    content:
      "Hi {first_name}, I just funded a cashout refi in {city_state} at 6.7%. I'll match or beat your best quote on {property_address}. Call me (917) 963-0181.",
    variables: ["first_name", "city_state", "property_address"],
    subject: "Competitive Refinance Rates Available",
  },
  {
    id: "template4",
    name: "LLC Refinance Inquiry",
    content:
      "Hi {first_name}, I'm a private lender. I can beat any quote to guarantee the lowest rate for {property_address}. Any interest in refinancing into an LLC?",
    variables: ["first_name", "property_address"],
    subject: "LLC Refinance Options",
  },
]

// Export templates as an alias of mockTemplates for compatibility
export const templates = mockTemplates
