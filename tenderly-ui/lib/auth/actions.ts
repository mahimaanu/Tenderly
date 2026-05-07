"use server"
import { redirect } from "next/navigation"
import { login, logout, registerBidder } from "../api/auth"
import { setSessionCookie, clearSessionCookie, getServerToken } from "./session"

export async function loginAction(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const role = formData.get("role") as string

  try {
    const res = await login(email, password)
    if (role && res.user.role !== role) {
      return { error: "Wrong portal for your account type." }
    }
    await setSessionCookie(res.access_token)
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string }
    if (err?.code === "AUTH_INVALID") return { error: "Invalid email or password." }
    return { error: err?.message ?? "Login failed." }
  }

  redirect(role === "officer" ? "/officer" : "/bidder")
}

export async function registerBidderAction(formData: FormData) {
  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    company_name: formData.get("company_name") as string,
    contact_person: (formData.get("contact_person") as string) || undefined,
    registration_number: (formData.get("registration_number") as string) || undefined,
    gstin: (formData.get("gstin") as string) || undefined,
    phone: (formData.get("phone") as string) || undefined,
    city: (formData.get("city") as string) || undefined,
  }

  try {
    const res = await registerBidder(data)
    await setSessionCookie(res.access_token)
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string }
    if (err?.code === "EMAIL_TAKEN") return { error: "An account with this email already exists." }
    return { error: err?.message ?? "Registration failed." }
  }

  redirect("/bidder")
}

export async function logoutAction() {
  const token = await getServerToken()
  if (token) {
    try {
      await logout(token)
    } catch {}
  }
  await clearSessionCookie()
  redirect("/")
}
