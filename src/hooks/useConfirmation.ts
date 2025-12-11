import { useState, useCallback } from 'react'

type IconType = 'alert' | 'question' | 'success' | 'info'

interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  isDangerous?: boolean
  icon?: IconType
}

interface DialogState {
  isOpen: boolean
  title: string
  message: string
  confirmText: string
  cancelText: string
  isDangerous: boolean
  icon: IconType
  onConfirm: () => void
}

export function useConfirmation() {
  const [dialogState, setDialogState] = useState<DialogState>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'تأكيد',
    cancelText: 'إلغاء',
    isDangerous: false,
    icon: 'question',
    onConfirm: () => {}
  })

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      const newState: DialogState = {
        isOpen: true,
        title: options.title,
        message: options.message,
        confirmText: options.confirmText || 'تأكيد',
        cancelText: options.cancelText || 'إلغاء',
        isDangerous: options.isDangerous || false,
        icon: options.icon || 'question',
        onConfirm: () => {
          resolve(true)
          setDialogState(prev => ({ ...prev, isOpen: false }))
        }
      }
      setDialogState(newState)
    })
  }, [])

  const close = useCallback(() => {
    setDialogState(prev => ({ ...prev, isOpen: false }))
  }, [])

  return {
    ...dialogState,
    confirm,
    close
  }
}
