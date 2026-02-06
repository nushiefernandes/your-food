import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Add from './pages/Add'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/add" element={<Add />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
