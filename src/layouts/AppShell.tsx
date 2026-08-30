import { Outlet, useLocation } from 'react-router-dom';

export function AppShell() {
  const location = useLocation();
  const onHome = location.pathname === '/';
  const onSimulator = location.pathname.startsWith('/simulator/');

  return (
    <div className='flex h-screen flex-col overflow-hidden bg-[#090d12] text-[#f4f7fa]'>
      <main
        key={location.pathname}
        className={`min-h-0 flex-1 ${onHome ? 'overflow-hidden' : ''} ${onSimulator ? 'simulator-route-enter' : ''}`}
      >
        <Outlet />
      </main>
    </div>
  );
}
