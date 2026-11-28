import { mount } from 'svelte';
import './design-system.css';
import './global.css';
import App from './App.svelte';

mount(App, { target: document.getElementById('app') });
