import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import Admin from './Admin.jsx'
import Register from './Register.jsx'
import Download from './Download.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/register" element={<Register />} />
      <Route path="/download" element={<Download />} />
    </Routes>
  </BrowserRouter>
)