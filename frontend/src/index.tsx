import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import '../src/components/layouts/children/Index.css'
import App from './App';
import axios from 'axios';
import reportWebVitals from './reportWebVitals';
import { store } from './app/store';

axios.defaults.withCredentials = true; 

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
);

reportWebVitals();
