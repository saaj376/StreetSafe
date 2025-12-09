import { useState, useRef, useEffect } from 'react'
import { Book, Plus, Calendar, Sparkles, X, Loader, Image as ImageIcon, CheckCircle, DollarSign, Trash2, Volume2, VolumeX, Pause, Play, Film } from 'lucide-react'

interface JournalEntry {
  id: string
  date: string
  title: string
  content: string
  photos: string[]
  enhanced: boolean
  enhancedContent?: string
  tripName?: string
}

interface Trip {
  id: string
  name: string
  startDate: string
  endDate?: string
  description?: string
}

interface Expense {
  id: string
  date: string
  category: string
  description: string
  amount: number
}

const STORAGE_KEY = 'journal_entries'
const EXPENSES_STORAGE_KEY = 'travel_expenses'
const TRIPS_STORAGE_KEY = 'travel_trips'

export default function Journal() {
  const [showNewEntry, setShowNewEntry] = useState(false)
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [activeTab, setActiveTab] = useState<'journal' | 'expenses'>('journal')
  const [selectedTrip, setSelectedTrip] = useState<string>('all')
  const [showNewTrip, setShowNewTrip] = useState(false)
  
  // Form states for journal
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [enhancing, setEnhancing] = useState(false)
  const [showEnhancedView, setShowEnhancedView] = useState(false)
  const [selectedTripForEntry, setSelectedTripForEntry] = useState<string>('')
  
  // Form states for trips
  const [tripName, setTripName] = useState('')
  const [tripDescription, setTripDescription] = useState('')
  
  // Form states for expenses
  const [showNewExpense, setShowNewExpense] = useState(false)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [expenseCategory, setExpenseCategory] = useState<string>('Food & Dining')
  const [expenseDescription, setExpenseDescription] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [selectedExpenseDate, setSelectedExpenseDate] = useState<string>('')
  
  // Audio playback states
  const [playingEntryId, setPlayingEntryId] = useState<string | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null)
  
  // Video playback states
  const [showVideoPlayer, setShowVideoPlayer] = useState(false)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [currentEntryIndex, setCurrentEntryIndex] = useState(0)
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const [videoProgress, setVideoProgress] = useState(0)
  const videoTimerRef = useRef<NodeJS.Timeout | null>(null)
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load entries from localStorage on mount
  useEffect(() => {
    const savedEntries = localStorage.getItem(STORAGE_KEY)
    if (savedEntries) {
      try {
        setEntries(JSON.parse(savedEntries))
      } catch (error) {
        console.error('Error loading entries from cache:', error)
      }
    }
    
    const savedExpenses = localStorage.getItem(EXPENSES_STORAGE_KEY)
    if (savedExpenses) {
      try {
        setExpenses(JSON.parse(savedExpenses))
      } catch (error) {
        console.error('Error loading expenses from cache:', error)
      }
    }

    const savedTrips = localStorage.getItem(TRIPS_STORAGE_KEY)
    if (savedTrips) {
      try {
        setTrips(JSON.parse(savedTrips))
      } catch (error) {
        console.error('Error loading trips from cache:', error)
      }
    }
  }, [])

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader()
        reader.onloadend = () => {
          setPhotos(prev => [...prev, reader.result as string])
        }
        reader.readAsDataURL(file)
      })
    }
  }

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }

  const handleSaveTrip = () => {
    if (!tripName.trim()) {
      alert('Please enter a trip name')
      return
    }

    const newTrip: Trip = {
      id: Date.now().toString(),
      name: tripName,
      startDate: new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      }),
      description: tripDescription
    }

    const updatedTrips = [...trips, newTrip]
    setTrips(updatedTrips)
    localStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(updatedTrips))

    setTripName('')
    setTripDescription('')
    setShowNewTrip(false)
  }

  const handleSaveEntry = () => {
    if (!title.trim() || !content.trim()) {
      alert('Please enter both title and content')
      return
    }

    const newEntry: JournalEntry = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      }),
      title,
      content,
      photos,
      enhanced: false,
      enhancedContent: '',
      tripName: selectedTripForEntry || undefined
    }

    const updatedEntries = [newEntry, ...entries]
    setEntries(updatedEntries)
    
    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedEntries))
    
    // Reset form
    setTitle('')
    setContent('')
    setPhotos([])
    setSelectedTripForEntry('')
    setShowNewEntry(false)
  }

  const handleEnhanceWithAI = async (entry: JournalEntry) => {
    setEnhancing(true)
    try {
      const response = await fetch('http://localhost:8000/ai/enhance-journal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: entry.title,
          content: entry.content,
          photos_count: entry.photos.length,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to enhance journal')
      }

      const data = await response.json()
      
      // Update entry with enhanced content
      setEntries(prev =>
        prev.map(e =>
          e.id === entry.id
            ? {
                ...e,
                enhanced: true,
                enhancedContent: data.enhanced_content,
              }
            : e
        )
      )
      
      setShowEnhancedView(true)
      
      // Save enhanced entry to localStorage
      const updatedEntries = entries.map(e =>
        e.id === entry.id
          ? {
              ...e,
              enhanced: true,
              enhancedContent: data.enhanced_content,
            }
          : e
      )
      setEntries(updatedEntries)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedEntries))
    } catch (error) {
      console.error('Error enhancing journal:', error)
      alert('Failed to enhance journal. Please try again.')
    } finally {
      setEnhancing(false)
    }
  }

  const handleAddExpense = () => {
    if (!expenseDescription.trim() || !expenseAmount.trim()) {
      alert('Please fill in all expense fields')
      return
    }

    const newExpense: Expense = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      }),
      category: expenseCategory,
      description: expenseDescription,
      amount: parseFloat(expenseAmount),
    }

    const updatedExpenses = [newExpense, ...expenses]
    setExpenses(updatedExpenses)
    localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(updatedExpenses))

    // Reset form
    setExpenseCategory('Food')
    setExpenseDescription('')
    setExpenseAmount('')
    setShowNewExpense(false)
  }

  const handleDeleteExpense = (id: string) => {
    const updatedExpenses = expenses.filter(e => e.id !== id)
    setExpenses(updatedExpenses)
    localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(updatedExpenses))
  }

  const getFilteredEntries = () => {
    if (selectedTrip === 'all') {
      return entries
    }
    if (selectedTrip === 'unassigned') {
      return entries.filter(entry => !entry.tripName)
    }
    return entries.filter(entry => entry.tripName === selectedTrip)
  }

  const getEntriesByTrip = () => {
    const tripGroups: { [key: string]: JournalEntry[] } = {}
    
    entries.forEach(entry => {
      const tripKey = entry.tripName || 'Unassigned'
      if (!tripGroups[tripKey]) {
        tripGroups[tripKey] = []
      }
      tripGroups[tripKey].push(entry)
    })
    
    return tripGroups
  }

  const getTotalExpenses = () => expenses.reduce((sum, exp) => sum + exp.amount, 0)
  
  const getExpensesByCategory = () => {
    const categoryTotals: { [key: string]: number } = {}
    expenses.forEach(exp => {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount
    })
    return categoryTotals
  }

  const getExpensesByDate = () => {
    const dateGroups: { [key: string]: Expense[] } = {}
    expenses.forEach(exp => {
      if (!dateGroups[exp.date]) {
        dateGroups[exp.date] = []
      }
      dateGroups[exp.date].push(exp)
    })
    
    // Sort by date (newest first)
    return Object.entries(dateGroups).sort((a, b) => {
      return new Date(b[0]).getTime() - new Date(a[0]).getTime()
    })
  }

  const getDayTotalExpense = (dayExpensesOrDate: Expense[] | string | null | undefined) => {
    let expensesToSum: Expense[] = []
    
    if (!dayExpensesOrDate) {
      // Handle null/undefined - return 0
      return 0
    }
    
    if (typeof dayExpensesOrDate === 'string') {
      // It's a date string
      expensesToSum = dayExpensesOrDate === '' 
        ? expenses 
        : expenses.filter(exp => exp.date === dayExpensesOrDate)
    } else if (Array.isArray(dayExpensesOrDate)) {
      // It's an array of expenses
      expensesToSum = dayExpensesOrDate
    }
    
    return expensesToSum.reduce((sum, exp) => sum + exp.amount, 0)
  }

  const getUniqueDates = () => {
    const dates = new Set(expenses.map(exp => exp.date))
    return Array.from(dates).sort((a, b) => {
      return new Date(b).getTime() - new Date(a).getTime()
    })
  }

  const getFilteredExpensesByDate = (date?: string) => {
    if (!date || date === '') {
      return expenses
    }
    return expenses.filter(exp => exp.date === date)
  }

  const formatDateForInput = (dateStr: string) => {
    // Convert "Dec 9, 2025" to "2025-12-09"
    const date = new Date(dateStr)
    return date.toISOString().split('T')[0]
  }

  const formatDateFromInput = (inputDate: string) => {
    // Convert "2025-12-09" to "Dec 9, 2025"
    const date = new Date(inputDate + 'T00:00:00')
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  // Audio playback functions
  const handlePlayAudio = (entry: JournalEntry) => {
    // Stop any currently playing audio
    if (playingEntryId) {
      window.speechSynthesis.cancel()
    }

    // If clicking the same entry that's playing, stop it
    if (playingEntryId === entry.id && !isPaused) {
      setPlayingEntryId(null)
      setIsPaused(false)
      return
    }

    // Resume if paused
    if (isPaused && playingEntryId === entry.id) {
      window.speechSynthesis.resume()
      setIsPaused(false)
      return
    }

    // Create new speech synthesis
    const textToRead = entry.enhanced && entry.enhancedContent 
      ? `${entry.title}. ${entry.enhancedContent}` 
      : `${entry.title}. ${entry.content}`
    
    const utterance = new SpeechSynthesisUtterance(textToRead)
    utterance.rate = 0.9 // Slightly slower for better listening
    utterance.pitch = 1
    utterance.volume = 1

    utterance.onend = () => {
      setPlayingEntryId(null)
      setIsPaused(false)
    }

    utterance.onerror = () => {
      setPlayingEntryId(null)
      setIsPaused(false)
      alert('Audio playback failed. Please try again.')
    }

    speechSynthesisRef.current = utterance
    setPlayingEntryId(entry.id)
    setIsPaused(false)
    window.speechSynthesis.speak(utterance)
  }

  const handlePauseAudio = () => {
    if (playingEntryId && !isPaused) {
      window.speechSynthesis.pause()
      setIsPaused(true)
    }
  }

  const handleStopAudio = () => {
    window.speechSynthesis.cancel()
    setPlayingEntryId(null)
    setIsPaused(false)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel()
      if (videoTimerRef.current) {
        clearInterval(videoTimerRef.current)
      }
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current)
      }
    }
  }, [])

  // Video compilation functions
  const playEntryInVideo = (entryIndex: number) => {
    const filteredEntries = getFilteredEntries()
    if (entryIndex >= filteredEntries.length) {
      // All entries played, show completion
      setVideoPlaying(false)
      return
    }

    const entry = filteredEntries[entryIndex]
    setCurrentEntryIndex(entryIndex)
    setCurrentPhotoIndex(0)
    setVideoProgress((entryIndex / filteredEntries.length) * 100)

    // Create intro text with title and date
    const introText = `Memory ${entryIndex + 1}. ${entry.title}. Recorded on ${entry.date}.`
    const mainText = entry.enhanced && entry.enhancedContent 
      ? entry.enhancedContent 
      : entry.content

    // Speak intro first
    const introUtterance = new SpeechSynthesisUtterance(introText)
    introUtterance.rate = 0.9
    introUtterance.pitch = 1.1
    introUtterance.volume = 1

    introUtterance.onend = () => {
      // After intro, speak main content
      const mainUtterance = new SpeechSynthesisUtterance(mainText)
      mainUtterance.rate = 0.85
      mainUtterance.pitch = 1
      mainUtterance.volume = 1

      mainUtterance.onend = () => {
        // Move to next entry after a brief pause
        setTimeout(() => {
          if (videoPlaying) {
            playEntryInVideo(entryIndex + 1)
          }
        }, 2000)
      }

      mainUtterance.onerror = () => {
        playEntryInVideo(entryIndex + 1)
      }

      window.speechSynthesis.speak(mainUtterance)

      // Photo slideshow for this entry
      if (entry.photos.length > 0) {
        let photoIndex = 0
        if (videoTimerRef.current) {
          clearInterval(videoTimerRef.current)
        }
        videoTimerRef.current = setInterval(() => {
          photoIndex = (photoIndex + 1) % entry.photos.length
          setCurrentPhotoIndex(photoIndex)
        }, 4000)
      }
    }

    window.speechSynthesis.speak(introUtterance)
  }

  const handlePlayCompilation = () => {
    const filteredEntries = getFilteredEntries()
    if (filteredEntries.length === 0) {
      alert('No journal entries to play. Create some entries first!')
      return
    }

    setShowVideoPlayer(true)
    setVideoPlaying(true)
    setCurrentEntryIndex(0)
    setCurrentPhotoIndex(0)
    setVideoProgress(0)

    // Start playing from first entry
    playEntryInVideo(0)
  }

  const handlePauseVideo = () => {
    if (videoPlaying) {
      window.speechSynthesis.pause()
      if (videoTimerRef.current) {
        clearInterval(videoTimerRef.current)
      }
      setVideoPlaying(false)
    } else {
      window.speechSynthesis.resume()
      // Resume photo slideshow
      const filteredEntries = getFilteredEntries()
      const currentEntry = filteredEntries[currentEntryIndex]
      if (currentEntry && currentEntry.photos.length > 0) {
        let photoIndex = currentPhotoIndex
        videoTimerRef.current = setInterval(() => {
          photoIndex = (photoIndex + 1) % currentEntry.photos.length
          setCurrentPhotoIndex(photoIndex)
        }, 4000)
      }
      setVideoPlaying(true)
    }
  }

  const handleCloseVideo = () => {
    window.speechSynthesis.cancel()
    if (videoTimerRef.current) {
      clearInterval(videoTimerRef.current)
    }
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
    }
    setShowVideoPlayer(false)
    setVideoPlaying(false)
    setCurrentEntryIndex(0)
    setCurrentPhotoIndex(0)
    setVideoProgress(0)
  }

  const handleSkipToNext = () => {
    window.speechSynthesis.cancel()
    playEntryInVideo(currentEntryIndex + 1)
  }

  const handleSkipToPrevious = () => {
    if (currentEntryIndex > 0) {
      window.speechSynthesis.cancel()
      playEntryInVideo(currentEntryIndex - 1)
    }
  }

  return (
    <div className="min-h-screen bg-white py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center">
                <Book className="h-10 w-10 mr-3 text-purple-600" />
                Memory Hub
              </h1>
              <p className="text-gray-600">Document your travel stories, memories, and track expenses</p>
            </div>
            <div className="flex items-center space-x-3">
              {activeTab === 'journal' && (
                <>
                  {getFilteredEntries().length > 0 && (
                    <button
                      onClick={handlePlayCompilation}
                      className="btn bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:shadow-xl transition-all"
                    >
                      <Film className="h-5 w-5 mr-2" />
                      Play All Memories
                    </button>
                  )}
                  <button
                    onClick={() => setShowNewTrip(true)}
                    className="btn bg-purple-600 text-white hover:bg-purple-700"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    New Trip
                  </button>
                </>
              )}
              <button
                onClick={() => activeTab === 'journal' ? setShowNewEntry(!showNewEntry) : setShowNewExpense(!showNewExpense)}
                className="btn btn-primary"
              >
                <Plus className="h-5 w-5 mr-2" />
                {activeTab === 'journal' ? 'New Entry' : 'Add Expense'}
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-4 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('journal')}
              className={`px-4 py-2 font-semibold transition-colors ${
                activeTab === 'journal'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Book className="h-4 w-4 inline mr-2" />
              Daily Journal
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-4 py-2 font-semibold transition-colors ${
                activeTab === 'expenses'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <DollarSign className="h-4 w-4 inline mr-2" />
              Expense Tracker
            </button>
          </div>
        </div>

        {/* Journal Tab Content */}
        {activeTab === 'journal' && (
          <>
        {/* New Trip Form */}
        {showNewTrip && (
          <div className="card mb-8 border-2 border-purple-200 bg-white shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Create New Trip</h2>
              <button
                onClick={() => setShowNewTrip(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Trip Name
              </label>
              <input
                type="text"
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                placeholder="e.g., Chennai Summer Adventure, Goa Beach Trip"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={tripDescription}
                onChange={(e) => setTripDescription(e.target.value)}
                placeholder="Brief description of your trip..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
              />
            </div>

            <button
              onClick={handleSaveTrip}
              className="w-full btn bg-purple-600 text-white hover:bg-purple-700"
            >
              <CheckCircle className="h-5 w-5 mr-2" />
              Create Trip
            </button>
          </div>
        )}

        {/* Trip Filter */}
        {trips.length > 0 && (
          <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
            <label className="block text-sm font-semibold text-gray-700 mb-3">Filter by Trip</label>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setSelectedTrip('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedTrip === 'all'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                All Entries
              </button>
              {trips.map((trip) => (
                <button
                  key={trip.id}
                  onClick={() => setSelectedTrip(trip.name)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    selectedTrip === trip.name
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {trip.name}
                </button>
              ))}
              <button
                onClick={() => setSelectedTrip('unassigned')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedTrip === 'unassigned'
                    ? 'bg-gray-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                Unassigned
              </button>
            </div>
          </div>
        )}

        {/* New Entry Form */}
        {showNewEntry && (
          <div className="card mb-8 border-2 border-blue-200 bg-white shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Daily Travel Journal</h2>
              <button
                onClick={() => setShowNewEntry(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Trip Selection */}
            {trips.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Assign to Trip (Optional)
                </label>
                <select
                  value={selectedTripForEntry}
                  onChange={(e) => setSelectedTripForEntry(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                >
                  <option value="">No Trip (Daily Entry)</option>
                  {trips.map((trip) => (
                    <option key={trip.id} value={trip.name}>
                      {trip.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Title Input */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Entry Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Amazing trip to Marina Beach..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Content Textarea */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Your Story
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write about your experience, feelings, observations, and memories from your trip..."
                rows={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
              />
            </div>

            {/* Photo Upload */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Add Photos
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-blue-300 rounded-lg p-6 text-center cursor-pointer hover:bg-blue-50 transition-colors"
              >
                <ImageIcon className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                <p className="text-gray-700 font-medium">Click to add photos</p>
                <p className="text-sm text-gray-500">or drag and drop</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>

              {/* Photo Previews */}
              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mt-4">
                  {photos.map((photo, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={photo}
                        alt={`Photo ${idx + 1}`}
                        className="h-24 w-24 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => removePhoto(idx)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveEntry}
              className="w-full btn btn-primary"
            >
              <>
                <CheckCircle className="h-5 w-5 mr-2" />
                Save Entry
              </>
            </button>
          </div>
        )}

        {/* Journal Entries */}
        {entries.length === 0 ? (
          <div className="card text-center py-16 border-2 border-dashed border-blue-200">
            <Book className="h-16 w-16 text-blue-300 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Start Your Memory Hub</h2>
            <p className="text-gray-600 mb-8">
              Begin documenting your travel stories, create memories, and let AI enhance your narratives
            </p>
            <button
              onClick={() => setShowNewEntry(true)}
              className="btn btn-primary mx-auto"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create First Entry
            </button>
          </div>
        ) : getFilteredEntries().length === 0 ? (
          <div className="card text-center py-16 border-2 border-dashed border-blue-200">
            <Book className="h-16 w-16 text-blue-300 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">No entries for this filter</h2>
            <p className="text-gray-600 mb-8">
              Try selecting a different trip or create a new entry
            </p>
            <button
              onClick={() => setSelectedTrip('all')}
              className="btn btn-primary mx-auto"
            >
              Show All Entries
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {getFilteredEntries().map((entry) => (
              <div key={entry.id} className="card border-l-4 border-blue-500 shadow-lg hover:shadow-xl transition-shadow">
                {/* Entry Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{entry.title}</h3>
                      {entry.tripName && (
                        <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                          {entry.tripName}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 flex items-center">
                      <Calendar className="h-4 w-4 mr-2" />
                      {entry.date}
                    </p>
                  </div>
                  {entry.enhanced && (
                    <div className="flex items-center space-x-1 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                      <Sparkles className="h-3 w-3" />
                      AI Enhanced
                    </div>
                  )}
                </div>

                {/* Display Enhanced Content if Available */}
                {entry.enhanced && entry.enhancedContent && !showEnhancedView ? (
                  <div className="bg-blue-50 p-4 rounded-lg mb-4 border-l-4 border-blue-500">
                    <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
                      <Sparkles className="h-4 w-4 mr-2" />
                      AI Enhanced Version
                    </h4>
                    <p className="text-gray-700 whitespace-pre-wrap">{entry.enhancedContent}</p>
                  </div>
                ) : (
                  <p className="text-gray-700 mb-4 whitespace-pre-wrap">{entry.content}</p>
                )}

                {/* Photos */}
                {entry.photos.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {entry.photos.map((photo, idx) => (
                      <img
                        key={idx}
                        src={photo}
                        alt={`Memory ${idx + 1}`}
                        className="h-32 w-32 object-cover rounded-lg hover:scale-105 transition-transform cursor-pointer"
                      />
                    ))}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="flex items-center space-x-2">
                    {/* Audio Playback Controls */}
                    {playingEntryId === entry.id ? (
                      <div className="flex items-center space-x-2">
                        {isPaused ? (
                          <button
                            onClick={() => handlePlayAudio(entry)}
                            className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-all"
                          >
                            <Volume2 className="h-4 w-4" />
                            <span>Resume</span>
                          </button>
                        ) : (
                          <button
                            onClick={handlePauseAudio}
                            className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-all"
                          >
                            <Pause className="h-4 w-4" />
                            <span>Pause</span>
                          </button>
                        )}
                        <button
                          onClick={handleStopAudio}
                          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all"
                        >
                          <VolumeX className="h-4 w-4" />
                          <span>Stop</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handlePlayAudio(entry)}
                        className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:shadow-lg transition-all"
                      >
                        <Volume2 className="h-4 w-4" />
                        <span>Listen to Entry</span>
                      </button>
                    )}
                  </div>

                  {/* AI Enhance Button */}
                  <button
                    onClick={() => handleEnhanceWithAI(entry)}
                    disabled={enhancing || entry.enhanced}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all ${
                      entry.enhanced
                        ? 'bg-gray-100 text-gray-600 cursor-default'
                        : enhancing
                        ? 'bg-blue-500 text-white opacity-75'
                        : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:shadow-lg'
                    }`}
                  >
                    {enhancing ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin" />
                        <span>Enhancing...</span>
                      </>
                    ) : entry.enhanced ? (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        <span>Already Enhanced</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        <span>Enhance with AI</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        </>
        )}

        {/* Expense Tracker Tab Content */}
        {activeTab === 'expenses' && (
          <>
            {/* Add Expense Form */}
            {showNewExpense && (
              <div className="card mb-8 border-2 border-blue-200 bg-white shadow-lg">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Add Travel Expense</h2>
                  <button
                    onClick={() => setShowNewExpense(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                {/* Category */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option>Food & Dining</option>
                    <option>Accommodation</option>
                    <option>Transport</option>
                    <option>Activities</option>
                    <option>Shopping</option>
                    <option>Other</option>
                  </select>
                </div>

                {/* Description */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={expenseDescription}
                    onChange={(e) => setExpenseDescription(e.target.value)}
                    placeholder="e.g., Lunch at Marina Beach restaurant"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                {/* Amount */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                {/* Add Button */}
                <button
                  onClick={handleAddExpense}
                  className="w-full btn btn-primary"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Add Expense
                </button>
              </div>
            )}

            {/* Date Selector for Filtering */}
            {expenses.length > 0 && (
              <div className="mb-6 p-4 bg-white border border-blue-200 rounded-lg">
                <label className="block text-sm font-semibold text-gray-700 mb-3">Filter by Date</label>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setSelectedExpenseDate('')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      selectedExpenseDate === ''
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    All Dates
                  </button>
                  {getUniqueDates().map((date) => (
                    <button
                      key={date}
                      onClick={() => setSelectedExpenseDate(date)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        selectedExpenseDate === date
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {new Date(date).toLocaleDateString('en-IN', { 
                        month: 'short', 
                        day: 'numeric',
                        year: selectedExpenseDate === '' ? '2-digit' : undefined
                      })}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Expense Summary */}
            {expenses.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="card bg-blue-50 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm font-semibold">Total Spent</p>
                      <p className="text-3xl font-bold text-blue-600">₹{getDayTotalExpense(selectedExpenseDate).toFixed(2)}</p>
                    </div>
                    <DollarSign className="h-12 w-12 text-blue-300" />
                  </div>
                </div>

                <div className="card bg-cyan-50 border border-cyan-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm font-semibold">Transactions</p>
                      <p className="text-3xl font-bold text-cyan-600">{getFilteredExpensesByDate(selectedExpenseDate).length}</p>
                    </div>
                    <CheckCircle className="h-12 w-12 text-cyan-300" />
                  </div>
                </div>

                <div className="card bg-indigo-50 border border-indigo-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm font-semibold">Avg Expense</p>
                      <p className="text-3xl font-bold text-indigo-600">₹{getFilteredExpensesByDate(selectedExpenseDate).length > 0 ? (getDayTotalExpense(selectedExpenseDate) / getFilteredExpensesByDate(selectedExpenseDate).length).toFixed(2) : '0.00'}</p>
                    </div>
                    <Calendar className="h-12 w-12 text-indigo-300" />
                  </div>
                </div>
              </div>
            )}

            {/* Category Breakdown */}
            {Object.keys(getExpensesByCategory()).length > 0 && (
              <div className="card mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Expenses by Category</h3>
                <div className="space-y-2">
                  {Object.entries(getExpensesByCategory()).map(([category, total]) => (
                    <div key={category} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-700">{category}</span>
                      <span className="font-bold text-blue-600">₹{total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Expenses List - Daywise */}
            {expenses.length === 0 ? (
              <div className="card text-center py-12 border-2 border-dashed border-blue-200">
                <DollarSign className="h-16 w-16 text-blue-300 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">No expenses yet</h2>
                <p className="text-gray-600 mb-6">
                  Start tracking your travel expenses to see spending breakdown
                </p>
                <button
                  onClick={() => setShowNewExpense(true)}
                  className="btn btn-primary mx-auto"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Add First Expense
                </button>
              </div>
            ) : getFilteredExpensesByDate(selectedExpenseDate).length === 0 && selectedExpenseDate !== '' ? (
              <div className="card text-center py-12 border-2 border-dashed border-blue-200">
                <DollarSign className="h-16 w-16 text-blue-300 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">No expenses for selected date</h2>
                <p className="text-gray-600">
                  Try selecting a different date or "All Dates" to view all expenses
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {selectedExpenseDate === '' 
                  ? getExpensesByDate().map(([date, dayExpenses]) => (
                  <div key={date} className="card">
                    {/* Day Header */}
                    <div className="flex items-center justify-between mb-4 pb-4 border-b-2 border-blue-200">
                      <div className="flex items-center space-x-3">
                        <Calendar className="h-5 w-5 text-blue-600" />
                        <div>
                          <h3 className="font-bold text-gray-900 text-lg">{date}</h3>
                          <p className="text-sm text-gray-500">{dayExpenses.length} expense{dayExpenses.length !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600">₹{getDayTotalExpense(dayExpenses).toFixed(2)}</p>
                        <p className="text-xs text-gray-500">Daily Total</p>
                      </div>
                    </div>

                    {/* Day Expenses */}
                    <div className="space-y-2">
                      {dayExpenses.map((expense) => (
                        <div key={expense.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors">
                          <div className="flex items-center space-x-3 flex-1">
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                              {expense.category}
                            </span>
                            <h4 className="font-medium text-gray-900">{expense.description}</h4>
                          </div>
                          <div className="flex items-center space-x-4">
                            <p className="text-lg font-bold text-blue-600 min-w-20 text-right">₹{expense.amount.toFixed(2)}</p>
                            <button
                              onClick={() => handleDeleteExpense(expense.id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete expense"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
                  : (
                    <div key={selectedExpenseDate} className="card">
                      {/* Day Header */}
                      <div className="flex items-center justify-between mb-4 pb-4 border-b-2 border-blue-200">
                        <div className="flex items-center space-x-3">
                          <Calendar className="h-5 w-5 text-blue-600" />
                          <div>
                            <h3 className="font-bold text-gray-900 text-lg">{selectedExpenseDate}</h3>
                            <p className="text-sm text-gray-500">{getFilteredExpensesByDate(selectedExpenseDate).length} expense{getFilteredExpensesByDate(selectedExpenseDate).length !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-blue-600">₹{getDayTotalExpense(selectedExpenseDate).toFixed(2)}</p>
                          <p className="text-xs text-gray-500">Total</p>
                        </div>
                      </div>

                      {/* Day Expenses */}
                      <div className="space-y-2">
                        {getFilteredExpensesByDate(selectedExpenseDate).map((expense) => (
                          <div key={expense.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors">
                            <div className="flex items-center space-x-3 flex-1">
                              <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                                {expense.category}
                              </span>
                              <h4 className="font-medium text-gray-900">{expense.description}</h4>
                            </div>
                            <div className="flex items-center space-x-4">
                              <p className="text-lg font-bold text-blue-600 min-w-20 text-right">₹{expense.amount.toFixed(2)}</p>
                              <button
                                onClick={() => handleDeleteExpense(expense.id)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete expense"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                }
              </div>
            )}
          </>
        )}
      </div>

      {/* Video Compilation Player Modal */}
      {showVideoPlayer && getFilteredEntries().length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-6xl">
            {/* Close Button */}
            <button
              onClick={handleCloseVideo}
              className="absolute top-4 right-4 z-10 p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition-all"
            >
              <X className="h-6 w-6 text-white" />
            </button>

            {/* Video Content */}
            <div className="bg-gradient-to-br from-purple-900 via-blue-900 to-pink-900 rounded-2xl shadow-2xl overflow-hidden">
              {/* Title Bar */}
              <div className="bg-black bg-opacity-40 px-8 py-6 border-b border-white border-opacity-20">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-white mb-2">{getFilteredEntries()[currentEntryIndex]?.title}</h2>
                    <p className="text-blue-200 flex items-center">
                      <Calendar className="h-4 w-4 mr-2" />
                      {getFilteredEntries()[currentEntryIndex]?.date}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-sm opacity-80">
                      {selectedTrip !== 'all' ? `${selectedTrip} Memories` : 'Memory Compilation'}
                    </p>
                    <p className="text-2xl font-bold text-white">
                      {currentEntryIndex + 1} / {getFilteredEntries().length}
                    </p>
                  </div>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="relative h-96 md:h-[32rem] flex items-center justify-center overflow-hidden">
                {/* Background Image with Ken Burns Effect */}
                {getFilteredEntries()[currentEntryIndex]?.photos.length > 0 ? (
                  <div className="absolute inset-0">
                    <img
                      src={getFilteredEntries()[currentEntryIndex].photos[currentPhotoIndex]}
                      alt="Memory"
                      className="w-full h-full object-cover transition-transform duration-[4000ms] ease-in-out"
                      style={{
                        transform: videoPlaying ? 'scale(1.1)' : 'scale(1)',
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black opacity-60"></div>
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-800 via-blue-800 to-pink-800 animate-gradient"></div>
                )}

                {/* Text Overlay */}
                <div className="relative z-10 max-w-4xl mx-auto px-8 text-center">
                  <div className="bg-black bg-opacity-50 backdrop-blur-md rounded-2xl p-8 border border-white border-opacity-20 transition-all duration-500">
                    <p className="text-white text-xl md:text-2xl leading-relaxed font-light">
                      {getFilteredEntries()[currentEntryIndex]?.enhanced && getFilteredEntries()[currentEntryIndex]?.enhancedContent 
                        ? getFilteredEntries()[currentEntryIndex].enhancedContent 
                        : getFilteredEntries()[currentEntryIndex]?.content}
                    </p>
                  </div>
                </div>

                {/* Photo Counter */}
                {getFilteredEntries()[currentEntryIndex]?.photos.length > 1 && (
                  <div className="absolute bottom-4 right-4 bg-black bg-opacity-60 text-white px-4 py-2 rounded-full text-sm font-medium">
                    Photo {currentPhotoIndex + 1} of {getFilteredEntries()[currentEntryIndex].photos.length}
                  </div>
                )}

                {/* Entry Counter Badge */}
                <div className="absolute top-4 left-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-3 rounded-full font-bold text-lg shadow-lg">
                  Memory {currentEntryIndex + 1} of {getFilteredEntries().length}
                </div>
              </div>

              {/* Progress Bar & Controls */}
              <div className="bg-black bg-opacity-40 px-8 py-4">
                <div className="w-full bg-gray-700 rounded-full h-2 mb-4 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${videoProgress}%` }}
                  ></div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center space-x-3">
                  <button
                    onClick={handleSkipToPrevious}
                    disabled={currentEntryIndex === 0}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all ${
                      currentEntryIndex === 0
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-white bg-opacity-20 hover:bg-opacity-30 text-white'
                    }`}
                  >
                    <span>← Previous</span>
                  </button>
                  
                  <button
                    onClick={handlePauseVideo}
                    className="flex items-center space-x-2 px-6 py-3 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg font-medium transition-all"
                  >
                    {videoPlaying ? (
                      <>
                        <Pause className="h-5 w-5" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-5 w-5" />
                        <span>Resume</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleSkipToNext}
                    disabled={currentEntryIndex === getFilteredEntries().length - 1}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all ${
                      currentEntryIndex === getFilteredEntries().length - 1
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-white bg-opacity-20 hover:bg-opacity-30 text-white'
                    }`}
                  >
                    <span>Next →</span>
                  </button>
                  
                  <button
                    onClick={handleCloseVideo}
                    className="flex items-center space-x-2 px-6 py-3 bg-blue-600 bg-opacity-80 hover:bg-opacity-100 text-white rounded-lg font-medium transition-all"
                  >
                    <X className="h-5 w-5" />
                    <span>Close</span>
                  </button>
                </div>

                {/* Enhanced Badge */}
                {getFilteredEntries()[currentEntryIndex]?.enhanced && (
                  <div className="flex items-center justify-center mt-4">
                    <div className="flex items-center space-x-2 bg-blue-500 bg-opacity-50 text-white px-4 py-2 rounded-full text-sm">
                      <Sparkles className="h-4 w-4" />
                      <span>AI Enhanced Memory</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
