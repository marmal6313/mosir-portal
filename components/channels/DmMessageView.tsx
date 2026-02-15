'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Loader2 } from 'lucide-react'
import { PresenceIndicatorWithLabel } from './PresenceIndicator'
import { formatDistanceToNow } from 'date-fns'
import { pl } from 'date-fns/locale'
import type { DmConversation, DmMessage } from '@/hooks/useDirectMessages'
import type { PresenceStatus } from '@/hooks/usePresence'
import { useAuth } from '@/hooks/useAuth'

/**
 * DmMessageView Props
 */
export interface DmMessageViewProps {
  /** Current DM conversation */
  conversation: DmConversation | null
  /** Messages in this DM */
  messages: DmMessage[]
  /** User's presence status */
  otherUserPresence?: PresenceStatus
  /** Last seen timestamp */
  lastSeenAt?: string | null
  /** Loading state */
  loading?: boolean
  /** Sending state */
  sending?: boolean
  /** Send message callback */
  onSendMessage: (content: string) => Promise<boolean>
}

/**
 * DmMessageView Component
 *
 * Displays direct message conversation with header, messages, and composer.
 *
 * Features:
 * - Message list with sender avatars
 * - Auto-scroll to bottom on new messages
 * - Message timestamp (relative time)
 * - Message composition with Enter to send
 * - Presence indicator in header
 * - Loading states
 *
 * Usage:
 * ```tsx
 * <DmMessageView
 *   conversation={currentConversation}
 *   messages={messages}
 *   otherUserPresence="online"
 *   lastSeenAt="2025-01-15T10:30:00Z"
 *   loading={loading}
 *   sending={sending}
 *   onSendMessage={sendMessage}
 * />
 * ```
 */
export function DmMessageView({
  conversation,
  messages,
  otherUserPresence = 'offline',
  lastSeenAt,
  loading = false,
  sending = false,
  onSendMessage,
}: DmMessageViewProps) {
  const { user } = useAuth()
  const [messageText, setMessageText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Get other user info
  const otherUser = conversation?.other_user
  const otherUserName =
    otherUser?.first_name && otherUser?.last_name
      ? `${otherUser.first_name} ${otherUser.last_name}`
      : otherUser?.email || 'Unknown User'
  const otherUserInitials =
    otherUser?.first_name && otherUser?.last_name
      ? `${otherUser.first_name[0]}${otherUser.last_name[0]}`.toUpperCase()
      : (otherUser?.email?.[0] || '?').toUpperCase()

  /**
   * Handle send message
   */
  const handleSend = async () => {
    if (!messageText.trim() || sending) return

    const success = await onSendMessage(messageText.trim())

    if (success) {
      setMessageText('')
      textareaRef.current?.focus()
    }
  }

  /**
   * Handle Enter key (send message, Shift+Enter for new line)
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  /**
   * Render message item
   */
  const renderMessage = (message: DmMessage) => {
    const isOwnMessage = message.sender_id === user?.id
    const sender = message.sender

    const senderName =
      sender?.first_name && sender?.last_name
        ? `${sender.first_name} ${sender.last_name}`
        : sender?.email || 'Unknown'

    const senderInitials =
      sender?.first_name && sender?.last_name
        ? `${sender.first_name[0]}${sender.last_name[0]}`.toUpperCase()
        : (sender?.email?.[0] || '?').toUpperCase()

    const timeAgo = message.created_at
      ? formatDistanceToNow(new Date(message.created_at), {
          addSuffix: true,
          locale: pl,
        })
      : ''

    return (
      <div
        key={message.id}
        className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}
      >
        {/* Avatar */}
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback
            className={`text-xs font-medium ${
              isOwnMessage
                ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                : 'bg-gradient-to-br from-gray-500 to-gray-600 text-white'
            }`}
          >
            {senderInitials}
          </AvatarFallback>
        </Avatar>

        {/* Message bubble */}
        <div
          className={`flex flex-col max-w-[70%] ${
            isOwnMessage ? 'items-end' : 'items-start'
          }`}
        >
          {/* Sender name and time */}
          <div className="flex items-center gap-2 mb-1">
            {!isOwnMessage && (
              <span className="text-xs font-medium text-gray-700">
                {senderName}
              </span>
            )}
            <span className="text-xs text-gray-500">{timeAgo}</span>
          </div>

          {/* Message content */}
          <div
            className={`px-4 py-2 rounded-lg ${
              isOwnMessage
                ? 'bg-blue-600 text-white rounded-tr-none'
                : 'bg-gray-100 text-gray-900 rounded-tl-none'
            }`}
          >
            <p className="text-sm whitespace-pre-wrap break-words">
              {message.content}
            </p>
          </div>

          {/* Read receipt (for own messages) */}
          {isOwnMessage && message.read_by_recipient && (
            <span className="text-xs text-gray-500 mt-1">Seen</span>
          )}
        </div>
      </div>
    )
  }

  // No conversation selected
  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500">Select a conversation to start messaging</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-gradient-to-br from-gray-500 to-gray-600 text-white font-medium">
              {otherUserInitials}
            </AvatarFallback>
          </Avatar>

          {/* User info */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {otherUserName}
            </h2>
            <PresenceIndicatorWithLabel
              status={otherUserPresence}
              lastSeenAt={lastSeenAt}
              size="sm"
            />
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <>
            {messages.map((message) => renderMessage(message))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message composer */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-end gap-3">
          {/* Textarea */}
          <Textarea
            ref={textareaRef}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${otherUserName}...`}
            className="flex-1 min-h-[44px] max-h-[120px] resize-none"
            disabled={sending}
          />

          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={!messageText.trim() || sending}
            className="h-[44px] px-4"
            aria-label="Send message"
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Send className="h-5 w-5 mr-2" />
                Send
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-gray-500 mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
