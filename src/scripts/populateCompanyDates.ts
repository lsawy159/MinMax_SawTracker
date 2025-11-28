// Script to populate company dates for demonstration
// This script adds sample commercial registration and insurance subscription dates

import { supabase } from '../lib/supabase'

export async function populateCompanyDates() {
  try {
    console.log('Starting to populate company dates...')
    
    // First, get all companies
    const { data: companies, error } = await supabase
      .from('companies')
      .select('id, name')
    
    if (error) throw error
    
    if (!companies || companies.length === 0) {
      console.log('No companies found to update')
      return
    }
    
    console.log(`Found ${companies.length} companies to update`)
    
    // Create different expiration dates for demonstration
    const today = new Date()
    const dates = [
      {
        commercial_registration_expiry: new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 90 days (Blue - >60 days)
        insurance_subscription_expiry: new Date(today.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]  // 45 days (Yellow - 30-60 days)
      },
      {
        commercial_registration_expiry: new Date(today.getTime() + 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 25 days (Red - <30 days)
        insurance_subscription_expiry: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]  // 10 days (Red - <30 days)
      },
      {
        commercial_registration_expiry: new Date(today.getTime() + 50 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 50 days (Yellow - 30-60 days)
        insurance_subscription_expiry: new Date(today.getTime() + 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 120 days (Green - >60 days)
      },
      {
        commercial_registration_expiry: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],  // 5 days ago (Expired)
        insurance_subscription_expiry: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]  // 30 days (Yellow - 30-60 days)
      },
      {
        commercial_registration_expiry: new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 15 days (Red - <30 days)
        insurance_subscription_expiry: new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]  // 15 days (Red - <30 days)
      }
    ]
    
    // Update each company with different date combinations
    for (let i = 0; i < companies.length; i++) {
      const company = companies[i]
      const dateIndex = i % dates.length // Cycle through the dates
      const datesToUpdate = dates[dateIndex]
      
      console.log(`Updating company ${i + 1}/${companies.length}: ${company.name}`)
      
      const { error: updateError } = await supabase
        .from('companies')
        .update(datesToUpdate)
        .eq('id', company.id)
      
      if (updateError) {
        console.error(`Error updating company ${company.name}:`, updateError)
      } else {
        console.log(`✅ Updated ${company.name} with dates:`, datesToUpdate)
      }
    }
    
    console.log('✅ Company dates population completed!')
    console.log('\nColor coding legend:')
    console.log('🔵 Blue: More than 60 days remaining (>60 days)')
    console.log('🟡 Yellow: 30-60 days remaining')
    console.log('🔴 Red: Less than 30 days remaining or expired')
    
  } catch (error) {
    console.error('Error populating company dates:', error)
    throw error
  }
}

// Auto-run the function
populateCompanyDates()
  .then(() => {
    console.log('Script completed successfully')
  })
  .catch((error) => {
    console.error('Script failed:', error)
  })