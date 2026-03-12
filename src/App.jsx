import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Home from './pages/Home'
import Add from './pages/Add'
import Entry from './pages/Entry'
import Edit from './pages/Edit'
import Saved from './pages/Saved'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <ProtectedRoute><Home /></ProtectedRoute>
          } />
          <Route path="/add" element={
            <ProtectedRoute><Add /></ProtectedRoute>
          } />
          <Route path="/entry/:id" element={
            <ProtectedRoute><Entry /></ProtectedRoute>
          } />
          <Route path="/edit/:id" element={
            <ProtectedRoute><Edit /></ProtectedRoute>
          } />
          <Route path="/saved" element={<ProtectedRoute><Saved /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
