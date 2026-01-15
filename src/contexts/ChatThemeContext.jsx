 import React, { createContext, useContext, useState, useEffect } from 'react';

// Complete Chat Themes Data with enhanced visibility and proper naming
const chatThemes = {
  classic_purple: {
    name: 'Classic Purple',
    category: 'Default',
    background: `
      radial-gradient(circle at 25% 75%, rgba(139, 92, 246, 0.15) 0%, transparent 60%),
      radial-gradient(circle at 75% 25%, rgba(168, 85, 247, 0.12) 0%, transparent 55%),
      radial-gradient(circle at 50% 50%, rgba(124, 58, 237, 0.08) 0%, transparent 70%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
      text: '#f8fafc'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
      text: '#0f172a'
    },
    header: {
      background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      text: '#ffffff',
      iconColor: '#f1f5f9'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
      text: '#1e293b',
      iconColor: '#8b5cf6'
    },
    buttons: {
      background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  custom_background: {
    name: 'Custom Background',
    category: 'Custom',
    background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='260' viewBox='0 0 260 260'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.4'%3E%3Cpath d='M24.37 16c.2.65.39 1.32.54 2H21.17l1.17 2.34.45.9-.24.11V28a5 5 0 0 1-2.23 8.94l-.02.06a8 8 0 0 1-7.75 6h-20a8 8 0 0 1-7.74-6l-.02-.06A5 5 0 0 1-17.45 28v-6.76l-.79-1.58-.44-.9.9-.44.63-.32H-20a23.01 23.01 0 0 1 44.37-2zm-36.82 2a1 1 0 0 0-.44.1l-3.1 1.56.89 1.79 1.31-.66a3 3 0 0 1 2.69 0l2.2 1.1a1 1 0 0 0 .9 0l2.21-1.1a3 3 0 0 1 2.69 0l2.2 1.1a1 1 0 0 0 .9 0l2.21-1.1a3 3 0 0 1 2.69 0l2.2 1.1a1 1 0 0 0 .86.02l2.88-1.27a3 3 0 0 1 2.43 0l2.88 1.27a1 1 0 0 0 .85-.02l3.1-1.55-.89-1.79-1.42.71a3 3 0 0 1-2.56.06l-2.77-1.23a1 1 0 0 0-.4-.09h-.01a1 1 0 0 0-.4.09l-2.78 1.23a3 3 0 0 1-2.56-.06l-2.3-1.15a1 1 0 0 0-.45-.11h-.01a1 1 0 0 0-.44.1L.9 19.22a3 3 0 0 1-2.69 0l-2.2-1.1a1 1 0 0 0-.45-.11h-.01a1 1 0 0 0-.44.1l-2.21 1.11a3 3 0 0 1-2.69 0l-2.2-1.1a1 1 0 0 0-.45-.11h-.01zm0-2h-4.9a21.01 21.01 0 0 1 39.61 0h-2.09l-.06-.13-.26.13h-32.31zm30.35 7.68l1.36-.68h1.3v2h-36v-1.15l.34-.17 1.36-.68h2.59l1.36.68a3 3 0 0 0 2.69 0l1.36-.68h2.59l1.36.68a3 3 0 0 0 2.69 0L2.26 23h2.59l1.36.68a3 3 0 0 0 2.56.06l1.67-.74h3.23l1.67.74a3 3 0 0 0 2.56-.06zM-13.82 27l16.37 4.91L18.93 27h-32.75zm-.63 2h.34l16.66 5 16.67-5h.33a3 3 0 1 1 0 6h-34a3 3 0 1 1 0-6zm1.35 8a6 6 0 0 0 5.65 4h20a6 6 0 0 0 5.66-4H-13.1z'/%3E%3Cpath id='path6_fill-copy' d='M284.37 16c.2.65.39 1.32.54 2H281.17l1.17 2.34.45.9-.24.11V28a5 5 0 0 1-2.23 8.94l-.02.06a8 8 0 0 1-7.75 6h-20a8 8 0 0 1-7.74-6l-.02-.06a5 5 0 0 1-2.24-8.94v-6.76l-.79-1.58-.44-.9.9-.44.63-.32H240a23.01 23.01 0 0 1 44.37-2zm-36.82 2a1 1 0 0 0-.44.1l-3.1 1.56.89 1.79 1.31-.66a3 3 0 0 1 2.69 0l2.2 1.1a1 1 0 0 0 .9 0l2.21-1.1a3 3 0 0 1 2.69 0l2.2 1.1a1 1 0 0 0 .9 0l2.21-1.1a3 3 0 0 1 2.69 0l2.2 1.1a1 1 0 0 0 .86.02l2.88-1.27a3 3 0 0 1 2.43 0l2.88 1.27a1 1 0 0 0 .85-.02l3.1-1.55-.89-1.79-1.42.71a3 3 0 0 1-2.56.06l-2.77-1.23a1 1 0 0 0-.4-.09h-.01a1 1 0 0 0-.4.09l-2.78 1.23a3 3 0 0 1-2.56-.06l-2.3-1.15a1 1 0 0 0-.45-.11h-.01a1 1 0 0 0-.44.1l-2.21 1.11a3 3 0 0 1-2.69 0l-2.2-1.1a1 1 0 0 0-.45-.11h-.01a1 1 0 0 0-.44.1l-2.21 1.11a3 3 0 0 1-2.69 0l-2.2-1.1a1 1 0 0 0-.45-.11h-.01zm0-2h-4.9a21.01 21.01 0 0 1 39.61 0h-2.09l-.06-.13-.26.13h-32.31zm30.35 7.68l1.36-.68h1.3v2h-36v-1.15l.34-.17 1.36-.68h2.59l1.36.68a3 3 0 0 0 2.69 0l1.36-.68h2.59l1.36.68a3 3 0 0 0 2.69 0l1.36-.68h2.59l1.36.68a3 3 0 0 0 2.56.06l1.67-.74h3.23l1.67.74a3 3 0 0 0 2.56-.06zM246.18 27l16.37 4.91L278.93 27h-32.75zm-.63 2h.34l16.66 5 16.67-5h.33a3 3 0 1 1 0 6h-34a3 3 0 1 1 0-6zm1.35 8a6 6 0 0 0 5.65 4h20a6 6 0 0 0 5.66-4H246.9z'/%3E%3Cpath d='M159.5 21.02A9 9 0 0 0 151 15h-42a9 9 0 0 0-8.5 6.02 6 6 0 0 0 .02 11.96A8.99 8.99 0 0 0 109 45h42a9 9 0 0 0 8.48-12.02 6 6 0 0 0 .02-11.96zM151 17h-42a7 7 0 0 0-6.33 4h54.66a7 7 0 0 0-6.33-4zm-9.34 26a8.98 8.98 0 0 0 3.34-7h-2a7 7 0 0 1-7 7h-4.34a8.98 8.98 0 0 0 3.34-7h-2a7 7 0 0 1-7 7h-4.34a8.98 8.98 0 0 0 3.34-7h-2a7 7 0 0 1-7 7h-7a7 7 0 1 1 0-14h42a7 7 0 1 1 0 14h-9.34zM109 27a9 9 0 0 0-7.48 4H101a4 4 0 1 1 0-8h58a4 4 0 0 1 0 8h-.52a9 9 0 0 0-7.48-4h-42z'/%3E%3Cpath d='M39 115a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm6-8a6 6 0 1 1-12 0 6 6 0 0 1 12 0zm-3-29v-2h8v-6H40a4 4 0 0 0-4 4v10H22l-1.33 4-.67 2h2.19L26 130h26l3.81-40H58l-.67-2L56 84H42v-6zm-4-4v10h2V74h8v-2h-8a2 2 0 0 0-2 2zm2 12h14.56l.67 2H22.77l.67-2H40zm13.8 4H24.2l3.62 38h22.36l3.62-38z'/%3E%3Cpath d='M129 92h-6v4h-6v4h-6v14h-3l.24 2 3.76 32h36l3.76-32 .24-2h-3v-14h-6v-4h-6v-4h-8zm18 22v-12h-4v4h3v8h1zm-3 0v-6h-4v6h4zm-6 6v-16h-4v19.17c1.6-.7 2.97-1.8 4-3.17zm-6 3.8V100h-4v23.8a10.04 10.04 0 0 0 4 0zm-6-.63V104h-4v16a10.04 10.04 0 0 0 4 3.17zm-6-9.17v-6h-4v6h4zm-6 0v-8h3v-4h-4v12h1zm27-12v-4h-4v4h3v4h1v-4zm-6 0v-8h-4v4h3v4h1zm-6-4v-4h-4v8h1v-4h3zm-6 4v-4h-4v8h1v-4h3zm7 24a12 12 0 0 0 11.83-10h7.92l-3.53 30h-32.44l-3.53-30h7.92A12 12 0 0 0 130 126z'/%3E%3Cpath d='M212 86v2h-4v-2h4zm4 0h-2v2h2v-2zm-20 0v.1a5 5 0 0 0-.56 9.65l.06.25 1.12 4.48a2 2 0 0 0 1.94 1.52h.01l7.02 24.55a2 2 0 0 0 1.92 1.45h4.98a2 2 0 0 0 1.92-1.45l7.02-24.55a2 2 0 0 0 1.95-1.52L224.5 96l.06-.25a5 5 0 0 0-.56-9.65V86a14 14 0 0 0-28 0zm4 0h6v2h-9a3 3 0 1 0 0 6H223a3 3 0 1 0 0-6H220v-2h2a12 12 0 1 0-24 0h2zm-1.44 14l-1-4h24.88l-1 4h-22.88zm8.95 26l-6.86-24h18.7l-6.86 24h-4.98zM150 242a22 22 0 1 0 0-44 22 22 0 0 0 0 44zm24-22a24 24 0 1 1-48 0 24 24 0 0 1 48 0zm-28.38 17.73l2.04-.87a6 6 0 0 1 4.68 0l2.04.87a2 2 0 0 0 2.5-.82l1.14-1.9a6 6 0 0 1 3.79-2.75l2.15-.5a2 2 0 0 0 1.54-2.12l-.19-2.2a6 6 0 0 1 1.45-4.46l1.45-1.67a2 2 0 0 0 0-2.62l-1.45-1.67a6 6 0 0 1-1.45-4.46l.2-2.2a2 2 0 0 0-1.55-2.13l-2.15-.5a6 6 0 0 1-3.8-2.75l-1.13-1.9a2 2 0 0 0-2.5-.8l-2.04.86a6 6 0 0 1-4.68 0l-2.04-.87a2 2 0 0 0-2.5.82l-1.14 1.9a6 6 0 0 1-3.79 2.75l-2.15.5a2 2 0 0 0-1.54 2.12l.19 2.2a6 6 0 0 1-1.45 4.46l-1.45 1.67a2 2 0 0 0 0 2.62l1.45 1.67a6 6 0 0 1 1.45 4.46l-.2 2.2a2 2 0 0 0 1.55 2.13l2.15.5a6 6 0 0 1 3.8 2.75l1.13 1.9a2 2 0 0 0 5.0.8zm2.82.97a4 4 0 0 1 3.12 0l2.04.87a4 4 0 0 0 4.99-1.62l1.14-1.9a4 4 0 0 1 2.53-1.84l2.15-.5a4 4 0 0 0 3.09-4.24l-.2-2.2a4 4 0 0 1 .97-2.98l1.45-1.67a4 4 0 0 0 0-5.24l-1.45-1.67a4 4 0 0 1-.97-2.97l.2-2.2a4 4 0 0 0-3.09-4.25l-2.15-.5a4 4 0 0 1-2.53-1.84l-1.14-1.9a4 4 0 0 0-5-1.62l-2.03.87a4 4 0 0 1-3.12 0l-2.04-.87a4 4 0 0 0-4.99 1.62l-1.14 1.9a4 4 0 0 1-2.53 1.84l-2.15.5a4 4 0 0 0-3.09 4.24l.2 2.2a4 4 0 0 1-.97 2.98l-1.45 1.67a4 4 0 0 0 0 5.24l1.45 1.67a4 4 0 0 1 .97 2.97l-.2 2.2a4 4 0 0 0 3.09 4.25l2.15.5a4 4 0 0 1 2.53 1.84l1.14 1.9a4 4 0 0 0 5 1.62l2.03-.87zM152 207a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm6 2a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm-11 1a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm-6 0a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm3-5a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm-8 8a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm3 6a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm0 6a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm4 7a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm5-2a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm5 4a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm4-6a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm6-4a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm-4-3a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm4-3a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm-5-4a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm-24 6a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm16 5a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm7-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0zm86-29a1 1 0 0 0 0 2h2a1 1 0 0 0 0-2h-2zm19 9a1 1 0 0 1 1-1h2a1 1 0 0 1 0 2h-2a1 1 0 0 1-1-1zm-14 5a1 1 0 0 0 0 2h2a1 1 0 0 0 0-2h-2zm-25 1a1 1 0 0 0 0 2h2a1 1 0 0 0 0-2h-2zm5 4a1 1 0 0 0 0 2h2a1 1 0 0 0 0-2h-2zm9 0a1 1 0 0 1 1-1h2a1 1 0 0 1 0 2h-2a1 1 0 0 1-1-1zm15 1a1 1 0 0 1 1-1h2a1 1 0 0 1 0 2h-2a1 1 0 0 1-1-1zm12-2a1 1 0 0 0 0 2h2a1 1 0 0 0 0-2h-2zm-11-14a1 1 0 0 1 1-1h2a1 1 0 0 1 0 2h-2a1 1 0 0 1-1-1zm-19 0a1 1 0 0 0 0 2h2a1 1 0 0 0 0-2h-2zm6 5a1 1 0 0 1 1-1h2a1 1 0 0 1 0 2h-2a1 1 0 0 1-1-1zm-25 15c0-.47.01-.94.03-1.4a5 5 0 0 1-1.7-8 3.99 3.99 0 0 1 1.88-5.18 5 5 0 0 1 3.4-6.22 3 3 0 0 1 1.46-1.05 5 5 0 0 1 7.76-3.27A30.86 30.86 0 0 1 246 184c6.79 0 13.06 2.18 18.17 5.88a5 5 0 0 1 7.76 3.27 3 3 0 0 1 1.47 1.05 5 5 0 0 1 3.4 6.22 4 4 0 0 1 1.87 5.18 4.98 4.98 0 0 1-1.7 8c.02.46.03.93.03 1.4v1h-62v-1zm.83-7.17a30.9 30.9 0 0 0-.62 3.57 3 3 0 0 1-.61-4.2c.37.28.78.49 1.23.63zm1.49-4.61c-.36.87-.68 1.76-.96 2.68a2 2 0 0 1-.21-3.71c.33.4.73.75 1.17 1.03zm2.32-4.54c-.54.86-1.03 1.76-1.49 2.68a3 3 0 0 1-.07-4.67 3 3 0 0 0 1.56 1.99zm1.14-1.7c.35-.5.72-.98 1.1-1.46a1 1 0 1 0-1.1 1.45zm5.34-5.77c-1.03.86-2 1.79-2.9 2.77a3 3 0 0 0-1.11-.77 3 3 0 0 1 4-2zm42.66 2.77c-.9-.98-1.87-1.9-2.9-2.77a3 3 0 0 1 4.01 2 3 3 0 0 0-1.1.77zm1.34 1.54c.38.48.75.96 1.1 1.45a1 1 0 1 0-1.1-1.45zm3.73 5.84c-.46-.92-.95-1.82-1.5-2.68a3 3 0 0 0 1.57-1.99 3 3 0 0 1-.07 4.67zm1.8 4.53c-.29-.9-.6-1.8-.97-2.67.44-.28.84-.63 1.17-1.03a2 2 0 0 1-.2 3.7zm1.14 5.51c-.14-1.21-.35-2.4-.62-3.57.45-.14.86-.35 1.23-.63a2.99 2.99 0 0 1-.6 4.2zM275 214a29 29 0 0 0-57.97 0h57.96zM72.33 198.12c-.21-.32-.34-.7-.34-1.12v-12h-2v12a4.01 4.01 0 0 0 7.09 2.54c.57-.69.91-1.57.91-2.54v-12h-2v12a1.99 1.99 0 0 1-2 2 2 2 0 0 1-1.66-.88zM75 176c.38 0 .74-.04 1.1-.12a4 4 0 0 0 6.19 2.4A13.94 13.94 0 0 1 84 185v24a6 6 0 0 1-6 6h-3v9a5 5 0 1 1-10 0v-9h-3a6 6 0 0 1-6-6v-24a14 14 0 0 1 14-14 5 5 0 0 0 5 5zm-17 15v12a1.99 1.99 0 0 0 1.22 1.84 2 2 0 0 0 2.44-.72c.21-.32.34-.7.34-1.12v-12h2v12a3.98 3.98 0 0 1-5.35 3.77 3.98 3.98 0 0 1-.65-.3V209a4 4 0 0 0 4 4h16a4 4 0 0 0 4-4v-24c.01-1.53-.23-2.88-.72-4.17-.43.1-.87.16-1.28.17a6 6 0 0 1-5.2-3 7 7 0 0 1-6.47-4.88A12 12 0 0 0 58 185v6zm9 24v9a3 3 0 1 0 6 0v-9h-6z'/%3E%3Cpath d='M-17 191a1 1 0 0 0 0 2h2a1 1 0 0 0 0-2h-2zm19 9a1 1 0 0 1 1-1h2a1 1 0 0 1 0 2H3a1 1 0 0 1-1-1zm-14 5a1 1 0 0 0 0 2h2a1 1 0 0 0 0-2h-2zm-25 1a1 1 0 0 0 0 2h2a1 1 0 0 0 0-2h-2zm5 4a1 1 0 0 0 0 2h2a1 1 0 0 0 0-2h-2zm9 0a1 1 0 0 1 1-1h2a1 1 0 0 1 0 2h-2a1 1 0 0 1-1-1zm15 1a1 1 0 0 1 1-1h2a1 1 0 0 1 0 2h-2a1 1 0 0 1-1-1zm12-2a1 1 0 0 0 0 2h2a1 1 0 0 0 0-2H4zm-11-14a1 1 0 0 1 1-1h2a1 1 0 0 1 0 2h-2a1 1 0 0 1-1-1zm-19 0a1 1 0 0 0 0 2h2a1 1 0 0 0 0-2h-2zm6 5a1 1 0 0 1 1-1h2a1 1 0 0 1 0 2h-2a1 1 0 0 1-1-1zm-25 15c0-.47.01-.94.03-1.4a5 5 0 0 1-1.7-8 3.99 3.99 0 0 1 1.88-5.18 5 5 0 0 1 3.4-6.22 3 3 0 0 1 1.46-1.05 5 5 0 0 1 7.76-3.27A30.86 30.86 0 0 1-14 184c6.79 0 13.06 2.18 18.17 5.88a5 5 0 0 1 7.76 3.27 3 3 0 0 1 1.47 1.05 5 5 0 0 1 3.4 6.22 4 4 0 0 1 1.87 5.18 4.98 4.98 0 0 1-1.7 8c.02.46.03.93.03 1.4v1h-62v-1zm.83-7.17a30.9 30.9 0 0 0-.62 3.57 3 3 0 0 1-.61-4.2c.37.28.78.49 1.23.63zm1.49-4.61c-.36.87-.68 1.76-.96 2.68a2 2 0 0 1-.21-3.71c.33.4.73.75 1.17 1.03zm2.32-4.54c-.54.86-1.03 1.76-1.49 2.68a3 3 0 0 1-.07-4.67 3 3 0 0 0 1.56 1.99zm1.14-1.7c.35-.5.72-.98 1.1-1.46a1 1 0 1 0-1.1 1.45zm5.34-5.77c-1.03.86-2 1.79-2.9 2.77a3 3 0 0 0-1.11-.77 3 3 0 0 1 4-2zm42.66 2.77c-.9-.98-1.87-1.9-2.9-2.77a3 3 0 0 1 4.01 2 3 3 0 0 0-1.1.77zm1.34 1.54c.38.48.75.96 1.1 1.45a1 1 0 1 0-1.1-1.45zm3.73 5.84c-.46-.92-.95-1.82-1.5-2.68a3 3 0 0 0 1.57-1.99 3 3 0 0 1-.07 4.67zm1.8 4.53c-.29-.9-.6-1.8-.97-2.67.44-.28.84-.63 1.17-1.03a2 2 0 0 1-.2 3.7zm1.14 5.51c-.14-1.21-.35-2.4-.62-3.57.45-.14.86-.35 1.23-.63a2.99 2.99 0 0 1-.6 4.2zM15 214a29 29 0 0 0-57.97 0h57.96z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
    backgroundColor: '#DFDBE5',
    sentMessage: {
      background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
      text: '#f8fafc'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
      text: '#0f172a'
    },
    header: {
      background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      text: '#ffffff',
      iconColor: '#f1f5f9'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
      text: '#1e293b',
      iconColor: '#8b5cf6'
    },
    buttons: {
      background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  electric_dreams: {
    name: 'Electric Dreams',
    category: 'Futuristic',
    background: `
      radial-gradient(circle at 20% 80%, rgba(6, 182, 212, 0.2) 0%, transparent 50%),
      radial-gradient(circle at 80% 20%, rgba(59, 130, 246, 0.25) 0%, transparent 55%),
      radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.15) 0%, transparent 60%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #0c4a6e 0%, #1e40af 50%, #581c87 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)',
      text: '#f0f9ff'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
      text: '#0c4a6e'
    },
    header: {
      background: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)',
      text: '#ffffff',
      iconColor: '#f0f9ff'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
      text: '#0c4a6e',
      iconColor: '#0ea5e9'
    },
    buttons: {
      background: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  dark_professional: {
    name: 'Dark Professional',
    category: 'Dark',
    background: `
      radial-gradient(circle at 30% 70%, rgba(15, 23, 42, 0.4) 0%, transparent 60%),
      radial-gradient(circle at 70% 30%, rgba(30, 41, 59, 0.3) 0%, transparent 55%),
      radial-gradient(circle at 50% 50%, rgba(51, 65, 85, 0.2) 0%, transparent 70%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #0f172a 0%, #1e293b 50%, #334155 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #475569 0%, #64748b 100%)',
      text: '#f8fafc'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
      text: '#e2e8f0'
    },
    header: {
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      text: '#ffffff',
      iconColor: '#e2e8f0'
    },
    input: {
      background: 'linear-gradient(135deg, #334155 0%, #475569 100%)',
      text: '#f8fafc',
      iconColor: '#94a3b8'
    },
    buttons: {
      background: 'linear-gradient(135deg, #475569 0%, #64748b 100%)',
      text: '#f8fafc',
      iconColor: '#f8fafc'
    }
  },
  ocean_depths: {
    name: 'Ocean Depths',
    category: 'Nature',
    background: `
      radial-gradient(circle at 25% 75%, rgba(14, 165, 233, 0.18) 0%, transparent 55%),
      radial-gradient(circle at 75% 25%, rgba(2, 132, 199, 0.22) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.12) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #0c4a6e 0%, #075985 50%, #0369a1 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
      text: '#f0f9ff'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
      text: '#0c4a6e'
    },
    header: {
      background: 'linear-gradient(135deg, #0c4a6e 0%, #075985 100%)',
      text: '#ffffff',
      iconColor: '#f0f9ff'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
      text: '#0c4a6e',
      iconColor: '#0284c7'
    },
    buttons: {
      background: 'linear-gradient(135deg, #0c4a6e 0%, #075985 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  forest_mist: {
    name: 'Forest Mist',
    category: 'Nature',
    background: `
      radial-gradient(circle at 20% 80%, rgba(34, 197, 94, 0.15) 0%, transparent 55%),
      radial-gradient(circle at 80% 20%, rgba(22, 163, 74, 0.18) 0%, transparent 60%),
      radial-gradient(circle at 60% 40%, rgba(74, 222, 128, 0.10) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #14532d 0%, #166534 50%, #15803d 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
      text: '#f0fdf4'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
      text: '#14532d'
    },
    header: {
      background: 'linear-gradient(135deg, #14532d 0%, #166534 100%)',
      text: '#ffffff',
      iconColor: '#f0fdf4'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
      text: '#14532d',
      iconColor: '#16a34a'
    },
    buttons: {
      background: 'linear-gradient(135deg, #14532d 0%, #166534 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  sunset_glow: {
    name: 'Sunset Glow',
    category: 'Colorful',
    background: `
      radial-gradient(circle at 25% 75%, rgba(251, 146, 60, 0.16) 0%, transparent 55%),
      radial-gradient(circle at 75% 25%, rgba(234, 88, 12, 0.20) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(249, 115, 22, 0.12) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #c2410c 0%, #ea580c 50%, #f97316 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #ea580c 0%, #dc2626 100%)',
      text: '#fff7ed'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fff7ed 100%)',
      text: '#9a3412'
    },
    header: {
      background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 100%)',
      text: '#ffffff',
      iconColor: '#fff7ed'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fff7ed 100%)',
      text: '#9a3412',
      iconColor: '#ea580c'
    },
    buttons: {
      background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  cosmic_purple: {
    name: 'Cosmic Purple',
    category: 'Elegant',
    background: `
      radial-gradient(circle at 30% 70%, rgba(147, 51, 234, 0.18) 0%, transparent 55%),
      radial-gradient(circle at 70% 30%, rgba(124, 58, 237, 0.22) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.14) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #581c87 0%, #6b21a8 50%, #7c3aed 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #7c3aed 0%, #6b21a8 100%)',
      text: '#f3e8ff'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)',
      text: '#581c87'
    },
    header: {
      background: 'linear-gradient(135deg, #581c87 0%, #6b21a8 100%)',
      text: '#ffffff',
      iconColor: '#f3e8ff'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)',
      text: '#581c87',
      iconColor: '#8b5cf6'
    },
    buttons: {
      background: 'linear-gradient(135deg, #581c87 0%, #6b21a8 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  golden_hour: {
    name: 'Golden Hour',
    category: 'Colorful',
    background: `
      radial-gradient(circle at 20% 80%, rgba(245, 158, 11, 0.15) 0%, transparent 55%),
      radial-gradient(circle at 80% 20%, rgba(217, 119, 6, 0.18) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(251, 191, 36, 0.10) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #92400e 0%, #b45309 50%, #d97706 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
      text: '#fffbeb'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)',
      text: '#92400e'
    },
    header: {
      background: 'linear-gradient(135deg, #92400e 0%, #b45309 100%)',
      text: '#ffffff',
      iconColor: '#fffbeb'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)',
      text: '#92400e',
      iconColor: '#d97706'
    },
    buttons: {
      background: 'linear-gradient(135deg, #92400e 0%, #b45309 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  midnight_city: {
    name: 'Midnight City',
    category: 'Dark',
    background: `
      radial-gradient(circle at 30% 70%, rgba(30, 27, 75, 0.25) 0%, transparent 55%),
      radial-gradient(circle at 70% 30%, rgba(49, 46, 129, 0.30) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(79, 70, 229, 0.15) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #0f0f23 0%, #1e1b4b 50%, #312e81 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #4338ca 0%, #3730a3 100%)',
      text: '#e0e7ff'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
      text: '#c7d2fe'
    },
    header: {
      background: 'linear-gradient(135deg, #0f0f23 0%, #1e1b4b 100%)',
      text: '#ffffff',
      iconColor: '#e0e7ff'
    },
    input: {
      background: 'linear-gradient(135deg, #312e81 0%, #4338ca 100%)',
      text: '#e0e7ff',
      iconColor: '#a5b4fc'
    },
    buttons: {
      background: 'linear-gradient(135deg, #4338ca 0%, #3730a3 100%)',
      text: '#e0e7ff',
      iconColor: '#e0e7ff'
    }
  },
  rose_garden: {
    name: 'Rose Garden',
    category: 'Colorful',
    background: `
      radial-gradient(circle at 25% 75%, rgba(244, 63, 94, 0.16) 0%, transparent 55%),
      radial-gradient(circle at 75% 25%, rgba(219, 39, 119, 0.20) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(236, 72, 153, 0.12) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #be185d 0%, #db2777 50%, #ec4899 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #db2777 0%, #be185d 100%)',
      text: '#fdf2f8'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fdf2f8 100%)',
      text: '#be185d'
    },
    header: {
      background: 'linear-gradient(135deg, #be185d 0%, #db2777 100%)',
      text: '#ffffff',
      iconColor: '#fdf2f8'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fdf2f8 100%)',
      text: '#be185d',
      iconColor: '#ec4899'
    },
    buttons: {
      background: 'linear-gradient(135deg, #be185d 0%, #db2777 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  emerald_forest: {
    name: 'Emerald Forest',
    category: 'Nature',
    background: `
      radial-gradient(circle at 20% 80%, rgba(16, 185, 129, 0.14) 0%, transparent 55%),
      radial-gradient(circle at 80% 20%, rgba(5, 150, 105, 0.18) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(52, 211, 153, 0.10) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #047857 0%, #059669 50%, #10b981 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      text: '#ecfdf5'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #ecfdf5 100%)',
      text: '#14532d'
    },
    header: {
      background: 'linear-gradient(135deg, #047857 0%, #059669 100%)',
      text: '#ffffff',
      iconColor: '#ecfdf5'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #ecfdf5 100%)',
      text: '#14532d',
      iconColor: '#10b981'
    },
    buttons: {
      background: 'linear-gradient(135deg, #047857 0%, #059669 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  nebula: {
    name: 'Nebula',
    category: 'Elegant',
    background: `
      radial-gradient(circle at 30% 70%, rgba(236, 72, 153, 0.16) 0%, transparent 55%),
      radial-gradient(circle at 70% 30%, rgba(139, 92, 246, 0.20) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.12) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #831843 0%, #a21caf 50%, #7c3aed 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #a21caf 0%, #7c3aed 100%)',
      text: '#fdf2f8'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fdf2f8 100%)',
      text: '#831843'
    },
    header: {
      background: 'linear-gradient(135deg, #831843 0%, #a21caf 100%)',
      text: '#ffffff',
      iconColor: '#fdf2f8'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fdf2f8 100%)',
      text: '#831843',
      iconColor: '#ec4899'
    },
    buttons: {
      background: 'linear-gradient(135deg, #831843 0%, #a21caf 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  cyberpunk: {
    name: 'Cyberpunk',
    category: 'Dark',
    background: `
      radial-gradient(circle at 25% 75%, rgba(0, 255, 255, 0.08) 0%, transparent 50%),
      radial-gradient(circle at 75% 25%, rgba(255, 0, 255, 0.06) 0%, transparent 55%),
      radial-gradient(circle at 50% 50%, rgba(0, 255, 0, 0.04) 0%, transparent 60%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #000000 0%, #0a0a0a 50%, #1a1a1a 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #00ffff 0%, #0080ff 100%)',
      text: '#000000'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
      text: '#00ff00'
    },
    header: {
      background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)',
      text: '#00ffff',
      iconColor: '#00ff00'
    },
    input: {
      background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
      text: '#00ff00',
      iconColor: '#00ffff'
    },
    buttons: {
      background: 'linear-gradient(135deg, #00ffff 0%, #0080ff 100%)',
      text: '#000000',
      iconColor: '#000000'
    }
  },
  telegram_blue: {
    name: 'Telegram Blue',
    category: 'Professional',
    background: `
      radial-gradient(circle at 30% 70%, rgba(0, 136, 204, 0.15) 0%, transparent 55%),
      radial-gradient(circle at 70% 30%, rgba(0, 95, 153, 0.18) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.10) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #003d5b 0%, #0088cc 50%, #3b82f6 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #0088cc 0%, #0369a1 100%)',
      text: '#f0f9ff'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
      text: '#003d5b'
    },
    header: {
      background: 'linear-gradient(135deg, #003d5b 0%, #0088cc 100%)',
      text: '#ffffff',
      iconColor: '#f0f9ff'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
      text: '#003d5b',
      iconColor: '#0088cc'
    },
    buttons: {
      background: 'linear-gradient(135deg, #003d5b 0%, #0088cc 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  spring_vibes: {
    name: 'Spring Vibes',
    category: 'Nature',
    background: `
      radial-gradient(circle at 20% 80%, rgba(255, 222, 233, 0.25) 0%, transparent 55%),
      radial-gradient(circle at 80% 20%, rgba(181, 255, 252, 0.30) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(236, 252, 203, 0.20) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #fce7f3 0%, #ecfdf5 50%, #f0fdfa 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      text: '#ffffff',
      shadow: '0 3px 12px rgba(5, 150, 105, 0.3)',
      border: '1px solid rgba(255,255,255,0.2)'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
      text: '#1e293b',
      shadow: '0 2px 8px rgba(0,0,0,0.1)',
      border: '1px solid rgba(30, 41, 59, 0.1)'
    },
    header: {
      background: 'linear-gradient(135deg, #047857 0%, #059669 100%)',
      text: '#ffffff',
      iconColor: '#ffffff',
      shadow: '0 2px 8px rgba(4, 120, 87, 0.3)'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
      text: '#1e293b',
      iconColor: '#059669',
      border: '1px solid rgba(5, 150, 105, 0.2)',
      shadow: '0 2px 8px rgba(0,0,0,0.1)'
    },
    buttons: {
      background: 'linear-gradient(135deg, #047857 0%, #059669 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  autumn_leaves: {
    name: 'Autumn Leaves',
    category: 'Nature',
    background: `
      radial-gradient(circle at 25% 75%, rgba(234, 88, 12, 0.16) 0%, transparent 55%),
      radial-gradient(circle at 75% 25%, rgba(154, 52, 18, 0.20) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(245, 158, 11, 0.12) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #7c2d12 0%, #9a3412 50%, #ea580c 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #ea580c 0%, #dc2626 100%)',
      text: '#fff7ed'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fff7ed 100%)',
      text: '#7c2d12'
    },
    header: {
      background: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 100%)',
      text: '#ffffff',
      iconColor: '#fff7ed'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fff7ed 100%)',
      text: '#7c2d12',
      iconColor: '#ea580c'
    },
    buttons: {
      background: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  winter_calm: {
    name: 'Winter Calm',
    category: 'Nature',
    background: `
      radial-gradient(circle at 30% 70%, rgba(137, 247, 254, 0.22) 0%, transparent 55%),
      radial-gradient(circle at 70% 30%, rgba(102, 166, 255, 0.18) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.12) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #e0f2fe 0%, #bae6fd 50%, #7dd3fc 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
      text: '#ffffff',
      shadow: '0 3px 12px rgba(2, 132, 199, 0.3)',
      border: '1px solid rgba(255,255,255,0.2)'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
      text: '#0c4a6e',
      shadow: '0 2px 8px rgba(0,0,0,0.1)',
      border: '1px solid rgba(12, 74, 110, 0.1)'
    },
    header: {
      background: 'linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%)',
      text: '#ffffff',
      iconColor: '#ffffff',
      shadow: '0 2px 8px rgba(12, 74, 110, 0.3)'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
      text: '#0c4a6e',
      iconColor: '#0284c7',
      border: '1px solid rgba(2, 132, 199, 0.2)',
      shadow: '0 2px 8px rgba(0,0,0,0.1)'
    },
    buttons: {
      background: 'linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  desert_dunes: {
    name: 'Desert Dunes',
    category: 'Nature',
    background: `
      radial-gradient(circle at 20% 80%, rgba(253, 230, 138, 0.18) 0%, transparent 55%),
      radial-gradient(circle at 80% 20%, rgba(245, 158, 11, 0.22) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(251, 191, 36, 0.15) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #fef3c7 0%, #fde68a 50%, #facc15 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #ca8a04 0%, #a16207 100%)',
      text: '#ffffff',
      shadow: '0 3px 12px rgba(202, 138, 4, 0.3)',
      border: '1px solid rgba(255,255,255,0.2)'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)',
      text: '#78350f',
      shadow: '0 2px 8px rgba(0,0,0,0.1)',
      border: '1px solid rgba(120, 53, 15, 0.1)'
    },
    header: {
      background: 'linear-gradient(135deg, #78350f 0%, #ca8a04 100%)',
      text: '#ffffff',
      iconColor: '#ffffff',
      shadow: '0 2px 8px rgba(120, 53, 15, 0.3)'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)',
      text: '#78350f',
      iconColor: '#ca8a04',
      border: '1px solid rgba(202, 138, 4, 0.2)',
      shadow: '0 2px 8px rgba(0,0,0,0.1)'
    },
    buttons: {
      background: 'linear-gradient(135deg, #78350f 0%, #ca8a04 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  lavender_fields: {
    name: 'Lavender Fields',
    category: 'Nature',
    background: `
      radial-gradient(circle at 25% 75%, rgba(196, 181, 253, 0.18) 0%, transparent 55%),
      radial-gradient(circle at 75% 25%, rgba(139, 92, 246, 0.15) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(167, 139, 250, 0.12) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #ede9fe 0%, #c4b5fd 50%, #a78bfa 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
      text: '#f3e8ff'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)',
      text: '#581c87'
    },
    header: {
      background: 'linear-gradient(135deg, #581c87 0%, #7c3aed 100%)',
      text: '#ffffff',
      iconColor: '#f3e8ff'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)',
      text: '#581c87',
      iconColor: '#8b5cf6'
    },
    buttons: {
      background: 'linear-gradient(135deg, #581c87 0%, #7c3aed 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  cherry_blossom: {
    name: 'Cherry Blossom',
    category: 'Nature',
    background: `
      radial-gradient(circle at 30% 70%, rgba(253, 164, 175, 0.22) 0%, transparent 55%),
      radial-gradient(circle at 70% 30%, rgba(244, 63, 94, 0.18) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(251, 113, 133, 0.14) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #fce7f3 0%, #fda4af 50%, #fb7185 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #e11d48 0%, #be185d 100%)',
      text: '#ffffff',
      shadow: '0 3px 12px rgba(225, 29, 72, 0.3)',
      border: '1px solid rgba(255,255,255,0.2)'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fdf2f8 100%)',
      text: '#9f1239',
      shadow: '0 2px 8px rgba(0,0,0,0.1)',
      border: '1px solid rgba(159, 18, 57, 0.1)'
    },
    header: {
      background: 'linear-gradient(135deg, #9f1239 0%, #e11d48 100%)',
      text: '#ffffff',
      iconColor: '#ffffff',
      shadow: '0 2px 8px rgba(159, 18, 57, 0.3)'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fdf2f8 100%)',
      text: '#9f1239',
      iconColor: '#f43f5e',
      border: '1px solid rgba(244, 63, 94, 0.2)',
      shadow: '0 2px 8px rgba(0,0,0,0.1)'
    },
    buttons: {
      background: 'linear-gradient(135deg, #9f1239 0%, #e11d48 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  rainy_day: {
    name: 'Rainy Day',
    category: 'Nature',
    background: `
      radial-gradient(circle at 20% 80%, rgba(156, 163, 175, 0.15) 0%, transparent 55%),
      radial-gradient(circle at 80% 20%, rgba(75, 85, 99, 0.18) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(107, 114, 128, 0.12) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #f3f4f6 0%, #d1d5db 50%, #9ca3af 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #4b5563 0%, #374151 100%)',
      text: '#f9fafb'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
      text: '#1f2937'
    },
    header: {
      background: 'linear-gradient(135deg, #1f2937 0%, #4b5563 100%)',
      text: '#ffffff',
      iconColor: '#f9fafb'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
      text: '#1f2937',
      iconColor: '#6b7280'
    },
    buttons: {
      background: 'linear-gradient(135deg, #1f2937 0%, #4b5563 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  sunset_bliss: {
    name: 'Sunset Bliss',
    category: 'Colorful',
    background: `
      radial-gradient(circle at 25% 75%, rgba(251, 146, 60, 0.18) 0%, transparent 55%),
      radial-gradient(circle at 75% 25%, rgba(239, 68, 68, 0.22) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(245, 158, 11, 0.14) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #fed7aa 0%, #fb923c 50%, #f97316 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
      text: '#fef2f2'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fff7ed 100%)',
      text: '#9a3412'
    },
    header: {
      background: 'linear-gradient(135deg, #9a3412 0%, #dc2626 100%)',
      text: '#ffffff',
      iconColor: '#fff7ed'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fff7ed 100%)',
      text: '#9a3412',
      iconColor: '#f97316'
    },
    buttons: {
      background: 'linear-gradient(135deg, #9a3412 0%, #dc2626 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  mint_fresh: {
    name: 'Mint Fresh',
    category: 'Nature',
    background: `
      radial-gradient(circle at 20% 80%, rgba(16, 185, 129, 0.15) 0%, transparent 55%),
      radial-gradient(circle at 80% 20%, rgba(52, 211, 153, 0.18) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(134, 239, 172, 0.12) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #d1fae5 0%, #86efac 50%, #4ade80 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      text: '#f0fdf4'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
      text: '#14532d'
    },
    header: {
      background: 'linear-gradient(135deg, #14532d 0%, #059669 100%)',
      text: '#ffffff',
      iconColor: '#f0fdf4'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
      text: '#14532d',
      iconColor: '#10b981'
    },
    buttons: {
      background: 'linear-gradient(135deg, #14532d 0%, #059669 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  royal_elegance: {
    name: 'Royal Elegance',
    category: 'Elegant',
    background: `
      radial-gradient(circle at 30% 70%, rgba(124, 58, 237, 0.18) 0%, transparent 55%),
      radial-gradient(circle at 70% 30%, rgba(139, 92, 246, 0.22) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.14) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #ede9fe 0%, #c4b5fd 50%, #a78bfa 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #6b21a8 0%, #581c87 100%)',
      text: '#f3e8ff'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)',
      text: '#581c87'
    },
    header: {
      background: 'linear-gradient(135deg, #581c87 0%, #6b21a8 100%)',
      text: '#ffffff',
      iconColor: '#f3e8ff'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)',
      text: '#581c87',
      iconColor: '#8b5cf6'
    },
    buttons: {
      background: 'linear-gradient(135deg, #581c87 0%, #6b21a8 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  }
};

