'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface ChatPageContext {
  page: string
  patientId?: string
  patientName?: string
  intakeId?: string
  intakeStatus?: string
}

interface ChatContextValue {
  pageContext: ChatPageContext
  setPageContext: (ctx: ChatPageContext) => void
}

const ChatContext = createContext<ChatContextValue>({
  pageContext: { page: 'dashboard' },
  setPageContext: () => {},
})

export function ChatContextProvider({ children }: { children: ReactNode }) {
  const [pageContext, setPageContext] = useState<ChatPageContext>({ page: 'dashboard' })

  return (
    <ChatContext.Provider value={{ pageContext, setPageContext }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChatContext() {
  return useContext(ChatContext)
}
