import React from 'react';
import { render } from 'react-dom';
import { Provider } from 'react-redux';

import { store } from './_helpers';
import { App } from './App/';
import "./index.css";
import { ThemeProvider } from 'styled-components';
import theme from './styles/theme';

render(
    <ThemeProvider theme={theme}>
        <Provider store={store}>
            <App />
        </Provider>
    </ThemeProvider>
    ,
    document.getElementById('root')
);