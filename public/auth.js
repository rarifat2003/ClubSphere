// Shared by login.html and registration.html
const form = document.querySelector('form');
const errorBox = document.getElementById('error');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.style.display = 'none';

  const body = Object.fromEntries(new FormData(form));
  const res = await fetch(form.dataset.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));

  if (res.ok) {
    window.location.href = 'dashboard.html';
  } else {
    errorBox.textContent = data.error || 'Something went wrong';
    errorBox.style.display = 'block';
  }
});