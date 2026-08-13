import { prisma } from "../providers/database.js";
import { TeamRepository, type MemberRow } from "../repositories/team-repository.js";
import { ConflictError, NotFoundError } from "../utils/errors.js";
import type { JWTPayload } from "../types/auth.js";

export interface MemberResponse {
  id: string;
  userId: string;
  projectId: string;
  assignedAt: string;
  user: { id: string; name: string; email: string; role: string };
}

function toResponse(member: MemberRow): MemberResponse {
  return {
    id: member.id,
    userId: member.userId,
    projectId: member.projectId,
    assignedAt: member.assignedAt.toISOString(),
    user: {
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
      role: member.user.role,
    },
  };
}

export class TeamService {
  private readonly teamRepository: TeamRepository;

  constructor(teamRepository: TeamRepository = new TeamRepository()) {
    this.teamRepository = teamRepository;
  }

  async listMembers(user: JWTPayload, projectId: string): Promise<MemberResponse[]> {
    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId: user.companyId },
      select: { id: true, managerId: true },
    });

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    await this.assertAccess(user, project.id, project.managerId);

    const members = await this.teamRepository.listByProject(projectId);
    return members.map(toResponse);
  }

  async addMember(
    user: JWTPayload,
    projectId: string,
    userId: string,
  ): Promise<MemberResponse> {
    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId: user.companyId },
      select: { id: true, managerId: true },
    });

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    const target = await prisma.user.findFirst({
      where: { id: userId, companyId: user.companyId },
      select: { id: true },
    });

    if (!target) {
      throw new NotFoundError("User not found");
    }

    const existing = await this.teamRepository.findMembership(projectId, userId);
    if (existing) {
      throw new ConflictError("User is already a member of this project");
    }

    const member = await this.teamRepository.addMember(projectId, userId);
    return toResponse(member);
  }

  async removeMember(user: JWTPayload, projectId: string, userId: string): Promise<void> {
    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId: user.companyId },
      select: { id: true, managerId: true },
    });

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    const existing = await this.teamRepository.findMembership(projectId, userId);
    if (!existing) {
      throw new NotFoundError("Membership not found");
    }

    await this.teamRepository.removeMember(projectId, userId);
  }

  private async assertAccess(
    user: JWTPayload,
    projectId: string,
    managerId: string | null,
  ): Promise<void> {
    if (user.role === "ADMIN") return;
    if (managerId === user.sub) return;

    const membership = await this.teamRepository.findMembership(projectId, user.sub);
    if (!membership) {
      throw new NotFoundError("Project not found");
    }
  }
}
