import { RefreshTokenRepository } from "../repositories/refresh-token-repository.js";
import { UserRepository } from "../repositories/user-repository.js";
import { comparePassword } from "../utils/password.js";
import { createAccessToken } from "../utils/jwt.js";
import { generateRefreshToken, hashRefreshToken } from "../utils/refresh-token.js";
import { NotFoundError, UnauthorizedError } from "../utils/errors.js";
import type { CompanyRole, JWTPayload } from "../types/auth.js";

const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export interface AuthUserResponse {
  id: string;
  name: string;
  email: string;
  role: CompanyRole;
  companyId: string;
}

export interface AuthUserWithCompanyResponse extends AuthUserResponse {
  company: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface LoginResult {
  user: AuthUserResponse;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResult {
  user: AuthUserResponse;
  accessToken: string;
  refreshToken: string;
}

interface TokenUser {
  id: string;
  name: string;
  email: string;
  role: CompanyRole;
  companyId: string;
}

interface BuiltTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenHash: string;
  refreshTokenExpiresAt: Date;
}

function toAuthUser(user: TokenUser): AuthUserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
  };
}

function buildTokens(user: TokenUser): BuiltTokens {
  const payload: JWTPayload = {
    sub: user.id,
    companyId: user.companyId,
    role: user.role,
  };

  const accessToken = createAccessToken(payload);
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const refreshTokenExpiresAt = new Date();
  refreshTokenExpiresAt.setDate(refreshTokenExpiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  return { accessToken, refreshToken, refreshTokenHash, refreshTokenExpiresAt };
}

export class AuthService {
  private readonly userRepository: UserRepository;
  private readonly refreshTokenRepository: RefreshTokenRepository;

  constructor(
    userRepository = new UserRepository(),
    refreshTokenRepository = new RefreshTokenRepository(),
  ) {
    this.userRepository = userRepository;
    this.refreshTokenRepository = refreshTokenRepository;
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.userRepository.findByEmail(email);

    if (!user || !(await comparePassword(password, user.passwordHash))) {
      throw new UnauthorizedError("Invalid credentials");
    }

    const tokens = buildTokens(user);

    await this.refreshTokenRepository.create({
      user: {
        connect: { id: user.id },
      },
      tokenHash: tokens.refreshTokenHash,
      expiresAt: tokens.refreshTokenExpiresAt,
    });

    return {
      user: toAuthUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async refresh(refreshToken: string): Promise<RefreshResult> {
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const storedToken = await this.refreshTokenRepository.findByTokenHash(refreshTokenHash);

    if (!storedToken) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    const user = await this.userRepository.findById(storedToken.userId);

    if (!user) {
      throw new NotFoundError("User not found");
    }

    const tokens = buildTokens(user);

    await this.refreshTokenRepository.replaceToken(
      storedToken.id,
      tokens.refreshTokenHash,
      tokens.refreshTokenExpiresAt,
    );

    return {
      user: toAuthUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const storedToken = await this.refreshTokenRepository.findByTokenHash(refreshTokenHash);

    if (storedToken) {
      await this.refreshTokenRepository.revokeById(storedToken.id);
    }
  }

  async me(userId: string): Promise<AuthUserWithCompanyResponse> {
    const user = await this.userRepository.findByIdWithCompany(userId);

    if (!user) {
      throw new NotFoundError("User not found");
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      company: {
        id: user.company.id,
        name: user.company.name,
        slug: user.company.slug,
      },
    };
  }
}
