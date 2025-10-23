const DEFAULT_DURATION = 1800;
const ENTER_CLASS = 'game-alert--visible';
const EXIT_CLASS = 'game-alert--leaving';

export type NotificationOptions = {
  duration?: number;
  variant?: string;
};

class NotificationManager {
  private container: HTMLDivElement;

  constructor() {
    this.container = this._resolveContainer();
  }

  notify(message: string, options: NotificationOptions = {}): void {
    const { duration = DEFAULT_DURATION, variant = 'default' } = options;
    if (!this.container || !message) return;

    const alert = document.createElement('div');
    alert.className = `game-alert game-alert--${variant}`;
    alert.textContent = message;
    alert.setAttribute('role', 'status');
    alert.setAttribute('aria-live', 'polite');

    this.container.appendChild(alert);

    requestAnimationFrame(() => {
      alert.classList.add(ENTER_CLASS);
    });

    const hide = () => {
      if (!alert.classList.contains(EXIT_CLASS)) {
        alert.classList.remove(ENTER_CLASS);
        alert.classList.add(EXIT_CLASS);
        window.setTimeout(removeIfOrphaned, 240);
      }
    };

    const remove = () => {
      alert.removeEventListener('transitionend', onTransitionEnd);
      if (alert.parentElement === this.container) {
        this.container.removeChild(alert);
      }
    };

    const removeIfOrphaned = () => {
      if (alert.parentElement === this.container) {
        remove();
      }
    };

    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.propertyName === 'opacity' && alert.classList.contains(EXIT_CLASS)) {
        remove();
      }
    };

    const timeoutId = window.setTimeout(() => {
      hide();
      window.clearTimeout(timeoutId);
    }, Math.max(0, duration));

    alert.addEventListener('transitionend', onTransitionEnd);
  }

  private _resolveContainer(): HTMLDivElement {
    const existing = document.getElementById('gameAlerts');
    if (existing instanceof HTMLDivElement) return existing;

    const fallback = document.createElement('div');
    fallback.id = 'gameAlerts';
    fallback.className = 'game-alerts';
    fallback.setAttribute('aria-live', 'polite');
    document.body.appendChild(fallback);
    return fallback;
  }
}

const notificationManager = new NotificationManager();

export function showNotification(message: string, options?: NotificationOptions): void {
  notificationManager.notify(message, options);
}

export function showHeartGainNotification(): void {
  showNotification('+1 HEART', { variant: 'heart' });
}
