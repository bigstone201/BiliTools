// src/content/content.js

const DEFAULT_RATES = [2.0, 1.5, 1.25, 1.0, 0.75, 0.5];
let hoverListenerAttached = false;
let currentTargetRate = null; // 用户在菜单选中的基础倍数

// 状态标记
let isLongPressing = false; // 是否正在长按右键
let hoverListenerBound = false; // 防止重复绑定键盘事件

// 全局设置
let globalSettings = {
  enableChipmunk: true,
  longPressSpeed: 3.0 // 默认 3.0
};

function init() {
  chrome.storage.sync.get(['customSpeeds', 'settings'], (result) => {
    let userRates = result.customSpeeds || DEFAULT_RATES;
    if (!userRates.includes(1.0)) userRates.push(1.0);

    if (result.settings) {
      globalSettings = { ...globalSettings, ...result.settings };
    }

    setTimeout(() => {
      const v = document.querySelector('video');
      if (v) {
        currentTargetRate = v.playbackRate;
        setupKeyboardListener(); // 初始化键盘监听
      }
      observePlayer(userRates);
    }, 500);
  });
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings) {
    globalSettings = { ...globalSettings, ...changes.settings.newValue };
    // 如果当前正在长按，实时更新长按速度
    if (isLongPressing) {
      applySpeed(globalSettings.longPressSpeed, true);
    }
  }
  if (changes.customSpeeds) {
    const menu = document.querySelector('.bpx-player-ctrl-playbackrate-menu');
    if (menu) menu.removeAttribute('data-pro-speed-injected');
  }
});

/**
 * 应用倍数
 * @param {number} rate 目标倍数
 * @param {boolean} isTemporary 是否为临时倍数（如长按触发），如果是临时，不更新全局currentTargetRate
 */
function applySpeed(rate, isTemporary = false) {
  const video = document.querySelector('video');
  if (!video) return;

  // 如果不是临时变送（长按），则更新“标准答案”
  if (!isTemporary) {
    currentTargetRate = rate;
  }

  // --- 花栗鼠音调逻辑 ---
  const CHIPMUNK_THRESHOLD = 7.0;
  if (globalSettings.enableChipmunk) {
    if (rate >= CHIPMUNK_THRESHOLD) {
      video.preservesPitch = false;
      video.mozPreservesPitch = false;
      video.webkitPreservesPitch = false;
    } else {
      video.preservesPitch = true;
      video.mozPreservesPitch = true;
      video.webkitPreservesPitch = true;
    }
  } else {
    video.preservesPitch = true;
    video.mozPreservesPitch = true;
    video.webkitPreservesPitch = true;
  }

  video.playbackRate = rate;
}

/**
 * 防篡改逻辑
 */
function setupAntiReset(video) {
  if (video.hasAttribute('data-pro-speed-guardian')) return;

  video.addEventListener('ratechange', (e) => {
    if (currentTargetRate === null) return;

    // 如果正在长按中，B站代码或我们也正在修改倍数，这时候不要触发重置
    if (isLongPressing) return;

    // 只有当非长按状态下，速度变了，才强制恢复
    if (Math.abs(video.playbackRate - currentTargetRate) > 0.1) {
      applySpeed(currentTargetRate);
    }
  });

  video.setAttribute('data-pro-speed-guardian', 'true');
}

/**
 * 【新增】键盘长按监听
 * 完美复刻 B站 原生体验：短按快进，长按加速
 */
function setupKeyboardListener() {
  if (hoverListenerBound) return;

  // 监听按键按下
  document.addEventListener('keydown', (e) => {
    // 只处理右箭头，且必须聚焦在 body 或 video 上（防止在输入框打字时触发）
    if (e.key === 'ArrowRight' &&
        (document.activeElement === document.body || document.activeElement.tagName === 'VIDEO')) {

      // e.repeat 为 true 表示按键被一直按着
      if (e.repeat) {
        if (!isLongPressing) {
          isLongPressing = true;
          // 显示自定义的长按倍数
          applySpeed(globalSettings.longPressSpeed, true);
          showToast(`🚀 ${globalSettings.longPressSpeed}x`);
        }
      }
    }
  });

  // 监听按键松开
  document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowRight') {
      if (isLongPressing) {
        isLongPressing = false;
        // 松手后，恢复到之前选中的倍数
        applySpeed(currentTargetRate);
        showToast(`已恢复 ${currentTargetRate}x`);
      }
    }
  });

  hoverListenerBound = true;
}

