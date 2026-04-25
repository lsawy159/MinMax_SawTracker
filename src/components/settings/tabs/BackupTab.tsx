import React, { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDateWithHijri } from '@/utils/dateFormatter';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { triggerManualBackupAndNotify } from '@/lib/backupService';
import { Database, Download, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

interface BackupRecord {
  id: string;
  backup_type: string;
  file_path: string;
  file_size: number;
  compression_ratio: number;
  status: string;
  started_at: string;
  completed_at: string;
  error_message?: string;
  tables_included?: string[];
}

export function BackupTab(): JSX.Element {
  const [isRunningBackup, setIsRunningBackup] = useState(false);

  const { data: backups = [], isLoading, refetch } = useQuery({
    queryKey: ['backups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('backup_history')
        .select('id, backup_type, file_path, file_size, compression_ratio, status, started_at, completed_at, error_message, tables_included')
        .order('started_at', { ascending: false })
        .limit(10);

      if (error) {
        logger.error('Error fetching backup history:', error);
        throw error;
      }
      return (data as BackupRecord[]) || [];
    },
  });

  const handleRunBackup = async () => {
    setIsRunningBackup(true);
    try {
      await triggerManualBackupAndNotify();
      toast.success('تم بدء النسخة الاحتياطية');
      refetch();
    } catch (error) {
      logger.error('Error running backup:', error);
      const errorMessage = error instanceof Error ? error.message : 'فشل إنشاء النسخة الاحتياطية';
      toast.error(errorMessage);
    } finally {
      setIsRunningBackup(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            النسخ الاحتياطية
          </h3>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            إدارة نسخ قاعدة البيانات الاحتياطية
          </p>
        </div>
        <Button
          onClick={handleRunBackup}
          disabled={isRunningBackup}
          className="flex items-center gap-2"
        >
          {isRunningBackup ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              جاري...
            </>
          ) : (
            <>
              <Database className="h-4 w-4" />
              إنشاء نسخة احتياطية الآن
            </>
          )}
        </Button>
      </div>

      {/* Info Alert */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-700/50 dark:bg-blue-900/20">
        <div className="flex gap-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            يتم إنشاء نسخ احتياطية تلقائية يومياً. يمكنك إنشاء نسخة احتياطية يدويّة في أي وقت.
          </div>
        </div>
      </div>

      {/* Backup History */}
      <div>
        <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
          سجل النسخ الاحتياطية
        </h4>

        {backups.length === 0 ? (
          <EmptyState
            icon={<Database className="h-12 w-12 text-neutral-400" />}
            title="لا توجد نسخ احتياطية"
            description="لم يتم إنشاء أي نسخ احتياطية بعد"
          />
        ) : (
          <div className="space-y-2">
            {backups.map((backup) => (
              <div
                key={backup.id}
                className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
                        {backup.backup_type === 'full' ? 'نسخة احتياطية كاملة' : 'نسخة احتياطية إضافية'}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          backup.status === 'completed'
                            ? 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300'
                            : backup.status === 'failed'
                              ? 'bg-danger-50 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300'
                              : 'bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300'
                        }`}
                      >
                        {backup.status === 'completed' ? (
                          <CheckCircle className="h-3 w-3" />
                        ) : backup.status === 'failed' ? (
                          <AlertTriangle className="h-3 w-3" />
                        ) : (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        {backup.status === 'completed'
                          ? 'نجح'
                          : backup.status === 'failed'
                            ? 'فشل'
                            : 'قيد الإنجاز'}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      {backup.completed_at ? (
                        <span>
                          انتهت في: {formatDateWithHijri(backup.completed_at)}
                        </span>
                      ) : (
                        <span>
                          بدأت في: {formatDateWithHijri(backup.started_at)}
                        </span>
                      )}
                    </div>
                    {backup.error_message && (
                      <div className="text-xs text-danger-600 dark:text-danger-400 mt-1">
                        {backup.error_message}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-right">
                      <div className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
                        {formatBytes(backup.file_size)}
                      </div>
                      {backup.compression_ratio > 0 && (
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">
                          نسبة الضغط: {(backup.compression_ratio * 100).toFixed(1)}%
                        </div>
                      )}
                    </div>
                    {backup.file_path && backup.status === 'completed' && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="flex items-center gap-1"
                      >
                        <Download className="h-3 w-3" />
                        تحميل
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
