document.addEventListener('DOMContentLoaded', () => {
  const loginButton = document.getElementById('login-button');
  const userInfo = document.getElementById('user-info');
  const cronusButton = document.getElementById('cronus-button');
  const ximButton = document.getElementById('xim-button');

  // Function to fetch user info
  async function checkUser() {
    try {
      const response = await fetch('/user');
      if (response.ok) {
        const user = await response.json();
        userInfo.innerHTML = `
                    <span>Welcome, ${user.username}</span>
                    <button id="logout-button">Logout</button>
                `;
        loginButton.style.display = 'none';

        const logoutButton = document.getElementById('logout-button');
        logoutButton.addEventListener('click', () => {
          window.location.href = '/logout';
        });
      } else {
        userInfo.innerHTML = '';
        loginButton.style.display = 'block';
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  }

  // Login button handler
  loginButton.addEventListener('click', () => {
    window.location.href = '/auth/discord';
  });

  // Fetch products and map names to IDs
  let productMap = {};

  async function loadProducts() {
    try {
      const response = await fetch('/products');
      if (response.ok) {
        const products = await response.json();
        products.forEach(product => {
          productMap[product.name.toLowerCase()] = product._id;
        });
      }
    } catch (error) {
      console.error('Error loading products:', error);
    }
  }

  // Purchase handler
  async function handlePurchase(productName) {
    const productId = productMap[productName.toLowerCase()];
    if (!productId) {
      alert('Product not found. Please try again later.');
      return;
    }

    try {
      const response = await fetch(`/buy/${productId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
      } else {
        const error = await response.json();
        alert(error.message);
      }
    } catch (error) {
      console.error('Error during purchase:', error);
      alert('An error occurred during purchase.');
    }
  }

  // Button handlers
  if (cronusButton) {
    cronusButton.addEventListener('click', () => handlePurchase('Cronus Zen Script'));
  }

  if (ximButton) {
    ximButton.addEventListener('click', () => handlePurchase('XIM Matrix Script'));
  }

  // Initial load
  loadProducts().then(checkUser);
});
