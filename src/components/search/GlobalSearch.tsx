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
  const debounceTimer = useRef<NodeJS.Timeout>()
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
        .select('id, name, tax_number, unified_number')
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
        subtitle: `رقم التأميني: ${comp.tax_number || 'غير محدد'}`,
        metadata: `رقم موحد: ${comp.unified_number || 'غير محدد'}`
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
      {/* Search Button */}
      <button
        onClick={() => {
          setIsOpen(true)
          setTimeout(() => inputRef.current?.focus(), 100)
        }}
        className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground border rounded-md hover:bg-accent transition-colors w-64"
      >
        <Search className="w-4 h-4" />
        <span>بحث شامل...</span>
        <kbd className="mr-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Search Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setIsOpen(false)} />
          
          {/* Search Panel */}
          <div className="absolute top-12 left-0 w-[600px] bg-background border rounded-lg shadow-2xl z-50 max-h-[500px] flex flex-col">
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
                  className="w-full pr-10 pl-10 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
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
