// Import Firebase scripts for service worker
importScripts('./firebase-app-compat.js');
importScripts('./firebase-messaging-compat.js');

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBempZtw6tr9_Vnospj3zmyiYiPlIf3HSY",
  authDomain: "caba-13cf1.firebaseapp.com",
  projectId: "caba-13cf1",
  storageBucket: "caba-13cf1.firebasestorage.app",
  messagingSenderId: "71167429712",
  appId: "1:71167429712:web:08986006d3241943b91555"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging and get a reference to the service
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});