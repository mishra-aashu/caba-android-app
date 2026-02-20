# Frontend–DB Integration Audit Report

**Scope:** React frontend vs. `database_context.md` (RLS policies + foreign keys).  
**Date:** 2025-02-20.

---

## CRITICAL BLOCKERS

### 1. **Forward to group chat inserts invalid/forbidden rows**

**Location:** `src/components/chat/Chat.jsx` — `handleForwardMessages` (lines 992–1016).

**Issue:** When forwarding to a **group chat**, the code always sets `receiver_id: targetChat.otherUser.id` and **never** sets `is_group_message: true`. The DB `messages_insert_policy` requires:

- For group messages: `is_group_message = true` and the user must be in `group_members` for `messages.chat_id` (group id).
- For 1:1: `is_group_message = false` and chat in `chats` with user as participant.

So when the target is a group:

- `receiver_id` is set to a user id (or undefined if `otherUser` is group placeholder), which is wrong for group messages (should be `null`).
- `is_group_message` is omitted (defaults to false), so the row is treated as a 1:1 message and can fail RLS (e.g. chat_id not in `chats` for that user).

**Root cause:** No branch for `targetChat.isGroup`; forward payload is built as 1:1 only.

**Impact:** Forwards to groups can fail with RLS errors or insert incorrect data (wrong `receiver_id` / `is_group_message`).

---

### 2. **DataContext calls undefined `setChats` → runtime error**

**Location:** `src/contexts/DataContext.jsx` — `clearInMemoryCache` (lines 76–80).

**Issue:** `clearInMemoryCache` calls `setChats([])`, but `setChats` is **not** destructured from `useChatListRealtime`. Only `chats`, `loading`, `hasMoreChats`, `loadMoreChats`, `loadingMore` are taken from the hook. So `setChats` is undefined.

**Impact:** Any code that calls `clearInMemoryCache()` (e.g. logout, “clear cache” actions) will throw **ReferenceError** and can break the app or leave state inconsistent.

---

### 3. **Admin and other features rely on tables not in database_context**

**Locations:**

- **Admin.jsx:** `news_articles`, `media`, `statuses`, `media_transfers` (stats, tabs, loaders, maintenance).
- **News.jsx:** `statuses` for “recent statuses” and status list.
- **useWebRTCCalling.js:** `calls`, `webrtc_signals`.
- **useP2PTransfer.js:** `media`, `media_transfers`, `webrtc_signals`.
- **useAvatarUpload.js, useMediaUpload.js, useMediaDownload.js, useMediaViewer.js, useMediaCleanup.js, useStorageFallback.js:** `media`, `media_transfers`.
- **groupService.js:** `group-avatars` (storage/table).

**Issue:** `database_context.md` only documents RLS/FK for a fixed set of tables. It does **not** list:

- `news_articles`
- `media`
- `statuses`
- `media_transfers`
- `calls`
- `webrtc_signals`
- `group-avatars`

So either:

- These objects don’t exist in the DB → queries will fail (e.g. “relation does not exist”) and Admin/News/Media/P2P/Calls/Group avatars will break, or  
- They exist but are not in the doc → schema and RLS are undocumented and may not match what the frontend expects.

**Impact:** If the DB only matches the documented schema, opening Admin (and some tabs), News, media upload/download, P2P, WebRTC calls, or group avatar upload can fail and corrupt or block flows.

---

### 4. **Chat list depends on undocumented RPC/view**

**Location:** `src/hooks/useChatListRealtime.js` — `fetchChatList`.

**Issue:** Chat list is loaded in this order:

1. RPC `get_unified_chat_list(user_id)`
2. View `unified_chat_list`
3. View `chat_list_view`

None of these (RPC or views) are described in `database_context.md`, which only documents base tables and RLS. If the project DB does not have this RPC or these views, the first one or two options fail and the code falls back. If **all three** are missing, the entire chat list fetch fails and the user sees no chats.

**Impact:** Chat list can be empty or throw for all users if the DB was created only from the documented schema (tables + RLS/FK).

---

### 5. **Realtime chat list uses a column that may not exist on `messages`**

