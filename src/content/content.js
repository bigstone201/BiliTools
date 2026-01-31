// src/content/content.js

const DEFAULT_RATES = [2.0, 1.5, 1.25, 1.0, 0.75, 0.5];
let hoverListenerAttached = false;
let currentTargetRate = null; // 当前锁定的目标倍数

// 全局设置 (默认值)
let globalSettings = {
  enableChipmunk: true
};

function init() {
  // 同时读取倍数和设置
  chrome.storage.sync.get(['customSpeeds', 'settings'], (result) => {
    let userRates = result.customSpeeds || DEFAULT_RATES;
    if (!userRates.includes(1.0)) userRates.push(1.0);

    // 加载用户设置
    if (result.settings) {
      globalSettings = { ...globalSettings, ...result.settings };
    }

    // 延迟执行以确保 Video 元素存在
    setTimeout(() => {
      const v = document.querySelector('video');
      if (v) currentTargetRate = v.playbackRate;
      observePlayer(userRates);
    }, 500);
  });
}

// 实时监听配置变化 (比如用户在Popup里开关了花栗鼠模式)
chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings) {
    globalSettings = { ...globalSettings, ...changes.settings.newValue };
    // 如果当前正在播放，立即重新应用倍数以刷新音调设置
    if (currentTargetRate) applySpeed(currentTargetRate);
  }
  // 倍数列表变化逻辑在下方 handle customSpeeds
  if (changes.customSpeeds) {
    const menu = document.querySelector('.bpx-player-ctrl-playbackrate-menu');
    if (menu) menu.removeAttribute('data-pro-speed-injected');
  }
});

/**
 * 【核心逻辑】应用倍数 + 音调控制 (花栗鼠模式)
 */
function applySpeed(rate) {
  const video = document.querySelector('video');
  if (!video) return;

  currentTargetRate = rate;
  const CHIPMUNK_THRESHOLD = 7.0; // 开启变调的阈值

  if (globalSettings.enableChipmunk) {
    // 开启模式：超过阈值则关闭 Pitch Preservation (变声但流畅)
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
    // 关闭模式：始终保持原声
    video.preservesPitch = true;
    video.mozPreservesPitch = true;
    video.webkitPreservesPitch = true;
  }

  video.playbackRate = rate;
}

/**
 * 【防篡改】防止B站重置倍数
 */
function setupAntiReset(video) {
  if (video.hasAttribute('data-pro-speed-guardian')) return;

  video.addEventListener('ratechange', (e) => {
    if (currentTargetRate === null) return;
    // 允许 0.1 的浮动误差
    if (Math.abs(video.playbackRate - currentTargetRate) > 0.1) {
      applySpeed(currentTargetRate);
    }
  });

  video.setAttribute('data-pro-speed-guardian', 'true');
}

/**
 * 【UI交互】幽灵显形滚动 (瞬间定位到当前倍数)
 */
function snapToActive(menuUl) {
  if (!menuUl) return;

  const activeItem = menuUl.querySelector('.bpx-state-active');
  if (!activeItem) return;

  const prevDisplay = menuUl.style.display;
  const prevVisibility = menuUl.style.visibility;

  // 强制不可见渲染，计算高度
  menuUl.style.display = 'block';
  menuUl.style.visibility = 'hidden';

  const targetScroll = activeItem.offsetTop - (menuUl.clientHeight / 2) + (activeItem.clientHeight / 2);
  menuUl.scrollTop = targetScroll;

  // 还原状态
  menuUl.style.display = prevDisplay;
  menuUl.style.visibility = prevVisibility;
}

/**
 * 【UI注入】生成倍数菜单
 */
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

    // 高亮判断
    if (currentTargetRate && Math.abs(currentTargetRate - rate) < 0.01) {
      li.classList.add('bpx-state-active');
    }

    li.addEventListener('click', (e) => {
      e.stopPropagation();
      applySpeed(rate); // 调用核心应用函数

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

/**
 * 【事件委托】全局监听鼠标移入倍数区域
 */
function setupGlobalHoverListener() {
  if (hoverListenerAttached) return;

  document.body.addEventListener('mouseenter', (e) => {
    const target = e.target;
    if (target && target.classList && target.classList.contains('bpx-player-ctrl-playbackrate')) {
      const menuUl = target.querySelector('.bpx-player-ctrl-playbackrate-menu');
      if (menuUl) {
        snapToActive(menuUl);
      }
    }
  }, true);

  hoverListenerAttached = true;
}

/**
 * 【观察者】处理B站动态DOM加载
 */
function observePlayer(rates) {
  const observer = new MutationObserver(() => {
    const menu = document.querySelector('.bpx-player-ctrl-playbackrate-menu');
    const video = document.querySelector('video');

    // 重新挂载防篡改
    if (video && !video.hasAttribute('data-pro-speed-guardian')) {
      setupAntiReset(video);
    }

    // 重新注入菜单
    if (menu && !menu.hasAttribute('data-pro-speed-injected')) {
      injectMenu(rates);
      setupGlobalHoverListener();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

init();