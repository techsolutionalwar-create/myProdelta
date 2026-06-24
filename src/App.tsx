import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import DashboardPage from '@/pages/DashboardPage'
import IndicatorEditorPage from '@/pages/IndicatorEditorPage'
import PositionsPage from '@/pages/PositionsPage'
import TradeLogPage from '@/pages/TradeLogPage'
import SettingsPage from '@/pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/editor" element={<IndicatorEditorPage />} />
          <Route path="/positions" element={<PositionsPage />} />
          <Route path="/trade-log" element={<TradeLogPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
