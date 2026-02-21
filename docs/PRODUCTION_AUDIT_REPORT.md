# Production Audit Report — Full-Stack & Supabase

**Date:** 2025-02-22  
**Scope:** Frontend React codebase + Live Supabase backend  
**Mission:** Deep audit for ChatScreen received-message/race issues + system-wide production readiness.

---

## 1. Global Database Verification (MCP)

### 1.1 Realtime publication

| Table             | In `supabase_realtime`? | Notes |
|------------------|-------------------------|--------|
| **messages**     | Yes                     | OK — chat messages live. |
| **user_themes**  | Yes                     | OK. |
| **call_history** | Yes                     | OK. |
| **call_signaling** | Yes                  | OK. |
| **game_invitations** | Yes                | OK. |
| **chats**        | No                      | Chat list does not get live row updates when `last_message` / `last_message_time` change (trigger updates). |
| **users**        | No                      | Online status in chat list (users UPDATE) will not fire. |
| **groups**       | No                      | Group list/name changes not pushed. |
| **group_members**| No                      | Membership changes not pushed. |
| **message_reads**| No                      | Read receipts not pushed (if you add later). |

**Action:** Add `chats` (and optionally `users`) to the realtime publication for production (see SQL below).

### 1.2 RLS — Critical / over-permissive

- **blocked_users:** `Users can view blocks` has `qual: true` → any authenticated user can list all blocks. Prefer restricting to `blocker_id = auth.uid()`.
- **group_members:** `Users can manage group members` has `qual: true` → any user can INSERT/UPDATE/DELETE any group membership. **Critical:** restrict to members (or admins) of that group.
- **reports:** `Users can view reports` has `qual: true` → any user can see all reports. Restrict to own report or admin-only.
- **reminder_logs:** `Anyone can create logs` with `with_check: true` → anyone can insert any reminder_log. Restrict to reminder participant or service.
- **session_tokens:** `Anyone can create sessions` with `with_check: true` → anyone can insert sessions for any user. Restrict to `user_id = auth.uid()`.

**Action:** Tighten these policies (see SQL section).

### 1.3 Indexes

- **messages:** `chat_id`, `created_at DESC`, `sender_id`, `receiver_id`, partial indexes for vanish/unlock/group — **OK**.
- **chats:** `user1_id`, `user2_id`, `last_message_time DESC`, unique (user1_id, user2_id) — **OK**.
- **call_signaling:** `call_id`, `to_user_id`, `expires_at`, `created_at DESC` — **OK**.
- **message_reads:** `message_id`, `user_id`, unique (message_id, user_id) — **OK**.

No critical indexes missing for the audited flows.

### 1.4 Triggers

- **messages:** `trigger_update_chat_metadata` (AFTER INSERT) updates `chats` — **OK**.
- **chats:** No `updated_at` trigger; column exists but only set on explicit UPDATE — acceptable.
- **message_reads:** `on_message_read_inserted` — **OK**.

---

## 2. Frontend vs DB Cross-Reference

### 2.1 State & race conditions

| Location | Issue | Severity |
|----------|--------|----------|
| **Chat.jsx `fetchFreshMessages`** | When the initial (or refetch) messages request completes, it does `setMessages(prev => [...freshMessages, ...pendingOptimistic])`. Messages that arrived only via **realtime** (e.g. other user’s message) and are not yet in `freshMessages` are **dropped**, because they are not in `dbIds` and don’t have `tempId`. | **CRITICAL** — root cause of “received messages not saving to UI”. |
| **Chat.jsx `handleNewMessage`** | Replacing temp message uses `msg.created_at === newMessage.created_at`. DB uses ISO strings; optimistic may differ → match can fail and duplicate or wrong replace. | **MEDIUM** — prefer matching by `tempId` / server `id` only. |
| **useRealtimeMessages** | Effect depends on `onNewMessage`, `onUpdateMessage`, `onDeleteMessage`. New function references each render → unsubscribe/resubscribe thrash and possible duplicate or missed events. | **MEDIUM** — use refs for handlers. |
| **IncomingCallProvider** | `setupIncomingCallListener()` returns a cleanup (`() => supabase.removeChannel(channel)`), but the effect does **not** return it, so cleanup never runs → **channel leak** and duplicate listeners on re-mount. | **CRITICAL** (leak). |
| **useChatListRealtime** | Subscribes to `chats` and `users` postgres_changes, but **chats** and **users** are not in the realtime publication, so those handlers never run. Only `messages` INSERT drives list updates. | **ARCHITECTURE** — works for new messages; chat row updates (e.g. clear chat) not live until `chats` is in publication. |

### 2.2 Subscription lifecycle

