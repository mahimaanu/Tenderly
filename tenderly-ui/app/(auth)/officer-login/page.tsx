"use client"
import { useState, useTransition } from "react"
import Link from "next/link"
import { loginAction } from "@/lib/auth/actions"

export default function OfficerLoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.set("role", "officer")
    startTransition(async () => {
      const result = await loginAction(fd)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">T</span>
            </div>
            <span className="text-xl font-semibold text-gray-900">Tenderly</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Officer Sign In</h1>
          <p className="text-sm text-gray-500 mt-1">CRPF Procurement Portal</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="officer@crpf.gov.in"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-blue-600 text-white py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Are you a vendor?{" "}
          <Link href="/bidder-login" className="text-blue-600 hover:underline font-medium">
            Bidder Portal
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-gray-500">
          <Link href="/" className="text-gray-400 hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  )
}
