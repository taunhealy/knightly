import { useState, useEffect } from 'react';
import type { PropertyMapItem } from '@/components/PropertyMap';
import type { ListingComment } from '@/components/search/CommentsModal';
import type { RecentListingComment } from '@/components/search/PropertyCard';

export interface UseListingCommentsOptions {
  userUid?: string;
  profileNickname?: string;
}

export function useListingComments({ userUid, profileNickname }: UseListingCommentsOptions) {
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [recentComments, setRecentComments] = useState<Record<string, RecentListingComment[]>>({});
  const [commentModalProp, setCommentModalProp] = useState<PropertyMapItem | null>(null);
  const [listingComments, setListingComments] = useState<ListingComment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [guestUid, setGuestUid] = useState<string>('');
  const [guestNickname, setGuestNickname] = useState<string>('');

  const activeCommentUid = userUid || guestUid;
  const activeCommentNickname = profileNickname || guestNickname;

  useEffect(() => {
    let uid = '';
    try {
      uid = localStorage.getItem('homeseek_guest_uid') || '';
      if (!uid) {
        uid = `guest-${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem('homeseek_guest_uid', uid);
      }
    } catch {
      uid = `guest-${Math.random().toString(36).slice(2, 10)}`;
    }
    setGuestUid(uid);

    const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    fetch(`${backendBase}/api/listings/comments/counts`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.counts) setCommentCounts(d.counts);
        if (d?.recent) {
          setRecentComments(d.recent);
        } else if (d?.latest) {
          const mapped: Record<string, RecentListingComment[]> = {};
          for (const [k, v] of Object.entries(d.latest)) {
            if (v) mapped[k] = [v as RecentListingComment];
          }
          setRecentComments(mapped);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeCommentUid || profileNickname) return;
    const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    fetch(`${backendBase}/api/listings/nickname/${encodeURIComponent(activeCommentUid)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.nickname) setGuestNickname(d.nickname);
      })
      .catch(() => {});
  }, [activeCommentUid, profileNickname]);

  const openCommentsModal = async (prop: PropertyMapItem) => {
    setCommentModalProp(prop);
    setCommentError(null);
    setNewCommentText('');
    setEditingCommentId(null);
    setIsLoadingComments(true);
    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${backendBase}/api/listings/${encodeURIComponent(prop.id)}/comments`);
      if (res.ok) {
        const data = await res.json();
        setListingComments(Array.isArray(data.comments) ? data.comments : []);
      }
    } catch {
      setCommentError('Failed to load comments.');
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handleCreateComment = async () => {
    if (!commentModalProp) return;
    const clean = newCommentText.trim();
    if (!clean) return;
    setIsPostingComment(true);
    setCommentError(null);
    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${backendBase}/api/listings/${encodeURIComponent(commentModalProp.id)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: activeCommentUid || 'guest', body: clean }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCommentError(data?.detail || 'Failed to post comment.');
        return;
      }
      if (data.comment) {
        setListingComments((prev) => [data.comment, ...prev]);
        setCommentCounts((prev) => ({
          ...prev,
          [commentModalProp.id]: (prev[commentModalProp.id] || 0) + 1,
        }));
        setRecentComments((prev) => {
          const nextItem: RecentListingComment = {
            id: data.comment.id,
            nickname: data.comment.nickname,
            body: data.comment.body,
            created_at: data.comment.created_at,
          };
          const existing = prev[commentModalProp.id] || [];
          return { ...prev, [commentModalProp.id]: [nextItem, ...existing].slice(0, 3) };
        });
        if (!activeCommentNickname && data.comment.nickname) {
          setGuestNickname(data.comment.nickname);
        }
        setNewCommentText('');
      }
    } catch {
      setCommentError('Network error posting comment.');
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleUpdateComment = async (commentId: string) => {
    const clean = editingCommentText.trim();
    if (!clean) return;
    setCommentError(null);
    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${backendBase}/api/listings/comments/${encodeURIComponent(commentId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: activeCommentUid, body: clean }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCommentError(data?.detail || 'Could not update comment.');
        return;
      }
      if (data.comment) {
        setListingComments((prev) => prev.map((c) => (c.id === commentId ? data.comment : c)));
        if (commentModalProp) {
          setRecentComments((prev) => ({
            ...prev,
            [commentModalProp.id]: (prev[commentModalProp.id] || []).map((c) =>
              c.id === commentId ? { ...c, body: data.comment.body } : c
            ),
          }));
        }
        setEditingCommentId(null);
        setEditingCommentText('');
      }
    } catch {
      setCommentError('Network error updating comment.');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!commentModalProp) return;
    setCommentError(null);
    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(
        `${backendBase}/api/listings/comments/${encodeURIComponent(commentId)}?user_id=${encodeURIComponent(activeCommentUid)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCommentError(data?.detail || 'Could not delete comment.');
        return;
      }
      const remaining = listingComments.filter((c) => c.id !== commentId);
      setListingComments(remaining);
      setCommentCounts((prev) => {
        const next = Math.max(0, (prev[commentModalProp.id] || 1) - 1);
        return { ...prev, [commentModalProp.id]: next };
      });
      setRecentComments((prev) => {
        const next = { ...prev };
        if (remaining.length > 0) {
          next[commentModalProp.id] = remaining.slice(0, 3).map((c) => ({
            id: c.id,
            nickname: c.nickname,
            body: c.body,
            created_at: c.created_at,
          }));
        } else {
          delete next[commentModalProp.id];
        }
        return next;
      });
    } catch {
      setCommentError('Network error deleting comment.');
    }
  };

  return {
    commentCounts,
    recentComments,
    commentModalProp,
    setCommentModalProp,
    listingComments,
    isLoadingComments,
    newCommentText,
    setNewCommentText,
    isPostingComment,
    editingCommentId,
    setEditingCommentId,
    editingCommentText,
    setEditingCommentText,
    commentError,
    activeCommentUid,
    activeCommentNickname,
    openCommentsModal,
    handleCreateComment,
    handleUpdateComment,
    handleDeleteComment,
  };
}
