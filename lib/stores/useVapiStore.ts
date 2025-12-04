import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface VapiApiKey {
  id: string
  name: string
  isActive: boolean
  isDefault: boolean
  defaultAssistantId?: string
  defaultPhoneNumber?: string
  maxCallDuration?: number
  recordingEnabled: boolean
  transcriptEnabled: boolean
  webhookUrl?: string
  lastTestedAt?: string
  testStatus?: string
  createdAt: string
  updatedAt: string
}

export interface VapiCall {
  id: string
  vapi_call_id?: string
  customer_id?: string
  name?: string
  type: string
  status?: string
  ended_reason?: string
  started_at?: string
  ended_at?: string
  duration?: number
  cost?: number
  transcript?: string
  recording_url?: string
  summary?: string
  created_at: string
}

export interface VapiStoreState {
  // API Keys
  apiKeys: VapiApiKey[]
  selectedApiKeyId: string | null
  loadingApiKeys: boolean
  
  // Calls
  calls: VapiCall[]
  selectedContactIds: string[]
  loadingCalls: boolean
  
  // UI State
  activeTab: 'keys' | 'calls' | 'history' | 'settings'
  showApiKeyForm: boolean
  showContactSelector: boolean
  
  // Actions
  setApiKeys: (keys: VapiApiKey[]) => void
  setSelectedApiKeyId: (id: string | null) => void
  setLoadingApiKeys: (loading: boolean) => void
  
  setCalls: (calls: VapiCall[]) => void
  setSelectedContactIds: (ids: string[]) => void
  addSelectedContactId: (id: string) => void
  removeSelectedContactId: (id: string) => void
  clearSelectedContactIds: () => void
  setLoadingCalls: (loading: boolean) => void
  
  setActiveTab: (tab: 'keys' | 'calls' | 'history' | 'settings') => void
  setShowApiKeyForm: (show: boolean) => void
  setShowContactSelector: (show: boolean) => void
  
  // Reset
  reset: () => void
}

const initialState = {
  apiKeys: [],
  selectedApiKeyId: null,
  loadingApiKeys: false,
  calls: [],
  selectedContactIds: [],
  loadingCalls: false,
  activeTab: 'keys' as const,
  showApiKeyForm: false,
  showContactSelector: false,
}

export const useVapiStore = create<VapiStoreState>()(
  persist(
    (set) => ({
      ...initialState,

      setApiKeys: (keys) => set({ apiKeys: keys }),
      setSelectedApiKeyId: (id) => set({ selectedApiKeyId: id }),
      setLoadingApiKeys: (loading) => set({ loadingApiKeys: loading }),

      setCalls: (calls) => set({ calls }),
      setSelectedContactIds: (ids) => set({ selectedContactIds: ids }),
      addSelectedContactId: (id) => set((state) => ({
        selectedContactIds: [...new Set([...state.selectedContactIds, id])]
      })),
      removeSelectedContactId: (id) => set((state) => ({
        selectedContactIds: state.selectedContactIds.filter(cid => cid !== id)
      })),
      clearSelectedContactIds: () => set({ selectedContactIds: [] }),
      setLoadingCalls: (loading) => set({ loadingCalls: loading }),

      setActiveTab: (tab) => set({ activeTab: tab }),
      setShowApiKeyForm: (show) => set({ showApiKeyForm: show }),
      setShowContactSelector: (show) => set({ showContactSelector: show }),

      reset: () => set(initialState),
    }),
    {
      name: 'vapi-store',
      partialize: (state) => ({
        selectedApiKeyId: state.selectedApiKeyId,
        selectedContactIds: state.selectedContactIds,
        activeTab: state.activeTab,
      }),
    }
  )
)

