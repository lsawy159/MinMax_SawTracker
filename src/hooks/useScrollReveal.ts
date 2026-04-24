import { useEffect, useRef } from 'react'

/**
 * §10.1 DESIGN_POLISH_PROMPT — Scroll Reveal
 * يُضيف class "revealed" على العنصر عند ظهوره في الـ viewport.
 * يُعطّل على الموبايل وعند تفعيل prefers-reduced-motion.
 *
 * الاستخدام:
 *   const ref = useScrollReveal<HTMLDivElement>()
 *   <div ref={ref} className="scroll-reveal">...</div>
 *
 * CSS المطلوب موجود في index.css (.scroll-reveal + .scroll-reveal.revealed)
 */
export function useScrollReveal<T extends HTMLElement = HTMLElement>(
  threshold = 0.12
) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // تعطيل على الموبايل وعند prefers-reduced-motion
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isMobile = window.matchMedia('(max-width: 767px)').matches
    if (reducedMotion || isMobile) {
      el.classList.add('revealed')
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('revealed')
          observer.disconnect()
        }
      },
      { threshold }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  return ref
}
