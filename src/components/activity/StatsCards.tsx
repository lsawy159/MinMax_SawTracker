import { Activity, Plus, Edit, Trash2, Calendar, Clock, User as UserIcon, Building2 } from 'lucide-react'

interface StatsCardsProps {
  total: number
  createCount: number
  updateCount: number
  deleteCount: number
  todayCount: number
  weekCount: number
  employeeCount: number
  companyCount: number
}

export function StatsCards({
  total,
  createCount,
  updateCount,
  deleteCount,
  todayCount,
  weekCount,
  employeeCount,
  companyCount,
}: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-6 overflow-hidden">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 sm:p-3 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-1">
          <div className="min-w-0">
            <div className="text-base sm:text-lg lg:text-xl font-bold text-gray-900">{total}</div>
            <div className="text-xs text-gray-600 mt-0.5 line-clamp-1">السجلات</div>
          </div>
          <div className="bg-purple-100 p-1.5 sm:p-2 rounded flex-shrink-0">
            <Activity className="w-3 sm:w-4 h-3 sm:h-4 text-purple-600" />
          </div>
        </div>
      </div>

      <div className="bg-green-50 rounded-lg shadow-sm border border-green-200 p-2 sm:p-3 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-1">
          <div className="min-w-0">
            <div className="text-base sm:text-lg lg:text-xl font-bold text-green-600">{createCount}</div>
            <div className="text-xs text-green-700 mt-0.5 line-clamp-1">إنشاء</div>
          </div>
          <div className="bg-green-100 p-1.5 sm:p-2 rounded flex-shrink-0">
            <Plus className="w-3 sm:w-4 h-3 sm:h-4 text-green-600" />
          </div>
        </div>
      </div>

      <div className="bg-blue-50 rounded-lg shadow-sm border border-blue-200 p-2 sm:p-3 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-1">
          <div className="min-w-0">
            <div className="text-base sm:text-lg lg:text-xl font-bold text-blue-600">{updateCount}</div>
            <div className="text-xs text-blue-700 mt-0.5 line-clamp-1">تحديث</div>
          </div>
          <div className="bg-blue-100 p-1.5 sm:p-2 rounded flex-shrink-0">
            <Edit className="w-3 sm:w-4 h-3 sm:h-4 text-blue-600" />
          </div>
        </div>
      </div>

      <div className="bg-red-50 rounded-lg shadow-sm border border-red-200 p-2 sm:p-3 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-1">
          <div className="min-w-0">
            <div className="text-base sm:text-lg lg:text-xl font-bold text-red-600">{deleteCount}</div>
            <div className="text-xs text-red-700 mt-0.5 line-clamp-1">حذف</div>
          </div>
          <div className="bg-red-100 p-1.5 sm:p-2 rounded flex-shrink-0">
            <Trash2 className="w-3 sm:w-4 h-3 sm:h-4 text-red-600" />
          </div>
        </div>
      </div>

      <div className="bg-purple-50 rounded-lg shadow-sm border border-purple-200 p-2 sm:p-3 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-1">
          <div className="min-w-0">
            <div className="text-base sm:text-lg lg:text-xl font-bold text-purple-600">{todayCount}</div>
            <div className="text-xs text-purple-700 mt-0.5 line-clamp-1">اليوم</div>
          </div>
          <div className="bg-purple-100 p-1.5 sm:p-2 rounded flex-shrink-0">
            <Calendar className="w-3 sm:w-4 h-3 sm:h-4 text-purple-600" />
          </div>
        </div>
      </div>

      <div className="bg-orange-50 rounded-lg shadow-sm border border-orange-200 p-2 sm:p-3 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-1">
          <div className="min-w-0">
            <div className="text-base sm:text-lg lg:text-xl font-bold text-orange-600">{weekCount}</div>
            <div className="text-xs text-orange-700 mt-0.5 line-clamp-1">الأسبوع</div>
          </div>
          <div className="bg-orange-100 p-1.5 sm:p-2 rounded flex-shrink-0">
            <Clock className="w-3 sm:w-4 h-3 sm:h-4 text-orange-600" />
          </div>
        </div>
      </div>

      <div className="bg-indigo-50 rounded-lg shadow-sm border border-indigo-200 p-2 sm:p-3 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-1">
          <div className="min-w-0">
            <div className="text-base sm:text-lg lg:text-xl font-bold text-indigo-600">{employeeCount}</div>
            <div className="text-xs text-indigo-700 mt-0.5 line-clamp-1">الموظفين</div>
          </div>
          <div className="bg-indigo-100 p-1.5 sm:p-2 rounded flex-shrink-0">
            <UserIcon className="w-3 sm:w-4 h-3 sm:h-4 text-indigo-600" />
          </div>
        </div>
      </div>

      <div className="bg-teal-50 rounded-lg shadow-sm border border-teal-200 p-2 sm:p-3 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-1">
          <div className="min-w-0">
            <div className="text-base sm:text-lg lg:text-xl font-bold text-teal-600">{companyCount}</div>
            <div className="text-xs text-teal-700 mt-0.5 line-clamp-1">المؤسسات</div>
          </div>
          <div className="bg-teal-100 p-1.5 sm:p-2 rounded flex-shrink-0">
            <Building2 className="w-3 sm:w-4 h-3 sm:h-4 text-teal-600" />
          </div>
        </div>
      </div>
    </div>
  )
}
