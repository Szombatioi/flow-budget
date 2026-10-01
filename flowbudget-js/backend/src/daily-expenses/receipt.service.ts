import { Inject, Injectable, Logger } from '@nestjs/common';
import { CategoriesService } from '../categories/categories.js';
import { badRequest } from '../common/errors.js';
import { APP_CONFIG, type AppConfig } from '../config/config.js';
import { UsersService } from '../users/users.js';

export interface ReceiptItemDto {
  name: string;
  price: number;
  categoryId: string | null;
}

const LANGUAGE_NAMES: Record<string, string> = { en: 'English', hu: 'Hungarian' };

@Injectable()
export class ReceiptService {
  private readonly logger = new Logger(ReceiptService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly users: UsersService,
    private readonly categories: CategoriesService,
  ) {}

  async scan(userId: string, file: { buffer: Buffer; mimetype: string }): Promise<ReceiptItemDto[]> {
    const apiKey = await this.users.apiKey(userId);
    if (!apiKey) throw badRequest('no_api_key');

    const categories = await this.categories.list(userId);
    const language = LANGUAGE_NAMES[(await this.users.language(userId)) ?? 'en'] ?? 'English';

    const res = await fetch(`${this.config.gemini.apiBase}/models/${this.config.gemini.model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt(language, categories) }, { inline_data: { mime_type: file.mimetype, data: file.buffer.toString('base64') } }] }],
        generationConfig: { response_mime_type: 'application/json' },
      }),
    }).catch((err: Error) => {
      this.logger.warn(`Gemini request failed: ${err.message}`);
      throw badRequest('upload_fail');
    });

    if (!res.ok) {
      this.logger.warn(`Gemini responded with ${res.status}: ${(await res.text()).slice(0, 500)}`);
      throw badRequest('upload_fail');
    }

    const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text?.replace(/^```(json)?|```$/g, '').trim();
    if (!text) throw badRequest('upload_fail');

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw badRequest('upload_fail');
    }
    if (!Array.isArray(parsed)) return [];

    const known = new Set(categories.map((c) => c.id));
    return parsed
      .map((item: { name?: unknown; price?: unknown; category?: unknown }) => ({
        name: String(item.name ?? '').trim().slice(0, 100),
        price: Math.round(Number(item.price) * 100) / 100,
        categoryId: typeof item.category === 'string' && known.has(item.category) ? item.category : null,
      }))
      .filter((item) => item.name && Number.isFinite(item.price) && item.price > 0);
  }
}

function prompt(language: string, categories: { id: string; name: string }[]): string {
  const categoryList = categories.map((c) => `${c.name} (${c.id})`).join(', ');
  return `Examine the uploaded image that should contain a receipt from a store. If the image is not about a receipt, immediately return an empty array as result.
Otherwise, try to extract each item listed on this image, and return an array as result.
The array's elements should be the following: item name (try not to use long names), price (only the number, the currency is not needed), category (the available categories are listed at the end of the prompt).
Result format for each array element:
    name: <name>,
    price: <price>,
    category: <category id>
The result should be written in the given language: ${language}.
When extracting an item from the receipt, select any of the categories (OR null, if none of them match):
${categoryList}
When you set a category, set its ID, not its name! The name is just helping you understand the categories.`;
}
