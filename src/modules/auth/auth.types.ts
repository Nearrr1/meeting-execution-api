export interface RegistrationInput {
  email: string;
  password: string;
  passwordConfirmation: string;
  displayName?: string;
}

export interface VerifyEmailInput {
  email: string;
  code: string;
}

export interface PasswordResetInput {
  token: string;
  newPassword: string;
  passwordConfirmation: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  passwordConfirmation: string;
}

export interface RegistrationResult {
  status: 'verification_required';
  expiresAt: string;
  resendAvailableAt: string;
}

export interface VerifyEmailResult {
  sessionToken: string;
  accountSession: Record<string, unknown>;
}

export interface SignInResult extends VerifyEmailResult {}
