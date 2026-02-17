const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { createClient } = require("@supabase/supabase-js");

initializeApp();
const db = getFirestore();

// 👇 APNI SUPABASE DETAILS YAHAN DALO (Project Settings -> API)
const SUPABASE_URL = "https://riekjnqllkrqkmqxmtfu.supabase.co"; 
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZWtqbnFsbGtycWttcXhtdGZ1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTg4NzcyNCwiZXhwIjoyMDc3NDYzNzI0fQ.tkCwlbMTZyV4lSkjr7w_b2vu73o_sIbwXPEsD2ZMuqk";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// 🔔 HTTP API Trigger (Supabase isko call karega)
exports.sendNotificationAPI = onRequest(async (req, res) => {
    try {
        // 1. Data from Supabase Webhook
        const record = req.body.record; // Supabase inserts data inside 'record'
        if (!record) {
            return res.status(400).send("No record found");
        }

        const senderId = record.sender_id;
        const text = record.content || record.text; 
        const chatId = record.chat_id;

        console.log(`Webhook received! Chat: ${chatId}, Sender: ${senderId}`);

        if (!text) return res.status(200).send("No text content");

        // 2. Chat Details nikalo (From Supabase)
        // CHANGED: Using user1_id and user2_id columns (not users array)
        const { data: chatData, error } = await supabase
            .from('chats')
            .select('user1_id, user2_id') // Updated column names
            .eq('id', chatId)
            .single();

        if (error || !chatData) {
            console.error("Chat not found in Supabase:", error);
            return res.status(404).send("Chat not found");
        }

        // 3. Receiver Dhundo
        // (Jo sender nahi hai, wahi receiver hai)
        let receiverId = null;
        if (chatData.user1_id === senderId) {
            receiverId = chatData.user2_id;
        } else if (chatData.user2_id === senderId) {
            receiverId = chatData.user1_id;
        }

        if (!receiverId) return res.status(200).send("No receiver found");

        console.log(`Receiver ID: ${receiverId}`);

        // 4. Token Nikalo (From Firestore - Jaha humne Dual Sync kiya tha!)
        const userDoc = await db.collection("users").doc(receiverId).get();
        
        if (!userDoc.exists) {
            console.log("User not found in Firestore");
            return res.status(200).send("User no token");
        }

        const userData = userDoc.data();
        const tokens = [];
        if (userData.fcm_token_android) tokens.push(userData.fcm_token_android);
        if (userData.fcm_token_web) tokens.push(userData.fcm_token_web);

        if (tokens.length === 0) return res.status(200).send("No tokens");

        // 5. Send Notification
        const payload = {
            notification: {
                title: "New Message",
                body: text.length > 50 ? text.substring(0, 50) + "..." : text,
            },
            data: {
                chatId: String(chatId),
                url: `/chat/${chatId}`,
                click_action: "FLUTTER_NOTIFICATION_CLICK"
            }
        };

        await getMessaging().sendEachForMulticast({
            tokens: tokens,
            notification: payload.notification,
            data: payload.data
        });

        console.log("Ting! 🔔 Notification sent.");
        res.status(200).send("Success");

    } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Internal Error");
    }
});
