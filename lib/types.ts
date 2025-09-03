export enum DealStatus {
  LEAD = "lead",
  QUALIFIED = "qualified",
  PROPOSAL = "proposal",
  NEGOTIATION = "negotiation",
  CLOSED_WON = "closed_won",
  CLOSED_LOST = "closed_lost",
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  llcName?: string | null;
  phone1?: string | null;
  phone2?: string | null;
  phone3?: string | null;
  email1?: string | null;
  email2?: string | null;
  email3?: string | null;
  propertyAddress?: string | null;
  contactAddress?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  propertyCounty?: string | null;
  propertyType?: string | null;
  bedrooms?: number | null;
  totalBathrooms?: number | null;
  buildingSqft?: number | null;
  effectiveYearBuilt?: number | null;
  estValue?: number | null;
  estEquity?: number | null;
  dnc?: boolean | null;
  dncReason?: string | null;
  dealStatus?: DealStatus | null;
  notes?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  // Additional properties for compatibility
  propertyValue?: number | null;
  debtOwed?: number | null;
  tags?: Tag[];
  phone?: string | null; // alias for phone1
  email?: string | null; // alias for email1
  name?: string; // computed from firstName + lastName
  phoneNumber?: string; // alias for phone1
  cityState?: string; // computed from city + state
}

export interface Tag {
  id: string
  name: string
  color: string
}

export interface Message {
  id: string
  contactId: string
  text: string
  content?: string // alias for text
  createdAt: string
  timestamp?: string // alias for createdAt
  isInbound: boolean
  direction?: "inbound" | "outbound"
  status?: string
}

export interface Conversation {
  id: string
  contactId: string
  contactName: string
  contactPhone: string
  lastMessage: string
  lastMessageTime: string
  unreadCount: number
  status: "active" | "archived"
}

export interface Template {
  id: string
  name: string
  content: string
  category: string
  createdAt: string
}

export type ActivityType = "call" | "email" | "meeting" | "note" | "task"

export interface Activity {
  id: string;
  contactId: string;
  dealId?: string;
  type: ActivityType;
  title: string;
  description?: string;
  dueDate?: string;
  status: "planned" | "completed" | "cancelled";
  priority?: "low" | "medium" | "high" | "urgent";
  assignedTo?: string;
  location?: string;
  durationMinutes?: number;
  reminderMinutes?: number;
  isAllDay?: boolean;
  completedAt?: string;
  completedBy?: string;
  result?: string;
  nextAction?: string;
  createdAt: string;
  updatedAt: string;
}

export type DealStage = DealStatus;

export interface StageHistory {
  stageId: DealStage;
  enteredAt: string;
  exitedAt?: string;
  durationInDays?: number;
}

export interface Deal {
  id: string;
  contactId: string;
  dealName: string;
  amount: number;
  stage: DealStage;
  closeDate: string;
  createdAt: string;
  updatedAt: string;
  stageHistory: StageHistory[];
}

export interface Call {
  id: string
  contactId: string
  direction: "inbound" | "outbound"
  duration: number
  notes?: string
  status?: "completed" | "no_answer" | "voicemail" | "in_progress" | "missed" | "failed"
  recordingUrl?: string
  createdAt: string
}

export interface Email {
  id: string
  contactId: string
  subject: string
  content: string
  body?: string // alias for content
  createdAt: string
  timestamp?: string // alias for createdAt
  isRead: boolean
  isSent: boolean
  direction?: "inbound" | "outbound"
  status?: string
}

export interface VapiCall {
  id: string
  contactId: string
  phoneNumber: string
  status: "queued" | "ringing" | "in-progress" | "forwarding" | "ended"
  startedAt?: string
  endedAt?: string
  duration?: number
  cost?: number
  endedReason?: string
  transcript?: string
  recordingUrl?: string
  summary?: string
  createdAt: string
}
