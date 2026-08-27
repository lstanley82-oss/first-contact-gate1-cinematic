(() => {
  'use strict';

  const QUESTIONS = Array.isArray(window.FC_GATE1_QUESTIONS) ? window.FC_GATE1_QUESTIONS : [];
  const TEAM_DEFAULTS = ['TEAM ALPHA','TEAM BRAVO','TEAM CHARLIE','TEAM DELTA','TEAM ECHO','TEAM FOXTROT'];
  const LETTERS = ['A','B','C','D'];
  const TIMER_DEFAULT = 30;
  const HEARTBEAT_MS = 10000;
  const OFFLINE_AFTER_MS = 32000;

  const $ = id => document.getElementById(id);
  const screens = [...document.querySelectorAll('.screen')];
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const clamp = (n,min,max) => Math.max(min,Math.min(max,n));
  const escapeHtml = value => {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
  };

  function showScreen(id) {
    screens.forEach(screen => screen.classList.toggle('active', screen.id === id));
    window.scrollTo({top:0,behavior:'auto'});
  }

  const cfg = window.FIRST_CONTACT_CONFIG || {};
  const configured = typeof cfg.SUPABASE_URL === 'string' && cfg.SUPABASE_URL.startsWith('http') &&
    typeof cfg.SUPABASE_ANON_KEY === 'string' && cfg.SUPABASE_ANON_KEY.length > 30 &&
    !cfg.SUPABASE_ANON_KEY.includes('PASTE_');
  $('configWarning').classList.toggle('hidden', configured);

  let sb = null;
  if (configured && window.supabase) {
    try { sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY); }
    catch (error) { console.error('Supabase client error', error); }
  }

  let role = null;
  let roomCode = '';
  let channel = null;
  let heartbeatTimer = null;
  let claimRefreshTimer = null;
  let clientId = localStorage.getItem('fc_gate1_client_id');
  if (!clientId) {
    clientId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    localStorage.setItem('fc_gate1_client_id', clientId);
  }

  const AudioManager = (() => {
    let ctx = null;
    let ambientNodes = [];
    let ambientTimer = null;
    let enabled = false;

    function setUi() {
      $('audioToggleTop').textContent = enabled ? 'AUDIO: ON' : 'AUDIO: OFF';
      $('audioToggleTop').classList.toggle('on', enabled);
      if ($('enableAudioBtn')) $('enableAudioBtn').textContent = enabled ? 'MISSION AUDIO ENABLED' : 'ENABLE MISSION AUDIO';
    }

    function tone(freq, duration=.12, type='sine', gain=.05, delay=0) {
      if (!enabled || !ctx) return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
      g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + delay + .012);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
      osc.connect(g).connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + duration + .03);
    }

    function scheduleAlienSignal() {
      if (!enabled || !ctx) return;
      const choices = [286, 342, 417, 533, 701, 862];
      const base = choices[Math.floor(Math.random()*choices.length)];
      // Sparse, eerie call-and-response motif rather than a continuous hum.
      tone(base,1.15,'sine',.018,0);
      tone(base*1.49,.85,'triangle',.013,.42);
      if (Math.random()>.45) tone(base*.73,1.35,'sine',.012,.96);
      ambientTimer = setTimeout(scheduleAlienSignal, 4200 + Math.random()*5200);
    }

    function startAmbient() {
      if (!enabled || !ctx || ambientNodes.length) return;
      const master = ctx.createGain();
      master.gain.value = .055;
      master.connect(ctx.destination);

      // A quiet, airy radio-static bed that moves slowly through the spectrum.
      const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * 3));
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i=0;i<bufferSize;i++) {
        const white = Math.random()*2-1;
        last = last*.985 + white*.015;
        data[i] = last*.42;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 1150;
      band.Q.value = .7;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = .085;
      noise.connect(band).connect(noiseGain).connect(master);
      noise.start();

      // Slow spectral drift gives the room an alien-radio feel without a bass drone.
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = .055;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 520;
      lfo.connect(lfoGain).connect(band.frequency);
      lfo.start();

      ambientNodes = [master,noise,lfo];
      ambientTimer = setTimeout(scheduleAlienSignal, 1400);
    }

    function stopAmbient() {
      if (ambientTimer) clearTimeout(ambientTimer);
      ambientTimer = null;
      ambientNodes.forEach(node => {
        try { if (node.stop) node.stop(); } catch (_) {}
        try { node.disconnect(); } catch (_) {}
      });
      ambientNodes = [];
    }

    async function enable() {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') await ctx.resume();
      enabled = true;
      startAmbient();
      setUi();
      tone(440,.12,'triangle',.075,0);
      tone(660,.12,'sine',.08,.10);
      tone(880,.18,'sine',.075,.20);
    }

    function disable() {
      stopAmbient();
      enabled = false;
      setUi();
    }

    function toggle() { return enabled ? disable() : enable(); }
    function incoming() { tone(910,.09,'sine',.032,0); tone(615,.18,'triangle',.04,.10); tone(370,.34,'sine',.028,.24); }
    function missionStart() { tone(260,.18,'triangle',.045,0); tone(390,.22,'triangle',.05,.16); tone(585,.38,'sine',.055,.34); tone(780,.55,'sine',.025,.55); }
    function tick() { tone(900,.045,'square',.026,0); }
    function correct() { tone(523,.12,'sine',.042,0); tone(659,.14,'sine',.046,.08); tone(988,.24,'triangle',.042,.17); }
    function warning() { tone(310,.13,'sawtooth',.025,0); tone(232,.18,'triangle',.025,.12); tone(155,.26,'sine',.018,.25); }
    function leaderboard() { tone(440,.07,'triangle',.03,0); tone(590,.08,'triangle',.032,.065); tone(740,.11,'sine',.035,.13); }
    function victory() { tone(330,.12,'triangle',.045,0); tone(440,.12,'triangle',.05,.11); tone(660,.14,'sine',.055,.22); tone(880,.28,'sine',.06,.35); }

    setUi();
    return {enable,disable,toggle,incoming,missionStart,tick,correct,warning,leaderboard,victory,get enabled(){return enabled;}};
  })();

  function setConnection(state,text) {
    $('connectionDot').className = `connection-dot${state ? ` ${state}` : ''}`;
    $('connectionText').textContent = text;
  }

  function levelClass(level) { return `level-${clamp(Number(level)||1,1,5)}`; }
  function applyLevel(el,level) {
    if (!el) return;
    el.classList.remove('level-1','level-2','level-3','level-4','level-5');
    el.classList.add(levelClass(level));
  }

  function triggerFlash(type) {
    const el = $('fxFlash');
    el.className = 'fx-flash';
    void el.offsetWidth;
    el.classList.add(type);
  }

  async function playOverlay(main,sub,duration=1700) {
    $('overlayMain').textContent = main;
    $('overlaySub').textContent = sub;
    $('missionOverlay').classList.remove('hidden');
    await sleep(duration);
    $('missionOverlay').classList.add('hidden');
  }

  const initialHost = () => ({
    teamCount: 4,
    teams: TEAM_DEFAULTS.slice(0,4),
    scores: Array(4).fill(0),
    claims: {},
    current: 0,
    phase: 'lobby',
    responses: {},
    responsesOpen: false,
    revealed: false,
    timerLeft: TIMER_DEFAULT,
    timerRunning: false,
    timerInterval: null,
    awards: {},
    skipped: {},
    roomCreatedAt: 0
  });

  const initialPlayer = () => ({
    teamNames: [],
    claimedTeams: [],
    onlineTeams: [],
    selectedTeam: null,
    joinedTeam: null,
    phase: 'joining',
    scores: [],
    current: 0,
    totalQuestions: QUESTIONS.length,
    question: null,
    responsesOpen: false,
    answeredTeams: [],
    teamAnswer: null,
    selectedAnswer: null,
    correct: null,
    explanation: '',
    previousPhase: null,
    preferredTeam: null
  });

  let host = initialHost();
  let player = initialPlayer();

  function topic(code) { return `first-contact-gate1:${code}`; }
  function randomRoomCode() { return String(Math.floor(100000 + Math.random()*900000)); }

  async function subscribeChannel(ch) {
    return new Promise((resolve,reject) => {
      const timeout = setTimeout(() => reject(new Error('Realtime connection timed out.')),9000);
      ch.subscribe(status => {
        if (status === 'SUBSCRIBED') { clearTimeout(timeout); resolve(); }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          clearTimeout(timeout);
          reject(new Error(`Realtime status: ${status}`));
        }
      });
    });
  }

  async function probeRoom(code) {
    if (!sb) return false;
    let collision = false;
    const probeId = `${clientId}-${Date.now()}-${Math.random()}`;
    const temp = sb.channel(topic(code),{config:{broadcast:{self:false,ack:true}}});
    temp.on('broadcast',{event:'host_exists'},({payload}) => {
      if (payload && payload.probeId === probeId) collision = true;
    });
    try {
      await subscribeChannel(temp);
      await temp.send({type:'broadcast',event:'host_probe',payload:{roomCode:code,probeId}});
      await sleep(650);
    } catch (error) {
      console.warn('Room probe failed', error);
    }
    try { await sb.removeChannel(temp); } catch (_) {}
    return collision;
  }

  async function connectRoom(code) {
    await cleanupChannel(false);
    roomCode = code;
    channel = sb.channel(topic(code),{config:{broadcast:{self:true,ack:true}}});

    channel.on('broadcast',{event:'host_probe'},({payload}) => {
      if (role === 'host' && payload && payload.roomCode === roomCode) {
        send('host_exists',{roomCode,probeId:payload.probeId});
      }
    });
    channel.on('broadcast',{event:'state_request'},({payload}) => role === 'host' && onStateRequest(payload));
    channel.on('broadcast',{event:'host_state'},({payload}) => role === 'player' && onHostState(payload));
    channel.on('broadcast',{event:'claim_request'},({payload}) => role === 'host' && onClaimRequest(payload));
    channel.on('broadcast',{event:'claim_result'},({payload}) => role === 'player' && onClaimResult(payload));
    channel.on('broadcast',{event:'team_released'},({payload}) => role === 'player' && onTeamReleased(payload));
    channel.on('broadcast',{event:'heartbeat'},({payload}) => role === 'host' && onHeartbeat(payload));
    channel.on('broadcast',{event:'answer_submit'},({payload}) => role === 'host' && onAnswerSubmit(payload));
    channel.on('broadcast',{event:'answer_lock'},({payload}) => role === 'player' && onAnswerLock(payload));
    channel.on('broadcast',{event:'room_closed'},({payload}) => role === 'player' && payload && payload.roomCode === roomCode && onRoomClosed());

    setConnection('warn','CONNECTING');
    await subscribeChannel(channel);
    setConnection('good','REALTIME CONNECTED');
  }

  async function send(event,payload={}) {
    if (!channel) return;
    try { await channel.send({type:'broadcast',event,payload}); }
    catch (error) { console.error(`Broadcast failed: ${event}`,error); }
  }

  function currentQuestion() { return QUESTIONS[host.current] || QUESTIONS[0]; }

  function publicHostState() {
    const q = currentQuestion();
    const visibleQuestion = ['transmission','reveal','leaderboard'].includes(host.phase);
    const revealData = ['reveal','leaderboard'].includes(host.phase);
    const now = Date.now();
    const claimedTeams = Object.keys(host.claims).map(Number);
    const onlineTeams = Object.entries(host.claims)
      .filter(([,info]) => info && now - info.lastSeen < OFFLINE_AFTER_MS)
      .map(([teamId]) => Number(teamId));
    return {
      roomCode,
      phase: host.phase,
      teamNames: host.teams,
      scores: host.scores,
      claimedTeams,
      onlineTeams,
      current: host.current,
      totalQuestions: QUESTIONS.length,
      responsesOpen: host.responsesOpen,
      answeredTeams: Object.keys(host.responses).map(Number),
      teamAnswers: revealData ? {...host.responses} : null,
      question: visibleQuestion ? {
        id:q.id,
        level:q.level,
        levelLabel:q.levelLabel,
        clearance:q.clearance,
        points:q.points,
        category:q.category,
        question:q.question,
        answers:q.answers,
        correct: revealData ? q.correct : null,
        explanation: revealData ? q.explanation : ''
      } : null
    };
  }

  function broadcastState() { return send('host_state',publicHostState()); }

  function onStateRequest(payload) {
    if (!payload || payload.roomCode !== roomCode) return;
    broadcastState();
  }

  async function onClaimRequest(payload) {
    if (!payload || payload.roomCode !== roomCode) return;
    const teamId = Number(payload.teamId);
    if (!Number.isInteger(teamId) || teamId < 0 || teamId >= host.teams.length) return;
    const existing = host.claims[teamId];
    const accepted = !existing || existing.clientId === payload.clientId;
    if (accepted) host.claims[teamId] = {clientId:payload.clientId,lastSeen:Date.now()};
    await send('claim_result',{
      roomCode,
      targetClientId:payload.clientId,
      teamId,
      accepted,
      reason:accepted ? '' : 'That field unit is already assigned.'
    });
    renderLobbyTeams();
    renderHostTeamCards();
    broadcastState();
  }

  function onHeartbeat(payload) {
    if (!payload || payload.roomCode !== roomCode) return;
    const teamId = Number(payload.teamId);
    const claim = host.claims[teamId];
    if (claim && claim.clientId === payload.clientId) {
      claim.lastSeen = Date.now();
      if (host.phase === 'lobby') renderLobbyTeams();
      else renderHostTeamCards();
    }
  }

  async function onAnswerSubmit(payload) {
    if (!payload || payload.roomCode !== roomCode || host.phase !== 'transmission' || !host.responsesOpen) return;
    const teamId = Number(payload.teamId);
    const answerIndex = Number(payload.answerIndex);
    const qIndex = Number(payload.questionIndex);
    if (qIndex !== host.current) return;
    const claim = host.claims[teamId];
    if (!claim || claim.clientId !== payload.clientId) return;
    if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) return;
    if (Object.prototype.hasOwnProperty.call(host.responses,teamId)) {
      await send('answer_lock',{roomCode,targetClientId:payload.clientId,teamId,questionIndex:host.current,answerIndex:host.responses[teamId]});
      return;
    }
    host.responses[teamId] = answerIndex;
    await send('answer_lock',{roomCode,targetClientId:payload.clientId,teamId,questionIndex:host.current,answerIndex});
    renderHostTeamCards();
    updateResponseCounter();
    broadcastState();
  }

  function onClaimResult(payload) {
    if (!payload || payload.roomCode !== roomCode || payload.targetClientId !== clientId) return;
    if (!payload.accepted) {
      player.selectedTeam = null;
      $('confirmTeamBtn').disabled = true;
      alert(payload.reason || 'That team is already claimed.');
      renderPlayerTeamSelection();
      return;
    }
    player.joinedTeam = Number(payload.teamId);
    player.selectedTeam = player.joinedTeam;
    localStorage.setItem(`fc_gate1_team_${roomCode}`,String(player.joinedTeam));
    startHeartbeat();
    renderPlayerLobby();
  }

  function onTeamReleased(payload) {
    if (!payload || payload.roomCode !== roomCode) return;
    if (payload.targetClientId && payload.targetClientId !== clientId) return;
    if (Number(payload.teamId) !== player.joinedTeam) return;
    stopHeartbeat();
    player.joinedTeam = null;
    player.selectedTeam = null;
    player.teamAnswer = null;
    player.selectedAnswer = null;
    localStorage.removeItem(`fc_gate1_team_${roomCode}`);
    alert('The teacher released this field unit. Select a team again to reconnect.');
    renderPlayerTeamSelection();
  }

  function onAnswerLock(payload) {
    if (!payload || payload.roomCode !== roomCode || payload.targetClientId !== clientId) return;
    if (Number(payload.teamId) !== player.joinedTeam || Number(payload.questionIndex) !== player.current) return;
    player.teamAnswer = Number(payload.answerIndex);
    player.selectedAnswer = player.teamAnswer;
    renderPlayerQuestion();
  }

  function onHostState(state) {
    if (!state || state.roomCode !== roomCode) return;
    const oldPhase = player.phase;
    const oldCurrent = player.current;
    player.previousPhase = oldPhase;
    player.teamNames = Array.isArray(state.teamNames) ? state.teamNames : [];
    player.claimedTeams = Array.isArray(state.claimedTeams) ? state.claimedTeams : [];
    player.onlineTeams = Array.isArray(state.onlineTeams) ? state.onlineTeams : [];
    player.scores = Array.isArray(state.scores) ? state.scores : [];
    player.phase = state.phase || 'lobby';
    player.current = Number(state.current || 0);
    player.totalQuestions = Number(state.totalQuestions || QUESTIONS.length);
    player.question = state.question || null;
    player.responsesOpen = !!state.responsesOpen;
    player.correct = state.question ? state.question.correct : null;
    player.explanation = state.question ? state.question.explanation : '';
    player.answeredTeams = Array.isArray(state.answeredTeams) ? state.answeredTeams : [];
    if ((player.phase === 'reveal' || player.phase === 'leaderboard') && state.teamAnswers && player.joinedTeam !== null) {
      const revealedAnswer = state.teamAnswers[player.joinedTeam];
      if (revealedAnswer !== undefined && revealedAnswer !== null) player.teamAnswer = Number(revealedAnswer);
    }

    if (player.current !== oldCurrent || player.phase === 'briefing') {
      player.teamAnswer = null;
      player.selectedAnswer = null;
    }
    if (player.joinedTeam !== null && player.answeredTeams.includes(player.joinedTeam) && player.teamAnswer === null) {
      // The host has a locked answer, but this device may have refreshed. Keep controls locked.
      player.teamAnswer = -1;
    }

    if (player.phase === 'lobby') renderPlayerLobby();
    if (player.phase === 'briefing') renderPlayerBriefing(oldPhase);
    if (player.phase === 'transmission' || player.phase === 'reveal') renderPlayerQuestion(oldPhase);
    if (player.phase === 'leaderboard') renderPlayerLeaderboard(oldPhase);
    if (player.phase === 'final') renderPlayerFinal(oldPhase);
  }

  function onRoomClosed() {
    stopHeartbeat();
    alert('The teacher closed this mission room.');
    location.href = location.pathname;
  }

  function startHeartbeat() {
    stopHeartbeat();
    if (role !== 'player' || player.joinedTeam === null) return;
    const beat = () => send('heartbeat',{roomCode,teamId:player.joinedTeam,clientId});
    beat();
    heartbeatTimer = setInterval(beat,HEARTBEAT_MS);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  async function cleanupChannel(resetRoom=true) {
    stopHeartbeat();
    stopHostTimer();
    if (claimRefreshTimer) clearInterval(claimRefreshTimer);
    claimRefreshTimer = null;
    if (channel && sb) {
      try { await sb.removeChannel(channel); } catch (_) {}
    }
    channel = null;
    if (resetRoom) roomCode = '';
    setConnection('','BACKEND IDLE');
  }

  /* Setup UI */
  function renderTeamNameInputs() {
    const count = Number($('teamCountSelect').value || 4);
    const grid = $('teamNameGrid');
    grid.innerHTML = '';
    for (let i=0;i<count;i++) {
      const row = document.createElement('div');
      row.className = 'team-name-row';
      row.innerHTML = `<div class="team-number">${i+1}</div><input class="text-input team-name-input" maxlength="28" />`;
      row.querySelector('input').value = TEAM_DEFAULTS[i];
      grid.appendChild(row);
    }
  }
  renderTeamNameInputs();
  $('teamCountSelect').addEventListener('change',renderTeamNameInputs);

  $('audioToggleTop').addEventListener('click',() => AudioManager.toggle());
  $('enableAudioBtn').addEventListener('click',() => AudioManager.toggle());

  $('hostMissionBtn').addEventListener('click',() => {
    if (!configured || !sb) {
      alert('This game copy is not connected to Supabase yet.');
      return;
    }
    role = 'host';
    renderTeamNameInputs();
    showScreen('hostSetupScreen');
  });

  $('backLandingBtn').addEventListener('click',() => showScreen('landingScreen'));
  $('joinMissionBtn').addEventListener('click',joinFromLanding);
  $('joinCodeInput').addEventListener('keydown',event => { if (event.key === 'Enter') joinFromLanding(); });

  async function createRoom() {
    if (!configured || !sb) return;
    const count = clamp(Number($('teamCountSelect').value || 4),2,6);
    const names = [...document.querySelectorAll('.team-name-input')].slice(0,count).map((input,index) => input.value.trim() || TEAM_DEFAULTS[index]);
    host = initialHost();
    host.teamCount = count;
    host.teams = names;
    host.scores = Array(count).fill(0);
    role = 'host';
    $('createRoomBtn').disabled = true;
    $('createRoomBtn').textContent = 'CREATING SECURE ROOM...';

    try {
      let code = '';
      for (let attempt=0;attempt<10;attempt++) {
        const candidate = randomRoomCode();
        const collision = await probeRoom(candidate);
        if (!collision) { code = candidate; break; }
      }
      if (!code) throw new Error('Could not generate an unused mission code.');
      await connectRoom(code);
      host.roomCreatedAt = Date.now();
      $('missionCodeDisplay').textContent = roomCode;
      $('roomMiniCode').textContent = roomCode;
      $('joinUrlDisplay').textContent = `${location.origin}${location.pathname}?room=${roomCode}`;
      $('footerStatus').textContent = `MISSION ROOM ${roomCode} ACTIVE`;
      renderLobbyTeams();
      showScreen('hostLobbyScreen');
      await broadcastState();
      claimRefreshTimer = setInterval(() => {
        if (role === 'host') {
          if (host.phase === 'lobby') renderLobbyTeams();
          else renderHostTeamCards();
        }
      },5000);
    } catch (error) {
      console.error(error);
      setConnection('bad','CONNECTION FAILED');
      alert('The mission room could not connect. Check the internet connection and Supabase configuration.');
    } finally {
      $('createRoomBtn').disabled = false;
      $('createRoomBtn').textContent = 'CREATE MISSION ROOM';
    }
  }
  $('createRoomBtn').addEventListener('click',createRoom);

  async function joinFromLanding() {
    if (!configured || !sb) {
      alert('This game copy is not connected to Supabase yet.');
      return;
    }
    const code = $('joinCodeInput').value.replace(/\D/g,'').slice(0,6);
    if (code.length !== 6) {
      alert('Enter the 6-digit mission code shown by your teacher.');
      return;
    }
    role = 'player';
    player = initialPlayer();
    const preferredRaw = localStorage.getItem(`fc_gate1_team_${code}`);
    player.preferredTeam = preferredRaw === null ? null : Number(preferredRaw);
    if (!Number.isInteger(player.preferredTeam)) player.preferredTeam = null;
    roomCode = code;
    $('playerRoomCode').textContent = roomCode;
    $('playerHeading').textContent = 'CONNECTING';
    $('playerSubheading').textContent = 'Stand by while the secure channel opens.';
    $('playerWaitingArea').classList.remove('hidden');
    $('teamSelectionArea').classList.add('hidden');
    $('playerQuestionArea').classList.add('hidden');
    $('playerLeaderboardArea').classList.add('hidden');
    $('playerWaitBox').textContent = 'Connecting to mission room...';
    showScreen('playerScreen');
    try {
      await connectRoom(roomCode);
      $('playerWaitBox').textContent = 'Secure channel open. Requesting mission details...';
      await send('state_request',{roomCode,clientId});
      setTimeout(() => {
        if (!player.teamNames.length) $('playerWaitBox').textContent = 'No host response. Check the mission code or ask the teacher to keep the room open.';
      },3200);
    } catch (error) {
      console.error(error);
      setConnection('bad','CONNECTION FAILED');
      $('playerWaitBox').textContent = 'Could not connect. Check the mission code and internet connection.';
    }
  }

  function renderLobbyTeams() {
    const wrap = $('teamLobbyList');
    wrap.innerHTML = '';
    const now = Date.now();
    host.teams.forEach((name,teamId) => {
      const claim = host.claims[teamId];
      const online = !!claim && now - claim.lastSeen < OFFLINE_AFTER_MS;
      const item = document.createElement('div');
      item.className = `team-lobby-item${online ? ' ready' : ''}`;
      const status = !claim ? 'WAITING' : online ? 'CONNECTED' : 'OFFLINE / CLAIMED';
      item.innerHTML = `<div class="team-lobby-name"></div><div class="team-lobby-status">${status}</div>`;
      item.querySelector('.team-lobby-name').textContent = name;
      wrap.appendChild(item);
    });
  }

  $('cancelMissionBtn').addEventListener('click',async() => {
    await send('room_closed',{roomCode});
    await cleanupChannel();
    host = initialHost();
    role = null;
    showScreen('landingScreen');
  });

  $('startMissionBtn').addEventListener('click',async() => {
    host.phase = 'briefing';
    host.current = 0;
    host.responses = {};
    host.responsesOpen = false;
    host.revealed = false;
    host.timerLeft = TIMER_DEFAULT;
    showScreen('hostGameScreen');
    renderHostGame();
    await broadcastState();
    AudioManager.missionStart();
    playOverlay('SECURE CHANNEL ESTABLISHED','LINGUISTIC ANALYSIS AUTHORIZED',1800);
  });

  function setHostPhaseLabel() {
    const labels = {
      briefing:'AWAITING TRANSMISSION',
      transmission:host.responsesOpen ? 'ANALYSIS WINDOW OPEN' : 'ANALYSIS WINDOW CLOSED',
      reveal:'ANALYSIS REVEALED',
      leaderboard:'FIELD PERFORMANCE REPORT'
    };
    $('hostPhaseLabel').textContent = labels[host.phase] || 'MISSION ACTIVE';
  }

  function renderHostGame() {
    const q = currentQuestion();
    applyLevel($('hostLevelShell'),q.level);
    $('hostQIndex').textContent = `${String(host.current+1).padStart(2,'0')} / ${QUESTIONS.length}`;
    $('hostDifficulty').textContent = q.levelLabel;
    $('hostPoints').textContent = q.points;
    $('hostClearance').textContent = q.clearance;
    $('hostCategory').textContent = q.category;
    $('briefingHeading').textContent = host.current === QUESTIONS.length-1 ? 'FINAL TRANSMISSION READY' : `TRANSMISSION ${String(host.current+1).padStart(2,'0')} READY`;
    $('responseTotal').textContent = `/${host.teams.length}`;
    setHostPhaseLabel();

    const briefing = host.phase === 'briefing';
    const leaderboard = host.phase === 'leaderboard';
    $('hostBriefingState').classList.toggle('hidden',!briefing);
    $('hostQuestionState').classList.toggle('hidden',briefing || leaderboard);
    $('leaderboardPanel').classList.toggle('hidden',!leaderboard);
    $('hostLevelShell').classList.toggle('leaderboard-active',leaderboard);

    if (!briefing) {
      $('hostQuestionText').textContent = q.question;
      const answerWrap = $('hostAnswers');
      answerWrap.innerHTML = '';
      q.answers.forEach((answer,index) => {
        const card = document.createElement('div');
        card.className = 'answer-card';
        if (host.phase === 'reveal') card.classList.add(index === q.correct ? 'correct' : 'dim');
        card.innerHTML = `<div class="answer-letter">${LETTERS[index]}</div><div class="answer-text"></div>`;
        card.querySelector('.answer-text').textContent = answer;
        answerWrap.appendChild(card);
      });
      $('hostExplanation').classList.toggle('hidden',host.phase !== 'reveal');
      $('hostExplanation').textContent = host.phase === 'reveal' ? q.explanation : '';
    }

    if (leaderboard) renderHostLeaderboard();
    renderHostTeamCards();
    updateResponseCounter();
    updateHostTimer();
    updateHostControls();
  }

  function updateHostControls() {
    const briefing = host.phase === 'briefing';
    const transmission = host.phase === 'transmission';
    const reveal = host.phase === 'reveal';
    const leaderboard = host.phase === 'leaderboard';
    $('openTransmissionBtn').disabled = !briefing;
    $('timerToggleBtn').disabled = !transmission;
    $('addTimeBtn').disabled = !transmission;
    $('resetTimerBtn').disabled = !transmission;
    $('closeResponsesBtn').disabled = !transmission || !host.responsesOpen;
    $('revealAnswerBtn').disabled = !transmission;
    $('showLeaderboardBtn').disabled = !reveal;
    $('continueMissionBtn').disabled = !leaderboard;
    $('reopenResponsesBtn').disabled = !transmission || host.responsesOpen;
    $('restartQuestionBtn').disabled = briefing;
    $('skipQuestionBtn').disabled = host.current >= QUESTIONS.length-1 && leaderboard;
    $('backQuestionBtn').disabled = host.current === 0;
    $('timerToggleBtn').textContent = host.timerRunning ? 'PAUSE TIMER' : 'START TIMER';
  }

  function renderHostTeamCards() {
    const wrap = $('hostTeamCards');
    if (!wrap) return;
    wrap.innerHTML = '';
    const now = Date.now();
    host.teams.forEach((name,teamId) => {
      const card = document.createElement('div');
      card.className = 'host-team-card';
      const claim = host.claims[teamId];
      const online = !!claim && now - claim.lastSeen < OFFLINE_AFTER_MS;
      const answered = Object.prototype.hasOwnProperty.call(host.responses,teamId);
      let status = !claim ? 'UNASSIGNED' : !online ? 'OFFLINE / CLAIMED' : answered ? 'ANALYSIS RECEIVED' : 'AWAITING RESPONSE';
      let statusClass = answered ? 'received' : !online && claim ? 'offline' : '';
      const points = currentQuestion() ? currentQuestion().points : 100;
      card.innerHTML = `
        <div class="host-team-top"><div class="host-team-name"></div><div class="host-team-score">${host.scores[teamId] || 0}</div></div>
        <div class="host-team-status ${statusClass}">${status}</div>
        <div class="team-admin-row">
          <button class="tiny-btn add-score" type="button">+${points}</button>
          <button class="tiny-btn minus-score" type="button">-${points}</button>
          <button class="tiny-btn danger release-team" type="button" ${claim ? '' : 'disabled'}>RELEASE</button>
        </div>`;
      card.querySelector('.host-team-name').textContent = name;
      card.querySelector('.add-score').addEventListener('click',() => adjustScore(teamId,points));
      card.querySelector('.minus-score').addEventListener('click',() => adjustScore(teamId,-points));
      card.querySelector('.release-team').addEventListener('click',() => releaseTeam(teamId));
      wrap.appendChild(card);
    });
  }

  function adjustScore(teamId,delta) {
    host.scores[teamId] = Math.max(0,(host.scores[teamId] || 0) + delta);
    renderHostTeamCards();
    if (host.phase === 'leaderboard') renderHostLeaderboard();
    broadcastState();
  }

  async function releaseTeam(teamId) {
    const claim = host.claims[teamId];
    if (!claim) return;
    await send('team_released',{roomCode,targetClientId:claim.clientId,teamId});
    delete host.claims[teamId];
    delete host.responses[teamId];
    renderLobbyTeams();
    renderHostTeamCards();
    updateResponseCounter();
    broadcastState();
  }

  function updateResponseCounter() {
    $('responseCount').textContent = Object.keys(host.responses).length;
  }

  function updateHostTimer() {
    $('hostTimer').textContent = host.timerLeft;
    const block = $('hostTimer').closest('.timer-block');
    block.classList.toggle('warning',host.timerLeft <= 10 && host.timerLeft > 5);
    block.classList.toggle('danger',host.timerLeft <= 5);
  }

  function startHostTimer() {
    if (host.timerRunning || host.phase !== 'transmission') return;
    if (host.timerLeft <= 0) host.timerLeft = TIMER_DEFAULT;
    host.timerRunning = true;
    updateHostControls();
    host.timerInterval = setInterval(() => {
      host.timerLeft -= 1;
      updateHostTimer();
      if (host.timerLeft <= 5 && host.timerLeft > 0) AudioManager.tick();
      if (host.timerLeft <= 0) {
        host.timerLeft = 0;
        stopHostTimer();
        host.responsesOpen = false;
        setHostPhaseLabel();
        updateHostControls();
        broadcastState();
      } else if (host.timerLeft <= 5 || host.timerLeft % 5 === 0) {
        broadcastState();
      }
    },1000);
  }

  function stopHostTimer() {
    if (host.timerInterval) clearInterval(host.timerInterval);
    host.timerInterval = null;
    host.timerRunning = false;
    if ($('timerToggleBtn')) updateHostControls();
  }

  $('openTransmissionBtn').addEventListener('click',async() => {
    if (host.phase !== 'briefing') return;
    host.phase = 'transmission';
    host.responses = {};
    host.responsesOpen = true;
    host.revealed = false;
    host.timerLeft = TIMER_DEFAULT;
    renderHostGame();
    AudioManager.incoming();
    if (host.current === QUESTIONS.length-1) {
      playOverlay('FINAL TRANSMISSION','OMEGA-LEVEL ANALYSIS REQUIRED',1150);
    }
    await broadcastState();
    startHostTimer();
  });

  $('timerToggleBtn').addEventListener('click',() => host.timerRunning ? stopHostTimer() : startHostTimer());
  $('addTimeBtn').addEventListener('click',() => {
    if (host.phase !== 'transmission') return;
    host.timerLeft += 10;
    updateHostTimer();
    broadcastState();
  });
  $('resetTimerBtn').addEventListener('click',() => {
    if (host.phase !== 'transmission') return;
    stopHostTimer();
    host.timerLeft = TIMER_DEFAULT;
    updateHostTimer();
    broadcastState();
  });
  $('closeResponsesBtn').addEventListener('click',() => {
    if (host.phase !== 'transmission') return;
    host.responsesOpen = false;
    stopHostTimer();
    setHostPhaseLabel();
    updateHostControls();
    broadcastState();
  });
  $('reopenResponsesBtn').addEventListener('click',() => {
    if (host.phase !== 'transmission') return;
    host.responsesOpen = true;
    if (host.timerLeft <= 0) host.timerLeft = 10;
    setHostPhaseLabel();
    updateHostControls();
    broadcastState();
  });

  function rollbackAwards(qIndex) {
    const ledger = host.awards[qIndex];
    if (!ledger) return;
    Object.entries(ledger).forEach(([teamId,points]) => {
      const id = Number(teamId);
      host.scores[id] = Math.max(0,(host.scores[id] || 0) - Number(points || 0));
    });
    delete host.awards[qIndex];
  }

  function applyAwards(qIndex) {
    rollbackAwards(qIndex);
    const q = QUESTIONS[qIndex];
    const ledger = {};
    host.teams.forEach((_,teamId) => {
      if (host.responses[teamId] === q.correct) {
        host.scores[teamId] = (host.scores[teamId] || 0) + q.points;
        ledger[teamId] = q.points;
      }
    });
    host.awards[qIndex] = ledger;
  }

  $('revealAnswerBtn').addEventListener('click',async() => {
    if (host.phase !== 'transmission') return;
    stopHostTimer();
    host.responsesOpen = false;
    host.phase = 'reveal';
    host.revealed = true;
    applyAwards(host.current);
    renderHostGame();
    triggerFlash('correct');
    AudioManager.correct();
    const anyWrong = Object.values(host.responses).some(answer => Number(answer) !== currentQuestion().correct);
    if (anyWrong) setTimeout(() => AudioManager.warning(),330);
    await broadcastState();
  });

  function getStandings() {
    return host.teams.map((name,index) => ({name,score:host.scores[index] || 0,teamId:index}))
      .sort((a,b) => b.score - a.score || a.teamId - b.teamId);
  }

  function renderHostLeaderboard() {
    const wrap = $('hostLeaderboard');
    wrap.innerHTML = '';
    $('leaderboardRound').textContent = `AFTER TRANSMISSION ${String(host.current+1).padStart(2,'0')}`;
    const standings = getStandings();
    standings.forEach((team,index) => {
      const row = document.createElement('div');
      row.className = 'leaderboard-row';
      row.innerHTML = `<div class="leaderboard-rank">${index+1}</div><div class="leaderboard-team"></div><div class="leaderboard-score">${team.score}</div>`;
      row.querySelector('.leaderboard-team').textContent = team.name;
      wrap.appendChild(row);
    });
  }

  $('showLeaderboardBtn').addEventListener('click',async() => {
    if (host.phase !== 'reveal') return;
    host.phase = 'leaderboard';
    renderHostGame();
    AudioManager.leaderboard();
    await broadcastState();
  });

  $('continueMissionBtn').addEventListener('click',async() => {
    if (host.phase !== 'leaderboard') return;
    if (host.current >= QUESTIONS.length - 1) {
      await finishMission(false);
      return;
    }
    host.current += 1;
    host.phase = 'briefing';
    host.responses = {};
    host.responsesOpen = false;
    host.revealed = false;
    host.timerLeft = TIMER_DEFAULT;
    renderHostGame();
    await broadcastState();
  });

  $('restartQuestionBtn').addEventListener('click',async() => {
    if (host.phase === 'briefing') return;
    rollbackAwards(host.current);
    stopHostTimer();
    host.phase = 'briefing';
    host.responses = {};
    host.responsesOpen = false;
    host.revealed = false;
    host.timerLeft = TIMER_DEFAULT;
    renderHostGame();
    await broadcastState();
  });

  $('skipQuestionBtn').addEventListener('click',async() => {
    stopHostTimer();
    rollbackAwards(host.current);
    host.skipped[host.current] = true;
    if (host.current >= QUESTIONS.length - 1) {
      await finishMission(false);
      return;
    }
    host.current += 1;
    host.phase = 'briefing';
    host.responses = {};
    host.responsesOpen = false;
    host.revealed = false;
    host.timerLeft = TIMER_DEFAULT;
    renderHostGame();
    await broadcastState();
  });

  $('backQuestionBtn').addEventListener('click',async() => {
    if (host.current <= 0) return;
    stopHostTimer();
    host.current -= 1;
    host.phase = 'briefing';
    host.responses = {};
    host.responsesOpen = false;
    host.revealed = false;
    host.timerLeft = TIMER_DEFAULT;
    renderHostGame();
    await broadcastState();
  });

  $('endMissionBtn').addEventListener('click',() => finishMission(true));

  async function finishMission(early) {
    stopHostTimer();
    host.phase = 'final';
    host.responsesOpen = false;
    renderFinalStandings();
    showScreen('finalScreen');
    triggerFlash('correct');
    AudioManager.victory();
    await send('host_state',{
      ...publicHostState(),
      phase:'final',
      finalStandings:getStandings(),
      endedEarly:!!early
    });
  }

  function renderFinalStandings() {
    const standings = getStandings();
    const winner = standings[0];
    $('finalWinner').innerHTML = `<div class="winner-kicker">FIELD UNIT COMMENDATION</div><div class="winner-name"></div><div class="winner-score">${winner ? winner.score : 0} POINTS</div>`;
    if (winner) $('finalWinner').querySelector('.winner-name').textContent = winner.name;
    const wrap = $('finalStandings');
    wrap.innerHTML = '';
    standings.forEach((team,index) => {
      const row = document.createElement('div');
      row.className = 'leaderboard-row';
      row.innerHTML = `<div class="leaderboard-rank">${index+1}</div><div class="leaderboard-team"></div><div class="leaderboard-score">${team.score}</div>`;
      row.querySelector('.leaderboard-team').textContent = team.name;
      wrap.appendChild(row);
    });
  }

  $('restartHostBtn').addEventListener('click',async() => {
    await send('room_closed',{roomCode});
    await cleanupChannel();
    host = initialHost();
    role = 'host';
    renderTeamNameInputs();
    showScreen('hostSetupScreen');
  });

  $('returnHomeBtn').addEventListener('click',async() => {
    await send('room_closed',{roomCode});
    await cleanupChannel();
    host = initialHost();
    role = null;
    showScreen('landingScreen');
  });

  /* Player views */
  function renderPlayerTeamSelection() {
    $('playerHeading').textContent = 'SELECT FIELD UNIT';
    $('playerSubheading').textContent = 'Choose your assigned team. One captain device submits the official analysis.';
    $('playerScore').textContent = '0';
    $('teamSelectionArea').classList.remove('hidden');
    $('playerWaitingArea').classList.add('hidden');
    $('playerQuestionArea').classList.add('hidden');
    $('playerLeaderboardArea').classList.add('hidden');
    const grid = $('teamChoiceGrid');
    grid.innerHTML = '';
    player.teamNames.forEach((name,teamId) => {
      const claimed = player.claimedTeams.includes(teamId);
      const reconnect = claimed && player.preferredTeam === teamId;
      const button = document.createElement('button');
      button.className = `team-choice${player.selectedTeam === teamId ? ' selected' : ''}${claimed && !reconnect ? ' claimed' : ''}`;
      button.type = 'button';
      button.disabled = claimed && !reconnect;
      button.innerHTML = `<strong>${escapeHtml(name)}</strong><div style="font-size:10px;color:var(--muted);margin-top:4px;letter-spacing:.08em">${reconnect ? 'RECONNECT' : claimed ? 'ASSIGNED' : 'AVAILABLE'}</div>`;
      button.addEventListener('click',() => {
        player.selectedTeam = teamId;
        renderPlayerTeamSelection();
        $('confirmTeamBtn').disabled = false;
      });
      grid.appendChild(button);
    });
    $('confirmTeamBtn').disabled = player.selectedTeam === null;
  }

  $('confirmTeamBtn').addEventListener('click',async() => {
    if (player.selectedTeam === null) return;
    $('confirmTeamBtn').disabled = true;
    $('confirmTeamBtn').textContent = 'REQUESTING ASSIGNMENT...';
    await send('claim_request',{roomCode,teamId:player.selectedTeam,clientId});
    setTimeout(() => { if ($('confirmTeamBtn')) $('confirmTeamBtn').textContent = 'CONFIRM FIELD UNIT'; },1200);
  });

  function renderPlayerLobby() {
    if (player.joinedTeam === null) {
      renderPlayerTeamSelection();
      return;
    }
    $('playerHeading').textContent = player.teamNames[player.joinedTeam] || 'FIELD UNIT';
    $('playerScore').textContent = player.scores[player.joinedTeam] || 0;
    $('playerSubheading').textContent = 'Field unit connected. Awaiting mission initiation.';
    $('teamSelectionArea').classList.add('hidden');
    $('playerQuestionArea').classList.add('hidden');
    $('playerLeaderboardArea').classList.add('hidden');
    $('playerWaitingArea').classList.remove('hidden');
    $('playerWaitBox').innerHTML = '<strong>SECURE CHANNEL ESTABLISHED</strong><br>Waiting for Command to initiate First Contact.';
  }

  async function renderPlayerBriefing(oldPhase) {
    if (player.joinedTeam === null) { renderPlayerLobby(); return; }
    const q = QUESTIONS[player.current];
    applyLevel($('playerLevelShell'),q.level);
    $('playerHeading').textContent = player.teamNames[player.joinedTeam] || 'FIELD UNIT';
    $('playerScore').textContent = player.scores[player.joinedTeam] || 0;
    $('teamSelectionArea').classList.add('hidden');
    $('playerQuestionArea').classList.add('hidden');
    $('playerLeaderboardArea').classList.add('hidden');
    $('playerWaitingArea').classList.remove('hidden');
    $('playerSubheading').textContent = q.level === 5 ? 'Omega-level transmission pending.' : 'Stand by for incoming transmission.';
    $('playerWaitBox').innerHTML = `<strong>${q.level === 5 ? 'OMEGA ANALYSIS' : q.clearance}</strong><br>${player.current === QUESTIONS.length-1 ? 'Final transmission ready.' : `Transmission ${String(player.current+1).padStart(2,'0')} is being prepared.`}`;
    if (oldPhase === 'lobby') playOverlay('SECURE CHANNEL ESTABLISHED','FIELD UNIT AUTHORIZED',1200);
  }

  function renderPlayerQuestion(oldPhase=player.previousPhase) {
    if (player.joinedTeam === null || !player.question) return;
    const q = player.question;
    applyLevel($('playerLevelShell'),q.level);
    $('playerHeading').textContent = player.teamNames[player.joinedTeam] || 'FIELD UNIT';
    $('playerScore').textContent = player.scores[player.joinedTeam] || 0;
    $('playerSubheading').textContent = player.phase === 'reveal' ? 'Command analysis received.' : player.responsesOpen ? 'Discuss. Decide. Submit one team analysis.' : 'Analysis window is closed.';
    $('teamSelectionArea').classList.add('hidden');
    $('playerWaitingArea').classList.add('hidden');
    $('playerLeaderboardArea').classList.add('hidden');
    $('playerQuestionArea').classList.remove('hidden');
    $('playerClearance').textContent = q.clearance;
    $('playerQIndex').textContent = `${player.current === QUESTIONS.length-1 ? 'FINAL ' : ''}TRANSMISSION ${String(player.current+1).padStart(2,'0')} / ${player.totalQuestions}`;
    $('playerQuestionText').textContent = q.question;

    const wrap = $('playerAnswers');
    wrap.innerHTML = '';
    q.answers.forEach((answer,index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'player-answer';
      if (player.selectedAnswer === index || player.teamAnswer === index) button.classList.add('selected');
      if (player.phase === 'reveal') button.classList.add(index === q.correct ? 'correct' : 'dim');
      const locked = player.teamAnswer !== null;
      button.disabled = player.phase === 'reveal' || !player.responsesOpen || locked;
      button.innerHTML = `<div class="answer-letter">${LETTERS[index]}</div><div></div>`;
      button.children[1].textContent = answer;
      button.addEventListener('click',() => {
        if (button.disabled) return;
        player.selectedAnswer = index;
        renderPlayerQuestion();
      });
      wrap.appendChild(button);
    });

    const locked = player.teamAnswer !== null;
    $('submitAnalysisBtn').disabled = player.phase === 'reveal' || !player.responsesOpen || locked || player.selectedAnswer === null;
    $('submitAnalysisBtn').classList.toggle('hidden',player.phase === 'reveal');
    $('playerLockNotice').classList.toggle('hidden',!locked || player.phase === 'reveal');
    if (locked && player.phase !== 'reveal') $('playerLockNotice').textContent = 'ANALYSIS TRANSMITTED // Awaiting Command Review...';

    if (player.phase === 'reveal') {
      const teamCorrect = player.teamAnswer >= 0 && player.teamAnswer === q.correct;
      $('playerResultBox').classList.remove('hidden','correct-result','wrong-result');
      $('playerResultBox').classList.add(teamCorrect ? 'correct-result' : 'wrong-result');
      $('playerResultBox').innerHTML = `<strong>${teamCorrect ? `ANALYSIS CONFIRMED // +${q.points}` : 'ANALYSIS REJECTED'}</strong><br><span>Correct Analysis: ${LETTERS[q.correct]}</span><br>${escapeHtml(q.explanation)}`;
      if (oldPhase === 'transmission') triggerFlash(teamCorrect ? 'correct' : 'wrong');
    } else {
      $('playerResultBox').classList.add('hidden');
    }
  }

  $('submitAnalysisBtn').addEventListener('click',async() => {
    if (player.joinedTeam === null || player.selectedAnswer === null || !player.responsesOpen || player.teamAnswer !== null) return;
    const answer = player.selectedAnswer;
    $('submitAnalysisBtn').disabled = true;
    $('submitAnalysisBtn').textContent = 'TRANSMITTING...';
    await send('answer_submit',{roomCode,teamId:player.joinedTeam,answerIndex:answer,clientId,questionIndex:player.current});
    setTimeout(() => { $('submitAnalysisBtn').textContent = 'SUBMIT ANALYSIS'; },800);
  });

  function renderPlayerLeaderboard(oldPhase) {
    if (player.joinedTeam === null) return;
    $('playerHeading').textContent = player.teamNames[player.joinedTeam] || 'FIELD UNIT';
    $('playerScore').textContent = player.scores[player.joinedTeam] || 0;
    $('playerSubheading').textContent = 'Field performance report received.';
    $('teamSelectionArea').classList.add('hidden');
    $('playerWaitingArea').classList.add('hidden');
    $('playerQuestionArea').classList.add('hidden');
    $('playerLeaderboardArea').classList.remove('hidden');
    const standings = player.teamNames.map((name,index) => ({name,score:player.scores[index] || 0,teamId:index}))
      .sort((a,b) => b.score - a.score || a.teamId - b.teamId);
    const wrap = $('playerLeaderboard');
    wrap.innerHTML = '';
    standings.forEach((team,index) => {
      const row = document.createElement('div');
      row.className = 'leaderboard-row';
      row.innerHTML = `<div class="leaderboard-rank">${index+1}</div><div class="leaderboard-team"></div><div class="leaderboard-score">${team.score}</div>`;
      row.querySelector('.leaderboard-team').textContent = team.name;
      wrap.appendChild(row);
    });
  }

  function renderPlayerFinal(oldPhase) {
    $('teamSelectionArea').classList.add('hidden');
    $('playerQuestionArea').classList.add('hidden');
    $('playerLeaderboardArea').classList.add('hidden');
    $('playerWaitingArea').classList.remove('hidden');
    $('playerHeading').textContent = 'MISSION COMPLETE';
    $('playerSubheading').textContent = 'Gate 1 readiness analysis complete.';
    const standings = player.teamNames.map((name,index) => ({name,score:player.scores[index] || 0,teamId:index}))
      .sort((a,b) => b.score - a.score || a.teamId - b.teamId);
    $('playerWaitBox').innerHTML = `<strong>FINAL FIELD PERFORMANCE REPORT</strong><br><br>${standings.map((team,index) => `${index+1}. ${escapeHtml(team.name)}: ${team.score}`).join('<br>')}`;
    if (oldPhase !== 'final') triggerFlash('correct');
  }

  /* URL prefill */
  const params = new URLSearchParams(location.search);
  const queryRoom = (params.get('room') || '').replace(/\D/g,'').slice(0,6);
  if (queryRoom.length === 6) $('joinCodeInput').value = queryRoom;

  window.addEventListener('beforeunload',() => {
    stopHeartbeat();
    stopHostTimer();
  });

  if (!QUESTIONS.length) {
    $('footerStatus').textContent = 'QUESTION BANK FAILED TO LOAD';
    console.error('FC_GATE1_QUESTIONS is empty.');
  }
})();
