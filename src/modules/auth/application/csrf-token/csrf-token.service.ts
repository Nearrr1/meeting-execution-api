import { ForbiddenException, Injectable } from '@nestjs/common';
import { ApiErrorCode, csrfCookie, newCsrfToken } from '#common';
import { CsrfTokenCommand } from './csrf-token.command.ts';
import { getRuntimeConfig } from '#config';

@Injectable()
export class CsrfTokenService {
  execute(
    command: CsrfTokenCommand,
    setCookie: (cookie: string) => void,
    setHeader: (name: string, value: string) => void,
  ) {
    if (typeof command.origin === 'string') {
      const allowed = getRuntimeConfig().webOrigins;
      if (!allowed.includes(command.origin))
        throw new ForbiddenException({ code: ApiErrorCode.ORIGIN_NOT_ALLOWED });
      setHeader('Access-Control-Allow-Origin', command.origin);
      setHeader('Access-Control-Allow-Credentials', 'true');
      setHeader('Vary', 'Origin');
    }
    const token = newCsrfToken();
    setCookie(csrfCookie(token));
    return { csrfToken: token };
  }
}
