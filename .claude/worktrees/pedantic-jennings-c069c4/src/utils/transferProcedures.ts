export const TRANSFER_PROCEDURE_STATUS_OPTIONS = [
  'منقول',
  'تحت إجراء النقل',
  'بانتظار موافقة الكفيل',
  'بانتظار موافقة العامل',
  'بانتظار فترة الإشعار',
  'بإنتظار الجوازات',
  'ليس على الكفالة',
  'بإنتظار رخصة العمل',
] as const

export const NEW_TRANSFER_PROCEDURE_STATUS_OPTIONS = TRANSFER_PROCEDURE_STATUS_OPTIONS.filter(
  (status) => status !== 'منقول'
) as Exclude<(typeof TRANSFER_PROCEDURE_STATUS_OPTIONS)[number], 'منقول'>[]

export const TRANSFER_PROCEDURE_TEMPLATE_COLUMNS = [
  'تاريخ الطلب',
  'الاسم',
  'رقم الإقامة',
  'الحالة',
  'الرقم الموحد الحالي',
  'المشروع',
  'ملاحظات',
] as const

export type TransferProcedureStatus = (typeof TRANSFER_PROCEDURE_STATUS_OPTIONS)[number]

export const isTransferProcedureStatus = (status: string): status is TransferProcedureStatus => {
  return TRANSFER_PROCEDURE_STATUS_OPTIONS.includes(status as TransferProcedureStatus)
}

export const isNewTransferProcedureStatus = (status: string): status is Exclude<TransferProcedureStatus, 'منقول'> => {
  return NEW_TRANSFER_PROCEDURE_STATUS_OPTIONS.includes(status as Exclude<TransferProcedureStatus, 'منقول'>)
}
