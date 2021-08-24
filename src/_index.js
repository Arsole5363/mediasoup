import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import { Whiteboard} from './Whiteboard';
// import {DrawArea} from './Canvas';
import App from './App';
import * as serviceWorker from './serviceWorker';

// ReactDOM.render(<Whiteboard />, document.getElementById("root"));

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);

serviceWorker.unregister();
