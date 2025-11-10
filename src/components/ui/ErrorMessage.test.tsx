// 1. استيراد الأدوات
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

// 2. استيراد المكون (بالطريقة الصحيحة التي اكتشفناها)
import { ErrorMessage } from './ErrorMessage';

// 3. وصف مجموعة الاختبارات
describe('ErrorMessage Component', () => {

  // 4. الاختبار الأول (الناجح - سيبقى كما هو)
  it('should render the error message passed to it', () => {
    
    // "المهمة": ارسم المكون مع رسالة
    render(<ErrorMessage message="حدث خطأ تجريبي" />);
    
    // "الفحص": ابحث عن الرسالة
    const errorMessageElement = screen.getByText('حدث خطأ تجريبي');
    
    // "النتيجة": نتوقع وجودها
    expect(errorMessageElement).toBeInTheDocument();
  });

  // 5. الاختبار الثاني (النسخة المُصلحة)
  it('should render an empty message if no message is provided', () => {
    
    // "المهمة": ارسم المكون بدون رسالة (نحتاج "container" للبحث)
    const { container } = render(<ErrorMessage />);
    
    // "الفحص": ابحث عن عنصر الـ <p> الذي يحمل الكلاس "text-red-700"
    // (نحن نعرف هذا الكلاس من مخرجات الخطأ السابقة)
    const messageElement = container.querySelector('p.text-red-700');
    
    // "النتيجة": 
    // 1. نتوقع أن عنصر <p> موجود في الصفحة
    expect(messageElement).toBeInTheDocument();
    
    // 2. الأهم: نتوقع أن يكون محتواه النصي "فارغاً"
    expect(messageElement).toHaveTextContent('');
  });

});