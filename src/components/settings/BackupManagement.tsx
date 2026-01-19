import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { CheckCircle, AlertTriangle, Download, Trash2, RefreshCw, Database } from 'lucide-react'
import { logger } from '@/utils/logger'
import { getErrorMessage, getErrorStatus } from '@/utils/errorHandling'
import { formatDateWithHijri } from '@/utils/dateFormatter'
import { HijriDateDisplay } from '@/components/ui/HijriDateDisplay'
import { maybeNotifyBackup } from '@/lib/backupService'

interface BackupRecord {
  id: string
  backup_type: string
  file_path: string
  file_size: number
  compression_ratio: number
  status: string
  started_at: string
  completed_at: string
  error_message?: string
  tables_included?: string[]
}

export default function BackupManagement() {
  const [backups, setBackups] = useState<BackupRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreatingBackup, setIsCreatingBackup] = useState(false)
  const [isPollingBackup, setIsPollingBackup] = useState(false)
  const [selectedBackups, setSelectedBackups] = useState<Set<string>>(new Set())
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [backupToDelete, setBackupToDelete] = useState<{ id: string; filePath: string; fileName: string } | null>(null)
  const [isDeletingBackups, setIsDeletingBackups] = useState(false)

  const loadBackups = useCallback(async () => {
    try {
      setIsLoading(true)
      logger.debug('[Backup] Loading backups...')
      const { data, error } = await supabase
        .from('backup_history')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('[Backup] Error loading backups:', error)
        toast.error('فشل في تحميل قائمة النسخ الاحتياطية')
        return
      }

      setBackups(data || [])
      logger.debug('[Backup] Backups loaded successfully, count:', data?.length || 0)
    } catch (error) {
      console.error('[Backup] Error in loadBackups:', error)
      toast.error('حدث خطأ أثناء تحميل النسخ الاحتياطية')
    } finally {
      setIsLoading(false)
    }
  }, [])


  const pollBackupStatus = useCallback(async (backupId: string, maxAttempts = 60): Promise<BackupRecord | null> => {
    let attempts = 0
    const pollInterval = 3000

    while (attempts < maxAttempts) {
      try {
        const { data: backup, error } = await supabase
          .from('backup_history')
          .select('*')
          .eq('id', backupId)
          .single()

        if (error) {
          console.error('[Backup] Error polling backup status:', error)
          attempts++
          await new Promise(resolve => setTimeout(resolve, pollInterval))
          continue
        }

        if (backup) {
          if (backup.status === 'completed') {
            logger.debug('[Backup] Backup completed successfully:', backup.id)
            return backup
          }
          if (backup.status === 'failed') {
            console.error('[Backup] Backup failed:', backup.error_message)
            throw new Error(backup.error_message || 'فشل في إنشاء النسخة الاحتياطية')
          }
        }

        attempts++
        await new Promise(resolve => setTimeout(resolve, pollInterval))
      } catch (error) {
        if (error instanceof Error && error.message.includes('فشل')) {
          throw error
        }
        console.error('[Backup] Error in polling:', error)
        attempts++
        await new Promise(resolve => setTimeout(resolve, pollInterval))
      }
    }

    console.warn('[Backup] Polling timeout after', maxAttempts, 'attempts')
    return null
  }, [])

  const createBackup = useCallback(async () => {
    setIsCreatingBackup(true)
    let timeoutOccurred = false

    try {
      logger.debug('[Backup] Starting backup creation...')

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          timeoutOccurred = true
          reject(new Error('TIMEOUT'))
        }, 120000)
      })

      const backupPromise = supabase.functions.invoke('automated-backup', {
        body: { backup_type: 'manual' }
      })

      let response: { data?: unknown; error?: unknown } | undefined

      try {
        response = await Promise.race([backupPromise, timeoutPromise]) as { data?: unknown; error?: unknown }
        logger.debug('[Backup] Response received:', { data: response?.data, error: response?.error, dataType: typeof response?.data })
      } catch (raceError) {
        const raceErrorMessage = getErrorMessage(raceError)
        if (raceErrorMessage === 'TIMEOUT' || timeoutOccurred) {
          console.warn('[Backup] Request timeout after 120 seconds, starting polling...')
          timeoutOccurred = true

          const { data: recentBackups, error: dbError } = await supabase
            .from('backup_history')
            .select('*')
            .eq('backup_type', 'manual')
            .order('started_at', { ascending: false })
            .limit(1)

          if (dbError) {
            console.error('[Backup] Error checking database:', dbError)
            toast.warning('استغرق إنشاء النسخة الاحتياطية وقتاً طويلاً. يرجى التحقق من قائمة النسخ الاحتياطية.')
            return
          }

          if (recentBackups && recentBackups.length > 0) {
            const latestBackup = recentBackups[0]
            const backupAge = Date.now() - new Date(latestBackup.started_at).getTime()

            if (backupAge < 180000) {
              logger.debug('[Backup] Found recent backup, starting polling:', latestBackup.id)

              setIsPollingBackup(true)
              toast.info('جاري التحقق من حالة النسخة الاحتياطية...', { duration: 5000 })

              try {
                const completedBackup = await pollBackupStatus(latestBackup.id, 60)

                if (completedBackup) {
                  toast.success('تم إنشاء النسخة الاحتياطية بنجاح')
                  await loadBackups()
                  try {
                    await maybeNotifyBackup(completedBackup)
                  } catch (notifyErr) {
                    console.warn('[Backup] Notification failed:', notifyErr)
                  }
                } else {
                  toast.warning('استغرق إنشاء النسخة الاحتياطية وقتاً طويلاً. يرجى التحقق من قائمة النسخ الاحتياطية.')
                  await loadBackups()
                }
              } catch (pollError) {
                const errorMessage = pollError instanceof Error ? pollError.message : 'حدث خطأ أثناء التحقق من حالة النسخة الاحتياطية'
                console.error('[Backup] Error during polling:', pollError)
                toast.error(errorMessage)
                await loadBackups()
              } finally {
                setIsPollingBackup(false)
              }
            }
          }

          return
        }

        throw raceError
      }

      const { data, error } = response

      if (error) {
        console.error('[Backup] Error from function:', error)
        throw error
      }

      let responseData = data
      if (typeof data === 'string') {
        try {
          responseData = JSON.parse(data)
          logger.debug('[Backup] Parsed string response:', responseData)
        } catch (parseError) {
          console.error('[Backup] Failed to parse response:', parseError)
          throw new Error('استجابة غير صحيحة من الخادم')
        }
      }

      if (responseData && typeof responseData === 'object' && 'success' in responseData && (responseData as { success: unknown }).success) {
        logger.debug('[Backup] Backup created successfully:', responseData)

        await new Promise(resolve => setTimeout(resolve, 100))
        toast.success('تم إنشاء النسخة الاحتياطية بنجاح')
        await new Promise(resolve => setTimeout(resolve, 400))

        let retries = 3
        let loaded = false

        while (retries > 0 && !loaded) {
          try {
            logger.debug(`[Backup] Loading backups (attempt ${4 - retries}/3)...`)
            await loadBackups()

            await new Promise(resolve => setTimeout(resolve, 300))
            const { data: latestBackups } = await supabase
              .from('backup_history')
              .select('*')
              .order('started_at', { ascending: false })
              .limit(1)

            if (latestBackups && latestBackups.length > 0) {
              logger.debug('[Backup] Latest backup found:', latestBackups[0].id)
              await loadBackups()
              try {
                await maybeNotifyBackup(latestBackups[0])
              } catch (notifyErr) {
                console.warn('[Backup] Notification failed:', notifyErr)
              }
              loaded = true
            } else {
              logger.debug('[Backup] Backup not found yet, retrying...')
              retries--
              if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000))
              }
            }
          } catch (loadError) {
            console.error('[Backup] Error loading backups:', loadError)
            retries--
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000))
            }
          }
        }

        if (!loaded) {
          console.warn('[Backup] Could not load backup list after retries, but backup was created successfully')
          try {
            await loadBackups()
            const { data: latest } = await supabase
              .from('backup_history')
              .select('*')
              .order('started_at', { ascending: false })
              .limit(1)
            if (latest && latest[0]) {
              try { await maybeNotifyBackup(latest[0]) } catch (e) { console.warn('[Backup] Notification failed:', e) }
            }
          } catch (finalError) {
            console.error('[Backup] Final load attempt failed:', finalError)
          }
        }
      } else {
        const firstErrorMessage = responseData && typeof responseData === 'object' && 'error' in responseData
          ? (responseData as { error?: string }).error || 'فشل في إنشاء النسخة الاحتياطية'
          : 'فشل في إنشاء النسخة الاحتياطية'
        console.error('[Backup] Backup creation failed:', firstErrorMessage)
        throw new Error(firstErrorMessage)
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      console.error('[Backup] Error creating backup:', error)

      const errorMessageForCheck = error instanceof Error ? error.message : String(error)
      if (errorMessageForCheck === 'TIMEOUT' || timeoutOccurred) {
        return
      }

      const errorStatus = getErrorStatus(error)
      if (errorStatus === 546 || errorMessageForCheck.includes('546')) {
        console.warn('[Backup] Edge Function returned 546, checking database for backup...')

        try {
          const { data: recentBackups } = await supabase
            .from('backup_history')
            .select('*')
            .eq('backup_type', 'manual')
            .order('started_at', { ascending: false })
            .limit(1)

          if (recentBackups && recentBackups.length > 0) {
            const latestBackup = recentBackups[0]
            const backupAge = Date.now() - new Date(latestBackup.started_at).getTime()

            if (backupAge < 180000) {
              logger.debug('[Backup] Found recent backup despite 546 error:', latestBackup.id)
              await new Promise(resolve => setTimeout(resolve, 100))
              toast.success('تم إنشاء النسخة الاحتياطية بنجاح (تم التحقق من قاعدة البيانات)')
              await new Promise(resolve => setTimeout(resolve, 300))

              try {
                await loadBackups()
              } catch (loadError) {
                console.error('[Backup] Error loading backups after 546 check:', loadError)
              }

              return
            }
          }
        } catch (dbCheckError) {
          console.error('[Backup] Error checking database after 546:', dbCheckError)
        }

        toast.error('حدث خطأ في إنشاء النسخة الاحتياطية. يرجى التحقق من قائمة النسخ الاحتياطية.')
        return
      }

      toast.error(errorMessage)
    } finally {
      logger.debug('[Backup] Setting isCreatingBackup to false')
      setIsCreatingBackup(false)
      if (isPollingBackup) {
        setIsPollingBackup(false)
      }
    }
  }, [loadBackups, pollBackupStatus, isPollingBackup])

  const openDeleteModal = (backupId: string, filePath: string, fileName: string) => {
    setBackupToDelete({ id: backupId, filePath, fileName })
    setShowDeleteModal(true)
  }

  const closeDeleteModal = () => {
    setShowDeleteModal(false)
    setBackupToDelete(null)
    setSelectedBackups(new Set())
  }

  const toggleBackupSelection = (backupId: string) => {
    setSelectedBackups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(backupId)) {
        newSet.delete(backupId)
      } else {
        newSet.add(backupId)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedBackups.size === backups.length) {
      setSelectedBackups(new Set())
    } else {
      setSelectedBackups(new Set(backups.map(b => b.id)))
    }
  }

  const openBulkDeleteModal = useCallback(() => {
    if (selectedBackups.size === 0) return
    setBackupToDelete({ id: Array.from(selectedBackups).join(','), filePath: '', fileName: `${selectedBackups.size} نسخة احتياطية` })
    setShowDeleteModal(true)
  }, [selectedBackups])

  const deleteBackup = async () => {
    if (!backupToDelete) return

    const { id: backupId, filePath } = backupToDelete
    const isBulkDelete = backupId.includes(',')

    try {
      setIsDeletingBackups(true)

      if (isBulkDelete) {
        const backupIds = backupId.split(',')
        logger.debug('[Backup] Starting bulk deletion:', { count: backupIds.length, backupIds })

        const backupsToDelete = backups.filter(b => backupIds.includes(b.id))

        for (const backup of backupsToDelete) {
          try {
            const { error: storageError } = await supabase.storage
              .from('backups')
              .remove([backup.file_path])

            if (storageError && !storageError.message?.includes('not found') && !storageError.message?.includes('Object not found')) {
              console.warn(`[Backup] Failed to delete file from storage: ${backup.file_path}`, storageError)
            }
          } catch (err) {
            console.warn(`[Backup] Error deleting file from storage: ${backup.file_path}`, err)
          }
        }

        const { error: dbError, count } = await supabase
          .from('backup_history')
          .delete({ count: 'exact' })
          .in('id', backupIds)

        if (dbError) {
          console.error('[Backup] Database bulk deletion error:', dbError)
          throw dbError
        }

        const successCount = count || 0
        const failCount = backupIds.length - successCount

        if (successCount > 0) {
          toast.success(`تم حذف ${successCount} نسخة احتياطية بنجاح`)
        }
        if (failCount > 0) {
          toast.warning(`فشل في حذف ${failCount} نسخة احتياطية`)
        }
      } else {
        logger.debug('[Backup] Starting deletion:', { backupId, filePath })

        try {
          const { error: storageError } = await supabase.storage
            .from('backups')
            .remove([filePath])

          if (storageError) {
            if (storageError.message?.includes('not found') || storageError.message?.includes('Object not found')) {
              console.warn('[Backup] File not found in storage (may have been deleted already):', storageError.message)
            } else {
              throw storageError
            }
          }
        } catch (storageErr) {
          const storageErrorMessage = storageErr instanceof Error ? storageErr.message : String(storageErr)
          if (!storageErrorMessage.includes('not found') && !storageErrorMessage.includes('Object not found')) {
            throw storageErr
          }
          console.warn('[Backup] File not found in storage, continuing with database deletion')
        }

        const { error: dbError, count } = await supabase
          .from('backup_history')
          .delete({ count: 'exact' })
          .eq('id', backupId)

        if (dbError) {
          console.error('[Backup] Database deletion error:', dbError)
          throw dbError
        }

        if (count === 0) {
          console.warn('[Backup] No record found to delete (may have been deleted already)')
          toast.warning('النسخة الاحتياطية غير موجودة أو تم حذفها مسبقاً')
        } else {
          logger.debug('[Backup] Backup deleted successfully from database, count:', count)
          toast.success('تم حذف النسخة الاحتياطية بنجاح')
        }
      }

      closeDeleteModal()
      await loadBackups()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'حدث خطأ غير معروف'
      console.error('[Backup] Error deleting backup:', error)
      toast.error(`فشل في حذف النسخة الاحتياطية: ${errorMessage}`)
    } finally {
      setIsDeletingBackups(false)
    }
  }

  const downloadBackup = async (filePath: string) => {
    try {
      logger.debug('[Backup] Starting download:', filePath)
      const { data, error } = await supabase.storage
        .from('backups')
        .download(filePath)

      if (error) {
        console.error('[Backup] Download error:', error)
        throw error
      }

      if (!data) {
        throw new Error('الملف غير موجود')
      }

      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = filePath
      link.click()
      URL.revokeObjectURL(url)

      logger.debug('[Backup] Download completed successfully')
      toast.success('تم تحميل النسخة الاحتياطية')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'حدث خطأ غير معروف'
      console.error('[Backup] Error downloading backup:', error)
      toast.error(errorMessage)
    }
  }

  useEffect(() => {
    loadBackups()
  }, [loadBackups])

  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }, [])

  const formatDate = (dateString: string) => formatDateWithHijri(dateString, true)

  const backupsHeaderActions = useMemo(() => (
    <div className="flex gap-2">
      {selectedBackups.size > 0 && (
        <button
          onClick={openBulkDeleteModal}
          disabled={isDeletingBackups}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2 text-sm"
        >
          <Trash2 className={`w-4 h-4 ${isDeletingBackups ? 'animate-spin' : ''}`} />
          حذف المحددة ({selectedBackups.size})
        </button>
      )}
      <button
        onClick={loadBackups}
        disabled={isLoading}
        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition disabled:opacity-50 flex items-center gap-2 text-sm"
      >
        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        تحديث
      </button>
      <button
        onClick={createBackup}
        disabled={isCreatingBackup || isPollingBackup}
        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-2 text-sm"
      >
        <Database className={`w-4 h-4 ${(isCreatingBackup || isPollingBackup) ? 'animate-spin' : ''}`} />
        {isPollingBackup ? 'جاري التحقق...' : isCreatingBackup ? 'جاري الإنشاء...' : 'إنشاء نسخة احتياطية'}
      </button>
    </div>
  ), [createBackup, isCreatingBackup, isPollingBackup, isDeletingBackups, isLoading, loadBackups, openBulkDeleteModal, selectedBackups.size])

  if (isLoading && backups.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold">النسخ الاحتياطية</h2>
          {selectedBackups.size > 0 && (
            <span className="text-sm text-gray-600">({selectedBackups.size} محددة)</span>
          )}
        </div>
        {backupsHeaderActions}
      </div>

      <div className="overflow-x-auto hidden md:block">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-right w-12">
                <input
                  type="checkbox"
                  checked={backups.length > 0 && selectedBackups.size === backups.length}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  title="تحديد الكل"
                />
              </th>
              <th className="px-4 py-2 text-right">النوع</th>
              <th className="px-4 py-2 text-right">اسم الملف</th>
              <th className="px-4 py-2 text-right">الحجم</th>
              <th className="px-4 py-2 text-right">نسبة الضغط</th>
              <th className="px-4 py-2 text-right">الحالة</th>
              <th className="px-4 py-2 text-right">تاريخ الإنشاء</th>
              <th className="px-4 py-2 text-right">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {backups.map((backup) => (
              <tr key={backup.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={selectedBackups.has(backup.id)}
                    onChange={() => toggleBackupSelection(backup.id)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-1 rounded text-xs ${
                    backup.backup_type === 'manual' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {backup.backup_type === 'manual' ? 'يدوي' : 'تلقائي'}
                  </span>
                </td>
                <td className="px-4 py-2 font-mono text-xs">{backup.file_path}</td>
                <td className="px-4 py-2">{formatFileSize(backup.file_size)}</td>
                <td className="px-4 py-2">{backup.compression_ratio?.toFixed(1)}%</td>
                <td className="px-4 py-2">
                  <span className={`flex items-center gap-1 ${
                    backup.status === 'completed' ? 'text-green-600' : 
                    backup.status === 'failed' ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    {backup.status === 'completed' && <CheckCircle className="w-4 h-4" />}
                    {backup.status === 'failed' && <AlertTriangle className="w-4 h-4" />}
                    {backup.status === 'completed' ? 'مكتمل' : 
                     backup.status === 'failed' ? 'فشل' : 'قيد التنفيذ'}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <HijriDateDisplay date={backup.started_at}>
                    {formatDate(backup.started_at)}
                  </HijriDateDisplay>
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    {backup.status === 'completed' && (
                      <button
                        onClick={() => downloadBackup(backup.file_path)}
                        className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                        title="تحميل"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => openDeleteModal(backup.id, backup.file_path, backup.file_path)}
                      className="p-1 text-red-600 hover:bg-red-100 rounded"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {backups.map((backup) => (
          <div key={backup.id} className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                backup.backup_type === 'manual' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
              }`}>
                {backup.backup_type === 'manual' ? 'يدوي' : 'تلقائي'}
              </span>
              <input
                type="checkbox"
                checked={selectedBackups.has(backup.id)}
                onChange={() => toggleBackupSelection(backup.id)}
                className="w-4 h-4 text-blue-600 rounded"
              />
            </div>

            <div className="py-2 px-2 bg-gray-50 rounded text-xs">
              <div className="font-medium text-gray-600 mb-0.5">اسم الملف</div>
              <div className="font-mono text-gray-900 break-all">{backup.file_path}</div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="py-2 px-2 bg-gray-50 rounded text-xs">
                <div className="font-medium text-gray-600">الحجم</div>
                <div className="text-gray-900">{formatFileSize(backup.file_size)}</div>
              </div>
              <div className="py-2 px-2 bg-gray-50 rounded text-xs">
                <div className="font-medium text-gray-600">الضغط</div>
                <div className="text-gray-900">{backup.compression_ratio?.toFixed(1)}%</div>
              </div>
            </div>

            <div className="py-2 px-2 bg-blue-50 rounded text-xs">
              <div className="font-medium text-gray-600 mb-1">الحالة</div>
              <div className={`flex items-center gap-1 font-medium ${
                backup.status === 'completed' ? 'text-green-600' : 
                backup.status === 'failed' ? 'text-red-600' : 'text-yellow-600'
              }`}>
                {backup.status === 'completed' && <CheckCircle className="w-4 h-4" />}
                {backup.status === 'failed' && <AlertTriangle className="w-4 h-4" />}
                {backup.status === 'completed' ? 'مكتمل' : 
                 backup.status === 'failed' ? 'فشل' : 'قيد التنفيذ'}
              </div>
            </div>

            <div className="py-2 px-2 bg-gray-50 rounded text-xs">
              <div className="font-medium text-gray-600 mb-0.5">تاريخ الإنشاء</div>
              <HijriDateDisplay date={backup.started_at}>
                {formatDate(backup.started_at)}
              </HijriDateDisplay>
            </div>

            <div className="flex gap-2 pt-1 border-t border-gray-100">
              {backup.status === 'completed' && (
                <button
                  onClick={() => downloadBackup(backup.file_path)}
                  className="flex-1 px-2 py-2 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition font-medium"
                >
                  <Download className="w-3 h-3 inline mr-1" />
                  تحميل
                </button>
              )}
              <button
                onClick={() => openDeleteModal(backup.id, backup.file_path, backup.file_path)}
                className="flex-1 px-2 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg transition font-medium"
              >
                <Trash2 className="w-3 h-3 inline mr-1" />
                حذف
              </button>
            </div>
          </div>
        ))}
      </div>

      {showDeleteModal && backupToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-red-100 p-3 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">تأكيد الحذف</h3>
                  <p className="text-sm text-gray-600">هذا الإجراء لا يمكن التراجع عنه</p>
                </div>
              </div>
              {backupToDelete.id.includes(',') ? (
                <div className="text-gray-700 mb-6">
                  <p className="mb-2">
                    هل أنت متأكد من حذف <strong className="text-red-600">{backupToDelete.id.split(',').length}</strong> نسخة احتياطية؟
                  </p>
                  <span className="text-sm text-red-600 block mt-2">
                    سيتم حذف جميع الملفات والسجلات نهائياً
                  </span>
                </div>
              ) : (
                <p className="text-gray-700 mb-6">
                  هل أنت متأكد من حذف النسخة الاحتياطية:
                  <br />
                  <strong className="text-gray-900 font-mono text-sm mt-2 block">{backupToDelete.fileName}</strong>
                  <span className="text-sm text-red-600 mt-2 block">
                    سيتم حذف الملف والسجل نهائياً
                  </span>
                </p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={deleteBackup}
                  disabled={isDeletingBackups}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeletingBackups ? 'جاري الحذف...' : 'نعم، احذف'}
                </button>
                <button
                  onClick={closeDeleteModal}
                  disabled={isDeletingBackups}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition font-medium disabled:opacity-50"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
