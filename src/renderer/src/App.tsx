import { MemoryRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import Dashboard from './pages/Dashboard'
import Workshop from './pages/Workshop'
import Journal from './pages/Journal'
import Documents from './pages/Documents'
import Agents from './pages/Agents'
import Intelligence from './pages/Intelligence'
import WeeklyRecaps from './pages/WeeklyRecaps'
import Clients from './pages/Clients'
import CronJobs from './pages/CronJobs'
import ApiUsage from './pages/ApiUsage'
import TheHub from './pages/TheHub'
import './assets/main.css'

const SEARCH_LABELS: Record<string, string> = {
  '/dashboard':     'Search dashboard...',
  '/workshop':      'Search tasks...',
  '/hub':           'Search messages...',
  '/agents':        'Search agents...',
  '/clients':       'Search clients...',
  '/journal':       'Search journal...',
  '/cron-jobs':     'Search cron jobs...'
}

function AppShell(): React.JSX.Element {
  const location = useLocation()
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-wrapper">
        <TopBar searchPlaceholder={SEARCH_LABELS[location.pathname] ?? 'Search...'} />
        <main className="main-content">
          <Routes>
            <Route path="/"               element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"      element={<Dashboard />} />
            <Route path="/journal"        element={<Journal />} />
            <Route path="/documents"      element={<Documents />} />
            <Route path="/agents"         element={<Agents />} />
            <Route path="/intelligence"   element={<Intelligence />} />
            <Route path="/weekly-recaps"  element={<WeeklyRecaps />} />
            <Route path="/clients"        element={<Clients />} />
            <Route path="/cron-jobs"      element={<CronJobs />} />
            <Route path="/api-usage"      element={<ApiUsage />} />
            <Route path="/workshop"       element={<Workshop />} />
            <Route path="/hub"            element={<TheHub />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App(): React.JSX.Element {
  return (
    <Router>
      <AppShell />
    </Router>
  )
}
