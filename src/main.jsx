import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import WhatsAppInbox from './WhatsAppInbox.jsx';
import './styles.css';

const isAdminWhatsappRoute = window.location.pathname.replace(/\/+$/, '') === '/admin/whatsapp';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isAdminWhatsappRoute ? <WhatsAppInbox /> : <App />}
  </React.StrictMode>,
);
