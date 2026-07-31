(function() {
  'use strict';

  let currentUser = null;
  let pfpObjectUrl = null;
  let pfpOffsetX = 50, pfpOffsetY = 50;
  let isDragging = false, dragStartX, dragStartY, dragStartOffX, dragStartOffY;
  let pfpHasNewFile = false;

  const authSection    = document.getElementById('auth-section');
  const postSection    = document.getElementById('post-section');
  const loginForm      = document.getElementById('login-form');
  const registerForm   = document.getElementById('register-form');
  const loginError     = document.getElementById('login-error');
  const registerError  = document.getElementById('register-error');
  const postError      = document.getElementById('post-error');
  const postSuccess    = document.getElementById('post-success');
  const feed           = document.getElementById('feed');
  const tabs           = document.querySelectorAll('.dc-tab');
  const postText       = document.getElementById('post-text');
  const charCount      = document.getElementById('char-count');
  const postImage      = document.getElementById('post-image');
  const fileName       = document.getElementById('file-name');

  // Profile UI elements
  const myAvatar       = document.getElementById('my-avatar');
  const changePfpBtn   = document.getElementById('change-pfp-btn');
  const bioInput       = document.getElementById('bio-input');
  const bioCharCount   = document.getElementById('bio-char-count');
  const saveBioBtn     = document.getElementById('save-bio-btn');
  const bioSuccess     = document.getElementById('bio-success');

  // PFP modal elements
  const pfpModal       = document.getElementById('pfp-modal');
  const pfpCropCircle  = document.getElementById('pfp-crop-circle');
  const pfpDragHint    = document.getElementById('pfp-drag-hint');
  const pfpFileInput   = document.getElementById('pfp-file-input');
  const pfpSaveBtn     = document.getElementById('pfp-save-btn');
  const pfpCancelBtn   = document.getElementById('pfp-cancel-btn');

  // Profile view modal elements
  const profileModal       = document.getElementById('profile-modal');
  const profileModalClose  = document.getElementById('profile-modal-close');
  const profileViewAvatar  = document.getElementById('profile-view-avatar');
  const profileViewUsername = document.getElementById('profile-view-username');
  const profileViewBio     = document.getElementById('profile-view-bio');
  const profileViewJoined  = document.getElementById('profile-view-joined');
  const profileViewPosts   = document.getElementById('profile-view-posts');
  const profileCallBtn     = document.getElementById('profile-call-btn');
  const incomingModal      = document.getElementById('incoming-call-modal');
  const incomingCallerName = document.getElementById('incoming-caller-name');
  const videoModal         = document.getElementById('video-call-modal');
  const remoteVideo        = document.getElementById('remote-video');
  const localVideo         = document.getElementById('local-video');
  const remotePlaceholder  = document.getElementById('remote-video-placeholder');
  const videoPeer          = document.getElementById('video-call-peer');
  const videoStatus        = document.getElementById('video-call-status');
  const videoError         = document.getElementById('video-call-error');
  const answerCallBtn      = document.getElementById('answer-call-btn');
  const declineCallBtn     = document.getElementById('decline-call-btn');
  const endCallBtn         = document.getElementById('end-call-btn');
  const closeVideoBtn      = document.getElementById('close-video-call-btn');
  const toggleMicBtn       = document.getElementById('toggle-mic-btn');
  const toggleCameraBtn    = document.getElementById('toggle-camera-btn');

  let activeCall = null;
  let peerConnection = null;
  let localStream = null;
  let signalCursor = 0;
  let incomingCall = null;
  let callPollTimer = null;
  let pendingCandidates = [];
  let remoteDescriptionReady = false;
  let iceServers = [{ urls: ['stun:stun.l.google.com:19302'] }];

  // ── API helper ──────────────────────────────────────────────────────────────
  async function api(path, options = {}) {
    const res = await fetch(path, { credentials: 'same-origin', ...options });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  // ── Session check ───────────────────────────────────────────────────────────
  async function checkMe() {
    try {
      const data = await api('/api/me');
      currentUser = data.user;
    } catch (e) {
      currentUser = null;
    }
    updateAuthUI();
    loadPosts();
  }

  // ── Auth UI ─────────────────────────────────────────────────────────────────
  async function updateAuthUI() {
    if (currentUser) {
      authSection.classList.add('hidden');
      postSection.classList.remove('hidden');
      setUsernameWithBadge(document.getElementById('current-username'), currentUser.username, currentUser.is_verified);
      updateMyAvatar();
      if (bioInput) {
        bioInput.value = currentUser.bio || '';
        if (bioCharCount) bioCharCount.textContent = bioInput.value.length;
      }
      const claimBtn = document.getElementById('dc-claim-btn');
      if (claimBtn && window.AeroDiscs) {
        try {
          const info = await AeroDiscs.getBalance();
          claimBtn.style.display = (info && info.daily_available) ? 'inline-flex' : 'none';
        } catch (e) {
          claimBtn.style.display = 'none';
        }
      }
    } else {
      authSection.classList.remove('hidden');
      postSection.classList.add('hidden');
    }
  }

  function updateMyAvatar() {
    if (!myAvatar) return;
    applyAvatarStyle(myAvatar, currentUser.pfp_url, currentUser.pfp_offset_x, currentUser.pfp_offset_y, currentUser.username);
  }

  function applyAvatarStyle(el, pfpUrl, offsetX, offsetY, username) {
    if (pfpUrl) {
      el.style.backgroundImage = `url('${pfpUrl}?t=${Date.now()}')`;
      el.style.backgroundPosition = `${offsetX}% ${offsetY}%`;
      el.style.backgroundSize = 'cover';
      el.textContent = '';
    } else {
      el.style.backgroundImage = '';
      el.style.backgroundSize = '';
      el.style.backgroundPosition = '';
      el.textContent = (username || '??').slice(0, 2).toUpperCase();
    }
  }

  function verifiedBadge(isVerified) {
    return isVerified
      ? '<img class="dc-verified-badge" src="attached_assets/verified-badge.png" title="Verified" alt="Verified">'
      : '';
  }

  function setUsernameWithBadge(el, username, isVerified) {
    if (!el) return;
    el.innerHTML = `${escapeHtml(username || '')}${verifiedBadge(isVerified)}`;
  }

  // ── Error helpers ───────────────────────────────────────────────────────────
  function showError(el, msg) { el.textContent = msg; el.style.display = 'block'; }
  function hideError(el)      { el.textContent = '';  el.style.display = 'none';  }

  // ── Tabs ────────────────────────────────────────────────────────────────────
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (tab.dataset.tab === 'login') {
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

  // ── Login ───────────────────────────────────────────────────────────────────
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

  // ── Register ────────────────────────────────────────────────────────────────
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

  // ── Logout ──────────────────────────────────────────────────────────────────
  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      await api('/api/logout', { method: 'POST' });
      currentUser = null;
      updateAuthUI();
    } catch (e) {
      console.error('Logout failed', e);
    }
  });

  // ── Post form ───────────────────────────────────────────────────────────────
  postText.addEventListener('input', () => { charCount.textContent = postText.value.length; });
  postImage.addEventListener('change', () => {
    fileName.textContent = postImage.files[0] ? postImage.files[0].name : 'No image selected';
  });

  document.getElementById('post-form').addEventListener('submit', async e => {
    e.preventDefault();
    hideError(postError);
    hideError(postSuccess);
    const text  = postText.value.trim();
    const image = postImage.files[0];
    const formData = new FormData();
    formData.append('text', text);
    if (image) formData.append('image', image);
    try {
      await api('/api/posts', { method: 'POST', body: formData });
      document.getElementById('post-form').reset();
      charCount.textContent = '0';
      fileName.textContent  = 'No image selected';
      postSuccess.textContent = 'Post shared successfully!';
      postSuccess.style.color   = '#43a047';
      postSuccess.style.display = 'block';
      loadPosts();
    } catch (e) {
      showError(postError, e.message);
    }
  });

  // ── Delete post ─────────────────────────────────────────────────────────────
  async function deletePost(id) {
    if (!confirm('Delete this post?')) return;
    try {
      await api(`/api/posts/${id}`, { method: 'DELETE' });
      loadPosts();
    } catch (e) {
      alert(e.message);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function formatTime(iso) {
    const date = new Date(iso + 'Z');
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ── Feed ────────────────────────────────────────────────────────────────────
  async function loadPosts() {
    feed.innerHTML = '<div class="dc-loading">Loading posts...</div>';
    try {
      const data = await api('/api/posts');
      if (!data.posts || data.posts.length === 0) {
        feed.innerHTML = '<div class="dc-empty">No posts yet. Be the first to share!</div>';
        return;
      }
      feed.innerHTML = data.posts.map(post => {
        const canDelete    = currentUser && currentUser.id === post.user_id;
        const avatarInline = post.pfp_url
          ? `style="background-image:url('${escapeHtml(post.pfp_url)}');background-position:${post.pfp_offset_x || 50}% ${post.pfp_offset_y || 50}%;background-size:cover;"`
          : '';
        const initials     = post.pfp_url ? '' : post.username.slice(0, 2).toUpperCase();
        const commentCount = post.comment_count || 0;
        return `
          <div class="dc-post" data-post-id="${post.id}">
            <div class="dc-post-header">
              <div class="dc-post-author">
                <div class="dc-avatar" ${avatarInline}>${initials}</div>
                <div class="dc-post-meta">
                  <span class="dc-post-username dc-username-link" data-username="${escapeHtml(post.username)}">${escapeHtml(post.username)}${verifiedBadge(post.is_verified)}</span>
                  <span class="dc-post-time">${formatTime(post.created_at)}</span>
                </div>
              </div>
              ${canDelete ? `<button class="dc-post-delete" data-delete="${post.id}"><i class="fas fa-trash"></i></button>` : ''}
            </div>
            <div class="dc-post-text">${escapeHtml(post.text)}</div>
            ${post.image_url ? `<img class="dc-post-image" src="${escapeHtml(post.image_url)}" alt="Post image">` : ''}
            <div class="dc-post-footer">
              <button class="dc-comment-toggle" data-post-id="${post.id}">
                <i class="fas fa-comment"></i>
                <span class="dc-comment-count">${commentCount}</span>
                ${commentCount === 1 ? 'comment' : 'comments'}
              </button>
            </div>
            <div class="dc-comments-section hidden" id="comments-section-${post.id}">
              <div class="dc-comments-list" id="comments-list-${post.id}"></div>
              ${currentUser ? `
                <form class="dc-comment-form" data-post-id="${post.id}">
                  <input class="dc-comment-input" type="text" placeholder="Write a comment…" maxlength="300" autocomplete="off">
                  <button type="submit" class="dc-btn-sm"><i class="fas fa-paper-plane"></i></button>
                </form>
                <p class="dc-error dc-comment-error" style="display:none;"></p>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');

      document.querySelectorAll('[data-delete]').forEach(btn => {
        btn.addEventListener('click', () => deletePost(parseInt(btn.dataset.delete, 10)));
      });
      document.querySelectorAll('.dc-username-link').forEach(el => {
        el.addEventListener('click', () => openUserProfile(el.dataset.username));
      });
      document.querySelectorAll('.dc-comment-toggle').forEach(btn => {
        btn.addEventListener('click', () => toggleComments(parseInt(btn.dataset.postId, 10)));
      });
      document.querySelectorAll('.dc-comment-form').forEach(form => {
        form.addEventListener('submit', async e => {
          e.preventDefault();
          const postId = parseInt(form.dataset.postId, 10);
          const input  = form.querySelector('.dc-comment-input');
          const errEl  = form.nextElementSibling;
          const text   = input.value.trim();
          if (!text) return;
          const submitBtn = form.querySelector('button[type="submit"]');
          submitBtn.disabled = true;
          try {
            await api(`/api/posts/${postId}/comments`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text })
            });
            input.value = '';
            if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
            await loadComments(postId);
            const toggle = document.querySelector(`.dc-comment-toggle[data-post-id="${postId}"]`);
            if (toggle) {
              const countSpan = toggle.querySelector('.dc-comment-count');
              if (countSpan) countSpan.textContent = parseInt(countSpan.textContent, 10) + 1;
            }
          } catch (err) {
            if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; }
          }
          submitBtn.disabled = false;
        });
      });
    } catch (e) {
      feed.innerHTML = `<div class="dc-empty">Could not load posts: ${escapeHtml(e.message)}</div>`;
    }
  }

  // ── Bio ─────────────────────────────────────────────────────────────────────
  if (bioInput) {
    bioInput.addEventListener('input', () => {
      if (bioCharCount) bioCharCount.textContent = bioInput.value.length;
    });
  }

  if (saveBioBtn) {
    saveBioBtn.addEventListener('click', async () => {
      const bio = (bioInput ? bioInput.value.trim() : '');
      saveBioBtn.disabled = true;
      saveBioBtn.textContent = 'Saving…';
      try {
        await api('/api/profile/bio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bio })
        });
        if (currentUser) currentUser.bio = bio;
        if (bioSuccess) {
          bioSuccess.textContent = 'Bio saved!';
          bioSuccess.style.display = 'block';
          setTimeout(() => { bioSuccess.style.display = 'none'; }, 2500);
        }
      } catch (e) {
        alert('Could not save bio: ' + e.message);
      } finally {
        saveBioBtn.disabled = false;
        saveBioBtn.textContent = 'Save Bio';
      }
    });
  }

  const dcClaimBtn = document.getElementById('dc-claim-btn');
  if (dcClaimBtn) {
    dcClaimBtn.addEventListener('click', async () => {
      if (!window.AeroDiscs) return;
      dcClaimBtn.disabled = true;
      dcClaimBtn.textContent = '…';
      try {
        const result = await AeroDiscs.claimDaily();
        dcClaimBtn.textContent = 'Got it!';
        setTimeout(() => { dcClaimBtn.style.display = 'none'; }, 1500);
        if (currentUser) currentUser.disc_balance = result.disc_balance;
        if (window.AeroDiscs.updateNavWidget) {
          AeroDiscs.updateNavWidget(result.disc_balance, false);
        }
      } catch (e) {
        alert(e.message);
        dcClaimBtn.disabled = false;
        dcClaimBtn.textContent = '+100 Discs';
      }
    });
  }

  // ── PFP modal: open ─────────────────────────────────────────────────────────
  if (changePfpBtn) {
    changePfpBtn.addEventListener('click', () => {
      pfpHasNewFile = false;
      pfpOffsetX = (currentUser && currentUser.pfp_offset_x != null) ? currentUser.pfp_offset_x : 50;
      pfpOffsetY = (currentUser && currentUser.pfp_offset_y != null) ? currentUser.pfp_offset_y : 50;

      if (currentUser && currentUser.pfp_url) {
        pfpObjectUrl = currentUser.pfp_url;
        pfpCropCircle.style.backgroundImage    = `url('${currentUser.pfp_url}?t=${Date.now()}')`;
        pfpCropCircle.style.backgroundPosition = `${pfpOffsetX}% ${pfpOffsetY}%`;
        pfpCropCircle.style.backgroundSize     = 'cover';
        pfpCropCircle.style.cursor = 'grab';
        if (pfpDragHint) pfpDragHint.style.display = 'none';
        pfpSaveBtn.disabled = false;
      } else {
        pfpObjectUrl = null;
        pfpCropCircle.style.backgroundImage = '';
        pfpCropCircle.style.cursor = 'default';
        if (pfpDragHint) pfpDragHint.style.display = 'flex';
        pfpSaveBtn.disabled = true;
      }
      if (pfpFileInput) pfpFileInput.value = '';
      pfpModal.classList.remove('hidden');
    });
  }

  // ── PFP modal: file pick ─────────────────────────────────────────────────────
  if (pfpFileInput) {
    pfpFileInput.addEventListener('change', () => {
      const file = pfpFileInput.files[0];
      if (!file) return;
      if (pfpObjectUrl && pfpObjectUrl.startsWith('blob:')) URL.revokeObjectURL(pfpObjectUrl);
      pfpObjectUrl = URL.createObjectURL(file);
      pfpHasNewFile = true;
      pfpOffsetX = 50;
      pfpOffsetY = 50;
      pfpCropCircle.style.backgroundImage    = `url('${pfpObjectUrl}')`;
      pfpCropCircle.style.backgroundPosition = '50% 50%';
      pfpCropCircle.style.backgroundSize     = 'cover';
      pfpCropCircle.style.cursor = 'grab';
      if (pfpDragHint) pfpDragHint.style.display = 'none';
      pfpSaveBtn.disabled = false;
    });
  }

  // ── PFP modal: drag to reposition ───────────────────────────────────────────
  if (pfpCropCircle) {
    pfpCropCircle.addEventListener('mousedown', e => {
      if (!pfpObjectUrl) return;
      isDragging    = true;
      dragStartX    = e.clientX;
      dragStartY    = e.clientY;
      dragStartOffX = pfpOffsetX;
      dragStartOffY = pfpOffsetY;
      pfpCropCircle.style.cursor = 'grabbing';
      e.preventDefault();
    });

    pfpCropCircle.addEventListener('touchstart', e => {
      if (!pfpObjectUrl) return;
      isDragging    = true;
      dragStartX    = e.touches[0].clientX;
      dragStartY    = e.touches[0].clientY;
      dragStartOffX = pfpOffsetX;
      dragStartOffY = pfpOffsetY;
      e.preventDefault();
    }, { passive: false });
  }

  document.addEventListener('mousemove', e => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    pfpOffsetX = Math.max(0, Math.min(100, dragStartOffX - dx * 0.5));
    pfpOffsetY = Math.max(0, Math.min(100, dragStartOffY - dy * 0.5));
    pfpCropCircle.style.backgroundPosition = `${pfpOffsetX}% ${pfpOffsetY}%`;
  });

  document.addEventListener('touchmove', e => {
    if (!isDragging) return;
    const dx = e.touches[0].clientX - dragStartX;
    const dy = e.touches[0].clientY - dragStartY;
    pfpOffsetX = Math.max(0, Math.min(100, dragStartOffX - dx * 0.5));
    pfpOffsetY = Math.max(0, Math.min(100, dragStartOffY - dy * 0.5));
    pfpCropCircle.style.backgroundPosition = `${pfpOffsetX}% ${pfpOffsetY}%`;
  }, { passive: true });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    if (pfpCropCircle && pfpObjectUrl) pfpCropCircle.style.cursor = 'grab';
  });

  document.addEventListener('touchend', () => { isDragging = false; });

  // ── PFP modal: save ─────────────────────────────────────────────────────────
  if (pfpSaveBtn) {
    pfpSaveBtn.addEventListener('click', async () => {
      pfpSaveBtn.disabled = true;
      pfpSaveBtn.textContent = 'Saving…';
      try {
        if (pfpHasNewFile && pfpFileInput && pfpFileInput.files[0]) {
          // Upload new image + position
          const formData = new FormData();
          formData.append('pfp', pfpFileInput.files[0]);
          formData.append('offset_x', pfpOffsetX);
          formData.append('offset_y', pfpOffsetY);
          const data = await api('/api/profile/pfp', { method: 'POST', body: formData });
          if (currentUser) {
            currentUser.pfp_url      = data.pfp_url;
            currentUser.pfp_offset_x = data.offset_x;
            currentUser.pfp_offset_y = data.offset_y;
          }
        } else {
          // Only update position for existing pfp
          await api('/api/profile/pfp-position', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ offset_x: pfpOffsetX, offset_y: pfpOffsetY })
          });
          if (currentUser) {
            currentUser.pfp_offset_x = pfpOffsetX;
            currentUser.pfp_offset_y = pfpOffsetY;
          }
        }
        updateMyAvatar();
        pfpModal.classList.add('hidden');
        if (pfpFileInput) pfpFileInput.value = '';
        pfpHasNewFile = false;
        loadPosts();
      } catch (e) {
        alert('Could not save: ' + e.message);
      } finally {
        pfpSaveBtn.disabled = false;
        pfpSaveBtn.textContent = 'Save';
      }
    });
  }

  // ── PFP modal: cancel ───────────────────────────────────────────────────────
  if (pfpCancelBtn) {
    pfpCancelBtn.addEventListener('click', () => {
      pfpModal.classList.add('hidden');
      if (pfpFileInput) pfpFileInput.value = '';
      pfpHasNewFile = false;
      if (pfpObjectUrl && pfpObjectUrl.startsWith('blob:')) URL.revokeObjectURL(pfpObjectUrl);
      pfpObjectUrl = null;
    });
  }

  if (pfpModal) {
    pfpModal.addEventListener('click', e => {
      if (e.target === pfpModal) pfpCancelBtn && pfpCancelBtn.click();
    });
  }

  // ── User profile modal ───────────────────────────────────────────────────────
  async function openUserProfile(username) {
    profileModal.classList.remove('hidden');
    profileViewPosts.innerHTML = '<div class="dc-loading">Loading…</div>';
    profileViewUsername.textContent = '';
    profileViewBio.textContent      = '';
    profileViewJoined.textContent   = '';
    profileViewAvatar.style.backgroundImage = '';
    profileViewAvatar.textContent   = '';

    try {
      const data    = await api(`/api/users/${encodeURIComponent(username)}`);
      const u       = data.user;
      const isSelf  = currentUser && currentUser.username === u.username;
      const loggedIn = !!currentUser;

      setUsernameWithBadge(profileViewUsername, u.username, u.is_verified);
      profileViewBio.textContent    = u.bio || '';
      profileViewJoined.textContent = u.created_at ? `Joined ${u.created_at}` : '';
      applyAvatarStyle(profileViewAvatar, u.pfp_url, u.pfp_offset_x, u.pfp_offset_y, u.username);

      if (profileCallBtn) {
        profileCallBtn.dataset.username = u.username;
        profileCallBtn.style.display = loggedIn && !isSelf ? 'inline-flex' : 'none';
      }

      const friendBtn = document.getElementById('profile-friend-btn');
      if (friendBtn) {
        if (loggedIn && !isSelf) {
          friendBtn.style.display  = 'inline-flex';
          const status = data.friend_status || 'none';
          const fid    = data.friendship_id;
          friendBtn.dataset.username = u.username;
          friendBtn.dataset.fid      = fid != null ? fid : '';
          friendBtn.dataset.status   = status;
          if (status === 'none') {
            friendBtn.innerHTML = '<i class="fas fa-user-plus"></i> Add Friend';
            friendBtn.className = 'dc-btn-secondary dc-friend-profile-btn';
          } else if (status === 'pending_sent') {
            friendBtn.innerHTML = '<i class="fas fa-user-clock"></i> Pending';
            friendBtn.className = 'dc-btn-secondary dc-friend-profile-btn dc-friend-pending';
          } else if (status === 'pending_received') {
            friendBtn.innerHTML = '<i class="fas fa-user-check"></i> Accept Request';
            friendBtn.className = 'dc-btn dc-friend-profile-btn';
          } else {
            friendBtn.innerHTML = '<i class="fas fa-user-minus"></i> Unfriend';
            friendBtn.className = 'dc-btn-secondary dc-friend-profile-btn dc-friend-remove';
          }
        } else {
          friendBtn.style.display = 'none';
        }
      }

      const dmBtn = document.getElementById('profile-dm-btn');
      if (dmBtn) {
        dmBtn.style.display    = loggedIn && !isSelf ? 'inline-flex' : 'none';
        dmBtn.dataset.username = u.username;
      }

      if (!data.posts || data.posts.length === 0) {
        profileViewPosts.innerHTML = '<div class="dc-empty">No posts yet.</div>';
      } else {
        profileViewPosts.innerHTML = data.posts.map(post => `
          <div class="dc-post">
            <div class="dc-post-text">${escapeHtml(post.text)}</div>
            ${post.image_url ? `<img class="dc-post-image" src="${escapeHtml(post.image_url)}" alt="Post image">` : ''}
            <div class="dc-post-time dc-profile-post-time">${formatTime(post.created_at)}</div>
          </div>
        `).join('');
      }
    } catch (e) {
      profileViewPosts.innerHTML = '<div class="dc-empty">Could not load profile.</div>';
    }
  }

  if (profileModalClose) {
    profileModalClose.addEventListener('click', () => profileModal.classList.add('hidden'));
  }
  if (profileModal) {
    profileModal.addEventListener('click', e => {
      if (e.target === profileModal) profileModal.classList.add('hidden');
    });
  }

  // ── One-to-one WebRTC calling ───────────────────────────────────────────────
  function setVideoError(message) {
    if (!videoError) return;
    videoError.textContent = message || '';
    videoError.style.display = message ? 'block' : 'none';
  }

  async function callApi(path, options = {}) {
    return api(path, options);
  }

  function showVideoCall(call, status) {
    activeCall = call;
    const peerIsVerified = currentUser.id === call.caller_id
      ? call.recipient_is_verified
      : call.caller_is_verified;
    const peerUsername = currentUser.id === call.caller_id
      ? call.recipient_username
      : call.caller_username;
    setUsernameWithBadge(videoPeer, peerUsername, peerIsVerified);
    videoStatus.textContent = status || 'Connecting…';
    setVideoError('');
    videoModal.classList.remove('hidden');
  }

  async function getMedia() {
    if (localStream) return localStream;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Video calling is not supported by this browser.');
    }
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideo.srcObject = localStream;
      localVideo.play().catch(() => {});
      return localStream;
    } catch (e) {
      const messages = {
        NotAllowedError: 'Camera and microphone access was blocked. In Android site settings, allow Camera and Microphone, then try again.',
        PermissionDeniedError: 'Camera and microphone access was denied. Allow both permissions for this site, then try again.',
        NotFoundError: 'No camera or microphone was found. Check that both are connected and not being used by another app.',
        NotReadableError: 'The camera or microphone is already being used by another app. Close other camera or call apps and try again.',
        OverconstrainedError: 'This device could not provide the requested camera and microphone. Check the device settings and try again.',
        SecurityError: 'Camera calling requires a secure HTTPS page. Reopen Dynamix Connect using its HTTPS address.'
      };
      const detail = messages[e.name] || 'The camera and microphone could not be started. Check browser permissions and try again.';
      throw new Error(detail);
    }
  }

  async function loadIceConfig() {
    try {
      const data = await callApi('/api/calls/config');
      if (Array.isArray(data.iceServers) && data.iceServers.length) iceServers = data.iceServers;
    } catch (e) {
      // Keep the public STUN fallback if configuration is unavailable.
    }
  }

  function createPeer() {
    if (peerConnection) return peerConnection;
    peerConnection = new RTCPeerConnection({ iceServers });
    peerConnection.onicecandidate = event => {
      if (event.candidate && activeCall) {
        sendSignal('candidate', event.candidate.toJSON()).catch(console.error);
      }
    };
    peerConnection.ontrack = event => {
      remoteVideo.srcObject = event.streams[0];
      remotePlaceholder.classList.add('hidden');
      videoStatus.textContent = 'Connected';
      remoteVideo.play().catch(() => {
        videoStatus.textContent = 'Tap the video to start playback';
      });
    };
    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'connected') videoStatus.textContent = 'Connected';
      if (['failed', 'disconnected'].includes(peerConnection.connectionState)) {
        videoStatus.textContent = 'Connection lost';
      }
    };
    if (localStream) localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    return peerConnection;
  }

  async function addPendingCandidates() {
    if (!peerConnection || !remoteDescriptionReady) return;
    const candidates = pendingCandidates.splice(0);
    for (const candidate of candidates) {
      try { await peerConnection.addIceCandidate(candidate); } catch (e) { console.warn('ICE candidate rejected', e); }
    }
  }

  async function sendSignal(type, payload) {
    if (!activeCall) return;
    await callApi(`/api/calls/${activeCall.id}/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload })
    });
  }

  async function startCallerCall(username) {
    try {
      await loadIceConfig();
      const data = await callApi('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      await getMedia();
      showVideoCall(data.call, 'Calling…');
      const pc = createPeer();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal('offer', pc.localDescription.toJSON());
      profileModal.classList.add('hidden');
      pollSignals();
    } catch (e) {
      alert(e.message);
      cleanupCall(false);
    }
  }

  async function answerIncomingCall() {
    if (!incomingCall) return;
    const call = incomingCall;
    incomingCall = null;
    incomingModal.classList.add('hidden');
    try {
      await loadIceConfig();
      await callApi(`/api/calls/${call.id}/accept`, { method: 'POST' });
      await getMedia();
      showVideoCall(call, 'Joining…');
      createPeer();
      pollSignals();
    } catch (e) {
      try { await callApi(`/api/calls/${call.id}/end`, { method: 'POST' }); } catch (endError) {}
      cleanupCall(false);
      showVideoCall(call, 'Unable to join');
      setVideoError(e.message);
      activeCall = null;
    }
  }

  async function pollIncomingCalls() {
    if (!currentUser || activeCall || incomingCall) return;
    try {
      const data = await callApi('/api/calls/incoming');
      if (data.calls && data.calls.length) {
        incomingCall = data.calls[0];
        setUsernameWithBadge(incomingCallerName, incomingCall.caller_username, incomingCall.caller_is_verified);
        incomingModal.classList.remove('hidden');
      }
    } catch (e) {
      // Anonymous visitors simply have no call inbox.
    }
  }

  async function pollSignals() {
    if (!activeCall) return;
    try {
      const data = await callApi(`/api/calls/${activeCall.id}/signals?after=${signalCursor}`);
      for (const signal of data.signals || []) {
        signalCursor = Math.max(signalCursor, signal.id);
        const pc = createPeer();
        if (signal.type === 'offer') {
          await pc.setRemoteDescription(signal.payload);
          remoteDescriptionReady = true;
          await addPendingCandidates();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal('answer', pc.localDescription.toJSON());
          videoStatus.textContent = 'Connecting…';
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(signal.payload);
          remoteDescriptionReady = true;
          await addPendingCandidates();
        } else if (signal.type === 'candidate') {
          if (remoteDescriptionReady) await pc.addIceCandidate(signal.payload);
          else pendingCandidates.push(signal.payload);
        }
      }
      if (data.status === 'ended') cleanupCall(false);
    } catch (e) {
      if (activeCall) setVideoError(e.message);
    }
    if (activeCall) setTimeout(pollSignals, 1000);
  }

  async function cleanupCall(notify = true) {
    const call = activeCall;
    activeCall = null;
    signalCursor = 0;
    pendingCandidates = [];
    remoteDescriptionReady = false;
    if (notify && call) {
      try { await callApi(`/api/calls/${call.id}/end`, { method: 'POST' }); } catch (e) {}
    }
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
    }
    if (localVideo) localVideo.srcObject = null;
    if (remoteVideo) remoteVideo.srcObject = null;
    if (remotePlaceholder) remotePlaceholder.classList.remove('hidden');
    if (videoModal) videoModal.classList.add('hidden');
    if (incomingModal) incomingModal.classList.add('hidden');
  }

  if (profileCallBtn) profileCallBtn.addEventListener('click', () => {
    if (profileCallBtn.dataset.username) startCallerCall(profileCallBtn.dataset.username);
  });
  if (answerCallBtn) answerCallBtn.addEventListener('click', answerIncomingCall);
  if (declineCallBtn) declineCallBtn.addEventListener('click', async () => {
    if (incomingCall) {
      try { await callApi(`/api/calls/${incomingCall.id}/end`, { method: 'POST' }); } catch (e) {}
    }
    incomingCall = null;
    incomingModal.classList.add('hidden');
  });
  if (endCallBtn) endCallBtn.addEventListener('click', () => cleanupCall(true));
  if (closeVideoBtn) closeVideoBtn.addEventListener('click', () => cleanupCall(true));
  if (toggleMicBtn) toggleMicBtn.addEventListener('click', () => {
    const track = localStream && localStream.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    toggleMicBtn.classList.toggle('is-off', !track.enabled);
    toggleMicBtn.innerHTML = `<i class="fas fa-microphone${track.enabled ? '' : '-slash'}"></i>`;
  });
  if (toggleCameraBtn) toggleCameraBtn.addEventListener('click', () => {
    const track = localStream && localStream.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    toggleCameraBtn.classList.toggle('is-off', !track.enabled);
    toggleCameraBtn.innerHTML = `<i class="fas fa-video${track.enabled ? '' : '-slash'}"></i>`;
  });
  if (remoteVideo) remoteVideo.addEventListener('click', () => remoteVideo.play().catch(() => {}));

  // ── Page tabs ─────────────────────────────────────────────────────────────────
  let currentPage = 'feed';

  function switchPage(page) {
    currentPage = page;
    document.querySelectorAll('.dc-page-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.page === page)
    );
    document.getElementById('page-feed').classList.toggle('hidden', page !== 'feed');
    document.getElementById('page-friends').classList.toggle('hidden', page !== 'friends');
    document.getElementById('page-messages').classList.toggle('hidden', page !== 'messages');
    if (page === 'friends') loadFriendsPage();
    if (page === 'messages') loadMessagesPage();
  }

  document.querySelectorAll('.dc-page-tab').forEach(tab => {
    tab.addEventListener('click', () => switchPage(tab.dataset.page));
  });

  // ── Friend button on profile modal ────────────────────────────────────────────
  const profileFriendBtn = document.getElementById('profile-friend-btn');
  if (profileFriendBtn) {
    profileFriendBtn.addEventListener('click', async function () {
      const btn    = this;
      const status = btn.dataset.status;
      const uname  = btn.dataset.username;
      const fid    = btn.dataset.fid ? parseInt(btn.dataset.fid, 10) : null;
      if (status === 'pending_sent' && !confirm('Cancel friend request?')) return;
      if (status === 'friends'      && !confirm('Remove this friend?'))    return;
      btn.disabled = true;
      try {
        if (status === 'none') {
          const d = await api('/api/friends/request', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: uname })
          });
          btn.dataset.status = 'pending_sent';
          btn.dataset.fid    = d.friendship_id;
          btn.innerHTML = '<i class="fas fa-user-clock"></i> Pending';
          btn.className = 'dc-btn-secondary dc-friend-profile-btn dc-friend-pending';
        } else if (status === 'pending_received' && fid) {
          await api(`/api/friends/${fid}/accept`, { method: 'POST' });
          btn.dataset.status = 'friends';
          btn.innerHTML = '<i class="fas fa-user-minus"></i> Unfriend';
          btn.className = 'dc-btn-secondary dc-friend-profile-btn dc-friend-remove';
          updateFriendBadge();
        } else if (fid) {
          const endpoint = status === 'pending_sent'
            ? `/api/friends/${fid}`
            : `/api/friends/${fid}`;
          await api(endpoint, { method: 'DELETE' });
          btn.dataset.status = 'none';
          btn.dataset.fid    = '';
          btn.innerHTML = '<i class="fas fa-user-plus"></i> Add Friend';
          btn.className = 'dc-btn-secondary dc-friend-profile-btn';
        }
      } catch (err) { alert(err.message); }
      btn.disabled = false;
    });
  }

  // ── DM button on profile modal ────────────────────────────────────────────────
  const profileDmBtn = document.getElementById('profile-dm-btn');
  if (profileDmBtn) {
    profileDmBtn.addEventListener('click', function () {
      const uname = this.dataset.username;
      profileModal.classList.add('hidden');
      switchPage('messages');
      openDmThread(uname);
    });
  }

  // ── Comments ──────────────────────────────────────────────────────────────────
  function toggleComments(postId) {
    const section = document.getElementById(`comments-section-${postId}`);
    if (!section) return;
    const willOpen = section.classList.contains('hidden');
    section.classList.toggle('hidden');
    if (willOpen) loadComments(postId);
  }

  async function loadComments(postId) {
    const listEl = document.getElementById(`comments-list-${postId}`);
    if (!listEl) return;
    listEl.innerHTML = '<div class="dc-loading" style="font-size:0.8rem;padding:0.3rem 0;">Loading…</div>';
    try {
      const data = await api(`/api/posts/${postId}/comments`);
      if (!data.comments || data.comments.length === 0) {
        listEl.innerHTML = '<div class="dc-comments-empty">No comments yet.</div>';
      } else {
        listEl.innerHTML = data.comments.map(renderComment).join('');
        listEl.querySelectorAll('[data-delete-comment]').forEach(btn => {
          btn.addEventListener('click', () => deleteComment(parseInt(btn.dataset.deleteComment, 10), postId));
        });
        listEl.querySelectorAll('.dc-comment-username').forEach(el => {
          el.addEventListener('click', () => openUserProfile(el.dataset.username));
        });
      }
    } catch (err) {
      listEl.innerHTML = '<div class="dc-comments-empty">Could not load comments.</div>';
    }
  }

  function renderComment(c) {
    const avatarInline = c.pfp_url
      ? `style="background-image:url('${escapeHtml(c.pfp_url)}');background-position:${c.pfp_offset_x || 50}% ${c.pfp_offset_y || 50}%;background-size:cover;"`
      : '';
    const initials = c.pfp_url ? '' : (c.username || '??').slice(0, 2).toUpperCase();
    const canDel   = currentUser && currentUser.id === c.user_id;
    return `
      <div class="dc-comment" data-comment-id="${c.id}">
        <div class="dc-avatar dc-avatar-xs" ${avatarInline}>${initials}</div>
        <div class="dc-comment-body">
          <div class="dc-comment-header">
            <span class="dc-comment-username dc-username-link" data-username="${escapeHtml(c.username)}">${escapeHtml(c.username)}${verifiedBadge(c.is_verified)}</span>
            <span class="dc-comment-time">${formatTime(c.created_at)}</span>
            ${canDel ? `<button class="dc-comment-delete" data-delete-comment="${c.id}" title="Delete"><i class="fas fa-trash"></i></button>` : ''}
          </div>
          <div class="dc-comment-text">${escapeHtml(c.text)}</div>
        </div>
      </div>
    `;
  }

  async function deleteComment(commentId, postId) {
    if (!confirm('Delete this comment?')) return;
    try {
      await api(`/api/comments/${commentId}`, { method: 'DELETE' });
      const el = document.querySelector(`[data-comment-id="${commentId}"]`);
      if (el) {
        el.remove();
        const toggle = document.querySelector(`.dc-comment-toggle[data-post-id="${postId}"]`);
        if (toggle) {
          const span = toggle.querySelector('.dc-comment-count');
          if (span) span.textContent = Math.max(0, parseInt(span.textContent, 10) - 1);
        }
      }
    } catch (err) { alert(err.message); }
  }

  // ── Friends page ──────────────────────────────────────────────────────────────
  async function loadFriendsPage() {
    const reqCard  = document.getElementById('friend-requests-card');
    const lstCard  = document.getElementById('friends-list-card');
    const loginMsg = document.getElementById('friends-login-prompt');
    if (!currentUser) {
      if (loginMsg) loginMsg.classList.remove('hidden');
      if (reqCard)  reqCard.classList.add('hidden');
      if (lstCard)  lstCard.classList.add('hidden');
      return;
    }
    if (loginMsg) loginMsg.classList.add('hidden');
    if (reqCard)  reqCard.classList.remove('hidden');
    if (lstCard)  lstCard.classList.remove('hidden');

    try {
      const data = await api('/api/friends');

      const reqList = document.getElementById('friend-requests-list');
      if (reqList) {
        if (!data.requests || data.requests.length === 0) {
          reqList.innerHTML = '<div class="dc-empty" style="font-size:0.85rem;">No pending requests.</div>';
        } else {
          reqList.innerHTML = data.requests.map(r => {
            const u = r.user;
            const av = u.pfp_url
              ? `style="background-image:url('${escapeHtml(u.pfp_url)}');background-position:${u.pfp_offset_x}% ${u.pfp_offset_y}%;background-size:cover;"`
              : '';
            return `
              <div class="dc-person-row">
                <div class="dc-avatar dc-avatar-sm" ${av}>${u.pfp_url ? '' : escapeHtml(u.username).slice(0,2).toUpperCase()}</div>
                <div class="dc-person-info">
                  <div class="dc-person-name dc-username-link" data-username="${escapeHtml(u.username)}">${escapeHtml(u.username)}${verifiedBadge(u.is_verified)}</div>
                </div>
                <div class="dc-person-actions">
                  <button class="dc-btn-sm dc-friend-accept" data-accept="${r.friendship_id}">Accept</button>
                  <button class="dc-btn-sm dc-friend-decline" data-decline="${r.friendship_id}">Decline</button>
                </div>
              </div>`;
          }).join('');
          reqList.querySelectorAll('[data-accept]').forEach(btn => {
            btn.addEventListener('click', async () => {
              btn.disabled = true;
              try { await api(`/api/friends/${btn.dataset.accept}/accept`, { method: 'POST' }); loadFriendsPage(); updateFriendBadge(); }
              catch (err) { alert(err.message); btn.disabled = false; }
            });
          });
          reqList.querySelectorAll('[data-decline]').forEach(btn => {
            btn.addEventListener('click', async () => {
              btn.disabled = true;
              try { await api(`/api/friends/${btn.dataset.decline}/decline`, { method: 'POST' }); loadFriendsPage(); updateFriendBadge(); }
              catch (err) { alert(err.message); btn.disabled = false; }
            });
          });
          reqList.querySelectorAll('.dc-username-link').forEach(el =>
            el.addEventListener('click', () => openUserProfile(el.dataset.username))
          );
        }
      }

      const friendsList = document.getElementById('friends-list');
      if (friendsList) {
        if (!data.friends || data.friends.length === 0) {
          friendsList.innerHTML = '<div class="dc-empty" style="font-size:0.85rem;">No friends yet — add someone from the feed!</div>';
        } else {
          friendsList.innerHTML = data.friends.map(f => {
            const u = f.user;
            const av = u.pfp_url
              ? `style="background-image:url('${escapeHtml(u.pfp_url)}');background-position:${u.pfp_offset_x}% ${u.pfp_offset_y}%;background-size:cover;"`
              : '';
            return `
              <div class="dc-person-row">
                <div class="dc-avatar dc-avatar-sm" ${av}>${u.pfp_url ? '' : escapeHtml(u.username).slice(0,2).toUpperCase()}</div>
                <div class="dc-person-info">
                  <div class="dc-person-name dc-username-link" data-username="${escapeHtml(u.username)}">${escapeHtml(u.username)}${verifiedBadge(u.is_verified)}</div>
                  ${u.bio ? `<div class="dc-person-bio">${escapeHtml(u.bio)}</div>` : ''}
                </div>
                <div class="dc-person-actions">
                  <button class="dc-btn-sm" data-dm-user="${escapeHtml(u.username)}" title="Message"><i class="fas fa-envelope"></i></button>
                  <button class="dc-btn-sm dc-friend-decline" data-unfriend="${f.friendship_id}" title="Unfriend"><i class="fas fa-user-minus"></i></button>
                </div>
              </div>`;
          }).join('');
          friendsList.querySelectorAll('.dc-username-link').forEach(el =>
            el.addEventListener('click', () => openUserProfile(el.dataset.username))
          );
          friendsList.querySelectorAll('[data-dm-user]').forEach(btn =>
            btn.addEventListener('click', () => { switchPage('messages'); openDmThread(btn.dataset.dmUser); })
          );
          friendsList.querySelectorAll('[data-unfriend]').forEach(btn => {
            btn.addEventListener('click', async () => {
              if (!confirm('Remove this friend?')) return;
              btn.disabled = true;
              try { await api(`/api/friends/${btn.dataset.unfriend}`, { method: 'DELETE' }); loadFriendsPage(); }
              catch (err) { alert(err.message); btn.disabled = false; }
            });
          });
        }
      }
    } catch (err) {
      const r = document.getElementById('friend-requests-list');
      const f = document.getElementById('friends-list');
      if (r) r.innerHTML = '<div class="dc-empty">Could not load.</div>';
      if (f) f.innerHTML = '<div class="dc-empty">Could not load.</div>';
    }
  }

  async function updateFriendBadge() {
    const badge = document.getElementById('friend-req-badge');
    if (!badge || !currentUser) { if (badge) badge.style.display = 'none'; return; }
    try {
      const data = await api('/api/friends');
      const count = (data.requests || []).length;
      badge.textContent  = count > 0 ? count : '';
      badge.style.display = count > 0 ? 'flex' : 'none';
    } catch (e) {}
  }

  // ── Messages page ─────────────────────────────────────────────────────────────
  let activeDmPeer = null;
  let dmPollTimer  = null;
  let tradeCardsMine = [];
  let tradeCardsPeer = [];
  let tradeSelectedMine = new Set();
  let tradeSelectedPeer = new Set();

  function tradeCardMarkup(card, selected) {
    const rarity = escapeHtml(card.rarity || 'Common');
    const accent = escapeHtml(card.accent || '#fff');
    return `<button type="button" class="dc-trade-card${selected ? ' selected' : ''}" data-trade-card-id="${escapeHtml(card.id)}" style="--trade-accent:${accent}">
      <span class="dc-trade-card-check"><i class="fas fa-check"></i></span>
      <img src="${escapeHtml(card.image || '')}" alt="${escapeHtml(card.name || 'Card')}">
      <span class="dc-trade-card-name">${escapeHtml(card.name || 'Mystery Card')}</span>
      <span class="dc-trade-card-rarity">${rarity}</span>
    </button>`;
  }

  function renderTradeCardGrid(elementId, cards, selected) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.innerHTML = cards.length
      ? cards.map(card => tradeCardMarkup(card, selected.has(String(card.id))).join(''))
      : '<div class="dc-empty" style="grid-column:1/-1;padding:1rem;font-size:.75rem;">No available cards.</div>';
    el.querySelectorAll('[data-trade-card-id]').forEach(button => {
      button.addEventListener('click', () => {
        const id = String(button.dataset.tradeCardId);
        if (selected.has(id)) selected.delete(id);
        else selected.add(id);
        button.classList.toggle('selected', selected.has(id));
        updateTradeSummary();
      });
    });
  }

  function updateTradeSummary() {
    const summary = document.getElementById('trade-selection-summary');
    const send = document.getElementById('trade-send-btn');
    const mine = tradeCardsMine.filter(card => tradeSelectedMine.has(String(card.id)));
    const peer = tradeCardsPeer.filter(card => tradeSelectedPeer.has(String(card.id)));
    if (summary) {
      summary.textContent = mine.length || peer.length
        ? `You give ${mine.length} card${mine.length === 1 ? '' : 's'} and receive ${peer.length} card${peer.length === 1 ? '' : 's'}. Both sides will review this exact offer before anything moves.`
        : 'Select cards on either side.';
    }
    if (send) send.disabled = !(mine.length || peer.length);
  }

  function closeTradeModal() {
    const modal = document.getElementById('trade-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }

  function tradeCardsByIds(cards, ids) {
    const selected = new Set(ids);
    return cards.filter(card => selected.has(String(card.id)));
  }

  function renderIncomingTrades(trades) {
    const el = document.getElementById('incoming-trades');
    if (!el) return;
    const incoming = trades.filter(trade => trade.is_incoming);
    const outgoing = trades.filter(trade => !trade.is_incoming);
    if (!incoming.length && !outgoing.length) {
      el.classList.add('hidden');
      el.innerHTML = '';
      return;
    }
    el.classList.remove('hidden');
    el.innerHTML = (incoming.length
      ? `<strong style="display:block;margin-bottom:.45rem;color:#ffe082;"><i class="fas fa-bell"></i> Incoming trade offer${incoming.length === 1 ? '' : 's'}</strong>` +
        incoming.map(trade => {
        const gives = trade.offered_cards.map(card => escapeHtml(card.name)).join(', ') || 'Nothing';
        const gets = trade.requested_cards.map(card => escapeHtml(card.name)).join(', ') || 'Nothing';
        return `<div class="dc-incoming-trade">
          <span><strong>${escapeHtml(trade.initiator.username)}</strong> offers <b>${gives}</b> for <b>${gets}</b>.</span>
          <div class="dc-incoming-trade-actions">
            <button type="button" class="dc-btn-sm" data-trade-accept="${trade.id}">Review &amp; accept</button>
            <button type="button" class="dc-btn-sm" data-trade-reject="${trade.id}">Decline</button>
          </div>
        </div>`;
        }).join('')
      : '') +
      (outgoing.length
        ? `<strong style="display:block;margin:.65rem 0 .45rem;color:#d8b4fe;"><i class="fas fa-clock"></i> Your pending offer${outgoing.length === 1 ? '' : 's'}</strong>` +
          outgoing.map(trade => {
            const gives = trade.offered_cards.map(card => escapeHtml(card.name)).join(', ') || 'Nothing';
            const gets = trade.requested_cards.map(card => escapeHtml(card.name)).join(', ') || 'Nothing';
            return `<div class="dc-incoming-trade">
              <span>You offer <b>${gives}</b> to <strong>${escapeHtml(trade.recipient.username)}</strong> for <b>${gets}</b>.</span>
              <div class="dc-incoming-trade-actions">
                <button type="button" class="dc-btn-sm" data-trade-cancel="${trade.id}">Cancel offer</button>
              </div>
            </div>`;
          }).join('')
        : '');
    el.querySelectorAll('[data-trade-reject]').forEach(button => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await api(`/api/trades/${button.dataset.tradeReject}/reject`, { method: 'POST' });
          await openTradeModal();
        } catch (err) { alert(err.message); button.disabled = false; }
      });
    });
    el.querySelectorAll('[data-trade-accept]').forEach(button => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          const trade = incoming.find(item => String(item.id) === String(button.dataset.tradeAccept));
          const gives = trade.offered_cards.map(card => card.name).join(', ') || 'nothing';
          const gets = trade.requested_cards.map(card => card.name).join(', ') || 'nothing';
          if (!confirm(`Final review:\n\nYou will give: ${gets}\nYou will receive: ${gives}\n\nAccept this exact trade? This cannot be undone.`)) {
            button.disabled = false;
            return;
          }
          await api(`/api/trades/${button.dataset.tradeAccept}/accept`, { method: 'POST' });
          alert('Trade completed. Your cards have been exchanged.');
          await openTradeModal();
        } catch (err) { alert(err.message); button.disabled = false; }
      });
    });
    el.querySelectorAll('[data-trade-cancel]').forEach(button => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await api(`/api/trades/${button.dataset.tradeCancel}/cancel`, { method: 'POST' });
          await openTradeModal();
        } catch (err) { alert(err.message); button.disabled = false; }
      });
    });
  }

  async function openTradeModal() {
    if (!activeDmPeer) return;
    const modal = document.getElementById('trade-modal');
    const peerName = document.getElementById('trade-peer-name');
    const errorEl = document.getElementById('trade-error');
    if (!modal) return;
    if (peerName) peerName.textContent = activeDmPeer;
    if (errorEl) errorEl.textContent = '';
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    tradeSelectedMine = new Set();
    tradeSelectedPeer = new Set();
    try {
      const [mine, peer, trades] = await Promise.all([
        api('/api/tradeable-cards/self'),
        api(`/api/tradeable-cards/${encodeURIComponent(activeDmPeer)}`),
        api(`/api/trades?with=${encodeURIComponent(activeDmPeer)}`)
      ]);
      tradeCardsMine = mine.cards || [];
      tradeCardsPeer = peer.cards || [];
      renderTradeCardGrid('trade-my-cards', tradeCardsMine, tradeSelectedMine);
      renderTradeCardGrid('trade-peer-cards', tradeCardsPeer, tradeSelectedPeer);
      renderIncomingTrades(trades.trades || []);
      updateTradeSummary();
    } catch (err) {
      tradeCardsMine = [];
      tradeCardsPeer = [];
      renderTradeCardGrid('trade-my-cards', [], tradeSelectedMine);
      renderTradeCardGrid('trade-peer-cards', [], tradeSelectedPeer);
      updateTradeSummary();
      if (errorEl) {
        errorEl.textContent = `Could not load trading data: ${err.message}`;
      }
    }
  }

  async function sendTradeOffer() {
    const send = document.getElementById('trade-send-btn');
    const mine = tradeCardsByIds(tradeCardsMine, tradeSelectedMine);
    const peer = tradeCardsByIds(tradeCardsPeer, tradeSelectedPeer);
    if (!mine.length && !peer.length || !activeDmPeer) return;
    const giveNames = mine.map(card => card.name).join(', ') || 'nothing';
    const receiveNames = peer.map(card => card.name).join(', ') || 'nothing';
    if (!confirm(`You will offer: ${giveNames}\nYou will request: ${receiveNames}\n\nThe cards will be reserved until your friend accepts or declines. Send this exact offer?`)) return;
    if (send) { send.disabled = true; send.textContent = 'Sending…'; }
    try {
      await api('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_username: activeDmPeer,
          offered_card_ids: mine.map(card => card.id),
          requested_card_ids: peer.map(card => card.id)
        })
      });
      alert('Trade offer sent. Your selected cards are reserved until your friend responds.');
      await openTradeModal();
    } catch (err) {
      alert(err.message);
    } finally {
      if (send) { send.disabled = false; send.textContent = 'Send offer'; }
    }
  }

  async function loadMessagesPage() {
    const card     = document.getElementById('messages-card');
    const loginMsg = document.getElementById('messages-login-prompt');
    if (!currentUser) {
      if (loginMsg) loginMsg.classList.remove('hidden');
      if (card)     card.classList.add('hidden');
      return;
    }
    if (loginMsg) loginMsg.classList.add('hidden');
    if (card)     card.classList.remove('hidden');
    await loadConversations();
  }

  async function loadConversations() {
    const listEl = document.getElementById('conversations-list');
    if (!listEl) return;
    try {
      const data   = await api('/api/dms');
      const convos = data.conversations || [];
      if (convos.length === 0) {
        listEl.innerHTML = '<div style="padding:1rem;color:rgba(255,255,255,0.38);font-size:0.85rem;text-align:center;">No conversations yet.</div>';
      } else {
        listEl.innerHTML = convos.map(c => {
          const u = c.user;
          const av = u.pfp_url
            ? `style="background-image:url('${escapeHtml(u.pfp_url)}');background-position:${u.pfp_offset_x}% ${u.pfp_offset_y}%;background-size:cover;"`
            : '';
          const initials = u.pfp_url ? '' : u.username.slice(0, 2).toUpperCase();
          const isActive = activeDmPeer === u.username;
          const pendingTrades = Number(c.pending_trades || 0);
          const preview = c.last_message
            ? (c.last_message.sender_id === currentUser.id ? 'You: ' : '') + escapeHtml(c.last_message.text).slice(0, 40)
            : (pendingTrades ? 'Incoming trade offer' : '');
          const unreadTotal = Number(c.unread || 0) + pendingTrades;
          return `
            <div class="dc-convo-row${isActive ? ' active' : ''}" data-dm-open="${escapeHtml(u.username)}">
              <div class="dc-avatar dc-avatar-sm" ${av}>${initials}</div>
              <div class="dc-convo-info">
                <div class="dc-convo-name">${escapeHtml(u.username)}${verifiedBadge(u.is_verified)}</div>
                ${preview ? `<div class="dc-convo-preview">${preview}</div>` : ''}
              </div>
              ${unreadTotal > 0 ? `<span class="dc-convo-unread">${unreadTotal}</span>` : ''}
            </div>`;
        }).join('');
        listEl.querySelectorAll('[data-dm-open]').forEach(row =>
          row.addEventListener('click', () => openDmThread(row.dataset.dmOpen))
        );
      }
    } catch (err) {
      listEl.innerHTML = '<div style="padding:1rem;color:#e57373;font-size:0.85rem;">Could not load.</div>';
    }
  }

  async function openDmThread(username) {
    activeDmPeer = username;
    const chatPanel  = document.getElementById('chat-panel');
    const convPanel  = document.getElementById('conversations-panel');
    const dmMsgs     = document.getElementById('dm-messages');
    const peerName   = document.getElementById('dm-peer-name');
    const peerAvatar = document.getElementById('dm-peer-avatar');
    if (!chatPanel) return;

    if (dmPollTimer) { clearInterval(dmPollTimer); dmPollTimer = null; }
    chatPanel.classList.remove('hidden');
    if (dmMsgs) dmMsgs.innerHTML = '<div class="dc-loading" style="font-size:0.85rem;">Loading…</div>';
    if (peerName) peerName.textContent = username;
    if (window.innerWidth <= 600 && convPanel) convPanel.style.display = 'none';

    try {
      const data = await api(`/api/dms/${encodeURIComponent(username)}`);
      const u    = data.other_user;
      if (peerName)   setUsernameWithBadge(peerName, u.username, u.is_verified);
      if (peerAvatar) applyAvatarStyle(peerAvatar, u.pfp_url, u.pfp_offset_x, u.pfp_offset_y, u.username);
      renderDmMessages(data.messages);
      await loadConversations();
      await updateUnreadBadge();
    } catch (err) {
      if (dmMsgs) dmMsgs.innerHTML = '<div style="color:#e57373;font-size:0.85rem;padding:1rem;">Could not load messages.</div>';
    }

    dmPollTimer = setInterval(async () => {
      if (activeDmPeer !== username) return;
      try {
        const d = await api(`/api/dms/${encodeURIComponent(username)}`);
        renderDmMessages(d.messages);
        await updateUnreadBadge();
      } catch (e) {}
    }, 3000);
  }

  function renderDmMessages(messages) {
    const dmMsgs = document.getElementById('dm-messages');
    if (!dmMsgs) return;
    const atBottom = dmMsgs.scrollHeight - dmMsgs.scrollTop - dmMsgs.clientHeight < 80;
    if (!messages || messages.length === 0) {
      dmMsgs.innerHTML = '<div class="dc-messages-empty"><i class="fas fa-comment-dots"></i><span>No messages yet. Say hello!</span></div>';
      return;
    }
    dmMsgs.innerHTML = messages.map(m => {
      const mine = currentUser && m.sender_id === currentUser.id;
      return `<div class="dc-dm-bubble ${mine ? 'mine' : 'theirs'}">${escapeHtml(m.text)}<div class="dc-dm-time">${formatTime(m.created_at)}</div></div>`;
    }).join('');
    if (atBottom) dmMsgs.scrollTop = dmMsgs.scrollHeight;
  }

  const dmForm = document.getElementById('dm-form');
  if (dmForm) {
    dmForm.addEventListener('submit', async e => {
      e.preventDefault();
      if (!activeDmPeer) return;
      const input = document.getElementById('dm-input');
      const text  = input.value.trim();
      if (!text) return;
      input.value = '';
      try {
        const data   = await api(`/api/dms/${encodeURIComponent(activeDmPeer)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        const dmMsgs = document.getElementById('dm-messages');
        if (dmMsgs) {
          if (dmMsgs.querySelector('.dc-messages-empty')) dmMsgs.innerHTML = '';
          const bubble = document.createElement('div');
          bubble.className = 'dc-dm-bubble mine';
          bubble.innerHTML = `${escapeHtml(data.message.text)}<div class="dc-dm-time">${formatTime(data.message.created_at)}</div>`;
          dmMsgs.appendChild(bubble);
          dmMsgs.scrollTop = dmMsgs.scrollHeight;
        }
        loadConversations();
      } catch (err) { input.value = text; alert(err.message); }
    });
  }

  const dmTradeBtn = document.getElementById('dm-trade-btn');
  if (dmTradeBtn) dmTradeBtn.addEventListener('click', openTradeModal);
  const tradeSendBtn = document.getElementById('trade-send-btn');
  if (tradeSendBtn) tradeSendBtn.addEventListener('click', sendTradeOffer);
  ['trade-close-btn', 'trade-cancel-btn'].forEach(id => {
    const button = document.getElementById(id);
    if (button) button.addEventListener('click', closeTradeModal);
  });
  const tradeModal = document.getElementById('trade-modal');
  if (tradeModal) {
    tradeModal.addEventListener('click', event => {
      if (event.target === tradeModal) closeTradeModal();
    });
  }

  const dmBackBtn = document.getElementById('dm-back-btn');
  if (dmBackBtn) {
    dmBackBtn.addEventListener('click', () => {
      if (dmPollTimer) { clearInterval(dmPollTimer); dmPollTimer = null; }
      activeDmPeer = null;
      const chatPanel = document.getElementById('chat-panel');
      const convPanel = document.getElementById('conversations-panel');
      if (chatPanel) chatPanel.classList.add('hidden');
      if (convPanel) convPanel.style.display = '';
    });
  }

  async function updateUnreadBadge() {
    const badge = document.getElementById('unread-dm-badge');
    if (!badge || !currentUser) { if (badge) badge.style.display = 'none'; return; }
    try {
      const data  = await api('/api/dms/unread');
      const count = data.count || 0;
      badge.textContent   = count > 0 ? count : '';
      badge.style.display = count > 0 ? 'flex' : 'none';
    } catch (e) {}
  }

  // ── Init ─────────────────────────────────────────────────────────────────────
  checkMe().then(() => {
    callPollTimer = setInterval(pollIncomingCalls, 3000);
    if (currentUser) {
      updateFriendBadge();
      updateUnreadBadge();
      setInterval(updateFriendBadge, 30000);
      setInterval(updateUnreadBadge, 10000);
    }
  });
})();
