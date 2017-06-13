import React from 'react';
import ReactDOM from 'react-dom';
import testMsg from './test-module';

console.log(testMsg);

const root = document.createElement('div');
document.body.appendChild(root);

ReactDOM.render(<h1>Bilt + React yo</h1>, root);
