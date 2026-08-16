import { Injectable } from '@nestjs/common';
import { GroupBuyService } from './group-buy.service';

@Injectable()
export class PublicGroupBuyViewService {
  constructor(private readonly groupBuyService: GroupBuyService) {}

  async findAvailableGroups(activityId: string) {
    const groups = await this.groupBuyService.weappFindAvailableGroups(activityId);
    return groups.map((group) => ({
      id: group.id.toString(),
      activityId: group.activityId.toString(),
      status: group.status,
      groupNo: group.groupNo,
      currentCount: group.currentCount,
      targetCount: group.targetCount,
      expiresAt: group.expiresAt,
      successAt: group.successAt,
      failedAt: group.failedAt,
      createdAt: group.createdAt,
      members: group.members.map((member) => ({
        role: member.role,
        status: member.status,
        paidAt: member.paidAt,
      })),
      leader: group.leader
        ? {
            nickname: group.leader.nickname || '用户',
            avatarUrl: group.leader.avatarUrl || '',
          }
        : { nickname: '用户', avatarUrl: '' },
    }));
  }

  async findGroupById(id: string, currentUserId?: string) {
    const group = await this.groupBuyService.weappFindGroupById(id);
    const normalizedCurrentUserId = currentUserId ? String(currentUserId) : '';
    return {
      id: group.id.toString(),
      activityId: group.activityId.toString(),
      status: group.status,
      groupNo: group.groupNo,
      currentCount: group.currentCount,
      targetCount: group.targetCount,
      expiresAt: group.expiresAt,
      successAt: group.successAt,
      failedAt: group.failedAt,
      createdAt: group.createdAt,
      now: new Date().toISOString(),
      activity: group.activity
        ? {
            id: group.activity.id.toString(),
            name: group.activity.name,
            coverImage: group.activity.coverImage || '',
            groupPrice: group.activity.groupPrice,
            groupSize: group.activity.groupSize,
          }
        : null,
      members: group.members.map((member) => ({
        role: member.role,
        status: member.status,
        paidAt: member.paidAt,
        createdAt: member.createdAt,
        isCurrentUser: !!normalizedCurrentUserId
          && member.userId.toString() === normalizedCurrentUserId,
        user: member.user
          ? {
              nickname: member.user.nickname || '用户',
              avatarUrl: member.user.avatarUrl || '',
            }
          : { nickname: '用户', avatarUrl: '' },
      })),
    };
  }
}
