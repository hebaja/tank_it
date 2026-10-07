import { Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing';
import Play from './pages/Play';

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/play/:roomId" element={<Play />} />
        </Routes>
    );
}
