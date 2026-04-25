import { useState, useEffect } from 'react'

/**
 * Hook للكشف عما إذا كنت تشاهد الموقع على جهاز محمول
 * يعتبر < 768px = mobile
 * يستمع لتغييرات حجم الشاشة
 */
export function useIsMobileView() {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    // التحقق من الحجم الأولي
    setIsMobile(window.innerWidth < 768)

    // الاستماع لتغييرات الحجم
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return isMobile ?? false
}
