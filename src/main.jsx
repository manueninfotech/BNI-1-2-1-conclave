import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import './index.css';
import { broadcastTabMessage, subscribeTabMessages } from './utils/syncBus';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

/**
 * Cross-tab query invalidator:
 * Invalidates the query in this tab AND broadcasts an event so all other open tabs
 * in the user's browser immediately refresh with 0ms delay!
 */
export function syncInvalidate(queryKey) {
  queryClient.invalidateQueries({ queryKey });
  broadcastTabMessage({ type: 'INVALIDATE_QUERY', queryKey });
}

// Listen for updates from other open browser tabs
subscribeTabMessages((msg) => {
  if (msg.type === 'INVALIDATE_QUERY' && msg.queryKey) {
    queryClient.invalidateQueries({ queryKey: msg.queryKey });
  } else if (msg.type === 'SET_QUERY_DATA' && msg.queryKey && msg.data) {
    queryClient.setQueryData(msg.queryKey, msg.data);
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