**Location:** `src/hooks/useChatListRealtime.js` — postgres_changes handler for `messages` INSERT (lines 273–284).

**Issue:** The handler uses `newMessage.sender_name` for the preview:

```js
const senderPrefix = newMessage.is_group_message && newMessage.sender_id !== currentUserId
  ? `${newMessage.sender_name || 'Someone'}: `
  : '';
```

`messages` in the DB has `sender_id`, not `sender_name`. Postgres change payloads typically contain only table columns, so `sender_name` will usually be `undefined` and the UI will show “Someone:” for group messages. If the DB or realtime config ever exposed a different shape, assumptions could break.

**Impact:** Wrong or misleading preview text in chat list for group messages; possible null/undefined issues if code elsewhere assumes `sender_name` on the payload.

---

### 6. **message_reads upsert may conflict with DB constraints**

**Location:** `src/services/messageReadsService.js` — `markAsRead` (lines 27–31).

**Issue:** Code uses:

```js
.upsert(rows, { onConflict: 'message_id,user_id', ignoreDuplicates: true })
```

`database_context.md` does not specify unique constraints. If the DB does **not** have a unique (or primary) constraint on `(message_id, user_id)` for `message_reads`, this upsert can throw (e.g. “no unique or exclusion constraint matching ON CONFLICT”).

**Impact:** Marking messages as read can fail in production, and read receipts will not persist.

---

## SCHEMA & LOGIC MISMATCHES

### 1. **Forward modal: group chats vs 1:1**

- **Frontend:** `handleForwardMessages` always sends `receiver_id: targetChat.otherUser.id` and omits `is_group_message`.
- **DB:** For group messages, `receiver_id` should be null and `is_group_message` true; RLS ties group inserts to `group_members` and `messages.chat_id` (group id).
- **Result:** Schema/RLS mismatch when target is a group; see Critical #1.

---

### 2. **Chat list realtime payload vs `messages` columns**

- **Frontend:** Expects `sender_name` on realtime `payload.new` for `messages`.
- **DB (from context):** `messages` has `sender_id`, not `sender_name`.
- **Result:** `sender_name` is undefined; preview falls back to “Someone” and is brittle if schema changes.

---

### 3. **Mark-as-read: two stores (messages vs message_reads)**

- **Frontend:** `Chat.jsx` `markMessagesAsRead` updates only `messages` (`is_read: true`, `status: 'read'`). `messageReadsService.markAsRead` writes both `message_reads` and `messages`.
- **DB:** `message_reads` is the proper store for read receipts; `messages.is_read` is legacy.
- **Result:** Inconsistent use of `messages.is_read` vs `message_reads`; some code paths may not insert `message_reads` at all, so read state can differ between UI and DB or between 1:1 and group.

---

### 4. **groups table: avatar vs avatar_url**

- **Frontend:** `dbSchemaCompatibility.js` allows both `avatar` and `avatar_url` for `groups`. Components (e.g. GroupInfoDrawer) use `avatar_url`.
- **DB (from context):** Only FKs are documented; column names are not. If the real table has only one of `avatar` or `avatar_url`, the other is wrong and can cause 404s or missing avatars.

---

### 5. **Reminders schema vs compatibility layer**

- **Frontend:** `dbSchemaCompatibility.js` and types list many reminder fields (e.g. `title`, `description`, `location`, `category`, `priority`, `status`, `accepted_at`, `completed_at`, `sound_enabled`, `vibration_enabled`, `is_recurring`, `recurring_type`, `requires_acceptance`, `snooze_until`, `snooze_count`).
- **DB (from context):** Only RLS/FK; no column list. If the real `reminders` table has fewer columns, inserts/updates with extra fields can fail or be ignored.

---

### 6. **users table: optional vs required fields**

- **Frontend:** Many components use `user.name`, `user.avatar`, `user.email`, `user.phone` without null checks.
- **DB (from context):** Not specified as NOT NULL. If any of these can be null, missing guards can cause UI crashes or “undefined” in labels.

---

## MISSING IMPLEMENTATIONS

### 1. **DB features with no or minimal UI**

