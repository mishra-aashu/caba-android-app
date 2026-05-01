import fs from 'fs';

const content = fs.readFileSync('/home/aashu/caba-android-app/src/components/chat/ChatScreen.jsx', 'utf8');
const lines = content.split('\n');

let inFunction = false;
let hookFound = false;

lines.forEach((line, i) => {
    if (line.includes('const ChatScreen = () =>')) {
        inFunction = true;
    }
    if (inFunction) {
        if (line.match(/use[A-Z]/) || line.match(/useState|useEffect|useRef|useMemo|useCallback|useContext/)) {
            hookFound = true;
        }
        if (line.match(/if\s*\(.*\)\s*return/) && !line.includes('useEffect')) {
             console.log(`Potential early return at line ${i + 1}: ${line}`);
        }
    }
});