// Create the Chat Theme Context
const ChatThemeContext = createContext();

// Chat Theme Provider Component
export const ChatThemeProvider = ({ children }) => {
  
  // State
  const [currentChatTheme, setCurrentChatTheme] = useState('classic_purple');
  const [currentChatId, setCurrentChatId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scrollPercentage, setScrollPercentage] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--scroll-percentage', scrollPercentage);
  }, [scrollPercentage]);

  // Load chat theme - completely localStorage based to avoid all database errors
  const loadChatTheme = async (chatId) => {
    if (!chatId) {
      setCurrentChatTheme('classic_purple');
      setLoading(false);
      return;
    }

    // Debounce multiple calls for same chat
    const debounceKey = `digidad_theme_debounce_${chatId}`;
    const now = Date.now();
    const lastCall = parseInt(localStorage.getItem(debounceKey) || '0');
    
    if (now - lastCall < 1000) { // 1 second debounce
      setLoading(false);
      return;
    }
    localStorage.setItem(debounceKey, now.toString());

    // Load from localStorage first and only (completely localStorage-based)
    const cachedTheme = localStorage.getItem(`digidad_chat_theme_${chatId}`);
    if (cachedTheme && chatThemes[cachedTheme]) {
      setCurrentChatTheme(cachedTheme);
    } else if (!cachedTheme) {
      setCurrentChatTheme('classic_purple');
      localStorage.setItem(`digidad_chat_theme_${chatId}`, 'classic_purple');
    }

    setLoading(false);
  };

  // Save chat theme - completely localStorage based to avoid all database errors
  const saveChatTheme = async (themeKey, chatId, setByUserId) => {
    if (!chatId) {
      return;
    }

    try {
      // Always save to localStorage (works offline and always)
      localStorage.setItem(`digidad_chat_theme_${chatId}`, themeKey);
      
      // Note: Database sync disabled to avoid permission errors
      // localStorage will handle all theme persistence
    } catch (error) {
      // Fallback to localStorage (should never fail)
      try {
        localStorage.setItem(`digidad_chat_theme_${chatId}`, themeKey);
      } catch (e) {
        // localStorage might be full or disabled
        // Theme will still work for this session
      }
    }
  };

  // Set current chat ID and load theme
  const setChatId = (chatId) => {
    setCurrentChatId(chatId);
    setLoading(true);
    loadChatTheme(chatId);
  };

  // Select and apply theme
  const selectTheme = async (themeKey, chatIdOverride) => {
    if (!chatThemes[themeKey]) return;
    const chatIdToUse = chatIdOverride || currentChatId;
    
    if (!chatIdToUse) {
      console.error('No chat ID available for theme selection');
      return;
    }

    setCurrentChatTheme(themeKey);
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    await saveChatTheme(themeKey, chatIdToUse, currentUser?.id);
    applyTheme(themeKey);
  };

  // Apply theme styles by setting CSS custom properties on the root element
  const applyTheme = (themeKey) => {
    const theme = chatThemes[themeKey];
    if (!theme) return;

    const root = document.documentElement;

    // Apply CSS custom properties for chat theme
    root.style.setProperty('--chat-bg-gradient', theme.background);
    root.style.setProperty('--sent-message-bg', theme.sentMessage.background);
    root.style.setProperty('--sent-message-text', theme.sentMessage.text);
    root.style.setProperty('--received-message-bg', theme.receivedMessage.background);
    root.style.setProperty('--received-message-text', theme.receivedMessage.text);
    root.style.setProperty('--chat-header-bg', theme.header.background);
    root.style.setProperty('--chat-header-text', theme.header.text);
    root.style.setProperty('--chat-header-icon-color', theme.header.iconColor);
    root.style.setProperty('--chat-input-bg', theme.input.background);
    root.style.setProperty('--chat-input-text', theme.input.text);
    root.style.setProperty('--chat-input-icon-color', theme.input.iconColor);
    root.style.setProperty('--chat-buttons-bg', theme.buttons.background);
    root.style.setProperty('--chat-buttons-text', theme.buttons.text);
    root.style.setProperty('--chat-buttons-icon-color', theme.buttons.iconColor);
    
    // Add theme class to body for any potential specific CSS targeting
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    document.body.classList.add(`theme-${themeKey.replace(/_/, '-')}`);
  };

  // Apply theme when theme or chatId changes
  useEffect(() => {
    if (!loading && currentChatId) {
      applyTheme(currentChatTheme);
    }
  }, [currentChatTheme, currentChatId, loading]);

  // Context value
  const value = {
    chatTheme: currentChatTheme,
    chatThemes,
    selectTheme,
    setChatId,
    loading,
    currentThemeData: chatThemes[currentChatTheme] || chatThemes.classic_purple,
    setScrollPercentage,
    currentChatId
  };

  return (
    <ChatThemeContext.Provider value={value}>
      {children}
    </ChatThemeContext.Provider>
  );
};

// Custom hook to use the Chat Theme Context
export const useChatTheme = () => {
  const context = useContext(ChatThemeContext);
  if (!context) {
    throw new Error('useChatTheme must be used within a ChatThemeProvider');
  }
  return context;
};

export default ChatThemeContext;