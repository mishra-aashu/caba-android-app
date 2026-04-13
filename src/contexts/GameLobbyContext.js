import { createContext, useContext } from 'react';

export const GameLobbyContext = createContext(null);

export const useGameLobby = () => useContext(GameLobbyContext);

export default GameLobbyContext;
