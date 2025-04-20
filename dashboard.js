// public/dashboard.js

const email = localStorage.getItem('userEmail'); // or get from JWT if using auth

async function loadProfile() {
  try {
    const res = await fetch('http://localhost:5000/api/users/match/all');
    const users = await res.json();
    const user = users.find(u => u.email === email);

    if (!user) {
      document.getElementById('user-profile').innerHTML = `<p>Profile not found.</p>`;
      return;
    }

    window.currentUser = user;

    document.getElementById('user-profile').innerHTML = `
      <p><strong>Name:</strong> ${user.name}</p>
      <p><strong>City:</strong> ${user.city}</p>
      <p><strong>Teaches:</strong> ${user.teach}</p>
      <p><strong>Wants to Learn:</strong> ${user.learn}</p>
      <p><strong>Mode:</strong> ${user.mode}</p>
      <p><strong>Email:</strong> ${user.email}</p>
    `;
  } catch (err) {
    console.error(err);
  }
}

async function deleteProfile() {
  if (confirm("Are you sure you want to delete your profile?")) {
    await fetch(`http://localhost:5000/api/users/${email}`, {
      method: 'DELETE'
    });
    alert("Profile deleted successfully.");
    window.location.href = '/';
  }
}

function editProfile() {
  const user = window.currentUser;
  const url = `/index.html?edit=true&email=${user.email}`;
  window.location.href = url;
}

async function getMatches() {
  const skill = window.currentUser.learn;
  const res = await fetch(`http://localhost:5000/api/users/match/${skill}`);
  const matches = await res.json();

  const cards = matches.map(user => `
    <div class="card">
      <h3>${user.name}</h3>
      <p>City: ${user.city}</p>
      <p>Can Teach: ${user.teach}</p>
      <a href="mailto:${user.email}">
        <button>Connect</button>
      </a>
    </div>
  `).join('');

  document.getElementById('matches-list').innerHTML = cards;
  document.getElementById('profile-section').classList.add('hidden');
  document.getElementById('matches-section').classList.remove('hidden');
}

function backToProfile() {
  document.getElementById('matches-section').classList.add('hidden');
  document.getElementById('profile-section').classList.remove('hidden');
}

loadProfile();
