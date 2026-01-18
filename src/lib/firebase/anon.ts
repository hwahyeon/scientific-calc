import { signInAnonymously } from "firebase/auth";
import { auth } from "./client";

export async function ensureAnonAuth() {
  if (auth.currentUser) return auth.currentUser;
  const cred = await signInAnonymously(auth);
  return cred.user;
}
