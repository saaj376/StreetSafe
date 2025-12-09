import { useState, useRef, useEffect } from 'react'
import { Book, Plus, Calendar, Sparkles, X, Loader, Image as ImageIcon, CheckCircle, DollarSign, Trash2 } from 'lucide-react'

interface JournalEntry {
  id: string
  date: string
  title: string
  content: string
  photos: string[]
  enhanced: boolean
  enhancedContent?: string
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

export default function Journal() {
  const [showNewEntry, setShowNewEntry] = useState(false)
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [activeTab, setActiveTab] = useState<'journal' | 'expenses'>('journal')
  
  // Form states for journal
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [enhancing, setEnhancing] = useState(false)
  const [showEnhancedView, setShowEnhancedView] = useState(false)
  
  // Form states for expenses
  const [showNewExpense, setShowNewExpense] = useState(false)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [expenseCategory, setExpenseCategory] = useState<string>('Food & Dining')
  const [expenseDescription, setExpenseDescription] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [selectedExpenseDate, setSelectedExpenseDate] = useState<string>('')
  
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
      enhancedContent: ''
    }

    const updatedEntries = [newEntry, ...entries]
    setEntries(updatedEntries)
    
    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedEntries))
    
    // Reset form
    setTitle('')
    setContent('')
    setPhotos([])
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
            <button
              onClick={() => activeTab === 'journal' ? setShowNewEntry(!showNewEntry) : setShowNewExpense(!showNewExpense)}
              className="btn btn-primary"
            >
              <Plus className="h-5 w-5 mr-2" />
              {activeTab === 'journal' ? 'New Entry' : 'Add Expense'}
            </button>
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
        ) : (
          <div className="space-y-6">
            {entries.map((entry) => (
              <div key={entry.id} className="card border-l-4 border-blue-500 shadow-lg hover:shadow-xl transition-shadow">
                {/* Entry Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{entry.title}</h3>
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

                {/* AI Enhance Button */}
                <div className="flex items-center space-x-2 pt-4 border-t border-gray-200">
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
    </div>
  )
}
