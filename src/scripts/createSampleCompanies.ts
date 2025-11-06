// Script to create sample companies for demonstration
import { supabase } from '../lib/supabase'

export async function createSampleCompanies() {
  try {
    console.log('Creating sample companies...')
    
    const sampleCompanies = [
      {
        name: 'شركة التقنية المتقدمة',
        unified_number: 1234567890,
        tax_number: 3001234567,
        labor_subscription_number: '4012345678'
      },
      {
        name: 'مؤسسة البناء الحديث',
        unified_number: 2345678901,
        tax_number: 3002345678,
        labor_subscription_number: '4023456789'
      },
      {
        name: 'شركة التجارة العالمية',
        unified_number: 3456789012,
        tax_number: 3003456789,
        labor_subscription_number: '4034567890'
      },
      {
        name: 'مؤسسة الخدمات الطبية',
        unified_number: 4567890123,
        tax_number: 3004567890,
        labor_subscription_number: '4045678901'
      },
      {
        name: 'شركة النقل السريع',
        unified_number: 5678901234,
        tax_number: 3005678901,
        labor_subscription_number: '4056789012'
      }
    ]
    
    for (const companyData of sampleCompanies) {
      const { data, error } = await supabase
        .from('companies')
        .insert(companyData)
        .select()
        .single()
      
      if (error) {
        console.error(`Error creating company ${companyData.name}:`, error)
      } else {
        console.log(`✅ Created company: ${companyData.name}`)
      }
    }
    
    console.log('✅ Sample companies creation completed!')
    
  } catch (error) {
    console.error('Error creating sample companies:', error)
    throw error
  }
}

// Auto-run the function
createSampleCompanies()
  .then(() => {
    console.log('Script completed successfully')
  })
  .catch((error) => {
    console.error('Script failed:', error)
  })