import Layout from '@/components/layout/Layout'
import { Navigate } from 'react-router-dom'

export default function SecurityManagement() {
  return (
    <Layout>
      <Navigate to="/admin-settings" replace />
    </Layout>
  )
}
