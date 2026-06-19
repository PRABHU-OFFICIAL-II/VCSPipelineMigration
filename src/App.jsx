import './App.css'
import LoginDev from './pages/login/LoginDev'
import ErrorBoundary from './components/ErrorBoundary'

function App() {
  return (
    <ErrorBoundary>
      <LoginDev />
    </ErrorBoundary>
  )
}

export default App
