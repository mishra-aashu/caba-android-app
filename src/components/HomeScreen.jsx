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
      </div>
    </>
  );
}