# Database Context

## 1. RLS Policies (Format 1)

| tablename | policyname | cmd | roles | qual | with_check |
| :--- | :--- | :--- | :--- | :--- | :--- |
| users | Allow service role to insert users | INSERT | {public} | null | (auth.role() = 'service_role'::text) |
| users | Allow trigger inserts | INSERT | {public} | null | true |
| users | Allow user creation during OAuth | INSERT | {public} | null | true |
| users | Anyone can view users | SELECT | {public} | true | null |
| users | Users can delete their own profile | DELETE | {public} | (auth.uid() = id) | null |
| users | Users can update their own profile | UPDATE | {public} | (auth.uid() = id) | null |
| blocked_users | Users can block | INSERT | {public} | null | true |
| blocked_users | Users can unblock | DELETE | {public} | true | null |
| blocked_users | Users can view blocks | SELECT | {public} | true | null |
| chats | Allow authenticated users to insert chats | INSERT | {public} | null | ((auth.uid() = user1_id) OR (auth.uid() = user2_id)) |
| chats | Allow users to read their chats | SELECT | {public} | ((auth.uid() = user1_id) OR (auth.uid() = user2_id)) | null |
| chats | Allow users to update their chats | UPDATE | {public} | ((auth.uid() = user1_id) OR (auth.uid() = user2_id)) | ((auth.uid() = user1_id) OR (auth.uid() = user2_id)) |
| chats | Users can delete own chats | DELETE | {public} | ((auth.uid() = user1_id) OR (auth.uid() = user2_id)) | null |
| chats | Users can update own chats | UPDATE | {public} | ((auth.uid() = user1_id) OR (auth.uid() = user2_id)) | null |
| chats | Users can view own chats | SELECT | {public} | ((auth.uid() = user1_id) OR (auth.uid() = user2_id)) | null |
| chats | chats_insert_policy | INSERT | {public} | null | (((auth.uid())::text = (user1_id)::text) OR ((auth.uid())::text = (user2_id)::text)) |
| chats | chats_read_policy | SELECT | {public} | (((auth.uid())::text = (user1_id)::text) OR ((auth.uid())::text = (user2_id)::text)) | null |
| reports | Users can create reports | INSERT | {public} | null | true |
| reports | Users can view reports | SELECT | {public} | true | null |
| rate_limits | No direct access | ALL | {public} | false | null |
| contacts | Users can manage OWN contacts | ALL | {public} | (auth.uid() = user_id) | null |
| groups | Users can view groups | SELECT | {public} | true | null |
| groups | grp_delete_all | DELETE | {public} | (auth.uid() IS NOT NULL) | null |
| groups | grp_insert_all | INSERT | {public} | null | (auth.uid() IS NOT NULL) |
| groups | grp_update_admin | UPDATE | {authenticated} | (EXISTS ( SELECT 1 FROM group_members WHERE ((group_members.group_id = groups.id) AND (group_members.user_id = auth.uid()) AND (group_members.role = ANY (ARRAY['admin'::text, 'creator'::text]))))) | (EXISTS ( SELECT 1 FROM group_members WHERE ((group_members.group_id = groups.id) AND (group_members.user_id = auth.uid()) AND (group_members.role = ANY (ARRAY['admin'::text, 'creator'::text]))))) |
| groups | grp_view_all | SELECT | {public} | (auth.uid() IS NOT NULL) | null |
| group_members | Users can manage group members | ALL | {public} | true | null |
| group_members | Users can view group members | SELECT | {public} | true | null |
| group_members | gmem_delete_all | DELETE | {public} | (auth.uid() IS NOT NULL) | null |
| group_members | gmem_insert_all | INSERT | {public} | null | (auth.uid() IS NOT NULL) |
| group_members | gmem_update_all | UPDATE | {public} | (auth.uid() IS NOT NULL) | null |
| group_members | gmem_view_all | SELECT | {public} | (auth.uid() IS NOT NULL) | null |
| login_history | Anyone can create login history | INSERT | {public} | null | true |
| login_history | Users can view their own login history | SELECT | {public} | (auth.uid() = user_id) | null |
| login_history | lhist_insert_own | INSERT | {public} | null | (auth.uid() = user_id) |
| login_history | lhist_view_own | SELECT | {public} | (auth.uid() = user_id) | null |
| call_history | Allow anon read access | SELECT | {anon} | true | null |
| call_history | Allow authenticated full access | ALL | {authenticated} | true | true |
| call_history | Users can create call records | INSERT | {public} | null | (auth.uid() = caller_id) |
| call_history | Users can update their call records | UPDATE | {public} | ((auth.uid() = caller_id) OR (auth.uid() = receiver_id)) | null |
| call_history | Users can view their own call history | SELECT | {public} | ((auth.uid() = caller_id) OR (auth.uid() = receiver_id)) | null |
| call_signaling | Authenticated users can send signals | INSERT | {public} | null | (auth.role() = 'authenticated'::text) |
| call_signaling | Authenticated users can update signals | UPDATE | {public} | (auth.role() = 'authenticated'::text) | null |
| call_signaling | Authenticated users can view signals | SELECT | {public} | (auth.role() = 'authenticated'::text) | null |
| user_call_settings | Users can manage their call settings | ALL | {public} | (auth.uid() = user_id) | null |
| support_messages | Admins can delete support messages | DELETE | {public} | (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))) | null |
| support_messages | Admins can respond to support messages | UPDATE | {public} | (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))) | (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))) |
| support_messages | Users can send support messages | INSERT | {public} | null | ((auth.uid() = user_id) AND (message_type = 'user'::text)) |
| support_messages | Users can view their own support messages | SELECT | {public} | ((auth.uid() = user_id) OR (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.is_admin = true))))) | null |
| message_reads | Users can delete their own message reads | DELETE | {public} | (auth.uid() = user_id) | null |
| message_reads | Users can insert their own message reads | INSERT | {public} | null | (auth.uid() = user_id) |
| message_reads | Users can update their own message reads | UPDATE | {public} | (auth.uid() = user_id) | null |
| message_reads | Users can view their own message reads | SELECT | {public} | (auth.uid() = user_id) | null |
| session_tokens | Anyone can create sessions | INSERT | {public} | null | true |
| session_tokens | Users can manage their own sessions | ALL | {public} | (auth.uid() = user_id) | null |
| session_tokens | Users can view their own sessions | SELECT | {public} | (auth.uid() = user_id) | null |
| session_tokens | stkn_delete_own | DELETE | {public} | (auth.uid() = user_id) | null |
| session_tokens | stkn_insert_own | INSERT | {public} | null | (auth.uid() = user_id) |
| session_tokens | stkn_update_own | UPDATE | {public} | (auth.uid() = user_id) | null |
| session_tokens | stkn_view_own | SELECT | {public} | (auth.uid() = user_id) | null |
| game_invitations | Users can create game invitations for their chats | INSERT | {public} | null | ((chat_id IN ( SELECT chats.id FROM chats WHERE ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid())))) AND (sender_id = auth.uid())) |
| game_invitations | Users can delete game invitations they created | DELETE | {public} | (sender_id = auth.uid()) | null |
| game_invitations | Users can insert game invitations for their chats | INSERT | {authenticated} | null | ((chat_id IN ( SELECT chats.id FROM chats WHERE ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid())))) AND (sender_id = auth.uid())) |
| game_invitations | Users can read game invitations for their chats | SELECT | {public} | (chat_id IN ( SELECT chats.id FROM chats WHERE ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid())))) | null |
| game_invitations | Users can update game invitations they created | UPDATE | {public} | (sender_id = auth.uid()) | null |
| user_activity_logs | Users can insert their own activity logs | INSERT | {public} | null | (auth.uid() = user_id) |
| user_activity_logs | Users can view their own activity logs | SELECT | {public} | (auth.uid() = user_id) | null |
| messages | Allow users to update their messages | UPDATE | {public} | (auth.uid() = sender_id) | (auth.uid() = sender_id) |
| messages | Users can delete own messages | DELETE | {public} | (auth.uid() = sender_id) | null |
| messages | Users can update own messages | UPDATE | {public} | (auth.uid() = sender_id) | null |
| messages | messages_delete_policy | DELETE | {public} | (auth.uid() = sender_id) | null |
| messages | messages_insert_policy | INSERT | {authenticated} | null | ((sender_id = auth.uid()) AND (((is_group_message = true) AND (EXISTS ( SELECT 1 FROM group_members WHERE ((group_members.group_id = messages.chat_id) AND (group_members.user_id = auth.uid()))))) OR (is_group_message = false))) |
| messages | messages_read_policy | SELECT | {authenticated} | ((sender_id = auth.uid()) OR ((is_group_message = true) AND (EXISTS ( SELECT 1 FROM group_members WHERE ((group_members.group_id = messages.chat_id) AND (group_members.user_id = auth.uid()))))) OR ((is_group_message = false) AND (EXISTS ( SELECT 1 FROM chats WHERE ((chats.id = messages.chat_id) AND ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid()))))))) | null |
| messages | messages_update_policy | UPDATE | {public} | (auth.uid() = sender_id) | (auth.uid() = sender_id) |
| chat_themes | Allow all access for authenticated users | ALL | {public} | (auth.role() = 'authenticated'::text) | (auth.role() = 'authenticated'::text) |
| chat_themes | Users can create chat themes they participate in | INSERT | {public} | null | ((auth.uid() = set_by) AND (EXISTS ( SELECT 1 FROM chats WHERE ((chats.id = chat_themes.chat_id) AND ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid())))))) |
| chat_themes | Users can view chat themes they participate in | SELECT | {public} | (EXISTS ( SELECT 1 FROM chats WHERE ((chats.id = chat_themes.chat_id) AND ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid()))))) | null |
| chat_wallpapers | Users can create chat wallpapers they participate in | INSERT | {public} | null | ((auth.uid() = set_by) AND (EXISTS ( SELECT 1 FROM chats WHERE ((chats.id = chat_wallpapers.chat_id) AND ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid())))))) |
| chat_wallpapers | Users can delete chat wallpapers | DELETE | {public} | (EXISTS ( SELECT 1 FROM chats WHERE ((chats.id = chat_wallpapers.chat_id) AND ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid()))))) | null |
| chat_wallpapers | Users can set chat wallpapers | INSERT | {public} | null | ((EXISTS ( SELECT 1 FROM chats WHERE ((chats.id = chat_wallpapers.chat_id) AND ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid()))))) AND (auth.uid() = set_by)) |
| chat_wallpapers | Users can update chat wallpapers | UPDATE | {public} | (EXISTS ( SELECT 1 FROM chats WHERE ((chats.id = chat_wallpapers.chat_id) AND ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid()))))) | null |
| chat_wallpapers | Users can view chat wallpapers | SELECT | {public} | (EXISTS ( SELECT 1 FROM chats WHERE ((chats.id = chat_wallpapers.chat_id) AND ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid()))))) | null |
| chat_wallpapers | Users can view chat wallpapers they participate in | SELECT | {public} | (EXISTS ( SELECT 1 FROM chats WHERE ((chats.id = chat_wallpapers.chat_id) AND ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid()))))) | null |
| wallpapers | Anyone can view wallpapers | SELECT | {public} | (is_active = true) | null |
| wallpapers | Only admins can manage wallpapers | ALL | {public} | (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))) | null |
| temporary_chat_settings | Allow authenticated users to insert settings | INSERT | {public} | null | (auth.uid() = user_id) |
| temporary_chat_settings | Allow users to delete their settings | DELETE | {public} | (auth.uid() = user_id) | null |
| temporary_chat_settings | Allow users to read their settings | SELECT | {public} | (auth.uid() = user_id) | null |
| temporary_chat_settings | Allow users to update their settings | UPDATE | {public} | (auth.uid() = user_id) | (auth.uid() = user_id) |
| temporary_chat_settings | Users can delete their own temp chat settings | DELETE | {public} | (auth.uid() = user_id) | null |
| temporary_chat_settings | Users can insert their own temp chat settings | INSERT | {public} | null | (auth.uid() = user_id) |
| temporary_chat_settings | Users can manage their own temp chat settings | ALL | {public} | (auth.uid() = user_id) | null |
| temporary_chat_settings | Users can update their own temp chat settings | UPDATE | {public} | (auth.uid() = user_id) | (auth.uid() = user_id) |
| temporary_chat_settings | Users can view temp chat settings in their chats | SELECT | {public} | ((auth.uid() = user_id) OR ((is_enabled = true) AND (EXISTS ( SELECT 1 FROM chats WHERE ((chats.id = temporary_chat_settings.chat_id) AND ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid()))))))) | null |
| temporary_chat_settings | Users can view temp settings in their chats | SELECT | {public} | ((is_enabled = true) AND (EXISTS ( SELECT 1 FROM chats WHERE ((chats.id = temporary_chat_settings.chat_id) AND ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid())))))) | null |
| temporary_chat_settings | Users can view their own temp chat settings | SELECT | {public} | (auth.uid() = user_id) | null |
| vanish_duration_presets | Anyone can view vanish presets | SELECT | {public} | true | null |
| vanish_duration_presets | Only admins can manage vanish presets | ALL | {public} | (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))) | null |
| admin_logs | Only admins can insert admin logs | INSERT | {public} | null | (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))) |
| admin_logs | Only admins can view admin logs | SELECT | {public} | (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))) | null |
| reminder_logs | Anyone can create logs | INSERT | {public} | null | true |
| reminder_logs | Anyone can create reminder logs | INSERT | {public} | null | true |
| reminder_logs | Users can view logs | SELECT | {public} | true | null |
| reminder_logs | Users can view logs for their reminders | SELECT | {public} | ((auth.uid() = user_id) OR (EXISTS ( SELECT 1 FROM reminders WHERE ((reminders.id = reminder_logs.reminder_id) AND (reminders.sender_id = auth.uid()))))) | null |
| reminder_roles | Users can manage their reminder roles | ALL | {public} | (auth.uid() = user_id) | null |
| reminder_roles | Users can manage their roles | ALL | {public} | (auth.uid() = user_id) | null |
| reminder_roles | Users can view their reminder roles | SELECT | {public} | ((auth.uid() = user_id) OR (auth.uid() = trusted_user_id)) | null |
| reminder_roles | Users can view their roles | SELECT | {public} | ((auth.uid() = user_id) OR (auth.uid() = trusted_user_id)) | null |
| reminders | Users can create reminders | INSERT | {public} | null | (auth.uid() = sender_id) |
| reminders | Users can delete their reminders | DELETE | {public} | (auth.uid() = sender_id) | null |
| reminders | Users can update their reminders | UPDATE | {public} | ((auth.uid() = sender_id) OR (auth.uid() = receiver_id)) | null |
| reminders | Users can view their reminders | SELECT | {public} | ((auth.uid() = sender_id) OR (auth.uid() = receiver_id)) | null |

