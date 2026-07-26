(function() {
  'use strict';

  let currentUser = null;

  const authSection = document.getElementById('auth-section');
  const postSection = document.getElementById('post-section');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const loginError = document.getElementById('login-error');
  const registerError = document.getElementById('register-error');
  const postError = document.getElementById('post-error');
  const postSuccess = document.getElementById('post-success');
  const feed = document.getElementById('feed');
  const tabs = document.querySelectorAll('.dc-tab');
  const postText = document.getElementById('post-text');
  const charCount = document.getElementById('char-count');
  const postImage = document.getElementById('post-image');
  const fileName = document.getElementById('file-name');

  async function api(path, options = {}) {
    const res = await fetch(path, {
      credentials: 'same-origin',
      ...options
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  async function checkMe() {
    try {
      const data = await api('/api/me');
      currentUser = data.user;
      updateAuthUI();
      loadPosts();
    } catch (e) {
      currentUser = null;
      updateAuthUI();
      loadPosts();
    }
  }

  function updateAuthUI() {
    if (currentUser) {
      authSection.classList.add('hidden');
      postSection.classList.remove('hidden');
      document.getElementById('current-username').textContent = currentUser.username;
    } else {
      authSection.classList.remove('hidden');
      postSection.classList.add('hidden');
    }
  }

  function showError(el, msg) {
    el.textContent = msg;
    el.style.display = 'block';
  }

  function hideError(el) {
    el.textContent = '';
    el.style.display = 'none';
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabName = tab.dataset.tab;
      if (tabName === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
      } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
      }
      hideError(loginError);
      hideError(registerError);
    });
  });

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    hideError(loginError);
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    try {
      const data = await api('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      currentUser = data.user;
      loginForm.reset();
      updateAuthUI();
      loadPosts();
    } catch (e) {
      showError(loginError, e.message);
    }
  });

  registerForm.addEventListener('submit', async e => {
    e.preventDefault();
    hideError(registerError);
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    try {
      const data = await api('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      currentUser = data.user;
      registerForm.reset();
      updateAuthUI();
      loadPosts();
    } catch (e) {
      showError(registerError, e.message);
    }
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      await api('/api/logout', { method: 'POST' });
      currentUser = null;
      updateAuthUI();
    } catch (e) {
      console.error('Logout failed', e);
    }
  });

  postText.addEventListener('input', () => {
    charCount.textContent = postText.value.length;
  });

  postImage.addEventListener('change', () => {
    const file = postImage.files[0];
    fileName.textContent = file ? file.name : 'No image selected';
  });

  document.getElementById('post-form').addEventListener('submit', async e => {
    e.preventDefault();
    hideError(postError);
    hideError(postSuccess);

    const text = postText.value.trim();
    const image = postImage.files[0];

    const formData = new FormData();
    formData.append('text', text);
    if (image) formData.append('image', image);

    try {
      await api('/api/posts', {
        method: 'POST',
        body: formData
      });
      document.getElementById('post-form').reset();
      charCount.textContent = '0';
      fileName.textContent = 'No image selected';
      showError(postSuccess, 'Post shared successfully!');
      postSuccess.style.color = '#43a047';
      postSuccess.style.display = 'block';
      loadPosts();
    } catch (e) {
      showError(postError, e.message);
    }
  });

  async function deletePost(id) {
    if (!confirm('Delete this post?')) return;
    try {
      await api(`/api/posts/${id}`, { method: 'DELETE' });
      loadPosts();
    } catch (e) {
      alert(e.message);
    }
  }

  function formatTime(iso) {
    const date = new Date(iso + 'Z');
    return date.toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  async function loadPosts() {
    feed.innerHTML = '<div class="dc-loading">Loading posts...</div>';
    try {
      const data = await api('/api/posts');
      if (!data.posts || data.posts.length === 0) {
        feed.innerHTML = '<div class="dc-empty">No posts yet. Be the first to share!</div>';
        return;
      }
      feed.innerHTML = data.posts.map(post => {
        const initials = post.username.slice(0, 2).toUpperCase();
        const canDelete = currentUser && currentUser.id === post.user_id;
        return `
          <div class="dc-post" data-post-id="${post.id}">
            <div class="dc-post-header">
              <div class="dc-post-author">
                <div class="dc-avatar">${initials}</div>
                <div class="dc-post-meta">
                  <span class="dc-post-username">${escapeHtml(post.username)}</span>
                  <span class="dc-post-time">${formatTime(post.created_at)}</span>
                </div>
              </div>
              ${canDelete ? `<button class="dc-post-delete" data-delete="${post.id}"><i class="fas fa-trash"></i></button>` : ''}
            </div>
            <div class="dc-post-text">${escapeHtml(post.text)}</div>
            ${post.image_url ? `<img class="dc-post-image" src="${escapeHtml(post.image_url)}" alt="Post image">` : ''}
          </div>
        `;
      }).join('');

      document.querySelectorAll('[data-delete]').forEach(btn => {
        btn.addEventListener('click', () => deletePost(parseInt(btn.dataset.delete, 10)));
      });
    } catch (e) {
      feed.innerHTML = `<div class="dc-empty">Could not load posts: ${escapeHtml(e.message)}</div>`;
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  checkMe();
})();
