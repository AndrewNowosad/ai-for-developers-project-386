import { Routes, Route } from 'react-router-dom';
import BookingPage from './pages/BookingPage';
import ManagePage from './pages/ManagePage';

export default function App() {
  return (
    <Routes>
      <Route path="/:slug/manage" element={<ManagePage />} />
      <Route path="/:slug" element={<BookingPage />} />
    </Routes>
  );
}
