import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Admin from './Admin';
import Overlay from './Overlay';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/admin" element={<Admin />} />
        <Route path="/overlay" element={<Overlay />} />
        <Route path="/" element={
          <div style={{ textAlign: 'center', marginTop: '50px' }}>
            <h1>MyTonation Local Server</h1>
            <p><Link to="/admin">Go to Admin Panel</Link></p>
            <p><Link to="/overlay">Go to Overlay (OBS Source)</Link></p>
          </div>
        } />
      </Routes>
    </Router>
  );
}

export default App;