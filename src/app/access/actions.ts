"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ACCESS_COOKIE_MAX_AGE_SECONDS,
  ACCESS_COOKIE_NAME,
  createAccessToken,
  getGateConfig,
  passwordMatches,
  safeNextPath,
} from "@/lib/access/token";

export type AccessFormState = { error: string | null };

export async function submitAccessPassword(
  _prev: AccessFormState,
  formData: FormData,
): Promise<AccessFormState> {
  const gate = getGateConfig();
  const next = safeNextPath(formData.get("next"));
  if (!gate.enabled) redirect(next);
  if (!gate.secret) {
    return { error: "Доступ не налаштовано: не задано APP_COOKIE_SECRET." };
  }

  const password = formData.get("password");
  if (typeof password !== "string" || password.length === 0) {
    return { error: "Введіть пароль." };
  }
  if (!(await passwordMatches(gate.secret, password, gate.password))) {
    return { error: "Невірний пароль." };
  }

  const store = await cookies();
  store.set(ACCESS_COOKIE_NAME, await createAccessToken(gate.secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_COOKIE_MAX_AGE_SECONDS,
  });
  redirect(next);
}
