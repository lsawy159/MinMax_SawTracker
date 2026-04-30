/**
 * Password policy validation — T-208
 *
 * Policy (matches system_settings.password_policy):
 *   min_length:       8 chars
 *   require_upper:    at least 1 uppercase letter
 *   require_lower:    at least 1 lowercase letter
 *   require_digit:    at least 1 digit
 *   require_symbol:   at least 1 special character
 */

export interface PasswordPolicyResult {
  valid: boolean
  errors: string[]
}

export interface PasswordPolicy {
  minLength: number
  requireUpper: boolean
  requireLower: boolean
  requireDigit: boolean
  requireSymbol: boolean
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUpper: true,
  requireLower: true,
  requireDigit: true,
  requireSymbol: true,
}

/**
 * Validates a password against the given policy.
 * Returns { valid, errors } where errors is a list of Arabic messages.
 */
export function validatePassword(
  password: string,
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY,
): PasswordPolicyResult {
  const errors: string[] = []

  if (password.length < policy.minLength) {
    errors.push(`كلمة المرور يجب أن تكون ${policy.minLength} أحرف على الأقل`)
  }

  if (policy.requireUpper && !/[A-Z]/.test(password)) {
    errors.push('يجب أن تحتوي على حرف كبير واحد على الأقل (A-Z)')
  }

  if (policy.requireLower && !/[a-z]/.test(password)) {
    errors.push('يجب أن تحتوي على حرف صغير واحد على الأقل (a-z)')
  }

  if (policy.requireDigit && !/\d/.test(password)) {
    errors.push('يجب أن تحتوي على رقم واحد على الأقل (0-9)')
  }

  if (policy.requireSymbol && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
    errors.push('يجب أن تحتوي على رمز خاص واحد على الأقل (!@#$%^&*...)')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
