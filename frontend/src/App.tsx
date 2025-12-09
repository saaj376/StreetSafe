import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import { ThemeProvider } from './context/ThemeContext'
import Home from './pages/Home'
import Guardian from './pages/Guardian'
import Trips from './pages/Trips'
import Journal from './pages/Journal'
import Community from './pages/Community'
import Navbar from './components/Navbar'

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Navbar />
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/trips" element={<Trips />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/community" element={<Community />} />
            <Route path="/guardian/:token" element={<Guardian />} />
          </Routes>
        </Layout>
      </Router>
    </ThemeProvider>
  )
}

export default App

