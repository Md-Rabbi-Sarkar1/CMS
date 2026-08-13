import { prisma } from "../providers/database.js";
import {
  InvitationRepository,
  type InvitationRow,
} from "../repositories/invitation-repository.js";
import {
  UserManagementRepository,
  type UserRow,
} from "../repositories/user-management-repository.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../utils/errors.js";
import { hashInviteToken, generateInviteToken } from "../utils/invitation-token.js";
import { hashPassword } from "../utils/password.js";
import type { JWTPayload } from "../types/auth.js";
import type { CompanyRole } from "../types/auth.js";
import type { AcceptInviteInput, InviteUserInput, UpdateUserInput } from "@construction-ops/validation";

const INVITATION_EXPIRY_DAYS = 7;

export interface InvitationResponse {
  id: string;
  email: string;
  role: CompanyRole;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: CompanyRole;
  companyId: string;
}

export interface InviteResult extends InvitationResponse {
  /** Plaintext token returned once at creation time for the inviter to deliver. */
  token: string;
}

export interface AcceptInviteResult {
  user: UserResponse;
  accessToken: string;
  refreshToken: string;
}

export interface UserListResponse {
  items: UserResponse[];
  total: number;
  page: number;
  pageSize: number;
}

function toInvitationResponse(inv: InvitationRow): InvitationResponse {
  return {
    id: inv.id,
    email: inv.email,
    role: inv.role,
    status: inv.status,
    expiresAt: inv.expiresAt.toISOString(),
    createdAt: inv.createdAt.toISOString(),
  };
}

function toUserResponse(user: UserRow): UserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as CompanyRole,
    companyId: user.companyId,
  };
}

export class UserService {
  private readonly userRepository: UserManagementRepository;
  private readonly invitationRepository: InvitationRepository;

  constructor(
    userRepository: UserManagementRepository = new UserManagementRepository(),
    invitationRepository: InvitationRepository = new InvitationRepository(),
  ) {
    this.userRepository = userRepository;
    this.invitationRepository = invitationRepository;
  }

  async invite(user: JWTPayload, payload: InviteUserInput): Promise<InviteResult> {
    const existing = await prisma.user.findFirst({
      where: { companyId: user.companyId, email: payload.email },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictError("A user with this email already exists in the company");
    }

    const pending = await this.invitationRepository.findPendingByEmail(user.companyId, payload.email);
    if (pending) {
      throw new ConflictError("An invitation for this email is already pending");
    }

    const token = generateInviteToken();
    const tokenHash = hashInviteToken(token);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

    const invitation = await this.invitationRepository.create({
      companyId: user.companyId,
      email: payload.email,
      role: payload.role,
      tokenHash,
      expiresAt,
    });

    return { ...toInvitationResponse(invitation), token };
  }

  async listInvitations(user: JWTPayload): Promise<InvitationResponse[]> {
    const invitations = await this.invitationRepository.list(user.companyId);
    return invitations.map(toInvitationResponse);
  }

  async listUsers(
    user: JWTPayload,
    query: { page: number; pageSize: number; role?: CompanyRole | undefined },
  ): Promise<UserListResponse> {
    const result = await this.userRepository.list({
      companyId: user.companyId,
      page: query.page,
      pageSize: query.pageSize,
      role: query.role,
    });

    return {
      items: result.items.map(toUserResponse),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }

  async updateUserRole(
    user: JWTPayload,
    userId: string,
    payload: UpdateUserInput,
  ): Promise<UserResponse> {
    if (userId === user.sub) {
      throw new ForbiddenError("You cannot change your own role");
    }

    const target = await this.userRepository.findById(userId, user.companyId);

    if (!target) {
      throw new NotFoundError("User not found");
    }

    if (payload.role === undefined) {
      return toUserResponse(target);
    }

    const updated = await this.userRepository.updateRole(userId, payload.role);
    return toUserResponse(updated);
  }

  async acceptInvite(payload: AcceptInviteInput): Promise<{ companyId: string; userId: string }> {
    const tokenHash = hashInviteToken(payload.token);
    const invitation = await this.invitationRepository.findByTokenHash(tokenHash);

    if (!invitation) {
      throw new NotFoundError("Invitation not found or already used");
    }

    if (invitation.expiresAt < new Date()) {
      throw new ConflictError("Invitation has expired");
    }

    const passwordHash = await hashPassword(payload.password);

    const created = await prisma.user.create({
      data: {
        companyId: invitation.companyId,
        name: payload.name,
        email: invitation.email,
        passwordHash,
        role: invitation.role,
      },
      select: { id: true, companyId: true },
    });

    await this.invitationRepository.markAccepted(invitation.id);

    return { companyId: created.companyId, userId: created.id };
  }
}
