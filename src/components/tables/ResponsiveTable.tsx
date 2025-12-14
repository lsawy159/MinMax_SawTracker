import React from 'react'

interface ResponsiveTableProps {
  children: React.ReactNode
  className?: string
  mobileStackColumns?: boolean
}

/**
 * مكون جدول متجاوب للموبايل والديسكتوب
 * يخفي الجدول على الشاشات الصغيرة (<768px) ويعرض بدلاً منه بطاقات
 */
export function ResponsiveTable({ children, className = '' }: ResponsiveTableProps) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      {children}
    </div>
  )
}

interface ResponsiveTableRowProps {
  children: React.ReactNode
  className?: string
}

/**
 * صف جدول متجاوب - يعرض كبطاقة على الموبايل
 */
export function ResponsiveTableRow({ children, className = '' }: ResponsiveTableRowProps) {
  return (
    <tr className={`hover:bg-gray-50 transition md:table-row block mb-4 md:mb-0 border md:border-none border-gray-200 rounded-lg md:rounded-none overflow-hidden ${className}`}>
      {children}
    </tr>
  )
}

interface ResponsiveTableCellProps {
  children: React.ReactNode
  className?: string
  isHeader?: boolean
}

/**
 * خلية جدول متجاوبة
 * تعرض التسمية على الموبايل قبل المحتوى
 */
export function ResponsiveTableCell({ 
  children, 
  className = '',
  isHeader = false 
}: ResponsiveTableCellProps) {
  const commonClasses = "md:px-4 md:py-3 px-4 py-2 text-sm"
  
  return isHeader ? (
    <th className={`hidden md:table-cell bg-gray-50 border-b border-gray-200 font-medium text-gray-700 uppercase text-xs text-right ${commonClasses} ${className}`}>
      {children}
    </th>
  ) : (
    <td className={`md:table-cell block md:py-3 py-2 before:font-bold before:block before:text-xs before:text-gray-600 before:mb-1 md:before:hidden md:px-4 px-4 text-gray-900 ${commonClasses} ${className}`}>
      {children}
    </td>
  )
}

export default ResponsiveTable
