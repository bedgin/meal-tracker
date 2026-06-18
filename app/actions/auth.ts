"use server";

import { signIn } from "@/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";

export async function signUp(formData: FormData) {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const name = (formData.get("name") as string)?.trim();

  if (!email || !password) {
    return { error: "Email and password are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  const hashed = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { email, name: name || null, password: hashed },
  });

  await signIn("credentials", { email, password, redirectTo: "/" });
}

export async function credentialsSignIn(formData: FormData) {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;

  try {
    await signIn("credentials", { email, password, redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    throw error;
  }
}
