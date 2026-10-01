import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from './config';

async function resolveLocale(): Promise<Locale> {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const accepted = (await headers()).get('accept-language') ?? '';
  const preferred = accepted.split(',').map((part) => part.split(';')[0].trim().slice(0, 2));
  return preferred.find(isLocale) ?? DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return { locale, messages: (await import(`../../messages/${locale}.json`)).default };
});
