import { signUp } from './authService';

/** Create a student or teacher account with a unique User ID. */
export function registerAccount(details) {
  return signUp(details);
}
