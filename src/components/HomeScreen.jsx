import React from "react";
import "../styles/theme.css";
import "../styles/home.css";

export default function HomeScreen() {
  const [input, setInput] = React.useState("");

  return (
    <>
      <div className="aurora-bg" />
      <div className="app-shell">
        <header className="app-header glass">
          <div className="brand">
            <div className="logo" />
            <div className="name">CaBa Chat</div>
            <span className="badge">Online • Fast • Secure</span>
          </div>
          <div>
            <button className="btn-primary" onClick={() => {
              document.body.classList.toggle("theme-dark");
            }}>
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
            <div className="chat-item">
              <div className="avatar" />
              <div className="chat-meta">
                <div className="title">Design Team</div>
                <div className="preview">Let’s ship the UI revamp today!</div>
              </div>
              <div className="chat-time">2m</div>
            </div>
            <div className="chat-item">
              <div className="avatar" />
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
            <div className="title">
              <div className="avatar" />
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
              <button className="icon-btn" title="Attach">📎</button>
              <button className="icon-btn" title="Emoji">😊</button>
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
        <footer className="bottom-nav">
          <button className="nav-item active">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            <span>Chats</span>
          </button>
          <button className="nav-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
            <span>Calls</span>
          </button>
          <button className="nav-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="10" r="3"></circle><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"></path></svg>
            <span>Profile</span>
          </button>
        </footer>
      </div>
    </>
  );
}