| Subscription | Cleanup | Notes |
|--------------|---------|--------|
| realtimeManager (Chat, useRealtimeMessages, useChatListRealtime, etc.) | Yes — `unsubscribe(channelName)` in effect return | OK. |
| UserDetails.jsx `user_status_${userId}` | Yes — `removeChannel` in return | OK. |
| messageReadsService read_receipts | Yes — removeChannel in cleanup | OK. |
| useChatMessages.js `messages:chat_id=eq.${chatId}` | Yes | OK (hook not used by Chat.jsx; used elsewhere). |
| useMessageStatus.js `message_status:${chatId}` | Yes | OK. |
| useMessageStatus.js `read_receipts_disabled:${chatId}` | Yes | Empty channel; harmless. |
| useGroupMessages.js `group_messages_${groupId}` | Yes | OK. |
| useTypingIndicator.js `typing:${chatId}:${currentUserId}` | Yes | OK (table `typing_indicators` may not exist — broadcast uses `.track()`; verify). |
| callService.js signals/calls | Yes — single `unsubscribe(channel)` | OK if caller keeps ref and calls unsubscribe. |
| useWebRTCCalling / useP2PTransfer | Yes | OK. |
| **IncomingCallProvider** `global-incoming-calls` | **No** — effect does not return cleanup | **Fix:** return cleanup from effect. |

### 2.3 Missing / wrong DB usage in UI

- **vanish_duration_presets:** UI uses `preset.preset_name`; table has `name` and `display_name` only → labels show `undefined`. **Fix:** use `preset.display_name || preset.name`.
- **temporary_chat_settings upsert:** Uses `onConflict: 'chat_id,user_id'`; constraint is `temporary_chat_settings_chat_user_unique` on (chat_id, user_id) — **valid**.
- **message_reads:** Table exists and is used by `messageReadsService`; Chat.jsx uses `messageReadsService.markAllAsRead`. useMessageStatus still has “message_reads not implemented” and a no-op channel — legacy; can be cleaned up later.

### 2.4 Error handling & UX

- Chat.jsx: Optimistic send + rollback on insert error — **OK**. No global offline/retry yet.
- Loading: Cache-then-fetch and `showLoading` only when no cache — **OK**.
- No central connection/retry or “reconnect” UI observed; consider adding for production.

---

## 3. Production-Readiness Gaps

- **Message deduplication:** Partially done (processedMessageIds in useRealtimeMessages, and id check in handleNewMessage). Merge in fetchFreshMessages must also preserve realtime-only messages and sort by `created_at`.
- **Chat list live updates:** Depends on `messages` INSERT only; add `chats` (and optionally `users`) to realtime for full consistency.
- **Subscription leaks:** IncomingCallProvider must return cleanup.
- **Stale handler refs:** useRealtimeMessages should use refs for callbacks to avoid resubscribe thrash and races.
- **Global unread:** DataContext/useChatListRealtime already update per-chat unread on message INSERT; no separate “global unread” store observed — acceptable if not required.

---

## 4. Summary: Critical, Flaws, Missing

### CRITICAL BLOCKERS

1. **Chat.jsx:** Background fetch overwrites state and drops messages that arrived only via realtime. **Fix:** When merging after fetch, keep messages that are in `prev`, have a real `id`, and are not in `freshMessages` (realtime-only), then sort by `created_at`.
2. **IncomingCallProvider:** Effect does not return cleanup → channel leak and duplicate listeners. **Fix:** Return the cleanup from the effect (e.g. return result of `setupIncomingCallListener()`).

### ARCHITECTURE FLAWS

3. **Realtime publication:** `chats` (and optionally `users`) not in `supabase_realtime` → chat list and online status not fully live.
4. **useRealtimeMessages:** Handler identity in deps causes unnecessary resubscribe; use refs for handlers.
5. **RLS:** group_members (and others above) overly permissive; tighten for production.

### MISSING PRODUCTION FEATURES

6. **Vanish presets UI:** Use `display_name` or `name` from DB, not `preset_name`.
7. **Optional:** Add `chats` (and `users`) to realtime; connection retry / offline indicator; global unread store if product needs it.

---

## 5. Delivered Artifacts

- **This report:** `docs/PRODUCTION_AUDIT_REPORT.md`
- **Code fixes:** Chat.jsx (merge + sort), useRealtimeMessages (handler refs), IncomingCallProvider (cleanup), Chat.jsx vanish preset label.
- **SQL:** Add `chats` (and optionally `users`) to realtime; optional RLS tightening (see migration file).

All code changes are in the repo. **Applied via MCP:** `add_chats_to_realtime_and_optional_rls` (adds `chats` to `supabase_realtime`). Optional RLS tightening and `users` in realtime are in the SQL section below; apply manually if desired.

### 5.1 Optional SQL (apply manually if needed)

**Add users to realtime (for live online status in chat list):**
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
```

**Tighten RLS (review before applying):**
- Restrict `blocked_users` SELECT to `blocker_id = auth.uid()`.
- Restrict `group_members` to members/admins of the group (e.g. EXISTS in group_members for that group).
- Restrict `reports` SELECT to reporter or admin.
- Restrict `reminder_logs` INSERT to reminder participant.
- Restrict `session_tokens` INSERT to `user_id = auth.uid()`.
