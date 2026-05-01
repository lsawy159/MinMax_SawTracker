#!/usr/bin/env -S node --loader tsx/esm
/**
 * Seed Database — Populate dev/staging environment with sample data
 * Run: npm run seed
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Sample data
const sampleCompanies = [
  {
    name: 'منشرة القاهرة للأخشاب',
    location: 'القاهرة',
    phone: '+201001234567',
    email: 'info@cairosaws.com',
  },
  {
    name: 'شركة الإسكندرية للمنتجات الخشبية',
    location: 'الإسكندرية',
    phone: '+201101234567',
    email: 'info@alexandria-wood.com',
  },
  {
    name: 'مصنع الجيزة للأثاث',
    location: 'الجيزة',
    phone: '+201201234567',
    email: 'info@giza-furniture.com',
  },
]

const sampleEmployees = [
  {
    first_name: 'أحمد',
    last_name: 'السوي',
    email: 'ahmad.alsawy@sawtracker.com',
    phone: '+201001111111',
    role: 'admin',
    salary_base: 15000,
  },
  {
    first_name: 'فاطمة',
    last_name: 'محمد',
    email: 'fatima.mohammad@sawtracker.com',
    phone: '+201002222222',
    role: 'accountant',
    salary_base: 12000,
  },
  {
    first_name: 'محمود',
    last_name: 'علي',
    email: 'mahmoud.ali@sawtracker.com',
    phone: '+201003333333',
    role: 'data-entry',
    salary_base: 8000,
  },
  {
    first_name: 'سارة',
    last_name: 'حسن',
    email: 'sarah.hassan@sawtracker.com',
    phone: '+201004444444',
    role: 'user',
    salary_base: 8000,
  },
]

async function seedDatabase() {
  console.log('🌱 Seeding database...')

  try {
    // 1. Seed companies
    console.log('\n→ Adding companies...')
    for (const company of sampleCompanies) {
      const { data, error } = await supabase.from('companies').insert(company).select()

      if (error) {
        console.error(`  ✗ Error adding ${company.name}:`, error.message)
      } else {
        console.log(`  ✓ Added: ${company.name}`)
      }
    }

    // 2. Seed employees
    console.log('\n→ Adding employees...')
    for (const employee of sampleEmployees) {
      const { data, error } = await supabase.from('employees').insert(employee).select()

      if (error) {
        console.error(
          `  ✗ Error adding ${employee.first_name} ${employee.last_name}:`,
          error.message
        )
      } else {
        console.log(`  ✓ Added: ${employee.first_name} ${employee.last_name}`)
      }
    }

    // 3. Verify counts
    console.log('\n→ Verifying data...')
    const { count: companyCount } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })

    const { count: employeeCount } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })

    console.log(`  Companies: ${companyCount || 0}`)
    console.log(`  Employees: ${employeeCount || 0}`)

    console.log('\n✅ Seeding complete!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  }
}

seedDatabase()
