import type { Metadata } from 'next'
import LoginForm from './LoginForm'

export const metadata: Metadata = {
  title: 'Sign In — Payana Mitra',
  description: 'Sign in to your Payana Mitra travel companion with your phone number and PIN.',
}

/**
 * /login — Server Component page.
 * Delegates all interactivity to the LoginForm client component.
 */
export default function LoginPage() {
  return <LoginForm />
}
