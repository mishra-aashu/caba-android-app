# Supabase Database Context (Schema, Policies, and Relations)

## 1. Foreign Key Relationships (Table Connectivity)

| Table Name | Column Name | Foreign Table | Foreign Column | Constraint Name |
| :--- | :--- | :--- | :--- | :--- |
| **admin_logs** | `admin_id` | `users` | `id` | `admin_logs_admin_id_fkey` |
| **admin_logs** | `target_user_id` | `users` | `id` | `admin_logs_target_user_id_fkey` |
| **blocked_users** | `blocker_id` | `users` | `id` | `blocked_users_blocker_id_fkey` |
| **blocked_users** | `blocked_id` | `users` | `id` | `blocked_users_blocked_id_fkey` |
| **call_history** | `caller_id` | `users` | `id` | `call_history_caller_id_fkey` |
| **call_history** | `receiver_id` | `users` | `id` | `call_history_receiver_id_fkey` |
| **call_signaling** | `from_user_id` | `users` | `id` | `call_signaling_from_user_id_fkey` |
| **call_signaling** | `to_user_id` | `users` | `id` | `call_signaling_to_user_id_fkey` |
| **chat_themes** | `chat_id` | `chats` | `id` | `chat_themes_chat_id_fkey` |
| **chat_themes** | `set_by` | `users` | `id` | `chat_themes_set_by_fkey` |
| **chat_wallpapers** | `chat_id` | `chats` | `id` | `chat_wallpapers_chat_id_fkey` |
| **chat_wallpapers** | `wallpaper_id` | `wallpapers` | `id` | `chat_wallpapers_wallpaper_id_fkey` |
| **chat_wallpapers** | `set_by` | `users` | `id` | `chat_wallpapers_set_by_fkey` |
| **chats** | `user1_id` | `users` | `id` | `chats_user1_id_fkey` |
| **chats** | `user2_id` | `users` | `id` | `chats_user2_id_fkey` |
| **contacts** | `contact_user_id` | `users` | `id` | `contacts_contact_user_id_fkey` |
| **contacts** | `user_id` | `users` | `id` | `contacts_user_id_fkey` |
| **game_invitations** | `chat_id` | `chats` | `id` | `game_invitations_chat_id_fkey` |
| **game_invitations** | `receiver_id` | `users` | `id` | `game_invitations_receiver_id_fkey` |
| **game_invitations** | `sender_id` | `users` | `id` | `game_invitations_sender_id_fkey` |
| **group_members** | `group_id` | `groups` | `id` | `group_members_group_id_fkey` |
| **group_members** | `user_id` | `users` | `id` | `group_members_user_id_fkey` |
| **groups** | `created_by` | `users` | `id` | `groups_created_by_fkey` |
| **login_history** | `user_id` | `users` | `id` | `login_history_user_id_fkey` |
| **messages** | `chat_id` | `chats` | `id` | `messages_chat_id_fkey` |
| **messages** | `receiver_id` | `users` | `id` | `messages_receiver_id_fkey` |
| **messages** | `reply_to` | `messages` | `id` | `messages_reply_to_fkey` |
| **messages** | `sender_id` | `users` | `id` | `messages_sender_id_fkey` |
| **reminder_logs** | `reminder_id` | `reminders` | `id` | `reminder_logs_reminder_id_fkey` |
| **reminder_logs** | `user_id` | `users` | `id` | `reminder_logs_user_id_fkey` |
| **reminder_roles** | `trusted_user_id` | `users` | `id` | `reminder_roles_trusted_user_id_fkey` |
| **reminder_roles** | `user_id` | `users` | `id` | `reminder_roles_user_id_fkey` |
| **reminders** | `receiver_id` | `users` | `id` | `reminders_receiver_id_fkey` |
| **reminders** | `sender_id` | `users` | `id` | `reminders_sender_id_fkey` |
| **reports** | `reported_id` | `users` | `id` | `reports_reported_id_fkey` |
| **reports** | `reporter_id` | `users` | `id` | `reports_reporter_id_fkey` |
| **session_tokens** | `user_id` | `users` | `id` | `session_tokens_user_id_fkey` |
| **support_messages** | `responded_by` | `users` | `id` | `support_messages_responded_by_fkey` |
| **support_messages** | `user_id` | `users` | `id` | `support_messages_user_id_fkey` |
| **temporary_chat_settings** | `chat_id` | `chats` | `id` | `temporary_chat_settings_chat_id_fkey` |
| **temporary_chat_settings** | `user_id` | `users` | `id` | `temporary_chat_settings_user_id_fkey` |
| **user_activity_logs** | `user_id` | `users` | `id` | `user_activity_logs_user_id_fkey` |
| **user_call_settings** | `user_id` | `users` | `id` | `user_call_settings_user_id_fkey` |
| **user_themes** | `user_id` | `users` | `id` | `user_themes_user_id_fkey` |

