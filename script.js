const summary = document.getElementById('summary');
const usersSection = document.getElementById('users');
const cancelButton = document.getElementById('cancel');

function setSummary(state, text) {
  summary.dataset.state = state;
  summary.textContent = text;
}

function parseParams() {
  const params = new URLSearchParams(window.location.search);
  const idsRaw = params.has('ids') ? params.get('ids') : '1,2,3';
  const delayRaw = params.has('delay') ? params.get('delay') : '0';

  const parts = idsRaw.split(',').map((part) => part.trim());
  if (parts.length < 1 || parts.length > 5) {
    return null;
  }

  const ids = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part) || Number(part) <= 0) {
      return null;
    }
    ids.push(String(Number(part)));
  }

  const delay = delayRaw.trim();
  if (!/^\d+$/.test(delay) || Number(delay) > 5000) {
    return null;
  }

  return { ids, delay: Number(delay) };
}

async function loadUser(id, delay, signal) {
  const url = `https://dummyjson.com/users/${id}?delay=${delay}`;
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

function createCard(id) {
  const article = document.createElement('article');
  article.dataset.id = id;
  article.dataset.state = 'loading';
  article.textContent = 'Загрузка...';
  return article;
}

function appendField(article, tag, className, text) {
  const p = document.createElement('p');
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  p.append(element);
  article.append(p);
  return element;
}

function fillSuccess(article, user) {
  article.replaceChildren();
  article.dataset.state = 'success';

  const name = document.createElement('h2');
  name.className = 'name';
  name.textContent = `${user.firstName} ${user.lastName}`;
  article.append(name);

  const email = appendField(article, 'a', 'email', user.email);
  email.href = `mailto:${user.email}`;

  appendField(article, 'span', 'city', user.address.city);
  appendField(article, 'span', 'company', user.company.name);
}

function fillFailure(article, state, text) {
  article.replaceChildren();
  article.dataset.state = state;

  const message = document.createElement('span');
  message.className = 'message';
  message.textContent = text;
  article.append(message);
}

function isAbortError(error) {
  return error && error.name === 'AbortError';
}

async function main() {
  const params = parseParams();
  if (!params) {
    cancelButton.disabled = true;
    setSummary(
      'error',
      'Некорректные параметры: ids должен содержать от 1 до 5 положительных целых чисел через запятую, delay от 0 до 5000.'
    );
    return;
  }

  const controller = new AbortController();
  cancelButton.addEventListener('click', () => controller.abort());

  const cards = params.ids.map((id) => {
    const card = createCard(id);
    usersSection.append(card);
    return card;
  });

  setSummary('loading', 'Загрузка...');

  const results = await Promise.allSettled(
    params.ids.map((id) => loadUser(id, params.delay, controller.signal))
  );

  let loaded = 0;
  let failed = 0;
  let aborted = 0;

  results.forEach((result, index) => {
    const card = cards[index];
    if (result.status === 'fulfilled') {
      loaded++;
      fillSuccess(card, result.value);
    } else if (isAbortError(result.reason)) {
      aborted++;
      fillFailure(card, 'aborted', 'Запрос отменён');
    } else {
      failed++;
      fillFailure(card, 'error', result.reason.message);
    }
  });

  cancelButton.disabled = true;

  if (aborted > 0) {
    setSummary('aborted', `Запросы отменены. Загружено: ${loaded}; ошибок: ${failed}; отменено: ${aborted}`);
  } else if (failed === 0) {
    setSummary('success', `Загружено: ${loaded}; ошибок: 0`);
  } else if (loaded > 0) {
    setSummary('partial', `Загружено: ${loaded}; ошибок: ${failed}`);
  } else {
    setSummary('error', `Загружено: 0; ошибок: ${failed}`);
  }
}

main();
