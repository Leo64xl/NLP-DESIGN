import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './components/context/global/context-auth/login/Login'
import Register from './components/context/global/context-auth/register/Register'
import EmailVerified from './components/context/global/context-verified-user/verified-success/EmailVerified'
import EmailVerifiedError from './components/context/global/context-verified-user/verified-error/EmailVerifiedError'
import ResendVerified from './components/context/global/context-verified-user/verified-resend/ResendVerified'
import ForgotPassword from './components/context/global/context-reset-password/password-request/ForgotPassword'
import ResetPasswordForm from './components/context/global/context-reset-password/password-form/ResetPasswordForm'
import ResetPasswordError from './components/context/global/context-reset-password/password-error/ResetPasswordError'
import ChatPage from './pages/ChatPage'
import Layout from './components/layouts/Layout'
import { AppProvider } from './contexts/AppContext'
import { LanguageProvider } from './contexts/LanguageContext'

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} /> 
            <Route path="/register" element={<Register />} />
            <Route path="/email-verified-success" element={<EmailVerified />} />
            <Route path="/email-verification-error" element={<EmailVerifiedError />} />
            <Route path="/resend-verification" element={<ResendVerified />} />
            <Route path="/forgot-password" element={<ForgotPassword />} /> 
            <Route path="/reset-password-form" element={<ResetPasswordForm />} />
            <Route path="/reset-password-error" element={<ResetPasswordError />} /> 
            <Route path="/dashboard" element={<ChatPage />} />

            <Route path="/design/:designId" element={<ChatPage />} />

          {/*Future implementations:*/}
          {/*<Route path="/design/:designId/result" element={<Layout>< /></Layout>} />*/}
          {/*<Route path="/designs/history" element={<Layout>< /></Layout>} />*/}
          {/*<Route path="/notify" element={<Layout>< /></Layout>} />*/}
          {/*<Route path="/about" element={<Layout>< /></Layout>} />*/}          
          {/*<Route path="/profile" element={<Layout>< /></Layout>} />*/}
          {/*<Route path="/settings" element={<Layout>< /></Layout>} />*/}
          {/*<Route path="*" element={<NotFound />} />*/} 
          
        </Routes>
      </BrowserRouter>
    </AppProvider>
  </LanguageProvider>
  )
}

export default App