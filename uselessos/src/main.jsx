import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { createRoot } from 'react-dom/client'

createRoot(document.getElementById('root')).render(
    <HashRouter>
        <App />
    </HashRouter>
)