---

## 2. RLS Policies (Format 2)

| schemaname | tablename | policyname | operation | roles | condition | check_condition |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| public | users | Allow service role to insert users | INSERT | {public} | null | (auth.role() = 'service_role'::text) |
| public | users | Allow trigger inserts | INSERT | {public} | null | true |
| public | users | Allow user creation during OAuth | INSERT | {public} | null | true |
| public | users | Anyone can view users | SELECT | {public} | true | null |
| public | users | Users can delete their own profile | DELETE | {public} | (auth.uid() = id) | null |
| public | users | Users can update their own profile | UPDATE | {public} | (auth.uid() = id) | null |
| public | blocked_users | Users can block | INSERT | {public} | null | true |
| public | blocked_users | Users can unblock | DELETE | {public} | true | null |
| public | blocked_users | Users can view blocks | SELECT | {public} | true | null |
| public | chats | Allow authenticated users to insert chats | INSERT | {public} | null | ((auth.uid() = user1_id) OR (auth.uid() = user2_id)) |
| public | chats | Allow users to read their chats | SELECT | {public} | ((auth.uid() = user1_id) OR (auth.uid() = user2_id)) | null |
| public | chats | Allow users to update their chats | UPDATE | {public} | ((auth.uid() = user1_id) OR (auth.uid() = user2_id)) | ((auth.uid() = user1_id) OR (auth.uid() = user2_id)) |
| public | chats | Users can delete own chats | DELETE | {public} | ((auth.uid() = user1_id) OR (auth.uid() = user2_id)) | null |
| public | chats | Users can update own chats | UPDATE | {public} | ((auth.uid() = user1_id) OR (auth.uid() = user2_id)) | null |
| public | chats | Users can view own chats | SELECT | {public} | ((auth.uid() = user1_id) OR (auth.uid() = user2_id)) | null |
| public | chats | chats_insert_policy | INSERT | {public} | null | (((auth.uid())::text = (user1_id)::text) OR ((auth.uid())::text = (user2_id)::text)) |
| public | chats | chats_read_policy | SELECT | {public} | (((auth.uid())::text = (user1_id)::text) OR ((auth.uid())::text = (user2_id)::text)) | null |
| public | reports | Users can create reports | INSERT | {public} | null | true |
| public | reports | Users can view reports | SELECT | {public} | true | null |
| public | rate_limits | No direct access | ALL | {public} | false | null |
| public | contacts | Users can manage OWN contacts | ALL | {public} | (auth.uid() = user_id) | null |
| public | groups | Users can view groups | SELECT | {public} | true | null |
| public | groups | grp_delete_all | DELETE | {public} | (auth.uid() IS NOT NULL) | null |
| public | groups | grp_insert_all | INSERT | {public} | null | (auth.uid() IS NOT NULL) |
| public | groups | grp_update_admin | UPDATE | {authenticated} | (EXISTS ( SELECT 1 FROM group_members WHERE ((group_members.group_id = groups.id) AND (group_members.user_id = auth.uid()) AND (group_members.role = ANY (ARRAY['admin'::text, 'creator'::text]))))) | (EXISTS ( SELECT 1 FROM group_members WHERE ((group_members.group_id = groups.id) AND (group_members.user_id = auth.uid()) AND (group_members.role = ANY (ARRAY['admin'::text, 'creator'::text]))))) |
| public | groups | grp_view_all | SELECT | {public} | (auth.uid() IS NOT NULL) | null |
| public | group_members | Users can manage group members | ALL | {public} | true | null |
| public | group_members | Users can view group members | SELECT | {public} | true | null |
| public | group_members | gmem_delete_all | DELETE | {public} | (auth.uid() IS NOT NULL) | null |
| public | group_members | gmem_insert_all | INSERT | {public} | null | (auth.uid() IS NOT NULL) |
| public | group_members | gmem_update_all | UPDATE | {public} | (auth.uid() IS NOT NULL) | null |
| public | group_members | gmem_view_all | SELECT | {public} | (auth.uid() IS NOT NULL) | null |
| public | login_history | Anyone can create login history | INSERT | {public} | null | true |
| public | login_history | Users can view their own login history | SELECT | {public} | (auth.uid() = user_id) | null |
| public | login_history | lhist_insert_own | INSERT | {public} | null | (auth.uid() = user_id) |
| public | login_history | lhist_view_own | SELECT | {public} | (auth.uid() = user_id) | null |
| public | call_history | Allow anon read access | SELECT | {anon} | true | null |
| public | call_history | Allow authenticated full access | ALL | {authenticated} | true | true |
| public | call_history | Users can create call records | INSERT | {public} | null | (auth.uid() = caller_id) |
| public | call_history | Users can update their call records | UPDATE | {public} | ((auth.uid() = caller_id) OR (auth.uid() = receiver_id)) | null |
| public | call_history | Users can view their own call history | SELECT | {public} | ((auth.uid() = caller_id) OR (auth.uid() = receiver_id)) | null |
| public | call_signaling | Authenticated users can send signals | INSERT | {public} | null | (auth.role() = 'authenticated'::text) |
| public | call_signaling | Authenticated users can update signals | UPDATE | {public} | (auth.role() = 'authenticated'::text) | null |
| public | call_signaling | Authenticated users can view signals | SELECT | {public} | (auth.role() = 'authenticated'::text) | null |
| public | user_call_settings | Users can manage their call settings | ALL | {public} | (auth.uid() = user_id) | null |
| public | support_messages | Admins can delete support messages | DELETE | {public} | (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))) | null |
| public | support_messages | Admins can respond to support messages | UPDATE | {public} | (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))) | (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))) |
| public | support_messages | Users can send support messages | INSERT | {public} | null | ((auth.uid() = user_id) AND (message_type = 'user'::text)) |
| public | support_messages | Users can view their own support messages | SELECT | {public} | ((auth.uid() = user_id) OR (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.is_admin = true))))) | null |
| public | message_reads | Users can delete their own message reads | DELETE | {public} | (auth.uid() = user_id) | null |
| public | message_reads | Users can insert their own message reads | INSERT | {public} | null | (auth.uid() = user_id) |
| public | message_reads | Users can update their own message reads | UPDATE | {public} | (auth.uid() = user_id) | null |
| public | message_reads | Users can view their own message reads | SELECT | {public} | (auth.uid() = user_id) | null |
| public | session_tokens | Anyone can create sessions | INSERT | {public} | null | true |
| public | session_tokens | Users can manage their own sessions | ALL | {public} | (auth.uid() = user_id) | null |
| public | session_tokens | Users can view their own sessions | SELECT | {public} | (auth.uid() = user_id) | null |
| public | session_tokens | stkn_delete_own | DELETE | {public} | (auth.uid() = user_id) | null |
| public | session_tokens | stkn_insert_own | INSERT | {public} | null | (auth.uid() = user_id) |
| public | session_tokens | stkn_update_own | UPDATE | {public} | (auth.uid() = user_id) | null |
| public | session_tokens | stkn_view_own | SELECT | {public} | (auth.uid() = user_id) | null |
| public | game_invitations | Users can create game invitations for their chats | INSERT | {public} | null | ((chat_id IN ( SELECT chats.id FROM chats WHERE ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid())))) AND (sender_id = auth.uid())) |
| public | game_invitations | Users can delete game invitations they created | DELETE | {public} | (sender_id = auth.uid()) | null |
| public | game_invitations | Users can insert game invitations for their chats | INSERT | {authenticated} | null | ((chat_id IN ( SELECT chats.id FROM chats WHERE ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid())))) AND (sender_id = auth.uid())) |
| public | game_invitations | Users can read game invitations for their chats | SELECT | {public} | (chat_id IN ( SELECT chats.id FROM chats WHERE ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid())))) | null |
| public | game_invitations | Users can update game invitations they created | UPDATE | {public} | (sender_id = auth.uid()) | null |
| public | user_activity_logs | Users can insert their own activity logs | INSERT | {public} | null | (auth.uid() = user_id) |
| public | user_activity_logs | Users can view their own activity logs | SELECT | {public} | (auth.uid() = user_id) | null |
| public | messages | Allow users to update their messages | UPDATE | {public} | (auth.uid() = sender_id) | (auth.uid() = sender_id) |
| public | messages | Users can delete own messages | DELETE | {public} | (auth.uid() = sender_id) | null |
| public | messages | Users can update own messages | UPDATE | {public} | (auth.uid() = sender_id) | null |
| public | messages | messages_delete_policy | DELETE | {public} | (auth.uid() = sender_id) | null |
| public | messages | messages_insert_policy | INSERT | {authenticated} | null | ((sender_id = auth.uid()) AND (((is_group_message = true) AND (EXISTS ( SELECT 1 FROM group_members WHERE ((group_members.group_id = messages.chat_id) AND (group_members.user_id = auth.uid()))))) OR (is_group_message = false))) |
| public | messages | messages_read_policy | SELECT | {authenticated} | ((sender_id = auth.uid()) OR ((is_group_message = true) AND (EXISTS ( SELECT 1 FROM group_members WHERE ((group_members.group_id = messages.chat_id) AND (group_members.user_id = auth.uid()))))) OR ((is_group_message = false) AND (EXISTS ( SELECT 1 FROM chats WHERE ((chats.id = messages.chat_id) AND ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid()))))))) | null |
| public | messages | messages_update_policy | UPDATE | {public} | (auth.uid() = sender_id) | (auth.uid() = sender_id) |
| public | chat_themes | Allow all access for authenticated users | ALL | {public} | (auth.role() = 'authenticated'::text) | (auth.role() = 'authenticated'::text) |
| public | chat_themes | Users can create chat themes they participate in | INSERT | {public} | null | ((auth.uid() = set_by) AND (EXISTS ( SELECT 1 FROM chats WHERE ((chats.id = chat_themes.chat_id) AND ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid())))))) |
| public | chat_themes | Users can view chat themes they participate in | SELECT | {public} | (EXISTS ( SELECT 1 FROM chats WHERE ((chats.id = chat_themes.chat_id) AND ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid()))))) | null |
| public | chat_wallpapers | Users can create chat wallpapers they participate in | INSERT | {public} | null | ((auth.uid() = set_by) AND (EXISTS ( SELECT 1 FROM chats WHERE ((chats.id = chat_wallpapers.chat_id) AND ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid())))))) |
| public | chat_wallpapers | Users can delete chat wallpapers | DELETE | {public} | (EXISTS ( SELECT 1 FROM chats WHERE ((chats.id = chat_wallpapers.chat_id) AND ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid()))))) | null |
| public | chat_wallpapers | Users can set chat wallpapers | INSERT | {public} | null | ((EXISTS ( SELECT 1 FROM chats WHERE ((chats.id = chat_wallpapers.chat_id) AND ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid()))))) AND (auth.uid() = set_by)) |
| public | chat_wallpapers | Users can update chat wallpapers | UPDATE | {public} | (EXISTS ( SELECT 1 FROM chats WHERE ((chats.id = chat_wallpapers.chat_id) AND ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid()))))) | null |
| public | chat_wallpapers | Users can view chat wallpapers | SELECT | {public} | (EXISTS ( SELECT 1 FROM chats WHERE ((chats.id = chat_wallpapers.chat_id) AND ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid()))))) | null |
| public | chat_wallpapers | Users can view chat wallpapers they participate in | SELECT | {public} | (EXISTS ( SELECT 1 FROM chats WHERE ((chats.id = chat_wallpapers.chat_id) AND ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid()))))) | null |
| public | wallpapers | Anyone can view wallpapers | SELECT | {public} | (is_active = true) | null |
| public | wallpapers | Only admins can manage wallpapers | ALL | {public} | (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))) | null |
| public | temporary_chat_settings | Allow authenticated users to insert settings | INSERT | {public} | null | (auth.uid() = user_id) |
| public | temporary_chat_settings | Allow users to delete their settings | DELETE | {public} | (auth.uid() = user_id) | null |
| public | temporary_chat_settings | Allow users to read their settings | SELECT | {public} | (auth.uid() = user_id) | null |
| public | temporary_chat_settings | Allow users to update their settings | UPDATE | {public} | (auth.uid() = user_id) | (auth.uid() = user_id) |
| public | temporary_chat_settings | Users can delete their own temp chat settings | DELETE | {public} | (auth.uid() = user_id) | null |
| public | temporary_chat_settings | Users can insert their own temp chat settings | INSERT | {public} | null | (auth.uid() = user_id) |
| public | temporary_chat_settings | Users can manage their own temp chat settings | ALL | {public} | (auth.uid() = user_id) | null |
| public | temporary_chat_settings | Users can update their own temp chat settings | UPDATE | {public} | (auth.uid() = user_id) | (auth.uid() = user_id) |
| public | temporary_chat_settings | Users can view temp chat settings in their chats | SELECT | {public} | ((auth.uid() = user_id) OR ((is_enabled = true) AND (EXISTS ( SELECT 1 FROM chats WHERE ((chats.id = temporary_chat_settings.chat_id) AND ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid()))))))) | null |
| public | temporary_chat_settings | Users can view temp settings in their chats | SELECT | {public} | ((is_enabled = true) AND (EXISTS ( SELECT 1 FROM chats WHERE ((chats.id = temporary_chat_settings.chat_id) AND ((chats.user1_id = auth.uid()) OR (chats.user2_id = auth.uid())))))) | null |
| public | temporary_chat_settings | Users can view their own temp chat settings | SELECT | {public} | (auth.uid() = user_id) | null |
| public | vanish_duration_presets | Anyone can view vanish presets | SELECT | {public} | true | null |
| public | vanish_duration_presets | Only admins can manage vanish presets | ALL | {public} | (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))) | null |
| public | admin_logs | Only admins can insert admin logs | INSERT | {public} | null | (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))) |
| public | admin_logs | Only admins can view admin logs | SELECT | {public} | (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))) | null |
| public | reminder_logs | Anyone can create logs | INSERT | {public} | null | true |
| public | reminder_logs | Anyone can create reminder logs | INSERT | {public} | null | true |
| public | reminder_logs | Users can view logs | SELECT | {public} | true | null |
| public | reminder_logs | Users can view logs for their reminders | SELECT | {public} | ((auth.uid() = user_id) OR (EXISTS ( SELECT 1 FROM reminders WHERE ((reminders.id = reminder_logs.reminder_id) AND (reminders.sender_id = auth.uid()))))) | null |
| public | reminder_roles | Users can manage their reminder roles | ALL | {public} | (auth.uid() = user_id) | null |
| public | reminder_roles | Users can manage their roles | ALL | {public} | (auth.uid() = user_id) | null |
| public | reminder_roles | Users can view their reminder roles | SELECT | {public} | ((auth.uid() = user_id) OR (auth.uid() = trusted_user_id)) | null |
| public | reminder_roles | Users can view their roles | SELECT | {public} | ((auth.uid() = user_id) OR (auth.uid() = trusted_user_id)) | null |
| public | reminders | Users can create reminders | INSERT | {public} | null | (auth.uid() = sender_id) |
| public | reminders | Users can delete their reminders | DELETE | {public} | (auth.uid() = sender_id) | null |
| public | reminders | Users can update their reminders | UPDATE | {public} | ((auth.uid() = sender_id) OR (auth.uid() = receiver_id)) | null |
| public | reminders | Users can view their reminders | SELECT | {public} | ((auth.uid() = sender_id) OR (auth.uid() = receiver_id)) | null |

