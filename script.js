// 🌙 Theme toggle
function toggleTheme() {
  const body = document.body;
  const isDark = body.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// 📄 Go to form
function goToForm() {
  document.getElementById('home').classList.add('hidden');
  document.getElementById('form-section').classList.remove('hidden');
  document.getElementById('match-section').classList.add('hidden');
}

// 🚀 Submit Profile
async function handleSubmit(event) {
  event.preventDefault();

  const name = document.getElementById('name').value;
  const city = document.getElementById('city').value;
  const teach = document.getElementById('teach').value;
  const learn = document.getElementById('learn').value;
  const mode = document.getElementById('mode').value;
  const email = document.getElementById('email').value;
  const story = document.getElementById('story').value;

  const userData = { name, city, teach, learn, mode, email, story };

  try {
    const method = localStorage.getItem('profile_created') ? 'PUT' : 'POST';

    await fetch(`http://localhost:5000/api/users/${email}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    localStorage.setItem('profile_created', 'true');
    localStorage.setItem('user', JSON.stringify(userData));

    const res = await fetch(`http://localhost:5000/api/users/match/${learn}`);
    const matches = await res.json();

    const matchSection = document.getElementById('match-section');
    const matchCards = matches.map(user => `
      <div class="card">
        <h3>${user.name} from ${user.city}</h3>
        <p>Can teach: ${user.teach}</p>
        <p>Wants to learn: ${user.learn}</p>
        <button onclick="sendRequest('${user.email}', '${user.name}')">Send Connect Request</button>
      </div>
    `).join('');

    matchSection.innerHTML = `
      <h2>Skill Buddies for You</h2>
      ${matchCards || '<p>No matching users found. Try again later!</p>'}
      <button onclick="prefillForm()">Edit My Profile</button>
      <button onclick="deleteProfile()">Delete My Profile</button>
    `;

    document.getElementById('form-section').classList.add('hidden');
    matchSection.classList.remove('hidden');

  } catch (error) {
    alert('Error: ' + error.message);
  }
}

// ✏️ Prefill form
function prefillForm() {
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user) return;

  document.getElementById('name').value = user.name;
  document.getElementById('email').value = user.email;

  document.getElementById('form-section').classList.remove('hidden');
  document.getElementById('match-section').classList.add('hidden');
}

// ❌ Delete profile
async function deleteProfile() {
  const user = JSON.parse(localStorage.getItem('user'));
  const confirmDelete = confirm("Are you sure you want to delete your profile?");
  if (!confirmDelete) return;

  try {
    const res = await fetch(`http://localhost:5000/api/users/${user.email}`, {
      method: 'DELETE'
    });

    const data = await res.json();
    alert(data.msg);

    localStorage.removeItem('profile_created');
    localStorage.removeItem('user');
    document.getElementById('form-section').reset();
    window.location.reload();
  } catch (err) {
    alert('Error deleting profile');
  }
}

// 🔍 Search matches
async function handleSearch() {
  const skill = document.getElementById('search-skill').value.trim();
  if (!skill) return alert("Please enter a skill to search.");

  try {
    const res = await fetch(`http://localhost:5000/api/users/match/${skill}`);
    const data = await res.json();

    const matchSection = document.getElementById('match-section');
    matchSection.innerHTML = ''; 
    matchSection.classList.remove('hidden');

    if (data.length === 0) {
      matchSection.innerHTML = '<p>No matches found 😢</p>';
      return;
    }

    data.forEach(user => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <h3>${user.name}</h3>
        <p><strong>City:</strong> ${user.city}</p>
        <p><strong>Teaches:</strong> ${user.teach}</p>
        <p><strong>Wants to Learn:</strong> ${user.learn}</p>
        <p><strong>Mode:</strong> ${user.mode}</p>
        <p><strong>Email:</strong> ${user.email}</p>
        ${user.story ? `<p><strong>Story:</strong> ${user.story}</p>` : ''}
      `;
      matchSection.appendChild(card);
    });

  } catch (err) {
    alert("Something went wrong while searching 😞");
    console.error(err);
  }
}

// 📩 Send connect request
async function sendRequest(to, name) {
  const from = JSON.parse(localStorage.getItem('user')).email;
  const message = prompt(`Send a message to ${name}:`);
  if (!message) return;

  try {
    const res = await fetch('http://localhost:5000/api/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, message })
    });

    const data = await res.json();
    alert(data.msg);
  } catch (err) {
    console.error('Request failed:', err);
    alert('Something went wrong while sending request.');
  }
}

// 📥 Load incoming requests
async function loadRequests() {
  const email = JSON.parse(localStorage.getItem('user')).email;

  try {
    const res = await fetch(`http://localhost:5000/api/connect/received/${email}`);
    const requests = await res.json();

    const container = document.getElementById('incoming-requests');
    if (!requests.length) {
      container.innerHTML = "<p>No incoming requests yet.</p>";
      return;
    }

    container.innerHTML = requests.map(req => `
      <div class="card">
        <p><strong>${req.from}</strong> wants to connect:</p>
        <p>"${req.message}"</p>
        <button onclick="respondToRequest('${req._id}', 'accepted')">Accept</button>
        <button onclick="respondToRequest('${req._id}', 'rejected')">Reject</button>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading requests:', err);
  }
}

// ✅ Accept/Reject request
async function respondToRequest(requestId, status) {
  try {
    const res = await fetch(`http://localhost:5000/api/connect/respond/${requestId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });

    const data = await res.json();
    alert(data.msg);
    loadRequests(); // Refresh the list
  } catch (err) {
    console.error('Error responding to request:', err);
    alert('Failed to update request');
  }
}

// 💬 Submit testimonial
async function submitTestimonial(e) {
  e.preventDefault();
  const name = document.getElementById('t-name').value;
  const message = document.getElementById('t-message').value;

  const res = await fetch('http://localhost:5000/api/testimonials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, message })
  });

  const data = await res.json();
  alert(data.msg);
  e.target.reset();
  loadTestimonials();
}


// 🧾 Load testimonials
async function loadTestimonials() {
  const res = await fetch('/api/testimonials');
  const testimonials = await res.json();

  const container = document.getElementById('testimonials');
  container.innerHTML = testimonials.map(t => `
    <div class="card">
      <p>"${t.message}"</p>
      <strong>- ${t.name}</strong>
    </div>
  `).join('');
}

// 🚀 On page load
window.onload = () => {
  // Apply saved theme
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark');
    const toggle = document.getElementById('themeToggle');
    if (toggle) toggle.checked = true;
  }

  // Load sections if present
  if (document.getElementById('testimonials')) loadTestimonials();
  if (document.getElementById('incoming-requests')) loadRequests();
};
