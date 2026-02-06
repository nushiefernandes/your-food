import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Add from './pages/Add'
import Entry from './pages/Entry'
import Edit from './pages/Edit'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/add" element={<Add />} />
        <Route path="/entry/:id" element={<Entry />} />
        <Route path="/edit/:id" element={<Edit />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
