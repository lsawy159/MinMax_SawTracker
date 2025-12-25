import { ActivityLog, User } from '@/lib/supabase'
import { CheckSquare, Square, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'

interface LogsTableProps {
  loading: boolean
  isAdmin: boolean
  paginatedLogs: ActivityLog[]
  filteredTotal: number
  startIndex: number
  endIndex: number
  itemsPerPage: number
  setItemsPerPage: (n: number) => void
  currentPage: number
  totalPages: number
  setCurrentPage: (n: number) => void
  usersMap: Map<string, User>
  getActionColor: (action: string) => { bg: string; border: string; text: string; badge: string; icon: string }
  getActionIcon: (action: string) => JSX.Element
  getActionLabel: (action: string) => string
  getEntityLabel: (entity: string) => string
  isImportantAction: (action: string) => boolean
  formatDateTimeWithHijri: (date: string) => string
  onRowClick: (log: ActivityLog) => void
  selectedLogIds: Set<number>
  allSelected: boolean
  someSelected: boolean
  handleSelectAll: () => void
  handleSelectLog: (id: number) => void
}

export function LogsTable(props: LogsTableProps) {
  const {
    loading,
    isAdmin,
    paginatedLogs,
    filteredTotal,
    startIndex,
    endIndex,
    itemsPerPage,
    setItemsPerPage,
    currentPage,
    totalPages,
    setCurrentPage,
    usersMap,
    getActionColor,
    getActionIcon,
    getActionLabel,
    getEntityLabel,
    isImportantAction,
    formatDateTimeWithHijri,
    onRowClick,
    selectedLogIds,
    allSelected,
    someSelected,
    handleSelectAll,
    handleSelectLog,
  } = props

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  if (!loading && filteredTotal === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">لا توجد سجلات</h3>
        <p className="text-gray-600">لا توجد نتائج تطابق الفلاتر المحددة</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Top pagination controls */}
      <div className="bg-white p-3 sm:p-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs sm:text-sm text-gray-600">
            عرض {startIndex + 1}-{Math.min(endIndex, filteredTotal)} من {filteredTotal} سجل
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-xs sm:text-sm text-gray-600">عرض:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value))
                }}
                className="px-2 py-1 text-xs sm:text-sm border rounded"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-xs sm:text-sm text-gray-600">سجل</span>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block w-full overflow-x-auto">
        <table className="w-full min-w-max">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {isAdmin && (
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase w-10 sm:w-12">
                  <button onClick={handleSelectAll} className="flex items-center justify-center w-4 sm:w-5 h-4 sm:h-5">
                    {allSelected ? (
                      <CheckSquare className="w-4 sm:w-5 h-4 sm:h-5 text-purple-600" />
                    ) : someSelected ? (
                      <div className="w-4 sm:w-5 h-4 sm:h-5 border-2 border-purple-600 rounded bg-purple-100" />
                    ) : (
                      <Square className="w-4 sm:w-5 h-4 sm:h-5 text-gray-400" />
                    )}
                  </button>
                </th>
              )}
              <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">العملية</th>
              <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">نوع الكيان</th>
              <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">المستخدم</th>
              <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">عنوان IP</th>
              <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">التاريخ والوقت</th>
              <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">التفاصيل</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedLogs.map((log) => {
              const colors = getActionColor(log.action)
              return (
                <tr
                  key={log.id}
                  className={`${colors.bg} hover:shadow-md hover:cursor-pointer transition-all duration-300 border-l ${colors.border}`}
                  onClick={() => onRowClick(log)}
                >
                  {isAdmin && (
                    <td className="px-3 sm:px-6 py-3 sm:py-4" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => handleSelectLog(log.id)} className="flex items-center justify-center w-4 sm:w-5 h-4 sm:h-5">
                        {selectedLogIds.has(log.id) ? (
                          <CheckSquare className="w-4 sm:w-5 h-4 sm:h-5 text-purple-600" />
                        ) : (
                          <Square className="w-4 sm:w-5 h-4 sm:h-5 text-gray-400" />
                        )}
                      </button>
                    </td>
                  )}
                  <td className="px-3 sm:px-6 py-3 sm:py-4">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${colors.icon}`}>
                        {getActionIcon(log.action)}
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-semibold text-gray-900">{getActionLabel(log.action)}</div>
                        <div className="text-[10px] sm:text-xs text-gray-600">ID: {log.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-700 whitespace-nowrap">
                    <span className="inline-block px-2.5 py-1 bg-gray-100 text-gray-800 rounded-lg text-xs font-medium">
                      {log.entity_type ? getEntityLabel(log.entity_type) : '-'}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-700">
                    {log.user_id ? (
                      (() => {
                        const user = usersMap.get(log.user_id)
                        return user ? (
                          <div>
                            <div className="font-medium text-gray-900">{user.full_name}</div>
                            <div className="text-gray-600 text-xs">{user.email}</div>
                          </div>
                        ) : (
                          <div className="font-mono text-gray-700 text-xs">{log.user_id}</div>
                        )
                      })()
                    ) : (
                      <span className="text-gray-500 text-xs">النظام</span>
                    )}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600 font-mono">{log.ip_address || '-'}</td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-700 whitespace-nowrap">
                    {formatDateTimeWithHijri(log.created_at)}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onRowClick(log)}
                      className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs hover:bg-gray-50"
                    >
                      التفاصيل
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3 p-3 sm:p-4">
        {paginatedLogs.map((log) => {
          const colors = getActionColor(log.action)
          const isSelected = selectedLogIds.has(log.id)
          return (
            <div
              key={log.id}
              className={`${colors.bg} border-l-4 ${colors.border} rounded-xl p-4 space-y-3 transition-all duration-300 hover:shadow-md hover:cursor-pointer`}
              onClick={() => onRowClick(log)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1" onClick={(e) => e.stopPropagation()}>
                  <div className={`p-2 rounded-lg ${colors.icon}`}>{getActionIcon(log.action)}</div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{getActionLabel(log.action)}</div>
                    <div className="text-xs text-gray-600">{log.entity_type ? getEntityLabel(log.entity_type) : '-'}</div>
                  </div>
                </div>
                {isAdmin && (
                  <button onClick={(e) => { e.stopPropagation(); handleSelectLog(log.id) }} className={`p-1 border rounded ${isSelected ? 'border-purple-500 bg-purple-50' : ''}`}>
                    {isSelected ? <CheckSquare className="w-4 h-4 text-purple-600" /> : <Square className="w-4 h-4 text-gray-500" />}
                  </button>
                )}
              </div>

              {isImportantAction(log.action) && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-100 border border-red-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span className="text-xs font-semibold text-red-700">عملية حساسة - احذر</span>
                </div>
              )}

              {log.user_id && (
                <div className="py-2 px-3 bg-white/60 rounded-lg border border-gray-200">
                  <div className="text-xs font-medium text-gray-600 mb-1">تم بواسطة</div>
                  {(() => {
                    const user = usersMap.get(log.user_id!)
                    return user ? (
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                        <div className="text-xs text-gray-600">{user.email}</div>
                      </div>
                    ) : (
                      <div className="text-xs font-mono text-gray-700">{log.user_id}</div>
                    )
                  })()}
                </div>
              )}

              {log.ip_address && (
                <div className="text-xs text-gray-600 px-3 py-1.5 bg-white/50 rounded border border-gray-100">
                  <span className="font-medium">IP:</span> <span className="font-mono">{log.ip_address}</span>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-200">
                <div className="text-xs text-gray-600">{formatDateTimeWithHijri(log.created_at)}</div>
                <button
                  onClick={(e) => { e.stopPropagation(); onRowClick(log) }}
                  className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs hover:bg-gray-50"
                >
                  التفاصيل
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gray-50 border-t border-gray-200 px-3 sm:px-6 py-3 sm:py-4">
          <div className="text-xs sm:text-sm text-gray-600">صفحة {currentPage} من {totalPages}</div>
          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-1 sm:p-2 border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="الصفحة السابقة"
            >
              <ChevronRight className="w-3 sm:w-4 h-3 sm:h-4" />
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number
              if (totalPages <= 5) pageNum = i + 1
              else if (currentPage <= 3) pageNum = i + 1
              else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i
              else pageNum = currentPage - 2 + i
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-2 sm:px-3 py-1 sm:py-2 border rounded-md text-xs sm:text-sm ${
                    currentPage === pageNum ? 'bg-purple-600 text-white border-purple-600' : 'hover:bg-gray-100'
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}

            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-1 sm:p-2 border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="الصفحة التالية"
            >
              <ChevronLeft className="w-3 sm:w-4 h-3 sm:h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
