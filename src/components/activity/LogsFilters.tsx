import { RefreshCw, Search } from 'lucide-react'

// Local literal unions to keep props strongly typed without cross-file dependency
export type ActionFilter = 'all' | 'create' | 'update' | 'delete' | 'login' | 'logout'
export type EntityFilter = 'all' | 'employee' | 'company' | 'user' | 'settings'
export type DateFilter = 'all' | 'today' | 'week' | 'month'

interface LogsFiltersProps {
  searchTerm: string
  onSearchTermChange: (value: string) => void
  actionFilter: ActionFilter
  onActionFilterChange: (value: ActionFilter) => void
  entityFilter: EntityFilter
  onEntityFilterChange: (value: EntityFilter) => void
  dateFilter: DateFilter
  onDateFilterChange: (value: DateFilter) => void
  hasActiveFilters: boolean
  onReset: () => void
}

export function LogsFilters(props: LogsFiltersProps) {
  const {
    searchTerm,
    onSearchTermChange,
    actionFilter,
    onActionFilterChange,
    entityFilter,
    onEntityFilterChange,
    dateFilter,
    onDateFilterChange,
    hasActiveFilters,
    onReset,
  } = props

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 mb-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">الفلاتر</h3>
          {hasActiveFilters && (
            <button
              onClick={onReset}
              className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1 px-2 py-1 rounded hover:bg-purple-50 transition"
            >
              <RefreshCw className="w-3 h-3" />
              إعادة تعيين
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          {/* Search */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 sm:w-5 h-4 sm:h-5" />
              <input
                type="text"
                placeholder="البحث..."
                value={searchTerm}
                onChange={(e) => onSearchTermChange(e.target.value)}
                className="w-full pr-9 sm:pr-10 pl-3 sm:pl-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Action Filter */}
          <div>
            <select
              value={actionFilter}
              onChange={(e) => onActionFilterChange(e.target.value as ActionFilter)}
              className="w-full px-2 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
            >
              <option value="all">جميع العمليات</option>
              <option value="create">إنشاء</option>
              <option value="update">تحديث</option>
              <option value="delete">حذف</option>
              <option value="login">دخول/خروج</option>
            </select>
          </div>

          {/* Entity Filter */}
          <div>
            <select
              value={entityFilter}
              onChange={(e) => onEntityFilterChange(e.target.value as EntityFilter)}
              className="w-full px-2 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
            >
              <option value="all">جميع الأنواع</option>
              <option value="employee">موظفين</option>
              <option value="company">مؤسسات</option>
              <option value="user">مستخدمين</option>
              <option value="settings">إعدادات</option>
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <select
              value={dateFilter}
              onChange={(e) => onDateFilterChange(e.target.value as DateFilter)}
              className="w-full px-2 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
            >
              <option value="all">جميع التواريخ</option>
              <option value="today">اليوم</option>
              <option value="week">أسبوع</option>
              <option value="month">شهر</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
