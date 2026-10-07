"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, authToken } from "@/lib/auth";

export async function login(_prev: string | null, formData: FormData): Promise<string | null> {
  const password = String(formData.get("password") ?? "");
  if (!process.env.APP_PASSWORD || password !== process.env.APP_PASSWORD) return "Wrong password";
  (await cookies()).set(AUTH_COOKIE, await authToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  const next = String(formData.get("next") || "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}
