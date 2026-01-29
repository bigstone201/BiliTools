// src/content/content.js

// 1. 修改默认配置：只保留B站原生倍数，去掉 2.5 和 3.0
// 只有当用户从未设置过插件时，才会用这个默认值
const DEFAULT_RATES = [2.0, 1.5, 1.25, 1.0, 0.75, 0.5];

function init() {
  chrome.storage.sync.get(['customSpeeds'], (result) => {
    // 读取用户设置，如果没有设置过，就用上面的默认值
    let userRates = result.customSpeeds || DEFAULT_RATES;

    // 安全检查：确保一定有 1.0x (防止用户误删导致无法恢复正常速度)
    if (!userRates.includes(1.0)) {
      userRates.push(1.0);
    }

    observePlayer(userRates);
  });
}

function injectMenu(rates) {
  const menuUl = document.querySelector('.bpx-player-ctrl-playbackrate-menu');
  if (!menuUl || menuUl.hasAttribute('data-pro-speed-injected')) return;

  menuUl.innerHTML = '';

  // 【关键修改】：不再强制合并原生倍数，直接使用传入的 rates
  // 只做去重和排序
  const allRates = Array.from(new Set(rates)).sort((a, b) => b - a);

  allRates.forEach(rate => {
    const li = document.createElement('li');
    li.className = 'bpx-player-ctrl-playbackrate-menu-item';
    li.dataset.value = rate;
    li.textContent = rate + 'x';

    li.addEventListener('click', () => {
      const video = document.querySelector('video');
      if(video) video.playbackRate = rate;

      const resultDiv = document.querySelector('.bpx-player-ctrl-playbackrate-result');
      if(resultDiv) resultDiv.textContent = rate + 'x';

      document.querySelectorAll('.bpx-player-ctrl-playbackrate-menu-item').forEach(item => {
        item.classList.remove('bpx-state-active');
      });
      li.classList.add('bpx-state-active');
    });

    menuUl.appendChild(li);
  });

  menuUl.setAttribute('data-pro-speed-injected', 'true');
  console.log('Bilibili Pro Speed: 菜单已更新', allRates);
}

function observePlayer(rates) {
  const observer = new MutationObserver(() => {
    const menu = document.querySelector('.bpx-player-ctrl-playbackrate-menu');
    // 如果菜单被B站重置了（失去了我们的标记），就重新注入
    if (menu && !menu.hasAttribute('data-pro-speed-injected')) {
      injectMenu(rates);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// 监听来自 Popup 的实时消息（可选，为了让保存后立即生效）
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (changes.customSpeeds) {
    // 如果发现存储变了，强制移除标记，触发重新注入
    const menu = document.querySelector('.bpx-player-ctrl-playbackrate-menu');
    if (menu) menu.removeAttribute('data-pro-speed-injected');
    // 重新获取新值并注入（这里简化处理，依赖 Observer 下次循环或手动触发）
    // 为了体验更好，建议刷新页面，或者在这里写复杂的动态更新逻辑
    // 目前最稳妥的方式是：Popup 保存后提示用户刷新，或者我们自动刷新
  }
});

init();