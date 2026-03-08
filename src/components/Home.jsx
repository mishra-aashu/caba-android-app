import React from "react";
import { useTheme } from "../contexts/ThemeContext";
import BottomNavigation from "./common/BottomNavigation";

import "../styles/home.css";
import { Paperclip, Smile, ArrowLeft } from 'lucide-react';

export default function Home() {
  const [input, setInput] = React.useState("");
  const { toggleTheme } = useTheme();
  const [activeView, setActiveView] = React.useState('list'); // 'list' or 'chat'

  const handleChatClick = () => {
    setActiveView('chat');
  };

  const handleBackClick = () => {
    setActiveView('list');
  };

  return (
    <>
      <div className="aurora-bg" />
      <div className={`app-shell ${activeView === 'chat' ? 'show-chat' : ''}`}>
        <header className="app-header glass">
          <div className="brand">
            <div className="logo" />
            <div className="name">CaBa</div>
            <span className="badge">Online • Fast • Secure</span>
          </div>
          <div>
            <button className="btn-primary" onClick={toggleTheme}>
              Toggle Theme
            </button>
          </div>
        </header>

        <aside className="sidebar glass">
          <div className="search">
            <input placeholder="Search chats, people, or messages..." />
            <button className="icon-btn" title="New chat">+</button>
          </div>
          <div className="chat-list hidden-scroll">
            <div className="chat-item" onClick={handleChatClick}>
              <div className="avatar"><img src="/assets/images/dp-options/00701602b0eac0390b3107b9e2a665e0.jpg" alt="dp" /></div>
              <div className="chat-meta">
                <div className="title">Design Team</div>
                <div className="preview">Let’s ship the UI revamp today!</div>
              </div>
              <div className="chat-time">2m</div>
            </div>
            <div className="chat-item" onClick={handleChatClick}>
              <div className="avatar"><img src="/assets/images/dp-options/1691130988954.jpg" alt="dp" /></div>
              <div className="chat-meta">
                <div className="title">Ava</div>
                <div className="preview">Sending the docs now...</div>
              </div>
              <div className="chat-time">8m</div>
            </div>
            {/* ... more chat items ... */}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="text-soft">Total: 12</span>
            <button className="icon-btn" title="Settings">⚙</button>
          </div>
        </aside>

        <section className="chat-pane glass">
          <div className="chat-header">
            <button className="back-btn" onClick={handleBackClick}>
              <ArrowLeft size={20} />
            </button>
            <div className="title">
              <div className="avatar"><img src="/assets/images/dp-options/00701602b0eac0390b3107b9e2a665e0.jpg" alt="dp" /></div>
              <div>
                <div>Design Team</div>
                <div className="status">Active now</div>
              </div>
            </div>
            <div className="tools">
              <button className="icon-btn" title="Call">📞</button>
              <button className="icon-btn" title="More">⋮</button>
            </div>
          </div>

          <div className="messages hidden-scroll">
            <div className="msg msg-in">
              Finalizing the home screen polish. Push in 1h.
              <div className="meta">Avery • 11:22 AM</div>
            </div>
            <div className="msg msg-out">
              Awesome! I’ll run QA and provide quick notes.
              <div className="meta">You • 11:23 AM</div>
            </div>
            <div className="msg msg-in">
              <div className="typing">
                <span></span><span></span><span></span>
              </div>
              <div className="meta">Avery • typing...</div>
            </div>
            {/* ... message history ... */}
          </div>

          <div className="composer">
            <div className="tools">
              <button className="icon-btn" title="Attach"><Paperclip /></button>
              <button className="icon-btn" title="Emoji"><Smile /></button>
            </div>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Write a message..."
            />
            <button className="btn-primary" onClick={() => {
              /* send handler */
            }}>
              Send
            </button>
          </div>
        </section>
        <button className="fab" title="New Chat">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
        </button>
        <BottomNavigation />
      </div>
    </>
  );
}
