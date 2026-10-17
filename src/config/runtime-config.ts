export type RuntimeEnvironment = 'development' | 'test' | 'production';

export interface RuntimeConfig {
  environment: RuntimeEnvironment;
  port: number;
  databaseUrl: string;
  webOrigins: string[];
  otpHmacKey: string;
  passwordResetUrl: string;
  emailChangeUrl: string;
  resendApiKey: string;
  resendFromEmail: string;
  sessionCookieName: string;
  sessionCookieSecure: boolean;
  sessionCookieSameSite: 'lax' | 'strict' | 'none';
  oidc: {
    issuer: string;
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
    googleConnection: string;
    microsoftConnection: string;
    transactionEncryptionKey: string;
  } | null;
}

const originPattern = /^https?:\/\//i;

export function loadRuntimeConfig(environment: NodeJS.ProcessEnv): RuntimeConfig {
  const errors: string[] = [];
  const nodeEnv = environment.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) errors.push('NODE_ENV');

  const portValue = environment.PORT ?? '3000';
  const port = Number(portValue);
  if (!/^\d+$/.test(portValue) || !Number.isInteger(port) || port < 1 || port > 65535) errors.push('PORT');

  const databaseUrl = environment.DATABASE_URL ?? '';
  if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) errors.push('DATABASE_URL');

  const originsValue = environment.WEB_ORIGINS ?? '';
  const webOrigins = originsValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    webOrigins.length === 0 ||
    webOrigins.some((origin) => {
      try {
        const parsed = new URL(origin);
        return (
          !originPattern.test(origin) ||
          parsed.origin !== origin ||
          parsed.username !== '' ||
          parsed.password !== '' ||
          (nodeEnv === 'production' && parsed.protocol !== 'https:')
        );
      } catch {
        return true;
      }
    })
  )
    errors.push('WEB_ORIGINS');

  const otpHmacKey = environment.OTP_HMAC_KEY ?? '';
  if (Buffer.byteLength(otpHmacKey) < 32) errors.push('OTP_HMAC_KEY');

  const passwordResetUrl = validateFirstPartyUrl(
    'PASSWORD_RESET_URL',
    environment.PASSWORD_RESET_URL,
    webOrigins,
    nodeEnv,
    errors,
  );
  const emailChangeUrl = validateFirstPartyUrl(
    'EMAIL_CHANGE_URL',
    environment.EMAIL_CHANGE_URL,
    webOrigins,
    nodeEnv,
    errors,
  );

  const resendApiKey = environment.RESEND_API_KEY?.trim() ?? '';
  if (!resendApiKey) errors.push('RESEND_API_KEY');
  const resendFromEmail = environment.RESEND_FROM_EMAIL?.trim() ?? '';
  if (!isSafeFromAddress(resendFromEmail)) errors.push('RESEND_FROM_EMAIL');

  const sessionCookieSameSite = (environment.SESSION_COOKIE_SAME_SITE ?? 'lax').toLowerCase();
  if (!['lax', 'strict', 'none'].includes(sessionCookieSameSite)) errors.push('SESSION_COOKIE_SAME_SITE');
  const secureValue = environment.SESSION_COOKIE_SECURE;
  if (secureValue !== undefined && !['true', 'false'].includes(secureValue.toLowerCase()))
    errors.push('SESSION_COOKIE_SECURE');
  const sessionCookieSecure = nodeEnv === 'production' || secureValue?.toLowerCase() === 'true';
  if (sessionCookieSameSite === 'none' && !sessionCookieSecure)
    errors.push('SESSION_COOKIE_SECURE (required when SameSite=None)');

  const defaultCookieName = nodeEnv === 'production' ? '__Host-aimeeting_session' : 'aimeeting_session';
  const sessionCookieName = environment.SESSION_COOKIE_NAME?.trim() || defaultCookieName;
  if (!/^[A-Za-z0-9_-]+$/.test(sessionCookieName)) errors.push('SESSION_COOKIE_NAME');
  if (nodeEnv === 'production' && !sessionCookieName.startsWith('__Host-'))
    errors.push('SESSION_COOKIE_NAME (must use __Host- in production)');

  const oidcValues = [
    environment.AUTH0_ISSUER,
    environment.AUTH0_CLIENT_ID,
    environment.AUTH0_CLIENT_SECRET,
    environment.AUTH0_CALLBACK_URL,
    environment.AUTH0_GOOGLE_CONNECTION,
    environment.AUTH0_MICROSOFT_CONNECTION,
    environment.OIDC_TRANSACTION_ENCRYPTION_KEY,
  ];
  const oidcConfigured = oidcValues.some((value) => Boolean(value?.trim()));
  let oidc: RuntimeConfig['oidc'] = null;
  if (oidcConfigured) {
    const [
      issuerValue,
      clientIdValue,
      clientSecretValue,
      callbackValue,
      googleValue,
      microsoftValue,
      encryptionKeyValue,
    ] = oidcValues;
    let issuer = '';
    let callbackUrl = '';
    try {
      const parsed = new URL(issuerValue ?? '');
      if (parsed.protocol !== 'https:' || parsed.pathname !== '/' || parsed.search || parsed.hash)
        errors.push('AUTH0_ISSUER');
      issuer = parsed.origin + '/';
    } catch {
      errors.push('AUTH0_ISSUER');
    }
    try {
      const parsed = new URL(callbackValue ?? '');
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.hash)
        errors.push('AUTH0_CALLBACK_URL');
      if (nodeEnv === 'production' && parsed.protocol !== 'https:') errors.push('AUTH0_CALLBACK_URL');
      callbackUrl = parsed.toString();
    } catch {
      errors.push('AUTH0_CALLBACK_URL');
    }
    if (!clientIdValue?.trim()) errors.push('AUTH0_CLIENT_ID');
    if (!clientSecretValue?.trim()) errors.push('AUTH0_CLIENT_SECRET');
    if (!googleValue?.trim()) errors.push('AUTH0_GOOGLE_CONNECTION');
    if (!microsoftValue?.trim()) errors.push('AUTH0_MICROSOFT_CONNECTION');
    if (Buffer.byteLength(encryptionKeyValue ?? '') !== 32)
      errors.push('OIDC_TRANSACTION_ENCRYPTION_KEY (must be 32 bytes)');
    if (
      issuer &&
      callbackUrl &&
      clientIdValue &&
      clientSecretValue &&
      googleValue &&
      microsoftValue &&
      encryptionKeyValue
    ) {
      oidc = {
        issuer,
        clientId: clientIdValue.trim(),
        clientSecret: clientSecretValue,
        callbackUrl,
        googleConnection: googleValue.trim(),
        microsoftConnection: microsoftValue.trim(),
        transactionEncryptionKey: encryptionKeyValue,
      };
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration: ${[...new Set(errors)].join(', ')}`);
  }

  return {
    environment: nodeEnv as RuntimeEnvironment,
    port,
    databaseUrl,
    webOrigins,
    otpHmacKey,
    passwordResetUrl,
    emailChangeUrl,
    resendApiKey,
    resendFromEmail,
    sessionCookieName,
    sessionCookieSecure,
    sessionCookieSameSite: sessionCookieSameSite as RuntimeConfig['sessionCookieSameSite'],
    oidc,
  };
}

function isSafeFromAddress(value: string): boolean {
  if (!value || /[\r\n]/.test(value)) return false;
  const address = value.match(/<([^<>]+)>$/)?.[1] ?? value;
  return /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(address);
}

function validateFirstPartyUrl(
  name: string,
  value: string | undefined,
  allowedOrigins: string[],
  environment: string,
  errors: string[],
): string {
  if (!value) {
    errors.push(name);
    return '';
  }
  try {
    const url = new URL(value);
    if (
      !allowedOrigins.includes(url.origin) ||
      url.username ||
      url.password ||
      url.hash ||
      (environment === 'production' && url.protocol !== 'https:')
    )
      errors.push(name);
    return url.toString();
  } catch {
    errors.push(name);
    return '';
  }
}

let runtimeConfig: RuntimeConfig | undefined;

export function initializeRuntimeConfig(environment: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  runtimeConfig = loadRuntimeConfig(environment);
  return runtimeConfig;
}

export function getRuntimeConfig(): RuntimeConfig {
  return runtimeConfig ?? initializeRuntimeConfig();
}

export function resetRuntimeConfigForTests(): void {
  runtimeConfig = undefined;
}