- **login_history:** RLS allows insert and select own; only referenced in `adminVerification.js` for “admin tables”. No dedicated UI to view or manage login history.
- **session_tokens:** RLS allows CRUD for own sessions. No UI to list/revoke sessions (e.g. “sessions and devices” in settings).
- **user_activity_logs:** Insert/select own; used in `activityLogger.js`. No user-facing screen to view activity logs.
- **rate_limits:** RLS “No direct access” — correctly not used from client; no UI needed.
- **vanish_duration_presets:** Read by Chat for temp chat; no admin UI to manage presets (only admins can manage per RLS).
- **wallpapers / chat_wallpapers:** Chat themes context and DB support it; verify if full CRUD and listing are implemented in UI.
- **reports:** Admin and MemberItem insert reports; ensure full flow (list, status, admin_notes) exists for admins.
- **reminder_roles / reminder_logs:** DB supports them; confirm Reminders UI uses them for “trusted users” and logging.

---

### 2. **UI that does not complete the DB round-trip**

- **Chat list “Load more”:** `loadMoreChats` in `useChatListRealtime` only sets `loadingMore(true)` and never triggers a refetch or paginated fetch. So “Load more” does not actually load more chats (missing implementation).
- **clearInMemoryCache:** Calls `setChats([])` but `setChats` is not provided by the hook, so the call is broken (see Critical #2).

---

### 3. **Tables in DB context with no frontend usage**

- **chat_themes:** Used in `ChatThemeContext.jsx` (select/insert). Appears implemented.
- **temporary_chat_settings:** Used in Chat for vanish mode. Implemented.
- **user_call_settings:** Used in `callService.js`. Implemented.
- **call_signaling:** Used in call flow. Implemented.

(No critical “table exists in DB but never touched by frontend” gaps for the documented tables; the main gaps are the **undocumented** tables the frontend assumes.)

---

## REAL-TIME & SUBSCRIPTION HANDLING

### Correct patterns

- **realtimeManager:** Centralized `subscribe` / `unsubscribe` / `removeChannel`; cleanup on unmount and `beforeunload`.
- **useRealtimeMessages:** Unsubscribes in effect cleanup.
- **useChatListRealtime:** Single consolidated channel; cleanup with `realtimeManager.unsubscribe(channelName)`.
- **SupportChat, Reminders, useTruthDareGame, useMessageStatusUpdates, useRealtimeTyping, useScreenshotAlert:** Use realtimeManager or direct `supabase.removeChannel` in cleanup.
- **callService:** `unsubscribe(signalChannelRef.current)` in CallContext cleanup.
- **messageReadsService.subscribeToReadReceipts:** Returns `{ unsubscribe: () => supabase.removeChannel(channel) }` — caller must call it.

### Issues

1. **useGroupMessages:** Creates `supabase.channel(...)` directly and cleans up with `supabase.removeChannel(messagesChannel)`. Not registered with `realtimeManager`, so duplicate channels or leaks are possible if the same group is subscribed in multiple places. Hook is not used in `Chat.jsx` (Chat uses `useRealtimeMessages` for both 1:1 and groups), but if used elsewhere, consider routing through realtimeManager.
2. **messageReadsService:** Callers of `subscribeToReadReceipts` must call the returned `unsubscribe`. If a component forgets, the channel stays open (minor leak risk).
3. **UserDetails.jsx:** Uses `supabase.channel(\`user_status_${userId}\`)` and `supabase.removeChannel(subscription)` in cleanup — correct but outside realtimeManager; same consolidation note as above.

---

## LOADING & ERROR STATES (UX/UI)

### What’s in place

- **Chat:** Cache-first messages; `showLoading` only when no cache and fetch in flight; toasts on send failure; rollback of optimistic message on error.
- **App:** Suspense with loading spinner; top-level ErrorBoundary with “Try again” and optional dev details.
- **Admin:** Tab loading flags and CSS for loading overlays/skeletons.
- **DataContext / useChatListRealtime:** `loading` and `chatsLoading`; contacts error path clears list and logs.
- **Reminders, SupportChat, etc.:** Some try/catch and console.error; toasts in places.

### Gaps

1. **No global “DB error” feedback:** Many `catch` blocks only `console.error` or show a generic toast. No central “database error” handler or retry strategy.
2. **Chat list fetch failure:** If all three options (RPC, unified_chat_list, chat_list_view) fail, `fetchChatList` throws; React Query will show error state, but the UI may not show a clear “Could not load chats” message or retry.
3. **Contacts:** On error, contacts are set to `[]` and error is logged; user may see empty list with no explanation.
4. **Optimistic updates without rollback:** e.g. `handleSendMedia` has no optimistic message; only toast on error. Forward and some other actions don’t revert UI on failure.
5. **Error boundary and DB errors:** ErrorBoundary catches render errors; failed promises (e.g. Supabase errors in async handlers) are not caught unless they lead to an unhandled rejection or a setState after unmount. Consider global unhandled-rejection handler or error reporting for DB failures.

---

## ACTION PLAN (PRIORITIZED)

### P0 – Fix immediately (blockers / data integrity)

1. **Forward to group:** In `handleForwardMessages`, detect group target (`targetChat.isGroup` or equivalent). For groups: set `receiver_id: null`, `is_group_message: true`, and ensure `chat_id` is the group id. For 1:1, keep current behavior. Add tests for forward-to-group.
2. **DataContext setChats:** Destructure `setChats` from `useChatListRealtime` and pass it into the context value so `clearInMemoryCache` can call `setChats([])`. Alternatively, expose a “clear chats” from the hook and call that from context.
3. **message_reads upsert:** Confirm in the real DB that `message_reads` has a unique (or primary) constraint on `(message_id, user_id)`. If not, add the constraint or change the frontend to use insert + on-conflict handling that matches the actual constraint (e.g. single-row insert with catch for duplicate).

### P1 – Align with database (schema and missing objects)

4. **Document or create missing DB objects:** Either add to `database_context.md` (and DB) the RPC `get_unified_chat_list`, views `unified_chat_list` and `chat_list_view`, and tables `media`, `media_transfers`, `statuses`, `news_articles`, `calls`, `webrtc_signals`, `group-avatars` (if they exist), or remove/guard frontend code that depends on them. Until then, Admin, News, media, P2P, WebRTC, and group avatars are at risk.
5. **Chat list realtime:** Stop relying on `sender_name` in messages payload. Either: (a) derive sender name from a follow-up fetch or from a join in a DB function that publishes a richer payload, or (b) always use “Someone” for group preview and document it.
6. **Mark-as-read consistency:** Prefer a single path: use `messageReadsService.markAsRead` / `markAllAsRead` everywhere and treat `message_reads` as source of truth; optionally keep `messages.is_read` in sync for legacy, or phase it out and update UI to use `message_reads` only.

### P2 – Missing features and UX

7. **Chat list “Load more”:** Implement pagination in `fetchChatList` (e.g. cursor/offset and a new param) and in `loadMoreChats` trigger a refetch with that param or use a separate query key so more chats are actually loaded.
8. **Sessions / login history (optional):** If product requires it, add a “Sessions & devices” (and optionally “Login history”) screen that reads from `session_tokens` and `login_history` with proper RLS.
9. **Loading and error UX:** For chat list, show an explicit “Could not load chats” and retry when all fetch options fail. For contacts, show a short message when load fails instead of only an empty list. Consider a small “DB error” toast or banner for critical failures.

### P3 – Hardening and consistency

10. **Realtime:** Route all Supabase realtime channels (including `useGroupMessages` and UserDetails status) through `realtimeManager` so cleanup and duplicate prevention are centralized.
11. **Schema documentation:** Extend `database_context.md` with column lists and nullability for main tables (users, messages, chats, groups, reminders, call_history, etc.) so frontend types and compatibility layers can be validated.
12. **Validation:** Use `validateEntity` / `validateAndSanitize` (or equivalent) before inserts/updates for critical tables (e.g. messages, reminders, reports) and handle validation errors in UI (toast or inline).

---

**End of report.** No code was changed; this document is analysis and recommendations only.
