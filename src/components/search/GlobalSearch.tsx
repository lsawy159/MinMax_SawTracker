import { useState, useEffect, useRef } from 'react'
import { Search, X, Clock, Star, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

interface SearchResult {
  id: string
  type: 'employee' | 'company'
  title: string
  subtitle: string
  metadata?: string
}

interface SavedSearch {
  id: string
  name: string
  search_query: string
  search_type: string
}

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>()
  const navigate = useNavigate()

  // Load saved searches and recent searches
  useEffect(() => {
    loadSavedSearches()
    loadRecentSearches()
  }, [])

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Keyboard shortcut (Ctrl+K)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
        inputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const loadSavedSearches = async () => {
    const { data } = await supabase
      .from('saved_searches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)
    
    if (data) setSavedSearches(data)
  }

  const loadRecentSearches = () => {
    const stored = localStorage.getItem('recentSearches')
    if (stored) {
      setRecentSearches(JSON.parse(stored))
    }
  }

  const saveToRecentSearches = (searchQuery: string) => {
    const updated = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 5)
    setRecentSearches(updated)
    localStorage.setItem('recentSearches', JSON.stringify(updated))
  }

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    setIsLoading(true)
    try {
      // Search employees using full-text search
      const { data: employees } = await supabase
        .from('employees')
        .select('id, name, profession, nationality, companies(name)')
        .textSearch('search_vector', searchQuery, {
          type: 'websearch',
          config: 'arabic'
        })
        .limit(5)

      // Search companies
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name, unified_number, social_insurance_number')
        .textSearch('search_vector', searchQuery, {
          type: 'websearch',
          config: 'arabic'
        })
        .limit(5)

      const employeeResults: SearchResult[] = (employees || []).map(emp => ({
        id: emp.id,
        type: 'employee' as const,
        title: emp.name,
        subtitle: emp.profession,
        metadata: `${emp.nationality} - ${(emp as any).companies?.name || 'بدون مؤسسة'}`
      }))

      const companyResults: SearchResult[] = (companies || []).map(comp => ({
        id: comp.id,
        type: 'company' as const,
        title: comp.name,
        subtitle: `الرقم الموحد: ${comp.unified_number || 'غير محدد'}`,
        metadata: comp.social_insurance_number ? `رقم اشتراك التأمينات: ${comp.social_insurance_number}` : ''
      }))

      setResults([...employeeResults, ...companyResults])
      saveToRecentSearches(searchQuery)
    } catch (error) {
      console.error('Search error:', error)
      toast.error('حدث خطأ أثناء البحث')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearchChange = (value: string) => {
    setQuery(value)
    
    // Debounce search
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }
    
    debounceTimer.current = setTimeout(() => {
      performSearch(value)
    }, 300)
  }

  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'employee') {
      navigate('/employees')
    } else {
      navigate('/companies')
    }
    setIsOpen(false)
    setQuery('')
  }

  const handleSavedSearchClick = (savedSearch: SavedSearch) => {
    setQuery(savedSearch.search_query)
    performSearch(savedSearch.search_query)
  }

  const clearSearch = () => {
    setQuery('')
    setResults([])
  }

  return (
    <div ref={searchRef} className="relative">
      {/* Search Button - Material Design */}
      <button
        onClick={() => {
          setIsOpen(true)
          setTimeout(() => inputRef.current?.focus(), 100)
        }}
        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:shadow-[0_2px_4px_-1px_rgba(0,0,0,0.2),0_4px_5px_0_rgba(0,0,0,0.14)] transition-all duration-200 ease-in-out w-64 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        <Search className="w-4 h-4 text-gray-500" />
        <span className="flex-1 text-right">بحث شامل...</span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-gray-300 bg-gray-50 px-1.5 font-mono text-[10px] font-medium text-gray-600 shadow-sm">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Search Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setIsOpen(false)} />
          
          {/* Search Panel - Material Design */}
          <div className="absolute top-12 left-0 w-[600px] bg-white border border-gray-200 rounded-lg shadow-[0_8px_16px_-4px_rgba(0,0,0,0.2),0_6px_12px_0_rgba(0,0,0,0.14),0_2px_4px_0_rgba(0,0,0,0.12)] z-50 max-h-[500px] flex flex-col">
            {/* Search Input */}
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="ابحث في الموظفين والمؤسسات..."
                  className="w-full pr-10 pl-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200"
                />
                {query && (
                  <button
                    onClick={clearSearch}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                {isLoading && (
                  <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />
                )}
              </div>
            </div>

            {/* Results */}
            <div className="overflow-y-auto flex-1">
              {/* Search Results */}
              {results.length > 0 && (
                <div className="p-2">
                  <div className="text-xs font-semibold text-muted-foreground px-2 py-1">
                    نتائج البحث ({results.length})
                  </div>
                  {results.map((result) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleResultClick(result)}
                      className="w-full text-right px-3 py-2 rounded-md hover:bg-accent transition-colors flex items-start gap-3"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{result.title}</div>
                        <div className="text-sm text-muted-foreground">{result.subtitle}</div>
                        {result.metadata && (
                          <div className="text-xs text-muted-foreground mt-1">{result.metadata}</div>
                        )}
                      </div>
                      <div className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                        {result.type === 'employee' ? 'موظف' : 'مؤسسة'}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Empty State */}
              {query && !isLoading && results.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>لا توجد نتائج لـ "{query}"</p>
                </div>
              )}

              {/* Recent & Saved Searches */}
              {!query && (
                <div className="p-2">
                  {/* Saved Searches */}
                  {savedSearches.length > 0 && (
                    <div className="mb-4">
                      <div className="text-xs font-semibold text-muted-foreground px-2 py-1 flex items-center gap-2">
                        <Star className="w-3 h-3" />
                        البحوث المحفوظة
                      </div>
                      {savedSearches.map((saved) => (
                        <button
                          key={saved.id}
                          onClick={() => handleSavedSearchClick(saved)}
                          className="w-full text-right px-3 py-2 rounded-md hover:bg-accent transition-colors flex items-center gap-2"
                        >
                          <Star className="w-4 h-4 text-yellow-500" />
                          <span className="flex-1">{saved.name}</span>
                          <span className="text-xs text-muted-foreground">{saved.search_query}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Recent Searches */}
                  {recentSearches.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground px-2 py-1 flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        عمليات البحث الأخيرة
                      </div>
                      {recentSearches.map((recent, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSearchChange(recent)}
                          className="w-full text-right px-3 py-2 rounded-md hover:bg-accent transition-colors flex items-center gap-2"
                        >
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="flex-1">{recent}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Advanced Search Link */}
                  <div className="mt-4 pt-4 border-t px-2">
                    <button
                      onClick={() => {
                        navigate('/advanced-search')
                        setIsOpen(false)
                      }}
                      className="w-full text-center py-2 text-sm text-primary hover:underline"
                    >
                      البحث المتقدم والفلترة
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