---

## 2. Row Level Security (RLS) Policies

| Table Name | Policy Name | Operation | Roles | Condition (USING) | Check Condition (WITH CHECK) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **admin_logs** | Only admins can view admin logs | SELECT | `{public}` | `(EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.is_admin = true))))` | `null` |
| **admin_logs** | Only admins can insert admin logs | INSERT | `{public}` | `null` | `(EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.is_admin = true))))` |
| **blocked_users** | Users can view blocks | SELECT | `{public}` | `true` | `null` |
| **blocked_users** | Users can block | INSERT | `{public}` | `null` | `true` |
| **blocked_users** | Users can unblock | DELETE | `{public}` | `true` | `null` |
| **call_history** | Allow authenticated full access | ALL | `{authenticated}` | `true` | `true` |
| **call_history** | Allow anon read access | SELECT | `{anon}` | `true` | `null` |
| **call_history** | Users can view their own call history | SELECT | `{public}` | `((auth.uid() = caller_id) OR (auth.uid() = receiver_id))` | `null` |
| **call_history** | Users can create call records | INSERT | `{public}` | `null` | `(auth.uid() = caller_id)` |
| **call_history** | Users can update their call records | UPDATE | `{public}` | `((auth.uid() = caller_id) OR (auth.uid() = receiver_id))` | `null` |
| **call_signaling** | Authenticated users can send signals | INSERT | `{public}` | `null` | `(auth.role() = 'authenticated'::text)` |
| **call_signaling** | Authenticated users can view signals | SELECT | `{public}` | `(auth.role() = 'authenticated'::text)` | `null` |
| **call_signaling** | Authenticated users can update signals | UPDATE | `{public}` | `(auth.role() = 'authenticated'::text)` | `null` |
| **chat_themes** | Allow all access for authenticated users | ALL | `{public}` | `(auth.role() = 'authenticated'::text)` | `(auth.role() = 'authenticated'::text)` |
| **chat_wallpapers** | Users can set chat wallpapers | INSERT | `{public}` | `null` | `((EXISTS ( SELECT 1 FROM chats WHERE ((chats.id = chat_wallpapers.chat_id) AND ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid()))))) AND (auth.uid() = set_by))` |
| **chat_wallpapers** | Users can update chat wallpapers | UPDATE | `{public}` | `(EXISTS ( SELECT 1 FROM chats WHERE ((chats.id = chat_wallpapers.chat_id) AND ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid())))))` | `null` |
| **chat_wallpapers** | Users can delete chat wallpapers | DELETE | `{public}` | `(EXISTS ( SELECT 1 FROM chats WHERE ((chats.id = chat_wallpapers.chat_id) AND ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid())))))` | `null` |
| **chat_wallpapers** | Users can view chat wallpapers | SELECT | `{public}` | `(EXISTS ( SELECT 1 FROM chats WHERE ((chats.id = chat_wallpapers.chat_id) AND ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid())))))` | `null` |
| **chats** | Users can view own chats | SELECT | `{public}` | `((auth.uid() = user1_id) OR (auth.uid() = user2_id))` | `null` |
| **chats** | Users can update own chats | UPDATE | `{public}` | `((auth.uid() = user1_id) OR (auth.uid() = user2_id))` | `null` |
| **chats** | Users can delete own chats | DELETE | `{public}` | `((auth.uid() = user1_id) OR (auth.uid() = user2_id))` | `null` |
| **chats** | Allow authenticated users to insert chats | INSERT | `{public}` | `null` | `((auth.uid() = user1_id) OR (auth.uid() = user2_id))` |
| **chats** | Allow users to read their chats | SELECT | `{public}` | `((auth.uid() = user1_id) OR (auth.uid() = user2_id))` | `null` |
| **chats** | Allow users to update their chats | UPDATE | `{public}` | `((auth.uid() = user1_id) OR (auth.uid() = user2_id))` | `((auth.uid() = user1_id) OR (auth.uid() = user2_id))` |
| **chats** | chats_read_policy | SELECT | `{public}` | `(((auth.uid())::text = (user1_id)::text) OR ((auth.uid())::text = (user2_id)::text))` | `null` |
| **chats** | chats_insert_policy | INSERT | `{public}` | `null` | `(((auth.uid())::text = (user1_id)::text) OR ((auth.uid())::text = (user2_id)::text))` |
| **contacts** | Users can manage OWN contacts | ALL | `{public}` | `(auth.uid() = user_id)` | `null` |
| **game_invitations** | Users can read game invitations for their chats | SELECT | `{authenticated}` | `(chat_id IN ( SELECT chats.id FROM chats WHERE ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid()))))` | `null` |
| **game_invitations** | Users can insert game invitations for their chats | INSERT | `{authenticated}` | `null` | `((chat_id IN ( SELECT chats.id FROM chats WHERE ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid())))) AND (sender_id = auth.uid()))` |
| **game_invitations** | Users can update game invitations they created | UPDATE | `{authenticated}` | `(sender_id = auth.uid())` | `(sender_id = auth.uid())` |
| **game_invitations** | Users can delete game invitations they created | DELETE | `{authenticated}` | `(sender_id = auth.uid())` | `null` |
| **group_members** | Users can view group members | SELECT | `{public}` | `true` | `null` |
| **group_members** | Users can manage group members | ALL | `{public}` | `true` | `null` |
| **group_members** | gmem_view_all | SELECT | `{public}` | `(auth.uid() IS NOT NULL)` | `null` |
| **group_members** | gmem_insert_all | INSERT | `{public}` | `null` | `(auth.uid() IS NOT NULL)` |
| **group_members** | gmem_update_all | UPDATE | `{public}` | `(auth.uid() IS NOT NULL)` | `null` |
| **group_members** | gmem_delete_all | DELETE | `{public}` | `(auth.uid() IS NOT NULL)` | `null` |
| **groups** | Users can view groups | SELECT | `{public}` | `true` | `null` |
| **groups** | grp_view_all | SELECT | `{public}` | `(auth.uid() IS NOT NULL)` | `null` |
| **groups** | grp_insert_all | INSERT | `{public}` | `null` | `(auth.uid() IS NOT NULL)` |
| **groups** | grp_update_all | UPDATE | `{public}` | `(auth.uid() IS NOT NULL)` | `null` |
| **groups** | grp_delete_all | DELETE | `{public}` | `(auth.uid() IS NOT NULL)` | `null` |
| **login_history** | Anyone can create login history | INSERT | `{public}` | `null` | `true` |
| **login_history** | lhist_view_own | SELECT | `{public}` | `(auth.uid() = user_id)` | `null` |
| **login_history** | lhist_insert_own | INSERT | `{public}` | `null` | `(auth.uid() = user_id)` |
| **messages** | Users can view messages in their chats | SELECT | `{public}` | `((auth.uid() = sender_id) OR (auth.uid() = receiver_id))` | `null` |
| **messages** | Users can send messages | INSERT | `{public}` | `null` | `(auth.uid() = sender_id)` |
| **messages** | Users can update own messages | UPDATE | `{public}` | `(auth.uid() = sender_id)` | `null` |
| **messages** | Users can delete own messages | DELETE | `{public}` | `(auth.uid() = sender_id)` | `null` |
| **messages** | Allow authenticated users to insert messages | INSERT | `{public}` | `null` | `(auth.uid() = sender_id)` |
| **messages** | Allow users to read their messages | SELECT | `{public}` | `((auth.uid() = sender_id) OR (auth.uid() IN ( SELECT chats.user1_id FROM chats WHERE (chats.id = messages.chat_id))) OR (auth.uid() IN ( SELECT chats.user2_id FROM chats WHERE (chats.id = messages.chat_id))))` | `null` |
| **messages** | Allow users to update their messages | UPDATE | `{public}` | `(auth.uid() = sender_id)` | `(auth.uid() = sender_id)` |
| **messages** | messages_read_policy | SELECT | `{public}` | `((auth.uid() = sender_id) OR (auth.uid() = receiver_id))` | `null` |
| **messages** | messages_insert_policy | INSERT | `{public}` | `null` | `(auth.uid() = sender_id)` |
| **messages** | messages_update_policy | UPDATE | `{public}` | `(auth.uid() = sender_id)` | `(auth.uid() = sender_id)` |
| **messages** | messages_delete_policy | DELETE | `{public}` | `(auth.uid() = sender_id)` | `null` |
| **rate_limits** | No direct access | ALL | `{public}` | `false` | `null` |
| **reminder_logs** | Users can view logs | SELECT | `{public}` | `true` | `null` |
| **reminder_logs** | Anyone can create logs | INSERT | `{public}` | `null` | `true` |
| **reminder_roles** | Users can view their roles | SELECT | `{public}` | `((auth.uid() = user_id) OR (auth.uid() = trusted_user_id))` | `null` |
| **reminder_roles** | Users can manage their roles | ALL | `{public}` | `(auth.uid() = user_id)` | `null` |
| **reminders** | Users can view their reminders | SELECT | `{public}` | `((auth.uid() = sender_id) OR (auth.uid() = receiver_id))` | `null` |
| **reminders** | Users can create reminders | INSERT | `{public}` | `null` | `(auth.uid() = sender_id)` |
| **reminders** | Users can update their reminders | UPDATE | `{public}` | `((auth.uid() = sender_id) OR (auth.uid() = receiver_id))` | `null` |
| **reminders** | Users can delete their reminders | DELETE | `{public}` | `(auth.uid() = sender_id)` | `null` |
| **reports** | Users can create reports | INSERT | `{public}` | `null` | `true` |
| **reports** | Users can view reports | SELECT | `{public}` | `true` | `null` |
| **session_tokens** | Anyone can create sessions | INSERT | `{public}` | `null` | `true` |
| **session_tokens** | stkn_view_own | SELECT | `{public}` | `(auth.uid() = user_id)` | `null` |
| **session_tokens** | stkn_insert_own | INSERT | `{public}` | `null` | `(auth.uid() = user_id)` |
| **session_tokens** | stkn_update_own | UPDATE | `{public}` | `(auth.uid() = user_id)` | `null` |
| **session_tokens** | stkn_delete_own | DELETE | `{public}` | `(auth.uid() = user_id)` | `null` |
| **support_messages** | Users can send support messages | INSERT | `{public}` | `null` | `((auth.uid() = user_id) AND (message_type = 'user'::text))` |
| **support_messages** | Users can view their own support messages | SELECT | `{public}` | `((auth.uid() = user_id) OR (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))))` | `null` |
| **support_messages** | Admins can respond to support messages | UPDATE | `{public}` | `(EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.is_admin = true))))` | `(EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.is_admin = true))))` |
| **support_messages** | Admins can delete support messages | DELETE | `{public}` | `(EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.is_admin = true))))` | `null` |
| **temporary_chat_settings** | Allow authenticated users to insert settings | INSERT | `{public}` | `null` | `(auth.uid() = user_id)` |
| **temporary_chat_settings** | Allow users to read their settings | SELECT | `{public}` | `(auth.uid() = user_id)` | `null` |
| **temporary_chat_settings** | Allow users to update their settings | UPDATE | `{public}` | `(auth.uid() = user_id)` | `(auth.uid() = user_id)` |
| **temporary_chat_settings** | Allow users to delete their settings | DELETE | `{public}` | `(auth.uid() = user_id)` | `null` |
| **temporary_chat_settings** | Users can view temp chat settings in their chats | SELECT | `{public}` | `((auth.uid() = user_id) OR ((is_enabled = true) AND (EXISTS ( SELECT 1 FROM chats WHERE ((chats.id = temporary_chat_settings.chat_id) AND ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid())))))))` | `null` |
| **temporary_chat_settings** | Users can insert their own temp chat settings | INSERT | `{public}` | `null` | `(auth.uid() = user_id)` |
| **temporary_chat_settings** | Users can update their own temp chat settings | UPDATE | `{public}` | `(auth.uid() = user_id)` | `(auth.uid() = user_id)` |
| **temporary_chat_settings** | Users can delete their own temp chat settings | DELETE | `{public}` | `(auth.uid() = user_id)` | `null` |
| **user_activity_logs** | Users can insert their own activity logs | INSERT | `{public}` | `null` | `(auth.uid() = user_id)` |
| **user_activity_logs** | Users can view their own activity logs | SELECT | `{public}` | `(auth.uid() = user_id)` | `null` |
| **user_call_settings** | Users can manage their call settings | ALL | `{public}` | `(auth.uid() = user_id)` | `null` |
| **users** | Users can delete their own profile | DELETE | `{public}` | `(auth.uid() = id)` | `null` |
| **users** | Anyone can view users | SELECT | `{public}` | `true` | `null` |
| **users** | Allow user creation during OAuth | INSERT | `{public}` | `null` | `true` |
| **users** | Allow service role to insert users | INSERT | `{public}` | `null` | `(auth.role() = 'service_role'::text)` |
| **users** | Users can update their own profile | UPDATE | `{public}` | `(auth.uid() = id)` | `null` |
| **users** | Allow trigger inserts | INSERT | `{public}` | `null` | `true` |
| **vanish_duration_presets** | Anyone can view vanish presets | SELECT | `{public}` | `true` | `null` |