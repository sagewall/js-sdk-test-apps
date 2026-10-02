import "./style.css";

type App = {
  description: string;
  slug: string;
  title: string;
};

const apps = (import.meta.env.VITE_APPS as App[]).filter((app) => app.slug !== "website");
const root = document.querySelector<HTMLDivElement>("#app")!;

root.innerHTML = `
  <header>
    <img src="${import.meta.env.BASE_URL}favicon.svg" alt="" width="32" height="32" />
    <h1>JS SDK Test Apps</h1>
  </header>
  <main>
    <div class="section-heading">
      <h2>Applications</h2>
      <span>${apps.length} published</span>
    </div>
    <ul aria-label="Applications" id="applications"></ul>
    <p class="empty" ${apps.length ? "hidden" : ""}>No applications published yet.</p>
  </main>
`;

const list = document.querySelector<HTMLUListElement>("#applications")!;

for (const app of apps) {
  const description = document.createElement("p");
  const item = document.createElement("li");
  const link = document.createElement("a");

  description.textContent = app.description;
  link.href = `${import.meta.env.BASE_URL}${app.slug}/`;
  link.textContent = app.title;
  item.append(link);
  if (app.description) item.append(description);
  list.append(item);
}
