import React, { useState, useEffect } from 'react';
import Editor from './components/Editor.jsx';
import PhoneAR from './components/PhoneAR.jsx';

function App() {
  const [route, setRoute] = useState(() => {
    const hash = window.location.hash;
    return hash === '#phone' ? 'phone' : 'editor';
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      setRoute(hash === '#phone' ? 'phone' : 'editor');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <div className="app-container">
      {route === 'phone' ? (
        <PhoneAR />
      ) : (
        <Editor />
      )}
    </div>
  );
}

export default App;