---

## 3. Foreign Key Relationships

| table_schema | constraint_name | table_name | column_name | foreign_table_name | foreign_column_name |
| :--- | :--- | :--- | :--- | :--- | :--- |
| public | chats_user1_id_fkey | chats | user1_id | users | id |
| public | chats_user2_id_fkey | chats | user2_id | users | id |
| public | chat_wallpapers_chat_id_fkey | chat_wallpapers | chat_id | chats | id |
| public | messages_chat_id_fkey | messages | chat_id | chats | id |
| public | messages_sender_id_fkey | messages | sender_id | users | id |
| public | messages_receiver_id_fkey | messages | receiver_id | users | id |
| public | chat_wallpapers_wallpaper_id_fkey | chat_wallpapers | wallpaper_id | wallpapers | id |
| public | chat_wallpapers_set_by_fkey | chat_wallpapers | set_by | users | id |
| public | blocked_users_blocker_id_fkey | blocked_users | blocker_id | users | id |
| public | blocked_users_blocked_id_fkey | blocked_users | blocked_id | users | id |
| public | reports_reporter_id_fkey | reports | reporter_id | users | id |
| public | reports_reported_id_fkey | reports | reported_id | users | id |
| public | contacts_user_id_fkey | contacts | user_id | users | id |
| public | contacts_contact_user_id_fkey | contacts | contact_user_id | users | id |
| public | groups_created_by_fkey | groups | created_by | users | id |
| public | group_members_group_id_fkey | group_members | group_id | groups | id |
| public | group_members_user_id_fkey | group_members | user_id | users | id |
| public | session_tokens_user_id_fkey | session_tokens | user_id | users | id |
| public | login_history_user_id_fkey | login_history | user_id | users | id |
| public | reminders_sender_id_fkey | reminders | sender_id | users | id |
| public | reminders_receiver_id_fkey | reminders | receiver_id | users | id |
| public | reminder_roles_user_id_fkey | reminder_roles | user_id | users | id |
| public | reminder_roles_trusted_user_id_fkey | reminder_roles | trusted_user_id | users | id |
| public | reminder_logs_reminder_id_fkey | reminder_logs | reminder_id | reminders | id |
| public | reminder_logs_user_id_fkey | reminder_logs | user_id | users | id |
| public | user_themes_user_id_fkey | user_themes | user_id | users | id |
| public | temporary_chat_settings_chat_id_fkey | temporary_chat_settings | chat_id | chats | id |
| public | temporary_chat_settings_user_id_fkey | temporary_chat_settings | user_id | users | id |
| public | game_invitations_chat_id_fkey | game_invitations | chat_id | chats | id |
| public | game_invitations_sender_id_fkey | game_invitations | sender_id | users | id |
| public | game_invitations_receiver_id_fkey | game_invitations | receiver_id | users | id |
| public | user_activity_logs_user_id_fkey | user_activity_logs | user_id | users | id |
| public | support_messages_user_id_fkey | support_messages | user_id | users | id |
| public | support_messages_responded_by_fkey | support_messages | responded_by | users | id |
| public | messages_reply_to_fkey | messages | reply_to | messages | id |
| public | admin_logs_admin_id_fkey | admin_logs | admin_id | users | id |
| public | admin_logs_target_user_id_fkey | admin_logs | target_user_id | users | id |
| public | chat_themes_chat_id_fkey | chat_themes | chat_id | chats | id |
| public | chat_themes_set_by_fkey | chat_themes | set_by | users | id |
| public | message_reads_message_id_fkey | message_reads | message_id | messages | id |
| public | message_reads_user_id_fkey | message_reads | user_id | users | id |
| public | call_history_caller_id_fkey | call_history | caller_id | users | id |
| public | call_history_receiver_id_fkey | call_history | receiver_id | users | id |
| public | call_signaling_from_user_id_fkey | call_signaling | from_user_id | users | id |
| public | call_signaling_to_user_id_fkey | call_signaling | to_user_id | users | id |
| public | user_call_settings_user_id_fkey | user_call_settings | user_id | users | id |