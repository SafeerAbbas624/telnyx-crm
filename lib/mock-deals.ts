import { DealStatus } from "./types"
import type { Deal } from "./types"

export const mockDeals: Deal[] = [
  {
    id: "1",
    contactId: "1",
    dealName: "123 Main St Acquisition",
    amount: 500000,
    stage: DealStatus.LEAD,
    closeDate: "2024-02-28T00:00:00Z",
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
    stageHistory: [{ stageId: DealStatus.LEAD, enteredAt: "2024-01-15T10:00:00Z" }],
  },
  {
    id: "2",
    contactId: "2",
    dealName: "456 Oak Ave Investment",
    amount: 750000,
    stage: DealStatus.QUALIFIED,
    closeDate: "2024-03-15T00:00:00Z",
    createdAt: "2024-01-16T11:00:00Z",
    updatedAt: "2024-01-16T11:00:00Z",
    stageHistory: [{ stageId: DealStatus.QUALIFIED, enteredAt: "2024-01-16T11:00:00Z" }],
  },
  {
    id: "3",
    contactId: "3",
    dealName: "789 Pine St Refinance",
    amount: 400000,
    stage: DealStatus.PROPOSAL,
    closeDate: "2024-04-01T00:00:00Z",
    createdAt: "2024-01-17T12:00:00Z",
    updatedAt: "2024-01-17T12:00:00Z",
    stageHistory: [
      { stageId: DealStatus.LEAD, enteredAt: "2024-01-17T12:00:00Z", exitedAt: "2024-01-18T12:00:00Z", durationInDays: 1 },
      { stageId: DealStatus.PROPOSAL, enteredAt: "2024-01-18T12:00:00Z" }
    ],
  },
  {
    id: "4",
    contactId: "4",
    dealName: "321 Elm St Purchase",
    amount: 600000,
    stage: DealStatus.NEGOTIATION,
    closeDate: "2024-03-30T00:00:00Z",
    createdAt: "2024-01-18T14:00:00Z",
    updatedAt: "2024-01-18T14:00:00Z",
    stageHistory: [
      { stageId: DealStatus.LEAD, enteredAt: "2024-01-18T14:00:00Z", exitedAt: "2024-01-19T14:00:00Z", durationInDays: 1 },
      { stageId: DealStatus.QUALIFIED, enteredAt: "2024-01-19T14:00:00Z", exitedAt: "2024-01-20T14:00:00Z", durationInDays: 1 },
      { stageId: DealStatus.NEGOTIATION, enteredAt: "2024-01-20T14:00:00Z" }
    ],
  },
  {
    id: "5",
    contactId: "5",
    dealName: "654 Maple Dr Flip",
    amount: 350000,
    stage: DealStatus.CLOSED_WON,
    closeDate: "2024-01-25T00:00:00Z",
    createdAt: "2024-01-10T10:00:00Z",
    updatedAt: "2024-01-25T16:00:00Z",
    stageHistory: [
      { stageId: DealStatus.LEAD, enteredAt: "2024-01-10T10:00:00Z", exitedAt: "2024-01-12T10:00:00Z", durationInDays: 2 },
      { stageId: DealStatus.QUALIFIED, enteredAt: "2024-01-12T10:00:00Z", exitedAt: "2024-01-15T10:00:00Z", durationInDays: 3 },
      { stageId: DealStatus.PROPOSAL, enteredAt: "2024-01-15T10:00:00Z", exitedAt: "2024-01-20T10:00:00Z", durationInDays: 5 },
      { stageId: DealStatus.NEGOTIATION, enteredAt: "2024-01-20T10:00:00Z", exitedAt: "2024-01-25T10:00:00Z", durationInDays: 5 },
      { stageId: DealStatus.CLOSED_WON, enteredAt: "2024-01-25T10:00:00Z" }
    ],
  }
]
