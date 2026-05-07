import { apiFetch } from "./client"

export type UserRole = "officer" | "bidder"

export type UserOut = {
  id: string
  role: UserRole
  email: string
  name: string
  designation?: string
  unit?: string
  company_name?: string
  gstin?: string
  registration_number?: string
}

export type TokenResponse = {
  access_token: string
  token_type: string
  user: UserOut
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })
}

export async function logout(token: string): Promise<void> {
  return apiFetch("/auth/logout", { method: "POST", serverToken: token })
}

export async function getMe(token: string): Promise<UserOut> {
  return apiFetch("/auth/me", { serverToken: token })
}

export async function registerBidder(data: {
  email: string
  password: string
  company_name: string
  contact_person?: string
  registration_number?: string
  gstin?: string
  phone?: string
  city?: string
}): Promise<TokenResponse> {
  return apiFetch("/auth/register/bidder", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function changePassword(
  old_password: string,
  new_password: string,
  token: string,
): Promise<void> {
  return apiFetch("/auth/password/change", {
    method: "POST",
    body: JSON.stringify({ old_password, new_password }),
    serverToken: token,
  })
}
