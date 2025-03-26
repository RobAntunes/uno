import React from 'react';
import styles from './app.module.css';

export function App() {
  return (
    <div className={styles.app}>
      <header className="flex">
        <h1>Welcome to Uno!</h1>
      </header>
      <main>
        <p>
          Your Electron app is ready!
        </p>
      </main>
    </div>
  );
}

export default App;
