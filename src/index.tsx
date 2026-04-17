import React from 'react';
import ReactDOM from 'react-dom';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');
ReactDOM.render(<App />, root);
