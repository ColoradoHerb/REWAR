import type { PropsWithChildren } from 'react';

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#020617',
        color: '#e2e8f0',
        fontFamily: 'Arial, sans-serif',
        padding: 24,
      }}
    >
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>REWAR</h1>
        <p style={{ margin: '8px 0 0', color: '#94a3b8' }}>
          Browser grand strategy prototype scaffold
        </p>
      </header>
      <main>{children}</main>
    </div>
  );
}