// 简单的屏幕中间提示 (Toast)，让用户知道长按生效了
function showToast(text) {
  const resultDiv = document.querySelector('.bpx-player-ctrl-playbackrate-result');
  if (resultDiv) resultDiv.textContent = text;
}

// ... 以下是之前的 UI 逻辑 (injectMenu, snapToActive, observePlayer) ...

function snapToActive(menuUl) {
  if (!menuUl) return;
  const activeItem = menuUl.querySelector('.bpx-state-active');
  if (!activeItem) return;
  const prevDisplay = menuUl.style.display;
  const prevVisibility = menuUl.style.visibility;
  menuUl.style.display = 'block';
  menuUl.style.visibility = 'hidden';
  const targetScroll = activeItem.offsetTop - (menuUl.clientHeight / 2) + (activeItem.clientHeight / 2);
  menuUl.scrollTop = targetScroll;
  menuUl.style.display = prevDisplay;
  menuUl.style.visibility = prevVisibility;
}

function injectMenu(rates) {
  const menuUl = document.querySelector('.bpx-player-ctrl-playbackrate-menu');
  if (!menuUl || menuUl.hasAttribute('data-pro-speed-injected')) return;

  const video = document.querySelector('video');
  if (video) {
    setupAntiReset(video);
    if (currentTargetRate === null) currentTargetRate = video.playbackRate;
  }

  menuUl.innerHTML = '';
  const allRates = Array.from(new Set(rates)).sort((a, b) => b - a);

  allRates.forEach(rate => {
    const li = document.createElement('li');
    li.className = 'bpx-player-ctrl-playbackrate-menu-item';
    li.dataset.value = rate;
    li.textContent = rate + 'x';

    if (currentTargetRate && Math.abs(currentTargetRate - rate) < 0.01) {
      li.classList.add('bpx-state-active');
    }

    li.addEventListener('click', (e) => {
      e.stopPropagation();
      // 菜单点击，isTemporary = false，更新标准答案
      applySpeed(rate, false);

      const resultDiv = document.querySelector('.bpx-player-ctrl-playbackrate-result');
      if (resultDiv) resultDiv.textContent = rate + 'x';

      menuUl.querySelectorAll('.bpx-player-ctrl-playbackrate-menu-item').forEach(item => {
        item.classList.remove('bpx-state-active');
      });
      li.classList.add('bpx-state-active');
    });

    menuUl.appendChild(li);
  });

  menuUl.setAttribute('data-pro-speed-injected', 'true');
}

function setupGlobalHoverListener() {
  if (hoverListenerAttached) return;
  document.body.addEventListener('mouseenter', (e) => {
    const target = e.target;
    if (target && target.classList && target.classList.contains('bpx-player-ctrl-playbackrate')) {
      const menuUl = target.querySelector('.bpx-player-ctrl-playbackrate-menu');
      if (menuUl) snapToActive(menuUl);
    }
  }, true);
  hoverListenerAttached = true;
}

function observePlayer(rates) {
  const observer = new MutationObserver(() => {
    const menu = document.querySelector('.bpx-player-ctrl-playbackrate-menu');
    const video = document.querySelector('video');

    if (video && !video.hasAttribute('data-pro-speed-guardian')) {
      setupAntiReset(video);
      setupKeyboardListener(); // 确保 Video 重建后键盘监听依然有效
    }

    if (menu && !menu.hasAttribute('data-pro-speed-injected')) {
      injectMenu(rates);
      setupGlobalHoverListener();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

init();