// ============================================
// Main Entry Point - Where React starts
// ============================================
// This is the FIRST JavaScript file that runs.
// It takes our React app (App component) and puts it into the HTML page.
//
// Think of it like plugging a TV into a wall socket:
// - The wall socket = <div id="root"> in index.html
// - The TV = our App component
// - This file = the power cord connecting them

import React from 'react';
import ReactDOM from 'react-dom/client';
// ReactDOM = the library that connects React to the browser's DOM
// (DOM = Document Object Model = the HTML structure on the page)

import { BrowserRouter } from 'react-router-dom';
// BrowserRouter = enables page navigation in our app
// It watches the URL and renders the matching page component
// Wrapping our app in BrowserRouter means ANY component inside can use routing

import App from './App.jsx';
// Our main App component (we'll create this next)

import { AuthProvider } from './context/AuthContext.jsx';
// AuthProvider = wraps our app with authentication state
// Any component can then check: "Is the user logged in? What's their role?"

import './index.css';
// Import our global styles (Tailwind CSS directives)

// ---- Render the app ----
// createRoot() creates a "root" that React controls
// .render() puts our component tree into the DOM

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* 
      StrictMode = a development helper that:
      - Warns about potential problems
      - Runs certain checks twice to catch bugs
      - Has NO effect in production (it's stripped out)
    */}
    <BrowserRouter>
      {/* BrowserRouter must wrap everything that uses navigation */}
      <AuthProvider>
        {/* AuthProvider must wrap everything that needs auth info */}
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
