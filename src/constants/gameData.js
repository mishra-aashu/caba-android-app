export const GAME_MODES = {
    CLASSIC: 'classic',
    FRIENDS: 'friends',
    SPICY: 'spicy'
};

export const TRUTHS = {
    [GAME_MODES.CLASSIC]: [
        "What's the last lie you told?",
        "What's your most embarrassing childhood memory?",
        "What's the weirdest food combination you enjoy?",
        "Who in this room would survive a zombie apocalypse?",
        "What's the most useless talent you have?",
        "What's the longest you've gone without showering?",
        "What's your guilty pleasure song?",
        "Have you ever pretended to like a gift?",
        "What was your first crush?",
        "What's the biggest secret you've kept from your parents?",
    ],
    [GAME_MODES.FRIENDS]: [
        "What's the biggest secret you've kept from this group?",
        "Who was your first crush and do they know?",
        "What's the most embarrassing thing in your search history?",
        "Have you ever talked behind someone's back in this room?",
        "What's your biggest insecurity?",
        "What's the worst date you've ever been on?",
        "Have you ever cheated on a test or exam?",
        "What's a rumor about you that's actually true?",
        "If you could trade lives with anyone here for a day, who would it be?",
        "What's the most illegal thing you've ever done?",
    ],
    [GAME_MODES.SPICY]: [
        "What's your body count?",
        "Who in this room do you find most attractive?",
        "What's your biggest turn-on?",
        "Have you ever had a dream about someone in this room?",
        "What's the most rebellious thing you've done?",
        "Who was your worst kiss?",
        "What's something you'd never tell your partner?",
        "Rate everyone in this room from 1-10",
        "What's your wildest fantasy?",
        "Have you ever sent a risky text to the wrong person?",
    ]
};

export const DARES = {
    [GAME_MODES.CLASSIC]: [
        "Do your best celebrity impression (voice note)",
        "Send the 3rd photo in your gallery right now",
        "Type your next message using only your nose",
        "Send a voice note singing your favorite song badly",
        "Make a funny face and send a selfie",
        "Speak in an accent for the next 2 rounds",
        "Do 10 jumping jacks and send video proof",
        "Act like a cat until your next turn",
    ],
    [GAME_MODES.FRIENDS]: [
        "Let someone else send a message from your phone",
        "Call the 5th contact in your phone and sing Happy Birthday",
        "Post a story saying 'I love [random item in your room]'",
        "Send a voice note doing a dramatic movie scene",
        "Change your profile picture to a funny selfie for 1 hour",
        "Record yourself doing your best dance move",
        "Send the oldest photo in your gallery",
        "Let the group choose your status message for 24 hours",
    ],
    [GAME_MODES.SPICY]: [
        "Send your most attractive selfie right now",
        "Let the group go through your DMs for 30 seconds",
        "Send a flirty message to your last match",
        "Do a seductive dance and send a video",
        "Call your ex and say you miss them",
        "Post a thirst trap on your story",
        "Let someone else type a message to anyone from your phone",
        "Share your screen time report",
    ]
};

export const DB_TABLES = {
    GAME_INVITATIONS: 'game_invitations',
    MESSAGES: 'messages',
    USERS: 'users'
};

export const SCORING = {
    TRUTH: 10,
    DARE: 15,
    SWITCH: 5,
    SKIP: -5,
    TIMEOUT: -3,
    STREAK_BONUS_DARE: 10, // 3 in a row
    STREAK_BONUS_TRUTH: 5  // 3 in a row
};
