/**
 * main.js – Global helpers: theme switcher, sound feedback wiring, UI polish.
 * Loaded on every page; dependencies: SoundFeedback (loaded first).
 */

(function() {
  'use strict';

  // ---- DOM Ready ----
  document.addEventListener('DOMContentLoaded', () => {
    console.log('Racksson Main UI initialized.');

    // 1. Restore saved theme
    const savedTheme = localStorage.getItem('racksson-theme');
    if (savedTheme) {
      document.documentElement.classList.add(savedTheme);
    }

    // 2. Wire feedback to all interactive elements
    wireFeedback();

    // 3. Add pulsing effect to buttons (only if not already styled)
    document.querySelectorAll('.btn, .btn-pro, .sound-pad').forEach(el => {
      el.addEventListener('mouseenter', () => el.classList.add('pulsing'));
      el.addEventListener('mouseleave', () => el.classList.remove('pulsing'));
    });

    // 4. Auto‑init SoundFeedback on first user interaction (guarded)
    const firstInteraction = () => {
      if (window.SoundFeedback) {
        SoundFeedback.init();
        // also resume any suspended audio context
        SoundFeedback.resume();
      }
      document.removeEventListener('click', firstInteraction);
      document.removeEventListener('touchstart', firstInteraction);
    };
    document.addEventListener('click', firstInteraction);
    document.addEventListener('touchstart', firstInteraction);
  });

  // ---- Feedback Wiring ----
  function wireFeedback() {
    // Buttons, clickable elements
    const clickables = document.querySelectorAll(
      '.btn, .btn-pro, .sound-pad, [role="button"], button, .clickable, .seq-step, .chakra-pill button'
    );
    clickables.forEach(el => {
      el.addEventListener('click', function(e) {
        // avoid double‑fire if element already has its own feedback
        if (window.SoundFeedback && !e.defaultPrevented) {
          SoundFeedback.click(0.3, 0.06);
        }
      });
    });

    // Range sliders (throttled)
    document.querySelectorAll('input[type="range"]').forEach(slider => {
      slider.addEventListener('input', function(e) {
        if (!this._fbTimeout) {
          this._fbTimeout = setTimeout(() => {
            this._fbTimeout = null;
            if (window.SoundFeedback) {
              SoundFeedback.click(0.15, 0.03);
            }
          }, 80);
        }
      });
    });

    // Checkboxes / toggle switches
    document.querySelectorAll('input[type="checkbox"], .toggle-input').forEach(toggle => {
      toggle.addEventListener('change', function(e) {
        if (window.SoundFeedback) {
          SoundFeedback.toggle(this.checked);
        }
      });
    });

    // Form submissions (success feedback)
    document.querySelectorAll('form').forEach(form => {
      form.addEventListener('submit', function(e) {
        // After a short delay, play success if submission likely succeeded
        setTimeout(() => {
          if (window.SoundFeedback) SoundFeedback.success();
        }, 400);
      });
    });
  }

  // ---- Theme Switcher (exposed globally) ----
  window.switchTheme = function(name) {
    const themes = ['theme-golden', 'theme-indigo', 'theme-violet'];
    themes.forEach(cls => document.documentElement.classList.remove(cls));
    if (name) {
      document.documentElement.classList.add(name);
      localStorage.setItem('racksson-theme', name);
    } else {
      localStorage.removeItem('racksson-theme');
    }
    // Play feedback
    if (window.SoundFeedback) SoundFeedback.click(0.25, 0.05);
  };

  // ---- Sound Feedback Toggle (exposed globally) ----
  window.toggleSoundFeedback = function() {
    if (!window.SoundFeedback) return;
    const newState = !SoundFeedback.enabled;
    SoundFeedback.setEnabled(newState);
    // Update button state visually (optional)
    const btn = document.querySelector('.theme-controls .theme-btn:last-child');
    if (btn) {
      btn.style.opacity = newState ? '1' : '0.4';
      btn.title = newState ? 'Sound ON' : 'Sound OFF';
    }
    // Play a test sound if enabled
    if (newState && SoundFeedback.enabled) {
      setTimeout(() => SoundFeedback.click(0.2, 0.05), 50);
    }
  };

  // Also expose a global helper to trigger success/error from anywhere
  window.feedbackSuccess = function() {
    if (window.SoundFeedback) SoundFeedback.success();
  };
  window.feedbackError = function() {
    if (window.SoundFeedback) SoundFeedback.error();
  };

})();
