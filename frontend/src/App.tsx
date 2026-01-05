import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import PrivateRoute from './components/PrivateRoute'
import Home from './pages/Home'
import Guardian from './pages/Guardian'
import Trips from './pages/Trips'
import Journal from './pages/Journal'
import Community from './pages/Community'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Navbar from './components/Navbar'

function App() {
  return (
    <Router>
      <AuthProvider>
        <Navbar />
        <Layout>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
            <Route path="/trips" element={<PrivateRoute><Trips /></PrivateRoute>} />
            <Route path="/journal" element={<PrivateRoute><Journal /></PrivateRoute>} />
            <Route path="/community" element={<PrivateRoute><Community /></PrivateRoute>} />
            <Route path="/guardian/:token" element={<Guardian />} />
          </Routes>
        </Layout>
      </AuthProvider>
    </Router>
  )
}

export default App

