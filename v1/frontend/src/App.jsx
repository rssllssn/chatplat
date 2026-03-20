import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './lib/supabase'

function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [displayName, setDisplayName] = useState('')
  const [isEditingName, setIsEditingName] = useState(false)
  const [status, setStatus] = useState('idle')
  const [roomId, setRoomId] = useState(null)
  const [partnerName, setPartnerName] = useState('')
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const messagesEndRef = useRef(null)
  const roomSubscriptionRef = useRef(null)
  const messageSubscriptionRef = useRef(null)
  const pollIntervalRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) {
      loadProfile()
    }
  }, [user])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    return () => {
      cleanupSubscriptions()
    }
  }, [])

  const cleanupSubscriptions = () => {
    if (roomSubscriptionRef.current) {
      supabase.removeChannel(roomSubscriptionRef.current)
      roomSubscriptionRef.current = null
    }
    if (messageSubscriptionRef.current) {
      supabase.removeChannel(messageSubscriptionRef.current)
      messageSubscriptionRef.current = null
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }

  const subscribeToRoom = useCallback((activeRoomId) => {
    if (roomSubscriptionRef.current) {
      supabase.removeChannel(roomSubscriptionRef.current)
    }

    const channel = supabase
      .channel(`room-${activeRoomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${activeRoomId}`
        },
        (payload) => {
          if (payload.new.status === 'ended') {
            cleanupSubscriptions()
            setStatus('partner_left')
            setTimeout(() => {
              setStatus('idle')
              setRoomId(null)
              setPartnerName('')
              setMessages([])
            }, 2000)
          }
        }
      )
      .subscribe()

    roomSubscriptionRef.current = channel
  }, [])

  const subscribeToMessages = useCallback((activeRoomId, currentUserId) => {
    if (messageSubscriptionRef.current) {
      supabase.removeChannel(messageSubscriptionRef.current)
    }

    const channel = supabase
      .channel(`messages-${activeRoomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${activeRoomId}`
        },
        (payload) => {
          if (payload.new.sender_id !== currentUserId) {
            setMessages(prev => [...prev, {
              text: payload.new.text,
              sender: 'partner',
              senderName: payload.new.sender_name,
              timestamp: new Date(payload.new.created_at).getTime()
            }])
          }
        }
      )
      .subscribe()

    messageSubscriptionRef.current = channel
  }, [])

  const listenForIncomingMatch = useCallback((currentUserId) => {
    if (roomSubscriptionRef.current) {
      supabase.removeChannel(roomSubscriptionRef.current)
    }

    const channel = supabase
      .channel('incoming-match')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rooms',
          filter: `user1_id=eq.${currentUserId}`
        },
        (payload) => {
          const room = payload.new
          if (room.status === 'active') {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current)
              pollIntervalRef.current = null
            }
            supabase.removeChannel(channel)

            setRoomId(room.id)
            setPartnerName(room.user2_display_name)
            setStatus('matched')
            setMessages([])

            subscribeToRoom(room.id)
            subscribeToMessages(room.id, currentUserId)
          }
        }
      )
      .subscribe()

    roomSubscriptionRef.current = channel
  }, [subscribeToRoom, subscribeToMessages])

  const loadProfile = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (data) {
      setProfile(data)
      setDisplayName(data.display_name)
    } else if (error && error.code === 'PGRST116') {
      const { data: newProfile } = await supabase
        .from('profiles')
        .insert([{ id: user.id, display_name: 'Stranger' }])
        .select()
        .single()
      
      if (newProfile) {
        setProfile(newProfile)
        setDisplayName(newProfile.display_name)
      }
    }
  }

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    })
  }

  const signOut = async () => {
    cleanupSubscriptions()
    await supabase.from('queue').delete().eq('user_id', user.id)
    await supabase.auth.signOut()
    setProfile(null)
    setStatus('idle')
    setMessages([])
    setRoomId(null)
    setPartnerName('')
  }

  const updateDisplayName = async () => {
    if (!displayName.trim()) return

    const { data } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() })
      .eq('id', user.id)
      .select()
      .single()

    if (data) {
      setProfile(data)
      setIsEditingName(false)
    }
  }

  const findMatch = async () => {
    if (!user || !profile) return

    setStatus('searching')
    setMessages([])
    setRoomId(null)
    setPartnerName('')

    await supabase.from('queue').delete().eq('user_id', user.id)

    await supabase.from('queue').insert({
      user_id: user.id,
      display_name: profile.display_name,
      status: 'waiting'
    })

    listenForIncomingMatch(user.id)

    const attemptMatch = async () => {
      const { data } = await supabase.rpc('find_match', {
        current_user_id: user.id,
        current_display_name: profile.display_name
      })

      if (data && data.matched) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }
        cleanupSubscriptions()

        setRoomId(data.room_id)
        setPartnerName(data.partner_name)
        setStatus('matched')
        setMessages([])

        subscribeToRoom(data.room_id)
        subscribeToMessages(data.room_id, user.id)
      }
    }

    await attemptMatch()

    pollIntervalRef.current = setInterval(attemptMatch, 3000)
  }

  const skipPartner = async () => {
    if (!roomId) return

    cleanupSubscriptions()

    await supabase
      .from('rooms')
      .update({ status: 'ended' })
      .eq('id', roomId)

    setRoomId(null)
    setPartnerName('')
    setMessages([])

    findMatch()
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!inputMessage.trim() || !roomId) return

    const messageText = inputMessage.trim()
    setInputMessage('')

    setMessages(prev => [...prev, {
      text: messageText,
      sender: 'me',
      timestamp: Date.now()
    }])

    await supabase.from('messages').insert({
      room_id: roomId,
      sender_id: user.id,
      sender_name: profile.display_name,
      text: messageText
    })
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <h1 className="text-4xl font-bold text-gray-800 mb-4 text-center">Anonymous Chat</h1>
          <p className="text-gray-600 mb-8 text-center">Connect with strangers around the world</p>
          <button
            onClick={signInWithGoogle}
            className="w-full bg-white border-2 border-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-lg hover:bg-gray-50 transition-all flex items-center justify-center gap-3"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-purple-600">Anonymous Chat</h1>
          <div className="flex items-center gap-4">
            {isEditingName ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="px-3 py-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Display name"
                />
                <button
                  onClick={updateDisplayName}
                  className="px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingName(true)}
                className="text-gray-700 hover:text-purple-600 font-medium"
              >
                {profile?.display_name || 'Stranger'}
              </button>
            )}
            <button
              onClick={signOut}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {status === 'idle' && (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">Ready to chat?</h2>
            <p className="text-gray-600 mb-8">Click below to find a random stranger to talk to</p>
            <button
              onClick={findMatch}
              className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-full hover:from-purple-600 hover:to-pink-600 transition-all transform hover:scale-105 shadow-lg"
            >
              Find Match
            </button>
          </div>
        )}

        {status === 'searching' && (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-500 mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Searching for a match...</h2>
            <p className="text-gray-600">Please wait while we find someone for you</p>
          </div>
        )}

        {status === 'partner_left' && (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Partner disconnected</h2>
            <p className="text-gray-600">Returning to home...</p>
          </div>
        )}

        {status === 'matched' && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-4 flex justify-between items-center">
              <div className="text-white">
                <p className="text-sm opacity-90">Connected with</p>
                <p className="font-bold text-lg">{partnerName}</p>
              </div>
              <button
                onClick={skipPartner}
                className="px-6 py-2 bg-white text-purple-600 font-semibold rounded-full hover:bg-gray-100 transition-all"
              >
                Next
              </button>
            </div>

            <div className="h-96 overflow-y-auto p-4 bg-gray-50">
              {messages.length === 0 && (
                <div className="text-center text-gray-500 mt-8">
                  <p>Say hello to {partnerName}!</p>
                </div>
              )}
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`mb-3 flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs px-4 py-2 rounded-2xl ${
                      msg.sender === 'me'
                        ? 'bg-purple-500 text-white'
                        : 'bg-white text-gray-800 shadow'
                    }`}
                  >
                    <p>{msg.text}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="p-4 bg-white border-t">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-3 border rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  type="submit"
                  className="px-6 py-3 bg-purple-500 text-white font-semibold rounded-full hover:bg-purple-600 transition-all"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
