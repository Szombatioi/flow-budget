import { Body, Controller, Get, HttpCode, Inject, Injectable, Module, Post, Put, Req, Res } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import type { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { AUTH, type Auth } from '../auth/auth.js';
import { withAuthErrors } from '../auth/auth-errors.js';
import { type AuthUser, CurrentUser, UserId } from '../auth/decorators.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { Account, UserProfile } from '../database/entities/index.js';

export const LANGUAGES = ['en', 'hu'] as const;

class UpdateProfileDto {
  @IsString()
  @Length(3, 50)
  userName: string;
}

class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MaxLength(128)
  newPassword: string;
}

class UpdatePreferencesDto {
  @IsIn(['light', 'dark'])
  theme: 'light' | 'dark';

  @IsIn(LANGUAGES)
  language: (typeof LANGUAGES)[number];
}

class PasswordDto {
  @IsString()
  password: string;
}

class UpdateApiKeyDto extends PasswordDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string | null;
}

export interface UserDto {
  id: string;
  userName: string;
  email: string;
  accountIds: string[];
  theme: string | null;
  language: string | null;
  hasApiKey: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly crypto: CryptoService,
    @Inject(AUTH) private readonly auth: Auth,
  ) {}

  async me(user: AuthUser): Promise<UserDto> {
    const profile = await this.profile(user.id);
    const accounts = await this.dataSource.getRepository(Account).find({ where: { userId: user.id }, select: { id: true }, order: { createdAt: 'ASC' } });
    return {
      id: user.id,
      userName: user.username ?? user.name,
      email: user.email,
      accountIds: accounts.map((a) => a.id),
      theme: profile.theme,
      language: profile.language,
      hasApiKey: profile.apiKeyEnc !== null,
    };
  }

  async updateProfile(req: Request, dto: UpdateProfileDto): Promise<void> {
    const userName = dto.userName.trim();
    await withAuthErrors(() => this.auth.api.updateUser({ body: { username: userName, name: userName }, headers: fromNodeHeaders(req.headers) }));
  }

  // Other sessions are revoked and a new session is issued, so its cookie must reach the browser.
  async changePassword(req: Request, res: Response, dto: ChangePasswordDto): Promise<void> {
    const { headers } = await withAuthErrors(() =>
      this.auth.api.changePassword({
        body: { currentPassword: dto.currentPassword, newPassword: dto.newPassword, revokeOtherSessions: true },
        headers: fromNodeHeaders(req.headers),
        returnHeaders: true,
      }),
    );
    const cookies = headers.getSetCookie();
    if (cookies.length > 0) res.setHeader('Set-Cookie', cookies);
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto): Promise<void> {
    await this.profile(userId);
    await this.dataSource.getRepository(UserProfile).update({ userId }, { theme: dto.theme, language: dto.language });
  }

  async revealApiKey(req: Request, userId: string, dto: PasswordDto): Promise<{ apiKey: string | null }> {
    await this.verifyPassword(req, dto.password);
    const profile = await this.profile(userId);
    return { apiKey: await this.crypto.decrypt(userId, profile.apiKeyEnc) };
  }

  async updateApiKey(req: Request, userId: string, dto: UpdateApiKeyDto): Promise<void> {
    await this.verifyPassword(req, dto.password);
    await this.profile(userId);
    const apiKey = dto.apiKey?.trim() || null;
    await this.dataSource.getRepository(UserProfile).update({ userId }, { apiKeyEnc: await this.crypto.encryptNullable(userId, apiKey) });
  }

  async apiKey(userId: string): Promise<string | null> {
    return this.crypto.decrypt(userId, (await this.profile(userId)).apiKeyEnc);
  }

  async language(userId: string): Promise<string | null> {
    return (await this.profile(userId)).language;
  }

  private async verifyPassword(req: Request, password: string) {
    await withAuthErrors(() => this.auth.api.verifyPassword({ body: { password }, headers: fromNodeHeaders(req.headers) }));
  }

  private async profile(userId: string): Promise<UserProfile> {
    const repo = this.dataSource.getRepository(UserProfile);
    let profile = await repo.findOneBy({ userId });
    if (!profile) {
      await this.crypto.ensureUserKey(userId);
      profile = await repo.findOneByOrFail({ userId });
    }
    return profile;
  }
}

@Controller('api/user')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  me(@CurrentUser() user: AuthUser) {
    return this.service.me(user);
  }

  @Put('profile')
  @HttpCode(204)
  updateProfile(@Req() req: Request, @Body() dto: UpdateProfileDto) {
    return this.service.updateProfile(req, dto);
  }

  @Put('password')
  @HttpCode(204)
  changePassword(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() dto: ChangePasswordDto) {
    return this.service.changePassword(req, res, dto);
  }

  @Put('preferences')
  @HttpCode(204)
  updatePreferences(@UserId() userId: string, @Body() dto: UpdatePreferencesDto) {
    return this.service.updatePreferences(userId, dto);
  }

  @Post('api-key/reveal')
  @HttpCode(200)
  revealApiKey(@Req() req: Request, @UserId() userId: string, @Body() dto: PasswordDto) {
    return this.service.revealApiKey(req, userId, dto);
  }

  @Put('api-key')
  @HttpCode(204)
  updateApiKey(@Req() req: Request, @UserId() userId: string, @Body() dto: UpdateApiKeyDto) {
    return this.service.updateApiKey(req, userId, dto);
  }
}

@Module({ controllers: [UsersController], providers: [UsersService], exports: [UsersService] })
export class UsersModule {}
