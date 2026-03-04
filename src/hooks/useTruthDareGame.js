import { prepareDataForDB } from '../utils/dbSchemaCompatibility';
import { useWebRTC } from './useWebRTC';

export const useTruthDareGame = (roomId, userId, { enabled = true } = {}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [gameId, setGameId] = useState(null);
  const [gameState, setGameState] = useState({
    turn: null,
    stage: 'idle',
    type: null,
    content: '',
  });
  const [isHost, setIsHost] = useState(false);

  // 1. Initialize WebRTC
  const handleDataReceived = useCallback((from, data) => {
    if (data.type === 'GAME_UPDATE') {
      // Clients receive authoritative state from Host
      setGameState(data.gameState);
      setGameId(data.gameId);
      if (data.gameState.stage !== 'idle') {
        setIsOpen(true);
      }
    } else if (data.type === 'GAME_EVENT' && isHost) {
      // Host receives event from Client, processes it, and broadcasts new state
      handleClientEvent(from, data.event);
    }
  }, [isHost]);

  const { connectToPeer, sendData } = useWebRTC(roomId, userId, handleDataReceived);

  const handleClientEvent = (from, event) => {
    let newState = { ...stateRef.current };

    switch (event.type) {
      case 'PICK_TYPE':
        newState = { ...newState, type: event.payload, stage: 'writing' };
        break;
      case 'SEND_CHALLENGE':
        newState = { ...newState, content: event.payload, stage: 'performing' };
        break;
      case 'COMPLETE_TURN':
        newState = {
          ...newState,
          turn: from, // Now it's the person who completed the turn's turn to ask
          stage: 'picking',
          type: null,
          content: ''
        };
        break;
      default:
        break;
    }

    // Host updates local state and broadcasts
    setGameState(newState);
    sendData({ type: 'GAME_UPDATE', gameId: gameIdRef.current, gameState: newState });
  };

  // Keep track of the current turn and gameId in refs for logic
  const stateRef = useRef(gameState);
  const gameIdRef = useRef(gameId);

  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    gameIdRef.current = gameId;
  }, [gameId]);

  const fetchActiveGame = useCallback(async () => {
    if (!roomId || !userId) return;
    try {
      const { data, error } = await supabase
        .from('game_invitations')
        .select('*')
        .eq('chat_id', roomId)
        .in('status', ['pending', 'accepted'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && !error) {
        setGameId(data.id);
        if (data.invitation_data) {
          setGameState(data.invitation_data);
          // If I was the sender, I am the Host
          setIsHost(data.sender_id === userId);
          // Connect to the other player if it's already accepted
          const partnerId = data.sender_id === userId ? data.receiver_id : data.sender_id;
          connectToPeer(partnerId);
        }
      }
    } catch (err) {
      console.error('Error fetching active game:', err);
    }
  }, [roomId, userId, connectToPeer]);

  useEffect(() => {
    if (enabled) {
      fetchActiveGame();
    }
  }, [enabled, fetchActiveGame]);

  useEffect(() => {
    if (!roomId) return;

    // We still listen for DB changes for NEW games (Initial Handshake)
    const channel = supabase
      .channel(`game_init_${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'game_invitations',
        filter: `chat_id=eq.${roomId}`
      }, (payload) => {
        if (payload.new.invitation_data) {
          setGameId(payload.new.id);
          setGameState(payload.new.invitation_data);
          setIsOpen(true);
          setIsHost(payload.new.sender_id === userId);

          // Connect to peer for WebRTC
          const partnerId = payload.new.sender_id === userId ? payload.new.receiver_id : payload.new.sender_id;
          connectToPeer(partnerId);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, userId, connectToPeer]);

  const syncGame = useCallback((newId, newState) => {
    // 1. Host updates context
    setGameId(newId);
    setGameState(newState);

    // 2. Broadcast authoritative state via WebRTC
    sendData({ type: 'GAME_UPDATE', gameId: newId, gameState: newState });

    // NO DATABASE UPDATES FOR GAMEPLAY EVENTS (User Rule)
  }, [sendData]);

  // --- ACTIONS WITH TURN VALIDATION ---

  const startGame = useCallback(async (partnerId) => {
    setIsOpen(true);
    setIsHost(true);
    const initialState = {
      turn: userId,
      stage: 'picking',
      type: null,
      content: '',
      partnerId: partnerId || userId
    };

    // We only use DB to INITIATE the game session (Initial signaling/handshake)
    const invitation = prepareDataForDB({
      chat_id: roomId,
      sender_id: userId,
      receiver_id: partnerId || userId,
      game_type: 'truth_or_dare',
      invitation_data: initialState,
      status: 'pending'
    }, 'game_invitations');

    const { data, error } = await supabase
      .from('game_invitations')
      .insert(invitation)
      .select()
      .single();

    if (!error && data) {
      setGameId(data.id);
      setGameState(initialState);
      connectToPeer(partnerId);
      // Wait a bit for DC to open before initial sync if needed, 
      // but usually the first interaction will trigger a sync.
    }
  }, [userId, roomId, connectToPeer]);

  const pickType = useCallback((type) => {
    // SECURITY: Ensure it's your turn
    if (stateRef.current.turn !== userId) return;

    if (isHost) {
      const newState = { ...stateRef.current, type, stage: 'writing' };
      syncGame(gameIdRef.current, newState);
    } else {
      // Client sends event to Host
      sendData({ type: 'GAME_EVENT', event: { type: 'PICK_TYPE', payload: type } });
    }
  }, [isHost, userId, sendData, syncGame]);

  const sendChallenge = useCallback((text) => {
    // SECURITY: Ensure it's your turn
    if (stateRef.current.turn !== userId) return;

    if (isHost) {
      const newState = { ...stateRef.current, content: text, stage: 'performing' };
      syncGame(gameIdRef.current, newState);
    } else {
      // Client sends event to Host
      sendData({ type: 'GAME_EVENT', event: { type: 'SEND_CHALLENGE', payload: text } });
    }
  }, [isHost, userId, sendData, syncGame]);

  const completeTurn = useCallback(() => {
    if (stateRef.current.stage !== 'performing') return;
    if (stateRef.current.turn === userId) return; // Challenger cannot complete their own set task

    if (isHost) {
      const newState = {
        ...stateRef.current,
        turn: userId, // Host completed it
        stage: 'picking',
        type: null,
        content: ''
      };
      syncGame(gameIdRef.current, newState);
    } else {
      // Client sends event to Host
      sendData({ type: 'GAME_EVENT', event: { type: 'COMPLETE_TURN' } });
    }
  }, [isHost, userId, sendData, syncGame]);

  const closeGame = useCallback(async () => {
    setIsOpen(false);
    const idleState = { turn: null, stage: 'idle', type: null, content: '' };

    if (gameId) {
      await supabase
        .from('game_invitations')
        .update({ status: 'completed' })
        .eq('id', gameId);
    }

    syncGame(null, idleState);
  }, [gameId, syncGame]);

  return {
    isOpen,
    gameState,
    gameId,
    startGame,
    pickType,
    sendChallenge,
    completeTurn,
    closeGame,
    setIsOpen,
  };
};