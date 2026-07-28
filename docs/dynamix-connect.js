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
      ? '<span class="dc-verified-badge" title="Verified user" aria-label="Verified user"><i class="fas fa-check"></i></span>'
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
        const canDelete = currentUser && currentUser.id === post.user_id;
        const avatarInline = post.pfp_url
          ? `style="background-image:url('${escapeHtml(post.pfp_url)}');background-position:${post.pfp_offset_x || 50}% ${post.pfp_offset_y || 50}%;background-size:cover;"`
          : '';
        const initials = post.pfp_url ? '' : post.username.slice(0, 2).toUpperCase();
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
          </div>
        `;
      }).join('');

      document.querySelectorAll('[data-delete]').forEach(btn => {
        btn.addEventListener('click', () => deletePost(parseInt(btn.dataset.delete, 10)));
      });
      document.querySelectorAll('.dc-username-link').forEach(el => {
        el.addEventListener('click', () => openUserProfile(el.dataset.username));
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
      const data = await api(`/api/users/${encodeURIComponent(username)}`);
      const u = data.user;

       setUsernameWithBadge(profileViewUsername, u.username, u.is_verified);
      profileViewBio.textContent      = u.bio || '';
      profileViewJoined.textContent   = u.created_at ? `Joined ${u.created_at}` : '';
      applyAvatarStyle(profileViewAvatar, u.pfp_url, u.pfp_offset_x, u.pfp_offset_y, u.username);
      if (profileCallBtn) {
        profileCallBtn.dataset.username = u.username;
        profileCallBtn.style.display = currentUser && currentUser.username !== u.username ? 'inline-flex' : 'none';
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
      throw new Error('Camera and microphone access is required to make a video call.');
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
      setVideoError(e.message);
      showVideoCall(call, 'Unable to join');
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

  // ── Init ─────────────────────────────────────────────────────────────────────
  checkMe().then(() => {
    callPollTimer = setInterval(pollIncomingCalls, 3000);
  });
})();
