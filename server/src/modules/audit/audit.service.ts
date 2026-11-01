import { dbPool } from '../../config/db.js';

export interface AuditLogEntry {
  userId?: string | null;
  action: 'LOGIN' | '2FA_VERIFY' | 'LOGOUT' | 'SEND_MESSAGE' | 'SEND_EMAIL' | 'DLP_VIOLATION' | 'FILE_UPLOAD' | 'ACCOUNT_LOCKED';
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED';
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
}

export class AuditService {
  /**
   * Ghi log kiểm toán (Append-only) vào CSDL
   */
  public static async recordLog(entry: AuditLogEntry): Promise<void> {
    try {
      const query = `
        INSERT INTO audit_logs (user_id, action, status, ip_address, user_agent, details)
        VALUES ($1, $2, $3, $4, $5, $6);
      `;
      const values = [
        entry.userId || null,
        entry.action,
        entry.status,
        entry.ipAddress || null,
        entry.userAgent || null,
        entry.details ? JSON.stringify(entry.details) : null,
      ];
      await dbPool.query(query, values);
    } catch (error: any) {
      console.error('[AuditService Error] Failed to write audit log:', error.message);
    }
  }

  /**
   * Truy vấn danh sách Audit Log cho Quản trị viên (Dashboard)
   */
  public static async queryLogs(options: {
    page?: number;
    limit?: number;
    action?: string;
    status?: string;
  }) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    let whereConditions: string[] = [];
    let values: any[] = [];
    let paramIndex = 1;

    if (options.action) {
      whereConditions.push(`action = $${paramIndex++}`);
      values.push(options.action);
    }

    if (options.status) {
      whereConditions.push(`status = $${paramIndex++}`);
      values.push(options.status);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT al.*, u.email as user_email, u.full_name as user_full_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;
    values.push(limit, offset);

    const countQuery = `SELECT COUNT(*) FROM audit_logs ${whereClause};`;

    const [logsResult, countResult] = await Promise.all([
      dbPool.query(query, values),
      dbPool.query(countQuery, values.slice(0, paramIndex - 3)),
    ]);

    return {
      data: logsResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
      page,
      limit,
    };
  }
}
