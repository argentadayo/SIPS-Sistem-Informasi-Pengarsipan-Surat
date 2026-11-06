import { db } from "../lib/db";
import { logger } from "../lib/logger";

export async function writeAudit(params: {
  userId?: number | null;
  action: string;
  entity: string;
  entityId?: number | null;
  detail?: string;
  ipAddress?: string | null;
}) {
  try {
    await db.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        detail: params.detail ?? null,
        ipAddress: params.ipAddress ?? null,
      },
    });
  } catch (e) {
    logger.error("audit_write_failed", { error: String(e) });
  }
}
