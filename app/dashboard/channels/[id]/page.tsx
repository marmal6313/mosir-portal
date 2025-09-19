import { redirect } from 'next/navigation'

type ChannelRouteParams = {
  params: {
    id?: string
  }
}

export default function ChannelRedirectPage({ params }: ChannelRouteParams) {
  const channelId = params?.id

  if (!channelId) {
    redirect('/dashboard/channels')
  }

  const target = `/dashboard/channels?channel=${encodeURIComponent(channelId)}`
  redirect(target)
}
