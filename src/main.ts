import './style.css';
import { toast } from './app/dom';
import { showTitle } from './app/screens/title';

// スマホのみで開発・デバッグする前提の足回り（docs/design.md 9.3）
window.addEventListener('error', (e) => {
  toast(`エラー: ${e.message}`, true);
});
window.addEventListener('unhandledrejection', (e) => {
  toast(`エラー: ${String(e.reason)}`, true);
});

if (new URLSearchParams(location.search).has('debug')) {
  import('eruda').then((eruda) => eruda.default.init());
}

showTitle();
