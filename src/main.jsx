// Global defensive guard against circular JSON serialization errors
// Prevents unhandled crashes if internal runtime or third-party libraries attempt to serialize circular objects
if (typeof window !== 'undefined' && window.JSON && typeof window.JSON.stringify === 'function') {
  const _origStringify = window.JSON.stringify;
  window.JSON.stringify = function (value, replacer, space) {
    try {
      return _origStringify.call(this, value, replacer, space);
    } catch (err) {
      if (err instanceof TypeError && err.message && err.message.toLowerCase().includes('circular')) {
        const seen = new WeakSet();
        return _origStringify.call(
          this,
          value,
          (k, v) => {
            if (typeof replacer === 'function') {
              v = replacer(k, v);
            }
            if (typeof v === 'object' && v !== null) {
              if (seen.has(v)) return undefined;
              seen.add(v);
            }
            return v;
          },
          space
        );
      }
      throw err;
    }
  };
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { ThemeProvider } from './contexts/ThemeContext.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#1e293b',
                color: '#e2e8f0',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontSize: '14px',
              },
              success: { iconTheme: { primary: '#22c55e', secondary: '#1e293b' } },
              error:   { iconTheme: { primary: '#ef4444', secondary: '#1e293b' } },
            }}
          />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>,
)
