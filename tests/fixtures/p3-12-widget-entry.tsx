import { createRoot } from 'react-dom/client';
import MochiWidgetFixture from './p3-12-widget';
import '../../src/styles/global.css';
createRoot(document.getElementById('widget')!).render(<MochiWidgetFixture />);
