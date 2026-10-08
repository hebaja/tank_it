import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { Color } from './game/config/color';

const STORAGE_KEY = 'tankit-color';

function initialColor(): Color {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    return Object.values(Color).includes(saved as Color)
        ? (saved as Color)
        : Color.blue;
}

interface Session {
    color: Color;
    setColor: (color: Color) => void;
}

const SessionContext = createContext<Session>({ color: Color.blue, setColor: () => {} });

export function SessionProvider({ children }: { children: ReactNode }) {
    const [color, setColorState] = useState<Color>(initialColor);

    const setColor = (next: Color) => {
        setColorState(next);
        sessionStorage.setItem(STORAGE_KEY, next);
    };

    return (
        <SessionContext.Provider value={{ color, setColor }}>
            {children}
        </SessionContext.Provider>
    );
}

export function useSession() {
    return useContext(SessionContext);
}
