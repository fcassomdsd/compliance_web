<template>
  <section class="not-found">
    <h1>Page not found</h1>
    <p>The page you requested does not exist.</p>
    <RouterLink class="home-link" to="/site-visit">Go to Site Visit Manager</RouterLink>
  </section>
</template>

<style scoped>
.not-found {
  text-align: center;
  padding: 2rem 1rem;
}

h1 {
  margin-bottom: 0.5rem;
}

p {
  margin-bottom: 1.25rem;
  color: #444;
}

.home-link {
  display: inline-block;
  text-decoration: none;
  background-color: var(--secondary-color);
  color: var(--color-white);
  padding: 0.6rem 1rem;
  border-radius: 8px;
}
</style>