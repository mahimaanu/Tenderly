"""
Notifications — bell + inbox for both officers and bidders.
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from ..auth import CurrentUser, current_user
from ..db import dict_all, dict_one, get_conn, with_dict_cursor

router = APIRouter()


@router.get("")
async def list_notifications(
    read: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    user: CurrentUser = Depends(current_user),
):
    where = ["user_id = %s", "user_role = %s"]
    params: list = [user.id, user.role]
    if read is True:
        where.append("read_at IS NOT NULL")
    elif read is False:
        where.append("read_at IS NULL")
    sql = f"SELECT * FROM notifications WHERE {' AND '.join(where)} ORDER BY created_at DESC LIMIT %s OFFSET %s"
    params.extend([page_size, (page - 1) * page_size])

    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(sql, params)
            data = dict_all(cur)
            cur.execute(
                "SELECT COUNT(*) AS unread FROM notifications WHERE user_id = %s AND user_role = %s AND read_at IS NULL",
                (user.id, user.role),
            )
            unread = (dict_one(cur) or {}).get("unread", 0)
    finally:
        conn.close()

    return {"data": data, "meta": {"page": page, "page_size": page_size, "unread_count": int(unread)}}


@router.post("/{notification_id}/read", status_code=204)
async def mark_read(notification_id: str, user: CurrentUser = Depends(current_user)):
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(
                "UPDATE notifications SET read_at = NOW() "
                "WHERE id = %s AND user_id = %s AND user_role = %s",
                (notification_id, user.id, user.role),
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Notification not found")
            conn.commit()
    finally:
        conn.close()
    return None


@router.post("/read-all", status_code=204)
async def mark_all_read(user: CurrentUser = Depends(current_user)):
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(
                "UPDATE notifications SET read_at = NOW() "
                "WHERE user_id = %s AND user_role = %s AND read_at IS NULL",
                (user.id, user.role),
            )
            conn.commit()
    finally:
        conn.close()
    return None
