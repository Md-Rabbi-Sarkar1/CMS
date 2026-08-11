import type {
  CompanyRole,
  CreateInvitationInput,
  ListUsersQuery,
  UpdateUserInput,
} from "@construction-ops/validation";

import { InvitationRepository, type InvitationStatus } from "../repositories/invitation-repository.js";
import { RefreshTokenRepository } from "../repositories/refresh-token-repository.js";
import { UserRepository, type UserListItem } from "../repositories/user-repository.js";
import { ConflictError, NotFoundError } from "../utils/errors.js";
import { generateInvitationToken, hashInvitationToken } from "../utils/invitation-token.js";

const INVITATION_EXPIRY_DAYS = 7;

export interface InvitationResponse {
  id: string;
  email: string;
  role: CompanyRole;
  status: InvitationStatus;
  expiresAt: Date;
  createdAt: Date;
}

function toInvitationResponse(invitation: {
  id: string;
  email: string;
  role: CompanyRole;
  status: InvitationStatus;
  expiresAt: Date;
  createdAt: Date;
}): InvitationResponse {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
  };
}

export class UserService {
  private readonly userRepository: UserRepository;
  private readonly invitationRepository: InvitationRepository;
  private readonly refreshTokenRepository: RefreshTokenRepository;

  constructor(
    userRepository = new UserRepository(),
    invitationRepository = new InvitationRepository(),
    refreshTokenRepository = new RefreshTokenRepository(),
  ) {
    this.userRepository = userRepository;
    this.invitationRepository = invitationRepository;
    this.refreshTokenRepository = refreshTokenRepository;
  }

  async listUsers(companyId: string, query: ListUsersQuery): Promise<{ users: UserListItem[]; total: number }> {
    return this.userRepository.list(companyId, query);
  }

  async inviteUser(companyId: string, input: CreateInvitationInput): Promise<InvitationResponse> {
    const existingUser = await this.userRepository.findByEmailInCompany(input.email, companyId);

    if (existingUser) {
      throw new ConflictError(`A user with email ${input.email} already exists`);
    }

    const pendingInvitation = await this.invitationRepository.findPendingByEmail(input.email, companyId);

    if (pendingInvitation) {
      throw new ConflictError(`An invitation for ${input.email} is already pending`);
    }

    const token = generateInvitationToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

    const invitation = await this.invitationRepository.create({
      companyId,
      email: input.email,
      role: input.role,
      tokenHash: hashInvitationToken(token),
      expiresAt,
    });

    return toInvitationResponse(invitation);
  }

  async updateUser(companyId: string, userId: string, input: UpdateUserInput): Promise<UserListItem> {
    const existing = await this.userRepository.findByIdInCompany(userId, companyId);

    if (!existing) {
      throw new NotFoundError("User not found");
    }

    const updatedCount = await this.userRepository.updateRoleStatus(userId, companyId, input);

    if (updatedCount === 0) {
      throw new NotFoundError("User not found");
    }

    if (input.status === "INACTIVE") {
      await this.refreshTokenRepository.revokeByUserId(userId);
    }

    const updated = await this.userRepository.findByIdInCompany(userId, companyId);

    if (!updated) {
      throw new NotFoundError("User not found");
    }

    return updated;
  }
}
